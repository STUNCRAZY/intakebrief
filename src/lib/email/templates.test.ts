import { beforeEach, describe, expect, it, vi } from 'vitest';

const ai = vi.hoisted(() => ({ generateLocalEmailDraft: vi.fn() }));
vi.mock('../ai/local', () => ai);

import { buildCustomerResponse, buildFirmNotification, escapeHtml, type TemplateInput } from './templates';
import type { FirmProfile } from '../firms/types';

function makeFirm(overrides: Partial<FirmProfile> = {}): FirmProfile {
  return {
    id: 'firm-1',
    name: 'Example Law Firm',
    lane: 'family',
    location: { address: '1 Main St', city: 'Dallas', county: 'Dallas', state: 'TX', zip: '75201' },
    email: 'intake@examplelaw.com',
    phone: '214-555-0100',
    attorneys: [],
    practiceAreas: ['Family law', 'Divorce', 'Child custody'],
    yearEstablished: 2001,
    notableCases: [],
    website: 'https://examplelaw.com',
    websiteQuality: { classification: 'Adequate', rationale: 'r', factors: {} },
    sources: [],
    unverified: [],
    notes: '',
    researchedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeInput(overrides: Partial<TemplateInput> = {}): TemplateInput {
  return {
    firm: makeFirm(),
    inquiry: {
      firmId: 'firm-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '214-555-0101',
      preferredContact: 'email',
      message: 'I need help with a custody hearing.',
      consentTransactional: true,
      acknowledgeNoRelationship: true,
      idempotencyKey: 'key-1',
    },
    classification: { primary: 'child-custody', confidence: 'high', topics: ['child-custody'] },
    submittedAt: new Date('2025-06-24T19:30:00Z'),
    availability: {
      status: 'ok',
      timezone: 'America/Chicago',
      slots: [
        { startISO: '2026-07-20T15:00:00.000Z', endISO: '2026-07-20T16:00:00.000Z' },
        { startISO: '2026-07-21T19:00:00.000Z', endISO: '2026-07-21T20:00:00.000Z' },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  ai.generateLocalEmailDraft.mockResolvedValue({
    topic: 'custody hearing',
    summary: 'your upcoming custody hearing and the concerns you described',
    preparation: ['Any existing court order', 'The upcoming hearing notice', 'Your questions about parenting time'],
    source: 'local-ai',
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });
});

describe('buildFirmNotification', () => {
  it('keeps the firm notification routing and full form details intact', () => {
    const msg = buildFirmNotification(makeInput());
    expect(msg.subject).toBe('New child-custody inquiry for Example Law Firm');
    expect(msg.replyTo).toBe('jane@example.com');
    expect(msg.text).toContain('I need help with a custody hearing.');
  });
});

describe('buildCustomerResponse', () => {
  it('uses the local model draft inside the fixed booking template', async () => {
    const msg = await buildCustomerResponse(makeInput());
    expect(ai.generateLocalEmailDraft).toHaveBeenCalledWith({
      inquiry: expect.objectContaining({ message: 'I need help with a custody hearing.' }),
      fallbackTopic: 'child-custody',
    });
    expect(msg.subject).toBe('Example Law Firm - custody hearing - Book a consultation');
    expect(msg.text).toContain('Hi Jane,');
    expect(msg.text).toContain('your upcoming custody hearing and the concerns you described');
    expect(msg.text).toContain('- Any existing court order');
  });

  it('lists real supplied openings and gives the booking link', async () => {
    const msg = await buildCustomerResponse(makeInput());
    expect(msg.text).toMatch(/Monday, July 20.*10:00 AM CDT/);
    expect(msg.text).toMatch(/Tuesday, July 21.*2:00 PM CDT/);
    expect(msg.text).toContain('http://localhost:3000/capture/firm-1');
  });

  it('states the exact deposit, reply, and no-document policy outside model control', async () => {
    const msg = await buildCustomerResponse(makeInput());
    for (const version of [msg.text, msg.html]) {
      expect(version).toContain('$50 deposit');
      expect(version).toMatch(/non-refundable/i);
      expect(version).toMatch(/please respond at your earliest convenience/i);
      expect(version).toMatch(/does not establish a lawyer-client relationship/i);
      expect(version).toMatch(/Do not respond to this email with any documentation/i);
      expect(version).toMatch(/forfeiture of the \$50 deposit/i);
    }
  });

  it('is explicit when no real slots can be shared', async () => {
    const msg = await buildCustomerResponse(makeInput({ availability: { status: 'blocked' } }));
    expect(msg.text).toContain('Open consultation times are not available to share in this email right now.');
    expect(msg.text).not.toMatch(/Monday, July 20/);
  });

  it('marks sample availability as demo availability instead of passing it off as real', async () => {
    const input = makeInput();
    const msg = await buildCustomerResponse({
      ...input,
      availability: { ...input.availability!, demo: true },
    });
    expect(msg.text).toContain('Demo availability — sample times; calendar not connected');
  });

  it('escapes generated model text before placing it in HTML', async () => {
    ai.generateLocalEmailDraft.mockResolvedValueOnce({
      topic: '<b>custody</b>',
      summary: '<script>alert(1)</script>',
      preparation: ['<img src=x onerror=alert(1)>', 'An existing order'],
      source: 'local-ai',
    });
    const msg = await buildCustomerResponse(makeInput());
    expect(msg.html).not.toContain('<script>alert(1)</script>');
    expect(msg.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(msg.html).not.toContain('<img src=x');
  });
});
