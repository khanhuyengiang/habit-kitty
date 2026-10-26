// Pixel kitties, redrawn from the reference sheet: a round face (cards, moods, bubbles) and a sitting
// cat with a curled tail (cozy room). Each is one hand-cleaned template made of colour slots, drawn as the
// LEFT half and mirrored, so every coat is the same shape recoloured. Pure functions that return SVG.
import type { CatLook, CatPattern, CatTrait } from './rules.ts';
import { COAT_MINI, COAT_NAP, COAT_SIT } from './coats.ts';

export type Face = 'open' | 'happy' | 'sleepy' | 'sad' | 'starving' | 'dead';

export const FURS = ['#ffb98a', '#4b4560', '#c4c0d4', '#f6e0c0', '#a98a7a', '#fffafc', '#e8946a', '#8f9ab8'];
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

// One outline colour for every cat, a deep plum that sits with the pastel palette.
const OUTLINE = '#3d2c63';
const WHITE = '#fffafc';
const CREAM = '#f8eadb';
const EYES = ['#e8b84a', '#6fcfa8', '#6fb8f5', '#c98a3a'];

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

// EDIT ME (or use `npm run editor`): the LEFT half of the sitting cat, 14 columns, mirrored to make the whole cat.
// Column 13 is the centre line. Rows 0-13 are also the round face used on cards.
export const SIT_HALF = [
  '.........o.....',
  '........ofo....',
  '........opfo...',
  '.......ooppfooo',
  '.......offffsfs',
  '......offfffffs',
  '......osfffffff',
  '.....offsffffff',
  '....oooffffeffW',
  '.....offfffefWW',
  '....oooffccfWWn',
  '.....offffffWmW',
  '......offffffWW',
  '.......ooffffff',
  '........offffff',
  '........offffff',
  '.......offfffff',
  '.......ofsfffff',
  '......offffffff',
  '.....offfffffff',
  '.....offfffffff',
  '....offffffffff',
  '....offfffoffff',
  '....offfffoffff',
  '....offfffofffo',
  '....offfffofffo',
  '.....offffofffo',
  '......oossofffo',
  '........ooossoo',
  '...........ooo.',
];

// EDIT ME (or use `npm run editor`): the tail, drawn over the whole 28 x 26 body canvas so it lines up with the cat.
// Two frames swap to make the swish. Letters: o outline  f fur  s shade  W white tip.
export const TAIL_A = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..........................oo..',
  '.........................oWWo.',
  '.........................offo.',
  '........................osffo.',
  '........................sffso.',
  '........................fffo..',
  '.......................ssso...',
  '......................oooo....',
  '..............................',
  '..............................',
];
export const TAIL_B = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '...........................oo.',
  '..........................oWWo',
  '..........................offo',
  '.........................osffo',
  '........................offso.',
  '........................fffo..',
  '.......................ssso...',
  '......................oooo....',
  '..............................',
  '..............................',
];
export const BODY_H = SIT_HALF.length;   // how tall a sitting cat is, in pixels

// The face on its own is the sitting cat's head (rows 0-13) closed off with a chin.
const HEAD_ROWS = 14;
// How wide the cat is follows the art: the left half is HALF_W columns, so the whole cat is 2 x HALF_W - 1.
export const HALF_W = Math.max(...SIT_HALF.map((row) => row.length));
export const FACE_HALF = [...SIT_HALF.slice(0, HEAD_ROWS), d(HALF_W - 6) + r('o', 6)];

export const FACE_X = 2;   // the whiskers start at column 2, so the face view skips the empty columns either side
export const WIDTH = 2 * HALF_W - 1;   // the left half, the centre line and the right half
export const FACE_W = WIDTH - 2 * FACE_X;
export const BODY_W = Math.max(WIDTH, ...TAIL_A.map((r) => r.length), ...TAIL_B.map((r) => r.length));   // the tail may stick out past the body

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

// ---- coats: the base colours of each pattern. Where the accent colours (a, b) go is drawn in src/coats.ts ----
interface Coat { f: string; s: string; W: string; a: string; b: string; tail?: string }

const shade = (hex: string, f: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');

function coatOf(look: CatLook): Coat {
  const fur = look.fur;
  const base = { a: shade(fur, 0.8), b: shade(fur, 0.8) };
  switch (look.pattern) {
    case 'stripes': return { ...base, f: fur, s: shade(fur, 0.74), W: WHITE };
    case 'mask': return { ...base, f: fur, s: fur, W: WHITE };
    case 'patch': return { ...base, f: WHITE, s: WHITE, W: WHITE, a: fur, tail: 'a' };
    case 'calico': return { ...base, f: WHITE, s: WHITE, W: WHITE, a: '#6b4a45', b: '#ffb06a', tail: 'b' };
    case 'point': return { ...base, f: fur, s: fur, W: '#fff8f0', a: '#8a6a5a', b: '#8a6a5a', tail: 'a' };
    default: return { ...base, f: fur, s: fur, W: fur };   // plain: one solid colour
  }
}

function colors(look: CatLook, coat: Coat, dead: boolean): Record<string, string> {
  const h = hashOf(look.fur + look.pattern);
  return {
    o: OUTLINE, f: dead ? '#cdc8e0' : coat.f, s: dead ? '#bdb8d2' : coat.s, W: dead ? '#e8e5f2' : coat.W, a: coat.a, b: coat.b,
    p: '#ffb3c6', c: '#ffa6c0', n: '#f77fa0', m: OUTLINE, t: '#8fd0fa', h: '#ffd36e',
    e: '#2a1f4a', E: look.pattern === 'point' ? '#6fb8f5' : EYES[h % EYES.length],
  };
}

type Grid = string[][];
const mirror = (half: string[]): Grid => half.map((row) => { const r = [...row.padEnd(HALF_W, '.')]; return [...r, ...r.slice(0, -1).reverse()]; });

// Lay a coat layer (rows of slot letters, from src/coats.ts) over a grid: a letter repaints fur, shade and white cells.
function applyLayer(grid: Grid, layer: string[] | undefined, over = 'fsW', maxRow = Infinity) {
  layer?.forEach((row, y) => {
    if (y >= maxRow) return;
    [...row].forEach((ch, x) => { const cur = grid[y]?.[x]; if (ch !== '.' && cur && over.includes(cur)) grid[y][x] = ch; });
  });
}

function build(face: Face, look: CatLook, sitting: boolean): { grid: Grid; coat: Coat; blink: Cell[] } {
  const coat = coatOf(look);
  const grid = mirror(sitting ? SIT_HALF : FACE_HALF);
  applyLayer(grid, COAT_SIT[look.pattern], 'fsW', sitting ? Infinity : HEAD_ROWS);
  // The face is placed relative to where your art puts the eyes (the 'e' in row 8; the original had them at column 10),
  // so redrawing or shifting the head does not leave the eyes behind.
  const eyeAt = SIT_HALF[8].indexOf('e'), dx = (eyeAt < 0 ? 10 : eyeAt) - 10, mx = (c: number) => WIDTH - 1 - c;
  for (const [c, row, ch] of EXPRESSION[face](11)) {
    grid[row][c + dx] = ch;
    grid[row][mx(c + dx)] = ch;
  }
  const open = face === 'open' || face === 'sad';
  if (open) for (const c of [10 + dx, mx(10 + dx)]) grid[8][c] = 'E';   // coloured iris above a dark pupil
  const blink: Cell[] = open ? [[10 + dx, 8], [10 + dx, 9], [mx(10 + dx), 8], [mx(10 + dx), 9]] : [];
  // Open eyes are two pixels wide and two tall: iris colour on the outer side, dark outline on the inner side.
  // The sad face keeps the original single-pixel eyes.
  if (face === 'open') {
    for (const row of [8, 9]) {
      for (const [iris, edge] of [[9 + dx, 10 + dx], [mx(9 + dx), mx(10 + dx)]]) { grid[row][iris] = 'E'; grid[row][edge] = 'e'; blink.push([iris, row]); }
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
  return `<svg class="sprite${faded ? ' faded' : ''}" style="--w:${FACE_W}" viewBox="${FACE_X} 0 ${FACE_W} ${grid.length}" aria-hidden="true" shape-rendering="crispEdges">${draw(grid, colors(look, coat, face === 'dead'))}</svg>`;
}

// The sitting cat for the room. Blinks and swishes its tail (CSS animations, see page.html).
export function bodySvg(face: Face, look: CatLook, seed = 0): string {
  const { grid, coat, blink } = build(face, look, true);
  const pal = colors(look, coat, face === 'dead');
  const tail = (rows: string[]) => rows.flatMap((row, y) => [...row].map((ch, x) =>
    (pal[ch] ? rect(x, y, pal[ch === 'f' && coat.tail ? coat.tail : ch]) : ''))).join('');
  const blinkG = blink.length ? `<g class="blink">${blink.map(([x, y]) => rect(x, y, pal.f)).join('')}</g>` : '';
  const delay = `${-((seed % 40) / 10).toFixed(1)}s`;
  return `<svg class="sprite body" style="--d:${delay};--w:${BODY_W}" viewBox="0 0 ${BODY_W} ${grid.length}" aria-hidden="true" shape-rendering="crispEdges">` +
    `<g class="tail a">${tail(TAIL_A)}</g><g class="tail b">${tail(TAIL_B)}</g>${draw(grid, pal)}${blinkG}</svg>`;
}

// ---- the curled-up napping cat (any size): head tucked on its paws, tail wrapped round the front ----
// EDIT ME: one character per pixel, rows should be the same width. `npm run preview` shows the change as you save.
//   o outline   f main colour   s belly shade   W paws, muzzle  (patches and stripes live in src/coats.ts)
//   T, D tail (light, dark stripe)   p ear pink   e closed eye   n nose   c blush   . empty
export const NAP = [
  '.....................o...............',
  '.......ooooooo......ofo..............',
  '.....oooffffffoo...oopfo.............',
  '....ooffffffffffo..opppfoooo.........',
  '...offfffffffffffooofffffffooo.......',
  '..ooffffffffffffffoffffffffffoo......',
  '.ooffffffffffffffofffffffffffffooooo.',
  'ooffffffffffffffsoffffffffffffffffpo.',
  'oofffffffffooossofffffffffffffffpppo.',
  'offfffffffffffosoffofffffffffffffpo..',
  'offofffffffffffoofffoffffffffffffo...',
  'offosfffffffffffoofffofffffffffffo...',
  'offosssfffffffffoffffffffffffffffo...',
  'offfoossssssffffsoffffnffooooffffo...',
  'ooffffoooooooffsooooffffffsssssso....',
  '.offfffffffffofsfffooosssssoooooo....',
  '..osssffffffffosoffffooooooofffoo....',
  '...oossssssssosssossssossossssso.....',
  '.....ooooooooooooooooooooooooooo.....',
];
// The size follows whatever you draw: the widest row sets the width, shorter rows are padded with empty pixels.
export const NAP_W = Math.max(...NAP.map((r) => r.length));
export const NAP_H = NAP.length;

// Which colour each letter takes for a given coat. Patches only show on calico and patch cats; the rest stay one colour.
function napColors(look: CatLook): Record<string, string> {
  const coat = coatOf(look);
  const pal = colors(look, coat, false);
  const f = coat.f, calico = look.pattern === 'calico';
  return {
    ...pal, f, s: shade(f, 0.9), S: coat.s, W: coat.W,   // s is the belly shade; S is the coat's own shade (tabby stripes)
    T: calico ? '#a58a80' : shade(f, 0.88), D: calico ? coat.a : shade(f, 0.72),
  };
}

// The napping cat. It breathes (CSS) and has no tail frames.
export function napSvg(look: CatLook): string {
  const grid: Grid = NAP.map((row) => [...row.padEnd(NAP_W, '.')]);
  applyLayer(grid, COAT_NAP[look.pattern], 'fsWT');
  return `<svg class="sprite nap" style="--w:${NAP_W}" viewBox="0 0 ${NAP_W} ${NAP_H}" aria-hidden="true" shape-rendering="crispEdges">${draw(grid, napColors(look))}</svg>`;
}

// The mini face (13 x 10 pixels) is for small spots: thought bubbles, moods, legends. It is drawn on the same
// pixel grid as everything else, so it is never the big face scaled down.
const MINI = [
  'oo.......oo.',
  'oFo.....oFo.',
  'oFFoooooFFo.',
  'oFFFFFFFFFo.',
  'oFeFFFFFeFo.',
  'oFeFFnFFeFo.',
  'ocFFmFmFFco.',
  'oFFFFFFFFFo.',
  '.ooooooooo..',
];
// The face is cropped to the columns you actually drew in, so stray empty columns never push it off-centre. Its centre
// line is found from row 3 (the widest row), and the expressions below are written for the left side and mirrored.
const MINI_X0 = Math.min(...MINI.map((r) => r.search(/[^.]/)).filter((n) => n >= 0));
const MINI_X1 = Math.max(...MINI.map((r) => r.replace(/\.+$/, '').length));
export const MINI_W = MINI_X1 - MINI_X0;
const MINI_RIGHT = MINI[3].replace(/\.+$/, '').length - 1;   // the column of the face's right-hand outline
const mirrorMini = (cells: [number, number, string][]): [number, number, string][] => cells.flatMap(([x, y, ch]) => [[x, y, ch], [MINI_RIGHT - x, y, ch]] as [number, number, string][]);
// Left-side coordinates for the template above (eyes at column 2, nose at 5, mouth at 4 and 6, blush at 1).
const MINI_EXPR: Record<Face, [number, number, string][]> = {
  open: [],
  happy: mirrorMini([[2, 4, 'F'], [2, 5, 'F'], [2, 4, 'e'], [1, 5, 'e'], [3, 5, 'e']]).concat([[5, 6, 'm']]),
  sleepy: mirrorMini([[2, 4, 'F'], [2, 5, 'F'], [1, 5, 'e'], [2, 5, 'e'], [3, 5, 'e']]),
  sad: [[2, 6, 't'], [2, 7, 't'], [4, 6, 'F'], [6, 6, 'F'], [5, 6, 'm']],
  starving: mirrorMini([[2, 6, 't']]).concat([[4, 6, 'F'], [6, 6, 'F'], [5, 6, 'm'], [5, 7, 'm']]),
  dead: mirrorMini([[2, 4, 'F'], [2, 5, 'F'], [1, 4, 'e'], [3, 4, 'e'], [2, 5, 'e'], [1, 6, 'e'], [3, 6, 'e']]),
};

export function miniSvg(face: Face, look: CatLook, faded = false): string {
  const coat = coatOf(look);
  const pal = colors(look, coat, face === 'dead');
  const grid: Grid = MINI.map((row) => [...row]);
  applyLayer(grid, COAT_MINI[look.pattern], 'F');
  for (const [c, y, ch] of MINI_EXPR[face]) grid[y][c] = ch;
  pal.F = pal.f;
  grid.splice(3, 0, [...grid[3]]);   // one row taller: a second row of forehead
  // 'F' (fur) is the default slot of the template; keep the fur colour for painted cells that kept it
  return `<svg class="sprite mini${faded ? ' faded' : ''}" style="--w:${MINI_W}" viewBox="${MINI_X0} 0 ${MINI_W} ${grid.length}" aria-hidden="true" shape-rendering="crispEdges">${draw(grid, pal)}</svg>`;
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
export const CONFETTI_COLORS = ['#ff8fb8', '#ffd36e', '#8fd0fa', '#9be0cf', '#b9a3f0', '#ffb3c6'];
export function popperSvg(): string {
  const pal: Record<string, string> = { o: OUTLINE, y: '#ffd36e', r: '#ff8fb8' };
  return `<svg viewBox="0 0 13 10" aria-hidden="true" shape-rendering="crispEdges">${draw(CONE.map((row) => [...row]), pal)}</svg>`;
}
