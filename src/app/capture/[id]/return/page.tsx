import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import React from 'react';
import { getBookingService } from '@/lib/calendar/service';
import { getFirm } from '@/lib/firms/load';
import shared from '../../../shared.module.css';
import styles from './page.module.css';

interface ReturnSearchParams {
  session_id?: string;
  cancelled?: string;
  demo?: string;
  slotId?: string;
  holdId?: string;
}

export const metadata: Metadata = { title: 'Deposit return' };

/** Wall-clock rendering of a demo slot ISO (explicit -05:00 offset inside). */
function formatDemoSlot(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'long',
      timeZone: 'America/Chicago',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Stripe checkout return target. Honest copy only: a completed checkout session
 * does not itself confirm the appointment — confirmation follows payment
 * verification (webhook) and is delivered by email.
 */
export default async function CaptureReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ReturnSearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const firm = getFirm(id);
  if (!firm) notFound();

  const cancelled = query.cancelled === '1';
  const hasSession = typeof query.session_id === 'string' && query.session_id.length > 0;
  const isDemo = query.demo === '1';

  // Demo mode return: no Stripe, no charge. Confirm the held slot locally so
  // the sales preview shows a realistic end state; an already-confirmed slot
  // (demo link visited twice) is a note, never a crash.
  let demoAlreadyBooked = false;
  let demoConfirmFailed = false;
  if (isDemo) {
    const slotId = query.slotId ?? '';
    const holdId = query.holdId ?? '';
    try {
      getBookingService().confirmBooking(slotId, `demo-${holdId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already confirmed')) {
        demoAlreadyBooked = true;
      } else {
        demoConfirmFailed = true;
      }
    }
  }

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link href={`/capture/${firm.id}`}>← Back to the {firm.name} page</Link>
      </p>

      {isDemo ? (
        <section className={styles.panel} aria-labelledby="return-heading">
          <span className={`${shared.stamp} ${shared.stampDanger}`} style={{ fontSize: '1rem', padding: '0.35em 0.6em', border: '2px solid currentColor' }}>
            Demo — no charge made
          </span>
          <h1 id="return-heading" className={styles.title}>
            Simulated checkout complete
          </h1>
          <p>
            <strong>This is a demo.</strong> No payment was collected and no card was involved. The appointment
            {query.slotId ? (
              <>
                {' '}
                for <strong>{formatDemoSlot(query.slotId)}</strong>
              </>
            ) : null}{' '}
            is confirmed in this local demo only.
          </p>
          <p>
            In production, the $50 deposit is charged through Stripe-hosted checkout, and the appointment locks only
            after a signed Stripe webhook verifies the payment — a browser redirect is never proof of payment.
          </p>
          {demoAlreadyBooked ? (
            <p>
              <em>Note: this demo appointment was already booked — revisiting the link changes nothing.</em>
            </p>
          ) : null}
          {demoConfirmFailed ? (
            <p>
              <em>Note: the demo booking could not be recorded locally; the demo flow is otherwise unaffected.</em>
            </p>
          ) : null}
          <p>
            <Link className={styles.cta} href={`/capture/${firm.id}`}>
              Back to the {firm.name} page
            </Link>
          </p>
        </section>
      ) : cancelled ? (
        <section className={styles.panel} aria-labelledby="return-heading">
          <span className={`${shared.stamp} ${shared.stampWarning}`}>Checkout cancelled</span>
          <h1 id="return-heading" className={styles.title}>
            No charge was completed
          </h1>
          <p>
            You cancelled the deposit checkout before paying, so <strong>no charge was made</strong>. The time you held
            has been released and may be claimed by someone else.
          </p>
          <p>
            To pick another time, return to the page below and choose a consultation slot again — if you already sent
            the inquiry form, the firm still has your message. You can also call the firm directly at{' '}
            <strong>{firm.phone}</strong>.
          </p>
          <p>
            <Link className={styles.cta} href={`/capture/${firm.id}`}>
              Choose another time
            </Link>
          </p>
        </section>
      ) : hasSession ? (
        <section className={styles.panel} aria-labelledby="return-heading">
          <span className={`${shared.stamp} ${shared.stampSuccess}`}>Deposit received — verifying</span>
          <h1 id="return-heading" className={styles.title}>
            Your deposit is being verified
          </h1>
          <p>
            The payment provider reported a completed deposit for your consultation with <strong>{firm.name}</strong>.
            Your appointment is <strong>confirmed only after the payment is verified</strong> — this usually takes a
            few moments.
          </p>
          <p>
            Once verification completes, a confirmation email with your appointment details will be sent to the address
            you provided. If nothing arrives within an hour, please call the firm at <strong>{firm.phone}</strong>.
          </p>
          <p>
            <Link className={styles.cta} href={`/capture/${firm.id}`}>
              Return to the {firm.name} page
            </Link>
          </p>
        </section>
      ) : (
        <section className={styles.panel} aria-labelledby="return-heading">
          <span className={`${shared.stamp} ${shared.stampSlate}`}>Return</span>
          <h1 id="return-heading" className={styles.title}>
            Nothing to verify
          </h1>
          <p>
            This page is the return target for deposit checkout, but no checkout session was reported. If you were
            trying to reserve a consultation time, start again below — or call the firm at{' '}
            <strong>{firm.phone}</strong>.
          </p>
          <p>
            <Link className={styles.cta} href={`/capture/${firm.id}`}>
              Back to {firm.name}
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
