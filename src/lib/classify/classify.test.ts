import { describe, expect, it } from 'vitest';
import { TOPICS, classifyMatter } from './index';

describe('classifyMatter', () => {
  it('classifies a custody + hearing message as child-custody with high confidence', () => {
    const result = classifyMatter({
      message:
        'My ex is denying visitation and I have a custody hearing next month. I need to modify our child custody order before school starts.',
      practiceFields: [],
      firmPracticeAreas: ['Family Law', 'Child Custody'],
    });
    expect(result.primary).toBe('child-custody');
    expect(result.confidence).toBe('high');
    expect(result.topics[0]).toBe('child-custody');
    expect(result.topics).toContain('visitation');
  });

  it('returns low confidence with no primary topic for gibberish', () => {
    const result = classifyMatter({
      message: 'asdf qwer zxcv 1234 ??? ...',
      practiceFields: [],
      firmPracticeAreas: [],
    });
    expect(result.confidence).toBe('low');
    expect(result.primary).toBeNull();
    expect(result.topics).toEqual([]);
  });

  it('classifies a DWI/arrest message into the criminal cluster', () => {
    const result = classifyMatter({
      message: 'I was arrested last weekend for a DWI and my bond hearing is tomorrow.',
      firmPracticeAreas: ['Criminal Defense', 'DWI'],
    });
    expect(result.confidence).not.toBe('low');
    expect(['dwi', 'arrest', 'bond']).toContain(result.primary ?? '');
  });

  it('covers the full published topic list', () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(25);
    expect(TOPICS).toContain('civil-rights');
    expect(TOPICS).toContain('vehicle-accident');
  });
});
