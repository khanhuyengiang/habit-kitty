// Kitty Gallery's icons on the device: one JSON file in the app's private storage, in its own folder,
//
//   habit-kitty-pixel/icons.json
//
// kept in memory too. It is not part of the backup: Export (see ./model.ts) writes the file that takes them anywhere.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { writeOk } from '../shared/files.ts';
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
    ready = true;
  })();
  return started;
}

// Replaces the data and writes it; resolves to false when it could not be written.
export function setPixelData(next: PixelData): Promise<boolean> {
  data = next;
  const text = JSON.stringify(data);
  const p = writing.then(() => writeOk(() => Filesystem.writeFile({ ...FILE, data: text, encoding: Encoding.UTF8, recursive: true })));
  writing = p;
  return p as Promise<boolean>;
}
