// Random edits on two devices from one base. Whatever they are, a merge must keep these promises:
//   - a side that changed nothing gives the other side exactly (so a plain pull or push never alters anything)
//   - two equal sides stay as they are
//   - which device is "mine" does not change what is kept (only which of two clashing values wins)
//   - no id appears twice
import { describe, expect, it } from 'vitest';
import { mergeGame, recordOf, type GameSave } from './merge-game.ts';
import { mergeBackups } from './merge.ts';
import { equal, mergeDeep } from './merge3.ts';
import { replay, adoptCat, addMindfulTask, doMindfulTask, newState, releaseToColony, removeMindfulTask, returnToShelter, setCatDay, setTaskDay, type AppState } from '../habit/rules.ts';
import type { Backup } from '../backup.ts';

const N = Number(process.env.FUZZ ?? 400);
function rng(seed: number) {   // mulberry32
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const at = (day: number) => new Date(2026, 0, 5 + day, 12, 0, 0);
const TODAY = 5;
const save = (state: AppState): GameSave => ({ v: 1, state, offsetHours: 0, log: [], savedAt: 0 });

// ---- the game ----
let counter = 0;
function edit(s: AppState, r: () => number, tag: string): AppState {
  const adopted = s.cats.filter((c) => c.status === 'alive' || c.status === 'sitter');
  const op = Math.floor(r() * 9);
  const res = (x: { state: AppState }) => x.state;
  const id = `${tag}${++counter}`;
  const day = (min = 0) => min + Math.floor(r() * (TODAY - min + 1));
  const cat = adopted.length ? pick(r, adopted) : null;
  const task = s.tasks.length ? pick(r, s.tasks) : null;
  switch (op) {
    case 0: return res(adoptCat(s, { id, name: `K${id}`, habit: `H${id}` }, at(TODAY)));
    case 1: case 2: return cat ? res(setCatDay(s, cat.id, day(cat.adoptedDay), r() < 0.8, at(TODAY))) : s;
    case 3: return addMindfulTask(s, { id, name: `S${id}`, xp: 1 + Math.floor(r() * 9) }, at(TODAY));
    case 4: case 5: return task ? res(setTaskDay(s, task.id, day(), r() < 0.8, at(TODAY))) : s;
    case 6: return task ? removeMindfulTask(s, task.id) : s;
    case 7: return cat && r() < 0.5 ? res(releaseToColony(s, cat.id, id, at(TODAY))) : cat ? res(returnToShelter(s, cat.id, at(TODAY))) : s;
    default: return task && task.kind === 'habit' ? res(doMindfulTask(s, task.id, at(TODAY))) : s;
  }
}
function world(seed: number) {
  const r = rng(seed);
  let base = newState();
  for (let i = 0; i < 6; i++) base = edit(base, r, 'b');
  const grow = (n: number, tag: string) => { let s = base; for (let i = 0; i < n; i++) s = edit(s, r, tag); return s; };
  return { r, base, a: grow(Math.floor(r() * 5), 'a'), b: grow(Math.floor(r() * 5), 'b') };
}
// What stays the same whichever side is mine: kitties and strays by name, with their days.
const shape = (s: AppState) => ({
  cats: s.cats.map((c) => [c.name, c.status === 'shelter', c.fedDays, c.habitDays ?? []] as const).sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
  tasks: s.tasks.map((t) => [t.name, t.doneDays] as const).sort((x, y) => x[0].localeCompare(y[0])),
});
const unique = (xs: { id: string }[]) => new Set(xs.map((x) => x.id)).size === xs.length;

describe('fuzz: the game', () => {
  for (let seed = 1; seed <= N; seed++) {
    it(`seed ${seed}`, () => {
      const { base, a, b } = world(seed);
      const now = at(TODAY);
      // the same record, and the very state when the record was really changed (derived numbers alone do not count)
      const same = (out: AppState, side: AppState) => {
        expect(recordOf(out)).toEqual(recordOf(side));
        if (!equal(recordOf(side), recordOf(base))) expect(out).toEqual(side);
      };
      same(mergeGame(save(base), save(base), save(b), now).state, b);
      same(mergeGame(save(base), save(a), save(base), now).state, a);
      expect(mergeGame(save(base), save(a), save(a), now).state).toEqual(a);
      expect(mergeGame(null, save(a), save(a), now).state).toEqual(a);
      const ab = mergeGame(save(base), save(a), save(b), now).state, ba = mergeGame(save(base), save(b), save(a), now).state;
      expect(unique(ab.cats) && unique(ab.tasks) && unique(ba.cats) && unique(ba.tasks)).toBe(true);
      expect(shape(ab)).toEqual(shape(ba));
      // no meal or stray done on either side is lost, and one taken back on a side stays taken back
      const kept = (side: AppState, other: AppState) => {
        for (const c of ab.cats) {
          const sc = side.cats.find((x) => x.id === c.id), oc = other.cats.find((x) => x.id === c.id), bc = base.cats.find((x) => x.id === c.id);
          if (!sc || !oc) continue;
          const added = sc.fedDays.filter((d) => !bc?.fedDays.includes(d)), removed = (bc?.fedDays ?? []).filter((d) => !sc.fedDays.includes(d));
          for (const d of added) expect(c.fedDays).toContain(d);
          for (const d of removed) expect(c.fedDays).not.toContain(d);
        }
        for (const t of ab.tasks) {
          const st = side.tasks.find((x) => x.id === t.id), ot = other.tasks.find((x) => x.id === t.id), bt = base.tasks.find((x) => x.id === t.id);
          if (!st || !ot || t.kind !== 'habit') continue;
          for (const d of st.doneDays.filter((x) => !bt?.doneDays.includes(x))) expect(t.doneDays).toContain(d);
          for (const d of (bt?.doneDays ?? []).filter((x) => !st.doneDays.includes(x))) expect(t.doneDays).not.toContain(d);
        }
      };
      kept(a, b); kept(b, a);
      expect(replay(ab, now).xp).toBe(ab.xp);   // affection is what the record says
      const nb = mergeGame(null, save(a), save(b), now).state;
      expect(unique(nb.cats) && unique(nb.tasks)).toBe(true);
    });
  }
});

// ---- diary, reflections, notes, photos ----
let clock = 0;   // edits only ever happen later than the ones before
function randomBackup(r: () => number, from?: Backup): Backup {
  const out: Backup = from ? structuredClone(from) : { game: null, diary: {}, photos: {}, reflections: {}, notes: {} };
  out.morePhotos = out.morePhotos ?? {};
  for (let i = 0, n = 1 + Math.floor(r() * 4); i < n; i++) {
    const day = 1 + Math.floor(r() * 4), name = pick(r, ['Ideas', 'Todo', 'Trip', 'ideas']);
    const kind = Math.floor(r() * 7);
    if (kind === 0) { out.diary[day] = { ...out.diary[day], text: pick(r, ['a', 'b', 'c']) + Math.floor(r() * 3), updated: ++clock }; }
    else if (kind === 1) { delete out.diary[day]; delete out.photos[day]; delete out.morePhotos[day]; }
    else if (kind === 2 && out.diary[day]) {
      const pics = Array.from({ length: Math.floor(r() * 4) }, () => new Uint8Array([Math.floor(r() * 5)])).filter((p, i, all) => all.findIndex((q) => q[0] === p[0]) === i);
      delete out.photos[day]; delete out.morePhotos[day];
      if (pics.length) { out.photos[day] = pics[0]; if (pics.length > 1) out.morePhotos[day] = pics.slice(1); }
      const { photo: _p, photos: _n, ...e } = out.diary[day];
      out.diary[day] = { ...e, ...(pics.length ? { photo: true } : {}), ...(pics.length > 1 ? { photos: pics.length } : {}) };
    }
    else if (kind === 3) { out.notes![name] = pick(r, ['x', 'y', 'z']) + Math.floor(r() * 3); }
    else if (kind === 4) { delete out.notes![name]; }
    else if (kind === 5) { out.reflections![`2026-0${day}`] = { text: pick(r, ['p', 'q']) + Math.floor(r() * 3), updated: ++clock }; }
    else { delete out.reflections![`2026-0${day}`]; }
  }
  return out;
}
const content = (b: Backup) => ({ diary: b.diary, photos: b.photos, more: Object.fromEntries(Object.entries(b.morePhotos ?? {}).filter(([, v]) => v.length)), reflections: b.reflections, notes: b.notes });
const lower = (b: Backup) => Object.keys(b.notes ?? {}).map((n) => n.toLowerCase());

describe('fuzz: the rest of the save', () => {
  for (let seed = 1; seed <= N; seed++) {
    it(`seed ${seed}`, async () => {
      const r = rng(seed * 7919);
      const base = randomBackup(r), a = randomBackup(r, base), b = randomBackup(r, base);
      const merged = (x: Backup, y: Backup, z: Backup | null) => mergeBackups(z, x, y);
      // nothing changed on one side: the other comes through as it is (a note's case is kept as the base spelled it)
      const noCase = (x: Backup) => ({ ...content(x), notes: Object.fromEntries(Object.entries(x.notes ?? {}).map(([k, v]) => [k.toLowerCase(), v])) });
      expect(noCase(await merged(base, b, base))).toEqual(noCase(b));
      expect(noCase(await merged(a, base, base))).toEqual(noCase(a));
      expect(noCase(await merged(a, a, base))).toEqual(noCase(a));
      const ab = await merged(a, b, base), ba = await merged(b, a, base);
      expect(new Set(lower(ab)).size).toBe(lower(ab).length);   // no two notes whose names differ only by case
      expect(Object.keys(ab.diary)).toEqual(Object.keys(ba.diary));
      expect(Object.keys(ab.reflections ?? {}).sort()).toEqual(Object.keys(ba.reflections ?? {}).sort());
      for (const [day, page] of Object.entries(ab.diary)) {   // a page's photos match what it says, and never more than four
        const n = (ab.photos[Number(day)] ? 1 : 0) + (ab.morePhotos?.[Number(day)]?.length ?? 0);
        expect(!!page.photo).toBe(n > 0);
        expect(n).toBeLessThanOrEqual(4);
      }
    });
  }
});

describe('fuzz: plain JSON', () => {
  const gen = (r: () => number, d = 0): unknown => {
    const k = Math.floor(r() * (d > 2 ? 3 : 6));
    if (k === 0) return Math.floor(r() * 3);
    if (k === 1) return pick(r, ['a', 'b', 'c']);
    if (k === 2) return r() < 0.5;
    if (k === 3) return Object.fromEntries(Array.from({ length: Math.floor(r() * 4) }, () => [pick(r, ['p', 'q', 'r', 's']), gen(r, d + 1)]));
    if (k === 4) return Array.from({ length: Math.floor(r() * 4) }, (_, i) => ({ id: pick(r, ['x', 'y', 'z', 'w']) + i, v: gen(r, d + 1) }));
    return Array.from({ length: Math.floor(r() * 4) }, () => pick(r, ['m', 'n', 'o', 1, 2]));
  };
  for (let seed = 1; seed <= N; seed++) {
    it(`seed ${seed}`, () => {
      const r = rng(seed * 104729);
      const b = gen(r), x = gen(r), y = gen(r);
      expect(mergeDeep(b, b, y)).toEqual(y);
      expect(mergeDeep(b, x, b)).toEqual(x);
      expect(mergeDeep(b, x, x)).toEqual(x);
    });
  }
});
