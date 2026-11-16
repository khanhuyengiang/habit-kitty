// The settings file: how the app looks and behaves, without anything personal, so it can be handed to someone else
// ("I want my sister to have my icons and my settings, not my diary or my shopping list"). One JSON file, *.kittyset:
//
//   {
//     "format": "itty-bitty-kitty-settings", "version": 1, "exported": "2026-11-16",
//     "look":    { "theme": "dark", "fancy": true },
//     "habit":   { "allowRename": true, "timeTravel": false, ..., "sound": { "bgm": 40, ... }, "dayStart": 2, "roomName": "Attic" },
//     "diary":   { "trackamaniac": true, ..., "moodNames": { "calm": "Zen" } },
//     "mart":    { "cats": [...], "opts": {...}, "orders": { "aldi": ["produce", "dairy", ...] } },
//     "gallery": { "icons": [...] }
//   }
//
// Every part is optional; loading one replaces only what it covers. Never in it: kitties, habits and their history, diary
// pages, photos, people, reflections, notes, shopping lists, pantry, recipes, regulars, what goes where (Kitty Mart learns
// that from your items), achievements, reminders (they need the phone's permission, and their times are personal),
// and your own music.
import { CONFIG } from './rules.ts';
import { sanitizeExtras, type DiaryExtras } from './store.ts';
import { sanitize as sanitizeShop, type MartSettings } from './shopping/model.ts';
import { sanitize as sanitizePixel, type PixelIcon } from './pixel/model.ts';

export const SETTINGS_FORMAT = 'itty-bitty-kitty-settings';
export const SETTINGS_PREFIX = 'kitty-settings', SETTINGS_EXT = 'kittyset';

export type ThemeMode = 'device' | 'light' | 'dark';
export interface LookSettings { theme: ThemeMode; fancy: boolean }
export const SOUND_KINDS = ['bgm', 'meow', 'purr'] as const;
export interface HabitSettings {
  allowRename?: boolean; showClock?: boolean; timeTravel?: boolean; amnesia?: boolean; unlimited?: boolean;
  sound?: Partial<Record<typeof SOUND_KINDS[number], number>>; muted?: boolean;
  dayStart?: number; roomName?: string; outdoorName?: string;
}
export type DiarySettings = Omit<DiaryExtras, 'people'>;
// Kitty Mart's part (see martSettingsOf): orders is each supermarket's aisle order, by the list's name in lower case.
export type { MartSettings };
export interface GallerySettings { icons: PixelIcon[] }
export interface SettingsFile { look?: LookSettings; habit?: HabitSettings; diary?: DiarySettings; mart?: MartSettings; gallery?: GallerySettings }
export type Part = keyof SettingsFile;
export const PARTS: [Part, string][] = [
  ['look', 'Look (colours, fancy background)'],
  ['habit', 'Habit Kitty options, sounds, your day and room names'],
  ['diary', 'Diary options and emotion names'],
  ['mart', 'Kitty Mart categories (order, icons, colours, shelves), options and aisle order'],
  ['gallery', 'Kitty Gallery icons (new, changed and deleted ones)'],
];

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const NAME_MAX = 30;

export function cleanLook(raw: unknown): LookSettings {
  const r = obj(raw);
  return { theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'device', fancy: r.fancy !== false };
}

export function cleanHabit(raw: unknown): HabitSettings {
  const r = obj(raw), out: HabitSettings = {};
  for (const k of ['allowRename', 'showClock', 'timeTravel', 'amnesia', 'unlimited', 'muted'] as const) { const b = bool(r[k]); if (b !== undefined) out[k] = b; }
  const s = obj(r.sound), sound: HabitSettings['sound'] = {};
  for (const k of SOUND_KINDS) if (typeof s[k] === 'number' && Number.isFinite(s[k])) sound[k] = Math.round(Math.min(100, Math.max(0, s[k] as number)));
  if (Object.keys(sound).length) out.sound = sound;
  if (Number.isInteger(r.dayStart) && (r.dayStart as number) >= 0 && (r.dayStart as number) <= CONFIG.dayStartMax) out.dayStart = r.dayStart as number;
  for (const k of ['roomName', 'outdoorName'] as const) if (typeof r[k] === 'string') out[k] = (r[k] as string).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return out;
}

// The diary's options only: the people (birthdays) are personal, so they are dropped even if a file carries them.
export function cleanDiary(raw: unknown): DiarySettings {
  const { people, ...rest } = sanitizeExtras({ ...obj(raw), people: undefined });
  return rest;
}

export function cleanMart(raw: unknown): MartSettings {
  const r = obj(raw);
  const d = sanitizeShop({ cats: r.cats, opts: r.opts });
  const ids = new Set(d.cats.map((c) => c.id));
  const orders: Record<string, string[]> = {};
  for (const [name, o] of Object.entries(obj(r.orders)).slice(0, 30)) {
    const key = name.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60);
    const order = Array.isArray(o) ? [...new Set(o.filter((c): c is string => typeof c === 'string' && ids.has(c)))] : [];
    if (key && order.length) orders[key] = order;
  }
  return { cats: d.cats, opts: d.opts, orders };
}

export const cleanGallery = (raw: unknown): GallerySettings => ({ icons: sanitizePixel(raw).icons });

// The file's text. Only the parts given are written.
export function settingsText(s: SettingsFile, day: string): string {
  return JSON.stringify({ format: SETTINGS_FORMAT, version: 1, exported: day, ...s }, null, 2) + '\n';
}

// Reads a settings file; throws a message to show when it is not one. Each part is checked, and a part that is not
// there (or is not an object) is left out, so loading it changes nothing of that kind.
export function readSettings(text: string): SettingsFile {
  let raw: Record<string, unknown>;
  try { raw = obj(JSON.parse(text)); } catch { throw new Error("That isn't a settings file."); }
  if (raw.format !== SETTINGS_FORMAT) throw new Error("That isn't a settings file.");
  if (raw.version !== 1) throw new Error('That settings file is from a newer version of the app.');
  const has = (k: string) => !!raw[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k]);
  const out: SettingsFile = {};
  if (has('look')) out.look = cleanLook(raw.look);
  if (has('habit')) out.habit = cleanHabit(raw.habit);
  if (has('diary')) out.diary = cleanDiary(raw.diary);
  if (has('mart')) out.mart = cleanMart(raw.mart);
  if (has('gallery')) out.gallery = cleanGallery(raw.gallery);
  if (!Object.keys(out).length) throw new Error('There are no settings in that file.');
  return out;
}
export const isSettingsText = (text: string) => { try { return obj(JSON.parse(text)).format === SETTINGS_FORMAT; } catch { return false; } };
