/**
 * Domain types for the IntakeBrief firm-research pipeline.
 * FirmProfile mirrors research/firms/*.json exactly — do not diverge.
 */

export type FirmLane = 'family' | 'criminal' | 'estate' | 'pi' | 'business';

export interface FirmLocation {
  address: string;
  city: string;
  county: string;
  state: string;
  zip: string;
}

export interface FirmAttorney {
  name: string;
  role: string | null;
  yearBeganPractice: number | null;
}

export interface FirmNotableCase {
  name: string;
  outcome: string;
  sourceUrl: string;
}

export type WebsiteQualityClassification = 'Strong' | 'Adequate' | 'Subpar';

export interface WebsiteQuality {
  classification: WebsiteQualityClassification;
  rationale: string;
  /** Eleven named audit factors (mobileUsability, pageSpeed, ...), each a free-text finding. */
  factors: Record<string, string>;
}

export interface FirmSource {
  url: string;
  supports: string;
}

export interface FirmProfile {
  id: string;
  name: string;
  lane: FirmLane;
  location: FirmLocation;
  email: string | null;
  phone: string;
  attorneys: FirmAttorney[];
  practiceAreas: string[];
  yearEstablished: number | null;
  notableCases: FirmNotableCase[];
  website: string;
  websiteQuality: WebsiteQuality;
  sources: FirmSource[];
  unverified: string[];
  notes: string;
  researchedAt: string;
}

/** Generated website-concept + outreach content for one firm (content/firms/*.json). */
export interface FirmContent {
  firmId: string;
  identitySentence: string;
  concept: {
    headline: string;
    subheadline: string;
    credibilityPoints: string[];
    accentColor: string;
    ctaText: string;
    sections: { title: string; body: string }[];
    redesigns?: { title: string; body: string }[];
  };
  outreachDraft: {
    subject: string;
    body: string;
  };
}

export type PipelineStage =
  | 'research-complete'
  | 'ready-for-review'
  | 'approved'
  | 'contacted'
  | 'replied'
  | 'demo-scheduled'
  | 'closed';

/** Ordered pipeline stages; index = progression. */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'research-complete',
  'ready-for-review',
  'approved',
  'contacted',
  'replied',
  'demo-scheduled',
  'closed',
] as const;
