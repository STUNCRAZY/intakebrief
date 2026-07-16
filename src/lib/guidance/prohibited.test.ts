import { describe, expect, it } from 'vitest';
import { MANDATED_DOCUMENT_INSTRUCTION, PROHIBITED_ITEMS } from './prohibited';

describe('prohibited-submission guidance', () => {
  it('exposes the mandated document instruction verbatim', () => {
    expect(MANDATED_DOCUMENT_INSTRUCTION).toBe(
      'Do not upload or email legal documents through this form. If document review is appropriate, the firm will provide separate secure instructions.',
    );
  });

  it('lists all 18 spec items', () => {
    expect(PROHIBITED_ITEMS).toHaveLength(18);
    const specItems = [
      'legal documents',
      'pleadings',
      'court filings',
      'discovery',
      'contracts',
      'wills',
      'trusts',
      'medical records',
      'police reports',
      'evidence',
      'photographs',
      'video',
      'audio',
      'Social Security numbers',
      'bank-account details',
      'card information',
      'passwords',
      'confidential communications with another attorney',
    ];
    for (const item of specItems) {
      expect(PROHIBITED_ITEMS).toContain(item);
    }
  });
});
