import { describe, expect, it } from 'vitest';
import type { AppState, Cat } from './rules.ts';
import { achievements, longestFedStreak, longestRun } from './achievements.ts';

const cat = (id: string, over: Partial<Cat> = {}): Cat => ({
  id, name: id, habit: 'h', mode: 'classic', status: 'alive', adoptedDay: 0, lastFedDay: null, missed: 0, settledDay: 0,
  sitterStartDay: null, lastSitterStartDay: null, endedDay: null, totalFeedings: 0, fedDays: [], sitterTrips: [], runAwayCount: 0, ...over,
});
const state = (cats: Cat[], xp = 0): AppState => ({ xp, cats, tasks: [] });
const get = (list: ReturnType<typeof achievements>, id: string) => list.find((a) => a.id === id)!;

describe('achievements', () => {
  it('counts the longest run with at least k kitties', () => {
    const cats = [cat('a', { adoptedDay: 0 }), cat('b', { adoptedDay: 3, endedDay: 10 }), cat('c', { adoptedDay: 5, endedDay: 8 })];
    expect(longestRun(cats, 1, 20)).toBe(21);
    expect(longestRun(cats, 2, 20)).toBe(7);    // days 3..9
    expect(longestRun(cats, 3, 20)).toBe(3);    // days 5..7
    expect(longestRun([], 1, 5)).toBe(0);
  });
  it('finds the longest fed streak of any kitty', () => {
    expect(longestFedStreak([cat('a', { fedDays: [1, 2, 3, 5, 6] }), cat('b', { fedDays: [10, 11, 12, 13] })])).toBe(4);
  });
  it('unlocks meal, kitty-weeks and streak achievements with progress', () => {
    const cats = [cat('a', { totalFeedings: 12, fedDays: [0, 1, 2, 3, 4, 5, 6] })];
    const list = achievements(state(cats), 0, 8);
    expect(get(list, 'feed-10').unlocked).toBe(true);
    expect(get(list, 'feed-50')).toMatchObject({ unlocked: false, progress: 12, target: 50 });
    expect(get(list, 'raise-1-1').unlocked).toBe(true);
    expect(get(list, 'raise-1-4')).toMatchObject({ unlocked: false, progress: 9, target: 28 });
    expect(get(list, 'streak-7').unlocked).toBe(true);
    expect(get(list, 'streak-14').unlocked).toBe(false);
    expect(get(list, 'diary-1').unlocked).toBe(false);
    expect(get(achievements(state(cats), 3, 8), 'diary-1').unlocked).toBe(true);
  });
  it('has unique ids and readable titles', () => {
    const list = achievements(state([cat('a')]), 0, 0);
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
    expect(get(list, 'raise-3-2').title).toBe('2 weeks with 3 kitties');
    expect(get(list, 'raise-1-1').title).toBe('1 week with a kitty');
  });
});
