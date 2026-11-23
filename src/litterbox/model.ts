// Kitty Litterbox's data and every rule it follows, with no screen and no storage: chores that come back now and then
// ("change the bedsheet every 2 weeks", "replace the toothbrush every 6 months"), when each is due, and what doing,
// snoozing, delaying or skipping one does. ./data.ts keeps it on the device, ./app.ts draws it.
//
// Days are whole local calendar days. In the data they are "YYYY-MM-DD"; in the rules below they are day numbers
// (days since 1970-01-01, see shared/dates.ts), so adding days never meets a clock change.
//
// A chore's due date comes from a row of dates (its "grid"): the anchor, then the anchor plus one interval, plus two...
//   Fixed schedule    the anchor stays where it is, so doing a chore late never moves the next one ("every other Thursday").
//   Rolling schedule  doing it makes today the new anchor, so the next one is an interval after you did it.
// A fixed chore that is several dates behind owes one Done for the first of them, and then (when it piles up) for each of
// the others; when it does not pile up, one Done goes on to the first date after today.
// Each grid date is moved onto the preferred weekday or day of the month: with "remind me early" to the one before it,
// without to the one after it. `cycle` says which grid date is the open one; `shift` is where Delay put it.
import { dateOf, dayOf, localDateKey, two } from '../shared/dates.ts';
import { newId } from '../shared/id.ts';
import { CAT_COLORS, type CatColor } from '../shopping/model.ts';
export { CAT_COLORS, type CatColor, newId };

export type Unit = 'day' | 'week' | 'month' | 'year';
export interface Every { n: number; unit: Unit }
// A weekday (0 = Monday ... 6 = Sunday) or a day of the month (1..31, 0 = the last day, which a short month clamps to).
export type Prefer = { weekday: number } | { dom: number } | null;
export interface Entry { day: string; kind: 'done' | 'skip' }
export interface Chore {
  id: string; name: string; cat: string; note: string;
  every: Every; prefer: Prefer; early: boolean; rolling: boolean;
  pile: boolean;                 // fixed schedule only: every missed date stays owed (laundry) instead of one Done clearing them all
  lead: number;                  // the heads-up: it is shown as coming up this many days before it is due
  remind: boolean;               // notifications for this chore (when they are on at all, see LitterData.alerts)
  repeat: Every | null;          // after the due day, remind again this often until it is done (null: once)
  anchor: string; cycle: number; shift: string;   // see the top; shift is '' unless it was delayed
  snooze: string;                // quiet until this day ('' not snoozed)
  log: Entry[];                  // the newest last
}
export interface Cat { id: string; name: string; icon: string; color: CatColor }
// The notifications as a whole: on or off, and the time of day they come at.
export interface Alerts { on: boolean; hour: number; minute: number }
export interface LitterData { v: 1; chores: Chore[]; cats: Cat[]; alerts: Alerts }

export const OTHER = 'other';
export const LIMITS = { chores: 500, cats: 30, name: 60, note: 1000, log: 40, every: 999 };
const DEFAULT_CATS: [string, string, string, CatColor][] = [
  ['bedroom', 'Bedroom', 'night', 'lavender'], ['kitchen', 'Kitchen', 'coffee', 'peach'], ['bathroom', 'Bathroom', 'wave', 'blue'],
  ['home', 'Home', 'home', 'mint'], ['health', 'Health', 'heart', 'pink'], ['car', 'Car', 'car', 'blue'],
  ['digital', 'Digital', 'laptop', 'lavender'], ['admin', 'Admin', 'book', 'lemon'], [OTHER, 'Other', 'bag', 'lavender'],
];
export const defaultCats = (): Cat[] => DEFAULT_CATS.map(([id, name, icon, color]) => ({ id, name, icon, color }));
export const defaultAlerts = (): Alerts => ({ on: false, hour: 9, minute: 0 });
export const emptyData = (): LitterData => ({ v: 1, chores: [], cats: defaultCats(), alerts: defaultAlerts() });
export const clone = (d: LitterData): LitterData => structuredClone(d);
export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);

// =================== days ===================
export const todayNum = (now: number | Date = Date.now()): number => { const d = new Date(now); return dayOf(d.getFullYear(), d.getMonth(), d.getDate()); };
export const dayKey = (n: number) => { const d = dateOf(n); return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`; };
export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayKey(parseDay(s)) === s;
export const parseDay = (k: string) => dayOf(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
export { localDateKey };
export const weekdayOf = (n: number) => (((n + 3) % 7) + 7) % 7;            // 1 Jan 1970 was a Thursday
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const addMonths = (n: number, months: number) => {
  const d = dateOf(n), t = d.getUTCFullYear() * 12 + d.getUTCMonth() + months, y = Math.floor(t / 12), m = ((t % 12) + 12) % 12;
  return dayOf(y, m, Math.min(d.getUTCDate(), daysIn(y, m)));
};
const mondayOf = (n: number) => n - weekdayOf(n);

// The k-th date of a row that starts at `anchor`. Always counted from the anchor, so a 31st that fell on a short month comes back to the 31st.
export const gridDay = (anchor: number, e: Every, k: number): number =>
  e.unit === 'day' ? anchor + e.n * k : e.unit === 'week' ? anchor + 7 * e.n * k : addMonths(anchor, (e.unit === 'year' ? 12 : 1) * e.n * k);

const domIn = (dom: number, y: number, m: number) => (dom === 0 ? daysIn(y, m) : Math.min(dom, daysIn(y, m)));
// The preferred day on or before `n` (before = true) or on or after it.
export function snap(n: number, p: Prefer, before: boolean): number {
  if (!p) return n;
  if ('weekday' in p) return before ? n - ((weekdayOf(n) - p.weekday + 7) % 7) : n + ((p.weekday - weekdayOf(n) + 7) % 7);
  const d = dateOf(n), t = d.getUTCFullYear() * 12 + d.getUTCMonth();
  const hits = [-1, 0, 1].map((o) => { const y = Math.floor((t + o) / 12), m = (((t + o) % 12) + 12) % 12; return dayOf(y, m, domIn(p.dom, y, m)); });
  return before ? Math.max(...hits.filter((h) => h <= n)) : Math.min(...hits.filter((h) => h >= n));
}
// The first preferred day strictly after `n` (a delayed chore comes back on the next one), or the next day with no preference.
export const nextPreferred = (n: number, p: Prefer) => snap(n + 1, p, false);

// =================== due dates ===================
// The due date of grid date k: the grid date moved onto the preferred day. It is never on or before the grid date before it
// (a short interval with "early" could otherwise land before the last time you did it); then it goes the other way.
export function dueOfCycle(c: Chore, k: number): number {
  const a = parseDay(c.anchor), raw = gridDay(a, c.every, k);
  const s = snap(raw, c.prefer, c.early);
  return k > 0 && s <= gridDay(a, c.every, k - 1) ? snap(raw, c.prefer, false) : s;
}
export const dueOf = (c: Chore): number => (isDay(c.shift) ? parseDay(c.shift) : dueOfCycle(c, c.cycle));
// The first cycle after the open one that is due after `after`.
function cycleAfter(c: Chore, after: number): number {
  for (let k = c.cycle + 1; k < c.cycle + 20_000; k++) if (dueOfCycle(c, k) > after) return k;
  return c.cycle + 1;
}

// =================== state ===================
export type Status = 'overdue' | 'due' | 'soon' | 'resting';
export interface View { chore: Chore; due: number; away: number; status: Status; snoozed: boolean; behind: number }
export const statusOf = (c: Chore, today: number): View => {
  const due = dueOf(c), away = due - today;
  const status: Status = away < 0 ? 'overdue' : away === 0 ? 'due' : away <= c.lead ? 'soon' : 'resting';
  return { chore: c, due, away, status, snoozed: isDay(c.snooze) && parseDay(c.snooze) > today && status !== 'resting', behind: behindBy(c, today) };
};
// How many dates a chore that piles up has not been done for (the open one and every later one that has come): 0 when it does not pile up.
export function behindBy(c: Chore, today: number): number {
  if (!c.pile || c.rolling) return 0;
  let n = dueOf(c) <= today ? 1 : 0;
  if (!n) return 0;
  for (let k = c.cycle + 1; k < c.cycle + 500 && dueOfCycle(c, k) <= today; k++) n++;
  return n;
}
export const views = (d: LitterData, today: number): View[] => d.chores.map((c) => statusOf(c, today));

// How far ahead the heads-up starts, unless the chore says otherwise: a little for short intervals, longer for long ones.
export const LEADS = [0, 1, 2, 3, 7, 14] as const;
export function defaultLead(e: Every): number {
  const days = approxDays(e);
  return days <= 1 ? 0 : days <= 7 ? 1 : days <= 31 ? 3 : days <= 100 ? 7 : 14;
}
// How often a chore nags once it is due, unless it says otherwise: every day for chores that come back within a month, else every week.
export const defaultRepeat = (e: Every): Every => (approxDays(e) <= 31 ? { n: 1, unit: 'day' } : { n: 1, unit: 'week' });
export const approxDays = (e: Every) => Math.round(e.n * (e.unit === 'day' ? 1 : e.unit === 'week' ? 7 : e.unit === 'month' ? 30.44 : 365.25));

// =================== words ===================
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const weekdayName = (i: number) => WEEKDAYS[i] ?? '';
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
export function everyText(e: Every): string {
  const u = e.unit;
  return e.n === 1 ? `every ${u}` : `every ${e.n} ${u}s`;
}
export const preferText = (p: Prefer): string => !p ? '' : 'weekday' in p ? `on ${WEEKDAYS[p.weekday]}s` : p.dom === 0 ? 'on the last day' : `on the ${ordinal(p.dom)}`;
export const scheduleText = (c: Pick<Chore, 'every' | 'prefer'>) => [everyText(c.every), preferText(c.prefer)].filter(Boolean).join(' ');

// "this weekend", "next Friday", "in 2 months": when a due date is, from today.
export function whenText(due: number, today: number): string {
  const away = due - today;
  if (away < 0) {
    const n = -away;
    return n === 1 ? '1 day overdue' : n < 14 ? `${n} days overdue` : n < 60 ? `${Math.round(n / 7)} weeks overdue` : `${Math.round(n / 30.44)} months overdue`;
  }
  if (away === 0) return 'today';
  if (away === 1) return 'tomorrow';
  const wd = weekdayOf(due), weeks = (mondayOf(due) - mondayOf(today)) / 7;
  if (wd >= 5 && weeks <= 1) return weeks === 0 ? 'this weekend' : 'next weekend';
  if (weeks === 0) return `on ${WEEKDAYS[wd]}`;
  if (weeks === 1) return `next ${WEEKDAYS[wd]}`;
  if (away < 60) return `in ${Math.round(away / 7)} weeks`;
  if (away < 540) { const m = Math.round(away / 30.44); return `in ${m} ${m === 1 ? 'month' : 'months'}`; }
  const y = Math.round(away / 365.25);
  return `in ${y} ${y === 1 ? 'year' : 'years'}`;
}
// "Change bedsheet" + "this weekend" -> the line the list shows.
export const dueLine = (v: View, today: number): string => (v.status === 'overdue' ? whenText(v.due, today) : `due ${whenText(v.due, today)}`);
export const agoText = (day: string, today: number) => { const n = today - parseDay(day); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n < 14 ? `${n} days ago` : n < 60 ? `${Math.round(n / 7)} weeks ago` : `${Math.round(n / 30.44)} months ago`; };
export const lastDone = (c: Chore): string => [...c.log].reverse().find((e) => e.kind === 'done')?.day ?? '';

// =================== changing a chore ===================
const swap = (d: LitterData, id: string, f: (c: Chore) => Chore): LitterData =>
  d.chores.some((c) => c.id === id) ? { ...d, chores: d.chores.map((c) => (c.id === id ? f(c) : c)) } : d;
const logged = (c: Chore, day: number, kind: Entry['kind']): Entry[] => [...c.log, { day: dayKey(day), kind }].slice(-LIMITS.log);
export const choreOf = (d: Pick<LitterData, 'chores'>, id: string) => d.chores.find((c) => c.id === id);

// Done: on `on` (today or an earlier day). A fixed chore goes on to the next grid date after that; a rolling one counts a
// whole interval from it. Doing a chore that is not due yet counts for the open cycle, so it rests until the next one.
export function markDone(d: LitterData, id: string, today: number, on = today): LitterData {
  const day = Math.min(on, today);
  return swap(d, id, (c) => {
    const base = { ...c, snooze: '', shift: '', log: logged(c, day, 'done') };
    return c.rolling ? { ...base, anchor: dayKey(day), cycle: 1 } : { ...base, cycle: c.pile ? c.cycle + 1 : cycleAfter(c, day) };
  });
}
// Skip this cycle: it waits for the next one (a fixed chore for its next grid date, a rolling one an interval after this due date).
export function skip(d: LitterData, id: string, today: number): LitterData {
  return swap(d, id, (c) => {
    const base = { ...c, snooze: '', shift: '', log: logged(c, today, 'skip') };
    return c.rolling ? { ...base, anchor: dayKey(Math.max(dueOf(c), today)), cycle: 1 } : { ...base, cycle: c.pile ? c.cycle + 1 : cycleAfter(c, today) };
  });
}
// What Skip would do, to tell the user before they press it.
export const skipTarget = (c: Chore, today: number): number => dueOf(skip({ v: 1, chores: [c], cats: [] }, c.id, today).chores[0]);
// Delay: this one moves to the next preferred day after it (or after today). The grid stays where it is.
export const delayTarget = (c: Chore, today: number): number => nextPreferred(Math.max(dueOf(c), today), c.prefer);
export const delay = (d: LitterData, id: string, today: number): LitterData => swap(d, id, (c) => ({ ...c, shift: dayKey(delayTarget(c, today)), snooze: '' }));
// Snooze: quiet until `until`; when it is due then, it speaks up again. The due date stays as it is.
export const snooze = (d: LitterData, id: string, until: number): LitterData => swap(d, id, (c) => ({ ...c, snooze: dayKey(until) }));
export const unsnooze = (d: LitterData, id: string): LitterData => swap(d, id, (c) => ({ ...c, snooze: '' }));
export const removeChore = (d: LitterData, id: string): LitterData => ({ ...d, chores: d.chores.filter((c) => c.id !== id) });

export interface ChoreEdit {
  name: string; cat: string; note: string; every: Every; prefer: Prefer; early: boolean; rolling: boolean; pile: boolean; lead: number;
  remind: boolean; repeat: Every | null;
  next: number;                  // the day it is next due (a new chore: the first time)
}
const cleanEvery = (e: Every): Every => ({ n: Math.min(LIMITS.every, Math.max(1, Math.round(e.n) || 1)), unit: (['day', 'week', 'month', 'year'] as const).includes(e.unit) ? e.unit : 'week' });
const cleanPrefer = (p: Prefer): Prefer => {
  if (p && 'weekday' in p) return Number.isInteger(p.weekday) && p.weekday >= 0 && p.weekday <= 6 ? { weekday: p.weekday } : null;
  if (p && 'dom' in p) return Number.isInteger(p.dom) && p.dom >= 0 && p.dom <= 31 ? { dom: p.dom } : null;
  return null;
};
const catIn = (d: Pick<LitterData, 'cats'>, id: string) => (d.cats.some((c) => c.id === id) ? id : OTHER);
const fields = (d: LitterData, e: ChoreEdit) => ({
  name: cleanName(e.name), cat: catIn(d, e.cat), note: e.note.slice(0, LIMITS.note), every: cleanEvery(e.every), prefer: cleanPrefer(e.prefer),
  early: !!e.early, rolling: !!e.rolling, pile: !!e.pile, lead: Math.min(60, Math.max(0, Math.round(e.lead) || 0)),
  remind: e.remind !== false, repeat: e.repeat ? cleanEvery(e.repeat) : null,
});

export function addChore(d: LitterData, e: ChoreEdit): { data: LitterData; id: string } | null {
  const f = fields(d, e);
  if (!f.name || d.chores.length >= LIMITS.chores) return null;
  const c: Chore = { id: newId(), ...f, anchor: dayKey(e.next), cycle: 0, shift: '', snooze: '', log: [] };
  return { data: { ...d, chores: [...d.chores, c] }, id: c.id };
}
// Changes a chore. Its history stays. When the schedule or the next due day changed, the row of dates starts again from the next due day.
export function editChore(d: LitterData, id: string, e: ChoreEdit, today: number): LitterData {
  const f = fields(d, e);
  return f.name ? swap(d, id, (c) => {
    const same = JSON.stringify([c.every, c.prefer, c.early, c.rolling]) === JSON.stringify([f.every, f.prefer, f.early, f.rolling]);
    const moved = e.next !== dueOf(c);
    return same && !moved ? { ...c, ...f } : { ...c, ...f, anchor: dayKey(e.next), cycle: 0, shift: '' };
  }) : d;
}
// When a chore would be due if it were counted from the day it was last done, with this schedule: what Edit suggests as the next due
// day after how often a chore comes (or its preferred day) was changed. Never on or before that day.
export function nextFromLast(e: Pick<ChoreEdit, 'every' | 'prefer' | 'early'>, last: number): number {
  const c = { every: cleanEvery(e.every), prefer: cleanPrefer(e.prefer), early: !!e.early, anchor: dayKey(last) } as Chore;
  return dueOfCycle(c, 1);
}
// The first day a new chore could be due: the preferred day on or after today.
export const firstDue = (today: number, p: Prefer) => snap(today, cleanPrefer(p), false);

// The notifications: on or off, and the time they come at.
export const setAlerts = (d: LitterData, a: Partial<Alerts>): LitterData => {
  const x = { ...d.alerts, ...a };
  return { ...d, alerts: { on: !!x.on, hour: Math.min(23, Math.max(0, Math.round(x.hour) || 0)), minute: Math.min(59, Math.max(0, Math.round(x.minute) || 0)) } };
};

// =================== categories ===================
export const catOf = (d: Pick<LitterData, 'cats'>, id: string) => d.cats.find((c) => c.id === id);
export const catName = (d: Pick<LitterData, 'cats'>, id: string) => catOf(d, id)?.name ?? 'Other';
export const catNameTaken = (d: LitterData, name: string, id: string | null) => d.cats.some((c) => c.id !== id && c.name.toLowerCase() === cleanName(name).toLowerCase());
export function saveCat(d: LitterData, id: string | null, e: { name: string; icon: string; color: string }): { data: LitterData; id: string } | null {
  const name = cleanName(e.name);
  if (!name || catNameTaken(d, name, id) || (!id && d.cats.length >= LIMITS.cats)) return null;
  const icon = /^[a-z0-9-]{1,20}$/.test(e.icon) ? e.icon : 'bag';
  const color = ((CAT_COLORS as readonly string[]).includes(e.color) ? e.color : 'lavender') as CatColor;
  if (id) return catOf(d, id) ? { data: { ...d, cats: d.cats.map((c) => (c.id === id ? { ...c, name, icon, color } : c)) }, id } : null;
  const made: Cat = { id: newId(), name, icon, color }, at = d.cats.findIndex((c) => c.id === OTHER);
  const cats = [...d.cats];
  cats.splice(at < 0 ? cats.length : at, 0, made);
  return { data: { ...d, cats }, id: made.id };
}
// Deletes a category (not Other): its chores go into Other.
export const deleteCat = (d: LitterData, id: string): LitterData => id === OTHER || !catOf(d, id) ? d
  : { ...d, cats: d.cats.filter((c) => c.id !== id), chores: d.chores.map((c) => (c.cat === id ? { ...c, cat: OTHER } : c)) };

// =================== sorting, grouping, filtering ===================
export type Arrange = 'urgency' | 'category' | 'frequency';
export type StatusFilter = 'all' | 'now' | 'coming' | 'resting';
export interface Filter { cat: string; status: StatusFilter }
export const noFilter: Filter = { cat: '', status: 'all' };

const rank = (v: View) => (v.snoozed ? 2 : v.status === 'overdue' || v.status === 'due' ? 0 : v.status === 'soon' ? 1 : 3);
export const byUrgency = (a: View, b: View) => rank(a) - rank(b) || a.due - b.due || a.chore.name.localeCompare(b.chore.name);
export const passes = (v: View, f: Filter) =>
  (!f.cat || v.chore.cat === f.cat) && (f.status === 'all' || (f.status === 'now' ? v.status === 'overdue' || v.status === 'due' : f.status === 'coming' ? v.status === 'soon' : v.status === 'resting'));

export const BANDS: [string, number][] = [['Every week or less', 7], ['Every couple of weeks', 20], ['Monthly', 45], ['Every few months', 130], ['Twice a year', 250], ['Yearly or longer', Infinity]];
export const bandOf = (e: Every): string => BANDS.find(([, max]) => approxDays(e) <= max)![0];

export interface Group { key: string; title: string; cat?: Cat; items: View[] }
// The chores that pass the filter, in groups. Urgency is one group per state; the others follow the categories' and bands' order.
export function arrange(d: LitterData, today: number, how: Arrange, f: Filter): Group[] {
  const all = views(d, today).filter((v) => passes(v, f)).sort(byUrgency);
  if (how === 'category') {
    return d.cats.map((c) => ({ key: c.id, title: c.name, cat: c, items: all.filter((v) => v.chore.cat === c.id) })).filter((g) => g.items.length);
  }
  if (how === 'frequency') {
    return BANDS.map(([title]) => ({ key: title, title, items: all.filter((v) => bandOf(v.chore.every) === title) })).filter((g) => g.items.length);
  }
  const part = (title: string, test: (v: View) => boolean): Group => ({ key: title, title, items: all.filter(test) });
  return [part('Due now', (v) => !v.snoozed && (v.status === 'overdue' || v.status === 'due')), part('Coming up', (v) => !v.snoozed && v.status === 'soon'),
    part('Snoozed', (v) => v.snoozed), part('Resting', (v) => v.status === 'resting')].filter((g) => g.items.length);
}
// "2 due · 3 coming up", for under the title.
export function summary(d: LitterData, today: number): string {
  const vs = views(d, today);
  const now = vs.filter((v) => !v.snoozed && (v.status === 'overdue' || v.status === 'due')).length, soon = vs.filter((v) => !v.snoozed && v.status === 'soon').length;
  return [now ? `${now} due` : '', soon ? `${soon} coming up` : ''].filter(Boolean).join(' · ') || (vs.length ? 'All caught up' : '');
}

// =================== loading ===================
const str = (v: unknown, max = LIMITS.name) => (typeof v === 'string' ? v.slice(0, max) : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const int = (v: unknown, max: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : min);

// Whatever was read from a file or a backup, made safe: anything unusable is dropped or put right.
export function sanitize(raw: unknown): LitterData {
  const r = obj(raw), out = emptyData();
  const cats: Cat[] = [], ids = new Set<string>();
  for (const c of arr(r.cats).slice(0, LIMITS.cats).map(obj)) {
    const id = str(c.id, 20), name = cleanName(str(c.name));
    if (!id || !name || ids.has(id)) continue;
    ids.add(id);
    cats.push({ id, name, icon: /^[a-z0-9-]{1,20}$/.test(str(c.icon)) ? str(c.icon) : 'bag', color: (CAT_COLORS as readonly string[]).includes(str(c.color)) ? (str(c.color) as CatColor) : 'lavender' });
  }
  if (cats.length) out.cats = cats;
  if (!out.cats.some((c) => c.id === OTHER)) out.cats.push(defaultCats().find((c) => c.id === OTHER)!);
  const al = obj(r.alerts);
  out.alerts = { on: al.on === true, hour: int(al.hour, 23), minute: int(al.minute, 59) };
  if (!('hour' in al)) out.alerts = { ...out.alerts, hour: defaultAlerts().hour };
  const seen = new Set<string>();
  for (const c of arr(r.chores).slice(0, LIMITS.chores).map(obj)) {
    const id = str(c.id, 40), name = cleanName(str(c.name));
    if (!id || !name || seen.has(id) || !isDay(c.anchor)) continue;
    seen.add(id);
    const ev = obj(c.every), unit = (['day', 'week', 'month', 'year'] as const).find((u) => u === ev.unit) ?? 'week';
    const every = cleanEvery({ n: typeof ev.n === 'number' ? ev.n : 1, unit });
    out.chores.push({
      id, name, cat: catIn(out, str(c.cat, 20)), note: str(c.note, LIMITS.note), every, prefer: cleanPrefer(obj(c.prefer) as Prefer) ?? null,
      early: c.early === true, rolling: c.rolling === true, pile: c.pile === true, lead: int(c.lead, 60),
      remind: c.remind !== false, repeat: c.repeat === null ? null : isRec(c.repeat) ? cleanEvery({ n: Number(c.repeat.n) || 1, unit: c.repeat.unit as Unit }) : defaultRepeat(every), anchor: c.anchor, cycle: int(c.cycle, 100_000),
      shift: isDay(c.shift) ? c.shift : '', snooze: isDay(c.snooze) ? c.snooze : '',
      log: arr(c.log).slice(-LIMITS.log).map(obj).filter((e) => isDay(e.day) && (e.kind === 'done' || e.kind === 'skip')).map((e) => ({ day: e.day as string, kind: e.kind as Entry['kind'] })),
    });
  }
  return out;
}
