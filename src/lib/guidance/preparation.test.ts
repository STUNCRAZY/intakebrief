import { describe, expect, it } from 'vitest';
import { getPreparationGuidance } from './preparation';

describe('getPreparationGuidance', () => {
  it('always includes the common items', () => {
    const items = getPreparationGuidance({ lane: 'business', topics: [] });
    expect(items).toContain('A typed timeline of events, in order');
    expect(items).toContain('The three main questions you want answered');
    expect(items).toContain('Your desired outcome');
  });

  it('picks family extras for a family lane', () => {
    const items = getPreparationGuidance({ lane: 'family', topics: [] });
    expect(items).toContain('Whether children are involved');
    expect(items).toContain('Any existing court orders');
    expect(items).toContain('Your immediate parenting concerns');
    // no unrelated practice extras
    expect(items).not.toContain('The claim number, if any');
  });

  it('picks personal-injury extras for a vehicle-accident topic regardless of lane', () => {
    const items = getPreparationGuidance({ lane: 'criminal', topics: ['vehicle-accident'] });
    expect(items).toContain('The claim number, if any');
    expect(items).toContain('Names of treatment providers');
    expect(items).toContain('Your current treatment status');
    // lane list still applied first
    expect(items).toContain('Your next court setting');
  });

  it('picks criminal extras for dwi topics and estate extras for probate topics', () => {
    expect(getPreparationGuidance({ lane: 'family', topics: ['dwi'] })).toContain(
      'Your bond and custody status',
    );
    expect(getPreparationGuidance({ lane: 'pi', topics: ['probate'] })).toContain(
      'A brief family overview',
    );
  });

  it('contains no duplicate items', () => {
    const items = getPreparationGuidance({
      lane: 'family',
      topics: ['divorce', 'child-custody', 'visitation'],
    });
    expect(new Set(items).size).toBe(items.length);
  });
});
