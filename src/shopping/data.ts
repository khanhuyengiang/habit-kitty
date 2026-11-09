// Kitty Mart's data on the device: one JSON file in the app's private storage, in its own folder,
//
//   habit-kitty-shopping/shopping.json
//
// kept in memory too, so the screen draws at once. Every change goes through `change`, which keeps the data as it was
// before, so it can be undone (the last 30 changes, until the app is closed).
// Habit Kitty starts this (initShopping) because the backup needs it.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { writeOk } from '../shared/files.ts';
import { BACKUP_PREFIX, markDirty } from '../shared/backupfolder.ts';
import { emptyData, sanitize, type ShopData } from './model.ts';

const FILE = { path: 'habit-kitty-shopping/shopping.json', directory: Directory.Data };
const UNDO_KEPT = 30;

let data: ShopData = emptyData();
let ready = false;
const undos: { data: ShopData; label: string }[] = [];
const listeners = new Set<() => void>();
let writing: Promise<unknown> = Promise.resolve();

export const shopData = () => data;
export const shopReady = () => ready;
export const onShop = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const tell = () => { for (const l of listeners) l(); };

function write(): Promise<boolean> {
  const text = JSON.stringify(data);
  const p = writing.then(() => writeOk(() => Filesystem.writeFile({ ...FILE, data: text, encoding: Encoding.UTF8, recursive: true })));
  writing = p;
  markDirty(BACKUP_PREFIX);
  return p;
}

let started: Promise<void> | null = null;
let resolveInit: () => void = () => {};
export const shopInitialised = new Promise<void>((r) => { resolveInit = r; });
export function initShopping(): Promise<void> {
  started ??= (async () => {
    try {
      const r = await Filesystem.readFile({ ...FILE, encoding: Encoding.UTF8 });
      const text = typeof r.data === 'string' ? r.data : await r.data.text();
      data = sanitize(JSON.parse(text));
    } catch { data = emptyData(); }   // no file yet (or a damaged one): start empty
    ready = true;
    resolveInit();
    tell();
  })();
  return started;
}

// Replaces the data with `next` (from the model's functions, which never change what they are given). `label` says what
// Undo would put back ("Deleted Milk"); with no label the change cannot be undone (a checkbox, say, is undone by unticking it).
export function change(next: ShopData, label?: string): Promise<boolean> {
  if (next === data) return Promise.resolve(true);
  if (label) { undos.push({ data, label }); if (undos.length > UNDO_KEPT) undos.shift(); }
  data = next;
  tell();
  return write();
}
export const undoLabel = () => undos[undos.length - 1]?.label ?? null;
export function undo(): string | null {
  const u = undos.pop();
  if (!u) return null;
  data = u.data;
  tell();
  write();
  return u.label;
}

// ---- backup ----
export const collectShopping = (): string | undefined => (ready && (data.lists.length || data.recipes.length || data.pantry.length || Object.keys(data.regulars).length) ? JSON.stringify(data) : undefined);
export async function restoreShopping(text: string): Promise<boolean> {
  let next: ShopData;
  try { next = sanitize(JSON.parse(text)); } catch { return false; }
  data = next;
  undos.length = 0;
  ready = true;
  tell();
  return write();
}
