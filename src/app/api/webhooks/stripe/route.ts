import { NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/payments/flow';
import { getEmailProvider } from '@/lib/email/provider';
import { getBookingService } from '@/lib/calendar/service';

/**
 * POST /api/webhooks/stripe — signature-verified Stripe webhook receiver.
 * The raw body is required for signature verification; the appointment is
 * locked ONLY after a verified payment event lands here — a browser redirect
 * is never proof of payment. Processing is idempotent by event id.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') ?? undefined;
  try {
    const result = await handleWebhook(rawBody, signature, {
      booking: getBookingService(),
      email: getEmailProvider(),
    });
    return NextResponse.json(result.body, { status: result.http });
  } catch (err) {
    console.warn(`webhook handling failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: 'webhook-failed' }, { status: 500 });
  }
}
