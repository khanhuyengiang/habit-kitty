// What Habit Kitty and the diary tell the rest of the page about the player, for the home page's HP and MP bars (and the clock).
// Habit Kitty always runs (its reminders and music do), so it publishes here and the home page listens.
// offsetHours is Habit Kitty's playtest clock, so the diary agrees with it about what today is.
export interface HabitStats { xp: number | null; diaryDays: number | null; offsetHours: number }   // null: not known yet

let stats: HabitStats = { xp: null, diaryDays: null, offsetHours: 0 };
const listeners = new Set<() => void>();

export const habitStats = () => stats;
export function publishHabitStats(next: Partial<HabitStats>) {
  const merged = { ...stats, ...next };
  if (merged.xp === stats.xp && merged.diaryDays === stats.diaryDays && merged.offsetHours === stats.offsetHours) return;
  stats = merged;
  for (const l of listeners) l();
}
export function onHabitStats(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
