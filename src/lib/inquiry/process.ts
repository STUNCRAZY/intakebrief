/**
 * Inquiry processing pipeline — the honest sequence:
 *   validate(400) → firm exists via getFirm (400 unknown firm) → honeypot non-empty
 *   (200 neutral, no sends) → rate limit (429 + retryAfterMs) → idempotency replay
 *   (200 duplicate:true, no re-send) → classifyMatter (always, so blocked flows
 *   still report the likely matter) → recipient from server-side allowlist
 *   (null → firm notification blocked, customer NOT sent) →
 *   buildFirmNotification → provider.send → customer response only if the firm
 *   notification was accepted. Statuses are always truthful.
 *
 * The email template module (src/lib/email/templates.ts) is implemented by another
 * module against the TemplateInput/InquiryTemplates contract below; it is injected
 * via deps.templates in tests and lazy-loaded at runtime otherwise.
 *
 * Audit: when env.AUDIT_LOG_PATH is set, exactly one JSON line is appended per
 * processed inquiry — never message contents or email addresses.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { classifyMatter } from '@/lib/classify';
import { getEmailProvider, type EmailMessage, type EmailProvider } from '@/lib/email/provider';
import { getFirm } from '@/lib/firms/load';
import type { FirmProfile } from '@/lib/firms/types';
import type { DeliveryStatus } from '@/lib/inquiry/types';
import { getFirmRecipient } from '@/lib/security/allowlist';
import * as idempotency from '@/lib/security/idempotency';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { validateInquiry, type InquiryPayload } from '@/lib/security/validate';

/** sha256 hex digest — used for the audit log's idempotency key fingerprint. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Cross-module template contract (mirrors src/lib/email/templates.ts exactly). */
export interface TemplateInput {
  firm: FirmProfile;
  inquiry: InquiryPayload;
  classification: {
    primary: string | null;
    confidence: 'high' | 'medium' | 'low';
    topics: string[];
  };
  submittedAt: Date;
}

export interface InquiryTemplates {
  buildFirmNotification(input: TemplateInput): EmailMessage;
  buildCustomerResponse(input: TemplateInput): EmailMessage;
}

export interface ProcessDeps {
  ip?: string;
  env?: Record<string, string | undefined>;
  provider?: EmailProvider;
  now?: number;
  templates?: InquiryTemplates;
}

export interface InquiryResponseBody {
  ok?: boolean;
  duplicate?: boolean;
  error?: string;
  errors?: string[];
  retryAfterMs?: number;
  firmNotification?: { status: DeliveryStatus; detail: string };
  customerResponse?: { status: DeliveryStatus; detail: string };
  classification?: {
    primary: string | null;
    confidence: 'high' | 'medium' | 'low';
    topics: string[];
  };
}

async function loadTemplates(): Promise<InquiryTemplates> {
  // @ts-ignore — src/lib/email/templates.ts is delivered by the parallel template
  // module; the import resolves once that file lands (central build happens after).
  const mod = (await import('@/lib/email/templates')) as InquiryTemplates;
  return mod;
}

async function audit(
  env: Record<string, string | undefined>,
  line: Record<string, unknown>,
): Promise<void> {
  const path = env.AUDIT_LOG_PATH;
  if (!path) return;
  try {
    await fs.appendFile(path, `${JSON.stringify(line)}\n`, 'utf8');
  } catch (err) {
    // Audit failure must not break intake; surface it on the server log only.
    console.error('inquiry audit write failed:', err instanceof Error ? err.message : err);
  }
}

export async function processInquiry(
  payload: unknown,
  deps: ProcessDeps = {},
): Promise<{ http: number; body: InquiryResponseBody }> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now();

  // 1. Validate — safe 400, never throws.
  const validation = validateInquiry(payload);
  if (!validation.ok) {
    return { http: 400, body: { error: 'invalid-submission', errors: validation.errors } };
  }
  const inquiry = validation.data;

  try {
    // 2. Firm must exist in the researched docket.
    const firm = getFirm(inquiry.firmId);
    if (!firm) {
      return { http: 400, body: { error: 'unknown-firm' } };
    }

    // 3. Honeypot: any content means bot. Neutral 200, no sends, no hints.
    if (inquiry.honeypot && inquiry.honeypot.length > 0) {
      return { http: 200, body: { ok: true } };
    }

    // 4. Rate limit per ip+firmId.
    const limit = checkRateLimit(`${deps.ip ?? 'unknown'}|${inquiry.firmId}`, now, env);
    if (!limit.ok) {
      return { http: 429, body: { error: 'rate-limited', retryAfterMs: limit.retryAfterMs ?? 0 } };
    }

    // 5. Idempotency replay: return the stored result, send nothing again.
    const idemKey = `${inquiry.firmId}:${inquiry.idempotencyKey}`;
    const prior = idempotency.get<InquiryResponseBody>(idemKey, now);
    if (prior) {
      return { http: 200, body: { ...prior, duplicate: true } };
    }

    // 6. Deterministic classification — runs even when delivery is blocked, so
    // the response honestly reports the likely matter in every outcome.
    // Works from the message text alone; the minimal form collects no
    // practice-specific fields.
    const classification = classifyMatter({
      message: inquiry.message,
      firmPracticeAreas: firm.practiceAreas,
    });

    // 7. Recipient comes ONLY from the server-side allowlist.
    const recipient = getFirmRecipient(inquiry.firmId, env);
    if (!recipient) {
      const body: InquiryResponseBody = {
        ok: true,
        duplicate: false,
        firmNotification: {
          status: 'blocked',
          detail: 'no delivery recipient configured for this firm',
        },
        customerResponse: {
          status: 'blocked',
          detail: 'not sent: firm notification not sent',
        },
        classification,
      };
      idempotency.remember(idemKey, body, now);
      await audit(env, {
        ts: new Date(now).toISOString(),
        event: 'inquiry',
        firmId: inquiry.firmId,
        primary: classification.primary,
        confidence: classification.confidence,
        firmStatus: 'blocked',
        customerStatus: 'blocked',
        idempotencyKeySha256: sha256(inquiry.idempotencyKey),
      });
      return { http: 200, body };
    }

    const templates = deps.templates ?? (await loadTemplates());
    const provider = deps.provider ?? getEmailProvider(env as NodeJS.ProcessEnv);
    const input: TemplateInput = {
      firm,
      inquiry,
      classification,
      submittedAt: new Date(now),
    };

    // 8. Firm notification. The recipient is force-set from the allowlist,
    //    regardless of what the template or request body contains.
    const firmMessage: EmailMessage = {
      ...templates.buildFirmNotification(input),
      to: recipient,
    };
    const firmResult = await provider.send(firmMessage);

    let firmNotification: { status: DeliveryStatus; detail: string };
    let customerResponse: { status: DeliveryStatus; detail: string };

    if (firmResult.status !== 'accepted') {
      // 9a. Firm notification not accepted → customer response is honestly blocked.
      firmNotification = { status: firmResult.status, detail: firmResult.detail };
      customerResponse = {
        status: 'blocked',
        detail: 'not sent: firm notification not accepted',
      };
    } else {
      // 9b. Only then send the customer response (to the submitter's own address).
      firmNotification = { status: 'accepted', detail: firmResult.detail };
      const customerMessage: EmailMessage = {
        ...templates.buildCustomerResponse(input),
        to: inquiry.email,
      };
      const customerResult = await provider.send(customerMessage);
      customerResponse = { status: customerResult.status, detail: customerResult.detail };
    }

    const body: InquiryResponseBody = {
      ok: true,
      duplicate: false,
      firmNotification,
      customerResponse,
      classification,
    };
    idempotency.remember(idemKey, body, now);
    await audit(env, {
      ts: new Date(now).toISOString(),
      event: 'inquiry',
      firmId: inquiry.firmId,
      primary: classification.primary,
      confidence: classification.confidence,
      firmStatus: firmNotification.status,
      customerStatus: customerResponse.status,
      idempotencyKeySha256: sha256(inquiry.idempotencyKey),
    });
    return { http: 200, body };
  } catch (err) {
    // Unexpected failure — generic safe text, no internals leaked.
    console.error('inquiry processing failed:', err instanceof Error ? err.message : err);
    return { http: 500, body: { error: 'processing-failed' } };
  }
}
