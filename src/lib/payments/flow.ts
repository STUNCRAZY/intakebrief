/**
 * M4 payments flow: $50 deposit checkout + Stripe webhook handling.
 *
 * Core rules enforced here:
 * - The deposit is exactly DEPOSIT_AMOUNT_CENTS (5000 = $50.00), a server-side
 *   constant. Any amount/currency field in caller input is ignored.
 * - An appointment is locked ONLY after a signature-verified webhook payment
 *   event. A browser redirect is never proof of payment.
 * - Webhook processing is idempotent (event ids persisted in .runtime/).
 * - Holds are released on expired/failed checkout.
 * - Only transaction references (checkout session ids) are stored — card data
 *   never touches this app; hosted Checkout handles cards.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEPOSIT_AMOUNT_CENTS, getStripe } from './stripe';
import { getFirm } from '@/lib/firms/load';
import type { BookingService } from '@/lib/booking/service';
import type { EmailMessage, EmailProvider, ProviderResult } from '@/lib/email/provider';

export interface FlowResult {
  http: number;
  body: object;
}

export interface CheckoutDeps {
  stripe?: any;
  env?: NodeJS.ProcessEnv;
  booking?: BookingService;
}

export interface WebhookDeps extends CheckoutDeps {
  email?: EmailProvider;
  eventStore?: WebhookEventStore;
}

const DEFAULT_BASE_URL = 'http://localhost:3000';

/**
 * Create a hosted Stripe Checkout session for the fixed $50 deposit.
 * Requires a known firm and an active hold on the slot. Amount and currency
 * are never taken from caller input.
 */
export async function createDepositCheckout(
  input: { firmId: string; slotId: string; holdId: string; customerEmail?: string },
  deps: CheckoutDeps = {},
): Promise<FlowResult> {
  const env = deps.env ?? process.env;
  const firm = getFirm(input.firmId);
  if (!firm) {
    return { http: 404, body: { error: 'unknown-firm' } };
  }
  const stripe = deps.stripe ?? getStripe(env);
  if (!stripe) {
    return { http: 503, body: { status: 'blocked', detail: 'payments blocked: missing STRIPE_SECRET_KEY' } };
  }
  const booking = deps.booking;
  if (!booking || !booking.isHeld(input.slotId)) {
    return { http: 409, body: { error: 'hold-required' } };
  }
  const baseUrl = env.APP_BASE_URL ?? DEFAULT_BASE_URL;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: DEPOSIT_AMOUNT_CENTS,
          product_data: { name: 'Consultation reservation deposit' },
        },
      },
    ],
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    metadata: { firmId: input.firmId, slotId: input.slotId, holdId: input.holdId },
    success_url: `${baseUrl}/capture/${input.firmId}/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/capture/${input.firmId}/return?cancelled=1`,
  });
  return { http: 200, body: { url: session.url, sessionId: session.id } };
}

/**
 * Idempotency store for processed Stripe event ids, file-backed at
 * .runtime/stripe-events.json (gitignored runtime data). Missing or corrupt
 * files are tolerated and treated as an empty store.
 */
export class WebhookEventStore {
  private static readonly MAX_IDS = 5000;

  constructor(private readonly file: string = path.join(process.cwd(), '.runtime', 'stripe-events.json')) {}

  private readIds(): string[] {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      return [];
    }
  }

  has(id: string): boolean {
    return this.readIds().includes(id);
  }

  put(id: string): void {
    const ids = this.readIds();
    if (ids.includes(id)) return;
    ids.push(id);
    const trimmed = ids.slice(-WebhookEventStore.MAX_IDS);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(trimmed), 'utf8');
    } catch (err) {
      console.warn(`webhook event store write failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/** Firm-facing notification: which slot confirmed + deposit received. */
function buildFirmNotification(firmEmail: string, firmName: string, slotId: string, sessionId: string): EmailMessage {
  const text = [
    `A consultation deposit has been received for ${firmName}.`,
    ``,
    `Confirmed slot: ${slotId}`,
    `Deposit: $50.00 (received)`,
    `Transaction reference: ${sessionId}`,
  ].join('\n');
  const html = [
    `<p>A consultation deposit has been received for <strong>${firmName}</strong>.</p>`,
    `<ul>`,
    `<li>Confirmed slot: ${slotId}</li>`,
    `<li>Deposit: $50.00 (received)</li>`,
    `<li>Transaction reference: ${sessionId}</li>`,
    `</ul>`,
  ].join('');
  return { to: firmEmail, subject: `Deposit received — consultation confirmed (${slotId})`, html, text };
}

/** Customer-facing confirmation: appointment + deposit, no attorney-client relationship. */
function buildCustomerConfirmation(customerEmail: string, firmName: string, slotId: string): EmailMessage {
  const disclaimer =
    'Submitting this deposit and receiving this confirmation does not create an attorney-client relationship. ' +
    'An attorney-client relationship is formed only after the firm completes a conflicts check and both parties sign an engagement agreement.';
  const text = [
    `Your consultation with ${firmName} is confirmed.`,
    ``,
    `Appointment: ${slotId}`,
    `Reservation deposit: $50.00 (received)`,
    ``,
    disclaimer,
  ].join('\n');
  const html = [
    `<p>Your consultation with <strong>${firmName}</strong> is confirmed.</p>`,
    `<ul>`,
    `<li>Appointment: ${slotId}</li>`,
    `<li>Reservation deposit: $50.00 (received)</li>`,
    `</ul>`,
    `<p style="color:#666;font-size:13px">${disclaimer}</p>`,
  ].join('');
  return { to: customerEmail, subject: `Consultation confirmed with ${firmName}`, html, text };
}

function metadataOf(obj: any): { firmId?: string; slotId?: string; holdId?: string } {
  const md = obj?.metadata ?? {};
  return { firmId: md.firmId, slotId: md.slotId, holdId: md.holdId };
}

/**
 * Handle a Stripe webhook delivery. Verifies the signature, dedupes by event
 * id, and only then applies side effects. Always answers with safe bodies.
 */
export async function handleWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
  deps: WebhookDeps = {},
): Promise<FlowResult> {
  const env = deps.env ?? process.env;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { http: 503, body: { status: 'blocked', detail: 'payments blocked: missing STRIPE_WEBHOOK_SECRET' } };
  }
  const stripe = deps.stripe ?? getStripe(env);
  if (!stripe) {
    return { http: 503, body: { status: 'blocked', detail: 'payments blocked: missing STRIPE_SECRET_KEY' } };
  }
  if (!signatureHeader) {
    return { http: 400, body: { error: 'invalid-signature' } };
  }
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch {
    return { http: 400, body: { error: 'invalid-signature' } };
  }

  const store = deps.eventStore ?? new WebhookEventStore();
  if (store.has(event.id)) {
    return { http: 200, body: { received: true, duplicate: true } };
  }

  const booking = deps.booking;
  const email = deps.email;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.amount_total !== DEPOSIT_AMOUNT_CENTS) {
      console.warn(
        `webhook amount mismatch: event ${event.id} session ${session.id} amount_total=${session.amount_total} expected=${DEPOSIT_AMOUNT_CENTS}`,
      );
      store.put(event.id);
      return { http: 200, body: { received: true, note: 'amount-mismatch' } };
    }
    const { firmId, slotId } = metadataOf(session);
    if (!booking || !slotId) {
      // Not marked processed: Stripe will retry so the confirm is not lost.
      return { http: 500, body: { error: 'confirm-unavailable' } };
    }
    try {
      booking.confirmBooking(slotId, session.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already confirmed')) {
        store.put(event.id);
        return { http: 200, body: { received: true, note: 'already-confirmed' } };
      }
      console.warn(`webhook confirm failed: event ${event.id}: ${message}`);
      return { http: 500, body: { error: 'confirm-failed' } };
    }

    // Confirmation emails — a blocked/failed provider is recorded, never fatal.
    const firm = firmId ? getFirm(firmId) : null;
    const customerEmail: string | undefined = session.customer_email ?? session.customer_details?.email ?? undefined;
    const emailStatus: Record<string, ProviderResult['status'] | 'skipped'> = {};
    if (email && firm?.email) {
      const res = await email.send(buildFirmNotification(firm.email, firm.name, slotId, session.id));
      emailStatus.firm = res.status;
    } else {
      emailStatus.firm = 'skipped';
    }
    if (email && customerEmail) {
      const res = await email.send(buildCustomerConfirmation(customerEmail, firm?.name ?? firmId ?? 'the firm', slotId));
      emailStatus.customer = res.status;
    } else {
      emailStatus.customer = 'skipped';
    }

    store.put(event.id);
    return { http: 200, body: { received: true, confirmed: true, email: emailStatus } };
  }

  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const { holdId } = metadataOf(event.data.object);
    const released = Boolean(booking && holdId && booking.releaseHold(holdId));
    store.put(event.id);
    return { http: 200, body: { received: true, released } };
  }

  store.put(event.id);
  return { http: 200, body: { received: true, ignored: true } };
}
