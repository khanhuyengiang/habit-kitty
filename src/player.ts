// The player's three levels, pure so they can be tested. The player is one person across the apps:
//   Level  from Kitty Achievement (levelOf in achievement/ops.ts: unlocked achievements)
//   HP     from Habit Kitty's affection (levelProgress in rules.ts)
//   MP     from filling the diary: 10 days to leave level 1, 20 to leave level 2, 30 to leave level 3, and so on
import { levelProgress } from './rules.ts';

export const diaryDaysToLeave = (level: number) => 10 * level;

export function mpProgress(days: number) {
  let level = 1, into = Math.max(0, Math.floor(days));
  while (into >= diaryDaysToLeave(level)) { into -= diaryDaysToLeave(level); level++; }
  return { level, into, per: diaryDaysToLeave(level) };
}

// How many of `segments` bar segments are lit: never all of them before the level is reached.
export const litSegments = (into: number, per: number, segments = 10) =>
  per > 0 ? Math.max(0, Math.min(segments - 1, Math.floor((segments * into) / per))) : 0;

// The long unique id, shown short (first 8 characters, upper case) as the player's ID.
export const shortId = (id: string) => id.replace(/[^0-9a-z]/gi, '').slice(0, 8).toUpperCase();

// ---- the stat lines shown at the top of each app and on the player card, all in one shape ----
//   HP 397        97/300 to lvl 3      (the number is always the running total: affection, diary days...)
export type StatTag = 'Lv' | 'HP' | 'MP';
export interface StatLine {
  tag: StatTag;
  total: string;      // the running total, left of the bar
  extra?: string;     // a little more, still on the left
  progress: string;   // right of the text: how far to the next level
  lit: number;        // bar segments lit, of 10
  label: string;      // for screen readers
}

const toNext = (into: number, per: number, level: number) => `${into}/${per} to lvl ${level + 1}`;

// HP: Habit Kitty's affection, the total XP.
export function hpLine(xp: number): StatLine {
  const p = levelProgress(xp);
  return { tag: 'HP', total: String(xp), progress: toNext(p.xpIntoLevel, p.xpForNextLevel, p.level),
    lit: xp < 0 ? 0 : litSegments(p.xpIntoLevel, p.xpForNextLevel), label: `HP ${xp}, level ${p.level}, ${toNext(p.xpIntoLevel, p.xpForNextLevel, p.level)}` };
}

// MP: the days written in the diary.
export function mpLine(days: number): StatLine {
  const m = mpProgress(days);
  return { tag: 'MP', total: String(days), progress: toNext(m.into, m.per, m.level),
    lit: litSegments(m.into, m.per), label: `MP ${days}, level ${m.level}, ${toNext(m.into, m.per, m.level)}` };
}

// Lv: the player's level, worked out from the achievements unlocked (levelOf in achievement/ops.ts).
export function lvLine(l: { level: number; completed: number; into: number; per: number }): StatLine {
  return { tag: 'Lv', total: String(l.level), extra: `${l.completed} unlocked`, progress: toNext(l.into, l.per, l.level),
    lit: litSegments(l.into, l.per), label: `Level ${l.level}, ${l.completed} achievements unlocked, ${toNext(l.into, l.per, l.level)}` };
}
