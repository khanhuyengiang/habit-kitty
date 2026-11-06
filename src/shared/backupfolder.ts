// Backups you can find on the phone, for both apps:
//   saveToDevice()   "save as": the system picker asks where one file goes (on the web it is a normal download)
//   auto-backup      one folder, picked once; a fresh dated file per app lands there whenever you leave the app after changes,
//                    and the newest few are kept (rules in ../backup-schedule.ts)
// Android only (the BackupFolder plugin). There is one backup file for both apps: Habit Kitty registers it (registerBackupSource)
// and builds it, with Achievement Kitty's save inside.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { KEEP_BACKUPS, backupName, backupsOf, isDue, toPrune } from '../backup-schedule.ts';

interface FolderState { chosen: boolean; ok: boolean; name?: string }
interface BackupFolderPlugin {
  folder(): Promise<FolderState>;
  pickFolder(): Promise<FolderState>;
  forget(): Promise<void>;
  put(o: { cache: string; name: string; dir?: string }): Promise<void>;
  list(o?: { dir?: string }): Promise<{ files: { name: string; modified: number; size: number }[] }>;
  fetch(o: { name: string; cache: string; dir?: string }): Promise<void>;
  remove(o: { name: string; dir?: string }): Promise<void>;
  saveAs(o: { cache: string; name: string }): Promise<{ name: string }>;
}
const Plugin = registerPlugin<BackupFolderPlugin>('BackupFolder');
export const nativeBackups = Capacitor.isNativePlatform();

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const base64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const isCancel = (e: unknown) => /cancel/i.test(String((e as Error)?.message ?? e));

async function toCache(name: string, bytes: Uint8Array) {
  await Filesystem.writeFile({ path: name, data: bytesToBase64(bytes), directory: Directory.Cache });
}
const dropCache = (name: string) => Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => { /* already gone */ });

// ---- save as ----
// Resolves to where it went ('' when only a download), or null when the user backed out. Throws when saving failed.
export async function saveToDevice(name: string, bytes: Uint8Array): Promise<string | null> {
  if (!nativeBackups) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    return '';
  }
  await toCache(name, bytes);
  try { return (await Plugin.saveAs({ cache: name, name })).name; }
  catch (e) { if (isCancel(e)) return null; throw e; }
  finally { await dropCache(name); }
}

// The one backup file, today's name; throws when Habit Kitty has not registered it.
export const BACKUP_PREFIX = 'habit-kitty', BACKUP_EXT = 'kitty';
const wholeBackup = () => {
  const s = sources.find((x) => x.prefix === BACKUP_PREFIX);
  if (!s) throw new Error('no backup');
  return s.pack();
};
export const saveBackupToDevice = async () => saveToDevice(backupName(BACKUP_PREFIX, BACKUP_EXT), await wholeBackup());

// The share sheet (Drive, Bluetooth, mail...); Android only.
export async function shareBackup() {
  const name = backupName(BACKUP_PREFIX, BACKUP_EXT);
  await toCache(name, await wholeBackup());
  try {
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    await Share.share({ title: 'Habit Kitty backup', files: [uri], dialogTitle: 'Share your backup' });
  } finally { await dropCache(name); }
}

// ---- auto-backup ----
export interface BackupSource {
  prefix: string;                      // files are <prefix>-YYYY-MM-DD.<ext>
  ext: string;
  pack(): Promise<Uint8Array>;
}
export interface BackupStatus {
  native: boolean;
  folder: FolderState;                 // chosen but not ok: the folder is gone or access was taken away
  last: number;                        // when the newest backup was made (0: never)
  error: string;                       // what went wrong last time, '' when fine
  running: boolean;
}

const sources: BackupSource[] = [];
const KEY_LAST = 'kitty-backup-last', KEY_DIRTY = 'kitty-backup-dirty';
const listeners = new Set<() => void>();
let status: BackupStatus = { native: nativeBackups, folder: { chosen: false, ok: false }, last: 0, error: '', running: false };

const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* the backup still runs; it just may repeat after a restart */ } };
const lastOf = (p: string): number => Number((read(KEY_LAST) ?? {})[p]) || 0;
const dirtyOf = (p: string): boolean => !!(read(KEY_DIRTY) ?? {})[p];
function setMap(key: string, p: string, v: number | boolean | null) {
  const m = { ...(read(key) ?? {}) };
  if (v === null || v === false) delete m[p]; else m[p] = v;
  write(key, m);
}

function emit(patch: Partial<BackupStatus>) {
  status = { ...status, ...patch, last: Math.max(0, ...sources.map((s) => lastOf(s.prefix))) };
  for (const l of listeners) l();
}
export const backupStatus = () => status;
export function onBackupStatus(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function registerBackupSource(s: BackupSource) { sources.push(s); emit({}); }
// Call after anything the source packs has changed.
export function markDirty(prefix: string) { setMap(KEY_DIRTY, prefix, true); }

export async function refreshFolder() {
  if (!nativeBackups) return;
  try { emit({ folder: await Plugin.folder() }); } catch { emit({ folder: { chosen: false, ok: false } }); }
}

export async function chooseFolder(): Promise<boolean> {
  try {
    const f = await Plugin.pickFolder();
    emit({ folder: f, error: '' });
    for (const s of sources) markDirty(s.prefix);   // the new folder starts with a full set
    await runBackup({ force: true });
    return true;
  } catch (e) {
    if (!isCancel(e)) emit({ error: "Couldn't use that folder. Pick another one." });
    return false;
  }
}

export async function stopBackups() {
  try { await Plugin.forget(); } catch { /* nothing to forget */ }
  emit({ folder: { chosen: false, ok: false }, error: '' });
}

let chain: Promise<unknown> = Promise.resolve();
// Backs up every source that is due (all of them with `force`). Runs one at a time; never throws.
export function runBackup(o: { force?: boolean; launch?: boolean } = {}): Promise<void> {
  const run = chain.then(() => doBackup(o)).catch(() => { /* reported through the status */ });
  chain = run;
  return run;
}

async function doBackup(o: { force?: boolean; launch?: boolean }) {
  if (!nativeBackups) return;
  await refreshFolder();
  if (!status.folder.chosen) return;
  if (!status.folder.ok) { emit({ error: "Can't reach the backup folder. Choose it again." }); return; }
  const now = Date.now();
  const due = sources.filter((s) => o.force || isDue({ dirty: dirtyOf(s.prefix), last: lastOf(s.prefix), now, launch: o.launch }));
  if (!due.length) return;
  emit({ running: true, error: '' });
  let error = '';
  for (const s of due) {
    const name = backupName(s.prefix, s.ext);
    try {
      await toCache(name, await s.pack());
      await Plugin.put({ cache: name, name });
      setMap(KEY_LAST, s.prefix, Date.now());
      setMap(KEY_DIRTY, s.prefix, false);
      const names = (await Plugin.list()).files.map((f) => f.name);
      for (const old of toPrune(names, s.prefix, s.ext, KEEP_BACKUPS)) await Plugin.remove({ name: old }).catch(() => { /* try again next time */ });
    } catch (e) {
      error = String((e as Error)?.message ?? e) === 'no-folder' ? "Can't reach the backup folder. Choose it again." : "Couldn't write the backup. Is there room on the phone?";
    } finally { await dropCache(name); }
  }
  emit({ running: false, error });
}

export const backupNow = () => runBackup({ force: true });

// ---- files in a subfolder of the backup folder (the notes go in Notes/, where Obsidian can open them) ----
export interface FolderFile { name: string; modified: number }
export async function listSubfolder(dir: string): Promise<FolderFile[]> {
  return (await Plugin.list({ dir })).files.map((f) => ({ name: f.name, modified: f.modified }));
}
export async function putInSubfolder(dir: string, name: string, bytes: Uint8Array): Promise<void> {
  const cache = `put-${Math.random().toString(36).slice(2)}`;
  await toCache(cache, bytes);
  try { await Plugin.put({ cache, name, dir }); } finally { await dropCache(cache); }
}
export async function readFromSubfolder(dir: string, name: string): Promise<Uint8Array> {
  const cache = `get-${Math.random().toString(36).slice(2)}`;
  await Plugin.fetch({ name, cache, dir });
  try {
    const r = await Filesystem.readFile({ path: cache, directory: Directory.Cache });
    return typeof r.data === 'string' ? base64ToBytes(r.data) : new Uint8Array(await r.data.arrayBuffer());
  } finally { await dropCache(cache); }
}
export const removeFromSubfolder = (dir: string, name: string) => Plugin.remove({ name, dir });
// True when a backup folder was chosen and can be written to.
export const folderUsable = async () => { await refreshFolder(); return status.folder.chosen && status.folder.ok; };

// The backups in the folder for one app, newest first.
export async function folderBackups(prefix: string, ext: string): Promise<string[]> {
  return backupsOf((await Plugin.list()).files.map((f) => f.name), prefix, ext);
}
export async function readFolderBackup(name: string): Promise<Uint8Array> {
  const cache = `restore-${name}`;
  await Plugin.fetch({ name, cache });
  try {
    const r = await Filesystem.readFile({ path: cache, directory: Directory.Cache });
    return typeof r.data === 'string' ? base64ToBytes(r.data) : new Uint8Array(await r.data.arrayBuffer());
  } finally { await dropCache(cache); }
}

if (nativeBackups) {
  // Leaving the app is the moment to back up: the phone may close it for good right after.
  document.addEventListener('visibilitychange', () => { if (document.hidden) runBackup(); });
  // Once after start (when both apps had a moment to register), for a backup that went stale.
  setTimeout(() => runBackup({ launch: true }), 8000);
  refreshFolder();
}
