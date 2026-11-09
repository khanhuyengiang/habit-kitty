// Storage formats for the three parts of a save: the game, the diary (one Markdown file per day) and
// the photos (one small JPEG per day). The same layout is used on the phone and inside a .kitty backup.
//
//   manifest.json            { app, format, exportedAt }
//   game.json                cats, tasks, settings (no diary)
//   diary/2026-10-12.md      frontmatter (mood, mood2, feeling, weather, photo, updated) + the text as plain Markdown
//   photos/2026-10-12.jpg
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { dateOf, dayOf } from './calendar.ts';
import { PHOTO_MAX_BYTES } from './shared/photo.ts';
import { MAX_NOTES, MAX_TEXT, safeName } from './notes/model.ts';

export const MOOD_KEYS = ['joyful', 'calm', 'tired', 'sad', 'stressed'] as const;
export type Mood = typeof MOOD_KEYS[number];
// One diary page per day, keyed by day index. `photo` says whether photos/<date>.jpg exists.
export const WEATHER_KEYS = ['sunny', 'cloudy', 'windy', 'rainy', 'storm', 'snow'] as const;
export type Weather = typeof WEATHER_KEYS[number];
// `mood2` is an optional second emotion (the kitty is drawn half and half); `feeling` is the user's own word for it and
// replaces the emotion name on the page; `weather` is only set when the Meteorokinesis option is on.
// `title` is only used while the Titles option is on; `star` marks a day to remember (only with Starry Nights): happy is a
// yellow star, sad an upside-down blue one; `note` is the name of a linked note.
export const STAR_KEYS = ['happy', 'sad'] as const;
export type Star = typeof STAR_KEYS[number];
// `photos` is how many photos the page has when that is more than one (the Photographer option allows 1, 2 or 4): the first is
// photos/<date>.jpg, the others photos/<date>-2.jpg, -3.jpg and -4.jpg.
export const MAX_PHOTOS = 4;
export interface DiaryEntry { text: string; title?: string; location?: string; photos?: number; mood?: Mood; mood2?: Mood; feeling?: string; weather?: Weather; star?: Star; note?: string; photo?: boolean; updated: number }

// Format 2 can carry Kitty Achievement's whole save as one more entry (achievement.achkitty, itself a zip, see achievement/backup.ts),
// so one file backs up both apps. Format 1 files (Habit Kitty only) still load.
// A person whose birthday the diary reminds you of. `year` is optional (the age is only shown when it is known).
export interface Person { id: string; name: string; month: number; day: number; year?: number; note?: string }
// Monthly reflection: one note for a whole month, kept as reflections/YYYY-MM.md.
export interface Reflection { text: string; updated: number }
// The diary's own settings and the people, kept in diary.json next to the pages.
export interface DiaryExtras { trackamaniac?: boolean; teleportation?: boolean; photographer?: boolean; titles?: boolean; starry?: boolean; moodNames?: Partial<Record<Mood, string>>; people?: Person[] }

export const BACKUP_FORMAT = 2;
export const ACHIEVEMENT_ENTRY = 'achievement.achkitty';
const ACHIEVEMENT_MAX = 128_000_000;
// Every photo (on the phone and in a backup) is scaled to fit under PHOTO_MAX_BYTES, so a backup stays small.
export { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE } from './shared/photo.ts';

export const dayName = (day: number) => dateOf(day).toISOString().slice(0, 10);
export function dayFromName(name: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(name);
  if (!m) return null;
  const day = dayOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayName(day) === name ? day : null;
}
export const diaryPath = (day: number) => `diary/${dayName(day)}.md`;
export const photoPath = (day: number, i = 0) => `photos/${dayName(day)}${i ? `-${i + 1}` : ''}.jpg`;   // i: 0 for the first photo

const two = (n: number) => String(n).padStart(2, '0');
export const monthKey = (y: number, m: number) => `${y}-${two(m + 1)}`;                 // m is 0-based, like Date
export const reflectionPath = (key: string) => `reflections/${key}.md`;
export const monthFromKey = (key: string): { y: number; m: number } | null => {
  const r = /^(\d{4})-(\d{2})$/.exec(key);
  return r && Number(r[2]) >= 1 && Number(r[2]) <= 12 ? { y: Number(r[1]), m: Number(r[2]) - 1 } : null;
};
export const EXTRAS_FILE = 'diary.json';

const MAX_NAME = 40, MAX_NOTE = 200;
// Anything read from a file or a backup is checked before use: only well-formed people, known moods, booleans.
export function sanitizeExtras(raw: unknown): DiaryExtras {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: DiaryExtras = {};
  if (r.trackamaniac === true) out.trackamaniac = true;
  if (r.teleportation === true) out.teleportation = true;
  if (r.photographer === true) out.photographer = true;
  if (r.titles === true) out.titles = true;
  if (r.starry === true) out.starry = true;
  if (r.moodNames && typeof r.moodNames === 'object') {
    const names: Partial<Record<Mood, string>> = {};
    for (const k of MOOD_KEYS) { const v = (r.moodNames as Record<string, unknown>)[k]; if (typeof v === 'string' && v.trim()) names[k] = v.trim().slice(0, 14); }
    if (Object.keys(names).length) out.moodNames = names;
  }
  if (Array.isArray(r.people)) {
    const people: Person[] = [];
    for (const p of r.people as Record<string, unknown>[]) {
      const name = typeof p?.name === 'string' ? p.name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
      const month = Number(p?.month), day = Number(p?.day);
      if (!name || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > new Date(Date.UTC(2024, month, 0)).getUTCDate()) continue;
      const year = Number(p?.year);
      const note = typeof p?.note === 'string' ? p.note.trim().slice(0, MAX_NOTE) : '';
      people.push({ id: typeof p?.id === 'string' && p.id ? p.id.slice(0, 64) : `${people.length}-${name}`, name, month, day,
        ...(Number.isInteger(year) && year >= 1900 && year <= 2200 && p?.year != null ? { year } : {}), ...(note && { note }) });
    }
    if (people.length) out.people = people;
  }
  return out;
}

export function entryToMarkdown(e: DiaryEntry): string {
  const feeling = e.feeling?.replace(/\s+/g, ' ').trim();
  const title = e.title?.replace(/\s+/g, ' ').trim();
  const note = e.note?.replace(/\s+/g, ' ').trim();
  const location = e.location?.replace(/\s+/g, ' ').trim();
  const head = [title ? `title: ${title}` : '', e.star ? `star: ${e.star}` : '', note ? `note: ${note}` : '', location ? `location: ${location}` : '', e.mood ? `mood: ${e.mood}` : '', e.mood && e.mood2 && e.mood2 !== e.mood ? `mood2: ${e.mood2}` : '', feeling ? `feeling: ${feeling}` : '', e.weather ? `weather: ${e.weather}` : '', e.photo ? 'photo: yes' : '', e.photo && e.photos && e.photos > 1 ? `photos: ${Math.min(e.photos, MAX_PHOTOS)}` : '', `updated: ${Math.round(e.updated)}`].filter(Boolean);
  return `---\n${head.join('\n')}\n---\n${e.text}\n`;
}

export function entryFromMarkdown(md: string): DiaryEntry | null {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md.replace(/\r\n/g, '\n'));
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const mood = (MOOD_KEYS as readonly string[]).includes(meta.mood) ? (meta.mood as Mood) : undefined;
  const mood2 = mood && (MOOD_KEYS as readonly string[]).includes(meta.mood2) && meta.mood2 !== mood ? (meta.mood2 as Mood) : undefined;
  const weather = (WEATHER_KEYS as readonly string[]).includes(meta.weather) ? (meta.weather as Weather) : undefined;
  const star = (STAR_KEYS as readonly string[]).includes(meta.star) ? (meta.star as Star) : undefined;
  const updated = Number(meta.updated);
  const count = Number(meta.photos);
  return { text: m[2].replace(/\n$/, ''), ...(meta.title && { title: meta.title }), ...(star && { star }), ...(meta.note && { note: meta.note }), ...(meta.location && { location: meta.location }), mood, ...(mood2 && { mood2 }), ...(meta.feeling && { feeling: meta.feeling }), ...(weather && { weather }), ...(meta.photo === 'yes' && Number.isInteger(count) && count > 1 && count <= MAX_PHOTOS && { photos: count }), photo: meta.photo === 'yes', updated: Number.isFinite(updated) ? updated : 0 };
}

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
}

export function packBackup(b: Backup, exportedAt = Date.now()): Uint8Array {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    'manifest.json': strToU8(JSON.stringify({ app: 'habit-kitty', format: BACKUP_FORMAT, exportedAt })),
    'game.json': strToU8(JSON.stringify(b.game)),
  };
  for (const [key, r] of Object.entries(b.reflections ?? {})) {
    if (monthFromKey(key) && r.text.trim()) files[reflectionPath(key)] = strToU8(entryToMarkdown({ text: r.text, updated: r.updated }));
  }
  for (const [name, text] of Object.entries(b.notes ?? {})) if (name === safeName(name) && text.length <= MAX_TEXT) files[`notes/${name}.md`] = strToU8(text);
  if (b.shopping) files['shopping.json'] = strToU8(b.shopping);
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

export const isZip = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;

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
  if (!files['game.json'] || manifest?.app !== 'habit-kitty' || ![1, BACKUP_FORMAT].includes(manifest.format)) throw new Error('unsupported backup');
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
  return { game: JSON.parse(strFromU8(files['game.json'])), diary, photos, morePhotos, reflections, extras, notes, ...(files['shopping.json'] && { shopping: strFromU8(files['shopping.json']) }), ...(files[ACHIEVEMENT_ENTRY] && { achievement: files[ACHIEVEMENT_ENTRY] }) };
}
