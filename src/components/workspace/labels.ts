/**
 * Shared display labels for the research workspace (dashboard + firm profile).
 * Pure constants — safe to import from both server and client components.
 */
import type { FirmLane, WebsiteQualityClassification } from '@/lib/firms/types';

export const LANE_LABEL: Record<FirmLane, string> = {
  family: 'Family',
  criminal: 'Criminal',
  estate: 'Estate / Probate',
  pi: 'Personal Injury',
  business: 'Business / Civil',
};

export const LANE_ORDER: readonly FirmLane[] = ['family', 'criminal', 'estate', 'pi', 'business'];

export const QUALITY_ORDER: readonly WebsiteQualityClassification[] = ['Strong', 'Adequate', 'Subpar'];

/** Human labels for the eleven website-quality audit factor keys. */
export const FACTOR_LABELS: Record<string, string> = {
  mobileUsability: 'Mobile usability',
  pageSpeed: 'Page speed',
  accessibility: 'Accessibility',
  visualCredibility: 'Visual credibility',
  navigation: 'Navigation',
  contentClarity: 'Content clarity',
  callsToAction: 'Calls to action',
  contactFormQuality: 'Contact form quality',
  localPositioning: 'Local positioning',
  trustSignals: 'Trust signals',
  appointmentBooking: 'Appointment booking',
};
