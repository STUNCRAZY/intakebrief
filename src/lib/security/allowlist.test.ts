import { describe, expect, it } from 'vitest';
import { getFirmRecipient } from './allowlist';

describe('getFirmRecipient', () => {
  it('returns the email for a mapped firmId', () => {
    const env = { FIRM_RECIPIENTS_JSON: JSON.stringify({ 'biles-law': 'intake@biles.example' }) };
    expect(getFirmRecipient('biles-law', env)).toBe('intake@biles.example');
  });

  it('returns null when the env var is missing', () => {
    expect(getFirmRecipient('biles-law', {})).toBe(null);
  });

  it('returns null for invalid JSON', () => {
    expect(getFirmRecipient('biles-law', { FIRM_RECIPIENTS_JSON: '{not json' })).toBe(null);
  });

  it('returns null for a non-object map', () => {
    expect(getFirmRecipient('biles-law', { FIRM_RECIPIENTS_JSON: '["x"]' })).toBe(null);
    expect(getFirmRecipient('biles-law', { FIRM_RECIPIENTS_JSON: '"x"' })).toBe(null);
  });

  it('returns null when the firm has no entry', () => {
    const env = { FIRM_RECIPIENTS_JSON: JSON.stringify({ 'other-firm': 'a@b.example' }) };
    expect(getFirmRecipient('biles-law', env)).toBe(null);
  });

  it('returns null for non-string or invalid-email entries', () => {
    expect(
      getFirmRecipient('biles-law', { FIRM_RECIPIENTS_JSON: JSON.stringify({ 'biles-law': 42 }) }),
    ).toBe(null);
    expect(
      getFirmRecipient('biles-law', {
        FIRM_RECIPIENTS_JSON: JSON.stringify({ 'biles-law': 'not-an-email' }),
      }),
    ).toBe(null);
  });
});
