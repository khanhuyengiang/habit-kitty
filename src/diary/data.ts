// The diary's data: one Markdown file per day, one small JPEG per day, one Markdown file per month for the reflection,
// and diary.json for the diary's settings and the people. All in the app's private storage, next to Habit Kitty's save:
//
//   habit-kitty/diary/2026-10-12.md        frontmatter (mood, feeling, weather...) + the text
//   habit-kitty/photos/2026-10-12.jpg      (a page with more photos: 2026-10-12-2.jpg, -3.jpg, -4.jpg)
//   habit-kitty/reflections/2026-10.md     the month's reflection (same frontmatter: just `updated`)
//   habit-kitty/diary.json                 { trackamaniac, moodNames, people }
//
// Habit Kitty starts this once (initDiary); the Diary screen and the backup read and write through here. Everything is
// kept in memory too, so screens draw at once.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { ROOT, at, fileBytes, fileNames, removeFile, toBase64, writeOk } from '../shared/files.ts';
import {
  EXTRAS_FILE, MAX_PHOTOS, dayFromName, diaryPath, entryFromMarkdown, entryToMarkdown, monthFromKey, photoPath, reflectionPath, sanitizeExtras,
  type DiaryEntry, type DiaryExtras, type Reflection,
} from '../store.ts';
import { compressPhoto } from '../shared/photo.ts';
import { BACKUP_PREFIX, markDirty } from '../shared/backupfolder.ts';
import { publishHabitStats } from '../shared/stats.ts';

const STAGE = 'habit-kitty-restore';   // a restore is written here first, then swapped in
const writeText = (path: string, text: string, root = ROOT) =>
  writeOk(() => Filesystem.writeFile({ ...at(path, root), data: text, encoding: Encoding.UTF8, recursive: true }));
const writeBytes = (path: string, bytes: Uint8Array, root = ROOT) =>
  writeOk(() => Filesystem.writeFile({ ...at(path, root), data: toBase64(bytes), recursive: true }));
const clearFiles = (root = ROOT) => writeOk(() => Filesystem.rmdir({ ...at('', root), recursive: true }));

const writeEntry = (day: number, e: DiaryEntry, root = ROOT) => writeText(diaryPath(day), entryToMarkdown(e), root);
const writePhoto = (day: number, bytes: Uint8Array, root = ROOT, i = 0) => writeBytes(photoPath(day, i), bytes, root);
const writeReflection = (key: string, r: Reflection, root = ROOT) => writeText(reflectionPath(key), entryToMarkdown({ text: r.text, updated: r.updated }), root);
const writeExtras = (x: DiaryExtras, root = ROOT) => writeText(EXTRAS_FILE, JSON.stringify(x), root);

async function readEntries(): Promise<Record<number, DiaryEntry>> {
  const out: Record<number, DiaryEntry> = {};
  const photos = new Set(await fileNames('photos'));
  await Promise.all((await fileNames('diary')).map(async (name) => {
    const day = dayFromName(name.replace(/\.md$/, ''));
    const bytes = day === null ? undefined : await fileBytes(`diary/${name}`);
    const e = bytes && entryFromMarkdown(new TextDecoder().decode(bytes));
    if (day === null || !e) return;
    const has = (i: number) => photos.has(photoPath(day, i).slice('photos/'.length));
    let n = has(0) ? 1 : 0;
    while (n && n < MAX_PHOTOS && has(n)) n++;   // the files are the truth
    const { photos: _count, ...rest } = e;
    out[day] = { ...rest, photo: n > 0, ...(n > 1 && { photos: n }) };
  }));
  return out;
}

async function readReflections(): Promise<Record<string, Reflection>> {
  const out: Record<string, Reflection> = {};
  await Promise.all((await fileNames('reflections')).map(async (name) => {
    const key = name.replace(/\.md$/, '');
    const bytes = monthFromKey(key) ? await fileBytes(`reflections/${name}`) : undefined;
    const e = bytes && entryFromMarkdown(new TextDecoder().decode(bytes));
    if (e && e.text.trim()) out[key] = { text: e.text, updated: e.updated };
  }));
  return out;
}

async function readExtras(): Promise<DiaryExtras | null> {
  const bytes = await fileBytes(EXTRAS_FILE);
  if (!bytes) return null;
  try { return sanitizeExtras(JSON.parse(new TextDecoder().decode(bytes))); } catch { return {}; }
}

// ---- the old ways: the diary text inside the save, the photos in IndexedDB ----
function legacyPhotos(): Promise<Record<number, Blob>> {
  return new Promise((resolve) => {
    const out: Record<number, Blob> = {};
    try {
      const req = indexedDB.open('habit-kitty-photos', 1);
      req.onupgradeneeded = () => { req.transaction?.abort(); };   // nothing was ever stored
      req.onerror = () => resolve(out);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) { db.close(); resolve(out); return; }
        const cur = db.transaction('photos').objectStore('photos').openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { out[Number(c.key)] = c.value; c.continue(); } else { db.close(); resolve(out); }
        };
        cur.onerror = () => { db.close(); resolve(out); };
      };
    } catch { resolve(out); }
  });
}

async function migrateLegacyDiary(old: [string, DiaryEntry][]): Promise<boolean> {
  if (!old.length) return true;
  const photos = await legacyPhotos();
  for (const [k, e] of old) {
    const day = Number(k);
    if (!await writeEntry(day, e)) return false;
    if (e.photo && photos[day]) {
      const small = await compressPhoto(photos[day]).catch(() => null);
      if (small && !await writePhoto(day, new Uint8Array(await small.arrayBuffer()))) return false;
    }
  }
  try { indexedDB.deleteDatabase('habit-kitty-photos'); } catch { /* ignore */ }
  return true;
}

// ---- in memory ----
let entries: Record<number, DiaryEntry> = {};
let reflections: Record<string, Reflection> = {};
// What a new diary starts with: every option on (each can be turned off under Settings → Diary).
const ALL_ON: DiaryExtras = { trackamaniac: true, teleportation: true, photographer: true, titles: true, starry: true };
let extras: DiaryExtras = {};
let ready = false;
const listeners = new Set<() => void>();

export const diaryReady = () => ready;
export const onDiary = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

const hasPage = (e?: DiaryEntry) => !!e && (!!e.text.trim() || !!e.photo);   // a written page or a photo turns the day pink
export const diaryEntries = () => entries;
export const entryOf = (day: number): DiaryEntry | undefined => entries[day];
export const hasPageOn = (day: number) => hasPage(entries[day]);
export const pageCount = () => Object.values(entries).filter(hasPage).length;   // for the accomplishments
export const dayCount = () => Object.keys(entries).length;                     // days with anything on them: MP
export const reflectionOf = (key: string): Reflection | undefined => reflections[key];
export const diaryExtras = () => extras;

function changed() {
  markDirty(BACKUP_PREFIX);
  publishHabitStats({ diaryDays: dayCount() });
  for (const l of listeners) l();
}

// ---- start ----
let started: Promise<boolean> | null = null;
let resolveInit: () => void = () => {};
// Resolves once Habit Kitty has started the diary (whether or not the files could be read).
export const diaryInitialised = new Promise<void>((r) => { resolveInit = r; });

export interface Legacy { diary?: Record<string, DiaryEntry>; trackamaniac?: boolean; moodNames?: DiaryExtras['moodNames'] }

// Reads everything; first moves anything old versions kept elsewhere (`legacy`) into files. Resolves false when that failed:
// the caller keeps the old copy and it is tried again next launch.
export function initDiary(legacy: Legacy = {}): Promise<boolean> {
  started ??= (async () => {
    if (!await migrateLegacyDiary(Object.entries(legacy.diary ?? {}))) { resolveInit(); return false; }
    entries = await readEntries();
    reflections = await readReflections();
    const stored = await readExtras();
    if (stored) extras = stored;
    else {   // a new diary starts with every option on; the emotion names used to live in Habit Kitty's save
      extras = sanitizeExtras({ ...ALL_ON, moodNames: legacy.moodNames });
      await writeExtras(extras);
    }
    ready = true;
    resolveInit();
    publishHabitStats({ diaryDays: dayCount() });
    for (const l of listeners) l();
    return true;
  })();
  return started;
}

// ---- pages ----
export const getPhoto = async (day: number, i = 0) => {
  const b = await fileBytes(photoPath(day, i));
  return b && new Blob([b as BlobPart], { type: 'image/jpeg' });
};

// Stores a page (or removes it when `entry` is null). `photo`: new pictures (one, or up to four in order), 'keep' the stored ones, or 'none' to drop them.
export async function saveEntry(day: number, entry: DiaryEntry | null, photo: Blob | Blob[] | 'keep' | 'none'): Promise<boolean> {
  const blobs = Array.isArray(photo) ? photo.slice(0, MAX_PHOTOS) : photo instanceof Blob ? [photo] : null;
  if (entry) {
    for (const [i, b] of (blobs ?? []).entries()) if (!await writePhoto(day, new Uint8Array(await b.arrayBuffer()), ROOT, i)) return false;
    if (!await writeEntry(day, entry)) return false;
  } else await removeFile(diaryPath(day));
  const kept = !entry ? 0 : blobs ? blobs.length : photo === 'keep' ? MAX_PHOTOS : 0;
  for (let i = kept; i < MAX_PHOTOS; i++) await removeFile(photoPath(day, i));
  const next = { ...entries };
  if (entry) next[day] = entry; else delete next[day];
  entries = next;
  changed();
  return true;
}

// ---- reflections ----
export async function saveReflection(key: string, text: string): Promise<boolean> {
  if (!monthFromKey(key)) return false;
  const body = text.replace(/\s+$/, '');
  if (!body.trim()) {
    await removeFile(reflectionPath(key));
    const next = { ...reflections }; delete next[key]; reflections = next;
  } else {
    const r = { text: body, updated: Date.now() };
    if (!await writeReflection(key, r)) return false;
    reflections = { ...reflections, [key]: r };
  }
  changed();
  return true;
}

// ---- settings and people ----
export async function updateExtras(patch: Partial<DiaryExtras>): Promise<boolean> {
  const next = sanitizeExtras({ ...extras, ...patch });
  if (!await writeExtras(next)) return false;
  extras = next;
  changed();
  return true;
}

// ---- backup ----
export async function collectDiary() {
  const diary: Record<number, DiaryEntry> = {};
  const photos: Record<number, Uint8Array> = {};
  const morePhotos: Record<number, Uint8Array[]> = {};
  for (const [k, e] of Object.entries(entries)) {
    const day = Number(k);
    diary[day] = e;
    if (!e.photo) continue;
    const b = await fileBytes(photoPath(day));
    if (!b) continue;
    photos[day] = b;
    for (let i = 1; i < (e.photos ?? 1); i++) { const more = await fileBytes(photoPath(day, i)); if (more) (morePhotos[day] ??= []).push(more); }
  }
  return { diary, photos, morePhotos, reflections, extras };
}

// Replaces everything on disk with a backup's diary. `fallback`: settings from an older backup that kept them in the game.
export async function restoreDiary(b: { diary: Record<number, DiaryEntry>; photos: Record<number, Uint8Array>; morePhotos?: Record<number, Uint8Array[]>; reflections?: Record<string, Reflection>; extras?: DiaryExtras }, fallback: Legacy = {}): Promise<boolean> {
  const x = b.extras && Object.keys(b.extras).length ? b.extras : sanitizeExtras({ trackamaniac: fallback.trackamaniac, moodNames: fallback.moodNames });
  // Written next to the live folder and swapped in only when complete, so a failure leaves the old diary untouched.
  await clearFiles(STAGE);
  const staged = await writeOk(async () => {
    await Filesystem.mkdir({ ...at('', STAGE), recursive: true });
    for (const [k, e] of Object.entries(b.diary)) {
      const day = Number(k);
      if (!await writeEntry(day, e, STAGE)) throw new Error('write');
      if (b.photos[day] && !await writePhoto(day, b.photos[day], STAGE)) throw new Error('write');
      for (const [i, more] of (b.photos[day] ? b.morePhotos?.[day] ?? [] : []).slice(0, MAX_PHOTOS - 1).entries()) if (!await writePhoto(day, more, STAGE, i + 1)) throw new Error('write');
    }
    for (const [key, r] of Object.entries(b.reflections ?? {})) if (!await writeReflection(key, r, STAGE)) throw new Error('write');
    if (Object.keys(x).length && !await writeExtras(x, STAGE)) throw new Error('write');
  });
  if (!staged) { await clearFiles(STAGE); return false; }
  if (!await clearFiles()) { await clearFiles(STAGE); return false; }
  if (!await writeOk(() => Filesystem.rename({ from: STAGE, to: ROOT, directory: Directory.Data, toDirectory: Directory.Data }))) return false;
  entries = { ...b.diary };
  reflections = { ...(b.reflections ?? {}) };
  extras = x;
  ready = true;
  changed();
  return true;
}
