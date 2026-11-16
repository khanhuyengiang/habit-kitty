// The cosy room and the garden: two big pixel-art scenes, 240 x 320 pixels each. A cat is 30 pixels wide, so the kitties
// are small in a big, detailed room, like characters in a cosy game. Everything is whole-pixel rectangles in palette colours.
//
// Each scene is drawn once in its daytime colours; dusk and night lay a see-through wash over it (see WASH), so a new object
// never needs three colourings. The sky, the stars and the glow of lamps and fireflies are drawn per time of day.
import { PAL } from './shared/pixelart.ts';
import { PALETTE } from './shared/palette.ts';

export const ROOM_W = 240, ROOM_H = 320;
export type Phase = 'day' | 'dusk' | 'night';

export const BOOK_ART = ['.ooooooo.', 'orrrrrrro', 'orrwwwrro', 'orrrrrrro', 'orrwwwrro', 'orrrrrrro', 'orrrrrrro', 'owwwwwwwo', '.ooooooo.'];
export const TROPHY_ART = ['ooooooooo', 'oyyyyyyyo', 'oyywwyyyo', 'oyyyyyyyo', '.oyyyyyo.', '..oyyyo..', '...oyo...', '..ooooo..', '.oyyyyyo.', 'ooooooooo'];

export type SceneId = 'room' | 'garden';
export type Spot = [number, number];

// Where kitties can be: [x, feet-y] in room pixels (the cat's left edge and the row its feet stand on). These are the
// official ones; the live lists below are what the app uses, and Kitty Gallery can put your own in them (see useScene).
export const OFFICIAL_ROOM_SPOTS: readonly Spot[] = [
  [17, 290], [46, 246], [162, 250], [98, 306], [83, 153], [123, 153], [200, 107], [181, 172], [200, 241], [204, 306], [104, 262],
];
// At night they curl up in the soft places first: the cushion bed, the sofa, the cat tree.
const OFFICIAL_ROOM_NIGHT_SPOTS: readonly Spot[] = [
  [17, 290], [83, 153], [123, 153], [200, 107], [181, 172], [200, 241], [46, 246], [162, 250], [104, 262], [98, 306], [204, 306],
];
export const OFFICIAL_GARDEN_SPOTS: readonly Spot[] = [[24, 199], [70, 130], [104, 190], [200, 240], [36, 256], [150, 226], [118, 150], [70, 226]];
// The diary book and the trophy stand on top of the bookcase: [x, y] of their top-left corner, in room pixels.
export const OFFICIAL_PROPS: Readonly<Record<'book' | 'trophy', Spot>> = { book: [9, 49], trophy: [21, 48] };

export const ROOM_SPOTS: Spot[] = OFFICIAL_ROOM_SPOTS.map((p) => [...p] as Spot);
export const ROOM_NIGHT_SPOTS: Spot[] = OFFICIAL_ROOM_NIGHT_SPOTS.map((p) => [...p] as Spot);
export const GARDEN_SPOTS: Spot[] = OFFICIAL_GARDEN_SPOTS.map((p) => [...p] as Spot);
// [x, y, w, h] in room pixels: where they are drawn, and their click areas.
export const SHELF_BOOK: [number, number, number, number] = [...OFFICIAL_PROPS.book, 9, 9];
export const SHELF_TROPHY: [number, number, number, number] = [...OFFICIAL_PROPS.trophy, 9, 10];

// ---------- scenes of your own (from Kitty Gallery) ----------
// A scene drawn in Kitty Gallery replaces the official picture: rows of letters with their colours, and (in the app) the same
// as a picture (href, a PNG data URL), which draws far faster than thousands of rectangles. Its spots replace the official ones.
export interface CustomScene { art: string[]; colors: Record<string, string>; href?: string; spots: Spot[]; props?: Record<'book' | 'trophy', Spot> }
const custom: Partial<Record<SceneId, CustomScene>> = {};
let version = 0;
export const sceneVersion = () => version;
const refill = (live: Spot[], from: readonly Spot[]) => { live.splice(0, live.length, ...from.map((p) => [...p] as Spot)); };
export function useScene(id: SceneId, scene: CustomScene | null) {
  if (scene) custom[id] = scene; else delete custom[id];
  version++;
  if (id === 'garden') { refill(GARDEN_SPOTS, scene?.spots ?? OFFICIAL_GARDEN_SPOTS); return; }
  refill(ROOM_SPOTS, scene?.spots ?? OFFICIAL_ROOM_SPOTS);
  refill(ROOM_NIGHT_SPOTS, scene?.spots ?? OFFICIAL_ROOM_NIGHT_SPOTS);
  const props = scene?.props ?? OFFICIAL_PROPS;
  SHELF_BOOK[0] = props.book[0]; SHELF_BOOK[1] = props.book[1];
  SHELF_TROPHY[0] = props.trophy[0]; SHELF_TROPHY[1] = props.trophy[1];
}

const P = PALETTE;

// ---------- drawing helpers ----------
// Every rectangle lands on whole pixels, whatever maths placed it.
function R(x: number, y: number, w: number, h: number, f: string): string {
  const x0 = Math.round(x), y0 = Math.round(y), ww = Math.round(x + w) - x0, hh = Math.round(y + h) - y0;
  return ww > 0 && hh > 0 ? `<rect x="${x0}" y="${y0}" width="${ww}" height="${hh}" fill="${f}"/>` : '';
}

// A picture from rows of letters, with its own colours; runs of one letter become one rectangle.
function spr(x: number, y: number, rows: string[], pal: Record<string, string>): string {
  let s = '';
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length;) {
      let k = i + 1;
      while (k < row.length && row[k] === row[i]) k++;
      if (pal[row[i]]) s += R(x + i, y + j, k - i, 1, pal[row[i]]);
      i = k;
    }
  });
  return s;
}

// A stepped ellipse out of whole pixels.
function blob(cx: number, cy: number, rx: number, ry: number, f: string): string {
  let s = '';
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
    s += R(cx - half, cy + y, half * 2, 1, f);
  }
  return s;
}

// A filled box with a one-pixel outline and notched corners.
function box(x: number, y: number, w: number, h: number, fill: string, edge: string): string {
  return R(x + 1, y, w - 2, 1, edge) + R(x + 1, y + h - 1, w - 2, 1, edge) + R(x, y + 1, 1, h - 2, edge) + R(x + w - 1, y + 1, 1, h - 2, edge)
    + R(x + 1, y + 1, w - 2, h - 2, fill);
}

// A box with a lit top edge and a shaded bottom edge inside its outline.
function shaded(x: number, y: number, w: number, h: number, fill: string, lit: string, dark: string, edge: string): string {
  return box(x, y, w, h, fill, edge) + R(x + 1, y + 1, w - 2, 1, lit) + R(x + 1, y + h - 2, w - 2, 1, dark);
}

// An arch: a half circle on top of a rectangle (w even).
function arch(x: number, y: number, w: number, h: number, f: string): string {
  const r = w / 2;
  let s = '';
  for (let j = 0; j < r; j++) {
    const half = Math.round(Math.sqrt(r * r - (r - j - 0.5) ** 2));
    s += R(x + r - half, y + j, half * 2, 1, f);
  }
  return s + R(x, y + r, w, h - r, f);
}

// A steady pseudo-random number in [0, 1) for a position, so scattered details stay put between redraws.
function rnd(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- dusk and night ----------
// A see-through wash over the whole scene: warm at dusk, a deep blue at night. The colours underneath stay palette colours;
// only what the screen shows is mixed (like a color-mix()). The sky and the lights are drawn on top of it.
const WASH: Record<Phase, string> = { day: '', dusk: `<rect x="0" y="0" width="240" height="320" fill="${P.peach}" opacity=".22"/>`,
  night: `<rect x="0" y="0" width="240" height="320" fill="${P.night900}" opacity=".5"/>` };

const svg = (s: string, cls: string) =>
  `<svg class="${cls}" viewBox="0 0 ${ROOM_W} ${ROOM_H}" shape-rendering="crispEdges" aria-hidden="true">${s}</svg>`;

// ---------- small things used in both scenes ----------
const LEAF = { g: P.green500, G: P.green700, m: P.mint400, l: P.lime };
const PLANT = [
  '.......m........',
  '.....m.gG.......',
  '....mGggGg..m...',
  '..m.gGGgg..gG...',
  '.mGg.gGg..gGg...',
  '.ggGgggG.gGgg...',
  '..gGGgGggGgg....',
  '...ggGGgGgg.....',
  '..gG.gGGg.Gg....',
  '.gGg..gG..gGg...',
  '..g...gG...g....',
  '.......G........',
];
const POT = ['...oooooooooo...', '...owwwwwwwwo...', '...oppppppppo...', '....oppppppo....', '....oPPPPPPo....', '.....oooooo.....'];
const plant = (x: number, y: number, pot: string, potD: string) =>
  spr(x, y, PLANT, LEAF) + spr(x, y + 12, POT, { o: P.lavender600, w: P.cream, p: pot, P: potD });

// A pink tulip bunch in a vase (like the ones in the pictures).
const TULIPS = [
  '..r.rr..r...',
  '.rRrRRrrRr..',
  '.rRRrRRrRR..',
  '..rr.rr.rr..',
  '...g.Gg.g...',
  '.gg.gG.g.gg.',
  '..gggGggg...',
  '....oooo....',
  '...owwwwo...',
  '...owbbwo...',
  '...owwwwo...',
  '....oooo....',
];
const tulips = (x: number, y: number) => spr(x, y, TULIPS, { r: P.pink300, R: P.pink100, g: P.green500, G: P.green700, o: P.lavender600, w: P.cream, b: P.blue100 });

// A blue and lilac hydrangea head.
const HYD = ['..bBb.vVv..', '.bBbBbVvVv.', 'bBbbBbvVvVv', '.bBbBbVvVv.', '..bBbvVvVv.', '...bb.vv...'];
const hydrangea = (x: number, y: number) => spr(x, y, HYD, { b: P.blue300, B: P.blue100, v: P.lavender300, V: P.lavender200 });

// A tiny flower: a cross of petals around a centre.
const flower = (x: number, y: number, petal: string, mid: string, stem = P.green700) =>
  R(x, y + 2, 1, 3, stem) + R(x - 1, y, 3, 1, petal) + R(x, y - 1, 1, 3, petal) + R(x, y, 1, 1, mid);

// ===================================================================================================
// the cosy room
// ===================================================================================================
const SKIES: Record<Phase, string[]> = {   // the window's sky, top band to bottom
  day: [P.blue100, P.blue100, P.blue50],
  dusk: [P.lavender200, P.pink100, P.peach],
  night: [P.night900, P.night800, P.plum800],
};

// The sky seen through a window (or over the garden) between x0..x1, y0..y1.
function sky(phase: Phase, x0: number, y0: number, w: number, h: number): string {
  const bands = SKIES[phase];
  let s = '';
  const bh = Math.ceil(h / bands.length);
  bands.forEach((c, i) => { s += R(x0, y0 + i * bh, w, Math.min(bh, h - i * bh), c); });
  // a dithered seam between the bands
  for (let i = 1; i < bands.length; i++) for (let x = x0 + (i % 2); x < x0 + w - 1; x += 2) s += R(x, y0 + i * bh - 1, 1, 1, bands[i]) + R(x + 1, y0 + i * bh, 1, 1, bands[i - 1]);
  return s;
}
function cloud(x: number, y: number, w: number, c: string, shade: string): string {
  return blob(x + w / 2, y + 4, w / 2, 3, shade) + blob(x + w / 2, y + 3, w / 2, 3, c) + blob(x + w / 3, y, w / 4, 3, c) + blob(x + (2 * w) / 3, y + 1, w / 5, 2, c);
}
function sun(x: number, y: number, c: string, rim: string): string {
  return blob(x, y, 7, 7, rim) + blob(x, y, 6, 6, c);
}
// A crescent: a full disc with its dark part cut out of the right side, row by row.
function moonAt(x: number, y: number): string {
  let s = '';
  for (let j = -6; j <= 6; j++) {
    const half = Math.round(6 * Math.sqrt(Math.max(0, 1 - (j * j) / 42.25)));
    const cut = Math.round(5 * Math.sqrt(Math.max(0, 1 - ((j + 2) * (j + 2)) / 30.25)));
    const right = cut ? x + 3 - cut : x + half;
    s += R(x - half, y + j, Math.max(0, right - (x - half)), 1, P.butter50);
  }
  return s;
}
function stars(x0: number, y0: number, w: number, h: number, n: number, seed: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.floor(rnd(i, seed) * w), y = y0 + Math.floor(rnd(seed, i) * h);
    s += i % 4 === 0 ? R(x - 1, y, 3, 1, P.butter200) + R(x, y - 1, 1, 3, P.butter200) : R(x, y, 1, 1, i % 3 ? P.white : P.butter200);
  }
  return s;
}

function windowSky(phase: Phase): string {
  const x = 94, y = 24, w = 52, h = 78;
  let s = sky(phase, x, y, w, h);
  if (phase === 'day') s += sun(132, 40, P.sun300, P.butter200) + cloud(98, 58, 22, P.white, P.blue50) + cloud(120, 78, 18, P.white, P.blue50);
  else if (phase === 'dusk') s += sun(110, 82, P.orange, P.sun300) + cloud(118, 50, 22, P.pink50, P.pink100);
  return s;
}
// The moon and stars shine through the night wash (kept inside the arch).
const windowLights = (phase: Phase) => (phase === 'night' ? moonAt(130, 40) + stars(108, 30, 24, 8, 2, 6) + stars(97, 40, 20, 18, 5, 7) + stars(123, 46, 20, 12, 4, 8) + stars(96, 64, 48, 20, 4, 9) : '');

// The sky is drawn as a rectangle; this rounds off its top to the arch again: the pixels of the rectangle outside the glass
// become the cream frame, its outline, or the wall, as arch() draws them.
const halfAt = (r: number, j: number) => (j < r ? Math.round(Math.sqrt(r * r - (r - j - 0.5) ** 2)) : r);
function archTop(): string {
  const glass = { x: 94, y: 24, r: 26 }, frame = { x: 91, y: 21, r: 29 }, edge = { x: 90, y: 20, r: 30 };
  const inside = (a: typeof glass, x: number, y: number) => { const j = y - a.y, h = halfAt(a.r, j); return j >= 0 && x >= a.x + a.r - h && x < a.x + a.r + h; };
  let s = '';
  for (let y = glass.y; y < glass.y + glass.r; y++) for (let x = glass.x; x < glass.x + 2 * glass.r; x++) {
    if (inside(glass, x, y)) continue;
    s += R(x, y, 1, 1, inside(frame, x, y) ? P.cream : inside(edge, x, y) ? P.lavender600 : P.pink50);
  }
  // a thin line where the glass meets the frame, so the curve reads clearly
  for (let y = glass.y; y < glass.y + glass.r; y++) {
    const h = halfAt(glass.r, y - glass.y), l = glass.x + glass.r - h, rr = glass.x + glass.r + h - 1;
    const hPrev = y > glass.y ? halfAt(glass.r, y - glass.y - 1) : 0;
    const w = Math.max(1, h - hPrev);
    s += R(l - w, y, w, 1, P.lavender200) + R(rr + 1, y, w, 1, P.lavender200);
  }
  return s + R(glass.x + glass.r - halfAt(glass.r, 0), glass.y - 1, 2 * halfAt(glass.r, 0), 1, P.lavender200);
}

function roomBase(): string {
  const o = P.lavender600, soft = P.lavender400;
  let s = '';
  // --- wall: soft pink wallpaper with a little diamond pattern ---
  s += R(0, 0, 240, 160, P.pink50);
  for (let y = 14, row = 0; y < 116; y += 12, row++) for (let x = (row % 2) * 8 + 4; x < 240; x += 16) {
    s += R(x, y - 1, 1, 1, P.pink100) + R(x - 1, y, 3, 1, P.pink100) + R(x, y + 1, 1, 1, P.pink100);
  }
  // ceiling trim
  s += R(0, 0, 240, 6, P.cream) + R(0, 6, 240, 1, P.lavender100) + R(0, 7, 240, 1, soft);
  // wainscot: cream panels under a rail
  s += R(0, 116, 240, 44, P.cream) + R(0, 116, 240, 1, soft) + R(0, 117, 240, 2, P.white) + R(0, 119, 240, 1, P.lavender100) + R(0, 120, 240, 1, soft);
  for (let x = 4; x < 236; x += 26) s += R(x, 125, 22, 1, P.lavender200) + R(x, 125, 1, 26, P.lavender200) + R(x + 21, 126, 1, 25, P.white) + R(x + 1, 150, 21, 1, P.white);
  // baseboard
  s += R(0, 155, 240, 1, soft) + R(0, 156, 240, 5, P.lavender100) + R(0, 160, 240, 1, soft);

  // --- floor: warm wooden planks ---
  s += R(0, 161, 240, 159, P.tan);
  for (let y = 161, row = 0; y < 320; y += 9, row++) {
    s += R(0, y, 240, 1, P.wood);
    s += R(0, y + 1, 240, 1, P.butter50);
    for (let x = (row * 37) % 60; x < 240; x += 60) s += R(x, y, 1, 9, P.wood);
    for (let i = 0; i < 5; i++) {   // wood grain
      const gx = Math.floor(rnd(row, i, 3) * 230), gw = 4 + Math.floor(rnd(i, row, 4) * 10);
      s += R(gx, y + 3 + (i % 5), gw, 1, P.peach);
    }
  }
  // a soft shadow along the wall
  s += R(0, 161, 240, 2, P.wood);

  // --- window with an arched top, curtains and a sill ---
  s += arch(90, 20, 60, 86, o) + arch(91, 21, 58, 84, P.cream) + arch(94, 24, 52, 78, P.blue100);   // the sky goes on top (windowSky)
  // curtain rod and curtains
  s += R(74, 14, 92, 2, P.gold500) + R(74, 16, 92, 1, P.orange) + R(72, 13, 3, 4, P.orange) + R(165, 13, 3, 4, P.orange);
  for (const [cx, dir] of [[76, 1], [146, -1]] as const) {
    const w = 18;
    s += R(cx, 17, w, 92, P.white);
    for (let k = 0; k < w; k += 4) s += R(cx + k + 1, 17, 1, 92, P.lavender50) + R(cx + k + 2, 17, 1, 92, P.lavender100);
    s += R(dir > 0 ? cx : cx + w - 1, 17, 1, 92, soft) + R(cx, 109, w, 1, soft);
    // a pink tie-back
    s += R(cx, 70, w, 3, P.pink300) + R(cx, 73, w, 1, P.pink500) + R(dir > 0 ? cx + w - 4 : cx, 68, 4, 7, P.pink300);
  }
  // sill with little plants
  s += R(86, 104, 68, 3, P.cream) + R(86, 107, 68, 1, soft) + R(86, 104, 68, 1, P.white);
  s += spr(98, 94, ['..g.g..', '.gGgGg.', '..GgG..', '.ooooo.', '.oppPo.', '..ooo..'], { g: P.mint400, G: P.green700, o: o, p: P.pink200, P: P.pink400 });
  s += spr(132, 92, ['...y...', '..yYy..', '...g...', '.g.g.g.', '..ggg..', '.ooooo.', '.owwbo.', '..ooo..'], { y: P.sun300, Y: P.orange, g: P.green500, o: o, w: P.cream, b: P.blue100 });

  // --- framed pictures on the right wall ---
  s += box(176, 26, 22, 18, P.wood, o) + R(178, 28, 18, 14, P.blue50);
  s += spr(180, 31, ['.rr.rr.', 'rrrrrrr', 'rRrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: P.pink300, R: P.pink50 }) + R(189, 37, 5, 2, P.green100);
  s += box(202, 22, 16, 24, P.wood, o) + R(204, 24, 12, 20, P.butter50);
  s += spr(205, 27, ['...gg.', '..gGg.', '.gGg..', 'gGg...', '.G....', 'G.....', '......', '..mm..', '.mmmm.'], { g: P.green500, G: P.green700, m: P.mint200 });
  s += box(222, 30, 14, 12, P.wood, o) + R(224, 32, 10, 8, P.lavender100) + R(226, 34, 2, 2, P.sun300) + R(224, 37, 10, 3, P.mint200) + R(228, 36, 4, 1, P.mint200);
  // a wall clock
  s += blob(188, 62, 7, 7, o) + blob(188, 62, 6, 6, P.cream) + R(188, 57, 1, 6, o) + R(188, 62, 4, 1, o) + R(187, 55, 3, 1, P.pink300);
  // a pennant garland over the frames
  for (let i = 0, x = 172; x < 236; i++, x += 7) {
    const c = [P.pink300, P.blue300, P.butter200, P.lavender300][i % 4], dy = Math.round(Math.sin(i / 1.6) * 1.5);
    s += R(x, 12 + dy, 7, 1, soft) + R(x + 1, 13 + dy, 5, 1, c) + R(x + 2, 14 + dy, 3, 1, c) + R(x + 3, 15 + dy, 1, 1, c);
  }

  // --- bookcase, left: books above, mint cupboard below; the diary book and the trophy stand on top ---
  s += box(4, 58, 42, 110, P.wood, o) + R(5, 59, 40, 1, P.tan) + R(6, 61, 38, 1, P.brown);
  for (const sy of [62, 84]) {
    s += R(7, sy, 36, 20, P.umber) + R(7, sy + 20, 36, 2, P.tan) + R(7, sy + 22, 36, 1, P.brown);
    const cols = [P.pink300, P.blue300, P.lavender300, P.butter200, P.mint400, P.pink200, P.peach, P.blue500, P.lavender500, P.pink500];
    for (let bx = 8, i = 0; bx < 42; i++) {
      const w = 2 + Math.floor(rnd(bx, sy) * 3), h = 12 + Math.floor(rnd(sy, bx) * 7);
      if (bx + w > 42) break;
      const c = cols[Math.floor(rnd(i, sy, 2) * cols.length)];
      if (rnd(bx, i, 9) < 0.12) { s += R(bx, sy + 20 - 3, 7, 3, c) + R(bx, sy + 18, 7, 1, P.cream); bx += 8; continue; }   // a lying book
      s += R(bx, sy + 20 - h, w, h, c) + R(bx, sy + 22 - h, w, 1, P.cream) + R(bx, sy + 16, w, 1, P.cream);
      bx += w + (rnd(bx, 5) < 0.15 ? 1 : 0);
    }
  }
  // a little plant and a jar on the lower shelf corner
  s += spr(34, 97, ['.g.g.', 'gGgGg', '.ooo.', '.opo.', '.ooo.'], { g: P.green500, G: P.green700, o: o, p: P.pink200 });
  // the cupboard
  s += R(7, 107, 36, 58, P.mint400);
  s += box(8, 108, 17, 56, P.mint200, o) + box(25, 108, 17, 56, P.mint200, o);
  s += R(10, 111, 13, 50, P.mint400) + R(27, 111, 13, 50, P.mint400) + R(11, 112, 11, 48, P.mint200) + R(28, 112, 11, 48, P.mint200);
  s += R(22, 134, 2, 4, P.gold500) + R(26, 134, 2, 4, P.gold500);
  s += R(4, 166, 4, 4, P.brown) + R(42, 166, 4, 4, P.brown);
  // a little plant on top
  s += spr(33, 44, ['..g.g..', '.gGgGg.', 'gGgmgGg', '.gGgGg.', '..ooo..', '.oppPo.', '.oppPo.', '..ooo..'], { g: P.green500, G: P.green700, m: P.mint400, o: o, p: P.peach, P: P.orange });

  // --- floor lamp between the bookcase and the sofa ---
  s += spr(48, 82, [
    '....oooooooo....',
    '...occcccccco...',
    '..occcwcccccco..',
    '..occwccccccco..',
    '.occcccccccccco.',
    '.occcccccccccco.',
    'occccccccccccccco',
    'otttttttttttttto',
    '.oooooooooooooo.',
  ], { o: o, c: P.butter50, w: P.white, t: P.tan });
  s += R(55, 91, 2, 74, P.wood) + R(57, 91, 1, 74, P.brown) + R(51, 164, 10, 2, P.wood) + R(50, 166, 12, 2, P.brown) + R(50, 168, 12, 1, o);

  // --- sofa under the window ---
  const sofa = P.pink200, sofaL = P.pink100, sofaD = P.pink400, sofaE = P.pink600;
  s += box(74, 118, 92, 28, sofa, sofaE) + R(75, 119, 90, 2, sofaL);
  for (let x = 75; x < 165; x += 30) s += R(x, 121, 1, 24, sofaD);
  s += R(104, 121, 1, 24, sofaD) + R(134, 121, 1, 24, sofaD);
  // seat cushions
  s += box(78, 143, 42, 14, sofa, sofaE) + box(120, 143, 42, 14, sofa, sofaE) + R(79, 144, 40, 2, sofaL) + R(121, 144, 40, 2, sofaL);
  s += R(74, 155, 92, 12, sofaD) + R(74, 155, 92, 1, sofaE) + R(74, 166, 92, 1, sofaE) + R(76, 157, 88, 1, sofa);
  // arms
  for (const ax of [68, 160]) s += box(ax, 130, 12, 38, sofa, sofaE) + R(ax + 1, 131, 10, 3, sofaL) + R(ax + 1, 162, 10, 5, sofaD);
  // legs
  s += R(71, 168, 3, 4, P.brown) + R(166, 168, 3, 4, P.brown) + R(112, 167, 3, 3, P.brown) + R(125, 167, 3, 3, P.brown);
  // throw cushions
  s += spr(80, 128, ['.ooooooooo.', 'ovvvvvvvvvo', 'ovVvvvvvvvo', 'ovvvvwvvvvo', 'ovvvwwwvvvo', 'ovvvvwvvvvo', 'ovvvvvvvvvo', 'ovvvvvvvvdo', '.ooooooooo.'],
    { o: P.lavender500, v: P.lavender300, V: P.lavender200, w: P.cream, d: P.lavender500 });
  s += spr(148, 128, ['.ooooooooo.', 'obbbbbbbbbo', 'obBbbbbbbbo', 'obbrbbbrbbo', 'obbbbbbbbbo', 'obbrbbbrbbo', 'obbbbbbbbbo', 'obbbbbbbbBo', '.ooooooooo.'],
    { o: P.blue500, b: P.blue300, B: P.blue100, r: P.pink300 });

  // --- side table with tulips, right of the sofa ---
  s += box(168, 146, 10, 4, P.wood, o) + R(170, 150, 2, 18, P.brown) + R(174, 150, 2, 18, P.brown);

  // --- cat tree on the right ---
  const post = P.tan, rope = P.wood, cap = P.lavender300, capL = P.lavender200, capD = P.lavender500;
  // posts (rope wound)
  s += R(208, 112, 8, 130, post) + R(208, 112, 1, 130, o) + R(215, 112, 1, 130, o);
  for (let y = 114; y < 240; y += 3) s += R(209, y, 6, 1, rope);
  s += R(186, 176, 6, 64, post) + R(186, 176, 1, 64, o) + R(191, 176, 1, 64, o);
  for (let y = 178; y < 240; y += 3) s += R(187, y, 4, 1, rope);
  // top platform with a cup bed
  s += shaded(194, 104, 44, 10, cap, capL, capD, o);
  s += R(198, 98, 36, 6, P.pink200) + R(198, 98, 36, 1, o) + R(197, 99, 1, 5, o) + R(234, 99, 1, 5, o) + R(199, 99, 34, 1, P.pink100);
  // a dangling toy
  s += R(196, 114, 1, 18, o) + blob(196, 134, 2, 2, P.pink300) + R(196, 133, 1, 1, P.pink50);
  // middle platform
  s += shaded(178, 170, 40, 9, cap, capL, capD, o);
  // base
  s += shaded(182, 238, 56, 12, cap, capL, capD, o) + R(184, 248, 52, 1, P.lavender600);
  // a little hidey-hole house on the base
  s += box(216, 220, 22, 20, P.lavender200, o) + R(217, 221, 20, 2, P.lavender100) + R(221, 226, 12, 14, P.plum700) + R(222, 225, 10, 1, P.plum700) + R(221, 225, 1, 1, P.lavender200);

  // --- rug in the middle of the floor, with a pink border and fringe ---
  const rx = 30, ry = 198, rw = 176, rh = 70;
  s += R(rx + 2, ry, rw - 4, rh, P.mint400) + R(rx, ry + 2, rw, rh - 4, P.mint400);
  s += R(rx + 4, ry + 3, rw - 8, rh - 6, P.pink100) + R(rx + 7, ry + 6, rw - 14, rh - 12, P.green100);
  s += R(rx + 9, ry + 8, rw - 18, 1, P.mint400) + R(rx + 9, ry + rh - 9, rw - 18, 1, P.mint400) + R(rx + 9, ry + 8, 1, rh - 16, P.mint400) + R(rx + rw - 10, ry + 8, 1, rh - 16, P.mint400);
  for (let x = rx + 8; x < rx + rw - 8; x += 6) s += R(x, ry + 4, 2, 1, P.pink300) + R(x, ry + rh - 5, 2, 1, P.pink300);
  for (let y = ry + 10; y < ry + rh - 10; y += 8) for (let x = rx + 16; x < rx + rw - 14; x += 14) {
    const k = ((y - ry) / 8 + (x - rx) / 14) % 2;
    if (k) s += R(x, y, 1, 1, P.pink300) + R(x - 1, y + 1, 3, 1, P.pink300) + R(x, y + 2, 1, 1, P.pink300);
    else s += R(x, y + 1, 1, 1, P.mint200);
  }
  for (let x = rx + 3; x < rx + rw - 3; x += 2) s += R(x, ry - 2, 1, 2, P.cream) + R(x, ry + rh, 1, 2, P.cream);

  // --- coffee table on the rug: tea set and a book ---
  s += R(90, 212, 60, 1, o) + R(89, 213, 62, 7, P.cream) + R(89, 213, 1, 7, o) + R(150, 213, 1, 7, o) + R(90, 214, 60, 1, P.white) + R(89, 220, 62, 1, o);
  s += R(90, 221, 60, 3, P.lavender100) + R(90, 224, 60, 1, o);
  s += R(93, 225, 3, 9, P.lavender200) + R(144, 225, 3, 9, P.lavender200) + R(93, 225, 1, 9, o) + R(147, 225, 1, 9, o);
  s += spr(96, 203, ['...oo...', '..owwo..', '.owwwwo.ow', 'owwrrwwoow', 'owwwwwwo.', '.oooooo..'].map((r) => r.padEnd(10, '.')), { o: o, w: P.white, r: P.pink300 });
  s += spr(110, 207, ['oooo.', 'owwoo', 'owwoo', '.oo..'], { o: o, w: P.pink50 });
  s += spr(126, 208, ['oooooooooo', 'obbbbbbbbo', 'owwwwwwwwo', 'oooooooooo'], { o: o, b: P.blue300, w: P.cream });
  s += spr(140, 205, ['.o.', 'oro', 'oyo', 'ooo'], { o: o, r: P.pink300, y: P.butter200 });

  // --- a big plant in a basket next to the bookcase ---
  s += spr(2, 166, [
    '....m...m.....',
    '...mg..mg..m..',
    '.m.gG.mgG.mg..',
    'mgggGgggGmgG..',
    '.gGGggGGggG.m.',
    'mgGgGGgGgGGgg.',
    '.ggGgGGgGgGG..',
    '..gGggGgggG...',
    '...gGgGGgG....',
    '....GgGGg.....',
    '.....GGG......',
  ], LEAF);
  s += spr(3, 177, [
    '.oooooooooo.',
    'obbBbbBbbBbo',
    'oBbbBbbBbbBo',
    'obbBbbBbbBbo',
    '.oBbbBbbBbo.',
    '.obbBbbBbbo.',
    '..oooooooo..',
  ], { o: P.umber, b: P.wood, B: P.brown });

  // --- floor cushions (poufs) ---
  s += spr(2, 222, [
    '..oooooooooooooo..',
    '.oppppppppppppppo.',
    'opppwpppppppppppPo',
    'oppppppppppppppPPo',
    'oPppppppppppppPPPo',
    'oPPPPPPPPPPPPPPPPo',
    'oPPPPPPPPPPPPPPPPo',
    '.oPPPPPPPPPPPPPPo.',
    '..oooooooooooooo..',
  ], { o: P.pink600, p: P.pink200, P: P.pink400, w: P.pink50 });
  // a stack of books and a basket of yarn by the pouf
  s += spr(4, 252, ['oooooooooooo', 'obbbbbbbbbbo', 'oooooooooooo', '.oooooooooo.', '.olllllllllo', '.oooooooooo.', 'oooooooooooo', 'oppppppppppo', 'oooooooooooo'],
    { o: P.lavender600, b: P.blue300, l: P.butter200, p: P.pink300 });
  s += spr(210, 270, ['..r.b.v.....', '.rrrbbbvv...', 'oooooooooooo', 'onBnBnBnBnBo', 'oBnBnBnBnBno', '.oBnBnBnBno.', '..oooooooo..'],
    { r: P.pink300, b: P.blue300, v: P.lavender300, o: P.umber, B: P.wood, n: P.tan });
  // a hanging plant from the ceiling, over the lamp
  s += R(62, 8, 1, 30, P.wood) + R(58, 38, 9, 1, P.wood) + R(58, 38, 1, 6, P.wood) + R(66, 38, 1, 6, P.wood);
  s += spr(55, 36, [
    '..g..g..m....',
    '.gGg.gGgGg...',
    'gGmGgGgmGgg..',
    '.ooooooooooo.',
    '.owwwwwwwwwo.',
    '..opppppppo..',
    '..oPPPPPPPo..',
    '...ooooooo...',
    'g.G......g.G.',
    'G.g.....gG..g',
    'g..G....G...G',
    '.G.g...g....g',
    '.g..G..G...G.',
    '..G.g.......g',
    '..g...........',
    '...G..........',
  ], { ...LEAF, o: P.lavender600, w: P.cream, p: P.lavender200, P: P.lavender300 });

  // --- cushion bed, front left ---
  s += blob(32, 288, 26, 9, P.lavender500) + blob(32, 287, 25, 8, P.lavender300) + blob(32, 289, 19, 5, P.lavender100) + blob(32, 290, 17, 3, P.lavender50);
  s += R(10, 283, 4, 1, P.lavender200) + R(50, 283, 4, 1, P.lavender200);
  // a ball of yarn and a toy mouse on the floor
  s += blob(178, 292, 4, 4, P.blue500) + blob(178, 291, 4, 3, P.blue300) + R(175, 290, 6, 1, P.blue100) + R(177, 288, 1, 7, P.blue500) + R(182, 294, 8, 1, P.blue300) + R(189, 295, 4, 1, P.blue300);
  s += spr(150, 300, ['..oo.....', '.oggo....', 'oggrgoooo', '.ooooo...'], { o: o, g: P.grey300, r: P.pink300 });
  // food and water bowls, front right
  s += spr(194, 308, ['.oooooooooo.', 'okkkkkkkkkko', 'opppppppppo.', '.oooooooooo.'].map((r) => r.padEnd(12, '.')), { o: o, k: P.wood, p: P.pink300 });
  s += spr(210, 308, ['.oooooooooo.', 'oiiiiiiiiiio', 'obbbbbbbbbbo', '.oooooooooo.'], { o: o, i: P.blue100, b: P.blue300 });
  s += spr(196, 305, ['..n.n.n...', '.n.n.n.n..'], { n: P.brown });

  // a few tulips on the side table, and one on the sill
  s += tulips(167, 134);
  return s;
}

// A warm pool of light from the floor lamp and the window at night.
function roomGlow(phase: Phase): string {
  if (phase === 'day') {   // a sunbeam from the window falls across the floor
    let s = '';
    for (let y = 172; y < 236; y++) for (let x = 104 + (y - 172) / 2; x < 152 + (y - 172) / 2; x++) {
      const xi = Math.round(x);
      if (Math.abs(xi - 128 - (y - 172) / 2) < 2) continue;   // the window bar's shadow
      if ((xi + y) % 2 === 0) s += R(xi, y, 1, 1, P.white);
    }
    return '<g opacity=".28">' + s + '</g>';
  }
  const g = phase === 'night' ? P.butter200 : P.butter50;
  let s = '';
  // the lamp shade lights up
  s += R(51, 84, 10, 6, g) + R(50, 86, 12, 3, phase === 'night' ? P.butter50 : P.white);
  if (phase === 'night') {   // a soft cone of light under the lamp, and a pool of it on the floor
    let cone = '';
    for (let y = 91; y < 168; y++) { const h = Math.round(5 + (y - 91) / 3.2); cone += R(56 - h, y, 2 * h + 1, 1, P.butter200); }
    s += `<g opacity=".16">${cone}${blob(56, 172, 34, 6, P.butter200)}</g>`;
  }
  // fairy lights along the garland
  for (let x = 174; x < 236; x += 7) s += R(x, 12 + Math.round(Math.sin((x - 172) / 7 / 1.6) * 1.5), 1, 1, phase === 'night' ? P.sun300 : P.butter200);
  return s;
}

export function roomSvg(phase: Phase, cls = 'bg'): string {
  let props = '';
  for (const [[x, y], art] of [[SHELF_BOOK, BOOK_ART], [SHELF_TROPHY, TROPHY_ART]] as const) props += spr(x, y, art, PAL);
  const mine = custom.room;
  if (mine) return svg(customLayer(mine) + props + WASH[phase], cls);
  return svg(roomBase() + windowSky(phase) + archTop() + windowFrame() + props + WASH[phase] + windowLights(phase) + roomGlow(phase), cls);
}

// A scene of your own: its picture, or its letters as rectangles where there is no picture (tests, and before it is made).
const customLayer = (c: CustomScene) => (c.href
  ? `<image href="${c.href}" x="0" y="0" width="${ROOM_W}" height="${ROOM_H}" preserveAspectRatio="none" style="image-rendering: pixelated"/>`
  : spr(0, 0, c.art, c.colors));

// The official scene as a grid of colours (in the daytime, without the diary book and the trophy, which are drawn on top of
// any room): what Kitty Gallery starts from when you change it.
const grids: Partial<Record<SceneId, string[][]>> = {};
export function officialSceneGrid(id: SceneId): string[][] {
  const done = grids[id];
  if (done) return done;
  const g = Array.from({ length: ROOM_H }, () => Array<string>(ROOM_W).fill(''));
  const src = id === 'room' ? roomBase() + windowSky('day') + archTop() + windowFrame() : gardenSky('day') + gardenBase();
  for (const m of src.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9a-f]{6})"\/>/g)) {
    const [x, y, w, h] = m.slice(1, 5).map(Number);
    for (let j = Math.max(0, y); j < Math.min(ROOM_H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(ROOM_W, x + w); i++) g[j][i] = m[5];
  }
  grids[id] = g;
  return g;
}

// The window's glazing bars, drawn over the sky.
function windowFrame(): string {
  const f = P.cream, o = P.lavender600;
  return (R(119, 24, 2, 78, f) + R(94, 60, 52, 2, f) + R(118, 24, 1, 78, o) + R(121, 24, 1, 78, o) + R(94, 59, 52, 1, o) + R(94, 62, 52, 1, o)
    + R(94, 101, 52, 1, o));
}

// ===================================================================================================
// the garden
// ===================================================================================================
function gardenSky(phase: Phase): string {
  let s = sky(phase, 0, 0, 240, 66);
  if (phase === 'day') s += sun(196, 18, P.sun300, P.butter200) + cloud(110, 14, 30, P.white, P.blue50) + cloud(150, 34, 22, P.white, P.blue50) + cloud(214, 40, 18, P.white, P.blue50);
  else if (phase === 'dusk') s += sun(206, 50, P.orange, P.sun300) + cloud(120, 18, 30, P.pink50, P.pink100) + cloud(170, 30, 20, P.pink50, P.pink100);
  return s;
}

function gardenBase(): string {
  const o = P.lavender600;
  let s = '';
  // --- far hedges and trees behind the fence ---
  s += R(0, 64, 240, 14, P.mint400);   // a far meadow, seen through the gate
  s += blob(120, 66, 40, 12, P.pine) + blob(170, 62, 30, 12, P.green700) + blob(220, 60, 34, 14, P.pine) + blob(96, 64, 24, 10, P.green700);
  s += blob(120, 62, 36, 8, P.green700) + blob(220, 56, 28, 9, P.green700) + blob(170, 58, 24, 8, P.mint400);
  for (let x = 70; x < 240; x += 5) s += R(x, 54 + Math.floor(rnd(x, 1) * 8), 2, 1, P.mint400);
  // a little cottage roof peeking out on the right
  s += spr(206, 28, [
    '.......oo.......',
    '......orro......',
    '.....orrrro.....',
    '....orrRrrro....',
    '...orrrrRrrro...',
    '..orrRrrrrrRro..',
    '.oooooooooooooo.',
    '..owwwwwwwwwwo..',
    '..owbbwwwwbbwo..',
    '..owbbwwwwbbwo..',
    '..owwwwwwwwwwo..',
  ].map((r) => r.padEnd(34, '.')), { o: o, r: P.pink400, R: P.pink300, w: P.cream, b: P.blue300 });

  // --- grass, with tufts, flecks and a soft shadow under the tree ---
  s += R(0, 76, 240, 244, P.green100);
  for (let y = 80; y < 320; y += 3) for (let x = 0; x < 240; x += 3) {
    const v = rnd(x, y, 5);
    if (v < 0.08) s += R(x, y, 1, 2, P.mint400) + R(x + 2, y + 1, 1, 1, P.mint400);
    else if (v < 0.11) s += R(x, y, 1, 1, P.mint200);
    else if (v < 0.115) s += R(x, y, 1, 1, P.cream);
  }
  s += blob(40, 130, 44, 8, P.mint200);

  // --- white picket fence with an opening for the path ---
  const fence = P.cream, fenceD = P.lavender100;
  for (const [x0, x1] of [[0, 170], [200, 240]]) {
    s += R(x0, 72, x1 - x0, 3, fence) + R(x0, 75, x1 - x0, 1, o) + R(x0, 71, x1 - x0, 1, o) + R(x0, 84, x1 - x0, 3, fence) + R(x0, 87, x1 - x0, 1, o) + R(x0, 83, x1 - x0, 1, o);
    for (let x = x0 + 1; x + 6 <= x1; x += 9) {
      s += R(x + 1, 62, 4, 1, o) + R(x, 63, 1, 30, o) + R(x + 5, 63, 1, 30, o) + R(x + 2, 61, 2, 1, o) + R(x + 1, 63, 4, 30, fence) + R(x + 4, 64, 1, 28, fenceD) + R(x, 93, 6, 1, o);
    }
  }
  // gate posts and an open gate
  s += box(168, 56, 6, 38, P.cream, o) + box(198, 56, 6, 38, P.cream, o) + R(167, 55, 8, 2, o) + R(197, 55, 8, 2, o);
  s += spr(200, 64, ['o', 'o', 'o'], { o: o });

  // --- hydrangea bushes along the right fence, sunflowers along the middle ---
  s += blob(222, 92, 22, 12, P.green700) + blob(222, 89, 20, 10, P.green500);
  for (const [hx, hy] of [[204, 80], [216, 76], [228, 82], [210, 90], [224, 92], [234, 74]]) s += hydrangea(hx, hy);
  for (const [fx, top] of [[112, 46], [124, 54], [136, 44], [150, 52]]) {
    s += R(fx + 4, top + 8, 1, 94 - top - 8, P.green700) + R(fx + 5, top + 20, 3, 2, P.green500) + R(fx + 1, top + 28, 3, 2, P.green500);
    s += spr(fx, top, ['...yyy...', '.yyYYYyy.', 'yyYbbbYyy', 'yYbBbbbYy', 'yYbbBbbYy', 'yyYbbbYyy', '.yyYYYyy.', '...yyy...'], { y: P.sun300, Y: P.gold500, b: P.brown, B: P.umber });
  }
  s += blob(140, 96, 34, 5, P.green500);
  // a signpost by the gate
  s += R(178, 78, 2, 22, P.brown) + spr(156, 64, ['oooooooooooooo.', 'onnnnnnnnnnnnno', 'onNNnNNnNNNnno.', 'oooooooooooooo.'], { o: o, n: P.tan, N: P.wood });

  // --- the cherry tree, left: big pink canopy over a dark trunk ---
  const pk = P.pink200, pkL = P.pink100, pkD = P.pink400, pkDD = P.pink600;
  s += spr(18, 74, [
    '......BbbbbbbB......',
    '......BbbBbbbB......',
    '......BbbbbBbB......',
    '......BbBbbbbB......',
    '.....BbbbbBbbbB.....',
    '.....BbbBbbbbbB.....',
    '.....BbbbbbBbbB.....',
    '.....BbBbbbbbbB.....',
    '.....BbbbBbbbbB.....',
    '.....BbbbbbbBbB.....',
    '.....BbBbbbbbbB.....',
    '.....BbbbbBbbbB.....',
    '.....BbbbbbbbBB.....',
    '.....BbBbbbbbbB.....',
    '.....BbbbBbbbbB.....',
    '....BbbbbbbBbbbB....',
    '....BbbBbbbbbbbB....',
    '....BbbbbbBbbbbB....',
    '...BbbbbBbbbbBbbB...',
    '...BbBbbbbbbbbbbB...',
    '..BbbbbbbBbbbbbbbB..',
    '..BbbbBbbbbbBbbbbB..',
    '.BBbbBBbbbbBBbbbBBB.',
    'BB.BBB.BBbbBB.BBB.BB',
    'B...B...BBBB...B...B',
  ].flatMap((r, i) => (i < 15 ? [r, r, r] : [r])), { b: P.brown, B: P.umber });
  s += R(28, 78, 1, 44, P.umberDark) + R(31, 96, 3, 1, P.tan) + R(30, 112, 3, 1, P.tan);
  // branches reaching into the canopy
  s += R(14, 70, 14, 3, P.umber) + R(10, 66, 6, 4, P.umber) + R(34, 66, 18, 3, P.umber) + R(50, 60, 6, 6, P.umber);
  for (const [cx, cy, rx, ry, c] of [
    [36, 46, 46, 32, pkDD], [36, 43, 45, 31, pkD], [24, 34, 26, 20, pk], [54, 40, 26, 22, pk], [36, 54, 34, 16, pk], [14, 54, 16, 14, pkD],
    [72, 56, 14, 12, pkD], [30, 24, 18, 12, pkL], [52, 28, 14, 10, pkL], [12, 40, 12, 10, pk], [74, 44, 10, 10, pk],
  ] as [number, number, number, number, string][]) s += blob(cx, cy, rx, ry, c);
  // blossom clusters and dark gaps for depth
  for (let i = 0; i < 160; i++) {
    const a = rnd(i, 1, 8) * Math.PI * 2, d = Math.sqrt(rnd(1, i, 8)), x = Math.round(36 + Math.cos(a) * d * 44), y = Math.round(42 + Math.sin(a) * d * 30);
    const c = i % 5 === 0 ? pkDD : i % 3 === 0 ? P.pink50 : i % 2 ? pkL : pkD;
    s += R(x, y, 2, 1, c) + R(x, y + 1, 1, 1, c);
  }
  s += R(28, 60, 3, 2, P.umber) + R(48, 58, 3, 2, P.umber) + R(18, 48, 2, 2, P.umber) + R(62, 50, 2, 2, P.umber);
  // fallen petals on the grass
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rnd(i, 4, 1) * 110), y = 100 + Math.floor(rnd(4, i, 1) * 70);
    s += R(x, y, 1, 1, i % 2 ? P.pink200 : P.pink100);
  }

  // --- a wooden bench under the tree ---
  const wd = P.wood, wdD = P.brown, wdL = P.tan;
  s += R(62, 112, 40, 3, wd) + R(62, 112, 40, 1, wdL) + R(62, 115, 40, 1, o) + R(62, 117, 40, 3, wd) + R(62, 117, 40, 1, wdL) + R(62, 120, 40, 1, o);
  s += R(64, 121, 2, 6, wdD) + R(98, 121, 2, 6, wdD);
  s += box(60, 126, 44, 6, wd, o) + R(61, 127, 42, 1, wdL) + R(61, 130, 42, 1, wdD);
  s += R(62, 132, 3, 10, wdD) + R(99, 132, 3, 10, wdD) + R(62, 141, 3, 1, o) + R(99, 141, 3, 1, o);
  // a book and a teacup on the bench
  s += spr(88, 121, ['oooooo.', 'obbbbo.', 'oooooo.'], { o: o, b: P.lavender300 }) + spr(80, 122, ['ooo.', 'owoo', 'ooo.'], { o: o, w: P.cream });

  // --- the path: rosy paving stones from the gate down to the pond ---
  const pathX = (y: number) => Math.round(186 - Math.max(0, y - 120) * 0.32 + Math.sin(y / 30) * 4);
  for (let y = 88; y < 272; y += 6) {
    const cx = pathX(y), w = 30 + Math.round((y - 88) / 24);
    for (let x = cx - w / 2, k = 0; x < cx + w / 2 - 2; k++) {
      const sw = 6 + Math.floor(rnd(k, y, 6) * 5), ww = Math.min(sw, Math.round(cx + w / 2 - x));
      if (ww < 3) break;
      s += R(x, y, ww - 1, 5, P.lavender100) + R(x, y, ww - 1, 1, P.lavender50) + R(x, y + 4, ww - 1, 1, P.lavender200);
      if (rnd(k, y, 7) < 0.3) s += R(x + 2, y + 2, 1, 1, P.pink100);
      x += ww;
    }
  }

  // --- picnic blanket with a basket, plates and a jar of flowers ---
  const bx = 8, by = 168, bw = 64, bh = 38;
  s += R(bx, by, bw, bh, P.white);
  for (let y = 0; y < bh; y += 4) for (let x = 0; x < bw; x += 4) {
    const a = (x / 4) % 2, b = (y / 4) % 2;
    s += R(bx + x, by + y, 4, 4, a && b ? P.pink300 : a || b ? P.pink100 : P.white);
  }
  s += R(bx, by + bh, bw, 1, P.pink500) + R(bx, by, bw, 1, P.pink500) + R(bx, by, 1, bh, P.pink500) + R(bx + bw - 1, by, 1, bh, P.pink500);
  for (let x = bx; x < bx + bw; x += 2) s += R(x, by + bh + 1, 1, 2, P.pink300);
  s += spr(12, 160, [
    '....oooooooo....',
    '...o........o...',
    '..o..........o..',
    'oooooooooooooooo',
    'obBbBbBbBbBbBbBo',
    'oBbBbBbBbBbBbBbo',
    'orrrrrrrrrrrrrro',
    'obBbBbBbBbBbBbBo',
    'oBbBbBbBbBbBbBbo',
    '.oooooooooooooo.',
  ], { o: P.umber, b: P.wood, B: P.tan, r: P.pink300 });
  s += blob(44, 186, 7, 3, o) + blob(44, 186, 6, 2, P.white) + blob(44, 186, 3, 1, P.lavender50) + R(54, 183, 1, 6, P.grey400) + R(57, 183, 1, 6, P.grey400);
  s += spr(60, 172, ['.y.w.', 'yGwGw', '.G.G.', 'ooooo', 'obbbo', 'obbbo', 'ooooo'], { y: P.sun300, w: P.white, G: P.green500, o: o, b: P.blue100 });
  s += spr(30, 194, ['.oooo.', 'oyyyyo', 'oyyyyo', '.oooo.'], { o: o, y: P.butter200 });

  // --- cardboard box shelter, right ---
  s += box(196, 182, 40, 26, P.tan, o) + R(197, 183, 38, 2, P.butter50) + R(197, 205, 38, 2, P.wood) + R(215, 183, 2, 22, P.butter200);
  s += arch(204, 190, 20, 18, P.plum700) + R(206, 207, 16, 1, o);
  s += spr(226, 188, ['oooo', 'orro', 'oooo'], { o: o, r: P.pink300 });
  // the food bowl
  s += spr(146, 236, ['..nnnnnnnn....', '.oooooooooooo.', 'orrrrrrrrrrrro', 'orrRrrrrrrrrro', '.oooooooooooo.'], { n: P.brown, o: o, r: P.pink300, R: P.pink50 });

  // --- a flower bed along the fence ---
  s += R(76, 96, 92, 6, P.brown) + R(76, 96, 92, 1, P.umber) + R(76, 101, 92, 1, P.umber);
  for (let x = 78, i = 0; x < 166; x += 5, i++) {
    const c = [P.pink300, P.white, P.lavender300, P.pink200, P.butter200][i % 5];
    s += R(x + 1, 93, 1, 4, P.green700) + R(x, 92, 3, 2, c) + R(x + 1, 91, 1, 1, c) + R(x + 1, 92, 1, 1, i % 2 ? P.sun300 : P.pink500) + R(x + 3, 95, 2, 1, P.green500);
  }
  // a watering can by the bed
  s += spr(160, 100, ['......o.', '.oooo.o.', 'obbbbbo.', 'oBbbbbo..', 'obbbbbo...', '.ooooo....'].map((r) => r.slice(0, 8)), { o: P.lavender600, b: P.blue300, B: P.blue100 });
  // mushrooms at the foot of the tree
  s += spr(6, 120, ['.rrr.', 'rwrrr', '.oo..', '.ww..'].map((r) => r.replace(/o/g, 'w')), { r: P.pink500, w: P.cream });
  s += spr(46, 124, ['.rrr.', 'rrwrr', '..w..', '..w..'], { r: P.red, w: P.cream });
  // a bird house on the trunk
  s += spr(40, 84, ['...oo...', '..orro..', '.orrrro.', 'oooooooo', '.owwwwo.', '.owwowo.', '.owwwwo.', '.oooooo.'], { o: P.lavender600, r: P.blue300, w: P.cream });
  // bushes along the pond
  for (const [bx2, by2, r] of [[14, 262, 12], [36, 266, 9], [224, 258, 14], [204, 266, 8]] as [number, number, number][]) {
    s += blob(bx2, by2, r, Math.round(r * 0.6), P.green700) + blob(bx2 - 1, by2 - 2, r - 2, Math.round(r * 0.5), P.green500) + R(bx2 - 3, by2 - 4, 3, 1, P.mint400);
    for (let k = 0; k < r / 2; k++) s += R(bx2 - r + 3 + Math.floor(rnd(k, bx2) * (2 * r - 6)), by2 - 3 + Math.floor(rnd(bx2, k) * 5), 2, 2, k % 2 ? P.pink300 : P.white);
  }

  // --- flowers scattered in the grass ---
  const cols = [[P.pink300, P.butter200], [P.white, P.sun300], [P.lavender300, P.cream], [P.butter200, P.orange], [P.blue300, P.white]];
  for (let i = 0; i < 46; i++) {
    const x = 4 + Math.floor(rnd(i, 9, 2) * 232), y = 100 + Math.floor(rnd(9, i, 2) * 160);
    if (x > 6 && x < 76 && y > 158 && y < 210) continue;   // not on the blanket
    if (x > 190 && y > 172 && y < 212) continue;            // not on the box
    if (Math.abs(x - pathX(y)) < 22) continue;                 // not on the path
    const [p, m] = cols[i % cols.length];
    s += flower(x, y, p, m);
  }
  // lavender spikes
  for (const [lx, ly] of [[86, 160], [90, 158], [94, 161], [6, 232], [10, 230], [14, 233]]) s += R(lx, ly, 1, 8, P.green700) + R(lx, ly - 4, 1, 4, P.lavender500) + R(lx - 1, ly - 3, 1, 2, P.lavender300) + R(lx + 1, ly - 2, 1, 2, P.lavender300);

  // --- the pond along the bottom, with lily pads and a wooden jetty ---
  const shore = (x: number) => 270 + Math.round(Math.sin(x / 18) * 3 + Math.sin(x / 7) * 1);
  for (let x = 0; x < 240; x++) {
    const t = shore(x);
    s += R(x, t - 2, 1, 2, P.mint400) + R(x, t, 1, 2, P.tan) + R(x, t + 2, 1, 320 - t - 2, P.blue300);
  }
  for (let y = 280; y < 320; y += 5) for (let x = (y % 10) * 2; x < 240; x += 22) {
    const xx = x + Math.floor(rnd(x, y, 3) * 10);
    s += R(xx, y, 6, 1, P.blue100) + R(xx + 2, y + 1, 3, 1, P.blue500);
  }
  s += R(0, 300, 240, 20, P.blue300);
  for (let y = 302; y < 320; y += 4) for (let x = (y % 8) * 3; x < 240; x += 26) s += R(x + Math.floor(rnd(x, y, 1) * 10), y, 5, 1, P.blue100);
  s += R(0, 314, 240, 6, P.blue500);
  for (let x = 0; x < 240; x += 2) s += R(x + ((x / 2) % 2), 313, 1, 1, P.blue500);
  for (const [lx, ly, fl] of [[24, 288, true], [52, 298, false], [92, 286, false], [196, 290, true], [222, 304, false]] as [number, number, boolean][]) {
    s += blob(lx, ly, 6, 2, P.green500) + R(lx, ly - 2, 1, 3, P.blue300) + R(lx - 4, ly - 1, 8, 1, P.mint400);
    if (fl) s += R(lx - 1, ly - 3, 3, 2, P.pink200) + R(lx, ly - 4, 1, 1, P.pink100);
  }
  // reeds
  for (const rx of [4, 8, 232, 236]) s += R(rx, 260, 1, 14, P.green700) + R(rx, 256, 2, 5, P.brown);
  // the jetty
  const jx = pathX(266) - 15;
  s += R(jx, 266, 30, 34, P.wood);
  for (let y = 266; y < 300; y += 4) s += R(jx, y, 30, 1, P.brown) + R(jx, y + 1, 30, 1, P.tan);
  s += R(jx - 1, 266, 1, 34, o) + R(jx + 30, 266, 1, 34, o) + R(jx - 1, 300, 32, 1, o);
  s += R(jx - 2, 296, 3, 12, P.brown) + R(jx + 29, 296, 3, 12, P.brown) + R(jx - 2, 307, 3, 1, P.blue500) + R(jx + 29, 307, 3, 1, P.blue500);
  return s;
}

function gardenGlow(phase: Phase): string {
  if (phase !== 'night') return '';
  let s = moonAt(196, 16) + stars(90, 2, 100, 40, 18, 3) + stars(186, 30, 16, 14, 2, 4);
  for (const [x, y] of [[96, 100], [150, 120], [30, 150], [120, 230], [210, 140], [60, 250], [180, 200], [12, 110]]) s += R(x, y, 2, 2, P.butter200) + R(x - 1, y, 1, 1, P.butter50);
  // the cottage windows are lit
  s += R(210, 36, 2, 2, P.sun300) + R(216, 36, 2, 2, P.sun300);
  return s;
}

export function outdoorSvg(phase: Phase, cls = 'bg'): string {
  const mine = custom.garden;
  if (mine) return svg(customLayer(mine) + WASH[phase], cls);
  return svg(gardenSky(phase) + gardenBase() + WASH[phase] + gardenGlow(phase), cls);
}
