import { describe, expect, it } from 'vitest';
import { docketNumber, getAllFirmContent, getAllFirms, getFirm, getFirmContent } from './load';

describe('firm loaders', () => {
  it('loads exactly 25 researched firm profiles', () => {
    expect(getAllFirms()).toHaveLength(25);
  });

  it('every firm carries the required profile fields', () => {
    for (const firm of getAllFirms()) {
      expect(firm.id).toBeTruthy();
      expect(firm.name).toBeTruthy();
      expect(['family', 'criminal', 'estate', 'pi', 'business']).toContain(firm.lane);
      expect(firm.location.city).toBeTruthy();
      expect(firm.location.state).toBeTruthy();
      expect(firm.phone).toBeTruthy();
      expect(Array.isArray(firm.attorneys)).toBe(true);
      expect(Array.isArray(firm.practiceAreas)).toBe(true);
      expect(firm.practiceAreas.length).toBeGreaterThan(0);
      expect(['Strong', 'Adequate', 'Subpar']).toContain(firm.websiteQuality.classification);
      expect(firm.websiteQuality.rationale).toBeTruthy();
      expect(Array.isArray(firm.sources)).toBe(true);
      expect(Array.isArray(firm.unverified)).toBe(true);
    }
  });

  it('firm ids are unique', () => {
    const ids = getAllFirms().map((firm) => firm.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getFirm round-trips a known id and returns null for an unknown id', () => {
    const first = getAllFirms()[0];
    expect(getFirm(first.id)?.name).toBe(first.name);
    expect(getFirm('no-such-firm')).toBeNull();
  });

  it('content loaders return generated content and tolerate unknown ids', () => {
    const first = getAllFirms()[0];
    expect(getFirmContent(first.id)?.firmId).toBe(first.id);
    expect(getAllFirmContent()).toHaveLength(25);
    expect(getFirmContent('no-such-firm')).toBeNull();
  });

  it('identity sentences are unique, single-sentence, and name their firm', () => {
    const seen = new Set<string>();
    const firms = getAllFirms();
    expect(firms).toHaveLength(25);
    for (const firm of firms) {
      const content = getFirmContent(firm.id);
      expect(content, `content for ${firm.id}`).toBeTruthy();
      const sentence = content!.identitySentence.trim();
      expect(sentence.endsWith('.')).toBe(true);
      const withoutTerminal = sentence.slice(0, -1);
      expect(/[;!?]/.test(sentence)).toBe(false);
      expect(/\.\s+[A-Z]/.test(withoutTerminal)).toBe(false);
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');
      const nameTokens = norm(firm.name)
        .split(' ')
        .filter((t) => t.length > 2 && !['law', 'firm', 'the', 'and', 'pc', 'pllc', 'llc', 'llp', 'office', 'offices', 'attorney', 'attorneys', 'injury', 'group'].includes(t));
      expect(nameTokens.some((t) => norm(sentence).includes(t)), `sentence names ${firm.name}`).toBe(true);
      const key = norm(sentence);
      expect(seen.has(key), `duplicate identity sentence for ${firm.id}`).toBe(false);
      seen.add(key);
    }
  });

  it('every firm profile carries at least one http(s) source URL', () => {
    for (const firm of getAllFirms()) {
      expect(firm.sources.length, `sources for ${firm.id}`).toBeGreaterThan(0);
      for (const source of firm.sources) {
        expect(source.url).toMatch(/^https?:\/\//);
      }
    }
  });

  it('docket numbers follow the No. 2026-NNN convention from the stable index', () => {
    expect(docketNumber(0)).toBe('No. 2026-001');
    expect(docketNumber(16)).toBe('No. 2026-017');
    expect(docketNumber(24)).toBe('No. 2026-025');
  });
});
