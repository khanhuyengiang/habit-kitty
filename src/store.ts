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

export const MOOD_KEYS = ['joyful', 'calm', 'tired', 'sad', 'stressed'] as const;
export type Mood = typeof MOOD_KEYS[number];
// One diary page per day, keyed by day index. `photo` says whether photos/<date>.jpg exists.
export const WEATHER_KEYS = ['sunny', 'cloudy', 'rainy', 'storm', 'snow'] as const;
export type Weather = typeof WEATHER_KEYS[number];
// `mood2` is an optional second emotion (the kitty is drawn half and half); `feeling` is the user's own word for it and
// replaces the emotion name on the page; `weather` is only set when the Trackamaniac option is on.
export interface DiaryEntry { text: string; mood?: Mood; mood2?: Mood; feeling?: string; weather?: Weather; photo?: boolean; updated: number }

// Format 2 can carry Achievement Kitty's whole save as one more entry (achievement.achkitty, itself a zip, see achievement/backup.ts),
// so one file backs up both apps. Format 1 files (Habit Kitty only) still load.
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
export const photoPath = (day: number) => `photos/${dayName(day)}.jpg`;

export function entryToMarkdown(e: DiaryEntry): string {
  const feeling = e.feeling?.replace(/\s+/g, ' ').trim();
  const head = [e.mood ? `mood: ${e.mood}` : '', e.mood && e.mood2 && e.mood2 !== e.mood ? `mood2: ${e.mood2}` : '', feeling ? `feeling: ${feeling}` : '', e.weather ? `weather: ${e.weather}` : '', e.photo ? 'photo: yes' : '', `updated: ${Math.round(e.updated)}`].filter(Boolean);
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
  const updated = Number(meta.updated);
  return { text: m[2].replace(/\n$/, ''), mood, ...(mood2 && { mood2 }), ...(meta.feeling && { feeling: meta.feeling }), ...(weather && { weather }), photo: meta.photo === 'yes', updated: Number.isFinite(updated) ? updated : 0 };
}

export interface Backup {
  game: unknown;                     // null in a file that only holds Achievement Kitty (an old .achkitty save)
  diary: Record<number, DiaryEntry>;
  photos: Record<number, Uint8Array>;
  achievement?: Uint8Array;          // Achievement Kitty's save file, as is
}

export function packBackup(b: Backup, exportedAt = Date.now()): Uint8Array {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    'manifest.json': strToU8(JSON.stringify({ app: 'habit-kitty', format: BACKUP_FORMAT, exportedAt })),
    'game.json': strToU8(JSON.stringify(b.game)),
  };
  if (b.achievement) files[ACHIEVEMENT_ENTRY] = [b.achievement, { level: 0 }];   // photos inside are JPEGs already
  for (const [k, e] of Object.entries(b.diary)) {
    const day = Number(k);
    files[diaryPath(day)] = strToU8(entryToMarkdown({ ...e, photo: !!b.photos[day] }));
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
  // An Achievement Kitty save on its own (the older separate file): there is no game in it.
  if (manifest?.app === 'achievement-kitty') return { game: null, diary: {}, photos: {}, achievement: bytes };
  if (!files['game.json'] || manifest?.app !== 'habit-kitty' || ![1, BACKUP_FORMAT].includes(manifest.format)) throw new Error('unsupported backup');
  const diary: Record<number, DiaryEntry> = {};
  const photos: Record<number, Uint8Array> = {};
  for (const [path, data] of Object.entries(files)) {
    const m = /^(diary|photos)\/(.+)\.(md|jpg)$/.exec(path);
    const day = m ? dayFromName(m[2]) : null;
    if (!m || day === null) continue;
    if (m[1] === 'diary' && m[3] === 'md') {
      const e = entryFromMarkdown(strFromU8(data));
      if (e) diary[day] = e;
    } else if (m[1] === 'photos' && m[3] === 'jpg') photos[day] = data;
  }
  for (const [k, e] of Object.entries(diary)) e.photo = !!photos[Number(k)];   // the photo file is the truth
  return { game: JSON.parse(strFromU8(files['game.json'])), diary, photos, ...(files[ACHIEVEMENT_ENTRY] && { achievement: files[ACHIEVEMENT_ENTRY] }) };
}
