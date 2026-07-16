/**
 * Deterministic matter classification.
 * Pure keyword/phrase scoring against a fixed topic list — no AI, no network,
 * fully inspectable. Multi-word phrases score higher than single words, and a
 * small boost applies when a topic is echoed by the firm's practice areas or
 * the rendered practice fields. Anything without a strong match is honestly
 * reported as low confidence with primary = null.
 */
import type { FieldDef } from '../inquiry/types';

export const TOPICS = [
  'divorce',
  'separation',
  'child-custody',
  'visitation',
  'child-support',
  'criminal-charge',
  'arrest',
  'bond',
  'dwi',
  'probate',
  'executor',
  'wills',
  'trusts',
  'guardianship',
  'personal-injury',
  'vehicle-accident',
  'medical-treatment',
  'insurance-claim',
  'business-dispute',
  'contract-dispute',
  'real-estate-dispute',
  'civil-litigation',
  'employment-dispute',
  'discrimination',
  'civil-rights',
] as const;

export type Topic = (typeof TOPICS)[number];

export type ClassificationConfidence = 'high' | 'medium' | 'low';

export interface ClassificationResult {
  primary: Topic | null;
  confidence: ClassificationConfidence;
  /** Every topic with a positive score, highest first. */
  topics: Topic[];
}

export interface ClassifyInput {
  message: string;
  practiceFields?: FieldDef[];
  firmPracticeAreas?: string[];
}

/** Keywords/phrases per topic. Multi-word phrases count double. */
const KEYWORDS: Record<Topic, readonly string[]> = {
  divorce: ['divorce', 'dissolution of marriage', 'end my marriage'],
  separation: ['legal separation', 'separated', 'separating', 'separation'],
  'child-custody': ['child custody', 'custody hearing', 'custody order', 'custody', 'conservatorship', 'possession schedule'],
  visitation: ['visitation', 'parenting time'],
  'child-support': ['child support', 'support order', 'support payments'],
  'criminal-charge': ['criminal charge', 'charged with', 'criminal case', 'felony', 'misdemeanor', 'indictment'],
  arrest: ['arrested', 'arrest', 'taken into custody', 'booked into'],
  bond: ['bond hearing', 'bond', 'bail'],
  dwi: ['dwi', 'dui', 'driving while intoxicated', 'drunk driving', 'breathalyzer'],
  probate: ['probate', 'probate court', 'estate administration'],
  executor: ['executor', 'executrix', 'personal representative', 'administrator of the estate'],
  wills: ['last will', 'will', 'testament', 'codicil'],
  trusts: ['living trust', 'revocable trust', 'trust', 'trustee'],
  guardianship: ['guardianship', 'guardian'],
  'personal-injury': ['personal injury', 'injured', 'injury', 'slip and fall', 'negligence'],
  'vehicle-accident': ['car accident', 'car crash', 'vehicle accident', 'truck accident', 'motorcycle accident', 'rear-ended', 'collision', 'hit by a'],
  'medical-treatment': ['medical treatment', 'medical bills', 'hospital', 'surgery', 'physical therapy'],
  'insurance-claim': ['insurance claim', 'insurance company', 'adjuster', 'claim denied', 'settlement offer'],
  'business-dispute': ['business dispute', 'partnership dispute', 'business partner', 'breach of fiduciary'],
  'contract-dispute': ['breach of contract', 'contract dispute', 'contract'],
  'real-estate-dispute': ['real estate dispute', 'property line', 'boundary dispute', 'easement', 'title dispute', 'land dispute'],
  'civil-litigation': ['civil litigation', 'lawsuit', 'sue', 'sued', 'civil case'],
  'employment-dispute': ['wrongful termination', 'employment dispute', 'fired', 'terminated', 'unpaid wages', 'overtime'],
  discrimination: ['discrimination', 'discriminated', 'hostile work environment'],
  'civil-rights': ['civil rights', 'constitutional rights', 'police misconduct', 'excessive force'],
};

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

export function classifyMatter(input: ClassifyInput): ClassificationResult {
  const message = input.message.toLowerCase();
  const practiceAreaText = (input.firmPracticeAreas ?? []).join(' ').toLowerCase();
  const practiceFieldText = (input.practiceFields ?? [])
    .map((f) => `${f.name} ${f.label}`)
    .join(' ')
    .toLowerCase();

  const scores = new Map<Topic, number>();
  for (const topic of TOPICS) {
    let score = 0;
    for (const keyword of KEYWORDS[topic]) {
      const occurrences = countOccurrences(message, keyword);
      if (occurrences > 0) {
        score += occurrences * (keyword.includes(' ') ? 2 : 1);
      }
      // +1 context boost when the firm's own profile echoes this topic.
      if (practiceAreaText.includes(keyword) || practiceFieldText.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) scores.set(topic, score);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const topics = ranked.map(([topic]) => topic);
  const top = ranked[0];
  const second = ranked[1];

  if (!top) {
    return { primary: null, confidence: 'low', topics: [] };
  }

  const [topTopic, topScore] = top;
  const margin = topScore - (second?.[1] ?? 0);
  let confidence: ClassificationConfidence;
  if (topScore >= 4 || (topScore >= 3 && margin >= 2)) {
    confidence = 'high';
  } else if (topScore >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    primary: confidence === 'low' ? null : topTopic,
    confidence,
    topics,
  };
}
