// Settings → Look: light or dark (or follow the device), and the fancy background (sparkles, clouds and hearts over a dotted
// backdrop, after the pictures in inspo/). Both are kept on this device; src/shared/ui.ts reads them before the first paint.
import { fancyOn, setFancy, setThemeMode, themeMode, type ThemeMode } from './ui.ts';

const MODES: [ThemeMode, string][] = [['device', 'Like the device'], ['light', 'Light'], ['dark', 'Dark']];

export function mountLookSettings(el: HTMLElement) {
  const draw = () => {
    const mode = themeMode();
    el.innerHTML = `<div class="field"><span>Colours</span>
        <div class="chips" role="radiogroup" aria-label="Colours">${MODES.map(([m, label]) =>
          `<label><input type="radio" name="look-theme" value="${m}" ${m === mode ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></div>
      <label class="check"><input type="checkbox" id="look-fancy" ${fancyOn() ? 'checked' : ''}><span><b>Fancy background</b><br><span class="muted">Sparkles, little clouds and hearts behind every screen.</span></span></label>`;
  };
  el.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.name === 'look-theme') setThemeMode(t.value as ThemeMode);
    else if (t.id === 'look-fancy') setFancy(t.checked);
  });
  draw();
}
