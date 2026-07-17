/**
 * Email template builders for the inquiry pipeline.
 *
 * The firm receives the complete inquiry. The customer reply uses a local
 * model only for inquiry-specific wording; booking, deposit, availability,
 * and legal-safety terms are fixed application-owned text.
 */
import type { EmailMessage } from './provider';
import type { FirmProfile } from '../firms/types';
import type { BaseInquiry } from '../inquiry/types';
import { getFieldsForFirm } from '../inquiry/fields';
import { generateLocalEmailDraft } from '../ai/local';

export interface TemplateInput {
  firm: FirmProfile;
  inquiry: BaseInquiry & { practiceFields?: Record<string, string> };
  classification: { primary: string | null; confidence: 'high' | 'medium' | 'low'; topics: string[] };
  submittedAt: Date;
  availability?: {
    status: 'ok' | 'blocked';
    timezone?: string;
    slots?: { startISO: string; endISO: string }[];
    demo?: boolean;
  };
}

/** Escape untrusted content before interpolation into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeWithBreaks(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function formatSubmittedAt(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'long',
  }).format(date);
}

function humanize(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const NON_CONFIDENTIALITY_WARNING =
  'Submitting this form does not create an attorney-client relationship. ' +
  'No confidential documents should be sent through this form or in response to it.';

/** The firm email preserves every submitted field and replies to the inquirer. */
export function buildFirmNotification(input: TemplateInput): EmailMessage {
  const { firm, inquiry, classification, submittedAt } = input;
  const labels = new Map(getFieldsForFirm(firm).map((field) => [field.name, field.label]));
  const rows: Array<[string, string]> = [
    [labels.get('fullName') ?? 'Full name', inquiry.fullName],
    [labels.get('email') ?? 'Email address', inquiry.email],
    [labels.get('phone') ?? 'Phone number', inquiry.phone?.trim() ? inquiry.phone : '(not provided)'],
    [labels.get('preferredContact') ?? 'Preferred contact method', inquiry.preferredContact],
    [labels.get('message') ?? 'Message', inquiry.message],
  ];
  for (const [name, value] of Object.entries(inquiry.practiceFields ?? {})) {
    rows.push([labels.get(name) ?? humanize(name), value.trim() === '' ? '(not provided)' : value]);
  }

  const submitted = formatSubmittedAt(submittedAt);
  const classificationLine = `Classification: ${classification.primary ?? 'uncategorized'} (confidence: ${classification.confidence})`;
  const subject = `New ${classification.primary ?? 'general'} inquiry for ${firm.name}`;
  const htmlRows = rows.map(([label, value]) =>
    `<tr><th align="left" valign="top" style="padding:4px 12px 4px 0;">${escapeHtml(label)}</th>` +
    `<td style="padding:4px 0;">${escapeWithBreaks(value)}</td></tr>`,
  ).join('\n');
  const html = [
    '<div style="border:2px solid #b91c1c;background:#fef2f2;padding:12px 16px;margin-bottom:16px;">',
    `<strong>Important:</strong> ${escapeHtml(NON_CONFIDENTIALITY_WARNING)}`,
    '</div>',
    '<p>A new inquiry was submitted through your IntakeBrief intake page.</p>',
    `<p><strong>Submitted:</strong> ${escapeHtml(submitted)}<br>${escapeHtml(classificationLine)}</p>`,
    `<table cellpadding="0" cellspacing="0">${htmlRows}</table>`,
  ].join('\n');
  const text = [
    `IMPORTANT: ${NON_CONFIDENTIALITY_WARNING}`, '', 'A new inquiry was submitted through your IntakeBrief intake page.',
    `Submitted: ${submitted}`, classificationLine, '', ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
  return { to: firm.email ?? '', subject, html, text, replyTo: inquiry.email };
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there';
}

function formatOpenSlot(slot: { startISO: string }, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(slot.startISO));
}

function openSlots(input: TemplateInput): string[] {
  if (input.availability?.status === 'ok' && input.availability.slots?.length) {
    const timezone = input.availability.timezone || 'America/Chicago';
    const formatted = input.availability.slots.slice(0, 5).map((slot) => formatOpenSlot(slot, timezone));
    return input.availability.demo
      ? ['Demo availability — sample times; calendar not connected', ...formatted]
      : formatted;
  }
  return ['Open consultation times are not available to share in this email right now.'];
}

/**
 * The model's sole responsibility is a topic, short summary, and topical
 * information list. All consequential customer-facing terms stay below.
 */
export async function buildCustomerResponse(input: TemplateInput): Promise<EmailMessage> {
  const { firm, inquiry, classification } = input;
  const draft = await generateLocalEmailDraft({ inquiry, fallbackTopic: classification.primary });
  const slots = openSlots(input);
  const bookingUrl = `${(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/capture/${encodeURIComponent(firm.id)}`;
  const greeting = `Hi ${firstName(inquiry.fullName)},`;
  const thankYou = `Thank you for reaching out to us about ${draft.topic}. We would love to set up a consultation with you to further discuss ${draft.summary} We have provided a list of open time slots below.`;
  const notice = 'Notice: All consultations require a scheduled appointment and a $50 deposit. This deposit is non-refundable, but it will be applied to your consultation fee.';
  const replyInstruction = 'If none of these times are acceptable, please respond at your earliest convenience with the days and times that work best for you, and we will provide the soonest available times within those windows.';
  const confirmation = 'You will receive confirmation once the payment has been processed. We look forward to meeting you.';
  const legalNote = 'Note: This email does not establish a lawyer-client relationship. Do not respond to this email with any documentation or classified information. Sending documentation or classified information in reply, or in future correspondence before an attorney-client relationship is established, will result in cancellation of the scheduled appointment and forfeiture of the $50 deposit.';
  const preparationLead = 'To make the most of your time, the following information will be useful:';
  const documentsReminder = "Do not email these items; bring them to the consultation or follow the firm's separate secure instructions.";
  const subject = `${firm.name} - ${draft.topic} - Book a consultation`;
  const text = [
    greeting, '', thankYou, '', notice, '', 'Open time slots:', ...slots.map((slot) => `- ${slot}`),
    `Book a time: ${bookingUrl}`, '', replyInstruction, '', confirmation, '', legalNote, '', preparationLead,
    ...draft.preparation.map((item) => `- ${item}`), documentsReminder,
  ].join('\n');
  const html = [
    `<p>${escapeHtml(greeting)}</p>`, `<p>${escapeHtml(thankYou)}</p>`, `<p><strong>${escapeHtml(notice)}</strong></p>`,
    '<p><strong>Open time slots:</strong></p>', `<ul>${slots.map((slot) => `<li>${escapeHtml(slot)}</li>`).join('')}</ul>`,
    `<p><a href="${escapeHtml(bookingUrl)}">Book a consultation time</a></p>`, `<p>${escapeHtml(replyInstruction)}</p>`,
    `<p>${escapeHtml(confirmation)}</p>`, `<p><strong>${escapeHtml(legalNote)}</strong></p>`,
    `<p><strong>${escapeHtml(preparationLead)}</strong></p>`, `<ul>${draft.preparation.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    `<p>${escapeHtml(documentsReminder)}</p>`,
  ].join('\n');
  return { to: inquiry.email, subject, html, text };
}
