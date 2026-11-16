// Kitty Gallery's icons on the device: one JSON file in the app's private storage, in its own folder,
//
//   habit-kitty-pixel/icons.json
//
// kept in memory too, and put into the app's icon lists (./live.ts) whenever it is read or changed, so every app uses them.
// The backup (.kitty) carries them (gallery.json), and so does the settings file (see ../settings-file.ts), which hands
// your icons to someone else without your diary. Export (see ./model.ts) is for making them official in the code.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { writeOk } from '../shared/files.ts';
import { BACKUP_PREFIX, markDirty } from '../shared/backupfolder.ts';
import { applyIcons } from './live.ts';
import { emptyData, sanitize, type PixelData } from './model.ts';

const FILE = { path: 'habit-kitty-pixel/icons.json', directory: Directory.Data };

let data: PixelData = emptyData();
let ready = false;
let writing: Promise<unknown> = Promise.resolve();

export const pixelData = () => data;
export const pixelReady = () => ready;

let started: Promise<void> | null = null;
export function initPixel(): Promise<void> {
  started ??= (async () => {
    try {
      const r = await Filesystem.readFile({ ...FILE, encoding: Encoding.UTF8 });
      const text = typeof r.data === 'string' ? r.data : await r.data.text();
      data = sanitize(JSON.parse(text));
    } catch { data = emptyData(); }   // no file yet (or a damaged one): start empty
    applyIcons(data);
    ready = true;
  })();
  return started;
}

// Replaces the data and writes it; resolves to false when it could not be written.
export function setPixelData(next: PixelData): Promise<boolean> {
  data = next;
  applyIcons(data);
  const text = JSON.stringify(data);
  const p = writing.then(() => writeOk(() => Filesystem.writeFile({ ...FILE, data: text, encoding: Encoding.UTF8, recursive: true })));
  writing = p;
  markDirty(BACKUP_PREFIX);
  return p as Promise<boolean>;
}

// ---- backup ----
// Always there once read (even with no icons of your own), so restoring a backup puts the icons back just as they were.
export const collectPixel = (): string | undefined => (ready ? JSON.stringify(data) : undefined);
export async function restorePixel(text: string): Promise<boolean> {
  let next: PixelData;
  try { next = sanitize(JSON.parse(text)); } catch { return false; }
  ready = true;
  return setPixelData(next);
}
