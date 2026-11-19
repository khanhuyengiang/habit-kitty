// Every picture in every app is drawn on ONE pixel grid: one art pixel is one --px in the page CSS (1.5px; 2px on wide
// screens, 1px on very narrow ones), the same pixel as an achievement card's. An svg's size is always its column count times --px, so no picture is ever scaled to a different
// pixel size. This is the drawing core; each app keeps its own art next to its code. Pure functions that return SVG strings.

// Pastel palette shared by all the multi-colour art. Letters are used in the art rows.
export const PAL: Record<string, string> = {
  o: '#4a4084', O: '#3d2c63',                       // plum outlines
  r: '#ff8fb8', R: '#ffc4da', m: '#f26fa3', M: '#ffb3d0', p: '#ffb3d0',   // pinks
  u: '#8fd0fa', U: '#bfe6fb', g: '#8fd0fa', s: '#e0f2fd',                  // baby blues
  v: '#b9a3f0', V: '#d9ccf7', d: '#8f78d0',                                // lavenders
  w: '#fffafd', y: '#ffd36e', Y: '#ffe9a0', e: '#e8a04c',                  // cream, sun, orange
  b: '#c99a73', B: '#a07250', c: '#f1cfa0', C: '#fff3d1', n: '#8fe0c8',    // browns, tan, mint
};

// One <rect> per pixel, for every letter that has a colour in `pal`. (Some readers depend on this: scene.ts and
// scripts/notify-icons.ts read the colours back from the rects.)
export const rect = (x: number, y: number, fill: string) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
export const cellRects = (rows: ReadonlyArray<string | readonly string[]>, pal: Record<string, string>) =>
  rows.map((row, y) => [...row].map((ch, x) => (pal[ch] ? rect(x, y, pal[ch]) : '')).join('')).join('');

// One path per letter, with each row's runs of the same letter merged, so a dense picture is still only a few elements.
// `ink` says which letters are drawn. Paths come out in the order their letters first appear.
export function runPaths(art: string[], ink: (ch: string) => boolean): Record<string, string> {
  const paths: Record<string, string> = {};
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!ink(ch)) continue;
      let n = 1;
      while (row[x + n] === ch) n++;
      paths[ch] = (paths[ch] ?? '') + `M${x} ${y}h${n}v1h-${n}z`;
      x += n - 1;
    }
  });
  return paths;
}

// A picture from rows of palette letters. Sized by CSS: width = cols * --px, height = rows * --px.
export function artSvg(art: string[], cls = '', pal: Record<string, string> = PAL): string {
  return `<svg class="pxs ${cls}" style="--w:${art[0].length};--h:${art.length}" viewBox="0 0 ${art[0].length} ${art.length}" aria-hidden="true" shape-rendering="crispEdges">${cellRects(art, pal)}</svg>`;
}

// A one-colour icon from rows where o is ink; rows may differ in length. It takes the text colour (fill: currentColor),
// so it follows buttons, hover and dark mode.
export function monoSvg(art: string[], cls = ''): string {
  const w = Math.max(...art.map((r) => r.length));
  return `<svg class="pxs ico ${cls}" style="--w:${w};--h:${art.length}" viewBox="0 0 ${w} ${art.length}" aria-hidden="true" shape-rendering="crispEdges"><path d="${runPaths(art, (ch) => ch === 'o').o ?? ''}"/></svg>`;
}
