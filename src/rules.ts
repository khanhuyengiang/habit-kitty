// ===================== Config =====================
export const CONFIG = {
  resetHour: 2,              // a "day" runs 2am -> 2am
  xpPerFeeding: 5,
  starvePenalty: 15,         // per missed day
  deathAfterMissedDays: 3,
  sitterPenaltyPerDay: 5,
  sitterMaxDays: 7,
  sitterCooldownDays: 30,    // 1 sitter trip per cat per rolling 30 days
  maxCats: 9,                // active cats, unless the player opts into unlimited
  taskMaxXp: 15,             // one-off tasks: reward and daily payout cap
  habitMaxXp: 10,            // repeating habits: reward and daily payout cap
  mindfulDefaultCooldownDays: 1,
  lowXpThreshold: 0,         // xp below this = cats distrust you
  lowXpMaxCats: 1,
  lightheartedReturns: 1,    // a runaway cat can come back this many times
} as const;

// ===================== Types =====================
export type CatMode = 'classic' | 'lighthearted';
export type CatStatus =
  | 'alive' | 'sitter' | 'dead' | 'ranAway' | 'leftForever' | 'gone' | 'shelter';

export type CatPattern = 'plain' | 'stripes' | 'patch' | 'mask';
export interface CatLook { fur: string; pattern: CatPattern }

export interface Cat {
  id: string;
  name: string;
  habit: string;
  mode: CatMode;
  status: CatStatus;
  adoptedDay: number;
  lastFedDay: number | null;
  missed: number;                  // consecutive fully missed days (0..2 while alive)
  settledDay: number;              // penalties applied up to this day index
  sitterStartDay: number | null;
  lastSitterStartDay: number | null;
  endedDay: number | null;         // day of death / running away / being left with sitter
  totalFeedings: number;
  fedDays: number[];               // every day index the cat was fed, ascending
  sitterTrips: SitterTrip[];       // oldest first; the last one is open while with the sitter
  runAwayCount: number;
  look?: CatLook;                  // chosen appearance; older saves derive one from the id
  habitDays?: number[];            // days it was done as a mindful habit, before it became a cat
}

// Days start..end-1 were spent with the sitter; end is the day the cat came home
// (or left for good), null while the trip is still going.
export interface SitterTrip {
  start: number;
  end: number | null;
}

export type TaskKind = 'task' | 'habit';

// A 'task' is one-off (done once, then it stays ticked until deleted).
// A 'habit' repeats every cooldownDays and keeps its history.
export interface MindfulTask {
  id: string;
  name: string;
  kind: TaskKind;
  xp: number;                      // tasks 1..15, habits 1..10
  cooldownDays: number;            // habits only
  lastDoneDay: number | null;
  doneDays: number[];              // every day it was done, ascending
  createdDay: number;
}

export interface AppState {
  xp: number;                      // global affection score, may be negative
  cats: Cat[];
  tasks: MindfulTask[];
  mindfulEarned?: { day: number; task: number; habit: number };   // mindful xp already paid out today
}

export type GameEvent =
  | { type: 'starved'; catId: string; missed: number }
  | { type: 'died'; catId: string }
  | { type: 'ranAway'; catId: string }
  | { type: 'leftWithSitter'; catId: string }
  | { type: 'returned'; catId: string }
  | { type: 'leftForever'; catId: string };

export type Reason =
  | 'no_such_cat' | 'no_such_task' | 'invalid_input'
  | 'cat_not_active' | 'with_sitter' | 'already_with_sitter' | 'not_with_sitter'
  | 'already_fed_today' | 'sitter_cooldown'
  | 'low_affection_cat_limit' | 'task_on_cooldown' | 'cat_limit' | 'task_already_done' | 'not_daily_habit';

// On failure the (settled) state is still returned: always persist result.state.
export type ActionResult =
  | { ok: true; state: AppState; events: GameEvent[] }
  | { ok: false; reason: Reason; state: AppState; events: GameEvent[] };

export const newState = (): AppState => ({ xp: 0, cats: [], tasks: [] });

// ===================== Time =====================
// Integer day number, with the day rolling over at resetHour (local time).
export function dayIndex(now: Date, resetHour: number = CONFIG.resetHour): number {
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (now.getHours() < resetHour ? 1 : 0),
  );
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

// Next reset moment (handy for scheduling a notification).
export function nextReset(now: Date, resetHour: number = CONFIG.resetHour): Date {
  const d = new Date(now);
  d.setHours(resetHour, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

// ===================== Levels =====================
// Level n -> n+1 costs 100*(n+1) xp. Total xp needed to reach level n = 50*n*(n+1).
export const xpToReachLevel = (n: number) => 50 * n * (n + 1);

export function levelFor(xp: number): number {
  if (xp < 100) return 0;
  let n = Math.floor((-1 + Math.sqrt(1 + xp / 12.5)) / 2);
  while (xpToReachLevel(n + 1) <= xp) n++;
  while (n > 0 && xpToReachLevel(n) > xp) n--;
  return n;
}

export function levelProgress(xp: number) {
  const level = levelFor(xp);
  return {
    level,
    xpIntoLevel: Math.max(0, xp - xpToReachLevel(level)),
    xpForNextLevel: 100 * (level + 1),
  };
}

// ===================== Settling (applying elapsed days) =====================
type Settled = { cat: Cat; xpDelta: number; events: GameEvent[] };

function settleAlive(cat: Cat, today: number): Settled {
  const c: Cat = { ...cat };
  const events: GameEvent[] = [];
  let xpDelta = 0;

  // boundary b = the 2am rollover into day b, which completes day b-1
  for (let b = cat.settledDay + 1; b <= today; b++) {
    const completed = b - 1;
    if (c.lastFedDay !== null && c.lastFedDay >= completed) continue; // was fed

    c.missed += 1;
    xpDelta -= CONFIG.starvePenalty;
    events.push({ type: 'starved', catId: c.id, missed: c.missed });

    if (c.missed >= CONFIG.deathAfterMissedDays) {
      c.endedDay = b;
      if (c.mode === 'classic') {
        c.status = 'dead';
        events.push({ type: 'died', catId: c.id });
      } else {
        c.runAwayCount += 1;
        if (c.runAwayCount <= CONFIG.lightheartedReturns) {
          c.status = 'ranAway';          // may come back
          events.push({ type: 'ranAway', catId: c.id });
        } else {
          c.status = 'leftForever';      // final
          events.push({ type: 'leftForever', catId: c.id });
        }
      }
      break;
    }
  }
  c.settledDay = today;
  return { cat: c, xpDelta, events };
}

const closeTrip = (trips: SitterTrip[], end: number): SitterTrip[] =>
  trips.map((t, i) => (i === trips.length - 1 && t.end === null ? { ...t, end } : t));

function settleSitter(cat: Cat, today: number): Settled {
  const c: Cat = { ...cat };
  const events: GameEvent[] = [];
  const start = cat.sitterStartDay as number;
  const max = CONFIG.sitterMaxDays;

  const alreadyCharged = Math.min(cat.settledDay - start, max);
  const nowCharged = Math.min(today - start, max);
  const xpDelta = -CONFIG.sitterPenaltyPerDay * (nowCharged - alreadyCharged);

  if (today - start >= max) {
    c.status = 'gone';
    c.endedDay = start + max;
    c.sitterTrips = closeTrip(c.sitterTrips, start + max);
    events.push({ type: 'leftWithSitter', catId: c.id });
  }
  c.settledDay = today;
  return { cat: c, xpDelta, events };
}

function settleCat(cat: Cat, today: number): Settled {
  if (today <= cat.settledDay) return { cat, xpDelta: 0, events: [] };
  if (cat.status === 'alive') return settleAlive(cat, today);
  if (cat.status === 'sitter') return settleSitter(cat, today);
  return { cat, xpDelta: 0, events: [] };
}

// Call on every app open (every action below also does this first). Idempotent.
export function settleAll(state: AppState, now: Date): { state: AppState; events: GameEvent[] } {
  const today = dayIndex(now);
  let xp = state.xp;
  const events: GameEvent[] = [];
  const cats = state.cats.map((cat) => {
    const r = settleCat(cat, today);
    xp += r.xpDelta;
    if (r.events.some((e) => e.type === 'died')) xp = 0;   // losing a cat resets affection to 0
    events.push(...r.events);
    return r.cat;
  });
  return { state: { ...state, xp, cats }, events };
}

// ===================== Actions =====================
function begin(state: AppState, now: Date) {
  const today = dayIndex(now);
  const { state: s, events } = settleAll(state, now);
  return { s, events, today };
}
const fail = (s: AppState, events: GameEvent[], reason: Reason): ActionResult =>
  ({ ok: false, reason, state: s, events });
const done = (s: AppState, events: GameEvent[]): ActionResult => ({ ok: true, state: s, events });
const mapCat = (s: AppState, id: string, fn: (c: Cat) => Cat): AppState =>
  ({ ...s, cats: s.cats.map((c) => (c.id === id ? fn(c) : c)) });

export const maxActiveCats = (xp: number) =>
  xp < CONFIG.lowXpThreshold ? CONFIG.lowXpMaxCats : Infinity;

export function adoptCat(
  state: AppState,
  input: { id: string; name: string; habit: string; mode?: CatMode; look?: CatLook; habitDays?: number[]; unlimited?: boolean },
  now: Date,
): ActionResult {
  const { s, events, today } = begin(state, now);
  if (!input.name.trim() || !input.habit.trim()) return fail(s, events, 'invalid_input');

  const active = s.cats.filter(
    (c) => c.status === 'alive' || c.status === 'sitter' || c.status === 'ranAway',
  ).length;
  if (active >= maxActiveCats(s.xp)) return fail(s, events, 'low_affection_cat_limit');
  if (active >= CONFIG.maxCats && !input.unlimited) return fail(s, events, 'cat_limit');

  const cat: Cat = {
    id: input.id, name: input.name.trim(), habit: input.habit.trim(),
    mode: input.mode ?? 'classic', status: 'alive',
    adoptedDay: today, lastFedDay: null, missed: 0, settledDay: today,
    sitterStartDay: null, lastSitterStartDay: null, endedDay: null, totalFeedings: 0,
    fedDays: [], sitterTrips: [], runAwayCount: 0,
    ...(input.look ? { look: input.look } : {}),
    ...(input.habitDays?.length ? { habitDays: input.habitDays } : {}),
  };
  return done({ ...s, cats: [...s.cats, cat] }, events);
}

export function feedCat(state: AppState, catId: string, now: Date): ActionResult {
  const { s, events, today } = begin(state, now);
  const cat = s.cats.find((c) => c.id === catId);
  if (!cat) return fail(s, events, 'no_such_cat');
  if (cat.status === 'ranAway') {
    const back = mapCat({ ...s, xp: s.xp + CONFIG.xpPerFeeding }, catId, (c) => ({
      ...c, status: 'alive', missed: 0, lastFedDay: today, settledDay: today,
      endedDay: null, totalFeedings: c.totalFeedings + 1, fedDays: [...c.fedDays, today],
    }));
    return done(back, [...events, { type: 'returned', catId }]);
  }
  if (cat.status === 'sitter') return fail(s, events, 'with_sitter');
  if (cat.status !== 'alive') return fail(s, events, 'cat_not_active');
  if (cat.lastFedDay === today) return fail(s, events, 'already_fed_today');

  const next = mapCat({ ...s, xp: s.xp + CONFIG.xpPerFeeding }, catId, (c) => ({
    ...c, lastFedDay: today, missed: 0, totalFeedings: c.totalFeedings + 1,
    fedDays: [...c.fedDays, today],
  }));
  return done(next, events);
}

// Give a cat back to the shelter: no penalties, but it's gone for good.
export function returnToShelter(state: AppState, catId: string, now: Date): ActionResult {
  const { s, events, today } = begin(state, now);
  const cat = s.cats.find((c) => c.id === catId);
  if (!cat) return fail(s, events, 'no_such_cat');
  if (!['alive', 'sitter', 'ranAway'].includes(cat.status)) return fail(s, events, 'cat_not_active');
  return done(
    mapCat(s, catId, (c) => ({
      ...c, status: 'shelter', endedDay: today, sitterStartDay: null, settledDay: today,
      sitterTrips: closeTrip(c.sitterTrips, today),
    })),
    events,
  );
}

export function sitterCooldownLeft(cat: Cat, today: number): number {
  if (cat.lastSitterStartDay === null) return 0;
  return Math.max(0, CONFIG.sitterCooldownDays - (today - cat.lastSitterStartDay));
}

export function startSitter(state: AppState, catId: string, now: Date): ActionResult {
  const { s, events, today } = begin(state, now);
  const cat = s.cats.find((c) => c.id === catId);
  if (!cat) return fail(s, events, 'no_such_cat');
  if (cat.status === 'sitter') return fail(s, events, 'already_with_sitter');
  if (cat.status !== 'alive') return fail(s, events, 'cat_not_active');
  if (sitterCooldownLeft(cat, today) > 0) return fail(s, events, 'sitter_cooldown');

  return done(
    mapCat(s, catId, (c) => ({
      ...c, status: 'sitter', sitterStartDay: today, lastSitterStartDay: today, settledDay: today,
      sitterTrips: [...c.sitterTrips, { start: today, end: null }],
    })),
    events,
  );
}

export function resumeCat(state: AppState, catId: string, now: Date): ActionResult {
  const { s, events, today } = begin(state, now);
  const cat = s.cats.find((c) => c.id === catId);
  if (!cat) return fail(s, events, 'no_such_cat');
  if (cat.status !== 'sitter') return fail(s, events, 'not_with_sitter');

  // hunger (cat.missed) was frozen while away, so it simply continues
  return done(
    mapCat(s, catId, (c) => ({
      ...c, status: 'alive', sitterStartDay: null, settledDay: today,
      sitterTrips: closeTrip(c.sitterTrips, today),
    })),
    events,
  );
}

export function addMindfulTask(
  state: AppState,
  input: { id: string; name: string; xp: number; kind?: TaskKind; cooldownDays?: number },
  now: Date = new Date(),
): AppState {
  const kind = input.kind ?? 'habit';
  const max = kind === 'task' ? CONFIG.taskMaxXp : CONFIG.habitMaxXp;
  const task: MindfulTask = {
    id: input.id,
    name: input.name.trim(),
    kind,
    xp: Math.min(max, Math.max(1, Math.round(input.xp))),
    cooldownDays: kind === 'task' ? 0 : Math.max(1, Math.round(input.cooldownDays ?? CONFIG.mindfulDefaultCooldownDays)),
    lastDoneDay: null,
    doneDays: [],
    createdDay: dayIndex(now),
  };
  return { ...state, tasks: [...state.tasks, task] };
}

export const removeMindfulTask = (state: AppState, taskId: string): AppState =>
  ({ ...state, tasks: state.tasks.filter((t) => t.id !== taskId) });

export function doMindfulTask(state: AppState, taskId: string, now: Date): ActionResult {
  const { s, events, today } = begin(state, now);
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task) return fail(s, events, 'no_such_task');
  if (task.kind === 'task') {
    if (task.lastDoneDay !== null) return fail(s, events, 'task_already_done');
  } else if (task.lastDoneDay !== null && today - task.lastDoneDay < task.cooldownDays) {
    return fail(s, events, 'task_on_cooldown');
  }
  // Anything can be done, but only the first N xp of each kind pays out per day.
  const cap = task.kind === 'task' ? CONFIG.taskMaxXp : CONFIG.habitMaxXp;
  const e = s.mindfulEarned?.day === today ? s.mindfulEarned : undefined;
  const earned = { task: e?.task ?? 0, habit: e?.habit ?? 0 };
  const paid = Math.max(0, Math.min(task.xp, cap - earned[task.kind]));
  earned[task.kind] += paid;
  return done(
    {
      ...s,
      xp: s.xp + paid,
      mindfulEarned: { day: today, ...earned },
      tasks: s.tasks.map((t) => (t.id === taskId
        ? { ...t, lastDoneDay: today, doneDays: [...t.doneDays, today] } : t)),
    },
    events,
  );
}

// Turn a daily habit into a cat. The cat keeps the habit's history (as habitDays) and the habit is removed.
export function habitToCat(
  state: AppState,
  taskId: string,
  input: { id: string; name: string; mode?: CatMode; look?: CatLook; unlimited?: boolean },
  now: Date,
): ActionResult {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return fail(state, [], 'no_such_task');
  if (task.kind !== 'habit' || task.cooldownDays !== 1) return fail(state, [], 'not_daily_habit');
  const r = adoptCat(state, { ...input, habit: task.name, habitDays: task.doneDays }, now);
  if (!r.ok) return r;
  return done(removeMindfulTask(r.state, taskId), r.events);
}

// ===================== Selectors for the UI =====================
export type Hunger = 'fed' | 'peckish' | 'hungry' | 'starving';
// Accurate right after settleAll.
export function hunger(cat: Cat, today: number): Hunger {
  if (cat.missed >= 2) return 'starving';
  if (cat.missed === 1) return 'hungry';
  return cat.lastFedDay === today ? 'fed' : 'peckish';
}
export const activeCats = (s: AppState) => s.cats.filter((c) => c.status === 'alive' || c.status === 'sitter');
export const graveyard = (s: AppState) => s.cats.filter((c) => c.status === 'dead');
export const runaways = (s: AppState) => s.cats.filter((c) => c.status === 'ranAway');
export const leftForever = (s: AppState) => s.cats.filter((c) => c.status === 'leftForever');
export const shelterCats = (s: AppState) => s.cats.filter((c) => c.status === 'shelter');
export const leftWithSitter = (s: AppState) => s.cats.filter((c) => c.status === 'gone');