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
  const now = at(20, 13);   // Fri 20 Nov 2026
  const at2 = (y: number, mo: number, d: number, h?: number) => `${P}-${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}${h === undefined ? '' : `-${String(h).padStart(2, '0')}00`}.${E}`;
  const prune = (names: string[], n = now) => toPrune(names, P, E, n).sort();

  it('keeps every slot of today and yesterday', () => {
    expect(prune([f(20, 3), f(20, 6), f(20, 9), f(19, 0), f(19, 3), f(19, 21)])).toEqual([]);
  });
  it('keeps one a day (the last) for the rest of the last week', () => {
    const names = [f(18, 3), f(18, 9), f(18, 21), f(17, 6), f(17, 12), f(15, 0), f(15, 3)];   // 15 Nov is the sixth day back
    expect(prune(names)).toEqual([f(18, 3), f(18, 9), f(17, 6), f(15, 0)].sort());
  });
  it('keeps one a week (the last) for the last month', () => {
    // Mon 9 - Sun 15 Nov is one week; 14 Nov is 6 days back, so anything from then on is still a daily file
    const names = [f(12, 3), f(12, 9), f(11, 6), f(10, 6), f(9, 6), f(8, 6), f(7, 6), f(2, 6), f(2, 12)];
    // the week of 9-15 Nov keeps its last (12 09), the week of 2-8 Nov keeps 8 06
    expect(prune(names)).toEqual([f(12, 3), f(11, 6), f(10, 6), f(9, 6), f(7, 6), f(2, 6), f(2, 12)].sort());
  });
  it('keeps one a month (the last) for the last 3 months, and nothing older', () => {
    const names = [at2(2026, 10, 20, 3), at2(2026, 10, 3, 3), at2(2026, 9, 28, 3), at2(2026, 9, 2, 3), at2(2026, 8, 25, 3), at2(2026, 8, 19, 3), at2(2026, 8, 20, 3), at2(2026, 8, 1, 3), at2(2026, 7, 30)];
    // 20 Oct is still in the weekly stretch; from 19 Aug back is the monthly one (20 Aug is its first day): the last of
    // Oct (3), Sep (28) and Aug (25) stay, and what is older than 3 months goes
    expect(prune(names)).toEqual([at2(2026, 9, 2, 3), at2(2026, 8, 20, 3), at2(2026, 8, 19, 3), at2(2026, 8, 1, 3), at2(2026, 7, 30)].sort());
  });
  it('keeps a one-a-day file from before slots like any other', () => {
    expect(prune([f(15), f(14)])).toEqual([]);
    expect(prune([f(15), f(15, 3)])).toEqual([f(15)]);   // the slot is later in the day than the old file
  });
  it('is the same again when run twice, and as the days go by', () => {
    const names = [f(20, 3), f(19, 21), f(18, 3), f(18, 9), f(14, 3), f(13, 9), f(12, 3), f(2, 6), f(2, 12), at2(2026, 10, 25, 3), at2(2026, 10, 9, 3), at2(2026, 8, 25, 3), at2(2026, 8, 1, 3)];
    let left = names;
    for (let d = 20; d <= 28; d++) {
      const n = at(d, 13);
      left = left.filter((x) => !toPrune(left, P, E, n).includes(x));
      expect(toPrune(left, P, E, n)).toEqual([]);
    }
  });
  it('never touches another app or other files', () => {
    expect(prune(['achievement-kitty-2026-01-01-0300.achkitty', 'achievement-kitty-2026-01-01-0600.achkitty', 'x.txt'])).toEqual([]);
  });
  it('works across a month and a year end', () => {
    const n = new Date(2027, 0, 2, 10);
    expect(prune([at2(2026, 12, 20, 3), at2(2026, 12, 20, 9), at2(2026, 10, 2, 3), at2(2026, 9, 30, 3)], n)).toEqual([at2(2026, 12, 20, 3), at2(2026, 9, 30, 3)].sort());
  });
});
