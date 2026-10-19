import { describe, expect, it } from 'vitest';
import { adoptCat, feedCat, newState, type Cat } from './rules.ts';
import { fedMessage } from './encourage.ts';

const cat = (over: Partial<Cat> = {}): Cat => {
  const r = adoptCat(newState(), { id: 'mochi', name: 'Mochi', habit: 'h', gender: 'girl' }, new Date(2026, 0, 5, 12));
  if (!r.ok) throw new Error('adopt');
  return { ...r.state.cats[0], totalFeedings: 4, ...over };
};

describe('fedMessage', () => {
  it('always names the food and the xp, with some encouragement', () => {
    for (const roll of [0, 0.3, 0.99]) {
      const m = fedMessage(cat(), 'fish', 1, () => roll);
      expect(m).toContain('Mochi ate fish. +5 xp.');
      expect(m.length).toBeGreaterThan(30);
    }
  });
  it('celebrates the first meal, streaks and meal counts', () => {
    expect(fedMessage(cat({ totalFeedings: 1 }), 'fish', 1)).toContain('First meal together');
    expect(fedMessage(cat(), 'fish', 7)).toContain('7 days in a row');
    expect(fedMessage(cat({ totalFeedings: 50 }), 'fish', 2)).toContain('50 meals');
  });
  it('uses the kitty pronouns', () => {
    const girl = Array.from({ length: 20 }, (_, i) => fedMessage(cat(), 'fish', 1, () => i / 20)).join(' ');
    expect(girl).not.toMatch(/\bhis\b|\bhe\b/);
    const boy = Array.from({ length: 20 }, (_, i) => fedMessage(cat({ gender: 'boy' }), 'fish', 1, () => i / 20)).join(' ');
    expect(boy).not.toMatch(/\bher\b|\bshe\b/);
  });
  it('works on a cat that was really fed', () => {
    const r = adoptCat(newState(), { id: 'a', name: 'A', habit: 'h' }, new Date(2026, 0, 5, 12));
    if (!r.ok) throw new Error();
    const f = feedCat(r.state, 'a', new Date(2026, 0, 5, 13));
    expect(f.ok && fedMessage(f.state.cats[0], 'meat', 1)).toContain('First meal together');
  });
});
