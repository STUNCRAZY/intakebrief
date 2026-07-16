import { NextResponse } from 'next/server';
import { getFirm } from '@/lib/firms/load';
import { getBookingService, HOLD_TTL_MS } from '@/lib/calendar/service';

/**
 * POST /api/holds { firmId, slotStartISO, slotEndISO }
 * Places a 15-minute hold on a slot (slot id = slotStartISO).
 * 409 when the slot is already held or confirmed.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      firmId?: string;
      slotStartISO?: string;
      slotEndISO?: string;
    };
    if (!body.firmId || !getFirm(body.firmId)) {
      return NextResponse.json({ error: 'unknown-firm' }, { status: 400 });
    }
    if (!body.slotStartISO || !body.slotEndISO || Number.isNaN(Date.parse(body.slotStartISO))) {
      return NextResponse.json({ error: 'invalid-slot' }, { status: 400 });
    }
    try {
      const holdId = getBookingService().hold(body.slotStartISO, HOLD_TTL_MS);
      return NextResponse.json({ holdId, expiresAt: Date.now() + HOLD_TTL_MS }, { status: 200 });
    } catch {
      return NextResponse.json({ error: 'slot-unavailable' }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: 'hold-failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/holds { holdId }
 * Releases a hold. 404 when the hold id is unknown or already expired.
 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { holdId?: string };
    if (!body.holdId) {
      return NextResponse.json({ error: 'missing-holdId' }, { status: 400 });
    }
    const released = getBookingService().releaseHold(body.holdId);
    if (!released) {
      return NextResponse.json({ error: 'hold-not-found' }, { status: 404 });
    }
    return NextResponse.json({ released: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'release-failed' }, { status: 500 });
  }
}
