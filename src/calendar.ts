// Month calendar / heatmap data, shared by the terminal playground and the web page.
import type { Cat } from './rules.ts';

// Day indices count local calendar days since 1970-01-01, so UTC getters recover the date.
export const dateOf = (day: number) => new Date(day * 86_400_000);
export const dayOf = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 86_400_000);

export type DayKind = 'fed' | 'missed' | 'today' | 'sitter' | 'none';

function kindOf(cat: Cat, day: number, today: number, fed: Set<number>): DayKind {
  if (fed.has(day)) return 'fed';
  if (day < cat.adoptedDay || day > today) return 'none';
  if (cat.sitterTrips.some((t) => day >= t.start && day < (t.end ?? Infinity))) return 'sitter';
  if (cat.endedDay !== null && day >= cat.endedDay) return 'none';
  if (day === today) return 'today';
  return 'missed';
}

export interface MonthGrid {
  title: string;                         // "October 2026"
  lead: number;                          // blank cells before day 1 (Monday-first)
  days: { day: number; date: number; kind: DayKind }[];
  count: Record<DayKind, number>;
  tracked: number;                       // days you were expected to feed: fed + missed
}

export function monthGrid(cat: Cat, year: number, month: number, today: number): MonthGrid {
  const fed = new Set(cat.fedDays);
  const first = dayOf(year, month, 1);
  const last = dayOf(year, month + 1, 0);
  const count: Record<DayKind, number> = { fed: 0, missed: 0, today: 0, sitter: 0, none: 0 };
  const days = [];
  for (let d = first; d <= last; d++) {
    const kind = kindOf(cat, d, today, fed);
    count[kind]++;
    days.push({ day: d, date: d - first + 1, kind });
  }
  return {
    title: dateOf(first).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    lead: (dateOf(first).getUTCDay() + 6) % 7,
    days,
    count,
    tracked: count.fed + count.missed,
  };
}

export function streak(cat: Cat, today: number): number {
  const fed = new Set(cat.fedDays);
  let d = fed.has(today) ? today : today - 1;   // today isn't missed until it's over
  let n = 0;
  while (fed.has(d--)) n++;
  return n;
}

// The Monday-first week containing `today`, one entry per day.
export function weekRow(cat: Cat, today: number): { day: number; kind: DayKind }[] {
  const fed = new Set(cat.fedDays);
  const monday = today - ((dateOf(today).getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => ({ day: monday + i, kind: kindOf(cat, monday + i, today, fed) }));
}
