// Pixel kitties, redrawn from the reference sheet: a round face (cards, moods, bubbles) and a sitting
// cat with a curled tail (cozy room). Each is one hand-cleaned template made of colour slots, drawn as the
// LEFT half and mirrored, so every coat is the same shape recoloured. Pure functions that return SVG.
import type { CatLook, CatPattern, CatTrait } from './rules.ts';

export type Face = 'open' | 'happy' | 'sleepy' | 'sad' | 'starving' | 'dead';

export const FURS = ['#fbb16e', '#363535', '#b8b8b6', '#f3dbb2', '#9c7a5e', '#fbf6ee', '#d9884f', '#7d8796'];
export const PATTERNS: CatPattern[] = ['plain', 'stripes', 'mask', 'patch', 'calico', 'point'];
export const TRAITS: CatTrait[] = ['playful', 'curious', 'cuddly', 'lazy', 'shy', 'grumpy'];

export const TRAIT_TEXT: Record<CatTrait, string> = {
  playful: 'Playful: always on the move',
  curious: 'Curious: wanders everywhere',
  cuddly: 'Cuddly: loves attention',
  lazy: 'Lazy: prefers a nap',
  shy: 'Shy: keeps to the corners',
  grumpy: 'Grumpy: not a morning cat',
};

const WHITE = '#fbf6ee';
const CREAM = '#f6e8d4';
const EYES = ['#e8b84a', '#79b86b', '#6fc0f1', '#c98a3a'];

const pick = <T,>(xs: T[], r: () => number) => xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))];

export function randomLook(r: () => number = Math.random): CatLook {
  const pattern = pick(PATTERNS, r);
  const fur = pattern === 'calico' ? WHITE : pattern === 'point' ? CREAM
    : pattern === 'patch' ? pick(FURS.filter((f) => f !== WHITE), r) : pick(FURS, r);
  return { fur, pattern, trait: pick(TRAITS, r) };
}

const hashOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Cats adopted before appearances existed get a stable look derived from their id.
export function lookOf(c: { id: string; look?: CatLook }): CatLook {
  const h = hashOf(c.id);
  const base = c.look ?? { fur: FURS[h % FURS.length], pattern: 'plain' as CatPattern };
  return { ...base, trait: base.trait ?? TRAITS[(h >> 7) % TRAITS.length] };
}

// Notification icons are pre-drawn PNGs (android/app/src/main/res/drawable-nodpi, made by scripts/notify-icons.ts),
// one per base fur and face. Returns the resource name, e.g. "notif_3_sad".
export const NOTIFY_FACES = ['open', 'happy', 'sad', 'starving'] as const;
export function notifyIconName(look: CatLook, face: Face): string {
  const f = (NOTIFY_FACES as readonly string[]).includes(face) ? face : face === 'dead' ? 'starving' : 'open';
  const i = FURS.indexOf(look.fur);
  return `notif_${i < 0 ? 5 : i}_${f}`;
}

// ---- templates: the left half (14 columns, column 13 is the centre line) ----
//  o outline  f fur  s stripe/shade  W white (muzzle, chest)  p ear pink  c blush  e eye  n nose  m mouth
const d = (n: number) => '.'.repeat(n), r = (c: string, n: number) => c.repeat(n);

export const SIT_HALF = [
  d(8) + 'oo' + d(4),
  d(7) + 'o' + 'ff' + 'o' + d(3),
  d(7) + 'o' + 'p' + 'ff' + 'o' + d(2),
  d(6) + 'o' + 'f' + 'pp' + 'ff' + 'oo',
  d(6) + 'o' + 'ffff' + 's' + 'f' + 's',
  d(5) + 'o' + r('f', 7) + 's',
  d(5) + 'o' + 's' + r('f', 7),
  d(4) + 'o' + 'ff' + 's' + r('f', 6),
  d(3) + 'ooo' + r('f', 4) + 'e' + 'ff' + 'W',
  d(4) + 'o' + r('f', 5) + 'e' + 'f' + 'WW',
  d(3) + 'ooo' + 'ff' + 'cc' + 'f' + 'WW' + 'n',
  d(4) + 'o' + r('f', 6) + 'W' + 'm' + 'W',
  d(5) + 'o' + r('f', 6) + 'WW',
  d(6) + 'oo' + r('f', 6),
  d(7) + 'o' + r('f', 6),
  d(7) + 'o' + r('f', 6),
  d(6) + 'o' + 's' + r('f', 6),
  d(6) + 'o' + 'f' + 's' + 'ff' + 'WWW',
  d(5) + 'o' + 's' + 'fff' + 'WWWW',
  d(5) + 'o' + 'f' + 's' + 'f' + 'WWWWW',
  d(5) + 'o' + 'ffff' + 'WWWW',
  d(5) + 'o' + 'fff' + 'o' + 'f' + 'WWW',
  d(5) + 'o' + 's' + 'ff' + 'o' + 'ff' + 'W' + 'o',
  d(6) + 'o' + 'ss' + 'o' + 'fff' + 'o',
  d(7) + 'ooo' + r('f',3) +'o',
  d(10) + 'ooo' + d(1),
];

// The face on its own is the sitting cat's head (rows 0-13) closed off with a chin.
const HEAD_ROWS = 14;
export const FACE_HALF = [...SIT_HALF.slice(0, HEAD_ROWS), d(8) + r('o', 6)];

export const FACE_X = 2;   // the whiskers start at column 2, so the face view skips the empty columns either side
export const WIDTH = 27;   // 13 + the centre line + 13

// The tail curls up on the cat's right. Frame B bends its top three rows one pixel to the right (the swish).
// Cells that change colour slot in frame B only, as 'column,row' -> slot.
const SWISH_B: Record<string, string> = { '22,21': 'o' };
const TAIL: [number, number, string][] = [
  [24, 17, 'o'], [25, 17, 'o'],
  [23, 18, 'o'], [24, 18, 'W'], [25, 18, 'W'], [26, 18, 'o'],
  [23, 19, 'o'], [24, 19, 'f'], [25, 19, 'f'], [26, 19, 'o'],
  [22, 20, 'o'], [23, 20, 's'], [24, 20, 'f'], [25, 20, 'f'], [26, 20, 'o'],
  [22, 21, 's'], [23, 21, 'f'], [24, 21, 'f'], [25, 21, 's'], [26, 21, 'o'],
  [22, 22, 'f'], [23, 22, 'f'], [24, 22, 'f'], [25, 22, 'o'],
  [21, 23, 's'], [22, 23, 's'], [23, 23, 's'], [24, 23, 'o'], 
  [20, 24, 'o'], [21, 24, 'o'], [22, 24, 'o'], [23, 24, 'o'],
];

// ---- expressions (left coordinates; the eyes sit at column 10, rows 8-9, in both templates) ----
type Cell = [number, number];
const EXPRESSION: Record<Face, (mouthRow: number) => [number, number, string][]> = {
  open: () => [],
  happy: (m) => [[10, 8, 'e'], [10, 9, 'f'], [9, 9, 'e'], [11, 9, 'e'], [11, m, 'm']],            // ^ ^ and a wider smile
  sleepy: () => [[10, 8, 'f'], [9, 9, 'e'], [10, 9, 'e'], [10, 10, 'f']],
  sad: () => [[10, 13, 't'],[10, 12, 't'],[10, 11, 't'],[10, 10, 't'], [9, 7, 'o'], [8, 7, 'o']],                                          // tear and a worried brow
  starving: (m) => [[10, 8, 'f'], [10, 9, 'f'], [9, 8, 'e'], [11, 8, 'e'], [10, 9, 'e'],[10, 13, 't'],[10, 12, 't'],[10, 11, 't'], [10, 10, 't'], [11, m, 'm']],
  dead: () => [[10, 8, 'f'], [10, 9, 'f'], [9, 8, 'e'], [11, 8, 'e'], [10, 9, 'e'], [11, 1, 'h'], [12, 1, 'h'], [13, 1, 'h']],
};

// ---- coats: which cells take the accent colours (a, b) on top of the base colours ----
interface Paint { cells: Cell[]; slot: string; side: 'both' | 'right' | 'left' }
interface Coat { f: string; s: string; W: string; a: string; b: string; sit: Paint[]; tail?: string }

const shade = (hex: string, f: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');

function coatOf(look: CatLook): Coat {
  const fur = look.fur;
  const base = { a: shade(fur, 0.8), b: shade(fur, 0.8), sit: [] as Paint[] };
  switch (look.pattern) {
    case 'stripes': return {
      ...base, f: fur, s: shade(fur, 0.74), W: WHITE,
    };
    case 'mask': return { ...base, f: fur, s: fur, W: WHITE };
    case 'patch': return {
      ...base, f: WHITE, s: WHITE, W: WHITE, a: fur,
      sit: [
        { cells: [[8, 1], [9, 1], [8, 2], [10, 2], [7, 3], [8, 3], [9, 3], [7, 4], [8, 4], [9, 4], [10, 4], [7, 5], [8, 5], [9, 5], [10, 5], [8, 6], [9, 6], [10, 6], [11, 6], [8, 7], [9, 7], [10, 7]], slot: 'a', side: 'right' },
        { cells: [[8, 16], [9, 16], [8, 17], [9, 17], [10, 17], [8, 18], [9, 18]], slot: 'a', side: 'right' },
      ],
      tail: 'a',
    };
    case 'calico': return {
      ...base, f: WHITE, s: WHITE, W: WHITE, a: '#54301f', b: '#f09e3a',
      sit: [
        { cells: [[8, 1], [9, 1], [8, 2], [7, 3], [8, 3], [7, 4], [8, 4], [9, 4], [7, 5], [8, 5], [7, 6], [8, 6], [7, 16], [8, 16], [7, 17], [8, 17], [6, 18], [7, 18], [6, 19], [7, 19], [8, 19]], slot: 'a', side: 'left' },
        { cells: [[8, 1], [9, 1], [8, 2], [9, 2], [10, 2], [8, 3], [9, 3], [10, 3], [8, 4], [9, 4], [10, 4], [9, 5], [10, 5], [11, 5], [9, 6], [10, 6], [8, 18], [9, 18], [8, 19], [9, 19], [7, 20], [8, 20], [7, 21], [8, 21]], slot: 'b', side: 'right' },
      ],
      tail: 'b',
    };
    case 'point': return {
      ...base, f: fur, s: fur, W: '#fdf6ec', a: '#795439', b: '#795439',
      sit: [
        { cells: [[8, 0], [9, 0], [8, 1], [9, 1], [8, 2], [9, 2], [10, 2], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3]], slot: 'a', side: 'both' },
        { cells: [[10, 7], [11, 7], [12, 7], [13, 7], [9, 8], [11, 8], [12, 8], [13, 8], [9, 9], [11, 9], [12, 9], [13, 9], [10, 10], [11, 10], [12, 10], [13, 10], [10, 11], [11, 11], [13, 11]], slot: 'a', side: 'both' },
        { cells: [[6, 22], [7, 22], [8, 22], [6, 23], [7, 23], [8, 23], [10, 22], [11, 22], [10, 23], [11, 23], [12, 23]], slot: 'a', side: 'both' },
      ],
      tail: 'a',
    };
    default: return { ...base, f: fur, s: fur, W: fur };   // plain: one solid colour
  }
}

function colors(look: CatLook, coat: Coat, dead: boolean): Record<string, string> {
  const h = hashOf(look.fur + look.pattern);
  return {
    o: '#431008', f: dead ? '#c9c6d2' : coat.f, s: dead ? '#b9b6c4' : coat.s, W: dead ? '#e4e2ea' : coat.W, a: coat.a, b: coat.b,
    p: '#f2bdb4', c: '#f0b4a8', n: '#d9776f', m: '#431008', t: '#6fc0f1', h: '#f0c45e',
    e: '#2a1210', E: look.pattern === 'point' ? '#6fc0f1' : EYES[h % EYES.length],
  };
}

type Grid = string[][];
const mirror = (half: string[]): Grid => half.map((row) => [...row, ...[...row].slice(0, -1).reverse()]);

function paint(grid: Grid, p: Paint) {
  for (const [c, row] of p.cells) {
    for (const [side, col] of [['left', c], ['right', WIDTH - 1 - c]] as const) {
      if (p.side !== 'both' && p.side !== side) continue;
      const cur = grid[row]?.[col];
      if (cur && 'fsW'.includes(cur)) grid[row][col] = p.slot;
    }
  }
}

function build(face: Face, look: CatLook, sitting: boolean): { grid: Grid; coat: Coat; blink: Cell[] } {
  const coat = coatOf(look);
  const grid = mirror(sitting ? SIT_HALF : FACE_HALF);
  for (const p of coat.sit) paint(grid, sitting ? p : { ...p, cells: p.cells.filter(([, row]) => row < HEAD_ROWS) });
  for (const [c, row, ch] of EXPRESSION[face](11)) {
    grid[row][c] = ch;
    grid[row][WIDTH - 1 - c] = ch;
  }
  const open = face === 'open' || face === 'sad';
  if (open) for (const c of [10, WIDTH - 11]) grid[8][c] = 'E';   // coloured iris above a dark pupil
  const blink: Cell[] = open ? [[10, 8], [10, 9], [16, 8], [16, 9]] : [];
  // Open eyes are two pixels wide and two tall: iris colour on the outer side, dark outline on the inner side.
  // The sad face keeps the original single-pixel eyes.
  if (face === 'open') {
    for (const row of [8, 9]) {
      for (const [iris, edge] of [[9, 10], [WIDTH - 10, WIDTH - 11]]) { grid[row][iris] = 'E'; grid[row][edge] = 'e'; blink.push([iris, row]); }
    }
  }
  return { grid, coat, blink };
}

const rect = (x: number, y: number, fill: string) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;

function draw(grid: Grid, pal: Record<string, string>): string {
  let out = '';
  grid.forEach((row, y) => row.forEach((ch, x) => { if (pal[ch]) out += rect(x, y, pal[ch]); }));
  return out;
}

// The round face on its own (cards, moods, thought bubbles, previews).
export function faceSvg(face: Face, look: CatLook, faded = false): string {
  const { grid, coat } = build(face, look, false);
  return `<svg class="sprite${faded ? ' faded' : ''}" viewBox="${FACE_X} 0 ${WIDTH - 2 * FACE_X} ${grid.length}" aria-hidden="true" shape-rendering="crispEdges">${draw(grid, colors(look, coat, face === 'dead'))}</svg>`;
}

// The sitting cat for the room. Blinks and swishes its tail (CSS animations, see page.html).
export function bodySvg(face: Face, look: CatLook, seed = 0): string {
  const { grid, coat, blink } = build(face, look, true);
  const pal = colors(look, coat, face === 'dead');
  const tail = (shift: number) => TAIL.map(([c, row, ch]) => {
    if (shift) ch = SWISH_B[`${c},${row}`] ?? ch;
    return rect(c + (row <= 20 ? shift : 0), row, pal[ch === 'f' && coat.tail ? coat.tail : ch]);
  }).join('');
  const blinkG = blink.length ? `<g class="blink">${blink.map(([x, y]) => rect(x, y, pal.f)).join('')}</g>` : '';
  const delay = `${-((seed % 40) / 10).toFixed(1)}s`;
  return `<svg class="sprite body" style="--d:${delay}" viewBox="0 0 ${WIDTH + 1} ${grid.length}" aria-hidden="true" shape-rendering="crispEdges">` +
    `<g class="tail a">${tail(0)}</g><g class="tail b">${tail(1)}</g>${draw(grid, pal)}${blinkG}</svg>`;
}

// Pixel cone party popper that bursts into confetti when you level up.
const CONE = [
  '......oo.....',
  '.....oyyo....',
  '.....oyro....',
  '....oyyyyo...',
  '....oyrryo...',
  '...oyyyyyyo..',
  '...oyrrrryo..',
  '..oyyyyyyyyo.',
  '..oyrrrrrryo.',
  '.oyyyyyyyyyyo',
];
export const CONFETTI_COLORS = ['#ec4b78', '#f0c45e', '#6fb2ef', '#7bd88f', '#c3a9ee', '#ff9a5c'];
export function popperSvg(): string {
  const pal: Record<string, string> = { o: '#2a2433', y: '#f0c45e', r: '#ec4b78' };
  return `<svg viewBox="0 0 13 10" aria-hidden="true" shape-rendering="crispEdges">${draw(CONE.map((row) => [...row]), pal)}</svg>`;
}
