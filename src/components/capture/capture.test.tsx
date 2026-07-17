/**
 * Capture-page contract test: renders the server page with a fixture firm and
 * fixture concept content, then asserts the public-form guarantees —
 * identity sentence above the form, verbatim document instruction, labeled
 * fields, no file inputs, required consent/acknowledgment, aria-live status.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getFieldsForFirm } from '@/lib/inquiry/fields';
import { MANDATED_DOCUMENT_INSTRUCTION } from '@/lib/guidance/prohibited';
import type { FirmContent, FirmProfile } from '@/lib/firms/types';
import CapturePage from '@/app/capture/[id]/page';

const { fixtureFirm, fixtureContent } = vi.hoisted(() => {
  const fixtureFirm: FirmProfile = {
    id: 'fixture-firm',
    name: 'Fixture & Vise LLP',
    lane: 'family',
    location: { address: '1 Docket Sq', city: 'Denton', county: 'Denton', state: 'TX', zip: '76201' },
    email: 'hello@fixture-vise.example',
    phone: '(940) 555-0100',
    attorneys: [{ name: 'Ada Fixture', role: 'Attorney', yearBeganPractice: 2001 }],
    practiceAreas: ['Family Law', 'Divorce'],
    yearEstablished: 2005,
    notableCases: [],
    website: 'https://fixture-vise.example/',
    websiteQuality: { classification: 'Subpar', rationale: 'fixture', factors: {} },
    sources: [],
    unverified: [],
    notes: '',
    researchedAt: '2026-01-01',
  };
  const fixtureContent: FirmContent = {
    firmId: 'fixture-firm',
    identitySentence:
      'Fixture & Vise LLP is a boutique Denton family-law firm where attorney Ada Fixture has guided North Texas clients since 2001.',
    concept: {
      headline: 'Family law counsel with two decades at the Denton County courthouse',
      subheadline: 'Divorce, custody, and support handled directly by your attorney.',
      credibilityPoints: ['Practicing since 2001', 'Denton fixture since 2005'],
      accentColor: '#7A1E2B',
      ctaText: 'Request a consultation',
      sections: [{ title: 'Practice focus', body: 'Family law, exclusively.' }],
    },
    outreachDraft: { subject: 's', body: 'b' },
  };
  return { fixtureFirm, fixtureContent };
});

vi.mock('@/lib/firms/load', () => ({
  getAllFirms: () => [fixtureFirm],
  getFirm: (id: string) => (id === fixtureFirm.id ? fixtureFirm : null),
  getFirmContent: (id: string) => (id === fixtureFirm.id ? fixtureContent : null),
  docketNumber: () => 'No. 2026-001',
}));

vi.mock('@/lib/guidance/preparation', () => ({
  getPreparationGuidance: () => ['Write down the key dates.', 'Note the outcome you want.'],
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

describe('capture page', () => {
  it('renders identity sentence above an accessible, safe inquiry form', async () => {
    const element = await CapturePage({ params: Promise.resolve({ id: fixtureFirm.id }) });
    const html = renderToStaticMarkup(element);

    // Identity sentence present, rendered before the form element.
    // (Static markup HTML-escapes "&" in the firm name, so unescape for comparison.)
    const identityIndex = html.replace(/&amp;/g, '&').indexOf(fixtureContent.identitySentence);
    const formIndex = html.indexOf('<form');
    expect(identityIndex).toBeGreaterThanOrEqual(0);
    expect(formIndex).toBeGreaterThanOrEqual(0);
    expect(identityIndex).toBeLessThan(formIndex);

    // Mandated document instruction present verbatim.
    expect(html).toContain(MANDATED_DOCUMENT_INSTRUCTION);

    // Every fixture field renders with a programmatically associated label.
    const fields = getFieldsForFirm(fixtureFirm);
    for (const field of fields) {
      expect(html).toContain(`for="field-${field.name}"`);
      expect(html).toContain(`id="field-${field.name}"`);
    }

    // No file/upload control anywhere.
    expect(html).not.toContain('type="file"');

    // Consent + no-attorney-client-relationship checkboxes present.
    expect(html).toContain('I consent to receive transactional responses about my inquiry');
    expect(html).toContain('submitting this form does not create an attorney-client relationship');

    // aria-live status region present.
    expect(html).toContain('aria-live="polite"');
  });

  it('renders the MINIMAL form: exactly 4 non-checkbox fields, email the only email input', async () => {
    const element = await CapturePage({ params: Promise.resolve({ id: fixtureFirm.id }) });
    const html = renderToStaticMarkup(element);

    const inputCount = (html.match(/<input/g) ?? []).length;
    const checkboxCount = (html.match(/type="checkbox"/g) ?? []).length;
    const textareaCount = (html.match(/<textarea/g) ?? []).length;
    const selectCount = (html.match(/<select/g) ?? []).length;
    const honeypotCount = (html.match(/id="field-hp_company"/g) ?? []).length;

    // fullName, email, phone, message — nothing else.
    const nonCheckboxFields = inputCount - honeypotCount - checkboxCount + textareaCount + selectCount;
    expect(nonCheckboxFields).toBe(4);
    expect(checkboxCount).toBe(2); // consent + acknowledgment only
    expect(selectCount).toBe(0); // no preferredContact select, no practice selects
    expect(honeypotCount).toBe(1); // honeypot untouched

    // email is the only email-type input on the page.
    expect((html.match(/type="email"/g) ?? []).length).toBe(1);

    // phone renders but is optional (no required marker on it).
    expect(html).toContain('id="field-phone"');
    expect(html).toContain('Phone (optional)');
  });

  it('shows the "watch what happens next" video slot and a compact prohibited-items block', async () => {
    const element = await CapturePage({ params: Promise.resolve({ id: fixtureFirm.id }) });
    const html = renderToStaticMarkup(element);

    // Accessible video block directly above the form.
    const videoIndex = html.indexOf('<video');
    const formIndex = html.indexOf('<form');
    expect(videoIndex).toBeGreaterThanOrEqual(0);
    expect(videoIndex).toBeLessThan(formIndex);
    expect(html).toContain('<figure');
    expect(html).toContain('src="/how-it-works.mp4"');
    expect(html).toContain('poster="/how-it-works-poster.jpg"');
    expect(html).toContain('<track');
    expect(html).toContain('src="/how-it-works-captions.vtt"');
    expect(html).toContain('<figcaption');
    expect(html).toContain('90-second preview: what happens after you send this');

    // Mandated sentence fully visible; prohibited list collapsed in <details>.
    expect(html).toContain(MANDATED_DOCUMENT_INSTRUCTION);
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('See the full list of what not to send');
  });
});
