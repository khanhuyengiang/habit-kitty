// The page background both apps share: a pixel gradient through the theme's three colours (--bg at the top, --bg2, --bg3 at the bottom). It is
// drawn on a canvas one page pixel per canvas pixel, and each pixel is one of the three colours: ordered (Bayer) dithering
// does the blending, so it stays pixel art. Redrawn when the theme or the size of the window changes.
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
export function paintBackdrop() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const px = parseFloat(cs.getPropertyValue('--px')) || 3;
  const stops = ['--bg', '--bg2', '--bg3'].map((k) => /^#([0-9a-f]{6})$/i.exec(cs.getPropertyValue(k).trim())?.[1]).map((h) => (h ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null));
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
