// The notes folder: Notes/ inside the backup folder you chose, where Obsidian (or any editor) can open the notes as .md files.
// Planning is in sync.ts; this does the reading and writing. Android only, and only when a backup folder is chosen.
import { folderUsable, listSubfolder, nativeBackups, putInSubfolder, readFromSubfolder, removeFromSubfolder } from '../shared/backupfolder.ts';
import { MAX_TEXT, safeName, uniqueName } from './model.ts';
import { allNotes, noteOf, notesReady, onNoteRemoved, onNotes, putRaw, reload, statNotes } from './data.ts';
import { planSync, type SyncState } from './sync.ts';

const SUBFOLDER = 'Notes';
const KEY_ON = 'kitty-notes-sync', KEY_STATE = 'kitty-notes-sync-state', KEY_LAST = 'kitty-notes-sync-last';

const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* it just syncs from scratch next time */ } };

export interface NotesSyncStatus { available: boolean; on: boolean; running: boolean; last: number; error: string; summary: string }
let status: NotesSyncStatus = { available: nativeBackups, on: !!read(KEY_ON), running: false, last: Number(read(KEY_LAST)) || 0, error: '', summary: '' };
const listeners = new Set<() => void>();
const emit = (p: Partial<NotesSyncStatus>) => { status = { ...status, ...p }; for (const l of listeners) l(); };
export const notesSyncStatus = () => status;
export const onNotesSyncStatus = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

let chain: Promise<unknown> = Promise.resolve();
export function syncNotes(): Promise<void> {
  const run = chain.then(doSync).catch(() => emit({ running: false, error: "Couldn't sync the notes. Check the backup folder." }));
  chain = run;
  return run;
}

async function doSync() {
  if (!status.available || !status.on || !notesReady()) return;
  if (!await folderUsable()) { emit({ error: "Can't reach the backup folder. Choose it again in Backup." }); return; }
  emit({ running: true, error: '' });
  const state: SyncState = { ...(read(KEY_STATE) ?? {}) };
  const remote = async () => (await listSubfolder(SUBFOLDER)).filter((f) => f.name.endsWith('.md') && safeName(f.name.slice(0, -3)) === f.name.slice(0, -3))
    .map((f) => ({ name: f.name.slice(0, -3), modified: f.modified }));
  const before = await remote();
  const remoteTime = new Map(before.map((r) => [r.name, r.modified]));
  let pushed = 0, pulled = 0, kept = 0;
  for (const a of planSync(await statNotes(), before, state)) {
    const file = `${a.name}.md`;
    const mine = noteOf(a.name);
    if (a.type === 'push' && mine) { await putInSubfolder(SUBFOLDER, file, enc(mine.text)); pushed++; continue; }
    if (a.type === 'pull' || a.type === 'conflict') {
      const theirs = dec(await readFromSubfolder(SUBFOLDER, file));
      if (theirs.length > MAX_TEXT) continue;
      if (a.type === 'pull' || !mine) { if (await putRaw(a.name, theirs)) pulled++; continue; }
      if (theirs === mine.text) continue;   // the same text on both sides: nothing to do
      // different on both sides: the newer one keeps the name, the other is kept next to it
      const theirsNewer = (remoteTime.get(a.name) ?? 0) > mine.mtime;
      const loser = theirsNewer ? mine.text : theirs;
      await putRaw(uniqueName(`${a.name} (conflict)`, allNotes().map((n) => n.name)), loser);
      if (theirsNewer) { await putRaw(a.name, theirs); pulled++; } else { await putInSubfolder(SUBFOLDER, file, enc(mine.text)); pushed++; }
      kept++;
    }
  }
  // push whatever the conflicts and pulls created here (the copies), then remember both sides' times
  const names = new Set((await remote()).map((r) => r.name));
  for (const n of allNotes()) if (!names.has(n.name)) { await putInSubfolder(SUBFOLDER, `${n.name}.md`, enc(n.text)); pushed++; }
  await reload(false);   // the screens were told by every note that changed
  const after = new Map((await remote()).map((r) => [r.name, r.modified]));
  const next: SyncState = {};
  for (const l of await statNotes()) { const r = after.get(l.name); if (r !== undefined) next[l.name] = { l: l.mtime, r }; }
  write(KEY_STATE, next);
  const now = Date.now();
  write(KEY_LAST, now);
  emit({ running: false, last: now, error: '', summary: [pushed && `${pushed} sent`, pulled && `${pulled} received`, kept && `${kept} kept as a conflict copy`].filter(Boolean).join(', ') || 'Up to date' });
}

export async function setNotesSync(on: boolean): Promise<void> {
  if (on && !await folderUsable()) { emit({ on: false, error: 'Choose a backup folder first (Settings → Backup).' }); return; }
  write(KEY_ON, on);
  emit({ on, error: '' });
  if (on) await syncNotes();
}

// A note deleted in the app is deleted from the folder too (best effort; the folder's copy would otherwise come back).
onNoteRemoved((name) => {
  if (!status.on || !status.available) return;
  removeFromSubfolder(SUBFOLDER, `${name}.md`).catch(() => { /* a leftover is pulled back next sync */ });
  const st: SyncState = { ...(read(KEY_STATE) ?? {}) };
  if (name in st) { delete st[name]; write(KEY_STATE, st); }
});

if (nativeBackups) {
  document.addEventListener('visibilitychange', () => { if (document.hidden) syncNotes(); });   // leaving the app is the moment to sync
  setTimeout(() => syncNotes(), 10_000);
  let timer = 0;
  onNotes(() => { clearTimeout(timer); timer = window.setTimeout(() => syncNotes(), 30_000); });   // soon after you stop editing
}
