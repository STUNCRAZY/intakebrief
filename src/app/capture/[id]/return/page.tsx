import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import React from 'react';
import { getFirm } from '@/lib/firms/load';
import shared from '../../../shared.module.css';
import styles from './page.module.css';

interface ReturnSearchParams {
  session_id?: string;
  cancelled?: string;
}

export const metadata: Metadata = { title: 'Deposit return' };

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

  return (
    <div className={styles.page}>
      <p className={styles.back}>
        <Link href={`/capture/${firm.id}`}>← Back to the {firm.name} page</Link>
      </p>

      {cancelled ? (
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
