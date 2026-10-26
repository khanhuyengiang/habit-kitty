// Every picture in the app is drawn on ONE pixel grid: one art pixel is one --px in the page CSS (3px, or 2px on very
// narrow screens). Sprites, icons, food, the heart and the room all come through here (or pixelcat.ts), and an
// svg's size is always its column count times --px, so no picture is ever scaled to a different pixel size.
// Pure functions that return SVG strings.

// Pastel palette shared by all the multi-colour art. Letters are used in the art rows below.
export const PAL: Record<string, string> = {
  o: '#5a4380', O: '#3d2c63',                       // plum outlines
  r: '#ff8fb8', R: '#ffc4da', m: '#e8708f', M: '#ffb3c6', p: '#ffb3c6',   // pinks
  u: '#8fd0fa', U: '#c9e9fd', g: '#7fc4ea', s: '#d6ecfb',                  // baby blues
  v: '#b9a3f0', V: '#dcd0fa', d: '#8f78d0',                                // lavenders
  w: '#fffafc', y: '#ffd36e', Y: '#fff0b0', e: '#ffa36b',                  // cream, sun, orange
  b: '#c99a73', B: '#a07250', c: '#f1cfa0', C: '#f9e6c4', n: '#9be0cf',    // browns, tan, mint
};

const rect = (x: number, y: number, fill: string) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;

// A picture from rows of palette letters. Sized by CSS: width = cols * --px, height = rows * --px.
export function artSvg(art: string[], cls = '', pal: Record<string, string> = PAL): string {
  const cells = art.flatMap((row, y) => [...row].map((ch, x) => (pal[ch] ? rect(x, y, pal[ch]) : '')));
  return `<svg class="pxs ${cls}" style="--w:${art[0].length};--h:${art.length}" viewBox="0 0 ${art[0].length} ${art.length}" aria-hidden="true" shape-rendering="crispEdges">${cells.join('')}</svg>`;
}

// One-colour icons take the text colour (fill: currentColor), so they follow buttons, hover and dark mode.
const run = (art: string[]) => art.map((row, y) => {
  let d = '';
  for (let x = 0; x < row.length; x++) {
    if (row[x] !== 'o') continue;
    let n = 1;
    while (row[x + n] === 'o') n++;
    d += `M${x} ${y}h${n}v1h-${n}z`;
    x += n - 1;
  }
  return d;
}).join('');

export const ICONS: Record<string, string[]> = {
  x: ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o'],
  tick: ['....o', '...oo', 'o.oo.', '.ooo.', '..o..'],
  check: ['........o', '.......oo', 'o.....oo.', 'oo...oo..', '.oo.oo...', '..ooo....', '...o.....'],
  home: ['....o....', '...ooo...', '..ooooo..', '.ooooooo.', '..ooooo..', '..oo.oo..', '..oo.oo..'],
  pencil: ['.....oo', '....o.o', '...o.o.', '..o.o..', '.o.o...', 'ooo....', 'o......'],
  rewind: ['...o...o.', '..oo..oo.', '.ooo.ooo.', 'oooooooo.', '.ooo.ooo.', '..oo..oo.', '...o...o.'],
  dice: ['ooooooooo', 'o.......o', 'o.o...o.o', 'o.......o', 'o...o...o', 'o.......o', 'o.o...o.o', 'o.......o', 'ooooooooo'],
  prev: ['..o', '.o.', 'o..', '.o.', '..o'],
  next: ['o..', '.o.', '..o', '.o.', 'o..'],
  gear: ['....o....', '.o.ooo.o.', '..ooooo..', '.ooo.ooo.', 'ooo...ooo', '.ooo.ooo.', '..ooooo..', '.o.ooo.o.', '....o....'],
  sun: ['....o....', '.o..o..o.', '..ooooo..', '..ooooo.o', 'ooooooooo', 'o.ooooo..', '..ooooo..', '.o..o..o.', '....o....'],
  moon: ['...ooo...', '..oo.....', '.oo......', '.oo......', '.oo......', '.oo...o..', '..oo..o..', '...oooo..', '.........'],
  clock: ['..ooooo..', '.o.....o.', 'o...o...o', 'o...o...o', 'o...ooo.o', 'o.......o', 'o.......o', '.o.....o.', '..ooooo..'],
  // tab bar
  room: ['.....o.....', '....ooo....', '...ooooo...', '..ooooooo..', '.ooooooooo.', 'ooooooooooo', '.ooooooooo.', '.ooo...ooo.', '.ooo...ooo.', '.ooo...ooo.'],
  treats: ['...ooo.....', '.ooooooo..o', 'oo.oooooooo', 'ooooooooooo', '.ooooooo..o', '...ooo.....'],
  // a calendar with two rings, a header band and a 4 x 3 grid of days
  heat: ['..oo...oo..', '..oo...oo..', 'ooooooooooo', 'ooooooooooo', 'o.........o', 'o.o.o.o.o.o', 'o.........o', 'o.o.o.o.o.o', 'o.........o', 'ooooooooooo'],
  // a closed book: two title lines on the cover, the page edge and a bookmark
  diary: ['ooooooooo', 'ooooooooo', 'oo.....oo', 'ooooooooo', 'oo.....oo', 'ooooooooo', 'ooooooooo', 'ooooooooo', 'o........', 'ooooooooo', '.oo......'],
};

export function iconSvg(name: string, cls = ''): string {
  const art = ICONS[name];
  const w = Math.max(...art.map((r) => r.length));
  return `<svg class="pxs ico ${cls}" style="--w:${w};--h:${art.length}" viewBox="0 0 ${w} ${art.length}" aria-hidden="true" shape-rendering="crispEdges"><path d="${run(art)}"/></svg>`;
}

// ---- the petting heart ----
const HEART_ART = ['.oo..oo.', 'orroorro', 'orwrrrro', 'orrrrrro', '.orrrro.', '..orro..', '...oo...'];
export const heartSvg = () => artSvg(HEART_ART, 'heart-art', { o: '#a8456f', r: '#ff7fae', w: '#ffe1ec' });

// ---- the little symbol at the end of a thought bubble ----
export const MARKS: Record<string, string[]> = {
  dots: ['o.o.o'],
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  'heart-outline': ['.oo.oo.', 'o..o..o', 'o.....o', '.o...o.', '..o.o..', '...o...'],
  question: ['.ooo.', 'o...o', '....o', '..oo.', '..o..', '.....', '..o..'],
};
export const markSvg = (name: string) => artSvg(MARKS[name], 'mark');

// ---- food, the diary book and the trophy ----
export const FOODS: Record<string, string[]> = {
  kibbles: ['..........', '...b..b...', '..bBbbBb..', '.bbBbbbBb.', 'oooooooooo', 'ouuuuuuuuo', '.ouuuuuuo.', '..oooooo..'],
  'wet food': ['..........', '.oooooooo.', '.owwwwwwo.', '.orrrrrro.', '.orwppwro.', '.orrrrrro.', '.oooooooo.', '..........'],
  fish: ['..........', '....oooo.o', '..ooggggoo', '.oggoggggo', 'oggggggggo', '.ogsssggoo', '..oogggoo.', '....oooo.o'],
  chicken: ['..oooo....', '.occCco...', '.oCccCco..', '.occCcco..', '..ooccoo..', '....oowo..', '.....owwo.', '......oo..'],
  shrimp: ['...oooo...', '..oeeeeo..', '.oeeoeeeo.', '.oeeo.oeo.', '..oo.oeeo.', '....oeeeo.', '...oeeeo..', '..oeeoo...'],
  meat: ['..........', '..oooooo..', '.ommmmmmo.', 'omMMmmmwmo', 'ommmMmmmmo', '.ommmmmmo.', '..oooooo..', '..........'],
};
export const BOOK_ART = ['.ooooooo.', 'orrrrrrro', 'orrwwwrro', 'orrrrrrro', 'orrwwwrro', 'orrrrrrro', 'orrrrrrro', 'owwwwwwwo', '.ooooooo.'];
export const TROPHY_ART = ['ooooooooo', 'oyyyyyyyo', 'oyywwyyyo', 'oyyyyyyyo', '.oyyyyyo.', '..oyyyo..', '...oyo...', '..ooooo..', '.oyyyyyo.', 'ooooooooo'];

// ===================== the cosy room =====================
// 108 x 150 pixels. Cats are 28 pixels wide, so a cat is exactly as pixelated as the furniture around it.
export const ROOM_W = 108, ROOM_H = 150;
export type Phase = 'day' | 'dusk' | 'night';

const SKY: Record<Phase, { sky: string; cloud: string; wall: string; wall2: string; trim: string; floor: string; floor2: string; ink: string; glow: string }> = {
  day:   { sky: '#bfe6fb', cloud: '#ffffff', wall: '#ffe3ef', wall2: '#ffd2e5', trim: '#e9d9fb', floor: '#d9ccf5', floor2: '#cbbbee', ink: '#6b4f9e', glow: '' },
  dusk:  { sky: '#ffc9a8', cloud: '#ffe6ef', wall: '#f6d3e2', wall2: '#eec3d8', trim: '#d9c6ec', floor: '#c9b9e6', floor2: '#bba9dc', ink: '#6b4f9e', glow: '' },
  night: { sky: '#2c2a5a', cloud: '#4a4784', wall: '#cdb9dd', wall2: '#c0aad2', trim: '#aa97c6', floor: '#a898cc', floor2: '#9a89c0', ink: '#4d3a78', glow: '#ffe9a0' },
};

// One filled pixel rectangle.
const R = (x: number, y: number, w: number, h: number, f: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;

// A stepped ellipse out of whole pixels (rugs, clouds), so there is no smooth curve anywhere.
function blob(cx: number, cy: number, rx: number, ry: number, fill: string): string {
  let out = '';
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / ((ry + 0.5) * (ry + 0.5))));
    out += R(cx - half, cy + y, half * 2, 1, fill);
  }
  return out;
}

// A box with notched corners and a one-pixel outline.
function pbox(x: number, y: number, w: number, h: number, fill: string, edge: string): string {
  return R(x + 1, y, w - 2, 1, edge) + R(x + 1, y + h - 1, w - 2, 1, edge) + R(x, y + 1, 1, h - 2, edge) + R(x + w - 1, y + 1, 1, h - 2, edge)
    + R(x + 1, y + 1, w - 2, h - 2, fill);
}

const OUT: Record<Phase, { sky: string; cloud: string; hill: string; hill2: string; grass: string; grass2: string; path: string; path2: string; fence: string; fence2: string; leaf: string; leaf2: string; trunk: string; ink: string }> = {
  day:   { sky: '#bfe6fb', cloud: '#ffffff', hill: '#b6e8c8', hill2: '#a2dcb9', grass: '#c9f0d0', grass2: '#b6e6c0', path: '#eadff8', path2: '#d9c9f0', fence: '#fff1dc', fence2: '#ecd0a8', leaf: '#8fdcb4', leaf2: '#6cc79a', trunk: '#d9a982', ink: '#6b4f9e' },
  dusk:  { sky: '#ffc9a8', cloud: '#ffe6ef', hill: '#a8d4b4', hill2: '#96c4a6', grass: '#b8e0c0', grass2: '#a6d2b0', path: '#d9c9e8', path2: '#c8b6dc', fence: '#f2dcc6', fence2: '#d8b896', leaf: '#7cc8a2', leaf2: '#5eb08a', trunk: '#c29478', ink: '#6b4f9e' },
  night: { sky: '#2c2a5a', cloud: '#4a4784', hill: '#4f8a82', hill2: '#437a74', grass: '#6fa890', grass2: '#609a84', path: '#9a8cc0', path2: '#8a7cb2', fence: '#b6a2b0', fence2: '#9a8498', leaf: '#4f9a82', leaf2: '#3e8470', trunk: '#8a6a76', ink: '#4d3a78' },
};

// The outdoors: a garden with a fence, a tree, a path, a cardboard box and a bowl. Same size and pixel grid as the room.
export function outdoorSvg(phase: Phase, cls = 'bg'): string {
  const c = OUT[phase], night = phase === 'night', o = c.ink;
  const pink = night ? '#c58fb8' : '#ff9ec3', gold = night ? '#c9b46a' : '#ffd36e', lav = night ? '#8a76c4' : '#b9a3f0';
  let s = '';
  s += R(0, 0, 108, 150, c.sky);
  if (phase === 'day') {
    s += R(78, 12, 10, 10, '#ffd36e') + R(76, 14, 14, 6, '#ffd36e') + R(80, 10, 6, 14, '#ffd36e');
    s += blob(24, 22, 10, 3, c.cloud) + blob(30, 19, 6, 3, c.cloud) + blob(60, 40, 12, 3, c.cloud) + blob(66, 37, 6, 3, c.cloud);
  } else if (phase === 'dusk') {
    s += R(74, 54, 16, 10, '#ffd36e') + R(72, 56, 20, 6, '#ffd36e') + R(76, 52, 12, 14, '#ffd36e');
    s += blob(26, 24, 12, 3, c.cloud) + blob(32, 21, 6, 3, c.cloud) + blob(70, 36, 10, 2, c.cloud);
  } else {
    s += R(78, 12, 10, 10, '#f4f1e0') + R(83, 12, 5, 5, c.sky) + R(81, 15, 3, 3, '#f4f1e0');
    for (const [x, y] of [[10, 10], [24, 26], [44, 14], [58, 34], [96, 40], [36, 46], [70, 28], [14, 52], [100, 20]]) s += R(x, y, 1, 1, '#ffffff');
    s += R(52, 22, 1, 3, '#ffffff') + R(51, 23, 3, 1, '#ffffff');
  }
  // rolling hills
  s += blob(20, 74, 38, 14, c.hill) + blob(90, 70, 34, 12, c.hill2);
  // grass, with a tuft pattern
  s += R(0, 82, 108, 68, c.grass);
  for (let y = 90, i = 0; y < 150; y += 10, i++) for (let x = (i % 2) * 7 + 3; x < 108; x += 14) s += R(x, y, 1, 2, c.grass2) + R(x + 2, y + 1, 1, 2, c.grass2);
  // fence
  s += R(0, 70, 108, 3, c.fence2) + R(0, 78, 108, 3, c.fence2);
  for (let x = 1; x < 108; x += 9) s += R(x, 65, 6, 17, c.fence) + R(x + 1, 64, 4, 1, c.fence) + R(x + 2, 63, 2, 1, c.fence) + R(x + 5, 65, 1, 17, c.fence2) + R(x, 81, 6, 1, o);
  s += R(0, 82, 108, 1, o);
  // tree, left
  s += R(11, 40, 6, 46, c.trunk) + R(11, 40, 1, 46, o) + R(16, 40, 1, 46, o) + R(8, 84, 12, 2, c.trunk);
  s += blob(14, 30, 16, 12, c.leaf) + blob(8, 38, 9, 6, c.leaf2) + blob(22, 36, 8, 6, c.leaf2) + blob(14, 22, 8, 5, c.leaf);
  s += R(10, 26, 2, 2, pink) + R(20, 32, 2, 2, pink) + R(6, 36, 2, 2, pink);
  // path: stepped paving across the middle of the garden
  s += blob(54, 124, 50, 11, c.path) + blob(54, 124, 42, 8, c.path2) + blob(54, 124, 34, 5, c.path);
  for (let x = 24; x < 86; x += 12) s += R(x, 119, 1, 11, c.path2);
  // cardboard box (a shelter), right
  s += pbox(76, 94, 28, 20, night ? '#b89a86' : '#f0c9a0', o) + R(77, 95, 26, 3, night ? '#a48870' : '#e0b088') + R(84, 104, 12, 10, night ? '#4d3a60' : '#6b4f9e') + R(86, 102, 8, 2, night ? '#4d3a60' : '#6b4f9e');
  // food bowl
  s += R(46, 142, 14, 1, o) + pbox(45, 143, 16, 6, pink, o) + R(47, 142, 12, 1, night ? '#d9cfe6' : '#fffafc');
  // flowers
  for (const [x, y, col] of [[4, 100, pink], [30, 96, gold], [64, 104, lav], [100, 130, pink], [8, 140, gold], [92, 144, lav], [70, 92, pink], [30, 146, pink]] as [number, number, string][])
    s += R(x, y + 2, 1, 3, c.leaf2) + R(x - 1, y, 3, 1, col) + R(x, y - 1, 1, 3, col) + R(x, y, 1, 1, '#fffafc');
  if (night) for (const [x, y] of [[40, 66], [92, 58]]) s += R(x, y, 2, 2, '#ffe9a0');   // fireflies
  return `<svg class="${cls}" viewBox="0 0 ${ROOM_W} ${ROOM_H}" shape-rendering="crispEdges" aria-hidden="true">${s}</svg>`;
}

// The wall shelf holds the diary book and the trophy: [x, y, w, h] in room pixels, also used as their click areas.
export const SHELF_BOOK: [number, number, number, number] = [2, 40, 9, 9];
export const SHELF_TROPHY: [number, number, number, number] = [13, 39, 9, 10];

export function roomSvg(phase: Phase, cls = 'bg'): string {
  const c = SKY[phase];
  const night = phase === 'night';
  const o = c.ink;
  const pink = night ? '#c58fb8' : '#ff9ec3', lav = night ? '#8a76c4' : '#b9a3f0', lavD = night ? '#6c58a8' : '#8f78d0';
  const blue = night ? '#7ea4d6' : '#8fd0fa', cream = night ? '#d9cfe6' : '#fffafc', wood = night ? '#b69a9a' : '#e8c9a8', woodD = night ? '#9a7e86' : '#c9a07f';
  let s = '';
  // wall: stripes every 6 pixels, baseboard, floor boards
  s += R(0, 0, 108, 90, c.wall);
  for (let x = 0; x < 108; x += 12) s += R(x, 0, 6, 90, c.wall2);
  s += R(0, 0, 108, 4, c.trim) + R(0, 4, 108, 1, o);
  s += R(0, 90, 108, 6, c.trim) + R(0, 90, 108, 1, o) + R(0, 95, 108, 1, o);
  s += R(0, 96, 108, 54, c.floor);
  for (let y = 108; y < 150; y += 12) s += R(0, y, 108, 1, c.floor2);
  for (let y = 96, i = 0; y < 150; y += 12, i++) for (let x = (i % 2) * 18 + 6; x < 108; x += 36) s += R(x, y, 1, 12, c.floor2);

  // window, 40 x 40
  s += pbox(22, 12, 44, 44, c.trim, o);
  s += R(25, 15, 38, 38, c.sky);
  if (phase === 'day') {
    s += R(48, 18, 8, 8, '#ffd36e') + R(46, 20, 12, 4, '#ffd36e') + R(50, 16, 4, 12, '#ffd36e');
    s += R(28, 36, 12, 3, c.cloud) + R(31, 33, 8, 3, c.cloud) + R(46, 44, 14, 3, c.cloud) + R(49, 41, 8, 3, c.cloud);
  } else if (phase === 'dusk') {
    s += R(30, 38, 12, 8, '#ffd36e') + R(28, 40, 16, 4, '#ffd36e') + R(32, 36, 8, 12, '#ffd36e');
    s += R(46, 24, 14, 3, c.cloud) + R(49, 21, 8, 3, c.cloud);
  } else {
    s += R(48, 18, 8, 8, '#f4f1e0') + R(52, 18, 4, 4, c.sky) + R(50, 20, 2, 2, '#f4f1e0');
    for (const [x, y] of [[29, 20], [37, 30], [58, 36], [31, 44], [44, 26], [55, 47]]) s += R(x, y, 1, 1, '#ffffff');
    s += R(36, 20, 1, 3, '#ffffff') + R(35, 21, 3, 1, '#ffffff');
  }
  s += R(42, 15, 4, 38, c.trim) + R(25, 32, 38, 4, c.trim) + R(42, 15, 1, 38, o) + R(45, 15, 1, 38, o) + R(25, 32, 38, 1, o) + R(25, 35, 38, 1, o);
  s += R(19, 56, 50, 3, c.trim) + R(19, 59, 50, 1, o) + R(19, 56, 50, 1, o);

  // pennant garland over the window
  for (let i = 0, x = 6; x < 100; i++, x += 8) {
    const col = [pink, blue, lav][i % 3];
    s += R(x, 8 + (i % 2), 5, 1, col) + R(x + 1, 9 + (i % 2), 3, 1, col) + R(x + 2, 10 + (i % 2), 1, 1, col);
  }

  // framed heart picture
  s += pbox(76, 18, 22, 18, cream, o) + pbox(78, 20, 18, 14, c.wall2, o);
  const heart = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
  heart.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'r') s += R(80 + x, 22 + y, 1, 1, pink); }));

  // plant on the floor, left
  s += pbox(9, 80, 14, 14, night ? '#b07a8c' : '#e8946a', o) + R(10, 82, 12, 2, night ? '#c58fa0' : '#ffb98a');
  const leaf = night ? '#5fa88c' : '#7fd8b5', leafD = night ? '#4a8a74' : '#5cbf9a';
  for (const [x, y, w, h] of [[14, 56, 4, 24], [8, 62, 4, 14], [20, 60, 4, 16], [11, 68, 3, 12], [18, 70, 3, 10]]) s += R(x, y, w, h, leaf) + R(x, y, 1, h, leafD);

  // cat tree on the right
  s += R(88, 62, 8, 50, '#f1cfa0') + R(88, 62, 1, 50, '#d3a97a') + R(95, 62, 1, 50, '#d3a97a');
  for (let y = 68; y < 112; y += 6) s += R(88, y, 8, 1, '#d3a97a');
  s += pbox(76, 58, 30, 7, lav, o) + R(77, 64, 28, 1, lavD);
  s += pbox(70, 84, 30, 7, lav, o) + R(71, 90, 28, 1, lavD);
  s += pbox(78, 110, 28, 30, '#f9e6c4', o) + R(79, 110, 26, 4, lav) + R(79, 114, 26, 1, lavD);
  s += pbox(86, 120, 12, 20, night ? '#5d4a72' : '#8f78d0', o) + R(88, 118, 8, 2, night ? '#5d4a72' : '#8f78d0');
  s += R(80, 134, 4, 4, pink) + R(81, 133, 2, 1, pink);
  s += R(102, 66, 1, 10, pink) + R(101, 76, 3, 3, '#ffd36e');

  // rug (stepped ellipse) and cushion bed
  s += blob(43, 129, 33, 12, night ? '#c58fb8' : '#ffa6c8') + blob(43, 129, 25, 8, night ? '#d9a8c8' : '#ffc9de') + blob(43, 129, 15, 4, night ? '#c58fb8' : '#ffa6c8');
  s += pbox(2, 106, 36, 20, lav, o) + R(3, 107, 34, 4, night ? '#a898dc' : '#d6c8fa') + R(3, 121, 34, 4, lavD);
  s += R(6, 118, 2, 2, cream) + R(14, 121, 2, 2, cream) + R(26, 117, 2, 2, cream) + R(33, 121, 2, 2, cream);
  // a ball of yarn and a bone on the floor
  s += blob(70, 145, 4, 3, blue) + R(66, 145, 8, 1, night ? '#5f86b8' : '#6bbbea') + R(69, 143, 1, 5, night ? '#5f86b8' : '#6bbbea');
  s += R(18, 144, 12, 1, wood) + R(17, 143, 2, 3, wood) + R(29, 143, 2, 3, wood) + R(18, 146, 12, 1, woodD);

  // wall shelf, left: the diary book and the trophy
  s += R(0, 50, 22, 3, wood) + R(0, 50, 22, 1, o) + R(0, 53, 22, 1, o) + R(0, 52, 22, 1, woodD) + R(3, 54, 2, 3, woodD) + R(17, 54, 2, 3, woodD);
  for (const [[x, y], art] of [[SHELF_BOOK, BOOK_ART], [SHELF_TROPHY, TROPHY_ART]] as const)
    art.forEach((row, j) => [...row].forEach((ch, i) => { if (PAL[ch]) s += R(x + i, y + j, 1, 1, PAL[ch]); }));

  if (night) s += R(5, 30, 4, 4, c.glow) + R(3, 28, 8, 1, c.glow) + R(3, 35, 8, 1, c.glow);   // a night-light by the plant
  return `<svg class="${cls}" viewBox="0 0 ${ROOM_W} ${ROOM_H}" shape-rendering="crispEdges" aria-hidden="true">${s}</svg>`;
}
