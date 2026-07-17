/**
 * Inquiry form field definitions.
 * The public form is deliberately MINIMAL — the same short field set renders
 * for every firm: name, email, optional phone, a short message, and the two
 * required consent checkboxes. Practice-specific fields were removed after
 * user feedback that the merged form was far too long; classification works
 * from the message text alone (see src/lib/classify).
 */
import type { FirmProfile } from '../firms/types';
import type { FieldDef } from './types';

export const BASE_FIELDS: readonly FieldDef[] = [
  { name: 'fullName', label: 'Full name', type: 'text', required: true },
  { name: 'email', label: 'Email address', type: 'email', required: true },
  { name: 'phone', label: 'Phone (optional)', type: 'tel', required: false },
  {
    name: 'message',
    label:
      "What can we help you with? A sentence or two is plenty — please don't include confidential details.",
    type: 'textarea',
    required: true,
  },
  {
    name: 'consentTransactional',
    label:
      'I consent to receive transactional responses about my inquiry (for example, email or phone replies from the firm).',
    type: 'checkbox',
    required: true,
  },
  {
    name: 'acknowledgeNoRelationship',
    label: 'I acknowledge that submitting this form does not create an attorney-client relationship.',
    type: 'checkbox',
    required: true,
  },
] as const;

/**
 * @deprecated Practice-specific field groups were removed from the form path.
 * The type stays exported for back-compat with any external references.
 */
export type PracticeGroup =
  | 'criminal-dwi'
  | 'family'
  | 'probate-estate'
  | 'personal-injury'
  | 'business-re-civil'
  | 'employment-civil-rights';

/** The minimal contact form — identical for every firm. */
export function getFieldsForFirm(_firm: FirmProfile): FieldDef[] {
  return [...BASE_FIELDS];
}
