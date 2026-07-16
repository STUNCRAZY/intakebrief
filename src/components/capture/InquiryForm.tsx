'use client';

/**
 * Public inquiry form for a firm's proposed-concept landing page.
 * Honest state machine: submission delivery status, scheduling, holds, and
 * deposit checkout each report their own labeled outcome; every failure path
 * offers the firm's phone number as the human fallback.
 */
import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { MANDATED_DOCUMENT_INSTRUCTION, PROHIBITED_ITEMS } from '@/lib/guidance/prohibited';
import type { FirmProfile } from '@/lib/firms/types';
import type { FieldDef, InquiryResult } from '@/lib/inquiry/types';
import styles from './capture.module.css';

interface Slot {
  startISO: string;
  endISO: string;
}

export interface InquiryFormProps {
  firm: FirmProfile;
  fields: FieldDef[];
  /** Preparation-checklist items from getPreparationGuidance. */
  preparation: string[];
}

const BASE_NAMES = new Set([
  'fullName',
  'email',
  'phone',
  'preferredContact',
  'message',
  'consentTransactional',
  'acknowledgeNoRelationship',
]);

const CONSENT_LABEL =
  'I consent to receive transactional responses about my inquiry (for example, email or phone replies from the firm).';
const ACK_LABEL =
  'I acknowledge that submitting this form does not create an attorney-client relationship.';

function labelFor(field: FieldDef): string {
  if (field.name === 'consentTransactional') return CONSENT_LABEL;
  if (field.name === 'acknowledgeNoRelationship') return ACK_LABEL;
  return field.label;
}

function formatSlot(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: timezone || undefined,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatClock(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: timezone || undefined,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type SubmitState = 'idle' | 'submitting' | 'done';
type SchedState = 'idle' | 'loading' | 'ready' | 'blocked' | 'empty';
type HoldState = 'none' | 'placing' | 'held';
type CheckoutState = 'idle' | 'processing' | 'blocked';

interface Hold {
  holdId: string;
  expiresAt: string;
  slot: Slot;
}

export function InquiryForm({ firm, fields, preparation }: InquiryFormProps) {
  const [idempotencyKey] = useState<string>(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `key-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [result, setResult] = useState<InquiryResult | null>(null);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);

  const [sched, setSched] = useState<SchedState>('idle');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [timezone, setTimezone] = useState<string>('');
  const [schedDetail, setSchedDetail] = useState<string>('');

  const [selected, setSelected] = useState<string>('');
  const [holdState, setHoldState] = useState<HoldState>('none');
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdMessage, setHoldMessage] = useState<string>('');

  const [checkout, setCheckout] = useState<CheckoutState>('idle');
  const [checkoutDetail, setCheckoutDetail] = useState<string>('');

  const [statusLine, setStatusLine] = useState<string>('');

  const phone = firm.phone;

  /* ---------------- availability ---------------- */

  const loadAvailability = useCallback(
    async (refresh = false) => {
      setSched('loading');
      setSchedDetail('');
      setStatusLine(refresh ? 'Refreshing available consultation times…' : 'Loading available consultation times…');
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      try {
        const res = await fetch(
          `/api/availability?firmId=${encodeURIComponent(firm.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
        if (res.status === 503) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string };
          setSched('blocked');
          setSchedDetail(body.detail ?? '');
          setStatusLine('Online scheduling is not connected for this firm yet.');
          return;
        }
        if (!res.ok) throw new Error('availability-failed');
        const body = (await res.json()) as { status: 'ok'; timezone: string; slots: Slot[] };
        setTimezone(body.timezone);
        setSlots(body.slots);
        if (body.slots.length === 0) {
          setSched('empty');
          setStatusLine('No open consultation times in the next two weeks.');
        } else {
          setSched('ready');
          setStatusLine(`${body.slots.length} consultation time${body.slots.length === 1 ? '' : 's'} available.`);
        }
      } catch {
        setSched('blocked');
        setSchedDetail('We could not reach the scheduling service.');
        setStatusLine('Scheduling is unavailable right now.');
      }
    },
    [firm.id],
  );

  const accepted = result?.firmNotification.status === 'accepted';
  useEffect(() => {
    if (accepted) void loadAvailability();
  }, [accepted, loadAvailability]);

  /* ---------------- submit ---------------- */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const practiceFields: Record<string, string> = {};
    for (const field of fields) {
      if (BASE_NAMES.has(field.name)) continue;
      if (field.type === 'checkbox') {
        practiceFields[field.name] = data.get(field.name) ? 'yes' : 'no';
      } else {
        const value = data.get(field.name);
        if (typeof value === 'string' && value.trim() !== '') practiceFields[field.name] = value;
      }
    }

    const payload = {
      firmId: firm.id,
      fullName: String(data.get('fullName') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      preferredContact: data.get('preferredContact') === 'phone' ? ('phone' as const) : ('email' as const),
      message: String(data.get('message') ?? ''),
      consentTransactional: true as const,
      acknowledgeNoRelationship: true as const,
      honeypot: String(data.get('hp_company') ?? ''),
      idempotencyKey,
      practiceFields,
    };

    setSubmitState('submitting');
    setResult(null);
    setSubmitErrors([]);
    setRateLimitSeconds(null);
    setStatusLine('Submitting your inquiry…');

    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; retryAfterMs?: number };
        setRateLimitSeconds(Math.max(1, Math.ceil((body.retryAfterMs ?? 60000) / 1000)));
        setSubmitState('idle');
        setStatusLine('Too many submissions — please wait before trying again.');
        return;
      }
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string | string[] };
        const list = Array.isArray(body.error)
          ? body.error.map(String)
          : [String(body.error ?? 'Some fields need attention before this can be submitted.')];
        setSubmitErrors(list);
        setSubmitState('idle');
        setStatusLine('The inquiry was not accepted — please review the messages above the form.');
        return;
      }
      if (!res.ok) throw new Error('inquiry-failed');

      const body = (await res.json()) as InquiryResult;
      setResult(body);
      setSubmitState('done');
      setStatusLine('Your inquiry has been submitted — delivery status is shown below.');
    } catch {
      setSubmitErrors([`Something went wrong while submitting. Please try again, or call the firm at ${phone}.`]);
      setSubmitState('idle');
      setStatusLine('Submission failed due to a network or server problem.');
    }
  }

  /* ---------------- holds & checkout ---------------- */

  async function placeHold(slot: Slot) {
    setSelected(slot.startISO);
    setHoldState('placing');
    setHoldMessage('');
    setStatusLine(`Holding ${formatSlot(slot.startISO, timezone)}…`);
    try {
      const res = await fetch('/api/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: firm.id, slotStartISO: slot.startISO, slotEndISO: slot.endISO }),
      });
      if (res.status === 409) {
        setHoldState('none');
        setSelected('');
        setHoldMessage('That time was just taken — here are the latest open times.');
        setStatusLine('That time was just taken.');
        await loadAvailability(true);
        return;
      }
      if (!res.ok) throw new Error('hold-failed');
      const body = (await res.json()) as { holdId: string; expiresAt: string };
      setHold({ holdId: body.holdId, expiresAt: body.expiresAt, slot });
      setHoldState('held');
      setStatusLine('Time held for 15 minutes. Review the preparation checklist and reserve with a deposit.');
    } catch {
      setHoldState('none');
      setHoldMessage(`We could not hold that time. Please try again, or call the firm at ${phone}.`);
      setStatusLine('We could not hold the selected time.');
    }
  }

  async function cancelHold() {
    if (!hold) return;
    setStatusLine('Releasing your held time…');
    try {
      await fetch('/api/holds', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId: hold.holdId }),
      });
    } catch {
      /* release is best-effort; the hold expires on its own */
    }
    setHold(null);
    setHoldState('none');
    setSelected('');
    setCheckout('idle');
    setStatusLine('Held time released. You can pick another time below.');
  }

  async function startCheckout() {
    if (!hold) return;
    setCheckout('processing');
    setCheckoutDetail('');
    setStatusLine('Starting the secure deposit checkout…');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: firm.id, slotId: hold.slot.startISO, holdId: hold.holdId }),
      });
      if (res.status === 503) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        setCheckout('blocked');
        setCheckoutDetail(body.detail ?? '');
        setStatusLine('Online deposit is not configured yet.');
        return;
      }
      if (res.status === 409) {
        setHold(null);
        setHoldState('none');
        setSelected('');
        setCheckout('idle');
        setHoldMessage('Your held time expired — please choose a time again.');
        setStatusLine('Your hold expired — pick a time again.');
        await loadAvailability(true);
        return;
      }
      if (!res.ok) throw new Error('checkout-failed');
      const body = (await res.json()) as { url: string; sessionId: string };
      setStatusLine('Redirecting to secure payment…');
      window.location.href = body.url;
    } catch {
      setCheckout('idle');
      setHoldMessage(`We could not start checkout. Please try again, or call the firm at ${phone}.`);
      setStatusLine('Checkout failed to start.');
    }
  }

  /* ---------------- render ---------------- */

  return (
    <div className={styles.wrap}>
      <p className={styles.status} role="status" aria-live="polite">
        {statusLine}
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.prohibited} role="note" aria-label="What not to send">
          <p className={styles.prohibitedInstruction}>{MANDATED_DOCUMENT_INSTRUCTION}</p>
          <p className={styles.prohibitedHeading}>Never include in this form:</p>
          <ul className={styles.prohibitedList}>
            {PROHIBITED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {submitErrors.length > 0 ? (
          <div className={styles.errorBox} role="alert">
            <p className={styles.errorHeading}>The inquiry was not accepted:</p>
            <ul>
              {submitErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {rateLimitSeconds !== null ? (
          <div className={styles.rateLimit} role="alert">
            Too many submissions — please wait about {rateLimitSeconds} second{rateLimitSeconds === 1 ? '' : 's'} before
            trying again, or call the firm at {phone}.
          </div>
        ) : null}

        {/* Honeypot: hidden from humans, attractive to bots. Must stay empty. */}
        <div className={styles.hp} aria-hidden="true">
          <label htmlFor="field-hp_company">Company</label>
          <input
            type="text"
            id="field-hp_company"
            name="hp_company"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {fields.map((field) => {
          const id = `field-${field.name}`;
          const label = labelFor(field);
          if (field.type === 'checkbox') {
            return (
              <div key={field.name} className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  id={id}
                  name={field.name}
                  value="true"
                  required={field.required}
                  aria-required={field.required}
                />
                <label htmlFor={id} className={styles.checkboxLabel}>
                  {label}
                  {field.required ? (
                    <span className={styles.required} aria-hidden="true">
                      {' '}
                      *
                    </span>
                  ) : null}
                </label>
              </div>
            );
          }
          return (
            <div key={field.name} className={styles.field}>
              <label htmlFor={id} className={styles.label}>
                {label}
                {field.required ? (
                  <span className={styles.required} aria-hidden="true">
                    {' '}
                    *
                  </span>
                ) : null}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  id={id}
                  name={field.name}
                  rows={5}
                  required={field.required}
                  aria-required={field.required}
                  className={styles.textarea}
                />
              ) : field.type === 'select' ? (
                <select
                  id={id}
                  name={field.name}
                  required={field.required}
                  aria-required={field.required}
                  defaultValue=""
                  className={styles.select}
                >
                  <option value="" disabled={field.required}>
                    Select…
                  </option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  name={field.name}
                  type={field.type}
                  required={field.required}
                  aria-required={field.required}
                  className={styles.input}
                />
              )}
            </div>
          );
        })}

        <p className={styles.privacy}>
          Please keep your message brief and non-confidential — a short summary is enough for the firm to respond.
          Submitting this form does not create an attorney-client relationship.
        </p>

        <button type="submit" className={styles.submit} disabled={submitState === 'submitting'}>
          {submitState === 'submitting' ? 'Submitting…' : 'Send inquiry'}
        </button>
      </form>

      {result ? (
        <section className={styles.result} aria-label="Inquiry delivery status">
          <h3 className={styles.resultTitle}>Inquiry received — delivery status</h3>
          <p className={styles.resultLine}>
            <span className={`${styles.badge} ${styles[`badge_${result.firmNotification.status}`]}`}>
              Firm notification: {result.firmNotification.status}
            </span>{' '}
            {result.firmNotification.detail}
          </p>
          <p className={styles.resultLine}>
            <span className={`${styles.badge} ${styles[`badge_${result.customerResponse.status}`]}`}>
              Your confirmation email: {result.customerResponse.status}
            </span>{' '}
            {result.customerResponse.detail}
          </p>
          {result.firmNotification.status !== 'accepted' ? (
            <p className={styles.resultLine}>
              The firm may not have received this inquiry automatically — please call {phone} to make sure.
            </p>
          ) : null}
          {result.classification.primary ? (
            <p className={styles.classification}>
              Likely matter: {result.classification.primary} ({result.classification.confidence} confidence)
            </p>
          ) : null}
        </section>
      ) : null}

      {accepted ? (
        <section className={styles.schedule} aria-label="Schedule a consultation">
          <h3 className={styles.scheduleTitle}>Schedule your consultation</h3>

          {sched === 'loading' || sched === 'idle' ? (
            <p className={styles.scheduleNote}>Loading available consultation times…</p>
          ) : null}

          {sched === 'blocked' ? (
            <div className={styles.blocked} role="note">
              <p className={styles.blockedTitle}>Online scheduling is not connected for this firm yet.</p>
              {schedDetail ? <p>{schedDetail}</p> : null}
              <p>
                The firm still received your inquiry. To book a time now, please call <strong>{phone}</strong>.
              </p>
            </div>
          ) : null}

          {sched === 'empty' ? (
            <div className={styles.blocked} role="note">
              <p className={styles.blockedTitle}>No open times in the next two weeks.</p>
              <p>
                Please call <strong>{phone}</strong> — the firm may be able to fit you in sooner.
              </p>
            </div>
          ) : null}

          {sched === 'ready' && !hold ? (
            <fieldset className={styles.slotFieldset} disabled={holdState === 'placing'}>
              <legend className={styles.slotLegend}>
                Choose a consultation time ({timezone || 'firm timezone'})
              </legend>
              {holdMessage ? (
                <p className={styles.holdMessage} role="alert">
                  {holdMessage}
                </p>
              ) : null}
              <div className={styles.slotList} role="radiogroup" aria-label="Available consultation times">
                {slots.map((slot) => (
                  <label key={slot.startISO} className={styles.slotOption} htmlFor={`slot-${slot.startISO}`}>
                    <input
                      type="radio"
                      id={`slot-${slot.startISO}`}
                      name="consultation-slot"
                      value={slot.startISO}
                      checked={selected === slot.startISO}
                      onChange={() => void placeHold(slot)}
                    />
                    <span>{formatSlot(slot.startISO, timezone)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {hold ? (
            <div className={styles.held}>
              <p className={styles.heldTitle}>
                Time held for 15 minutes: {formatSlot(hold.slot.startISO, timezone)}
              </p>
              <p className={styles.heldMeta}>
                Your hold expires at {formatClock(hold.expiresAt, timezone)}. Reserve it with a $50 deposit, or release
                it for someone else.
              </p>

              <div className={styles.checklist}>
                <h4 className={styles.checklistTitle}>How to prepare for your consultation</h4>
                <ul>
                  {preparation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              {holdMessage ? (
                <p className={styles.holdMessage} role="alert">
                  {holdMessage}
                </p>
              ) : null}

              {checkout === 'blocked' ? (
                <div className={styles.blocked} role="note">
                  <p className={styles.blockedTitle}>Online deposit is not configured yet.</p>
                  {checkoutDetail ? <p>{checkoutDetail}</p> : null}
                  <p>
                    Your time is still held. To reserve it now, please call <strong>{phone}</strong>.
                  </p>
                </div>
              ) : (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.submit}
                    onClick={() => void startCheckout()}
                    disabled={checkout === 'processing'}
                  >
                    {checkout === 'processing' ? 'Starting checkout…' : 'Reserve with $50 deposit'}
                  </button>
                  <button type="button" className={styles.secondary} onClick={() => void cancelHold()}>
                    Cancel hold
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
