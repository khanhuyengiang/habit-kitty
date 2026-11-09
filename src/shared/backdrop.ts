// The page background both apps share: a pixel gradient through the theme's three colours (--bg at the top, --bg2, --bg3 at the bottom). It is
// drawn on a canvas one page pixel per canvas pixel, and each pixel is one of the three colours: ordered (Bayer) dithering
// does the blending, so it stays pixel art. Redrawn when the theme or the size of the window changes.
// With the fancy background on (Settings → Look; <html data-fancy>), the grid lines give way to a dotted texture with
// sparkles, little clouds, hearts and flowers scattered over it, after the pictures in inspo/.
const BAYER = (() => {
  let m = [[0]];
  while (m.length < 8) {
    const n = m.length, next = Array.from({ length: n * 2 }, () => Array<number>(n * 2).fill(0));
    m.forEach((row, y) => row.forEach((v, x) => { next[y][x] = 4 * v; next[y][x + n] = 4 * v + 2; next[y + n][x] = 4 * v + 3; next[y + n][x + n] = 4 * v + 1; }));
    m = next;
  }
  return m;
})();
const BAND_EDGE = [0.28, 0.61], BAND_BLEND = 0.11;   // where each blend starts and how tall it is, as a share of the page height
let backdropSize = '';
const rgbOf = (v: string) => { const h = /^#([0-9a-f]{6})$/i.exec(v.trim())?.[1]; return h ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null; };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// The little pictures: 'a' is the picture's own colour (one of the theme's pastels), 'w' a light fill, 'o' an outline.
const DECOS: string[][] = [
  ['...a...', '...a...', '..awa..', 'aawwwaa', '..awa..', '...a...', '...a...'],             // a big sparkle
  ['.a.', 'awa', '.a.'],                                                                  // a twinkle
  ['.aa.aa.', 'awaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],                     // a heart
  ['..a..', '.aaa.', 'aawaa', '.aaa.', '..a..'],                                           // a flower
  ['....oooo....', '..oowwwwo...', '.owwwwwwwoo.', 'owwwwwwwwwwo', 'owwwwwwwwwwo', '.oooooooooo.'],   // a cloud
];
// A small seeded random, so the pictures sit in the same places every time.
const rand = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function decorate(img: ImageData, cols: number, rows: number, cs: CSSStyleDeclaration, stops: number[][]) {
  const css = (k: string, fallback: number[]) => rgbOf(cs.getPropertyValue(k)) ?? fallback;
  const edge = css('--edge', [143, 120, 208]), light = css('--surface', [255, 250, 253]);
  const inks = ['--dot1', '--dot2', '--dot3', '--today'].map((k) => css(k, [255, 143, 184]));
  const set = (x: number, y: number, c: number[]) => { if (x >= 0 && y >= 0 && x < cols && y < rows) img.data.set([c[0], c[1], c[2], 255], (y * cols + x) * 4); };
  const at = (x: number, y: number) => { const i = (y * cols + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  // the dotted texture: one darker pixel every six
  for (let y = 3; y < rows; y += 6) for (let x = (y / 6) % 2 ? 0 : 3; x < cols; x += 6) set(x, y, mix(at(x, y), edge, 0.18));
  // one picture or none in each 44 x 44 square, somewhere inside it
  const r = rand(7), CELL = 44;
  for (let cy = 0; cy * CELL < rows; cy++) for (let cx = 0; cx * CELL < cols; cx++) {
    if (r() > 0.6) continue;
    const art = DECOS[Math.floor(r() * DECOS.length)], ink = inks[Math.floor(r() * inks.length)];
    const x0 = cx * CELL + Math.floor(r() * (CELL - art[0].length)), y0 = cy * CELL + Math.floor(r() * (CELL - art.length));
    const pal: Record<string, number[]> = { a: ink, w: mix(light, [255, 255, 255], 0.5), o: mix(edge, stops[0], 0.35) };
    art.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) set(x0 + x, y0 + y, pal[ch]); }));
  }
}
export function paintBackdrop() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const px = parseFloat(cs.getPropertyValue('--px')) || 3;
  const stops = ['--bg', '--bg2', '--bg3'].map((k) => rgbOf(cs.getPropertyValue(k)));
  if (stops.some((c) => !c)) return;   // an unexpected colour format: keep the plain CSS background
  const cols = Math.ceil(root.clientWidth / px), rows = Math.ceil(Math.max(root.clientHeight, innerHeight) / px);
  const canvas = document.createElement('canvas');
  canvas.width = cols; canvas.height = rows;
  const g = canvas.getContext('2d');
  if (!g) return;
  const img = g.createImageData(cols, rows);
  for (let y = 0; y < rows; y++) {
    // each colour holds pure over the middle of its band; only a narrow strip between two bands is dithered
    const t = rows > 1 ? y / (rows - 1) : 0;
    const lo = t >= BAND_EDGE[1] ? 1 : 0, u = (t - BAND_EDGE[lo]) / BAND_BLEND;   // from this band's colour (0) to the next (>= 1)
    for (let x = 0; x < cols; x++) {
      const c = stops[u > (BAYER[y % 8][x % 8] + 0.5) / 64 ? lo + 1 : lo] as number[];
      img.data.set([c[0], c[1], c[2], 255], (y * cols + x) * 4);
    }
  }
  if ('fancy' in root.dataset) decorate(img, cols, rows, cs, stops as number[][]);
  g.putImageData(img, 0, 0);
  root.style.setProperty('--backdrop', `url("${canvas.toDataURL()}")`);
  root.style.setProperty('--backdrop-size', `${cols * px}px ${rows * px}px`);
  backdropSize = `${cols}x${rows}`;
}
let backdropTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(backdropTimer);
  backdropTimer = window.setTimeout(() => {
    const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px')) || 3;
    const root = document.documentElement;
    if (backdropSize !== `${Math.ceil(root.clientWidth / px)}x${Math.ceil(Math.max(root.clientHeight, innerHeight) / px)}`) paintBackdrop();
  }, 150);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => paintBackdrop());
