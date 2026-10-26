// Sprite sheet for `npm run preview`: every face x pattern, so shape edits in src/pixelcat.ts
// can be seen side by side. Dev only — never bundled into the app.
import { FACE_X, FURS, NAP_W, PATTERNS, TRAITS, WIDTH, BODY_W, bodySvg, faceSvg, miniSvg, napSvg, popperSvg, MINI_W, type Face } from '../pixelcat.ts';
import type { CatLook } from '../rules.ts';

const FACES: Face[] = ['open', 'happy', 'sleepy', 'sad', 'starving', 'dead'];
const DEFAULT_FUR = FURS[0];

const el = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild!; };
const look = (fur: string, pattern: typeof PATTERNS[number]): CatLook => ({ fur, pattern, trait: TRAITS[0] });

// cols = the sprite's viewBox width, so the pixel-grid overlay lines up with its pixels
function cell(label: string, svg: string, cols: number) {
  return `<figure class="cell"><div class="art" style="--cols:${cols}">${svg}</div><figcaption>${label}</figcaption></figure>`;
}

function render() {
  const fur = (document.querySelector<HTMLInputElement>('#fur')!).value;
  const grid = document.querySelector('#sheet')!;
  const lk = look(fur, 'plain');
  let out = `<section class="row"><h2>size comparison (same pixel size as the app)</h2><div class="compare">`
    + [['sitting', bodySvg('open', lk, 0), BODY_W], ['napping', napSvg(lk), NAP_W], ['face', faceSvg('open', lk), WIDTH - 2 * FACE_X], ['mini', miniSvg('open', lk), MINI_W]]
      .map(([label, svg, cols]) => `<figure><div class="art" style="--cols:${cols}">${svg}</div><figcaption>${label} ${cols} px wide</figcaption></figure>`).join('')
    + '</div></section>';
  for (const p of PATTERNS) {
    out += `<section class="row"><h2>${p}</h2><div class="cells">`;
    out += FACES.map((f) => cell(f, faceSvg(f, look(fur, p)), WIDTH - 2 * FACE_X)).join('');
    out += FACES.map((f) => cell(`${f} (sitting)`, bodySvg(f, look(fur, p), 0), BODY_W)).join('');
    out += cell('napping', napSvg(look(fur, p)), NAP_W);
    out += FACES.map((f) => cell(`${f} (mini)`, miniSvg(f, look(fur, p)), MINI_W)).join('');
    out += '</div></section>';
  }
  out += `<section class="row"><h2>popper</h2><div class="cells">${cell('popper', popperSvg(), 13)}</div></section>`;
  grid.innerHTML = out;
}

document.body.append(el(`<header class="bar">
  <strong>pixel cats</strong>
  <label>fur <input id="fur" type="color" value="${DEFAULT_FUR}"></label>
  <span class="swatches">${FURS.map((f) => `<button class="sw" data-fur="${f}" style="background:${f}" title="${f}"></button>`).join('')}</span>
  <label><input id="grid" type="checkbox"> pixel grid</label>
  <label>pixel size <input id="px" type="range" min="2" max="10" value="3"> <span id="pxv">3</span>px</label>
</header>`));
document.body.append(el('<main id="sheet"></main>'));

document.querySelector('#fur')!.addEventListener('input', render);
document.querySelector('.swatches')!.addEventListener('click', (e) => {
  const fur = (e.target as HTMLElement).dataset.fur;
  if (!fur) return;
  (document.querySelector<HTMLInputElement>('#fur')!).value = fur;
  render();
});
document.querySelector('#grid')!.addEventListener('change', (e) =>
  document.body.classList.toggle('show-grid', (e.target as HTMLInputElement).checked));
document.querySelector('#px')!.addEventListener('input', (e) => {
  const v = (e.target as HTMLInputElement).value;
  document.documentElement.style.setProperty('--px', `${v}px`);
  document.querySelector('#pxv')!.textContent = v;
});

render();

// esbuild's watch server pushes an event on every rebuild; reload so edits show up instantly.
new EventSource('/esbuild').addEventListener('change', () => location.reload());
