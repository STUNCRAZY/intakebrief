import { describe, expect, it } from 'vitest';
import {
  buildCustomerResponse,
  buildFirmNotification,
  escapeHtml,
  type TemplateInput,
} from './templates';
import { MANDATED_DOCUMENT_INSTRUCTION, PROHIBITED_ITEMS } from '../guidance/prohibited';
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
      practiceFields: { matterType: 'Child custody', hearingDate: '2025-07-01' },
    },
    classification: { primary: 'child-custody', confidence: 'high', topics: ['child-custody'] },
    submittedAt: new Date('2025-06-24T19:30:00Z'),
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});

describe('buildFirmNotification', () => {
  it('uses the required subject format with the primary topic and firm name', () => {
    const msg = buildFirmNotification(makeInput());
    expect(msg.subject).toBe('New child-custody inquiry for Example Law Firm');
    expect(msg.to).toBe('intake@examplelaw.com');
  });

  it('falls back to "general" in the subject when there is no primary topic', () => {
    const msg = buildFirmNotification(
      makeInput({ classification: { primary: null, confidence: 'low', topics: [] } }),
    );
    expect(msg.subject).toBe('New general inquiry for Example Law Firm');
  });

  it('sets replyTo to the inquirer email', () => {
    expect(buildFirmNotification(makeInput()).replyTo).toBe('jane@example.com');
  });

  it('includes every base field and every practice field value in both versions', () => {
    const msg = buildFirmNotification(makeInput());
    for (const value of [
      'Jane Doe',
      'jane@example.com',
      '214-555-0101',
      'email',
      'I need help with a custody hearing.',
      'Child custody',
      '2025-07-01',
    ]) {
      expect(msg.text).toContain(value);
      expect(msg.html).toContain(value);
    }
    // humanized labels for legacy practice-field keys (no longer in the form)
    expect(msg.text).toContain('Hearing Date');
    expect(msg.text).toContain('Matter Type');
  });

  it('renders cleanly when phone and practiceFields are absent (minimal form)', () => {
    const input = makeInput();
    const { phone: _p, practiceFields: _f, ...minimalInquiry } = input.inquiry;
    const msg = buildFirmNotification(makeInput({ inquiry: minimalInquiry }));
    expect(msg.text).toContain('(not provided)');
    expect(msg.html).toContain('(not provided)');
    expect(msg.text).toContain('Jane Doe');
    // customer response must also render without practice fields
    const customer = buildCustomerResponse(makeInput({ inquiry: minimalInquiry }));
    expect(customer.text).toContain('Jane Doe');
    expect(customer.text).not.toMatch(/time-sensitive/i);
  });

  it('includes the submission timestamp in America/Chicago with the timezone named', () => {
    const msg = buildFirmNotification(makeInput());
    // 2025-06-24T19:30:00Z = 2:30 PM Central Daylight Time
    expect(msg.text).toMatch(/2:30\s*PM/);
    expect(msg.text).toMatch(/Central (Daylight|Standard) Time/);
    expect(msg.html).toMatch(/Central (Daylight|Standard) Time/);
  });

  it('includes a prominent non-confidentiality warning', () => {
    const msg = buildFirmNotification(makeInput());
    for (const version of [msg.text, msg.html]) {
      expect(version).toMatch(/does not create an attorney-client relationship/i);
      expect(version).toMatch(/no confidential documents should be sent/i);
    }
  });

  it('HTML-escapes <script> and other markup in user content', () => {
    const msg = buildFirmNotification(
      makeInput({
        inquiry: {
          ...makeInput().inquiry,
          fullName: '<b>Jane</b>',
          message: '<script>alert(1)</script>',
        },
      }),
    );
    expect(msg.html).not.toContain('<script>alert(1)</script>');
    expect(msg.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(msg.html).toContain('&lt;b&gt;Jane&lt;/b&gt;');
    // text version keeps the raw content (no HTML context)
    expect(msg.text).toContain('<script>alert(1)</script>');
  });
});

describe('buildCustomerResponse', () => {
  it('differs meaningfully between child-custody and dwi inquiries', () => {
    const custody = buildCustomerResponse(makeInput());
    const dwi = buildCustomerResponse(
      makeInput({
        firm: makeFirm({ lane: 'criminal', practiceAreas: ['DWI defense'] }),
        classification: { primary: 'dwi', confidence: 'high', topics: ['dwi'] },
      }),
    );
    expect(custody.text).toMatch(/child custody/i);
    expect(custody.text).not.toMatch(/driving privileges/i);
    expect(dwi.text).toMatch(/\bDWI\b/);
    expect(dwi.text).toMatch(/driving privileges/i);
    expect(dwi.text).not.toMatch(/child custody/i);
    expect(custody.text).not.toBe(dwi.text);
  });

  it('acknowledges hearing/court/deadline dates as time-sensitive', () => {
    const msg = buildCustomerResponse(makeInput());
    expect(msg.text).toMatch(/time-sensitive/i);
    const noDate = buildCustomerResponse(
      makeInput({ inquiry: { ...makeInput().inquiry, practiceFields: { matterType: 'Divorce' } } }),
    );
    expect(noDate.text).not.toMatch(/time-sensitive/i);
  });

  it('contains the disclaimer, $50 deposit explanation, preparation items, and mandated sentence', () => {
    const msg = buildCustomerResponse(makeInput());
    for (const version of [msg.text, msg.html]) {
      expect(version).toMatch(/does not create an attorney-client relationship/i);
      expect(version).toMatch(/\$50/);
      expect(version).toMatch(/charged only to reserve the consultation time/i);
      expect(version).toMatch(/per the firm.{0,5}s policies/i);
      expect(version).toMatch(/A typed timeline of events/);
      expect(version).toMatch(/three main questions/i);
      expect(version).toContain(MANDATED_DOCUMENT_INSTRUCTION);
    }
    // summary of prohibited items appears too
    expect(msg.text).toContain(PROHIBITED_ITEMS[0]);
    expect(msg.text).toContain(PROHIBITED_ITEMS[PROHIBITED_ITEMS.length - 1]);
    // family lane preparation extras
    expect(msg.text).toMatch(/children are involved/i);
  });

  it('mentions next steps and consultation times on the intake page', () => {
    const msg = buildCustomerResponse(makeInput());
    expect(msg.text).toMatch(/What happens next/i);
    expect(msg.text).toMatch(/consultation times are presented on the firm.{0,5}s intake page/i);
    expect(msg.text).toMatch(/sent by IntakeBrief on behalf of Example Law Firm/i);
  });

  it('never tells the customer to respond to the email itself', () => {
    const msg = buildCustomerResponse(makeInput());
    for (const version of [msg.text, msg.html]) {
      expect(version).not.toMatch(/reply to this email|simply reply|respond to this email/i);
    }
  });

  it('never gives legal advice or predicts outcomes', () => {
    const msg = buildCustomerResponse(makeInput());
    for (const version of [msg.text, msg.html]) {
      expect(version).not.toMatch(/you will win|guaranteed outcome|we will get you/i);
    }
  });

  it('uses the low-confidence fallback that offers to clarify the matter category', () => {
    const msg = buildCustomerResponse(
      makeInput({ classification: { primary: null, confidence: 'low', topics: [] } }),
    );
    expect(msg.text).toMatch(/did not point clearly to a single matter category/i);
    expect(msg.text).toMatch(/clarify which matter category best fits/i);
  });

  it('HTML-escapes user content in the customer response', () => {
    const msg = buildCustomerResponse(
      makeInput({ inquiry: { ...makeInput().inquiry, fullName: '<img src=x onerror=alert(1)>' } }),
    );
    expect(msg.html).not.toContain('<img src=x');
    expect(msg.html).toContain('&lt;img src=x');
  });

  it('is addressed to the customer', () => {
    expect(buildCustomerResponse(makeInput()).to).toBe('jane@example.com');
  });
});
