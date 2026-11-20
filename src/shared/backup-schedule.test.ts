import { describe, expect, it } from 'vitest';
import { backupLabel, backupName, backupsOf, isDue, slotName, slotOf, toPrune } from './backup-schedule.ts';

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const P = 'habit-kitty', E = 'kitty';
const f = (d: number, h?: number) => `${P}-2026-11-${String(d).padStart(2, '0')}${h === undefined ? '' : `-${String(h).padStart(2, '0')}00`}.${E}`;

describe('names', () => {
  it('a manual backup is named by the local date, zero padded', () => {
    expect(backupName(P, E, new Date(2026, 10, 5, 23, 59))).toBe('habit-kitty-2026-11-05.kitty');
  });
  it('an automatic one by the date and its 3-hour slot', () => {
    expect(slotName(P, E, at(20, 9, 0))).toBe('habit-kitty-2026-11-20-0900.kitty');
    expect(slotName(P, E, at(20, 11, 59))).toBe('habit-kitty-2026-11-20-0900.kitty');
    expect(slotName(P, E, at(20, 12, 0))).toBe('habit-kitty-2026-11-20-1200.kitty');
    expect(slotName(P, E, at(20, 0, 5))).toBe('habit-kitty-2026-11-20-0000.kitty');
    expect(slotName(P, E, at(20, 23, 59))).toBe('habit-kitty-2026-11-20-2100.kitty');
    expect(slotOf(at(1, 2))).toBe('0000');
  });
});

describe('isDue', () => {
  it('backs up whenever something changed, and never when nothing did', () => {
    expect(isDue({ dirty: true })).toBe(true);
    expect(isDue({ dirty: false })).toBe(false);
  });
});

describe('listing', () => {
  const files = [f(18), f(20, 3), f(20, 9), f(19, 21), 'notes.txt', 'achievement-kitty-2026-11-01.achkitty', `${f(20, 3)} (1)`];
  it("lists one app's backups newest first, slots after the day's older one-a-day file, ignoring everything else", () => {
    expect(backupsOf(files, P, E)).toEqual([f(20, 9), f(20, 3), f(19, 21), f(18)]);
  });
  it('writes a readable label', () => {
    expect(backupLabel(f(20, 9), P, E)).toBe('2026-11-20 09:00');
    expect(backupLabel(f(18), P, E)).toBe('2026-11-18');
  });
});

describe('pruning', () => {
  const now = at(20, 13);
  it('keeps every slot of today and yesterday', () => {
    expect(toPrune([f(20, 3), f(20, 6), f(20, 9), f(19, 0), f(19, 3), f(19, 21)], P, E, now)).toEqual([]);
  });
  it("keeps only the last backup of each older day", () => {
    const names = [f(18, 3), f(18, 9), f(18, 21), f(17, 6), f(17, 12), f(16, 0), f(20, 3), f(19, 3)];
    expect(toPrune(names, P, E, now).sort()).toEqual([f(18, 3), f(18, 9), f(17, 6)].sort());
  });
  it("keeps a day's one-a-day file from before slots, and a day with one file", () => {
    expect(toPrune([f(15), f(14), f(13), f(12, 6)], P, E, now)).toEqual([]);
    expect(toPrune([f(15), f(15, 3)], P, E, now)).toEqual([f(15)]);   // the slot is later in the day than the old file
  });
  it('never touches another app or other files', () => {
    expect(toPrune(['achievement-kitty-2026-11-01-0300.achkitty', 'achievement-kitty-2026-11-01-0600.achkitty', 'x.txt'], P, E, now)).toEqual([]);
  });
  it('works across a month end', () => {
    const n = new Date(2026, 11, 1, 10);   // 1 Dec: yesterday is 30 Nov
    expect(toPrune([`${P}-2026-11-30-0300.${E}`, `${P}-2026-11-30-0900.${E}`, `${P}-2026-11-29-0300.${E}`, `${P}-2026-11-29-0900.${E}`], P, E, n)).toEqual([`${P}-2026-11-29-0300.${E}`]);
  });
});
