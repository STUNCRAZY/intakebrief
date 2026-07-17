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

const MINIMAL_FIELD_NAMES = [
  'fullName',
  'email',
  'phone',
  'message',
  'consentTransactional',
  'acknowledgeNoRelationship',
];

describe('getFieldsForFirm (minimal contact form)', () => {
  it('returns exactly the 6-field minimal set — 4 non-checkbox fields', () => {
    const fields = getFieldsForFirm(makeFirm('family'));
    expect(fields.map((f) => f.name)).toEqual(MINIMAL_FIELD_NAMES);
    const nonCheckbox = fields.filter((f) => f.type !== 'checkbox');
    expect(nonCheckbox).toHaveLength(4);
  });

  it('email is the only email-type input', () => {
    const fields = getFieldsForFirm(makeFirm('criminal'));
    const emailType = fields.filter((f) => f.type === 'email');
    expect(emailType).toHaveLength(1);
    expect(emailType[0].name).toBe('email');
    expect(emailType[0].label).toBe('Email address');
    expect(emailType[0].required).toBe(true);
  });

  it('phone is optional and there is no preferredContact select', () => {
    const fields = getFieldsForFirm(makeFirm('pi'));
    const phone = fields.find((f) => f.name === 'phone');
    expect(phone).toBeDefined();
    expect(phone!.required).toBe(false);
    expect(phone!.label).toBe('Phone (optional)');
    expect(fields.some((f) => f.name === 'preferredContact')).toBe(false);
    expect(fields.some((f) => f.type === 'select')).toBe(false);
  });

  it('message asks for a short, non-confidential summary', () => {
    const message = getFieldsForFirm(makeFirm('estate')).find((f) => f.name === 'message');
    expect(message).toBeDefined();
    expect(message!.type).toBe('textarea');
    expect(message!.required).toBe(true);
    expect(message!.label).toBe(
      "What can we help you with? A sentence or two is plenty — please don't include confidential details.",
    );
  });

  it('is identical for every firm, regardless of lane or practice areas', () => {
    const lanes: FirmLane[] = ['family', 'criminal', 'estate', 'pi', 'business'];
    const reference = getFieldsForFirm(makeFirm('family'));
    for (const lane of lanes) {
      expect(getFieldsForFirm(makeFirm(lane, ['DWI', 'Probate', 'Personal Injury']))).toEqual(reference);
    }
  });

  it('both consent checkboxes are required', () => {
    const fields = getFieldsForFirm(makeFirm('business'));
    for (const name of ['consentTransactional', 'acknowledgeNoRelationship']) {
      const field = fields.find((f) => f.name === name);
      expect(field).toBeDefined();
      expect(field!.type).toBe('checkbox');
      expect(field!.required).toBe(true);
    }
  });
});
