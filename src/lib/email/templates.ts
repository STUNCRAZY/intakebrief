/**
 * Email template builders for the inquiry pipeline.
 *
 * buildFirmNotification — full inquiry detail to the firm, replyTo the
 *   inquirer, with a prominent non-confidentiality warning.
 * buildCustomerResponse — topic-aware acknowledgment sent by IntakeBrief on
 *   the firm's behalf. Never gives legal advice, never predicts outcomes,
 *   never asks the customer to respond to the email itself.
 *
 * All user-supplied content is HTML-escaped at output time.
 */
import type { EmailMessage } from './provider';
import type { FirmProfile } from '../firms/types';
import type { BaseInquiry } from '../inquiry/types';
import { getFieldsForFirm } from '../inquiry/fields';
import { getPreparationGuidance } from '../guidance/preparation';
import { MANDATED_DOCUMENT_INSTRUCTION, PROHIBITED_ITEMS } from '../guidance/prohibited';

export interface TemplateInput {
  firm: FirmProfile;
  inquiry: BaseInquiry & { practiceFields?: Record<string, string> };
  classification: { primary: string | null; confidence: 'high' | 'medium' | 'low'; topics: string[] };
  submittedAt: Date;
}

/** Escape user content for safe interpolation into HTML. */
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

/** Format the submission time in America/Chicago with the timezone named. */
function formatSubmittedAt(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'long',
  }).format(date);
}

/** Fallback label for practice fields unknown to getFieldsForFirm. */
function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const NON_CONFIDENTIALITY_WARNING =
  'Submitting this form does not create an attorney-client relationship. ' +
  'No confidential documents should be sent through this form or in response to it.';

/* ------------------------------------------------------------------ */
/* Topic copy blocks — one per classifier topic.                       */
/* Each names the topic plainly, acknowledges the situation without    */
/* quoting the message back, and explains what a consultation can      */
/* clarify. None give legal advice or predict outcomes.                */
/* ------------------------------------------------------------------ */

interface TopicBlock {
  label: string;
  body: string;
}

const TOPIC_BLOCKS: Record<string, TopicBlock> = {
  divorce: {
    label: 'Divorce',
    body:
      'Your inquiry concerns divorce. Divorce typically involves decisions about dividing property and debts, possible support, and — where children are involved — parenting arrangements. An initial consultation can help clarify how the process generally works, which issues are most likely to matter in your situation, and what information would be helpful to gather.',
  },
  separation: {
    label: 'Separation',
    body:
      'Your inquiry concerns separation. A period of separation can raise questions about living arrangements, finances, and temporary arrangements for children, whether or not a divorce follows. An initial consultation can help clarify the difference between informal and court-recognized arrangements and what steps people in your position commonly consider.',
  },
  'child-custody': {
    label: 'Child custody',
    body:
      'Your inquiry concerns child custody. Custody matters generally center on the child\u2019s best interests, any existing orders, and each parent\u2019s involvement. An initial consultation can help clarify how custody arrangements are commonly evaluated, what role existing orders play, and what to expect if a hearing is involved.',
  },
  visitation: {
    label: 'Visitation / parenting time',
    body:
      'Your inquiry concerns visitation or parenting time. These matters often involve setting, modifying, or enforcing a schedule for time with a child. An initial consultation can help clarify how parenting-time arrangements are commonly structured and what options people typically explore when a schedule is not being followed.',
  },
  'child-support': {
    label: 'Child support',
    body:
      'Your inquiry concerns child support. Support questions can involve establishing an amount, modifying an existing order, or addressing missed payments. An initial consultation can help clarify how support is generally determined and what information is usually needed to evaluate a change.',
  },
  'criminal-charge': {
    label: 'Criminal charge',
    body:
      'Your inquiry concerns a criminal charge. Criminal matters often move quickly through scheduled court settings, and decisions made early can shape the options available later. An initial consultation can help clarify the general court process, what upcoming dates mean, and what information to bring.',
  },
  arrest: {
    label: 'Arrest',
    body:
      'Your inquiry concerns an arrest. The period following an arrest often involves strict timelines and fast-moving decisions. An initial consultation can help clarify what typically happens next in the process and which questions to be ready to discuss.',
  },
  bond: {
    label: 'Bond',
    body:
      'Your inquiry concerns bond or bail. Bond questions often involve how bond is set, reviewed, or modified. An initial consultation can help clarify how bond decisions are generally made and what information is typically relevant.',
  },
  dwi: {
    label: 'DWI',
    body:
      'Your inquiry concerns a DWI. DWI matters can involve both a criminal case and separate consequences for driving privileges, each with its own deadlines. An initial consultation can help clarify the different tracks a DWI matter can take and which dates matter most.',
  },
  probate: {
    label: 'Probate',
    body:
      'Your inquiry concerns probate. Probate is the court-supervised process for handling a person\u2019s estate after death, and the steps can vary by county. An initial consultation can help clarify what the process generally involves and which filings or decisions may be time-sensitive.',
  },
  executor: {
    label: 'Executor / personal representative',
    body:
      'Your inquiry concerns serving as an executor or personal representative. That role carries formal duties — gathering assets, notifying heirs and creditors, and accounting to the court. An initial consultation can help clarify what the role generally requires and where people commonly run into difficulty.',
  },
  wills: {
    label: 'Wills',
    body:
      'Your inquiry concerns a will. Will-related matters can range from planning ahead to questions about the validity or interpretation of an existing will. An initial consultation can help clarify which situation applies and what information would be useful to review together.',
  },
  trusts: {
    label: 'Trusts',
    body:
      'Your inquiry concerns a trust. Trust matters can involve creating a trust, administering one, or questions about a trustee\u2019s responsibilities. An initial consultation can help clarify which kind of trust issue is involved and what information the firm would need to assess it.',
  },
  guardianship: {
    label: 'Guardianship',
    body:
      'Your inquiry concerns guardianship. Guardianship matters involve a court process for appointing someone to make decisions on another person\u2019s behalf. An initial consultation can help clarify how the process generally works and what a court typically considers.',
  },
  'personal-injury': {
    label: 'Personal injury',
    body:
      'Your inquiry concerns a personal injury. Injury matters often involve questions about how the incident happened, the treatment received, and how a claim is evaluated. An initial consultation can help clarify how injury claims generally proceed and what documentation tends to matter.',
  },
  'vehicle-accident': {
    label: 'Vehicle accident',
    body:
      'Your inquiry concerns a vehicle accident. Accident matters can involve insurance claims, questions about fault, and injuries that are still being treated. An initial consultation can help clarify how these matters commonly unfold and what information from the accident is most useful.',
  },
  'medical-treatment': {
    label: 'Medical treatment',
    body:
      'Your inquiry concerns medical treatment connected to a legal matter. Treatment status and provider information often play a central role in evaluating an injury-related claim. An initial consultation can help clarify how treatment information is typically used and what is worth keeping track of going forward.',
  },
  'insurance-claim': {
    label: 'Insurance claim',
    body:
      'Your inquiry concerns an insurance claim. Claim matters can involve a denial, a settlement offer, or difficulty dealing with an adjuster. An initial consultation can help clarify how claim disputes are commonly evaluated and what the correspondence you have received may mean for next steps.',
  },
  'business-dispute': {
    label: 'Business dispute',
    body:
      'Your inquiry concerns a business dispute. Disputes between partners, owners, or companies often turn on the underlying agreements and the history of the relationship. An initial consultation can help clarify how such disputes are commonly approached and what documents would be most relevant.',
  },
  'contract-dispute': {
    label: 'Contract dispute',
    body:
      'Your inquiry concerns a contract dispute. These matters often turn on the specific terms of the agreement and how each side has performed. An initial consultation can help clarify what the dispute may involve and which documents and communications are likely to matter.',
  },
  'real-estate-dispute': {
    label: 'Real estate dispute',
    body:
      'Your inquiry concerns a real estate dispute. Property matters can involve boundaries, titles, easements, or disagreements arising from a transaction. An initial consultation can help clarify how these disputes are commonly evaluated and what records would be useful to gather.',
  },
  'civil-litigation': {
    label: 'Civil litigation',
    body:
      'Your inquiry concerns a civil lawsuit or a potential lawsuit. Litigation matters often involve strict response deadlines and a structured court process. An initial consultation can help clarify the general stages of a civil case and which dates or papers deserve immediate attention.',
  },
  'employment-dispute': {
    label: 'Employment dispute',
    body:
      'Your inquiry concerns an employment dispute. Workplace matters — such as a termination or unpaid wages — can involve short deadlines and specific procedures. An initial consultation can help clarify what processes may apply and what information would help the firm understand the situation.',
  },
  discrimination: {
    label: 'Discrimination',
    body:
      'Your inquiry concerns discrimination. Discrimination matters can involve specific agencies and filing deadlines that come before any lawsuit. An initial consultation can help clarify how these matters are commonly raised and which dates may be important.',
  },
  'civil-rights': {
    label: 'Civil rights',
    body:
      'Your inquiry concerns a potential civil rights issue. Civil rights matters can involve particular procedures and time limits that differ from other cases. An initial consultation can help clarify what processes may apply and what information the firm would need.',
  },
};

const LOW_CONFIDENCE_BODY =
  'Your inquiry did not point clearly to a single matter category, and that is completely fine. ' +
  'An initial consultation can help clarify which matter category best fits your situation and what a path forward could look like.';

/** True when a practice field records a hearing, court, or deadline date. */
function hasUrgentDate(inquiry: TemplateInput['inquiry']): boolean {
  return Object.entries(inquiry.practiceFields ?? {}).some(
    ([name, value]) => /hearing|court|deadline/i.test(name) && value.trim() !== '',
  );
}

/* ------------------------------------------------------------------ */
/* Firm notification                                                   */
/* ------------------------------------------------------------------ */

export function buildFirmNotification(input: TemplateInput): EmailMessage {
  const { firm, inquiry, classification, submittedAt } = input;
  const labels = new Map(getFieldsForFirm(firm).map((f) => [f.name, f.label]));

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

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" valign="top" style="padding:4px 12px 4px 0;">${escapeHtml(label)}</th>` +
        `<td style="padding:4px 0;">${escapeWithBreaks(value)}</td></tr>`,
    )
    .join('\n');

  const html = [
    `<div style="border:2px solid #b91c1c;background:#fef2f2;padding:12px 16px;margin-bottom:16px;">`,
    `<strong>Important:</strong> ${escapeHtml(NON_CONFIDENTIALITY_WARNING)}`,
    `</div>`,
    `<p>A new inquiry was submitted through your IntakeBrief intake page.</p>`,
    `<p><strong>Submitted:</strong> ${escapeHtml(submitted)}<br>${escapeHtml(classificationLine)}</p>`,
    `<table cellpadding="0" cellspacing="0">${htmlRows}</table>`,
  ].join('\n');

  const text = [
    `IMPORTANT: ${NON_CONFIDENTIALITY_WARNING}`,
    '',
    'A new inquiry was submitted through your IntakeBrief intake page.',
    `Submitted: ${submitted}`,
    classificationLine,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join('\n');

  return { to: firm.email ?? '', subject, html, text, replyTo: inquiry.email };
}

/* ------------------------------------------------------------------ */
/* Customer response                                                   */
/* ------------------------------------------------------------------ */

export function buildCustomerResponse(input: TemplateInput): EmailMessage {
  const { firm, inquiry, classification } = input;

  const block = classification.primary ? TOPIC_BLOCKS[classification.primary] : undefined;
  const topicParagraph =
    classification.confidence === 'low' || !block ? LOW_CONFIDENCE_BODY : block.body;

  const urgent = hasUrgentDate(inquiry);
  const urgencyParagraph = urgent
    ? 'You noted an upcoming hearing, court date, or deadline in your inquiry, so this matter may be time-sensitive. Choosing an early consultation time on the firm\u2019s intake page is a sensible precaution.'
    : null;

  const preparation = getPreparationGuidance({ lane: firm.lane, topics: classification.topics });

  const introParagraph =
    `Dear ${inquiry.fullName}, this message was sent by IntakeBrief on behalf of ${firm.name} ` +
    `in response to the inquiry you submitted through the firm\u2019s online intake page. ` +
    `This response does not create an attorney-client relationship, and no attorney-client ` +
    `relationship is formed unless and until the firm agrees to represent you.`;

  const nextSteps = [
    `The firm reviews new inquiries as they arrive.`,
    `Available consultation times are presented on the firm\u2019s intake page, where you can choose the time that works for you.`,
    `Reserving a consultation time requires a $50 reservation deposit. The deposit is charged only to reserve the consultation time and is applied per the firm\u2019s policies.`,
  ];

  const documentsParagraph =
    `${MANDATED_DOCUMENT_INSTRUCTION} Please also do not send any of the following through this ` +
    `form or by email: ${PROHIBITED_ITEMS.join('; ')}.`;

  const closingParagraph =
    `Nothing in this message is legal advice, and no outcome can be predicted or promised. ` +
    `For scheduling questions, please use the firm\u2019s intake page rather than this message.`;

  const signature = `IntakeBrief, on behalf of ${firm.name}`;

  const subject = `Your consultation inquiry with ${firm.name}`;

  const textParts: string[] = [
    introParagraph,
    '',
    topicParagraph,
    ...(urgencyParagraph ? ['', urgencyParagraph] : []),
    '',
    'What happens next:',
    ...nextSteps.map((step, i) => `${i + 1}. ${step}`),
    '',
    'How to prepare for a consultation:',
    ...preparation.map((item) => `- ${item}`),
    '',
    'Documents and sensitive information:',
    documentsParagraph,
    '',
    closingParagraph,
    '',
    signature,
  ];

  const htmlParts: string[] = [
    `<p>${escapeWithBreaks(introParagraph)}</p>`,
    `<p>${escapeHtml(topicParagraph)}</p>`,
    ...(urgencyParagraph
      ? [`<p><strong>${escapeHtml(urgencyParagraph)}</strong></p>`]
      : []),
    `<p><strong>What happens next:</strong></p>`,
    `<ol>${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`,
    `<p><strong>How to prepare for a consultation:</strong></p>`,
    `<ul>${preparation.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    `<p><strong>Documents and sensitive information:</strong><br>${escapeHtml(documentsParagraph)}</p>`,
    `<p>${escapeHtml(closingParagraph)}</p>`,
    `<p>${escapeHtml(signature)}</p>`,
  ];

  return { to: inquiry.email, subject, html: htmlParts.join('\n'), text: textParts.join('\n') };
}
