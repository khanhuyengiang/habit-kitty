// Kitty Litterbox's notifications: decides what each upcoming one says and when. Pure, no platform code (./notify.ts
// schedules what this plans).
//
// For each chore that has reminders on, in the next two weeks:
//   the heads-up   once, `lead` days before it is due (when it has a heads-up)
//   the due day    once
//   after that     again every `repeat` (a day, a week...) until it is done
// A snoozed chore is quiet until its day, then speaks up (even when no repeat falls on that day). Everything comes at the one
// time of day set for Litterbox. Chores that fall at the same moment share one notification.
import { dateOf } from '../shared/dates.ts';
import { LITTERBOX_ID_BASE } from '../shared/notifications.ts';
import { gridDay, dueOf, isDay, parseDay, todayNum, whenText, type Chore, type LitterData } from './model.ts';

export interface PlannedAlert {
  id: number;                        // LITTERBOX_ID_BASE plus the minute stamp of `at`, unique within a plan
  at: Date;                          // local time
  title: string;
  body: string;
  chores: string[];                  // the chores it is about
}

export const ALERT_DAYS = 14;        // how far ahead notifications are scheduled; every app open tops this up
export const TITLE = 'Kitty Litterbox';

const localAt = (day: number, hour: number, minute: number) => { const d = dateOf(day); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0, 0); };

// What a chore says on `day`, which is before its due day, on it, or after it.
export function alertText(c: Pick<Chore, 'name'>, due: number, day: number): string {
  return day < due ? `${c.name} is due ${whenText(due, day)}` : day === due ? `${c.name} is due today` : `${c.name} is ${whenText(due, day)}`;
}

// The days a chore speaks up on, from `today` to `last`.
export function alertDays(c: Chore, today: number, last: number): number[] {
  const due = dueOf(c), days = new Set<number>([due]);
  if (c.lead > 0) days.add(due - c.lead);
  if (c.repeat) for (let k = 1; k < 3000; k++) { const d = gridDay(due, c.repeat, k); if (d > last) break; days.add(d); }
  const snoozed = isDay(c.snooze) ? parseDay(c.snooze) : null;
  if (snoozed !== null && snoozed >= due - c.lead) days.add(snoozed);   // it speaks up again the day the snooze ends
  return [...days].filter((d) => d >= today && d <= last && (snoozed === null || d >= snoozed)).sort((a, b) => a - b);
}

const nameList = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names.length - 2} more`);

export function planAlerts(d: LitterData, now: Date, days: number = ALERT_DAYS): PlannedAlert[] {
  if (!d.alerts.on) return [];
  const today = todayNum(now), { hour, minute } = d.alerts;
  const byTime = new Map<number, { at: Date; texts: string[]; names: string[] }>();
  for (const c of d.chores) {
    if (!c.remind) continue;
    const due = dueOf(c);
    for (const day of alertDays(c, today, today + days)) {
      const at = localAt(day, hour, minute);
      if (at.getTime() <= now.getTime()) continue;
      const slot = byTime.get(at.getTime()) ?? { at, texts: [], names: [] };
      slot.texts.push(alertText(c, due, day));
      slot.names.push(c.name);
      byTime.set(at.getTime(), slot);
    }
  }
  const used = new Set<number>();
  return [...byTime.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).map((s) => {
    let id = LITTERBOX_ID_BASE + Math.floor(s.at.getTime() / 60_000);
    while (used.has(id)) id++;
    used.add(id);
    const body = s.texts.length === 1 ? s.texts[0] : `${s.texts.length} chores need you: ${nameList(s.names)}.`;
    return { id, at: s.at, title: TITLE, body, chores: s.names };
  });
}

