// A whole save (everything a .kitty backup holds) merged from two devices against the last one they agreed on.
// Each part has its own rule:
//   game         the kitties' record, then affection worked out again (./merge-game.ts)
//   diary        page by page; a page changed on both sides takes the newer one's fields and keeps both texts
//   reflections  likewise, month by month
//   notes        note by note; one changed on both sides keeps both (the other one as a "(conflict)" copy, as the notes
//                folder sync does)
//   the rest     record by record (Kitty Mart, notebooks, Kitty Gallery's icons, Kitty Achievement); when both sides
//                changed one record, the one changed last wins where it says when it was changed, this device's otherwise
import type { Backup } from '../backup.ts';
import { MAX_PHOTOS, type DiaryEntry, type DiaryExtras, type Reflection } from '../diary/model.ts';
import { uniqueName } from '../notes/model.ts';
import { sanitizeBooks, type BookData } from '../notes/books.ts';
import { sanitize as sanitizeShop, type ShopData } from '../shopping/model.ts';
import { sanitize as sanitizePixel, type PixelData } from '../pixel/model.ts';
import { packBackup as packAchievement, unpackBackup as unpackAchievement } from '../achievement/backup.ts';
import type { Data as AchievementData } from '../achievement/model.ts';
import { mergeGame, type GameSave } from './merge-game.ts';
import { NONE, equal, field, merge3, mergeById, mergeDeep, mergeFields, mergeKeyed, mergeList, mergeRecord, mergeText, newer, type Base, type Side } from './merge3.ts';

// ---- diary ----
// A page and its photos go together: [first, second, ...], empty when it has none.
interface Page { e: DiaryEntry; pics: Uint8Array[] }
function pagesOf(b: Backup): Map<string, Page> {
  const out = new Map<string, Page>();
  for (const [k, e] of Object.entries(b.diary ?? {})) {
    const first = b.photos?.[Number(k)];
    out.set(k, { e, pics: first ? [first, ...(b.morePhotos?.[Number(k)] ?? [])] : [] });
  }
  return out;
}
// A page's photos when both sides changed them: every photo either side added is kept, one either side removed is gone.
function mergePics(b: Base<Uint8Array[]>, m: Uint8Array[], t: Uint8Array[], side: Side): Uint8Array[] {
  if (equal(m, t)) return m;
  if (b !== NONE && equal(m, b)) return t;
  if (b !== NONE && equal(t, b)) return m;
  const has = (list: readonly Uint8Array[], x: Uint8Array) => list.some((y) => equal(x, y));
  const [first, second] = side === 'mine' ? [m, t] : [t, m];
  const all = [...first, ...second.filter((x) => !has(first, x))];
  return all.filter((x) => b === NONE || !has(b, x) || (has(m, x) && has(t, x))).slice(0, MAX_PHOTOS);
}
function mergePage(b: Base<Page>, m: Page, t: Page): Page {
  const side = newer(m.e.updated, t.e.updated);
  const e = mergeFields(field(b, 'e'), m.e, t.e, side, {
    text: (bb, mm = '', tt = '') => mergeText(bb, mm, tt, side),
    photo: () => undefined, photos: () => undefined,   // follow the photos, below
    updated: (_bb, mm, tt) => Math.max(mm ?? 0, tt ?? 0),
  });
  return { e, pics: mergePics(field(b, 'pics'), m.pics, t.pics, side) };
}
function mergeDiary(base: Backup | null, mine: Backup, theirs: Backup): Pick<Backup, 'diary' | 'photos' | 'morePhotos'> {
  const pages = mergeKeyed(base ? pagesOf(base) : NONE, pagesOf(mine), pagesOf(theirs), { item: mergePage });
  const diary: Backup['diary'] = {}, photos: Backup['photos'] = {}, morePhotos: NonNullable<Backup['morePhotos']> = {};
  for (const [k, { e: page, pics }] of pages) {
    const day = Number(k);
    const { photo: _photo, photos: _count, ...e } = page;   // follow the photos kept, not what the page said
    diary[day] = { ...e, ...(pics.length ? { photo: true } : {}), ...(pics.length > 1 ? { photos: pics.length } : {}) };
    if (pics[0]) photos[day] = pics[0];
    if (pics.length > 1) morePhotos[day] = pics.slice(1);
  }
  return { diary, photos, morePhotos };
}

const mergeReflection = (b: Base<Reflection>, m: Reflection, t: Reflection): Reflection => {
  const side = newer(m.updated, t.updated);
  return { text: mergeText(field(b, 'text'), m.text, t.text, side), updated: Math.max(m.updated, t.updated) };
};

const mergeExtras = (b: Base<DiaryExtras>, m: DiaryExtras = {}, t: DiaryExtras = {}): DiaryExtras =>
  mergeFields(b, m, t, 'mine', {
    people: (bb, mm, tt) => (mm || tt ? mergeById(bb, mm, tt, { item: (x, y, z) => mergeFields(x, y, z) }) : undefined),
    moodNames: (bb, mm, tt) => (mm || tt ? mergeFields(bb ?? {}, mm ?? {}, tt ?? {}) : undefined),
  });

// ---- notes ----
function mergeNotes(base0: Base<Record<string, string>>, mine0: Record<string, string> = {}, theirs0: Record<string, string> = {}): Record<string, string> {
  // A name is the same name whatever its case (most file systems say so): spelled as the base, then this device, has it.
  const spelled = new Map<string, string>();
  for (const names of [base0 === NONE ? [] : Object.keys(base0), Object.keys(mine0), Object.keys(theirs0)]) for (const n of names) if (!spelled.has(n.toLowerCase())) spelled.set(n.toLowerCase(), n);
  const same = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([n, v]) => [spelled.get(n.toLowerCase()) as string, v]));
  const base = base0 === NONE ? NONE : same(base0), mine = same(mine0), theirs = same(theirs0);
  const out = mergeRecord(base, mine, theirs);   // a clash keeps this device's text under the name...
  for (const [name, t] of Object.entries(theirs)) {   // ...and theirs next to it
    const m = mine[name], b = base === NONE ? undefined : base[name];
    if (m !== undefined && m !== t && m !== b && t !== b) out[uniqueName(`${name} (conflict)`, Object.keys(out))] = t;
  }
  return out;
}

const mergeBooks = (base: Base<BookData>, mine: BookData, theirs: BookData): BookData => ({
  books: mergeList(field(base, 'books'), mine.books, theirs.books, (x) => x.name.toLowerCase(), { item: (b, m, t) => mergeFields(b, m, t) }),
});

// ---- Kitty Mart ----
function mergeShop(base: Base<ShopData>, mine: ShopData, theirs: ShopData): ShopData {
  const out = mergeDeep(base, mine, theirs) as ShopData;
  for (const r of Object.values(out.regulars)) r.bought = [...new Set(r.bought)].sort((a, b) => a - b).slice(-12);
  return out;
}

// ---- Kitty Gallery: each icon says when it was changed (a deleted one is kept, marked deleted) ----
const iconKey = (i: { category: string; id: string }) => `${i.category}/${i.id}`;
const mergePixel = (base: Base<PixelData>, mine: PixelData, theirs: PixelData): PixelData => ({
  version: 1,
  icons: mergeList(field(base, 'icons'), mine.icons, theirs.icons, iconKey, { item: (b, m, t) => merge3(b, m, t, newer(m.updated, t.updated)) }),
});

// ---- Kitty Achievement: rows with ids, most of them saying when they were changed ----
function mergeAchievementData(base: Base<AchievementData>, mine: AchievementData, theirs: AchievementData): AchievementData {
  const prefer = (m: { updatedAt?: unknown }, t: { updatedAt?: unknown }): Side | undefined =>   // undefined: what the record around it chose
    typeof m.updatedAt === 'number' && typeof t.updatedAt === 'number' ? newer(m.updatedAt, t.updatedAt) : undefined;
  const out = mergeDeep(base, mine, theirs, prefer) as AchievementData;
  // Something added on one side inside a quest the other side deleted: the quest comes back rather than leave it lost.
  const all = [mine, theirs, ...(base === NONE ? [] : [base])];
  const restore = <K extends 'mainQuests' | 'sideQuests' | 'achievements'>(k: K, id: string | null) => {
    if (!id || (out[k] as { id: string }[]).some((x) => x.id === id)) return;
    const found = all.map((d) => (d[k] as { id: string }[]).find((x) => x.id === id)).find(Boolean);
    if (found) (out[k] as unknown[]).push(found);
  };
  for (const p of out.photos) restore('achievements', p.achievementId);
  for (const a of out.achievements) { restore('sideQuests', a.sideQuestId); restore('mainQuests', a.mainQuestId); }
  for (const s of out.sideQuests) restore('mainQuests', s.mainQuestId);
  return out;
}
async function mergeAchievement(base: Uint8Array | undefined, mine: Uint8Array | undefined, theirs: Uint8Array | undefined): Promise<Uint8Array | undefined> {
  if (!mine || !theirs) return mine ?? theirs;
  const m = unpackAchievement(mine), t = unpackAchievement(theirs);
  let b: Base<AchievementData> = NONE;
  try { if (base) b = unpackAchievement(base).data; } catch { /* no usable base: combine */ }
  const data = mergeAchievementData(b, m.data, t.data);
  return packAchievement(data, new Map([...t.photos, ...m.photos]));   // a photo's id never changes what it shows
}

// ---- JSON parts, kept as text in a backup ----
function mergeJson<T>(base: string | undefined, mine: string | undefined, theirs: string | undefined, parse: (raw: unknown) => T, merge: (b: Base<T>, m: T, t: T) => T, empty?: (v: T) => boolean): string | undefined {
  if (mine === undefined && theirs === undefined) return undefined;
  if (base === undefined && (mine === undefined || theirs === undefined)) return mine ?? theirs;   // nothing to tell a deletion by
  const read = (s: string): T | null => { try { return parse(JSON.parse(s)); } catch { return null; } };
  // Gone on one side while the base had it: that side emptied it (deleted the last notebook, say), so the other side's
  // untouched items go with it, as they would anywhere else.
  const m = mine === undefined ? read('{}') : read(mine), t = theirs === undefined ? read('{}') : read(theirs);
  if (!m || !t) return m && mine !== undefined ? mine : t && theirs !== undefined ? theirs : undefined;
  const b = base === undefined ? NONE : read(base) ?? NONE;
  const out = parse(merge(b, m, t));   // sanitizing again keeps every rule the app counts on (unique names, limits)
  return empty?.(out) ? undefined : JSON.stringify(out);
}

export async function mergeBackups(base: Backup | null, mine: Backup, theirs: Backup, now = new Date()): Promise<Backup> {
  const game = mine.game && theirs.game
    ? mergeGame((base?.game as GameSave | null) ?? null, mine.game as GameSave, theirs.game as GameSave, now)
    : mine.game ?? theirs.game;
  const b = <K extends keyof Backup>(k: K): Base<NonNullable<Backup[K]>> => (base?.[k] ?? NONE) as Base<NonNullable<Backup[K]>>;
  return {
    game,
    ...mergeDiary(base, mine, theirs),
    reflections: mergeRecord(b('reflections'), mine.reflections, theirs.reflections, { item: mergeReflection }),
    extras: mergeExtras(b('extras'), mine.extras, theirs.extras),
    notes: mergeNotes(b('notes'), mine.notes, theirs.notes),
    notebooks: mergeJson(base?.notebooks, mine.notebooks, theirs.notebooks, sanitizeBooks, mergeBooks, (d) => !d.books.length),
    shopping: mergeJson(base?.shopping, mine.shopping, theirs.shopping, sanitizeShop, mergeShop),
    gallery: mergeJson(base?.gallery, mine.gallery, theirs.gallery, sanitizePixel, mergePixel),
    achievement: await mergeAchievement(base?.achievement, mine.achievement, theirs.achievement),
  };
}

// ---- what a merge changed ----
// The parts of a save, as the app restores them.
export type Part = 'game' | 'diary' | 'notes' | 'notebooks' | 'shopping' | 'gallery' | 'achievement';

// A page as it is restored: whether it has photos follows the photos themselves.
const diaryView = (b: Backup) => ({
  pages: [...pagesOf(b)].map(([k, { e, pics }]) => [k, { ...e, photo: undefined, photos: undefined }, pics]),
  reflections: b.reflections ?? {},
  extras: b.extras ?? {},
});
const jsonView = (s: string | undefined) => { try { return s === undefined ? undefined : JSON.parse(s); } catch { return s; } };
function achievementView(bytes: Uint8Array | undefined) {
  if (!bytes) return undefined;
  try { const { data, photos } = unpackAchievement(bytes); return { data, photos: [...photos.keys()].sort() }; } catch { return null; }
}

// The parts that differ between two saves (the same data written in a different order is not a difference).
export function changedParts(a: Backup, b: Backup): Set<Part> {
  const out = new Set<Part>();
  if (!equal(a.game, b.game)) out.add('game');
  if (!equal(diaryView(a), diaryView(b))) out.add('diary');
  if (!equal(a.notes ?? {}, b.notes ?? {})) out.add('notes');
  for (const k of ['notebooks', 'shopping', 'gallery'] as const) if (!equal(jsonView(a[k]), jsonView(b[k]))) out.add(k);
  if (!equal(achievementView(a.achievement), achievementView(b.achievement))) out.add('achievement');
  return out;
}
