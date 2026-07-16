/**
 * Stripe deposit payments.
 * Hosted Checkout only — raw card data never touches this app. The deposit
 * amount is a server-side constant; client input can never set the price.
 * getStripe() returns null (blocked) when STRIPE_SECRET_KEY is missing.
 */
import Stripe from 'stripe';

/** Fixed consultation deposit: $50.00. Never derived from client input. */
export const DEPOSIT_AMOUNT_CENTS = 5000;

let warnedMissingKey = false;

/** Configured Stripe client, or null when payments are blocked (missing env). */
export function getStripe(env: NodeJS.ProcessEnv = process.env): Stripe | null {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn('payments blocked: missing env var STRIPE_SECRET_KEY');
    }
    return null;
  }
  return new Stripe(secretKey);
}

export interface DepositCheckoutInput {
  firmId: string;
  slotId: string;
  customerEmail: string;
}

export interface DepositCheckoutResult {
  sessionId: string;
  url: string;
}

/** Create a hosted Checkout Session for the fixed consultation deposit. */
export async function createDepositCheckout(input: DepositCheckoutInput): Promise<DepositCheckoutResult> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('payments blocked: missing env var STRIPE_SECRET_KEY');
  }
  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  const priceId = process.env.STRIPE_PRICE_ID;
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: DEPOSIT_AMOUNT_CENTS,
          product_data: { name: 'Consultation deposit' },
        },
      };
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [lineItem],
    customer_email: input.customerEmail,
    success_url: `${baseUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/booking/cancel`,
    metadata: { firmId: input.firmId, slotId: input.slotId },
  });
  if (!session.url) {
    throw new Error('stripe checkout session created without a hosted URL');
  }
  return { sessionId: session.id, url: session.url };
}

/** Verify and parse a Stripe webhook payload using STRIPE_WEBHOOK_SECRET. */
export function constructWebhookEvent(rawBody: string | Buffer, signatureHeader: string): Stripe.Event {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('payments blocked: missing env var STRIPE_SECRET_KEY');
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('payments blocked: missing env var STRIPE_WEBHOOK_SECRET');
  }
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
}

/** True when the event is a completed Checkout Session whose payment succeeded. */
export function isDepositPaid(event: Stripe.Event): boolean {
  if (event.type !== 'checkout.session.completed') return false;
  const session = event.data.object as Stripe.Checkout.Session;
  return session.payment_status === 'paid';
}
