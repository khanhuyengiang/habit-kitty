import { describe, expect, it } from 'vitest';
import type { Cat } from './rules.ts';
import { MAX_LINES, allCatsDiary, catDiary, clock } from './catdiary.ts';

const cat = (id: string, o: Partial<Cat> = {}): Cat => ({
  id, name: id, habit: 'h', mode: 'classic', status: 'alive', adoptedDay: 0, lastFedDay: null, missed: 0, settledDay: 0,
  sitterStartDay: null, lastSitterStartDay: null, endedDay: null, totalFeedings: 0, fedDays: [], sitterTrips: [], runAwayCount: 0, ...o,
});

describe('catDiary', () => {
  const cats = ['Nana', 'Lulu', 'Momo'].map((n) => cat(n));

  it('is stable for the same day, and never longer than three lines, in time order', () => {
    for (let day = 0; day < 60; day++) {
      const d = catDiary(cats[0], cats, day);
      expect(d).toEqual(catDiary(cats[0], cats, day));
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d.length).toBeLessThanOrEqual(MAX_LINES);
      expect(d.map((l) => l.minute)).toEqual([...d.map((l) => l.minute)].sort((a, b) => a - b));
    }
  });

  it('tells a shared moment from both sides at the same time', () => {
    const two = [cat('Nana'), cat('Lulu')];
    let seen = 0;
    for (let day = 0; day < 40; day++) {
      const a = catDiary(two[0], two, day).find((l) => l.text.includes('Lulu'));
      const b = catDiary(two[1], two, day).find((l) => l.text.includes('Nana'));
      expect(!!a).toBe(!!b);
      if (a && b) { seen++; expect(a.minute).toBe(b.minute); expect(a.text.replace('Nana', '').replace('Lulu', '')).toBe(b.text.replace('Nana', '').replace('Lulu', '')); }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('only keeps diaries for cats that are home', () => {
    expect(catDiary(cat('a', { status: 'sitter' }), cats, 3)).toEqual([]);
  });

  it('formats the clock', () => { expect(clock(16 * 60 + 23)).toBe('16:23'); expect(clock(7 * 60 + 5)).toBe('07:05'); });
});

describe('allCatsDiary', () => {
  const cats = [cat('Nana'), cat('Lulu'), cat('Momo')];
  it('merges every cat in time order and lists a shared event once', () => {
    for (let day = 0; day < 40; day++) {
      const all = allCatsDiary(cats, day);
      expect(all.map((l) => l.minute)).toEqual([...all.map((l) => l.minute)].sort((a, b) => a - b));
      const pairs = all.filter((l) => l.withId);
      expect(new Set(pairs.map((l) => `${l.minute}|${[l.catId, l.withId].sort().join('+')}`)).size).toBe(pairs.length);
      const total = cats.reduce((n, c) => n + catDiary(c, cats, day).length, 0);
      expect(all.length).toBeLessThanOrEqual(total);
    }
  });
  it('skips cats that are not at home', () => {
    expect(allCatsDiary([cat('Gone', { status: 'dead' })], 3)).toEqual([]);
  });
});
