// Kitty Gallery, pure so it can be tested: the kinds of picture you can draw, the official ones that ship with the app,
// your own drawings and changes, their groups, and the export file.
//
// An icon is rows of letters, like the art in the code (see src/achievement/icons.ts). Each category has a fixed size
// and its own letters. In a sticker or a card friend, `s` is the BASE COLOUR: it is not one colour but whatever colour
// the card, note or category it sits on has (that is why the heart turns from pink to blue with its note).
//
// What you draw lives only in Kitty Gallery (it is not in the backup) until it is made official: Export writes a file
// (the format is below) to put in the repo, and its icons are then copied into the code by hand.
import { CARD_FRIENDS, PALETTE_INKS, PICKER_ICONS, UI_ICONS } from '../achievement/pixelart.ts';
import { ICONS } from '../pixelart.ts';
import { PALETTE, type PaletteName } from '../shared/palette.ts';

export type CategoryId = 'sticker' | 'friend' | 'button';
export interface Category {
  id: CategoryId;
  label: string;
  where: string;      // where the app shows them
  w: number; h: number;   // the size of a new one (an official one keeps its own size)
  letters: string;    // the letters you can draw with, in the palette's order
  outline: boolean;   // the dark outline and the lit and shaded edges are added for you
}
// The colours of a sticker or a card friend as the drawing board lists them, three to a row: the base colour (it follows the card)
// on top, then one row per family in rainbow order (by hue), a family never split; a row that has fewer is left short.
export const BASE_ROWS = ['sld', 'o'];
export const INK_ROWS = ['R', 'fuU', 'Y', 'yjJ', 'c', 'xzZ', 'G', 'gmM', 'biI', 'B', 'vaA', 'rpP', 'nN', 'wkK'];
// Every other palette colour can be drawn too (picked with "Choose a colour"), each with its own sign.
export const MORE_INKS = Object.keys(PALETTE_INKS).join('');
const INKS = [...BASE_ROWS, ...INK_ROWS].join('') + MORE_INKS;
export const CATEGORIES: Category[] = [
  { id: 'sticker', label: 'Sticker icon', where: 'Notes, Kitty Achievement cards and side quests, Kitty Mart categories', w: 16, h: 16, letters: INKS, outline: true },
  { id: 'friend', label: 'Card friend', where: 'The little friends in the corner of a Kitty Achievement card', w: 9, h: 9, letters: INKS, outline: false },
  { id: 'button', label: 'Button icon', where: 'The small one-colour icons on buttons', w: 7, h: 7, letters: 'o', outline: false },
];
export const categoryOf = (id: CategoryId): Category => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
export const isCategory = (v: unknown): v is CategoryId => CATEGORIES.some((c) => c.id === v);

// What each letter is called, and the palette colour it is (the base colours have none: they follow the card).
export const LETTERS: Record<string, { name: string; palette?: PaletteName }> = {
  s: { name: 'Base colour' }, l: { name: 'Base, lit' }, d: { name: 'Base, shaded' },
  o: { name: 'Dark line' },
  w: { name: 'Cream', palette: 'cream' }, c: { name: 'Butter', palette: 'butter50' },
  y: { name: 'Sun', palette: 'sun300' }, Y: { name: 'Orange', palette: 'orange' },
  r: { name: 'Pink', palette: 'pink300' }, R: { name: 'Red', palette: 'red' },
  g: { name: 'Mint', palette: 'mint200' }, G: { name: 'Green', palette: 'green500' },
  b: { name: 'Sky', palette: 'blue300' }, B: { name: 'Blue', palette: 'blue500' },
  n: { name: 'Wood', palette: 'wood' }, N: { name: 'Taupe', palette: 'taupe' },
  k: { name: 'Light grey', palette: 'grey200' }, K: { name: 'Grey', palette: 'grey600' },
  v: { name: 'Lavender', palette: 'lavender300' }, f: { name: 'Peach', palette: 'peach' }, x: { name: 'Lime', palette: 'lime' },
  p: { name: 'Pink, lit' }, P: { name: 'Pink, shaded' }, a: { name: 'Lavender, lit' }, A: { name: 'Lavender, shaded' },
  i: { name: 'Sky, lit' }, I: { name: 'Sky, shaded' }, m: { name: 'Mint, lit' }, M: { name: 'Mint, shaded' },
  j: { name: 'Sun, lit' }, J: { name: 'Sun, shaded' }, u: { name: 'Peach, lit' }, U: { name: 'Peach, shaded' },
  z: { name: 'Lime, lit' }, Z: { name: 'Lime, shaded' },
  // the rest of the palette, named after it: lavender100 is "Lavender 100", slateBlue "Slate blue"
  ...Object.fromEntries(Object.entries(PALETTE_INKS).map(([ch, k]) => [ch, { name: paletteLabel(k), palette: k }])),
};
// Palette colours in rainbow order: by hue in 30° steps from red, light to dark in each step; the greys (hardly any colour) last.
export function byHue(chars: string[]): string[] {
  const key = (ch: string) => {
    const n = parseInt(PALETTE[LETTERS[ch]?.palette ?? 'white'].slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min, l = (max + min) / 2;
    const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
    const h = c === 0 ? 0 : 60 * (max === r ? ((g - b) / c + 6) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4);
    return { step: s < 0.2 ? 99 : Math.floor(((h + 15) % 360) / 30), l };
  };
  const keys = new Map(chars.map((ch) => [ch, key(ch)]));
  return [...chars].sort((a, b) => keys.get(a)!.step - keys.get(b)!.step || keys.get(b)!.l - keys.get(a)!.l);
}
export function paletteLabel(k: string): string {
  const words = k.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export const letterName = (cat: CategoryId, ch: string) => (cat === 'button' && ch === 'o' ? 'Ink' : LETTERS[ch]?.name ?? ch);

export const DEFAULT_GROUP = 'default', USER_GROUP = 'user';
export const LIMITS = { name: 30, group: 30, icons: 500 };

// ---- the official icons, from the code ----
export interface Official { id: string; name: string; group: string; art: string[] }
const titleCase = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
export function officials(cat: CategoryId): Official[] {
  if (cat === 'sticker') return Object.entries(PICKER_ICONS).map(([id, v]) => ({ id, name: v.label, group: v.group ?? DEFAULT_GROUP, art: v.art }));
  if (cat === 'friend') return Object.entries(CARD_FRIENDS).map(([id, v]) => ({ id, name: v.label, group: DEFAULT_GROUP, art: v.art }));
  // Habit Kitty's button icons, then Kitty Achievement's that Habit Kitty has not got
  const all: Record<string, string[]> = { ...ICONS };
  for (const [id, art] of Object.entries(UI_ICONS)) all[id] ??= art;
  return Object.entries(all).map(([id, art]) => ({ id, name: titleCase(id), group: DEFAULT_GROUP, art }));
}
export const officialOf = (cat: CategoryId, id: string) => officials(cat).find((o) => o.id === id);

// ---- your icons ----
// A drawing of your own, or a change to an official icon (it has the official one's id).
export interface PixelIcon { category: CategoryId; id: string; name: string; group: string; art: string[]; updated: number }
export interface PixelData { version: 1; icons: PixelIcon[] }
export const emptyData = (): PixelData => ({ version: 1, icons: [] });

export type Status = 'official' | 'changed' | 'new';
export interface Shown extends Official { status: Status }

// Every icon of a category as Kitty Gallery lists it: the official ones (with your changes) in the code's order, then yours.
export function iconsOf(data: PixelData, cat: CategoryId): Shown[] {
  const mine = data.icons.filter((i) => i.category === cat);
  const byId = new Map(mine.map((i) => [i.id, i]));
  const offs = officials(cat);
  const shown: Shown[] = offs.map((o) => {
    const m = byId.get(o.id);
    return m ? { id: o.id, name: m.name, group: m.group, art: m.art, status: 'changed' } : { ...o, status: 'official' };
  });
  const offIds = new Set(offs.map((o) => o.id));
  for (const m of mine) if (!offIds.has(m.id)) shown.push({ id: m.id, name: m.name, group: m.group, art: m.art, status: 'new' });
  return shown;
}
export const statusOf = (cat: CategoryId, id: string): 'changed' | 'new' => (officialOf(cat, id) ? 'changed' : 'new');

// The groups in order: default, user, then the rest A to Z.
export function groupsOf(icons: { group: string }[]): string[] {
  const set = new Set(icons.map((i) => i.group));
  const rest = [...set].filter((g) => g !== DEFAULT_GROUP && g !== USER_GROUP).sort((a, b) => a.localeCompare(b));
  return [...[DEFAULT_GROUP, USER_GROUP].filter((g) => set.has(g)), ...rest];
}

// Icons A to Z by name (ignoring case and accents, and "Drink 2" after "Drink 1"), as each group lists them.
export const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

export const cleanName = (raw: string, fallback = 'Untitled') => raw.replace(/\s+/g, ' ').trim().slice(0, LIMITS.name) || fallback;
// A group is a short name in lower case, so "User" and "user" are the same group.
export const cleanGroup = (raw: string, fallback = USER_GROUP) => raw.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, LIMITS.group) || fallback;

// An id for a new icon, from its name: lower-case letters and digits, as the code's names are ("icecream"), and not taken.
export function newId(name: string, cat: CategoryId, data: PixelData): string {
  const base = (name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^[0-9]+/, '') || 'icon').slice(0, 24);
  const taken = new Set([...officials(cat).map((o) => o.id), ...data.icons.filter((i) => i.category === cat).map((i) => i.id)]);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}

// The size an icon is drawn at: an official one keeps its own, a new one gets its category's.
export function sizeOf(cat: CategoryId, id: string | null): [number, number] {
  const o = id ? officialOf(cat, id) : undefined;
  if (o) return [Math.max(...o.art.map((r) => r.length)), o.art.length];
  const c = categoryOf(cat);
  return [c.w, c.h];
}

// Rows that are the right size and use only the category's letters (anything else becomes empty); null when they can't be.
export function cleanArt(art: unknown, cat: CategoryId, size: [number, number]): string[] | null {
  if (!Array.isArray(art) || art.length !== size[1] || !art.every((r) => typeof r === 'string' && r.length === size[0])) return null;
  const ok = new Set(categoryOf(cat).letters);
  return (art as string[]).map((r) => [...r].map((ch) => (ok.has(ch) ? ch : '.')).join(''));
}
export const isBlank = (art: string[]) => art.every((r) => /^\.*$/.test(r));

// Saves an icon (a new one, or a change); a change that makes an official icon just as it was is dropped.
export function putIcon(data: PixelData, icon: Omit<PixelIcon, 'updated'>, now = Date.now()): PixelData {
  const rest = data.icons.filter((i) => !(i.category === icon.category && i.id === icon.id));
  const o = officialOf(icon.category, icon.id);
  if (o && o.name === icon.name && o.group === icon.group && o.art.join('\n') === icon.art.join('\n')) return { ...data, icons: rest };
  return { ...data, icons: [...rest, { ...icon, updated: now }] };
}
// Deletes your own icon, or puts an official one back as it is in the code.
export const dropIcon = (data: PixelData, cat: CategoryId, id: string): PixelData =>
  ({ ...data, icons: data.icons.filter((i) => !(i.category === cat && i.id === id)) });

// Puts every official icon back as it is in the code (art, name and group). `all` deletes your own drawings too.
export const resetIcons = (data: PixelData, all = false): PixelData =>
  ({ ...data, icons: all ? [] : data.icons.filter((i) => !officialOf(i.category, i.id)) });
// How many of each kind there are: changes to official icons, and icons of your own.
export const countMine = (data: PixelData) => {
  const changed = data.icons.filter((i) => officialOf(i.category, i.id)).length;
  return { changed, mine: data.icons.length - changed };
};

// Moves every icon of a group (official ones too) to another group.
export function renameGroup(data: PixelData, cat: CategoryId, from: string, to: string, now = Date.now()): PixelData {
  const target = cleanGroup(to, from);
  if (target === from) return data;
  let next = data;
  for (const i of iconsOf(data, cat)) if (i.group === from) next = putIcon(next, { category: cat, id: i.id, name: i.name, group: target, art: i.art }, now);
  return next;
}

// Moves some icons (official ones too) to a group; the ones already in it stay as they are.
export function moveIcons(data: PixelData, cat: CategoryId, ids: string[], to: string, now = Date.now()): PixelData {
  const target = cleanGroup(to, USER_GROUP), pick = new Set(ids);
  let next = data;
  for (const i of iconsOf(data, cat)) if (pick.has(i.id) && i.group !== target) next = putIcon(next, { category: cat, id: i.id, name: i.name, group: target, art: i.art }, now);
  return next;
}

// What is kept on the device, read back: anything broken is left out.
export function sanitize(raw: unknown): PixelData {
  const icons = Array.isArray((raw as PixelData)?.icons) ? (raw as PixelData).icons : [];
  const out: PixelIcon[] = [];
  const seen = new Set<string>();
  for (const i of icons) {
    const icon = checkIcon(i);
    if (!icon || seen.has(`${icon.category}/${icon.id}`)) continue;
    seen.add(`${icon.category}/${icon.id}`);
    out.push({ ...icon, updated: Number.isFinite(i?.updated) ? i.updated : 0 });
    if (out.length >= LIMITS.icons) break;
  }
  return uniqueNames({ version: 1, icons: out }, 0);
}
function checkIcon(i: unknown): Omit<PixelIcon, 'updated'> | null {
  const v = i as Partial<PixelIcon> | null;
  if (!v || !isCategory(v.category) || typeof v.id !== 'string' || !/^[a-z][a-z0-9]{0,31}$/i.test(v.id)) return null;
  const art = cleanArt(v.art, v.category, sizeOf(v.category, v.id));
  if (!art) return null;
  return { category: v.category, id: v.id, name: cleanName(String(v.name ?? ''), v.id), group: cleanGroup(String(v.group ?? '')), art };
}

// ---- the export file ----
// One JSON file, made to be read and edited by hand (change a "group", say) and then put in the repo:
//   {
//     "format": "itty-bitty-kitty-icons", "version": 1, "exported": "2026-11-11",
//     "icons": [
//       { "category": "sticker", "id": "teapot", "status": "new", "name": "Teapot", "group": "user",
//         "art": ["................", ...16 rows of 16 letters] },
//       { "category": "sticker", "id": "star", "status": "changed", ... }
//     ]
//   }
// "status" says whether it is a new icon or a change to an official one (of the same id). Only your icons are in it.
export const EXPORT_FORMAT = 'itty-bitty-kitty-icons';
export const exportName = (day: string) => `kitty-icons-${day}.json`;

export function exportText(data: PixelData, day: string): string {
  const order = CATEGORIES.map((c) => c.id);
  const icons = [...data.icons].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.group.localeCompare(b.group) || a.updated - b.updated)
    .map((i) => ({ category: i.category, id: i.id, status: statusOf(i.category, i.id), name: i.name, group: i.group, art: i.art }));
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exported: day, icons }, null, 2) + '\n';
}

// Reads an export file back; throws a message to show when it is not one.
export function readExport(text: string): Omit<PixelIcon, 'updated'>[] {
  let raw: { format?: unknown; icons?: unknown };
  try { raw = JSON.parse(text); } catch { throw new Error("That file isn't an icon export."); }
  if (raw?.format !== EXPORT_FORMAT || !Array.isArray(raw.icons)) throw new Error("That file isn't an icon export.");
  const icons = raw.icons.map(checkIcon).filter((i): i is Omit<PixelIcon, 'updated'> => !!i);
  if (!icons.length) throw new Error('There are no icons in that file.');
  return icons;
}
// The icons of an export that would replace a different version of your own (a change or a new icon you have
// with the same id). An official icon you haven't changed is not in it: taking someone's change to it loses nothing.
export function importClashes(data: PixelData, icons: Omit<PixelIcon, 'updated'>[]): Omit<PixelIcon, 'updated'>[] {
  return icons.filter((i) => {
    const mine = data.icons.find((m) => m.category === i.category && m.id === i.id);
    return !!mine && (mine.name !== i.name || mine.group !== i.group || mine.art.join('\n') !== i.art.join('\n'));
  });
}

// Puts the icons of an export in. 'replace' puts them over yours with the same id; 'keep' keeps yours and adds each
// clashing one (see importClashes) as a new icon beside it, when it is a new icon's size (else yours stays and it is
// left out). Two icons with one name are then told apart (see uniqueNames).
export function importIcons(data: PixelData, icons: Omit<PixelIcon, 'updated'>[], mode: 'replace' | 'keep' = 'replace', now = Date.now()): PixelData {
  const clash = new Set(mode === 'keep' ? importClashes(data, icons) : []);
  const next = icons.reduce((d, i) => {
    if (!clash.has(i)) return putIcon(d, i, now);
    const [w, h] = sizeOf(i.category, null);
    if (i.art.length !== h || i.art.some((r) => r.length !== w)) return d;
    return putIcon(d, { ...i, id: newId(i.name, i.category, d), group: i.group === DEFAULT_GROUP ? USER_GROUP : i.group }, now);
  }, data);
  return uniqueNames(next, now);
}

// ---- names ----
// No two icons of a category share a name (in any case). Saving one with a taken name is not allowed; this finds it.
const nameKey = (name: string) => name.trim().toLowerCase();
export function nameTaken(data: PixelData, cat: CategoryId, name: string, id: string | null): Shown | undefined {
  const key = nameKey(name);
  return iconsOf(data, cat).find((i) => i.id !== id && nameKey(i.name) === key);
}
// The safeguard, should two icons of a category end up with one name anyway (an import, or icons saved before the
// rule): they become "Star 1", "Star 2", ... in the order Kitty Gallery lists them, with numbers no other icon has.
export function uniqueNames(data: PixelData, now = Date.now()): PixelData {
  let next = data;
  for (const c of CATEGORIES) {
    const shown = iconsOf(next, c.id);
    const byName = new Map<string, Shown[]>();
    for (const i of shown) byName.set(nameKey(i.name), [...(byName.get(nameKey(i.name)) ?? []), i]);
    const taken = new Set(shown.map((i) => nameKey(i.name)));
    for (const same of byName.values()) {
      if (same.length < 2) continue;
      const base = same[0].name.trim();
      let n = 1;
      for (const i of same) {
        let name: string;
        do { const tail = ` ${n++}`; name = base.slice(0, LIMITS.name - tail.length).trimEnd() + tail; } while (taken.has(nameKey(name)));
        taken.add(nameKey(name));
        next = putIcon(next, { category: c.id, id: i.id, name, group: i.group, art: i.art }, now);
      }
    }
  }
  return next;
}

// ---- drawing on a grid (rows of letters as arrays) ----
export type Grid = string[][];
export const toGrid = (art: string[]): Grid => art.map((r) => [...r]);
export const toArt = (g: Grid): string[] => g.map((r) => r.join(''));
export const blankGrid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string>(w).fill('.'));

// Flood fill from (x, y): every touching pixel of the same letter becomes `ch`.
export function floodFill(g: Grid, x: number, y: number, ch: string): Grid {
  const from = g[y]?.[x];
  if (from === undefined || from === ch) return g;
  const out = g.map((r) => r.slice());
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (out[cy]?.[cx] !== from) continue;
    out[cy][cx] = ch;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return out;
}
// The pixels on the straight line from a to b (both ends included).
export function linePoints([x0, y0]: [number, number], [x1, y1]: [number, number]): [number, number][] {
  const pts: [number, number][] = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return pts;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
export const flipGrid = (g: Grid): Grid => g.map((r) => r.slice().reverse());
// Moves everything by (dx, dy); what goes off the edge is lost.
export function shiftGrid(g: Grid, dx: number, dy: number): Grid {
  const h = g.length, w = g[0]?.length ?? 0, out = blankGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny][nx] = g[y][x];
  }
  return out;
}

// ---- a selection: a box of pixels lifted off the board, moved, and put down again ----
export interface Rect { x: number; y: number; w: number; h: number }
// The box from one corner to the other (both included), kept on the board.
export function rectOf([x0, y0]: [number, number], [x1, y1]: [number, number], w: number, h: number): Rect {
  const cx = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
  const ax = cx(Math.min(x0, x1), w), ay = cx(Math.min(y0, y1), h), bx = cx(Math.max(x0, x1), w), by = cx(Math.max(y0, y1), h);
  return { x: ax, y: ay, w: bx - ax + 1, h: by - ay + 1 };
}
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
// Takes the pixels in the box off the board: the board with a hole where they were, and the pixels.
export function liftArea(g: Grid, r: Rect): { grid: Grid; float: Grid } {
  const grid = g.map((row) => row.slice());
  const float = Array.from({ length: r.h }, (_, dy) => Array.from({ length: r.w }, (_, dx) => {
    const row = grid[r.y + dy], ch = row?.[r.x + dx];
    if (ch === undefined) return '.';
    row[r.x + dx] = '.';
    return ch;
  }));
  return { grid, float };
}
// Puts lifted pixels down at (x, y): empty ones leave what is under them, and what is off the board is lost.
export function dropFloat(g: Grid, float: Grid, x: number, y: number): Grid {
  const out = g.map((row) => row.slice());
  float.forEach((row, dy) => row.forEach((ch, dx) => {
    if (ch !== '.' && out[y + dy]?.[x + dx] !== undefined) out[y + dy][x + dx] = ch;
  }));
  return out;
}
