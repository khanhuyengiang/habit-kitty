// Cloud sync through the user's own Dropbox: one file, /Apps/<app>/itty-bitty-kitty.kitty, the same as a .kitty backup.
//
//   - nothing changed anywhere: one small request (the file's revision) and done
//   - only this device changed: the file is sent, on the condition that nobody else wrote it meanwhile
//   - the cloud changed: it is fetched and merged with this device (./merge.ts) against the copy of the file as it was
//     last synced (the base, kept on the device), the merge is put into the apps, and sent back if it holds anything
//     the cloud has not got
// Sync runs when the app starts or comes back, a little while after a change, and when the app is left.
//
// Signing in goes through the browser. Dropbox only sends people back to a web address, so the phone app uses the
// website's: the page sees the sign-in is the app's (the `state` starts with "a.") and hands it on through a link the
// app opens (ittybittykitty://dropbox).
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { packBackup, unpackBackup, type Backup } from '../backup.ts';
import { fileBytes, toBase64 } from '../shared/files.ts';
import { getLocal, readJson, setLocal, writeJson } from '../shared/local.ts';
import { onDirty } from '../shared/backupfolder.ts';
import { DropboxError, authorizeUrl, exchangeCode, randomString, revoke, session, type Tokens } from './dropbox.ts';
import { changedParts, mergeBackups, type Part } from './merge.ts';
import { DEVICE_ONLY } from './merge-game.ts';

export const SITE = 'https://khanhuyengiang.com/habit-kitty/';   // the website (GitHub Pages, on its own domain)
const APP_LINK = 'ittybittykitty://dropbox';
const FILE = '/itty-bitty-kitty.kitty';
const BASE_DIR = 'habit-kitty-sync', BASE_FILE = 'base.kitty';
const KEY = 'kitty-sync', KEY_PENDING = 'kitty-sync-pending', KEY_DIRTY = 'kitty-sync-dirty';
const SETTLE_MS = 20_000;      // a change is sent this long after the last one
const RECHECK_MS = 60_000;     // coming back to the app looks for news at most this often

const native = Capacitor.isNativePlatform();

// ---- what the apps give and take ----
export interface SyncTarget {
  collect(): Promise<Backup>;
  // Puts a merged save into the apps (only the parts that changed); resolves to false when it could not.
  apply(b: Backup, parts: Set<Part>): Promise<boolean>;
}
let target: SyncTarget | null = null;
export function registerSyncTarget(t: SyncTarget) { target = t; if (connected()) requestSync(); }

// ---- kept on the device ----
interface Stored { tokens?: Tokens; name?: string; rev?: string; last?: number }
const stored = (): Stored => readJson<Stored>(KEY) ?? {};
const store = (patch: Partial<Stored>) => writeJson(KEY, { ...stored(), ...patch });
const connected = () => !!stored().tokens;

const readBase = async (): Promise<Backup | null> => {
  const bytes = await fileBytes(BASE_FILE, BASE_DIR);
  try { return bytes ? unpackBackup(bytes) : null; } catch { return null; }
};
const writeBase = (bytes: Uint8Array) =>
  Filesystem.writeFile({ path: `${BASE_DIR}/${BASE_FILE}`, data: toBase64(bytes), directory: Directory.Data, recursive: true });
const dropBase = () => Filesystem.deleteFile({ path: `${BASE_DIR}/${BASE_FILE}`, directory: Directory.Data }).catch(() => { /* none */ });

// Something changed here since the last sync. Survives the app being closed; `gen` tells a change made during a sync.
let gen = 0, applying = false;
const isDirty = () => getLocal(KEY_DIRTY) === '1';
onDirty(() => {
  if (applying) return;   // the sync putting a merge in is not a change of this device's own
  gen++;
  setLocal(KEY_DIRTY, '1');
  if (connected()) schedule(SETTLE_MS);
});

// ---- status, for the settings screen ----
export interface SyncStatus { available: boolean; connected: boolean; name: string; running: boolean; last: number; error: string; summary: string }
const listeners = new Set<() => void>();
let status: SyncStatus = { available: false, connected: false, name: '', running: false, last: 0, error: '', summary: '' };
function emit(patch: Partial<SyncStatus> = {}) {
  const s = stored();
  status = { ...status, ...patch, available: syncAvailable(), connected: !!s.tokens, name: s.name ?? '', last: s.last ?? 0 };
  for (const l of listeners) l();
}
export const syncStatus = () => status;
export function onSyncStatus(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

// Signing in needs a web address Dropbox knows: the website (and a local copy of it), or the phone app through it.
export function syncAvailable(): boolean {
  if (native) return true;
  return location.href.startsWith(SITE) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
}
const webRedirect = () => `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
// The web address Dropbox sends the browser back to; it has to be listed in the Dropbox app's settings, exactly.
export const returnAddress = () => (native ? SITE : webRedirect());
// A copy of the website on this computer (not the real one): the settings show its return address, to add to Dropbox.
export const isLocalCopy = () => !native && !location.href.startsWith(SITE);

// ---- signing in ----
interface Pending { state: string; verifier: string; redirect: string }

export async function connectDropbox() {
  const p: Pending = { state: `${native ? 'a' : 'w'}.${randomString(16)}`, verifier: randomString(48), redirect: returnAddress() };
  writeJson(KEY_PENDING, p);
  location.href = await authorizeUrl(p);   // on the phone this opens the browser
}

async function finishSignIn(q: URLSearchParams) {
  const p = readJson<Pending>(KEY_PENDING);
  if (!p || q.get('state') !== p.state) return;   // not ours, or already used
  setLocal(KEY_PENDING, null);
  const code = q.get('code');
  if (!code) { emit({ error: q.get('error') === 'access_denied' ? '' : "Dropbox didn't connect. Try again." }); return; }
  try {
    const tokens = await exchangeCode({ code, verifier: p.verifier, redirect: p.redirect });
    store({ tokens, rev: undefined, last: undefined });
    await dropBase();   // a new connection may be to another account: its file starts the history afresh
    let name = '';
    try { name = await session(tokens, (t) => store({ tokens: t })).accountName(); } catch { /* shown without a name */ }
    store({ name });
    emit({ error: '' });
    requestSync();
  } catch { emit({ error: "Couldn't connect to Dropbox. Try again." }); }
}

export async function disconnectDropbox() {
  const t = stored().tokens;
  setLocal(KEY, null);
  setLocal(KEY_DIRTY, null);
  await dropBase();
  emit({ error: '', summary: '' });
  if (t) await revoke(t);
}

// On the website, at the very start: the page Dropbox sent the browser back to. Returns true when this page is only a
// stop on the way back to the phone app (and should not start the apps).
export function handleSignInReturn(): boolean {
  const q = new URLSearchParams(location.search);
  const state = q.get('state');
  if (!state || !(q.has('code') || q.has('error'))) return false;
  if (state.startsWith('a.') && !native) { backToApp(q); return true; }
  history.replaceState(null, '', location.pathname + location.hash);
  finishSignIn(q);
  return false;
}

function backToApp(q: URLSearchParams) {
  const intent = `intent://dropbox?${q}#Intent;scheme=ittybittykitty;package=local.habitkitty.app;end`;
  document.querySelectorAll<HTMLElement>('[data-app-root]').forEach((el) => { el.hidden = true; });
  const box = document.createElement('div');
  box.className = 'panel';
  box.style.cssText = 'max-width:28rem;margin:3rem auto;text-align:center';
  box.innerHTML = '<h3>Almost done</h3><p>Dropbox is connected. Going back to Itty Bitty Kitty…</p><div class="btns"><a class="btn primary"></a></div>';
  const a = box.querySelector('a') as HTMLAnchorElement;
  a.href = intent;
  a.textContent = 'Open Itty Bitty Kitty';
  document.body.prepend(box);
  location.href = intent;
}

// ---- syncing ----
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null, again = false, lastCheck = 0;
function schedule(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(() => requestSync(), ms);
}

// Runs a sync now (or right after the one running). Never throws: problems end up in the status.
export function requestSync(): Promise<void> {
  clearTimeout(timer);
  if (!connected() || !target) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    emit({ running: true });
    try { emit({ summary: await doSync(), error: '' }); }
    catch (e) { emit({ error: describe(e) }); }
    finally {
      running = null;
      emit({ running: false });
      if (again) { again = false; requestSync(); }
    }
  })();
  return running;
}

function describe(e: unknown): string {
  if (e instanceof DropboxError) {
    if (e.signedOut) { setLocal(KEY, null); return 'Dropbox signed this device out. Connect again.'; }
    if (e.status === 507 || /insufficient_space/.test(e.summary)) return 'Your Dropbox is full.';
    if (e.status === 429 || e.status >= 500) return 'Dropbox is busy. Trying again later.';
    return "Couldn't sync with Dropbox.";
  }
  if (e instanceof TypeError) return 'Offline. Syncing when back online.';
  return "Couldn't sync with Dropbox.";
}

// On the first sync nothing tells which side changed what, so the cloud's version leads (a new device joining should take
// what is already there, not push its fresh defaults over it), but this device keeps its own device-only settings.
function keepDeviceSettings(merged: Backup, local: Backup): Backup {
  if (!merged.game || !local.game) return merged;
  const g = { ...(merged.game as Record<string, unknown>) }, l = local.game as Record<string, unknown>;
  for (const k of DEVICE_ONLY) { if (l[k] === undefined) delete g[k]; else g[k] = l[k]; }
  return { ...merged, game: g };
}

async function doSync(): Promise<string> {
  const t = target!;
  const s = session(stored().tokens!, (tokens) => store({ tokens }));
  const startGen = gen, dirty = isDirty();
  let rev = await s.rev(FILE);
  lastCheck = Date.now();
  if (rev && rev === stored().rev && !dirty) return 'Up to date';

  for (let tries = 0; tries < 4; tries++) {
    const local = await t.collect();
    let theirs: { backup: Backup; bytes: Uint8Array } | null = null;
    if (rev && rev !== stored().rev) {   // the cloud has something this device has not seen yet
      const got = await s.download(FILE);
      if (got) { rev = got.rev; theirs = { backup: unpackBackup(got.bytes), bytes: got.bytes }; } else rev = null;
    }

    let result = local, got = 0;
    if (theirs) {
      const base = stored().rev ? await readBase() : null;
      result = base
        ? await mergeBackups(base, local, theirs.backup)
        : keepDeviceSettings(await mergeBackups(null, theirs.backup, local), local);
      const parts = changedParts(local, result);
      got = parts.size;
      if (got) {
        applying = true;
        let ok: boolean;
        try { ok = await t.apply(result, parts); } finally { applying = false; }
        if (!ok) throw new Error('apply');
      }
    }

    let newRev: string, baseBytes: Uint8Array;
    if (theirs && rev && !changedParts(theirs.backup, result).size) {
      newRev = rev; baseBytes = theirs.bytes;   // the cloud already holds exactly this
    } else {
      baseBytes = packBackup(result);
      try { newRev = await s.upload(FILE, baseBytes, rev); }
      catch (e) {
        if (e instanceof DropboxError && e.conflict) { rev = await s.rev(FILE); continue; }   // written meanwhile: merge that too
        throw e;
      }
    }
    await writeBase(baseBytes);
    store({ rev: newRev, last: Date.now() });
    if (gen === startGen) setLocal(KEY_DIRTY, null);
    return got ? 'Got changes from your other devices' : 'Sent this device\'s changes';
  }
  throw new Error('kept changing');
}

// ---- when ----
export function initSync() {
  emit();
  document.addEventListener('visibilitychange', () => {
    if (!connected()) return;
    if (document.hidden) { if (isDirty()) requestSync(); }
    else if (Date.now() - lastCheck > RECHECK_MS) requestSync();
  });
  window.addEventListener('online', () => { if (connected()) requestSync(); });
  if (native) {
    const fromLink = (url: string) => { if (url.startsWith(APP_LINK)) finishSignIn(new URL(url.replace(/^ittybittykitty:/, 'https:')).searchParams); };
    App.addListener('appUrlOpen', ({ url }) => fromLink(url));
    App.getLaunchUrl().then((u) => { if (u?.url) fromLink(u.url); }).catch(() => { /* none */ });
  }
}
