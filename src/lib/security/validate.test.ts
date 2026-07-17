import { describe, expect, it } from 'vitest';
import { validateInquiry } from './validate';

const valid = {
  firmId: 'biles-law',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-123-4567',
  preferredContact: 'email',
  message: 'I was arrested on a DWI charge and need help with a bond hearing.',
  consentTransactional: true,
  acknowledgeNoRelationship: true,
  idempotencyKey: 'key-1',
};

describe('validateInquiry', () => {
  it('accepts a valid payload, including practiceFields', () => {
    const res = validateInquiry({
      ...valid,
      practiceFields: { charge: 'DWI', custodyStatus: 'Released on bond' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.firmId).toBe('biles-law');
      expect(res.data.practiceFields?.charge).toBe('DWI');
    }
  });

  it('accepts the minimal payload: no phone, no preferredContact, no practiceFields', () => {
    const { phone: _p, preferredContact: _c, ...minimal } = valid;
    const res = validateInquiry(minimal);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.phone).toBeUndefined();
      // preferredContact defaults to 'email' when the sender omits it
      expect(res.data.preferredContact).toBe('email');
      expect(res.data.practiceFields).toBeUndefined();
    }
  });

  it('treats a blank phone string as absent', () => {
    const res = validateInquiry({ ...valid, phone: '   ' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.phone).toBeUndefined();
  });

  it('accepts multi-line message text (\\n and \\t allowed)', () => {
    const res = validateInquiry({ ...valid, message: 'line one\nline two\ttabbed' });
    expect(res.ok).toBe(true);
  });

  it('rejects missing required fields with safe messages', () => {
    const res = validateInquiry({ firmId: 'biles-law' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBeGreaterThan(0);
      // safe: field names + generic causes only
      expect(res.errors.join(' ')).not.toContain('expected');
      expect(res.errors.some((e) => e.startsWith('email'))).toBe(true);
    }
  });

  it('rejects consentTransactional / acknowledgeNoRelationship !== true', () => {
    for (const field of ['consentTransactional', 'acknowledgeNoRelationship'] as const) {
      const res = validateInquiry({ ...valid, [field]: false });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors.some((e) => e === `${field} must be accepted`)).toBe(true);
      }
    }
  });

  it('rejects invalid email', () => {
    const res = validateInquiry({ ...valid, email: 'not-an-email' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.includes('email'))).toBe(true);
  });

  it('rejects header-injection control chars in fullName/email/phone', () => {
    const injected = [
      { fullName: 'Jane\r\nBcc: evil@example.com' },
      { email: 'jane@example.com\r\nBcc: evil@example.com' },
      { phone: '555-1234\nBcc: evil@example.com' },
      { fullName: 'JaneDoe' },
    ];
    for (const patch of injected) {
      const res = validateInquiry({ ...valid, ...patch });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors.some((e) => e.includes('invalid'))).toBe(true);
      }
    }
  });

  it('rejects \\r in message (header-injection vector)', () => {
    const res = validateInquiry({ ...valid, message: 'hello\r\nBcc: evil@example.com' });
    expect(res.ok).toBe(false);
  });

  it('rejects oversized fields (name>200, message>5000, practice value>1000)', () => {
    expect(validateInquiry({ ...valid, fullName: 'x'.repeat(201) }).ok).toBe(false);
    expect(validateInquiry({ ...valid, message: 'x'.repeat(5001) }).ok).toBe(false);
    expect(
      validateInquiry({ ...valid, practiceFields: { notes: 'x'.repeat(1001) } }).ok,
    ).toBe(false);
    // boundary values pass
    expect(validateInquiry({ ...valid, fullName: 'x'.repeat(200) }).ok).toBe(true);
    expect(validateInquiry({ ...valid, message: 'x'.repeat(5000) }).ok).toBe(true);
  });

  it('rejects non-slug firmId (path traversal guard)', () => {
    expect(validateInquiry({ ...valid, firmId: '../../etc/passwd' }).ok).toBe(false);
    expect(validateInquiry({ ...valid, firmId: '../x' }).ok).toBe(false);
    expect(validateInquiry({ ...valid, firmId: 'UPPER' }).ok).toBe(false);
  });

  it('rejects wrong preferredContact', () => {
    expect(validateInquiry({ ...valid, preferredContact: 'fax' }).ok).toBe(false);
  });

  it('strips unknown body keys (to/cc/bcc can never ride along)', () => {
    const res = validateInquiry({
      ...valid,
      to: 'evil@example.com',
      cc: 'evil2@example.com',
      bcc: 'evil3@example.com',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as Record<string, unknown>;
      expect(data.to).toBeUndefined();
      expect(data.cc).toBeUndefined();
      expect(data.bcc).toBeUndefined();
    }
  });

  it('rejects non-object input', () => {
    expect(validateInquiry(null).ok).toBe(false);
    expect(validateInquiry('string').ok).toBe(false);
    expect(validateInquiry(42).ok).toBe(false);
  });
});
