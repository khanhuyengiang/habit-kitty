// Kitty Mart's data on the device: one JSON file in the app's private storage, in its own folder,
//
//   habit-kitty-shopping/shopping.json
//
// kept in memory too, so the screen draws at once. Every change goes through `change`, which keeps the data as it was
// before, so it can be undone (the last 30 changes, until the app is closed).
// Habit Kitty starts this (initShopping) because the backup needs it.
import { jsonFile } from '../shared/jsonfile.ts';
import { emptyData, sanitize, type ShopData } from './model.ts';

const file = jsonFile('habit-kitty-shopping/shopping.json', sanitize, emptyData);
const UNDO_KEPT = 30;

let data: ShopData = emptyData();
let ready = false;
const undos: { data: ShopData; label: string }[] = [];
const listeners = new Set<() => void>();

export const shopData = () => data;
export const shopReady = () => ready;
export const onShop = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const tell = () => { for (const l of listeners) l(); };

const write = () => file.write(data);

let started: Promise<void> | null = null;
let resolveInit: () => void = () => {};
export const shopInitialised = new Promise<void>((r) => { resolveInit = r; });
export function initShopping(): Promise<void> {
  started ??= (async () => {
    data = await file.read();
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
// The change Undo would put back (the same object until another change or an undo), so a screen can tell it apart.
export const undoTop = (): object | null => undos[undos.length - 1] ?? null;
export function undo(): string | null {
  const u = undos.pop();
  if (!u) return null;
  data = u.data;
  tell();
  write();
  return u.label;
}

// ---- backup ----
// Left out only while it is just as a new Kitty Mart starts (so restoring an older backup can't wipe it by accident).
export const collectShopping = (): string | undefined => (ready && JSON.stringify(data) !== JSON.stringify(emptyData()) ? JSON.stringify(data) : undefined);
export async function restoreShopping(text: string): Promise<boolean> {
  const next = file.parse(text);
  if (!next) return false;
  data = next;
  undos.length = 0;
  ready = true;
  tell();
  return write();
}
