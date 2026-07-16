/**
 * Per-firm inquiry form field definitions.
 * Seven base fields always render; practice-specific fields are appended based on
 * the firm's lane plus keyword matching against its researched practice areas.
 * A firm may match two groups (e.g. business lane + personal-injury practice area);
 * matching groups are merged and duplicate field names are deduped (first wins).
 */
import type { FirmProfile } from '../firms/types';
import type { FieldDef } from './types';

export const BASE_FIELDS: readonly FieldDef[] = [
  { name: 'fullName', label: 'Full name', type: 'text', required: true },
  { name: 'email', label: 'Email address', type: 'email', required: true },
  { name: 'phone', label: 'Phone number', type: 'tel', required: true },
  {
    name: 'preferredContact',
    label: 'Preferred contact method',
    type: 'select',
    required: true,
    options: ['email', 'phone'],
  },
  {
    name: 'message',
    label: 'Brief description of your matter (please do not include confidential details)',
    type: 'textarea',
    required: true,
  },
  {
    name: 'consentTransactional',
    label: 'I consent to being contacted about my inquiry.',
    type: 'checkbox',
    required: true,
  },
  {
    name: 'acknowledgeNoRelationship',
    label: 'I understand that submitting this form does not create an attorney-client relationship.',
    type: 'checkbox',
    required: true,
  },
] as const;

export type PracticeGroup =
  | 'criminal-dwi'
  | 'family'
  | 'probate-estate'
  | 'personal-injury'
  | 'business-re-civil'
  | 'employment-civil-rights';

const GROUP_FIELDS: Record<PracticeGroup, FieldDef[]> = {
  'criminal-dwi': [
    { name: 'charge', label: 'Charge or citation (if known)', type: 'text', required: false },
    { name: 'arrestDate', label: 'Date of arrest', type: 'date', required: false },
    { name: 'nextCourtDate', label: 'Next court date', type: 'date', required: false },
    {
      name: 'custodyStatus',
      label: 'Current custody status',
      type: 'select',
      required: false,
      options: ['In custody', 'Released on bond', 'Released on own recognizance', 'Not arrested', 'Other'],
    },
    {
      name: 'bondStatus',
      label: 'Bond status',
      type: 'select',
      required: false,
      options: ['Bond set', 'Bond posted', 'Bond denied', 'No bond hearing yet', 'Not applicable'],
    },
  ],
  family: [
    {
      name: 'matterType',
      label: 'Type of family matter',
      type: 'select',
      required: true,
      options: ['Divorce', 'Separation', 'Child custody', 'Child support', 'Visitation', 'Adoption', 'Modification', 'Enforcement', 'Other'],
    },
    {
      name: 'childrenInvolved',
      label: 'Are children involved?',
      type: 'select',
      required: false,
      options: ['Yes', 'No'],
    },
    {
      name: 'existingOrders',
      label: 'Are there existing court orders?',
      type: 'select',
      required: false,
      options: ['Yes', 'No', 'Not sure'],
    },
    { name: 'livingArrangement', label: 'Current living arrangement', type: 'text', required: false },
    { name: 'hearingDate', label: 'Upcoming hearing date (if any)', type: 'date', required: false },
  ],
  'probate-estate': [
    {
      name: 'matterType',
      label: 'Type of estate matter',
      type: 'select',
      required: true,
      options: ['Probate administration', 'Will contest', 'Estate planning', 'Trust administration', 'Guardianship', 'Other'],
    },
    { name: 'county', label: 'County where the matter is filed', type: 'text', required: false },
    { name: 'familySituation', label: 'Family situation (surviving spouse, heirs, etc.)', type: 'text', required: false },
    { name: 'importantDates', label: 'Important dates (date of death, will date, etc.)', type: 'text', required: false },
    {
      name: 'timeSensitivity',
      label: 'How time-sensitive is this?',
      type: 'select',
      required: false,
      options: ['Urgent (days)', 'Soon (weeks)', 'Flexible (months)', 'Planning ahead'],
    },
  ],
  'personal-injury': [
    { name: 'incidentDate', label: 'Date of incident', type: 'date', required: false },
    { name: 'injuryType', label: 'Type of injury', type: 'text', required: false },
    {
      name: 'treatmentStatus',
      label: 'Medical treatment status',
      type: 'select',
      required: false,
      options: ['Currently treating', 'Treatment completed', 'Not yet treated', 'Ongoing care planned'],
    },
    { name: 'insuranceCompany', label: 'Insurance company involved (if any)', type: 'text', required: false },
    {
      name: 'claimStatus',
      label: 'Claim status',
      type: 'select',
      required: false,
      options: ['No claim filed yet', 'Claim filed', 'Claim denied', 'Settlement offered', 'Lawsuit filed'],
    },
  ],
  'business-re-civil': [
    {
      name: 'matterType',
      label: 'Type of matter',
      type: 'select',
      required: true,
      options: ['Contract dispute', 'Business dispute', 'Real estate', 'Civil litigation', 'Formation / transaction', 'Other'],
    },
    { name: 'partiesInvolved', label: 'Parties involved', type: 'text', required: false },
    { name: 'companyOrProperty', label: 'Company or property at issue', type: 'text', required: false },
    { name: 'importantDeadline', label: 'Important deadline (if any)', type: 'date', required: false },
    { name: 'desiredOutcome', label: 'Desired outcome', type: 'textarea', required: false },
  ],
  'employment-civil-rights': [
    { name: 'organization', label: 'Employer or organization involved', type: 'text', required: false },
    { name: 'eventDate', label: 'Date of the event', type: 'date', required: false },
    {
      name: 'concernType',
      label: 'Type of concern',
      type: 'select',
      required: false,
      options: ['Discrimination', 'Harassment', 'Wrongful termination', 'Wage / hour', 'Retaliation', 'Civil rights violation', 'Other'],
    },
    {
      name: 'writtenNotice',
      label: 'Have you given or received written notice?',
      type: 'select',
      required: false,
      options: ['Yes', 'No', 'Not sure'],
    },
    { name: 'filingDeadline', label: 'Filing deadline (if known)', type: 'date', required: false },
  ],
};

const LANE_GROUPS: Record<FirmProfile['lane'], PracticeGroup[]> = {
  criminal: ['criminal-dwi'],
  family: ['family'],
  estate: ['probate-estate'],
  pi: ['personal-injury'],
  business: ['business-re-civil'],
};

/** Keyword rules mapping researched practice-area text to additional field groups. */
const PRACTICE_AREA_RULES: ReadonlyArray<readonly [RegExp, PracticeGroup]> = [
  [/\b(dwi|dui|criminal|felony|misdemeanor|defen[cs]e)\b/i, 'criminal-dwi'],
  [/\b(family|divorce|custody|child support|adoption)\b/i, 'family'],
  [/\b(probate|estate|wills?|trusts?|guardianship)\b/i, 'probate-estate'],
  [/\b(personal injury|injur\w*|accident|malpractice|wrongful death)\b/i, 'personal-injury'],
  [/\b(business|commercial|corporate|contract|real estate|construction|civil litigation|eminent domain|landlord)\b/i, 'business-re-civil'],
  [/\b(employment|labor|discrimination|civil rights|non-compete|severance)\b/i, 'employment-civil-rights'],
];

/** Groups that apply to a firm: its lane mapping plus practice-area keyword matches. */
export function getPracticeGroups(firm: FirmProfile): PracticeGroup[] {
  const groups = new Set<PracticeGroup>(LANE_GROUPS[firm.lane]);
  for (const area of firm.practiceAreas) {
    for (const [pattern, group] of PRACTICE_AREA_RULES) {
      if (pattern.test(area)) groups.add(group);
    }
  }
  return [...groups];
}

/** Base fields + merged, deduped practice-specific fields for this firm. */
export function getFieldsForFirm(firm: FirmProfile): FieldDef[] {
  const fields: FieldDef[] = [...BASE_FIELDS];
  const seen = new Set(fields.map((f) => f.name));
  for (const group of getPracticeGroups(firm)) {
    for (const field of GROUP_FIELDS[group]) {
      if (!seen.has(field.name)) {
        fields.push(field);
        seen.add(field.name);
      }
    }
  }
  return fields;
}
