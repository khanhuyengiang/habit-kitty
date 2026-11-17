// The diary's data: a page per day (kept as Markdown with a small frontmatter), the monthly reflections, the people whose
// birthdays it reminds you of and its own settings (diary.json), with the file names they are kept under, on the phone
// and inside a .kitty backup (see ../store.ts). No screen and no storage here: ./data.ts keeps it on the device.
import { dateOf, dayOf, two } from '../shared/dates.ts';

export const MOOD_KEYS = ['joyful', 'calm', 'tired', 'sad', 'stressed'] as const;
export type Mood = typeof MOOD_KEYS[number];
// One diary page per day, keyed by day index. `photo` says whether photos/<date>.jpg exists.
// A weather is the id of one in WEATHER (src/pixelart.ts): the official ones, or one drawn in Kitty Gallery.
export type Weather = string;
const WEATHER_ID = /^[a-z][a-z0-9]{0,31}$/i;
// `mood2` is an optional second emotion (the kitty is drawn half and half); `feeling` is the user's own word for it and
// replaces the emotion name on the page; `weather` is only set when the Meteorokinesis option is on.
// `title` is only used while the Titles option is on; `star` marks a day to remember (only with Starry Nights): happy is a
// yellow star, sad an upside-down blue one; `note` is the name of a linked note.
export const STAR_KEYS = ['happy', 'sad'] as const;
export type Star = typeof STAR_KEYS[number];
// `photos` is how many photos the page has when that is more than one (the Photographer option allows 1, 2 or 4): the first is
// photos/<date>.jpg, the others photos/<date>-2.jpg, -3.jpg and -4.jpg.
export const MAX_PHOTOS = 4;
export interface DiaryEntry { text: string; title?: string; location?: string; photos?: number; icon?: string; mood?: Mood; mood2?: Mood; feeling?: string; weather?: Weather; star?: Star; note?: string; photo?: boolean; updated: number }

// A person whose birthday the diary reminds you of. `year` is optional (the age is only shown when it is known).
export interface Person { id: string; name: string; month: number; day: number; year?: number; note?: string }
// Monthly reflection: one note for a whole month, kept as reflections/YYYY-MM.md.
export interface Reflection { text: string; updated: number }
// The diary's own settings and the people, kept in diary.json next to the pages.
export interface DiaryExtras { trackamaniac?: boolean; teleportation?: boolean; photographer?: boolean; titles?: boolean; starry?: boolean; moodNames?: Partial<Record<Mood, string>>; people?: Person[] }


export const dayName = (day: number) => dateOf(day).toISOString().slice(0, 10);
export function dayFromName(name: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(name);
  if (!m) return null;
  const day = dayOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayName(day) === name ? day : null;
}
export const diaryPath = (day: number) => `diary/${dayName(day)}.md`;
export const photoPath = (day: number, i = 0) => `photos/${dayName(day)}${i ? `-${i + 1}` : ''}.jpg`;   // i: 0 for the first photo

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

// A page shows its photos, or instead an icon: the name of a sticker icon (Kitty Gallery's too; one that is gone is drawn as a heart).
const ICON_NAME = /^[\w-]{1,40}$/;

export function entryToMarkdown(e: DiaryEntry): string {
  const feeling = e.feeling?.replace(/\s+/g, ' ').trim();
  const title = e.title?.replace(/\s+/g, ' ').trim();
  const note = e.note?.replace(/\s+/g, ' ').trim();
  const location = e.location?.replace(/\s+/g, ' ').trim();
  const head = [title ? `title: ${title}` : '', e.star ? `star: ${e.star}` : '', note ? `note: ${note}` : '', location ? `location: ${location}` : '', e.mood ? `mood: ${e.mood}` : '', e.mood && e.mood2 && e.mood2 !== e.mood ? `mood2: ${e.mood2}` : '', feeling ? `feeling: ${feeling}` : '', e.weather ? `weather: ${e.weather}` : '', e.photo ? 'photo: yes' : '', e.photo && e.photos && e.photos > 1 ? `photos: ${Math.min(e.photos, MAX_PHOTOS)}` : '', !e.photo && e.icon && ICON_NAME.test(e.icon) ? `icon: ${e.icon}` : '', `updated: ${Math.round(e.updated)}`].filter(Boolean);
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
  const weather = WEATHER_ID.test(meta.weather ?? '') ? meta.weather : undefined;
  const star = (STAR_KEYS as readonly string[]).includes(meta.star) ? (meta.star as Star) : undefined;
  const updated = Number(meta.updated);
  const count = Number(meta.photos);
  return { text: m[2].replace(/\n$/, ''), ...(meta.title && { title: meta.title }), ...(star && { star }), ...(meta.note && { note: meta.note }), ...(meta.location && { location: meta.location }), mood, ...(mood2 && { mood2 }), ...(meta.feeling && { feeling: meta.feeling }), ...(weather && { weather }), ...(meta.photo === 'yes' && Number.isInteger(count) && count > 1 && count <= MAX_PHOTOS && { photos: count }), ...(meta.photo !== 'yes' && ICON_NAME.test(meta.icon ?? '') && { icon: meta.icon }), photo: meta.photo === 'yes', updated: Number.isFinite(updated) ? updated : 0 };
}
