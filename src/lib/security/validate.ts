/**
 * Server-side validation for inquiry submissions.
 * InquiryPayload = BaseInquiry & { practiceFields?: Record<string, string> }.
 *
 * Security properties:
 * - Unknown body keys (to/cc/bcc/...) are stripped — they can never influence routing.
 * - firmId is restricted to a slug pattern (prevents path traversal in research loaders).
 * - Header-relevant strings (name/email/phone/keys) reject ALL control chars (\r\n etc.).
 * - Long-text fields (message/practice values) allow \t and \n but reject \r and other
 *   control chars.
 * - Error messages are safe: field names + generic causes only, never received values.
 */
import { z } from 'zod';
import type { BaseInquiry } from '../inquiry/types';

/** Rejects every C0 control char + DEL. For single-line, header/subject-relevant strings. */
const STRICT_NO_CTRL = /[\x00-\x1F\x7F]/;
/** Rejects control chars except \t and \n (allows multi-line textarea input). */
const LOOSE_NO_CTRL = /[\x00-\x08\x0B-\x1F\x7F]/;

const NO_CTRL_MSG = 'contains invalid characters';

const strictLine = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => !STRICT_NO_CTRL.test(v), { message: NO_CTRL_MSG });

export const inquirySchema = z.object({
  firmId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'invalid'),
  fullName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((v) => !STRICT_NO_CTRL.test(v), { message: NO_CTRL_MSG }),
  email: z
    .string()
    .min(3)
    .max(254)
    .email()
    .refine((v) => !STRICT_NO_CTRL.test(v), { message: NO_CTRL_MSG }),
  phone: strictLine(40),
  preferredContact: z.enum(['email', 'phone']),
  message: z
    .string()
    .min(1)
    .max(5000)
    .refine((v) => !LOOSE_NO_CTRL.test(v), { message: NO_CTRL_MSG }),
  consentTransactional: z.literal(true),
  acknowledgeNoRelationship: z.literal(true),
  honeypot: z.string().max(1000).optional(),
  idempotencyKey: strictLine(200),
  practiceFields: z
    .record(
      z
        .string()
        .min(1)
        .max(100)
        .refine((v) => !STRICT_NO_CTRL.test(v), { message: NO_CTRL_MSG }),
      z
        .string()
        .max(1000)
        .refine((v) => !LOOSE_NO_CTRL.test(v), { message: NO_CTRL_MSG }),
    )
    .refine((rec) => Object.keys(rec).length <= 50, { message: 'invalid' })
    .optional(),
});

export type InquiryPayload = z.infer<typeof inquirySchema>;

/** Compile-time guard: validated payload must satisfy the shared contract. */
const _contractCheck: (p: InquiryPayload) => BaseInquiry & { practiceFields?: Record<string, string> } = (p) => p;
void _contractCheck;

/** Maps a zod issue to a safe, internals-free message (never echoes received values). */
function safeMessage(issue: z.ZodIssue): string {
  const field = issue.path.join('.') || 'payload';
  if (field === 'consentTransactional' || field === 'acknowledgeNoRelationship') {
    return `${field} must be accepted`;
  }
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === 'undefined' ? `${field} is required` : `${field} is invalid`;
    case z.ZodIssueCode.too_small:
      return `${field} is required`;
    case z.ZodIssueCode.too_big:
      return `${field} is too long`;
    case z.ZodIssueCode.invalid_string:
      return issue.validation === 'email' ? `${field} is not a valid email address` : `${field} is invalid`;
    case z.ZodIssueCode.custom:
      return `${field} ${issue.message ?? 'is invalid'}`;
    default:
      return `${field} is invalid`;
  }
}

export type ValidationResult =
  | { ok: true; data: InquiryPayload }
  | { ok: false; errors: string[] };

export function validateInquiry(data: unknown): ValidationResult {
  const parsed = inquirySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(safeMessage) };
  }
  return { ok: true, data: parsed.data };
}
