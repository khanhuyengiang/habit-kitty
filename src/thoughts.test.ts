import { describe, expect, it } from 'vitest';
import type { Cat } from './rules.ts';
import { AWAY_MAX, pickThought, thoughtAbout } from './thoughts.ts';

const cat = (id: string, o: Partial<Cat> = {}): Cat => ({
  id, name: id, habit: 'h', mode: 'classic', status: 'alive', adoptedDay: 0, lastFedDay: null, missed: 0, settledDay: 0,
  sitterStartDay: null, lastSitterStartDay: null, endedDay: null, totalFeedings: 0, fedDays: [], sitterTrips: [], runAwayCount: 0, ...o,
});
const away = (id: string, start: number) => cat(id, { status: 'sitter', sitterStartDay: start, sitterTrips: [{ start, end: null }] });

describe('thoughtAbout', () => {
  it('thinks about a sitter cat more the longer it is away, up to a cap', () => {
    const c = (days: number) => thoughtAbout(away('a', 100), 100 + days)!.chance;
    expect(c(0)).toBeLessThan(c(3));
    expect(c(3)).toBeLessThan(c(6));
    expect(c(60)).toBe(AWAY_MAX);
  });

  it('keeps passed and ran-away cats rarer than a cat away with the sitter', () => {
    expect(thoughtAbout(cat('d', { status: 'dead' }), 10)!.chance).toBeLessThan(thoughtAbout(away('a', 10), 10)!.chance);
    expect(thoughtAbout(cat('r', { status: 'ranAway' }), 10)!.kind).toBe('ranAway');
  });

  it('stops thinking of a cat as away once it is home, and mentions the return for a week', () => {
    const back = cat('a', { sitterTrips: [{ start: 100, end: 104 }] });
    expect(thoughtAbout(back, 105)!.kind).toBe('returned');
    expect(thoughtAbout(back, 120)).toBeNull();
    expect(thoughtAbout(cat('b'), 120, { b: 119 })!.kind).toBe('returned');
  });

  it('ignores cats given back to the shelter', () => {
    expect(thoughtAbout(cat('s', { status: 'shelter' }), 10)).toBeNull();
  });
});

describe('pickThought', () => {
  const cats = [cat('home1'), cat('home2'), away('trip', 0)];

  it('only lets cats at home think, never about themselves, and never about a cat that is home', () => {
    for (let i = 0; i < 300; i++) {
      const t = pickThought(cats, 6, {}, () => true, () => Math.random() * 0.3);
      if (t) { expect(['home1', 'home2']).toContain(t.thinker); expect(t.subject).toBe('trip'); }
    }
  });

  it('respects the cooldown predicate', () => {
    expect(pickThought(cats, 6, {}, () => false, () => 0)).toBeNull();
    expect(pickThought(cats, 6, {}, (id) => id === 'home2', () => 0)?.thinker).toBe('home2');
  });

  it('is occasional: nothing happens on most rolls', () => {
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (pickThought(cats, 0, {}, () => true)) hits++;
    expect(hits).toBeLessThan(200);
  });

  it('does not make every cat think at once', () => {
    expect(pickThought(cats, 6, {}, () => true, () => 0)).not.toBeNull();   // a single result, never a list
  });

  it('returns null when nobody is away or remembered', () => {
    expect(pickThought([cat('a'), cat('b')], 5, {}, () => true, () => 0)).toBeNull();
  });
});
