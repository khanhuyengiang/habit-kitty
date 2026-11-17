// Storage formats for the three parts of a save: the game, the diary (one Markdown file per day) and
// the photos (one small JPEG per day). The same layout is used on the phone and inside a .kitty backup.
//
//   manifest.json            { app, format, exportedAt }
//   game.json                cats, tasks, settings (no diary)
//   diary/2026-10-12.md      frontmatter (mood, mood2, feeling, weather, photo, updated) + the text as plain Markdown
//   photos/2026-10-12.jpg
//   gallery.json             Kitty Gallery's icons (your drawings and changes), as kept on the device
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { ACHIEVEMENT_ENTRY, ACHIEVEMENT_MAX, COMBINED_APP, isZip } from './shared/backupformat.ts';
export { ACHIEVEMENT_ENTRY, isZip };
import { PHOTO_MAX_BYTES } from './shared/photo.ts';
import {
  EXTRAS_FILE, MAX_PHOTOS, dayFromName, diaryPath, entryFromMarkdown, entryToMarkdown, monthFromKey, photoPath, reflectionPath, sanitizeExtras,
  type DiaryEntry, type DiaryExtras, type Reflection,
} from './diary/model.ts';
import { MAX_NOTES, MAX_TEXT, safeName } from './notes/model.ts';

// Format 2 can carry Kitty Achievement's whole save as one more entry (achievement.achkitty, itself a zip, see achievement/backup.ts),
// so one file backs up both apps. Format 1 files (Habit Kitty only) still load. Newer entries (notes, shopping.json,
// gallery.json) were added without a new format: an older app skips what it does not know.
export const BACKUP_FORMAT = 2;
// Every photo (on the phone and in a backup) is scaled to fit under PHOTO_MAX_BYTES, so a backup stays small.
export { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE } from './shared/photo.ts';

export interface Backup {
  game: unknown;                     // null in a file that only holds Kitty Achievement (an old .achkitty save)
  diary: Record<number, DiaryEntry>;
  photos: Record<number, Uint8Array>;
  morePhotos?: Record<number, Uint8Array[]>;   // a page's second, third and fourth photos
  achievement?: Uint8Array;          // Kitty Achievement's save file, as is
  reflections?: Record<string, Reflection>;   // by month, 'YYYY-MM'
  extras?: DiaryExtras;
  notes?: Record<string, string>;     // the notes, by name (notes/<name>.md in the file)
  shopping?: string;                  // Kitty Mart's data, as JSON (shopping.json in the file)
  gallery?: string;                   // Kitty Gallery's icons, as JSON (gallery.json in the file); none in a backup from before it
}

export function packBackup(b: Backup, exportedAt = Date.now()): Uint8Array {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    'manifest.json': strToU8(JSON.stringify({ app: COMBINED_APP, format: BACKUP_FORMAT, exportedAt })),
    'game.json': strToU8(JSON.stringify(b.game)),
  };
  for (const [key, r] of Object.entries(b.reflections ?? {})) {
    if (monthFromKey(key) && r.text.trim()) files[reflectionPath(key)] = strToU8(entryToMarkdown({ text: r.text, updated: r.updated }));
  }
  for (const [name, text] of Object.entries(b.notes ?? {})) if (name === safeName(name) && text.length <= MAX_TEXT) files[`notes/${name}.md`] = strToU8(text);
  if (b.shopping) files['shopping.json'] = strToU8(b.shopping);
  if (b.gallery) files['gallery.json'] = strToU8(b.gallery);
  const extras = sanitizeExtras(b.extras);
  if (Object.keys(extras).length) files[EXTRAS_FILE] = strToU8(JSON.stringify(extras));
  if (b.achievement) files[ACHIEVEMENT_ENTRY] = [b.achievement, { level: 0 }];   // photos inside are JPEGs already
  for (const [k, e] of Object.entries(b.diary)) {
    const day = Number(k);
    const more = b.photos[day] ? (b.morePhotos?.[day] ?? []).slice(0, MAX_PHOTOS - 1) : [];
    files[diaryPath(day)] = strToU8(entryToMarkdown({ ...e, photo: !!b.photos[day], photos: more.length ? more.length + 1 : undefined }));
    more.forEach((bytes, i) => { files[photoPath(day, i + 1)] = [bytes, { level: 0 }]; });
  }
  for (const [k, bytes] of Object.entries(b.photos)) {
    if (b.diary[Number(k)]) files[photoPath(Number(k))] = [bytes, { level: 0 }];   // a JPEG does not shrink further
  }
  return zipSync(files);
}

// Throws when the bytes are not a Habit Kitty backup.
export function unpackBackup(bytes: Uint8Array): Backup {
  let total = 0;
  const files = unzipSync(bytes, { filter: (f) => {   // refuse zip bombs: each file, and all of them together, stay small
    total += f.originalSize;
    if (f.name === ACHIEVEMENT_ENTRY) return f.originalSize < ACHIEVEMENT_MAX && total < ACHIEVEMENT_MAX + 64_000_000;
    return f.originalSize < 8_000_000 && total < ACHIEVEMENT_MAX + 64_000_000 && (!f.name.startsWith('photos/') || f.originalSize <= PHOTO_MAX_BYTES * 4);
  } });
  if (!files['manifest.json']) throw new Error('not a backup');
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  // An Kitty Achievement save on its own (the older separate file): there is no game in it.
  if (manifest?.app === 'achievement-kitty') return { game: null, diary: {}, photos: {}, achievement: bytes };
  if (!files['game.json'] || manifest?.app !== COMBINED_APP || ![1, BACKUP_FORMAT].includes(manifest.format)) throw new Error('unsupported backup');
  const diary: Record<number, DiaryEntry> = {};
  const photos: Record<number, Uint8Array> = {};
  const morePhotos: Record<number, Uint8Array[]> = {};
  for (const [path, data] of Object.entries(files)) {
    const m = /^(diary|photos)\/(\d{4}-\d{2}-\d{2})(?:-([234]))?\.(md|jpg)$/.exec(path);
    const day = m ? dayFromName(m[2]) : null;
    if (!m || day === null) continue;
    if (m[1] === 'diary' && m[4] === 'md' && !m[3]) {
      const e = entryFromMarkdown(strFromU8(data));
      if (e) diary[day] = e;
    } else if (m[1] === 'photos' && m[4] === 'jpg') {
      if (!m[3]) photos[day] = data; else (morePhotos[day] ??= [])[Number(m[3]) - 2] = data;
    }
  }
  for (const [k, e] of Object.entries(diary)) {   // the photo files are the truth
    const day = Number(k);
    e.photo = !!photos[day];
    const more = (morePhotos[day] ?? []).filter(Boolean);
    morePhotos[day] = more;
    if (!more.length) delete morePhotos[day];
    if (e.photo && more.length) e.photos = more.length + 1; else delete e.photos;
  }
  const reflections: Record<string, Reflection> = {};
  for (const [path, data] of Object.entries(files)) {
    const m = /^reflections\/(\d{4}-\d{2})\.md$/.exec(path);
    const e = m && monthFromKey(m[1]) ? entryFromMarkdown(strFromU8(data)) : null;
    if (m && e && e.text.trim()) reflections[m[1]] = { text: e.text, updated: e.updated };
  }
  const notes: Record<string, string> = {};
  for (const [path, data] of Object.entries(files)) {
    const m = /^notes\/(.+)\.md$/.exec(path);
    if (!m || m[1] !== safeName(m[1]) || Object.keys(notes).length >= MAX_NOTES) continue;
    const text = strFromU8(data);
    if (text.length <= MAX_TEXT) notes[m[1]] = text;
  }
  let extras: DiaryExtras = {};
  try { if (files[EXTRAS_FILE]) extras = sanitizeExtras(JSON.parse(strFromU8(files[EXTRAS_FILE]))); } catch { /* ignore a damaged settings file */ }
  return { game: JSON.parse(strFromU8(files['game.json'])), diary, photos, morePhotos, reflections, extras, notes, ...(files['shopping.json'] && { shopping: strFromU8(files['shopping.json']) }), ...(files['gallery.json'] && { gallery: strFromU8(files['gallery.json']) }), ...(files[ACHIEVEMENT_ENTRY] && { achievement: files[ACHIEVEMENT_ENTRY] }) };
}
