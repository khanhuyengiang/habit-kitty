// Daily feeding reminders: decides what each upcoming reminder says. Pure, no platform code.
import { CONFIG, dayIndex, type AppState, type Cat } from './rules.ts';
import type { Face } from './pixelcat.ts';

export type LastCall = 'off' | 'gentle' | 'insistent';
export interface CatAlarm { hour: number; minute: number }

export interface ReminderSettings {
  enabled: boolean;                   // the daily reminder
  hour: number;                       // local time of the daily reminder
  minute: number;
  catAlarms?: Record<string, CatAlarm>;   // a feeding alarm per kitty, by cat id
  lastCall?: LastCall;                // extra alerts while a kitty is still unfed as the day runs out
  lastFired?: number;                 // id of the last reminder the web page showed (de-duplicates)
  picks?: Record<string, string>;     // fire day index -> the hungry cat chosen for it (kept so replanning is stable)
}

export interface PlannedReminder {
  id: number;                         // minute stamp of `at`, unique within a plan
  at: Date;                           // local time
  title: string;
  body: string;
  catId?: string;                     // the hungry cat named in the message
  face: Face;                         // how that cat looks when the reminder goes out (the notification icon)
}

export const REMINDER_DAYS = 14;      // how far ahead reminders are scheduled; every app open tops this up
export const defaultReminder = (): ReminderSettings => ({ enabled: false, hour: 18, minute: 0 });

// Minutes before the day ends (CONFIG.resetHour) at which a last-call alert goes out.
export const LAST_CALL_MINUTES: Record<LastCall, number[]> = { off: [], gentle: [180], insistent: [180, 60, 15] };

export const anyReminder = (r: ReminderSettings) => r.enabled || (r.lastCall ?? 'off') !== 'off' || Object.keys(r.catAlarms ?? {}).length > 0;

export const HAPPY_BODY = 'All cats are fed and happy! Visit and play with them!';

// Cats you can feed right now. Cats with the sitter or on the run aren't hungry for you.
const feedable = (s: AppState) => s.cats.filter((c) => c.status === 'alive');

// Days the cat will have gone without a meal by the time a reminder fires on `fireDay`, if nobody feeds it before then.
export function missedBy(c: Cat, fireDay: number, today: number): number {
  const ahead = Math.max(0, fireDay - today);
  return Math.min(2, c.lastFedDay === today ? Math.max(0, ahead - 1) : c.missed + ahead);
}
const faceFor = (missed: number): Face => (missed >= 2 ? 'starving' : missed === 1 ? 'sad' : 'open');

export function hungryBody(c: Cat, missed: number): string {
  if (missed >= 2) return `${c.name} is starving! Do "${c.habit}" and feed them today, or you may lose them.`;
  if (missed === 1) return `${c.name} missed yesterday and looks sad. Do "${c.habit}", then feed them.`;
  return `${c.name} is hungry! Have you done "${c.habit}" yet?`;
}

const nameList = (cats: Cat[]) =>
  cats.length <= 2 ? cats.map((c) => c.name).join(' and ') : `${cats[0].name}, ${cats[1].name} and ${cats.length - 2} more`;

function lastCallBody(cats: Cat[], minutes: number): string {
  const names = nameList(cats);
  const are = cats.length === 1 ? 'is' : 'are';
  if (minutes >= 120) return `${names} ${are} still waiting to be fed. The day ends in ${Math.round(minutes / 60)} hours.`;
  if (minutes >= 45) return `1 hour left! ${names} ${are} still hungry.`;
  return `Last call! ${names} will miss today's meal in ${minutes} minutes.`;
}

export function planReminders(
  state: AppState,
  settings: ReminderSettings,
  now: Date,
  days: number = REMINDER_DAYS,
  random: () => number = Math.random,
): { plan: PlannedReminder[]; picks: Record<string, string> } {
  const cats = feedable(state);
  const picks: Record<string, string> = {};
  const raw: Omit<PlannedReminder, 'id'>[] = [];
  if (!cats.length) return { plan: [], picks };

  const today = dayIndex(now);
  // Only the current game day has real feeding data. Later days start with everyone hungry.
  const unfedOn = (fireDay: number) => (fireDay === today ? cats.filter((c) => c.lastFedDay !== today) : cats);
  const future = (at: Date) => at.getTime() > now.getTime();

  let prev: string | undefined;
  for (let i = 0; i <= days; i++) {
    const date = (h: number, m: number, plus = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + plus, h, m, 0, 0);

    if (settings.enabled) {
      const at = date(settings.hour, settings.minute);
      if (future(at)) {
        const fireDay = dayIndex(at);
        const unfed = unfedOn(fireDay);
        if (!unfed.length) {
          raw.push({ at, title: 'Habit Kitty', body: HAPPY_BODY, catId: cats[0].id, face: 'happy' });
          prev = undefined;
        } else {
          const kept = settings.picks?.[fireDay];
          let pick = unfed.find((c) => c.id === kept);
          if (!pick) {
            const fresh = unfed.filter((c) => c.id !== prev);
            const pool = fresh.length ? fresh : unfed;
            pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
          }
          picks[fireDay] = pick.id;
          prev = pick.id;
          const missed = missedBy(pick, fireDay, today);
          raw.push({ at, title: 'Habit Kitty', body: hungryBody(pick, missed), catId: pick.id, face: faceFor(missed) });
        }
      }
    }

    for (const c of cats) {
      const a = settings.catAlarms?.[c.id];
      if (!a) continue;
      const at = date(a.hour, a.minute);
      if (!future(at)) continue;
      if (dayIndex(at) === today && c.lastFedDay === today) continue;
      raw.push({ at, title: 'Habit Kitty', body: `Time to feed ${c.name}! Do "${c.habit}" first.`, catId: c.id, face: faceFor(missedBy(c, dayIndex(at), today)) });
    }

    // The game day that starts on today's date + i ends at resetHour the next morning.
    const lastCall = LAST_CALL_MINUTES[settings.lastCall ?? 'off'];
    if (lastCall.length) {
      const fireDay = dayIndex(date(12, 0));
      const unfed = unfedOn(fireDay);
      const end = date(CONFIG.resetHour, 0, 1);
      for (const minutes of lastCall) {
        const at = new Date(end.getTime() - minutes * 60_000);
        if (unfed.length && future(at)) {
          const missed = missedBy(unfed[0], fireDay, today);
          raw.push({ at, title: 'Habit Kitty', body: lastCallBody(unfed, minutes), catId: unfed[0].id, face: missed >= 2 ? 'starving' : 'sad' });
        }
      }
    }
  }

  raw.sort((a, b) => a.at.getTime() - b.at.getTime());
  const used = new Set<number>();
  const plan = raw.map((r) => {
    let id = Math.floor(r.at.getTime() / 60_000);
    while (used.has(id)) id++;
    used.add(id);
    return { ...r, id };
  });
  return { plan, picks };
}
