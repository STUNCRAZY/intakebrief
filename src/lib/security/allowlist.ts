/**
 * Server-side firm recipient allowlist.
 * The recipient for firm notifications comes ONLY from the FIRM_RECIPIENTS_JSON
 * environment variable (a JSON map of firmId → email). The request body can never
 * supply or influence the recipient. Missing/invalid map or entry → null.
 */
import { z } from 'zod';

/** Loose env-map type — accepts process.env and plain test fixtures alike. */
export type EnvMap = Record<string, string | undefined>;

const emailCheck = z.string().email();

export function getFirmRecipient(
  firmId: string,
  env: EnvMap = process.env,
): string | null {
  const raw = env.FIRM_RECIPIENTS_JSON;
  if (!raw) return null;
  let map: unknown;
  try {
    map = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  const value = (map as Record<string, unknown>)[firmId];
  if (typeof value !== 'string') return null;
  return emailCheck.safeParse(value).success ? value : null;
}
