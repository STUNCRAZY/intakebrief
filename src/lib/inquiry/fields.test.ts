import { describe, expect, it } from 'vitest';
import type { FirmLane, FirmProfile } from '../firms/types';
import { getFieldsForFirm } from './fields';

function makeFirm(lane: FirmLane, practiceAreas: string[] = []): FirmProfile {
  return {
    id: `test-${lane}`,
    name: `Test ${lane} Firm`,
    lane,
    location: { address: '1 Main St', city: 'Denton', county: 'Denton', state: 'TX', zip: '76201' },
    email: 'test@example.com',
    phone: '940-000-0000',
    attorneys: [],
    practiceAreas,
    yearEstablished: null,
    notableCases: [],
    website: 'https://example.com',
    websiteQuality: { classification: 'Adequate', rationale: '', factors: {} },
    sources: [],
    unverified: [],
    notes: '',
    researchedAt: '2026-07-16',
  };
}

const BASE_FIELD_NAMES = [
  'fullName',
  'email',
  'phone',
  'preferredContact',
  'message',
  'consentTransactional',
  'acknowledgeNoRelationship',
];

describe('getFieldsForFirm', () => {
  it('a criminal firm gets the criminal/DWI fields incl. arrestDate', () => {
    const names = getFieldsForFirm(makeFirm('criminal')).map((f) => f.name);
    for (const expected of ['charge', 'arrestDate', 'nextCourtDate', 'custodyStatus', 'bondStatus']) {
      expect(names).toContain(expected);
    }
  });

  it('a family firm gets the family fields incl. childrenInvolved', () => {
    const names = getFieldsForFirm(makeFirm('family')).map((f) => f.name);
    for (const expected of ['matterType', 'childrenInvolved', 'existingOrders', 'livingArrangement', 'hearingDate']) {
      expect(names).toContain(expected);
    }
  });

  it('base fields are always present, for every lane', () => {
    const lanes: FirmLane[] = ['family', 'criminal', 'estate', 'pi', 'business'];
    for (const lane of lanes) {
      const names = getFieldsForFirm(makeFirm(lane)).map((f) => f.name);
      for (const base of BASE_FIELD_NAMES) {
        expect(names).toContain(base);
      }
    }
  });

  it('practice areas can pull in a second group, merged and deduped', () => {
    const names = getFieldsForFirm(makeFirm('pi', ['Personal Injury', 'Criminal Defense'])).map((f) => f.name);
    expect(names).toContain('incidentDate'); // personal-injury group (lane)
    expect(names).toContain('arrestDate'); // criminal-dwi group (practice area)

    const familyEstate = getFieldsForFirm(makeFirm('family', ['Divorce', 'Wills & Probate'])).map((f) => f.name);
    expect(familyEstate).toContain('childrenInvolved'); // family group
    expect(familyEstate).toContain('county'); // probate-estate group
    // matterType exists in both groups — must appear exactly once.
    expect(familyEstate.filter((n) => n === 'matterType')).toHaveLength(1);
  });
});
