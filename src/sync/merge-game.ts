// Habit Kitty's save, merged from two devices. What is merged is the record: who was adopted, every day each kitty was
// fed, every day each stray or treat was done, the sitter trips, the kitties given back to the shelter. Affection,
// hunger and whether a kitty is still here all follow from that record, so after a real merge they are worked out again
// by replay (the same as time travel does). When the merged record is just one side's, that side's state is used as is.
import { dayStartHour, replay, setDayStart, type AppState, type Cat, type MindfulTask, type RetiredTask, type SitterTrip } from '../habit/rules.ts';
import { NONE, equal, field, merge3, mergeDays, mergeFields, mergeList, mergeRecord, mergeSet, byKey, type Base } from './merge3.ts';

// Only the parts of a save this needs to know about; everything else is merged field by field.
export interface GameSave {
  state: AppState;
  log?: { at: number; text: string }[];
  accomplished?: Record<string, number>;
  returned?: Record<string, number>;
  strayLeft?: Record<string, number>;
  amnesiaDay?: number;
  savedAt?: number;
  dayStart?: number;
  [k: string]: unknown;
}

// Kept as they are on each device: sound is a per-device choice, so are the reminders (they are that device's
// notifications), the playtest clock belongs to the device it runs on, and each device shows the change log once for itself.
const DEVICE_ONLY = ['sound', 'muted', 'reminder', 'offsetHours', 'seenVersion'] as const;
const LOG_MAX = 8;

// What replay works out again, so it is not part of the record.
const DERIVED_CAT = ['lastFedDay', 'missed', 'settledDay', 'sitterStartDay', 'lastSitterStartDay', 'totalFeedings', 'runAwayCount'] as const;
export const recordOf = (s: AppState) => ({
  cats: s.cats.map((c) => {
    const r: Record<string, unknown> = { ...c, status: c.status === 'shelter' ? 'shelter' : 'here', endedDay: c.status === 'shelter' ? c.endedDay : null };
    for (const k of DERIVED_CAT) delete r[k];
    return r;
  }),
  tasks: s.tasks.map(({ lastDoneDay: _, ...t }) => t),
  retired: s.retired ?? [],
});

const trips = (b: Base<SitterTrip[]>, m: SitterTrip[] = [], t: SitterTrip[] = []) =>
  mergeList(b, m, t, (x) => String(x.start), { item: (bb, mm, tt) => mergeFields(bb, mm, tt) }).sort((x, y) => x.start - y.start);

function mergeCat(b: Base<Cat>, m: Cat, t: Cat): Cat {
  const out = mergeFields(b, m, t, 'mine', { fedDays: mergeDays, habitDays: (bb, mm, tt) => (mm || tt ? mergeDays(bb, mm, tt) : undefined), sitterTrips: trips });
  // Going back to the shelter is for good, so it wins over anything the other side did.
  const gave = [m, t].find((c) => c.status === 'shelter');
  return gave ? { ...out, status: 'shelter', endedDay: gave.endedDay } : out;
}

function mergeTask(b: Base<MindfulTask>, m: MindfulTask, t: MindfulTask): MindfulTask {
  return mergeFields(b, m, t, 'mine', {
    // A treat is done on one day (time travel moves it); a stray keeps every day.
    doneDays: (bb, mm, tt) => (m.kind === 'task' ? merge3(bb, mm, tt) : mergeDays(bb, mm, tt)),
  });
}

// A kitty released to the stray colony on one side becomes a new stray there (with a new id); one adopted from a daily
// stray becomes a new kitty. Then the delete must win even if the other side fed the kitty (or did the stray) meanwhile,
// or both would be there; what the other side did then is moved onto what it became.
function conversions(base: AppState, mine: AppState, theirs: AppState) {
  const baseCats = byKey(base.cats, (c) => c.id), baseTasks = byKey(base.tasks, (t) => t.id);
  const released = new Map<string, { side: AppState; strayId: string }>();
  const adopted = new Map<string, { side: AppState; catId: string }>();
  // Both sides did the same conversion: each made its own new item, so one of the two (theirs) has to go.
  const twins: { list: 'cats' | 'tasks'; keep: string; drop: string }[] = [];
  for (const side of [mine, theirs]) {
    const newTasks = side.tasks.filter((t) => !baseTasks.has(t.id));
    const newCats = side.cats.filter((c) => !baseCats.has(c.id));
    for (const c of base.cats) {
      if (side.cats.some((x) => x.id === c.id)) continue;
      const stray = newTasks.find((t) => t.former?.name === c.name && t.name === c.habit);
      if (!stray) continue;
      const first = released.get(c.id);
      if (first) { if (first.strayId !== stray.id) twins.push({ list: 'tasks', keep: first.strayId, drop: stray.id }); }
      else released.set(c.id, { side, strayId: stray.id });
    }
    for (const t of base.tasks) {
      if (side.tasks.some((x) => x.id === t.id)) continue;
      const cat = newCats.find((c) => c.habit === t.name && c.habitDays);
      if (!cat) continue;
      const first = adopted.get(t.id);
      if (first) { if (first.catId !== cat.id) twins.push({ list: 'cats', keep: first.catId, drop: cat.id }); }
      else adopted.set(t.id, { side, catId: cat.id });
    }
  }
  return { released, adopted, twins };
}

function mergeState(base: Base<AppState>, mine: AppState, theirs: AppState): AppState {
  const conv = base === NONE ? { released: new Map(), adopted: new Map(), twins: [] } : conversions(base, mine, theirs);
  let cats = mergeList(field(base, 'cats'), mine.cats, theirs.cats, (c) => c.id, { item: mergeCat, deleteWins: (id) => conv.released.has(id) });
  let tasks = mergeList(field(base, 'tasks'), mine.tasks, theirs.tasks, (t) => t.id, { item: mergeTask, deleteWins: (id) => conv.adopted.has(id) });

  if (base !== NONE) {
    const days = (side: AppState, id: string, pick: (x: any) => number[] | undefined, list: 'cats' | 'tasks') => pick(side[list].find((x) => x.id === id)) ?? [];
    // Days the other side added to a released kitty go onto the stray it became, and the other way round.
    for (const [catId, { side, strayId }] of conv.released) {
      const other = side === mine ? theirs : mine;
      const was = days(base, catId, (c) => c?.fedDays, 'cats');
      const extra = days(other, catId, (c) => c?.fedDays, 'cats').filter((d) => !was.includes(d));
      if (extra.length) tasks = tasks.map((t) => (t.id === strayId ? { ...t, doneDays: mergeDays(NONE, t.doneDays, extra) } : t));
    }
    for (const [taskId, { side, catId }] of conv.adopted) {
      const other = side === mine ? theirs : mine;
      const was = days(base, taskId, (t) => t?.doneDays, 'tasks');
      const extra = days(other, taskId, (t) => t?.doneDays, 'tasks').filter((d) => !was.includes(d));
      if (extra.length) cats = cats.map((c) => (c.id === catId ? { ...c, habitDays: mergeDays(NONE, c.habitDays, extra) } : c));
    }
  }

  // Both sides did the same conversion: keep this device's new item, with the days of both.
  for (const { list, keep, drop } of conv.twins) {
    if (list === 'tasks') {
      const gone = tasks.find((t) => t.id === drop);
      tasks = tasks.filter((t) => t.id !== drop).map((t) => (t.id === keep ? { ...t, doneDays: mergeDays(NONE, t.doneDays, gone?.doneDays) } : t));
    } else {
      const gone = cats.find((c) => c.id === drop);
      cats = cats.filter((c) => c.id !== drop).map((c) => (c.id === keep ? { ...c, habitDays: mergeDays(NONE, c.habitDays, gone?.habitDays) } : c));
    }
  }

  // Two deleted treats can look the same (kind, xp, days), so the n-th of each look is its own entry.
  const lookOf = (r: RetiredTask) => JSON.stringify([r.kind, r.xp, r.days]);
  const keyed = (list: RetiredTask[] = []) => {
    const seen = new Map<string, number>();
    return list.map((r) => { const l = lookOf(r), n = seen.get(l) ?? 0; seen.set(l, n + 1); return [`${l}#${n}`, r] as const; });
  };
  const [kb, km, kt] = [base === NONE ? null : keyed(base.retired), keyed(mine.retired), keyed(theirs.retired)];
  const allRetired = new Map([...kt, ...km]);
  const retired = mergeSet(kb ? kb.map(([k]) => k) : NONE, km.map(([k]) => k), kt.map(([k]) => k)).map((k) => allRetired.get(k) as RetiredTask);
  // A stray one side deleted (so it kept what the stray paid in `retired`) but the other side still changed is kept, and
  // then it pays for itself again: that entry would count its days twice.
  if (base !== NONE) {
    for (const side of [mine, theirs]) for (const t of base.tasks) {
      if (side.tasks.some((x) => x.id === t.id) || !tasks.some((x) => x.id === t.id) || !t.doneDays.length) continue;
      const i = retired.findIndex((r) => lookOf(r) === lookOf({ kind: t.kind, xp: t.xp, days: t.doneDays }));
      if (i >= 0) retired.splice(i, 1);
    }
  }
  const { retired: _own, ...rest } = mine;   // the merged list, not this side's
  return { ...rest, cats, tasks, ...(retired.length ? { retired } : {}) };
}

const keepMin = (b: Base<number>, m?: number, t?: number) => (m === undefined ? t : t === undefined ? m : Math.min(m, t));
const keepMax = (b: Base<number>, m?: number, t?: number) => (m === undefined ? t : t === undefined ? m : Math.max(m, t));

export function mergeGame(base: GameSave | null, mine: GameSave, theirs: GameSave, now: Date): GameSave {
  const b: Base<GameSave> = base ?? NONE;
  const out = mergeFields(b, mine, theirs, 'mine', {
    state: () => undefined,   // below
    log: (_bb, mm = [], tt = []) => {
      const seen = new Set<string>();
      return [...mm, ...tt].filter((l) => { const k = `${l.at}|${l.text}`; return !seen.has(k) && !!seen.add(k); })
        .sort((x, y) => y.at - x.at).slice(0, LOG_MAX);
    },
    accomplished: (bb, mm, tt) => mergeRecord(NONE, mm, tt, { item: (_x, a, c) => keepMin(NONE, a, c) as number }),   // unlocked stays unlocked
    returned: (bb, mm, tt) => mergeRecord(bb, mm, tt, { item: (_x, a, c) => keepMax(NONE, a, c) as number }),
    strayLeft: (bb, mm, tt) => mergeRecord(bb, mm, tt, { item: (_x, a, c) => keepMax(NONE, a, c) as number }),
    amnesiaDay: keepMax,
    savedAt: keepMax,
    ...Object.fromEntries(DEVICE_ONLY.map((k) => [k, (_bb: unknown, mm: unknown) => mm])),
  });

  const merged = mergeState(field(b, 'state'), mine.state, theirs.state);
  const [rMerged, rMine, rTheirs] = [recordOf(merged), recordOf(mine.state), recordOf(theirs.state)];
  const rBase = b === NONE ? NONE : recordOf(b.state);
  let state: AppState;
  if (equal(rMerged, rMine) && equal(rMerged, rTheirs)) {   // the same record on both sides: the state of the side that changed it
    state = rBase !== NONE && equal(rMine, rBase) && !equal(rTheirs, rBase) ? theirs.state : mine.state;
  } else if (equal(rMerged, rTheirs)) state = theirs.state;
  else if (equal(rMerged, rMine)) state = mine.state;
  else {
    const before = dayStartHour();
    setDayStart(out.dayStart);   // replay counts days the way the merged save does
    try { state = replay(merged, now); } finally { setDayStart(before); }
  }
  return { ...out, state };
}
