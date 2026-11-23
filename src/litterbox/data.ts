// Kitty Litterbox's data on the device: one JSON file in the app's private storage, in its own folder,
//
//   habit-kitty-litterbox/litterbox.json
//
// kept in memory too, so the screen draws at once. Every change goes through `change`, which keeps the data as it was
// before, so it can be undone (the last 30 changes, until the app is closed). Same shape as Kitty Mart's (../shopping/data.ts).
import { jsonFile } from '../shared/jsonfile.ts';
import { emptyData, sanitize, type LitterData } from './model.ts';

const file = jsonFile('habit-kitty-litterbox/litterbox.json', sanitize, emptyData);
const UNDO_KEPT = 30;

let data: LitterData = emptyData();
let ready = false;
const undos: { data: LitterData; label: string }[] = [];
const listeners = new Set<() => void>();

export const litterData = () => data;
export const litterReady = () => ready;
export const onLitter = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const tell = () => { for (const l of listeners) l(); };

let started: Promise<void> | null = null;
let resolveInit: () => void = () => {};
export const litterInitialised = new Promise<void>((r) => { resolveInit = r; });
export function initLitterbox(): Promise<void> {
  started ??= (async () => {
    data = await file.read();
    ready = true;
    resolveInit();
    tell();
  })();
  return started;
}

// Replaces the data with `next` (from the model's functions, which never change what they are given). `label` says what
// Undo would put back ("Skipped Bedsheet"); with no label the change cannot be undone.
export function change(next: LitterData, label?: string): Promise<boolean> {
  if (next === data) return Promise.resolve(true);
  if (label) { undos.push({ data, label }); if (undos.length > UNDO_KEPT) undos.shift(); }
  data = next;
  tell();
  return file.write(data);
}
export const undoLabel = () => undos[undos.length - 1]?.label ?? null;
// The change Undo would put back (the same object until another change or an undo), so a screen can tell it apart.
export const undoTop = (): object | null => undos[undos.length - 1] ?? null;
export function undo(): string | null {
  const u = undos.pop();
  if (!u) return null;
  data = u.data;
  tell();
  file.write(data);
  return u.label;
}

// ---- backup ----
// Left out only while it is just as a new Kitty Litterbox starts (so restoring an older backup can't wipe it by accident).
export const collectLitterbox = (): string | undefined => (ready && JSON.stringify(data) !== JSON.stringify(emptyData()) ? JSON.stringify(data) : undefined);
export async function restoreLitterbox(text: string): Promise<boolean> {
  const next = file.parse(text);
  if (!next) return false;
  data = next;
  undos.length = 0;
  ready = true;
  tell();
  return file.write(data);
}
