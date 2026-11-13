// Kitty Gallery's options, drawn into the Settings screen under "Kitty Gallery": reset the icons to the original ones.
// It listens on its own container, so it works whichever screen is showing (Kitty Gallery redraws when it is shown).
import { initPixel, pixelData, pixelReady, setPixelData } from './data.ts';
import { countMine, resetIcons } from './model.ts';
import { plural } from '../shared/html.ts';

export function mountPixelSettings(el: HTMLElement, notify: (text: string) => void) {
  let asking = false;
  const draw = () => {
    if (!pixelReady()) { el.innerHTML = '<p class="muted">Loading Kitty Gallery…</p>'; return; }
    const { changed, mine } = countMine(pixelData());
    const what = [changed && plural(changed, 'changed icon'), mine && `${plural(mine, 'icon')} of your own`].filter(Boolean).join(' and ');
    el.innerHTML = `<details class="panel fold" open><summary>Reset to original</summary><div class="fold-body">
        <p class="muted">Puts every icon back as it comes with the app: its drawing, its name and its group. Export your icons first
          (in Kitty Gallery) if you want to keep a copy.</p>
        <p class="muted num">${what ? `You have ${what}.` : 'Every icon is the original.'}</p>
        ${asking ? `<div class="field"><span><b>Reset the icons?</b></span>
            <div class="btns flow">
              <button class="btn" type="button" data-action="pix-reset-changed" ${changed ? '' : 'disabled'}>Reset changed icons</button>
              ${mine ? `<button class="btn" type="button" data-action="pix-reset-all">Reset and delete my own icons</button>` : ''}
              <button class="btn" type="button" data-action="pix-reset-cancel">Cancel</button></div>
            <span class="muted">${mine ? 'Reset changed icons keeps the icons you drew yourself.' : ''}</span></div>`
          : `<div class="btns"><button class="btn" type="button" data-action="pix-reset-ask" ${what ? '' : 'disabled'}>Reset to original…</button></div>`}
      </div></details>`;
  };
  el.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
    const action = btn?.dataset.action;
    if (!action?.startsWith('pix-reset')) return;
    ev.stopPropagation();
    if (action === 'pix-reset-ask' || action === 'pix-reset-cancel') { asking = action === 'pix-reset-ask'; draw(); return; }
    const all = action === 'pix-reset-all';
    const ok = await setPixelData(resetIcons(pixelData(), all));
    asking = false;
    draw();
    notify(!ok ? "Couldn't reset the icons." : all ? 'Every icon is the original again, and your own icons are deleted.' : 'Changed icons are back to the original. Your own icons are kept.');
  });
  initPixel().then(draw);
  draw();
  // Settings calls this when the page opens, so the counts are as they are now (they change in Kitty Gallery).
  return () => { asking = false; draw(); };
}
