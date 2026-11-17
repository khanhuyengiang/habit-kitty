import { describe, expect, it } from 'vitest';
import { addMindfulTask, dayIndex, daysUntilReady, doMindfulTask, newState, weekdayOf, type AppState } from './rules.ts';

const at = (d: number, h = 12) => new Date(2026, 9, d, h);   // October 2026: the 12th is a Monday
const addTreat = (weekdays: number[], when = at(5)) => addMindfulTask(newState(), { id: 't', name: 'Water plants', xp: 2, weekdays }, when);
const done = (s: AppState, when: Date) => { const r = doMindfulTask(s, 't', when); if (!r.ok) throw new Error(r.reason); return r.state; };

describe('weekdays', () => {
  it('numbers Monday as 0', () => {
    expect(weekdayOf(dayIndex(at(12)))).toBe(0);
    expect(weekdayOf(dayIndex(at(18)))).toBe(6);
  });
});

describe('weekday treats', () => {
  it('is done once per scheduled weekday', () => {
    let s = addTreat([0]);                      // every Monday, created on a Monday
    expect(daysUntilReady(s.tasks[0], dayIndex(at(5)))).toBe(0);
    s = done(s, at(5));
    expect(daysUntilReady(s.tasks[0], dayIndex(at(5)))).toBe(7);
    expect(doMindfulTask(s, 't', at(5)).ok).toBe(false);
    expect(daysUntilReady(s.tasks[0], dayIndex(at(8)))).toBe(4);   // Thursday: Monday is 4 days away
    expect(daysUntilReady(s.tasks[0], dayIndex(at(12)))).toBe(0);
  });
  it('lets a missed day be done late, but only once', () => {
    let s = addTreat([0]);
    s = done(s, at(5));
    expect(daysUntilReady(s.tasks[0], dayIndex(at(14)))).toBe(0);   // Wednesday, Monday the 12th was never done
    s = done(s, at(14));
    expect(daysUntilReady(s.tasks[0], dayIndex(at(14)))).toBe(5);   // next Monday is the 19th
  });
  it('handles several weekdays', () => {
    let s = addTreat([0, 3]);                   // Monday and Thursday
    s = done(s, at(12));
    expect(daysUntilReady(s.tasks[0], dayIndex(at(12)))).toBe(3);
    expect(daysUntilReady(s.tasks[0], dayIndex(at(15)))).toBe(0);
  });
  it('treats all seven days as daily and ignores junk', () => {
    expect(addTreat([0, 1, 2, 3, 4, 5, 6]).tasks[0].weekdays).toBeUndefined();
    expect(addTreat([9, -1, 1.5]).tasks[0].weekdays).toBeUndefined();
    expect(addTreat([3, 0, 3]).tasks[0].weekdays).toEqual([0, 3]);
  });
});
