/** @jsxRuntime automatic */
/**
 * Workspace UI smoke tests — server-render the dashboard browser and the
 * profile sections with fixtures and assert the accessibility-critical and
 * content-critical markup is present.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FirmProfile } from '@/lib/firms/types';
import { ContactFormSection } from './ContactFormSection';
import { ResearchRecord } from './ResearchRecord';
import { WorkspaceBrowser, type WorkspaceFirm } from './WorkspaceBrowser';

function makeFirm(overrides: Partial<FirmProfile> = {}): FirmProfile {
  return {
    id: 'alpha-family-law',
    name: 'Alpha Family Law',
    lane: 'family',
    location: { address: '100 Main St', city: 'Denton', county: 'Denton', state: 'TX', zip: '76201' },
    email: '',
    phone: '940-555-0100',
    attorneys: [{ name: 'Ada Alpha', role: 'Partner', yearBeganPractice: null }],
    practiceAreas: ['Divorce', 'Child Custody'],
    yearEstablished: null,
    notableCases: [],
    website: 'https://alpha.example.com/',
    websiteQuality: {
      classification: 'Subpar',
      rationale: 'Outdated site with no intake form.',
      factors: { mobileUsability: 'Not responsive.', pageSpeed: 'Not measured.' },
    },
    sources: [{ url: 'https://alpha.example.com/', supports: 'Firm name and address' }],
    unverified: [],
    notes: '',
    researchedAt: '2026-07-01',
    ...overrides,
  };
}

function makeCard(firm: FirmProfile, docket: string): WorkspaceFirm {
  return {
    id: firm.id,
    docket,
    name: firm.name,
    city: firm.location.city,
    state: firm.location.state,
    lane: firm.lane,
    quality: firm.websiteQuality.classification,
    phone: firm.phone,
    practiceAreas: firm.practiceAreas,
  };
}

describe('WorkspaceBrowser', () => {
  it('renders a labeled search input and every firm name', () => {
    const alpha = makeFirm();
    const beta = makeFirm({
      id: 'beta-criminal-defense',
      name: 'Beta Criminal Defense',
      lane: 'criminal',
      websiteQuality: {
        classification: 'Strong',
        rationale: 'Modern site.',
        factors: { mobileUsability: 'Responsive.' },
      },
    });
    const html = renderToStaticMarkup(
      <WorkspaceBrowser firms={[makeCard(alpha, 'No. 2026-001'), makeCard(beta, 'No. 2026-002')]} />,
    );

    expect(html).toContain('for="workspace-search"');
    expect(html).toContain('id="workspace-search"');
    expect(html).toContain('Alpha Family Law');
    expect(html).toContain('Beta Criminal Defense');
  });
});

describe('profile sections', () => {
  it('renders the identity sentence verbatim in the contact form section', () => {
    const firm = makeFirm();
    const identity = 'Alpha Family Law has served Denton families since 2001 with steady counsel.';
    const html = renderToStaticMarkup(<ContactFormSection firm={firm} identitySentence={identity} />);
    expect(html).toContain(identity);
    expect(html).toContain('/capture/alpha-family-law');
  });

  it('shows the Not publicly verified section when unverified items exist', () => {
    const firm = makeFirm({ unverified: ['General firm email address', 'Fax number'] });
    const html = renderToStaticMarkup(<ResearchRecord firm={firm} />);
    expect(html).toContain('Not publicly verified');
    expect(html).toContain('General firm email address');
  });
});
