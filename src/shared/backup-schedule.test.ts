import { describe, expect, it } from 'vitest';
import { MIN_GAP_MS, STALE_MS, backupName, backupsOf, isDue, toPrune } from './backup-schedule.ts';

describe('backupName', () => {
  it('uses the local date with zero padding', () => {
    expect(backupName('habit-kitty', 'kitty', new Date(2026, 10, 5, 23, 59))).toBe('habit-kitty-2026-11-05.kitty');
  });
});

describe('isDue', () => {
  const now = 10_000_000_000;
  it('waits a little after a change, so editing does not back up every time', () => {
    expect(isDue({ dirty: true, last: now - MIN_GAP_MS + 1, now })).toBe(false);
    expect(isDue({ dirty: true, last: now - MIN_GAP_MS, now })).toBe(true);
  });
  it('backs up a first time at once', () => expect(isDue({ dirty: true, last: 0, now })).toBe(true));
  it('does nothing when nothing changed', () => expect(isDue({ dirty: false, last: now - 5 * STALE_MS, now })).toBe(false));
  it('refreshes an old backup when the app opens', () => {
    expect(isDue({ dirty: false, last: now - STALE_MS, now, launch: true })).toBe(true);
    expect(isDue({ dirty: false, last: now - STALE_MS + 1, now, launch: true })).toBe(false);
    expect(isDue({ dirty: false, last: 0, now, launch: true })).toBe(true);
  });
});

describe('pruning', () => {
  const files = ['habit-kitty-2026-11-01.kitty', 'habit-kitty-2026-11-03.kitty', 'habit-kitty-2026-10-30.kitty', 'notes.txt',
    'achievement-kitty-2026-11-01.achkitty', 'habit-kitty-2026-11-02.kitty (1)', 'habit-kitty-2026-11-02.kitty'];
  it('lists one app\'s backups newest first and ignores everything else', () => {
    expect(backupsOf(files, 'habit-kitty', 'kitty')).toEqual(['habit-kitty-2026-11-03.kitty', 'habit-kitty-2026-11-02.kitty', 'habit-kitty-2026-11-01.kitty', 'habit-kitty-2026-10-30.kitty']);
  });
  it('deletes only the oldest of that app beyond the limit', () => {
    expect(toPrune(files, 'habit-kitty', 'kitty', 2)).toEqual(['habit-kitty-2026-11-01.kitty', 'habit-kitty-2026-10-30.kitty']);
    expect(toPrune(files, 'achievement-kitty', 'achkitty', 2)).toEqual([]);
  });
});
