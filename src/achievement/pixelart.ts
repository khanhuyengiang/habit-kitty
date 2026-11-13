import { faceSvg } from '../shared/pixelcat.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { PALETTE, type PaletteName } from '../shared/palette.ts';

// Kitty Achievement's pictures, drawn on the shared grid (shared/pixelart.ts). Pure functions that return SVG strings.

export { PICKER_ICONS, PICKER_ICON_NAMES, PICKER_ICON_GROUPS } from './icons.ts';
import { PICKER_ICONS, PICKER_ICON_GROUPS } from './icons.ts';

// A picker's choices with a heading over each group (the heading spans the picker's grid or row), so a long list is easy to look through.
export const groupedPicks = (pick: (name: string) => string): string => PICKER_ICON_GROUPS.map(([g, names]) =>
  `<p class="pick-group">${g} <span class="num">${names.length}</span></p>${names.map(pick).join('')}`).join('');

// Small interface icons.
export const UI_ICONS: Record<string, string[]> = {
  plus: ['..o..', '..o..', 'ooooo', '..o..', '..o..'],
  x: ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o'],
  prev: ['..o', '.o.', 'o..', '.o.', '..o'],
  next: ['o..', '.o.', '..o', '.o.', 'o..'],
  up: ['..o..', '.ooo.', 'ooooo'],
  down: ['ooooo', '.ooo.', '..o..'],
  chev: ['o...o', '.o.o.', '..o..'],
  pencil: ['.....oo', '....o.o', '...o.o.', '..o.o..', '.o.o...', 'ooo....', 'o......'],
  lock: ['..ooo..', '.o...o.', '.o...o.', 'ooooooo', 'ooo.ooo', 'ooo.ooo', 'ooooooo'],
  trash: ['..ooo..', 'ooooooo', '.ooooo.', '.o.o.o.', '.o.o.o.', '.o.o.o.', '.ooooo.'],
  archive: ['ooooooo', 'ooooooo', 'o.....o', 'o.ooo.o', 'o.....o', 'ooooooo'],
  filter: ['ooooooo', '.ooooo.', '..ooo..', '...o...', '...o...', '...oo..'],
};

// An interface icon in the text colour; an achievement icon is drawn as a sticker on the fine grid instead.
export function iconSvg(name: string, cls = ''): string {
  if (!UI_ICONS[name]) return stickerSvg(name, 1, `ico ${cls}`);
  return monoSvg(UI_ICONS[name], cls);
}

// ---------- card art, on the fine grid ----------
// The art is drawn in --px, the page's pixel; on a card these pictures (they carry the .fine class) are sized in the card's
// own pixel, --cu, instead. Colours are CSS variables set on the card, so the side-quest
// colour and the rarity reach every pixel without redrawing.

// Every other palette colour, so any colour of the app can be drawn (Kitty Gallery's "Choose a colour"). Saved in drawings: never
// change a sign, only add (a new palette colour takes a new sign).
export const PALETTE_INKS: Record<string, PaletteName> = {
  'C': 'lavender50', 'D': 'lavender100', 'E': 'lavender200', 'F': 'lavender250', 'H': 'lavender400', 'L': 'lavender500',
  'O': 'lavender600', 'Q': 'dusk700', 'T': 'plum700', 'V': 'plum800', 'W': 'night800', 'X': 'night850', '0': 'night900',
  '1': 'night950', '2': 'pink50', '3': 'pink100', '4': 'pink200', '5': 'pink400', '6': 'mauve', '7': 'pink500', '8': 'pink600',
  '9': 'pink700', '!': 'berry800', '|': 'berry900', '$': 'blue50', '%': 'blue100', '*': 'violet', '+': 'slateBlue',
  '-': 'indigo', '/': 'green100', ':': 'mint400', ';': 'teal', '=': 'green700', '?': 'pine', '@': 'butter200', '^': 'gold500',
  '_': 'tan', '~': 'brown', '(': 'umber', ')': 'umberDark', '[': 'white', ']': 'grey300', '{': 'grey400', '}': 'charcoal',
};

// Outside a card the side-quest colours fall back to the text colour, so an icon in a chip or a block takes its colour.
export const FINE: Record<string, string> = {
  o: 'var(--dk, color-mix(in srgb, currentColor 30%, #231d44))', s: 'var(--sq, currentColor)',
  l: 'var(--sql, color-mix(in srgb, currentColor 40%, #fff))', d: 'var(--sqd, color-mix(in srgb, currentColor 70%, #231d44))',
  h: 'var(--hi)', t: 'var(--dith)', S: 'var(--scr)', e: 'var(--panel)', q: 'var(--rar, #a29bb8)',
  w: '#fffafd', y: '#ffd36e', Y: '#e8a04c', r: '#ff8fb8', R: '#f0506e', g: '#8fe0c8', G: '#45c27a', b: '#8fd0fa', B: '#4a9bea',
  n: '#c99a73', N: '#8a6a5a', k: '#cdc8e0', K: '#7d7594', c: '#fff3d1',
  v: '#b9a3f0', f: '#ffb98a', x: '#b8e35f',
  ...Object.fromEntries(Object.entries(PALETTE_INKS).map(([ch, k]) => [ch, PALETTE[k]])),
  // every note colour (and lime), lit and shaded the way `l` and `d` light and shade the base colour
  ...litShaded({ p: 'P', a: 'A', i: 'I', m: 'M', j: 'J', u: 'U', z: 'Z' },
    { p: '#ff8fb8', a: '#b9a3f0', i: '#8fd0fa', m: '#8fe0c8', j: '#ffd36e', u: '#ffb98a', z: '#b8e35f' }),
};
function litShaded(pairs: Record<string, string>, base: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [lit, shaded] of Object.entries(pairs)) {
    out[lit] = `color-mix(in srgb, ${base[lit]} 40%, #fff)`;
    out[shaded] = `color-mix(in srgb, ${base[lit]} 70%, #231d44)`;
  }
  return out;
}

// Rows of letters to one path per colour (runs merged), so a picture is a handful of elements however dense it is.
export function fineSvg(art: string[], cls = ''): string {
  const w = Math.max(...art.map((r) => r.length));
  const paths: Record<string, string> = {};
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!FINE[ch]) continue;
      let n = 1;
      while (row[x + n] === ch) n++;
      paths[ch] = (paths[ch] ?? '') + `M${x} ${y}h${n}v1h-${n}z`;
      x += n - 1;
    }
  });
  const body = Object.entries(paths).map(([ch, d]) => `<path style="fill:${FINE[ch]}" d="${d}"/>`).join('');
  return `<svg class="pxs fine ${cls}" style="--w:${w};--h:${art.length}" viewBox="0 0 ${w} ${art.length}" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;
}

// Scale2x: doubles a picture and rounds its stair-steps, so a 16×16 icon gets the edges of a 32×32 one.
function scale2x(art: string[]): string[] {
  const at = (x: number, y: number) => art[y]?.[x] ?? '.';
  return art.flatMap((row, y) => {
    let top = '', bottom = '';
    for (let x = 0; x < row.length; x++) {
      const e = row[x], b = at(x, y - 1), d = at(x - 1, y), f = at(x + 1, y), h = at(x, y + 1);
      top += (d === b && b !== f && d !== h ? d : e) + (b === f && b !== d && f !== h ? f : e);
      bottom += (d === h && d !== b && h !== f ? d : e) + (h === f && d !== h && b !== f ? f : e);
    }
    return [top, bottom];
  });
}

// An achievement icon as a sticker: drawn at 1 fine pixel per icon pixel (s = 1), or enlarged with Scale2x (s = 2);
// the side-quest colour is lit on its top-left edges and shaded on its bottom-right ones, and a one-fine-pixel dark
// outline goes around it all (touching it side-on only, so its outer corners stay empty).
export const stickerSvg = (name: string, s: 1 | 2 = 2, cls = ''): string => stickerArtSvg((PICKER_ICONS[name] ?? PICKER_ICONS.star).art, s, cls);
// The same from the rows themselves (Kitty Gallery draws one that is not saved yet).
export const stickerArtSvg = (icon: string[], s: 1 | 2 = 2, cls = ''): string => fineSvg(stickerRows(icon, s), `sticker ${cls}`);

function stickerRows(icon: string[], s: 1 | 2): string[] {
  const art = s === 2 ? scale2x(icon) : icon;
  const at = (x: number, y: number) => art[y]?.[x] ?? '.', on = (x: number, y: number) => at(x, y) !== '.';
  const rows: string[] = [];
  for (let y = -1; y <= art.length; y++) {
    let row = '';
    for (let x = -1; x <= art[0].length; x++) {
      const c = at(x, y);
      if (c === 's') row += !on(x, y - 1) || !on(x - 1, y) ? 'l' : !on(x, y + 1) || !on(x + 1, y) ? 'd' : 's';
      else if (c !== '.') row += c;
      else row += on(x, y - 1) || on(x, y + 1) || on(x - 1, y) || on(x + 1, y) ? 'o' : '.';
    }
    rows.push(row);
  }
  return rows;
}

// The burst behind a card's icon: dotted rays, long and short in turn, and a few twinkles. Drawn for the 82×62 picture area.
export const burstSvg = (() => {
  const W = 82, H = 62, cx = 41, cy = 31;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (x: number, y: number, c: string) => { if (g[y]?.[x] !== undefined) g[y][x] = c; };
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 + Math.PI / 16, end = i % 2 ? 31 : 38;
    for (let r = 24; r <= end; r += 2) put(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.74), 'b');
  }
  const twinkle = (x: number, y: number, c: string, big: boolean) => {
    put(x, y, 'w');
    for (let k = 1; k <= (big ? 2 : 1); k++) { put(x - k, y, c); put(x + k, y, c); put(x, y - k, c); put(x, y + k, c); }
  };
  twinkle(13, 9, 'y', true); twinkle(69, 52, 'y', true); twinkle(67, 8, 'r', false);
  twinkle(10, 51, 'b', false); twinkle(76, 30, 'r', false); twinkle(6, 22, 'g', false);
  const rows = g.map((r) => r.join(''));
  return () => fineSvg(rows, 'burst');
})();

// A corner of the card's frame: a screw (always lit from the top left) and a dithered patch along both edges.
// Big (the card on its own page), it follows inspo/achivement_card.jpg instead: a rose screw lit from the top left with its slot
// mirrored into each corner (\ at the top left and bottom right, / at the others), and a pale-and-dark checker along both edges
// that starts on the frame's light line and thins out in its third row.
export function cornerSvg(corner: 'tl' | 'tr' | 'bl' | 'br', big = false): string {
  const N = 24;
  const g = Array.from({ length: N }, () => Array<string>(N).fill('.'));
  const fx = (x: number) => (corner[1] === 'r' ? N - 1 - x : x), fy = (y: number) => (corner[0] === 'b' ? N - 1 - y : y);
  const both = (x: number, y: number, c: string) => { g[fy(y)][fx(x)] = c; g[fy(x)][fx(y)] = c; };
  if (big) for (let x = 10; x < 19; x++) {
    const k = x - 10;
    both(x, 1, k % 2 ? 't' : 'h'); both(x, 2, k % 2 ? 'h' : 't'); if (k % 2) both(x, 3, 't');
  }
  else for (let y = 2; y < 6; y++) for (let x = 11; x < 23; x++) if ((x + y) % 2) both(x, y, 't');
  const screw = big ? bigScrew(corner === 'tl' || corner === 'br')
    : ['..ooo..', '.oSSSo.', 'oSSSoSo', 'oSSoSdo', 'oSoSddo', '.odddo.', '..ooo..'];
  const x0 = corner[1] === 'r' ? N - 9 : 2, y0 = corner[0] === 'b' ? N - 9 : 2;
  screw.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') g[y0 + y][x0 + x] = c; }));
  return fineSvg(g.map((r) => r.join('')), `crn ${corner}`);
}

// The big card's screw: a round head in a deep shade of the side quest's colour, light along its top left, with a dark slot
// running edge to edge (\ when `back`, else /).
function bigScrew(back: boolean): string[] {
  const ring = ['..ooo..', '.o...o.', 'o.....o', 'o.....o', 'o.....o', '.o...o.', '..ooo..'];
  return ring.map((row, y) => [...row].map((c, x) => {
    if (c === 'o') return 'o';
    if (x === 0 || x === 6 || ((y === 0 || y === 6) && (x < 2 || x > 4)) || ((y === 1 || y === 5) && (x < 1 || x > 5))) return '.';
    if (back ? x === y : x + y === 6) return 'o';
    if ((y === 1 && x <= 3) || (x === 1 && y <= 3)) return 'l';
    return 'd';
  }).join(''));
}

// The rarity as stars on the card's top rim: one for normal up to five for legendary, none while locked. Every star
// takes the rarity's colour (--rar on the card).
const STAR = ['...o...', '.ooqoo.', 'oqqqqqo', '.oqqqo.', '.oqoqo.', '.oo.oo.'];
export const starsSvg = (n: number) => n > 0
  ? `<span class="stars" aria-hidden="true">${Array.from({ length: n }, () => fineSvg(STAR, 'star')).join('')}</span>` : '';

// Small friends for the card: a heart and a flower in the corner of the screen.
export const CARD_FRIENDS: Record<string, { label: string; art: string[] }> = {
  heart: { label: 'Heart', art: ['.ooo.ooo.', 'owrrorrro', 'owrrrrrro', 'orrrrrrro', '.orrrrro.', '..orrro..', '...oro...', '....o....'] },
  flower: { label: 'Flower', art: ['...ooo...', '..orrro..', '.oorrroo.', 'orrooorro', 'orroyorro', 'orrooorro', '.oorrroo.', '..orrro..', '...ooo...'] },
};
export const heartSvg = () => fineSvg(CARD_FRIENDS.heart.art);
export const flowerSvg = () => fineSvg(CARD_FRIENDS.flower.art);

// The default avatar: a Habit Kitty face.
export const avatarSvg = () => faceSvg('happy', { fur: '#ffb98a', pattern: 'stripes' });
