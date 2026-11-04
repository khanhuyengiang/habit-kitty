// A save file is a zip, the same layout on the phone and in a backup:
//   manifest.json   { app, format, exportedAt }
//   data.json       the records (see model.ts)
//   photos/<id>.jpg one file per photo; a record's "idb:<id>" reference points at it
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Data } from './model.ts';
import { IDB_PREFIX } from './storage.ts';
import { migrate } from './ops.ts';

export const BACKUP_FORMAT = 1;
export const BACKUP_EXT = 'achkitty';
const MAX_FILE = 8_000_000, MAX_TOTAL = 256_000_000;

export const isZip = (b: Uint8Array) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;
export const photoFile = (ref: string) => `photos/${ref.slice(IDB_PREFIX.length)}.jpg`;

export async function packBackup(d: Data, photos: Map<string, Blob>, exportedAt = Date.now()): Promise<Uint8Array> {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    'manifest.json': strToU8(JSON.stringify({ app: 'achievement-kitty', format: BACKUP_FORMAT, exportedAt })),
    'data.json': strToU8(JSON.stringify(d)),
  };
  const refs = new Set([...d.photos.map((p) => p.imageUrl), d.user.avatarUrl ?? ''].filter((r) => r.startsWith(IDB_PREFIX)));
  for (const ref of refs) {
    const blob = photos.get(ref);
    if (blob) files[photoFile(ref)] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];   // a JPEG does not shrink further
  }
  return zipSync(files);
}

const looksValid = (d: any): d is Data => !!d && d.version === 1 && !!d.user && [d.mainQuests, d.sideQuests, d.achievements, d.photos].every(Array.isArray);

// Throws when the bytes are not an Achievement Kitty save file.
export function unpackBackup(bytes: Uint8Array): { data: Data; photos: Map<string, Blob> } {
  if (!isZip(bytes)) throw new Error('not a backup');
  let total = 0;
  const files = unzipSync(bytes, { filter: (f) => { total += f.originalSize; return f.originalSize < MAX_FILE && total < MAX_TOTAL; } });   // refuse zip bombs
  if (!files['manifest.json'] || !files['data.json']) throw new Error('not a backup');
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  if (manifest?.app !== 'achievement-kitty' || manifest.format !== BACKUP_FORMAT) throw new Error('unsupported backup');
  const data = JSON.parse(strFromU8(files['data.json']));
  if (!looksValid(data)) throw new Error('unreadable data');
  const photos = new Map<string, Blob>();
  for (const [path, bytes] of Object.entries(files)) {
    const m = /^photos\/([\w-]+)\.jpg$/.exec(path);
    if (m) photos.set(`${IDB_PREFIX}${m[1]}`, new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
  }
  return { data: migrate(data), photos };
}
