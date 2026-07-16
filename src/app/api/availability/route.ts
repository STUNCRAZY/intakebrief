import { NextResponse } from 'next/server';
import { getFirm } from '@/lib/firms/load';
import { getAvailability } from '@/lib/calendar/service';

/**
 * GET /api/availability?firmId&from&to
 * Real provider slots minus held/confirmed. Blocked (503) when no calendar
 * is configured — never fabricated slots.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const firmId = url.searchParams.get('firmId') ?? '';
    if (!firmId || !getFirm(firmId)) {
      return NextResponse.json({ error: 'unknown-firm' }, { status: 400 });
    }
    const now = Date.now();
    const from = url.searchParams.get('from') ?? new Date(now).toISOString();
    const to = url.searchParams.get('to') ?? new Date(now + 14 * 86_400_000).toISOString();

    const result = await getAvailability(firmId, from, to);
    if (result.status === 'blocked') {
      return NextResponse.json(result, { status: 503 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'availability-failed' }, { status: 500 });
  }
}
