// Kitty Gallery's icons on the device: one JSON file in the app's private storage, in its own folder,
//
//   habit-kitty-pixel/icons.json
//
// kept in memory too, and put into the app's icon lists (./live.ts) whenever it is read or changed, so every app uses them.
// The backup (.kitty) carries them (gallery.json), and so does the settings file (see ../settings-file.ts), which hands
// your icons to someone else without your diary. Export (see ./model.ts) is for making them official in the code.
import { jsonFile } from '../shared/jsonfile.ts';
import { applyIcons } from './live.ts';
import { emptyData, sanitize, type PixelData } from './model.ts';

const file = jsonFile('habit-kitty-pixel/icons.json', sanitize, emptyData);

let data: PixelData = emptyData();
let ready = false;

export const pixelData = () => data;
export const pixelReady = () => ready;

let started: Promise<void> | null = null;
export function initPixel(): Promise<void> {
  started ??= (async () => {
    data = await file.read();
    applyIcons(data);
    ready = true;
  })();
  return started;
}

// Replaces the data and writes it; resolves to false when it could not be written.
export function setPixelData(next: PixelData): Promise<boolean> {
  data = next;
  applyIcons(data);
  return file.write(data);
}

// ---- backup ----
// Always there once read (even with no icons of your own), so restoring a backup puts the icons back just as they were.
export const collectPixel = (): string | undefined => (ready ? JSON.stringify(data) : undefined);
export async function restorePixel(text: string): Promise<boolean> {
  const next = file.parse(text);
  if (!next) return false;
  ready = true;
  return setPixelData(next);
}
