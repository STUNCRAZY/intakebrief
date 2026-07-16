import { NextResponse } from 'next/server';
import { createDepositCheckout } from '@/lib/payments/flow';
import { getBookingService } from '@/lib/calendar/service';

/**
 * POST /api/checkout — create a hosted Stripe Checkout session for the fixed
 * $50 consultation deposit. Requires an existing slot hold (slotId = slot
 * startISO). The amount is a server-side constant; any amount/currency fields
 * in the request body are ignored.
 */
export async function POST(req: Request) {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const input = (parsed ?? {}) as Record<string, unknown>;
  const { firmId, slotId, holdId, customerEmail } = input;
  if (typeof firmId !== 'string' || typeof slotId !== 'string' || typeof holdId !== 'string') {
    return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
  }
  try {
    const result = await createDepositCheckout(
      {
        firmId,
        slotId,
        holdId,
        customerEmail: typeof customerEmail === 'string' ? customerEmail : undefined,
      },
      { booking: getBookingService() },
    );
    return NextResponse.json(result.body, { status: result.http });
  } catch (err) {
    console.warn(`checkout failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: 'checkout-failed' }, { status: 500 });
  }
}
