/**
 * Prohibited-submission guidance shared by the intake form and the customer
 * response email. The mandated instruction must be shown verbatim wherever
 * document-submission rules are communicated.
 *
 * Authoritative module: M2 (email templates + guidance libraries).
 */

export const MANDATED_DOCUMENT_INSTRUCTION =
  'Do not upload or email legal documents through this form. If document review is appropriate, the firm will provide separate secure instructions.';

/** Items a customer must never submit through the intake form or by email. */
export const PROHIBITED_ITEMS: string[] = [
  'legal documents',
  'pleadings',
  'court filings',
  'discovery',
  'contracts',
  'wills',
  'trusts',
  'medical records',
  'police reports',
  'evidence',
  'photographs',
  'video',
  'audio',
  'Social Security numbers',
  'bank-account details',
  'card information',
  'passwords',
  'confidential communications with another attorney',
];
