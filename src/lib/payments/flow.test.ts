/**
 * M4 payments flow tests — deposit checkout + Stripe webhook handling.
 * Signature tests use a real Stripe instance with a test key and
 * generateTestHeaderString for valid/invalid signatures.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';
import { DEPOSIT_AMOUNT_CENTS } from './stripe';
import { createDepositCheckout, handleWebhook, WebhookEventStore } from './flow';
import { BookingService } from '@/lib/booking/service';
import type { EmailMessage, EmailProvider } from '@/lib/email/provider';

const FIRM_ID = 'chandler-ross'; // researched firm with a non-null email
const SLOT_ID = '2026-05-01T15:00:00.000Z';
const HOLD_TTL_MS = 15 * 60 * 1000;

const WEBHOOK_SECRET = 'whsec_testsecret_m4';
const stripe = new Stripe('sk_test_FAKE0000000000000000000');

function tempEventStore(): WebhookEventStore {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'm4-events-')), 'stripe-events.json');
  return new WebhookEventStore(file);
}

class FakeEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];
  async send(msg: EmailMessage) {
    this.sent.push(msg);
    return { status: 'accepted' as const, detail: 'fake-accepted' };
  }
}

function fakeStripeRecorder() {
  const calls: any[] = [];
  const fake = {
    checkout: {
      sessions: {
        create: async (params: any) => {
          calls.push(params);
          return { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
        },
      },
    },
  };
  return { fake, calls };
}

function heldBooking(): { booking: BookingService; holdId: string } {
  const booking = new BookingService();
  const holdId = booking.hold(SLOT_ID, HOLD_TTL_MS);
  return { booking, holdId };
}

function eventPayload(overrides: { id?: string; type?: string; object?: object } = {}): string {
  return JSON.stringify({
    id: overrides.id ?? 'evt_1',
    object: 'event',
    type: overrides.type ?? 'checkout.session.completed',
    data: {
      object: overrides.object ?? {
        id: 'cs_test_paid_1',
        object: 'checkout.session',
        amount_total: 5000,
        currency: 'usd',
        payment_status: 'paid',
        customer_email: 'client@example.com',
        metadata: { firmId: FIRM_ID, slotId: SLOT_ID, holdId: 'hold-1' },
      },
    },
  });
}

function sign(payload: string): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
}

function webhookDeps(booking: BookingService, email: FakeEmailProvider, eventStore = tempEventStore()) {
  const env = { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET } as unknown as NodeJS.ProcessEnv;
  return { stripe, env, booking, email, eventStore };
}

describe('deposit constant', () => {
  it('is exactly $50.00', () => {
    expect(DEPOSIT_AMOUNT_CENTS).toBe(5000);
  });
});

describe('createDepositCheckout', () => {
  it('is blocked without STRIPE_SECRET_KEY', async () => {
    const { booking, holdId } = heldBooking();
    const res = await createDepositCheckout(
      { firmId: FIRM_ID, slotId: SLOT_ID, holdId },
      { env: {} as NodeJS.ProcessEnv, booking },
    );
    expect(res.http).toBe(503);
    expect(res.body).toMatchObject({ status: 'blocked', detail: 'payments blocked: missing STRIPE_SECRET_KEY' });
  });

  it('returns 404 for an unknown firm', async () => {
    const { fake } = fakeStripeRecorder();
    const { booking, holdId } = heldBooking();
    const res = await createDepositCheckout(
      { firmId: 'no-such-firm', slotId: SLOT_ID, holdId },
      { stripe: fake, booking },
    );
    expect(res.http).toBe(404);
    expect(res.body).toMatchObject({ error: 'unknown-firm' });
  });

  it('returns 409 without a valid hold', async () => {
    const { fake, calls } = fakeStripeRecorder();
    const booking = new BookingService(); // no hold placed
    const res = await createDepositCheckout(
      { firmId: FIRM_ID, slotId: SLOT_ID, holdId: 'hold-nope' },
      { stripe: fake, booking },
    );
    expect(res.http).toBe(409);
    expect(res.body).toMatchObject({ error: 'hold-required' });
    expect(calls).toHaveLength(0);
  });

  it('ignores client-supplied amount/currency and charges exactly $50 usd', async () => {
    const { fake, calls } = fakeStripeRecorder();
    const { booking, holdId } = heldBooking();
    const hostile = {
      firmId: FIRM_ID,
      slotId: SLOT_ID,
      holdId,
      customerEmail: 'client@example.com',
      amount: 1,
      unit_amount: 1,
      currency: 'eur',
      price_data: { unit_amount: 1 },
    } as any;
    const env = { APP_BASE_URL: 'https://app.example.com' } as unknown as NodeJS.ProcessEnv;
    const res = await createDepositCheckout(hostile, { stripe: fake, booking, env });
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ sessionId: 'cs_test_123' });
    expect(calls).toHaveLength(1);
    const params = calls[0];
    expect(params.mode).toBe('payment');
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0].price_data.unit_amount).toBe(5000);
    expect(params.line_items[0].price_data.currency).toBe('usd');
    expect(params.line_items[0].price_data.product_data.name).toBe('Consultation reservation deposit');
    expect(params.metadata).toEqual({ firmId: FIRM_ID, slotId: SLOT_ID, holdId });
    expect(params.success_url).toBe(`https://app.example.com/capture/${FIRM_ID}/return?session_id={CHECKOUT_SESSION_ID}`);
    expect(params.cancel_url).toBe(`https://app.example.com/capture/${FIRM_ID}/return?cancelled=1`);
  });

  it('creating a checkout session never confirms the booking (no payment yet)', async () => {
    const { fake } = fakeStripeRecorder();
    const { booking, holdId } = heldBooking();
    await createDepositCheckout({ firmId: FIRM_ID, slotId: SLOT_ID, holdId }, { stripe: fake, booking });
    // A hosted checkout URL is not proof of payment: slot stays merely held.
    expect(booking.getConfirmed()).toHaveLength(0);
    expect(booking.isHeld(SLOT_ID)).toBe(true);
  });

  it('demo mode without a valid hold still returns 409 (hold rule enforced)', async () => {
    const booking = new BookingService(); // no hold placed
    const env = { DEMO_MODE: 'true' } as unknown as NodeJS.ProcessEnv;
    const res = await createDepositCheckout(
      { firmId: FIRM_ID, slotId: SLOT_ID, holdId: 'hold-nope' },
      { env, booking },
    );
    expect(res.http).toBe(409);
    expect(res.body).toMatchObject({ error: 'hold-required' });
    expect(res.body).not.toMatchObject({ demo: true });
  });

  it('demo mode with a valid hold returns 200 demo:true with a demo=1 return URL', async () => {
    const { booking, holdId } = heldBooking();
    const env = { DEMO_MODE: 'true', APP_BASE_URL: 'https://app.example.com' } as unknown as NodeJS.ProcessEnv;
    const res = await createDepositCheckout(
      { firmId: FIRM_ID, slotId: SLOT_ID, holdId },
      { env, booking },
    );
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ demo: true, sessionId: `demo-${holdId}` });
    const url = (res.body as { url?: string }).url ?? '';
    expect(url).toContain('demo=1');
    expect(url).toContain(`https://app.example.com/capture/${FIRM_ID}/return`);
    expect(url).toContain(`slotId=${encodeURIComponent(SLOT_ID)}`);
    expect(url).toContain(`holdId=${encodeURIComponent(holdId)}`);
    // Simulated checkout never confirms the booking by itself.
    expect(booking.getConfirmed()).toHaveLength(0);
  });

  it('demo mode off without Stripe is 503 blocked exactly as before', async () => {
    const { booking, holdId } = heldBooking();
    for (const env of [
      {} as NodeJS.ProcessEnv,
      { DEMO_MODE: 'false' } as unknown as NodeJS.ProcessEnv,
    ]) {
      const res = await createDepositCheckout(
        { firmId: FIRM_ID, slotId: SLOT_ID, holdId },
        { env, booking },
      );
      expect(res.http).toBe(503);
      expect(res.body).toMatchObject({ status: 'blocked', detail: 'payments blocked: missing STRIPE_SECRET_KEY' });
    }
  });

  it('a configured Stripe always wins over demo mode (real session created, no demo flag)', async () => {
    const { fake, calls } = fakeStripeRecorder();
    const { booking, holdId } = heldBooking();
    const env = { DEMO_MODE: 'true' } as unknown as NodeJS.ProcessEnv;
    const res = await createDepositCheckout(
      { firmId: FIRM_ID, slotId: SLOT_ID, holdId },
      { stripe: fake, booking, env },
    );
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ sessionId: 'cs_test_123' });
    expect(res.body).not.toMatchObject({ demo: true });
    expect(calls).toHaveLength(1);
  });
});

describe('handleWebhook', () => {
  it('is blocked without STRIPE_WEBHOOK_SECRET', async () => {
    const res = await handleWebhook('{}', 'sig', { stripe, env: {} as NodeJS.ProcessEnv });
    expect(res.http).toBe(503);
    expect(res.body).toMatchObject({ status: 'blocked', detail: 'payments blocked: missing STRIPE_WEBHOOK_SECRET' });
  });

  it('rejects a bad signature with 400', async () => {
    const { booking } = heldBooking();
    const res = await handleWebhook(eventPayload(), 't=1,v1=bogus', webhookDeps(booking, new FakeEmailProvider()));
    expect(res.http).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid-signature' });
    expect(booking.getConfirmed()).toHaveLength(0);
  });

  it('confirms once on a valid completed event and attempts both emails', async () => {
    const { booking } = heldBooking();
    const email = new FakeEmailProvider();
    const confirmSpy = vi.spyOn(booking, 'confirmBooking');
    const payload = eventPayload();
    const res = await handleWebhook(payload, sign(payload), webhookDeps(booking, email));
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ received: true, confirmed: true, email: { firm: 'accepted', customer: 'accepted' } });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(SLOT_ID, 'cs_test_paid_1');
    expect(email.sent).toHaveLength(2);
    const firmMsg = email.sent.find((m) => m.to === 'support@chandlerrosslaw.com');
    const customerMsg = email.sent.find((m) => m.to === 'client@example.com');
    expect(firmMsg?.text).toContain(SLOT_ID);
    expect(firmMsg?.text).toContain('$50.00');
    expect(customerMsg?.text).toContain(SLOT_ID);
    expect(customerMsg?.text).toContain('does not create an attorney-client relationship');
  });

  it('duplicate delivery has no second confirm and no second emails', async () => {
    const { booking } = heldBooking();
    const email = new FakeEmailProvider();
    const store = tempEventStore();
    const confirmSpy = vi.spyOn(booking, 'confirmBooking');
    const payload = eventPayload();
    const first = await handleWebhook(payload, sign(payload), webhookDeps(booking, email, store));
    expect(first.http).toBe(200);
    const second = await handleWebhook(payload, sign(payload), webhookDeps(booking, email, store));
    expect(second.http).toBe(200);
    expect(second.body).toMatchObject({ received: true, duplicate: true });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(email.sent).toHaveLength(2);
  });

  it('amount_total 4999 does not confirm (logged mismatch)', async () => {
    const { booking } = heldBooking();
    const email = new FakeEmailProvider();
    const confirmSpy = vi.spyOn(booking, 'confirmBooking');
    const payload = eventPayload({
      object: {
        id: 'cs_test_short',
        object: 'checkout.session',
        amount_total: 4999,
        currency: 'usd',
        payment_status: 'paid',
        metadata: { firmId: FIRM_ID, slotId: SLOT_ID, holdId: 'hold-1' },
      },
    });
    const res = await handleWebhook(payload, sign(payload), webhookDeps(booking, email));
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ received: true, note: 'amount-mismatch' });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(email.sent).toHaveLength(0);
    expect(booking.getConfirmed()).toHaveLength(0);
  });

  it('expired checkout releases the hold', async () => {
    const { booking, holdId } = heldBooking();
    const payload = eventPayload({
      id: 'evt_expired',
      type: 'checkout.session.expired',
      object: {
        id: 'cs_test_expired',
        object: 'checkout.session',
        metadata: { firmId: FIRM_ID, slotId: SLOT_ID, holdId },
      },
    });
    const res = await handleWebhook(payload, sign(payload), webhookDeps(booking, new FakeEmailProvider()));
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ received: true, released: true });
    expect(booking.isHeld(SLOT_ID)).toBe(false);
    expect(booking.getConfirmed()).toHaveLength(0);
  });

  it('failed payment releases the hold', async () => {
    const { booking, holdId } = heldBooking();
    const payload = eventPayload({
      id: 'evt_failed',
      type: 'payment_intent.payment_failed',
      object: {
        id: 'pi_test_failed',
        object: 'payment_intent',
        metadata: { firmId: FIRM_ID, slotId: SLOT_ID, holdId },
      },
    });
    const res = await handleWebhook(payload, sign(payload), webhookDeps(booking, new FakeEmailProvider()));
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ received: true, released: true });
    expect(booking.isHeld(SLOT_ID)).toBe(false);
  });

  it('already-confirmed slot returns 200 already-confirmed without crashing', async () => {
    const { booking } = heldBooking();
    booking.confirmBooking(SLOT_ID, 'cs_test_earlier');
    const email = new FakeEmailProvider();
    const payload = eventPayload();
    const res = await handleWebhook(payload, sign(payload), webhookDeps(booking, email));
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ received: true, note: 'already-confirmed' });
    expect(email.sent).toHaveLength(0);
    expect(booking.getConfirmed()).toHaveLength(1);
  });

  it('unknown event types are acknowledged and ignored', async () => {
    const { booking } = heldBooking();
    const payload = eventPayload({ id: 'evt_ping', type: 'customer.created', object: { id: 'cus_1' } });
    const res = await handleWebhook(payload, sign(payload), webhookDeps(booking, new FakeEmailProvider()));
    expect(res.http).toBe(200);
    expect(res.body).toMatchObject({ received: true, ignored: true });
  });

  it('event store tolerates missing/corrupt files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm4-corrupt-'));
    const missing = new WebhookEventStore(path.join(dir, 'nope', 'events.json'));
    expect(missing.has('evt_x')).toBe(false);
    missing.put('evt_x');
    expect(missing.has('evt_x')).toBe(true);
    const corruptFile = path.join(dir, 'corrupt.json');
    fs.writeFileSync(corruptFile, '{not json');
    const corrupt = new WebhookEventStore(corruptFile);
    expect(corrupt.has('evt_x')).toBe(false);
    corrupt.put('evt_y');
    expect(corrupt.has('evt_y')).toBe(true);
  });
});
