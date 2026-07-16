/**
 * POST /api/inquiry — thin adapter over processInquiry.
 * Validation problems are 400s with safe text; this route never throws a 500
 * for user input, and never reflects internals in error responses.
 */
import { NextResponse } from 'next/server';
import { getEmailProvider } from '@/lib/email/provider';
import { processInquiry } from '@/lib/inquiry/process';

export async function POST(req: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || undefined;

  try {
    const { http, body } = await processInquiry(payload, {
      ip,
      provider: getEmailProvider(),
    });
    const res = NextResponse.json(body, { status: http });
    if (http === 429 && typeof body.retryAfterMs === 'number') {
      res.headers.set('Retry-After', String(Math.max(1, Math.ceil(body.retryAfterMs / 1000))));
    }
    return res;
  } catch {
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
