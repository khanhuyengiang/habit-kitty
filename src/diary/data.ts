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
import { Encoding, Filesystem } from '@capacitor/filesystem';
import { ROOT, at, fileBytes, fileNames, fileText, removeFile, stagedReplace, toBase64, writeOk } from '../shared/files.ts';
import {
  EXTRAS_FILE, MAX_PHOTOS, dayFromName, diaryPath, entryFromMarkdown, entryToMarkdown, monthFromKey, photoPath, reflectionPath, sanitizeExtras,
  type DiaryEntry, type DiaryExtras, type Reflection,
} from './model.ts';
import { BACKUP_PREFIX, markDirty } from '../shared/backupfolder.ts';
import { publishHabitStats } from '../shared/stats.ts';

const STAGE = 'habit-kitty-restore';   // a restore is written here first, then swapped in
const writeText = (path: string, text: string, root = ROOT) =>
  writeOk(() => Filesystem.writeFile({ ...at(path, root), data: text, encoding: Encoding.UTF8, recursive: true }));
const writeBytes = (path: string, bytes: Uint8Array, root = ROOT) =>
  writeOk(() => Filesystem.writeFile({ ...at(path, root), data: toBase64(bytes), recursive: true }));

const writeEntry = (day: number, e: DiaryEntry, root = ROOT) => writeText(diaryPath(day), entryToMarkdown(e), root);
const writePhoto = (day: number, bytes: Uint8Array, root = ROOT, i = 0) => writeBytes(photoPath(day, i), bytes, root);
const writeReflection = (key: string, r: Reflection, root = ROOT) => writeText(reflectionPath(key), entryToMarkdown({ text: r.text, updated: r.updated }), root);
const writeExtras = (x: DiaryExtras, root = ROOT) => writeText(EXTRAS_FILE, JSON.stringify(x), root);

async function readEntries(): Promise<Record<number, DiaryEntry>> {
  const out: Record<number, DiaryEntry> = {};
  const photos = new Set(await fileNames('photos'));
  await Promise.all((await fileNames('diary')).map(async (name) => {
    const day = dayFromName(name.replace(/\.md$/, ''));
    const md = day === null ? undefined : await fileText(`diary/${name}`);
    const e = md !== undefined && entryFromMarkdown(md);
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
    const md = monthFromKey(key) ? await fileText(`reflections/${name}`) : undefined;
    const e = md !== undefined && entryFromMarkdown(md);
    if (e && e.text.trim()) out[key] = { text: e.text, updated: e.updated };
  }));
  return out;
}

async function readExtras(): Promise<DiaryExtras | null> {
  const json = await fileText(EXTRAS_FILE);
  if (json === undefined) return null;
  try { return sanitizeExtras(JSON.parse(json)); } catch { return {}; }
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

const hasPage = (e?: DiaryEntry) => !!e && (!!e.text.trim() || !!e.photo || !!e.icon);   // a written page, a photo or an icon turns the day pink
export const diaryEntries = () => entries;
export const entryOf = (day: number): DiaryEntry | undefined => entries[day];
export const hasPageOn = (day: number) => hasPage(entries[day]);
export const pageDue = (day: number): number => (ready && !hasPage(entries[day]) ? 1 : 0);   // the number on Kitty Journal's key on the home page
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
let started: Promise<void> | null = null;
let resolveInit: () => void = () => {};
// Resolves once Habit Kitty has started the diary (whether or not the files could be read).
export const diaryInitialised = new Promise<void>((r) => { resolveInit = r; });

// The diary settings a v0.5.0 backup kept in the game instead.
export interface Legacy { trackamaniac?: boolean; moodNames?: DiaryExtras['moodNames'] }

// Reads everything (a new diary starts with every option on).
export function initDiary(): Promise<void> {
  started ??= (async () => {
    entries = await readEntries();
    reflections = await readReflections();
    const stored = await readExtras();
    if (stored) extras = stored;
    else { extras = { ...ALL_ON }; await writeExtras(extras); }
    ready = true;
    resolveInit();
    publishHabitStats({ diaryDays: dayCount() });
    for (const l of listeners) l();
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
  const ok = await stagedReplace(ROOT, STAGE, async () => {
    for (const [k, e] of Object.entries(b.diary)) {
      const day = Number(k);
      if (!await writeEntry(day, e, STAGE)) throw new Error('write');
      if (b.photos[day] && !await writePhoto(day, b.photos[day], STAGE)) throw new Error('write');
      for (const [i, more] of (b.photos[day] ? b.morePhotos?.[day] ?? [] : []).slice(0, MAX_PHOTOS - 1).entries()) if (!await writePhoto(day, more, STAGE, i + 1)) throw new Error('write');
    }
    for (const [key, r] of Object.entries(b.reflections ?? {})) if (!await writeReflection(key, r, STAGE)) throw new Error('write');
    if (Object.keys(x).length && !await writeExtras(x, STAGE)) throw new Error('write');
  });
  if (!ok) return false;
  entries = { ...b.diary };
  reflections = { ...(b.reflections ?? {}) };
  extras = x;
  ready = true;
  changed();
  return true;
}
