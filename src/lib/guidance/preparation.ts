/**
 * Consultation-preparation guidance. Common items apply to every inquiry;
 * per-practice lists are chosen by the firm's lane first, then by the
 * classifier topics, and merged without duplicates.
 *
 * Authoritative module: M2 (email templates + guidance libraries).
 */
import type { FirmLane } from '../firms/types';

const COMMON_ITEMS: readonly string[] = [
  'A typed timeline of events, in order',
  'Important dates related to your matter',
  'Names and roles of the people involved',
  'Any upcoming court, hearing, or response dates',
  'The three main questions you want answered',
  'Your desired outcome',
];

type PracticeKey = 'criminal' | 'family' | 'estate' | 'pi' | 'business';

const PRACTICE_ITEMS: Record<PracticeKey, readonly string[]> = {
  criminal: [
    'The charge or citation, if known',
    'The arrest date',
    'Your bond and custody status',
    'Your next court setting',
  ],
  family: [
    'Whether children are involved',
    'The current living arrangement',
    'Any existing court orders',
    'The next hearing date, if one is set',
    'Your immediate parenting concerns',
  ],
  estate: [
    'A brief family overview',
    'The county where the matter is or would be filed',
    'A general overview of the property involved',
    'Relevant dates, such as a date of death or planning-document dates',
    'Any time-sensitive decisions',
  ],
  pi: [
    'A timeline of the incident',
    'Names of treatment providers',
    'The insurance company name',
    'The claim number, if any',
    'Your current treatment status',
  ],
  business: [
    'The parties involved',
    'A timeline of the transaction or dispute',
    'A summary of key communications',
    'Any upcoming deadline',
    'The result you want',
  ],
};

const LANE_KEYS: Record<FirmLane, PracticeKey[]> = {
  criminal: ['criminal'],
  family: ['family'],
  estate: ['estate'],
  pi: ['pi'],
  business: ['business'],
};

const TOPIC_KEYS: Record<string, PracticeKey> = {
  'criminal-charge': 'criminal',
  arrest: 'criminal',
  bond: 'criminal',
  dwi: 'criminal',
  divorce: 'family',
  separation: 'family',
  'child-custody': 'family',
  visitation: 'family',
  'child-support': 'family',
  probate: 'estate',
  executor: 'estate',
  wills: 'estate',
  trusts: 'estate',
  guardianship: 'estate',
  'personal-injury': 'pi',
  'vehicle-accident': 'pi',
  'medical-treatment': 'pi',
  'insurance-claim': 'pi',
  'business-dispute': 'business',
  'contract-dispute': 'business',
  'real-estate-dispute': 'business',
  'civil-litigation': 'business',
};

/**
 * Preparation checklist for a consultation: common items plus the per-practice
 * lists selected by lane first, then by matched topics. Duplicates removed.
 */
export function getPreparationGuidance(input: { lane: string; topics: string[] }): string[] {
  const keys: PracticeKey[] = [];
  const addKey = (key: PracticeKey | undefined) => {
    if (key && !keys.includes(key)) keys.push(key);
  };

  for (const key of LANE_KEYS[input.lane as FirmLane] ?? []) addKey(key);
  for (const topic of input.topics) addKey(TOPIC_KEYS[topic]);

  const items: string[] = [...COMMON_ITEMS];
  for (const key of keys) {
    for (const item of PRACTICE_ITEMS[key]) {
      if (!items.includes(item)) items.push(item);
    }
  }
  return items;
}
