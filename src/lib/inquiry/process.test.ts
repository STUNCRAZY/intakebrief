import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EmailMessage, EmailProvider, ProviderResult } from '@/lib/email/provider';
import { clearIdempotencyStore } from '@/lib/security/idempotency';
import { clearRateLimitStore } from '@/lib/security/rate-limit';
import {
  processInquiry,
  sha256,
  type InquiryTemplates,
} from './process';

/** Counting fake provider with a scriptable status sequence (defaults to accepted). */
class FakeProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];
  private readonly script: Array<'accepted' | 'failed' | 'blocked'>;

  constructor(script: Array<'accepted' | 'failed' | 'blocked'> = []) {
    this.script = [...script];
  }

  send(msg: EmailMessage): Promise<ProviderResult> {
    this.sent.push(msg);
    const status = this.script.length > 0 ? this.script.shift()! : 'accepted';
    return Promise.resolve({ status, detail: `fake ${status}` });
  }
}

/** Fake templates — deliberately set a WRONG `to` so tests prove processInquiry
 *  force-overrides routing (allowlist for the firm, submitter email for the customer). */
const fakeTemplates: InquiryTemplates = {
  buildFirmNotification: () => ({
    to: 'template-placeholder@example.invalid',
    subject: 'New inquiry',
    html: '<p>firm</p>',
    text: 'firm',
  }),
  buildCustomerResponse: () => ({
    to: 'template-placeholder@example.invalid',
    subject: 'We received your inquiry',
    html: '<p>customer</p>',
    text: 'customer',
  }),
};

const FIRM_ID = 'biles-law';
const ALLOWLIST_EMAIL = 'intake@biles.example';

const envWithAllowlist: Record<string, string | undefined> = {
  FIRM_RECIPIENTS_JSON: JSON.stringify({ [FIRM_ID]: ALLOWLIST_EMAIL }),
};

let keyCounter = 0;
function payload(overrides: Record<string, unknown> = {}) {
  keyCounter += 1;
  return {
    firmId: FIRM_ID,
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-123-4567',
    preferredContact: 'email',
    message: 'I was arrested on a DWI charge and need help with a bond hearing.',
    consentTransactional: true,
    acknowledgeNoRelationship: true,
    idempotencyKey: `key-${keyCounter}`,
    ...overrides,
  };
}

let auditPath: string | null = null;

beforeEach(() => {
  clearRateLimitStore();
  clearIdempotencyStore();
});

afterEach(async () => {
  if (auditPath) {
    await fs.rm(auditPath, { force: true });
    auditPath = null;
  }
});

describe('processInquiry', () => {
  it('valid flow → both emails sent, classification present', async () => {
    const provider = new FakeProvider();
    const res = await processInquiry(payload(), {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
      now: 1_000_000,
    });
    expect(res.http).toBe(200);
    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0].to).toBe(ALLOWLIST_EMAIL);
    expect(provider.sent[1].to).toBe('jane@example.com');
    expect(res.body.firmNotification?.status).toBe('accepted');
    expect(res.body.customerResponse?.status).toBe('accepted');
    expect(res.body.duplicate).toBe(false);
    expect(res.body.classification).toBeDefined();
    expect(res.body.classification!.topics.length).toBeGreaterThan(0);
    expect(res.body.classification!.confidence).toMatch(/high|medium|low/);
  });

  it('minimal submission without phone/practiceFields succeeds and still classifies', async () => {
    const provider = new FakeProvider();
    const { phone: _p, preferredContact: _c, ...minimal } = payload();
    const res = await processInquiry(minimal, {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
      now: 5_000_000,
    });
    expect(res.http).toBe(200);
    expect(provider.sent).toHaveLength(2);
    expect(res.body.firmNotification?.status).toBe('accepted');
    expect(res.body.customerResponse?.status).toBe('accepted');
    // classification works from the message text alone
    expect(res.body.classification).toBeDefined();
    expect(res.body.classification!.topics.length).toBeGreaterThan(0);
  });

  it('unknown firm id → 400, zero sends', async () => {
    const provider = new FakeProvider();
    const res = await processInquiry(payload({ firmId: 'no-such-firm' }), {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
    });
    expect(res.http).toBe(400);
    expect(res.body.error).toBe('unknown-firm');
    expect(provider.sent).toHaveLength(0);
  });

  it('body to/cc/bcc fields are ignored — recipient still comes from the allowlist', async () => {
    const provider = new FakeProvider();
    const res = await processInquiry(
      payload({ to: 'evil@example.com', cc: 'evil2@example.com', bcc: 'evil3@example.com' }),
      { ip: '1.2.3.4', env: envWithAllowlist, provider, templates: fakeTemplates },
    );
    expect(res.http).toBe(200);
    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0].to).toBe(ALLOWLIST_EMAIL);
    expect(provider.sent[1].to).toBe('jane@example.com');
  });

  it('header-injection strings → 400, zero sends', async () => {
    const provider = new FakeProvider();
    const res = await processInquiry(payload({ fullName: 'Jane\r\nBcc: evil@example.com' }), {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
    });
    expect(res.http).toBe(400);
    expect(res.body.error).toBe('invalid-submission');
    expect(res.body.errors?.length).toBeGreaterThan(0);
    expect(provider.sent).toHaveLength(0);
  });

  it('missing required fields → 400', async () => {
    const provider = new FakeProvider();
    const { email: _omit, ...rest } = payload();
    const res = await processInquiry(rest, {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
    });
    expect(res.http).toBe(400);
    expect(provider.sent).toHaveLength(0);
  });

  it('consents false → 400', async () => {
    const provider = new FakeProvider();
    const res = await processInquiry(
      payload({ consentTransactional: false, acknowledgeNoRelationship: false }),
      { ip: '1.2.3.4', env: envWithAllowlist, provider, templates: fakeTemplates },
    );
    expect(res.http).toBe(400);
    expect(provider.sent).toHaveLength(0);
  });

  it('honeypot filled → 200 neutral, zero sends, no status hints', async () => {
    const provider = new FakeProvider();
    const res = await processInquiry(payload({ honeypot: 'spammy' }), {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
    });
    expect(res.http).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.firmNotification).toBeUndefined();
    expect(res.body.customerResponse).toBeUndefined();
    expect(provider.sent).toHaveLength(0);
  });

  it('6th request in the window → 429 with retryAfterMs', async () => {
    const provider = new FakeProvider();
    const deps = {
      ip: '9.9.9.9',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
      now: 2_000_000,
    };
    for (let i = 0; i < 5; i++) {
      const res = await processInquiry(payload(), deps);
      expect(res.http).toBe(200);
    }
    const sixth = await processInquiry(payload(), deps);
    expect(sixth.http).toBe(429);
    expect(sixth.body.error).toBe('rate-limited');
    expect(sixth.body.retryAfterMs).toBeGreaterThan(0);
    expect(provider.sent).toHaveLength(10); // 2 per accepted call × 5
  });

  it('duplicate idempotencyKey → second call sends nothing and returns duplicate:true', async () => {
    const provider = new FakeProvider();
    const p = payload({ idempotencyKey: 'dup-key' });
    const deps = {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
      now: 3_000_000,
    };
    const first = await processInquiry(p, deps);
    expect(first.http).toBe(200);
    expect(provider.sent).toHaveLength(2);

    const second = await processInquiry(p, deps);
    expect(second.http).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.firmNotification?.status).toBe('accepted');
    expect(provider.sent).toHaveLength(2); // count stays 2 — no re-send
  });

  it('firm send failed → customer NOT sent, statuses honest', async () => {
    const provider = new FakeProvider(['failed']);
    const res = await processInquiry(payload(), {
      ip: '1.2.3.4',
      env: envWithAllowlist,
      provider,
      templates: fakeTemplates,
    });
    expect(res.http).toBe(200);
    expect(provider.sent).toHaveLength(1);
    expect(res.body.firmNotification?.status).toBe('failed');
    expect(res.body.customerResponse?.status).toBe('blocked');
    expect(res.body.customerResponse?.detail).toBe(
      'not sent: firm notification not accepted',
    );
  });

  it('no allowlist entry → firm notification blocked, zero sends', async () => {
    const provider = new FakeProvider();
    const res = await processInquiry(payload(), {
      ip: '1.2.3.4',
      env: {},
      provider,
      templates: fakeTemplates,
    });
    expect(res.http).toBe(200);
    expect(res.body.firmNotification?.status).toBe('blocked');
    expect(res.body.customerResponse?.status).toBe('blocked');
    expect(provider.sent).toHaveLength(0);
  });

  it('appends one audit line with no message text and no email addresses', async () => {
    auditPath = path.join(
      os.tmpdir(),
      `intakebrief-audit-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
    );
    const provider = new FakeProvider();
    const p = payload({ idempotencyKey: 'audit-key' });
    const res = await processInquiry(p, {
      ip: '1.2.3.4',
      env: { ...envWithAllowlist, AUDIT_LOG_PATH: auditPath },
      provider,
      templates: fakeTemplates,
      now: 4_000_000,
    });
    expect(res.http).toBe(200);

    const content = await fs.readFile(auditPath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(line.event).toBe('inquiry');
    expect(line.firmId).toBe(FIRM_ID);
    expect(line.firmStatus).toBe('accepted');
    expect(line.customerStatus).toBe('accepted');
    expect(line.idempotencyKeySha256).toBe(sha256('audit-key'));
    expect(typeof line.ts).toBe('string');
    // never contents or addresses
    expect(content).not.toContain('arrested');
    expect(content).not.toContain('jane@example.com');
    expect(content).not.toContain(ALLOWLIST_EMAIL);
    expect(content).not.toContain('audit-key"'); // raw key never appears
  });

  it('sha256 helper returns a stable 64-char hex digest', () => {
    const digest = sha256('abc');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(sha256('abc'));
  });
});
