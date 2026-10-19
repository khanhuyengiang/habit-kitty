// Achievements are worked out from the save (cats, treats, diary) so they can never drift from the real history.
// Which ones have been unlocked is remembered by the app, so an achievement never goes away again.
import { levelFor, type AppState, type Cat } from './rules.ts';

export interface Achievement {
  id: string;
  group: 'Care' | 'Kitties' | 'Streaks' | 'Mindful' | 'Diary';
  title: string;
  text: string;
  progress: number;       // capped at target
  target: number;
  unlocked: boolean;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Longest run of days on which at least `k` kitties lived at home (or with the sitter).
export function longestRun(cats: Cat[], k: number, today: number): number {
  if (!cats.length) return 0;
  const first = Math.min(...cats.map((c) => c.adoptedDay));
  let best = 0, run = 0;
  for (let d = first; d <= today; d++) {
    const n = cats.filter((c) => d >= c.adoptedDay && (c.endedDay === null || d < c.endedDay)).length;
    run = n >= k ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// Longest stretch of consecutive fed days of any one kitty.
export function longestFedStreak(cats: Cat[]): number {
  let best = 0;
  for (const c of cats) {
    let run = 0, prev = NaN;
    for (const d of [...new Set(c.fedDays)].sort((a, b) => a - b)) {
      run = d === prev + 1 ? run + 1 : 1;
      prev = d;
      best = Math.max(best, run);
    }
  }
  return best;
}

export const RAISING: [kitties: number, weeks: number][] = [[1, 1], [1, 4], [1, 12], [2, 2], [3, 2], [3, 4], [5, 2], [5, 4]];
export const FEEDINGS = [10, 50, 100, 250, 500];
export const STREAKS = [7, 14, 30, 60, 100];
export const TREATS_DONE = [10, 50, 100];
export const LEVELS = [1, 5, 10];
export const DIARY_PAGES = [1, 7, 30];

export function achievements(s: AppState, diaryPages: number, today: number): Achievement[] {
  const make = (id: string, group: Achievement['group'], title: string, text: string, have: number, target: number): Achievement =>
    ({ id, group, title, text, progress: Math.min(have, target), target, unlocked: have >= target });
  const feedings = s.cats.reduce((n, c) => n + c.totalFeedings, 0);
  const streak = longestFedStreak(s.cats);
  const tasksDone = s.tasks.reduce((n, t) => n + t.doneDays.length, 0);
  const level = levelFor(s.xp);
  return [
    ...FEEDINGS.map((n) => make(`feed-${n}`, 'Care', `${n} meals served`, `Feed your kitties ${n} times.`, feedings, n)),
    ...RAISING.map(([k, w]) => make(`raise-${k}-${w}`, 'Kitties',
      `${plural(w, 'week')} with ${k === 1 ? 'a kitty' : `${k} kitties`}`,
      `Look after ${k === 1 ? 'a kitty' : `${k} kitties at once`} for ${plural(w, 'week')}.`, longestRun(s.cats, k, today), w * 7)),
    ...STREAKS.map((n) => make(`streak-${n}`, 'Streaks', `${n}-day streak`, `Feed one kitty ${n} days in a row.`, streak, n)),
    ...TREATS_DONE.map((n) => make(`mindful-${n}`, 'Mindful', `${n} treats and kibbles`, `Tick off ${n} treats or kibbles.`, tasksDone, n)),
    ...LEVELS.map((n) => make(`level-${n}`, 'Mindful', `Level ${n}`, `Reach level ${n}.`, level, n)),
    ...DIARY_PAGES.map((n) => make(`diary-${n}`, 'Diary', n === 1 ? 'Dear diary' : `${n} diary pages`, `Write ${plural(n, 'diary page')}.`, diaryPages, n)),
  ];
}
