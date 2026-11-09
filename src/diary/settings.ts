// The Diary's options (Meteorokinesis, Teleportation, Titles, Starry Nights, emotion names), drawn into the Settings screen under "Diary".
// They listen on their own container, so they work whichever screen is showing.
import type { Mood } from '../store.ts';
import { diaryExtras, diaryInitialised, diaryReady, onDiary, updateExtras } from './data.ts';
import { MOODS, MOOD_KEYS, moodSprite } from './moods.ts';
import { esc } from '../shared/html.ts';


export function mountDiarySettings(el: HTMLElement, notify: (text: string) => void) {
  const draw = () => {
    if (!diaryReady()) { el.innerHTML = '<p class="muted">Loading the diary…</p>'; return; }
    const x = diaryExtras(), names = x.moodNames ?? {};
    el.innerHTML = `<details class="panel fold" open><summary>Pages</summary><div class="fold-body">
        <label class="check"><input type="checkbox" id="trackamaniac" ${x.trackamaniac ? 'checked' : ''}><span><b>Meteorokinesis</b><br><span class="muted">Adds a weather choice (sunny, cloudy, windy, rainy, storm, snow) to every diary page.</span></span></label>
        <label class="check"><input type="checkbox" id="teleportation" ${x.teleportation ? 'checked' : ''}><span><b>Teleportation</b><br><span class="muted">Adds a location to every diary page: where you were that day.</span></span></label>
        <label class="check"><input type="checkbox" id="photographer" ${x.photographer ? 'checked' : ''}><span><b>Photographer</b><br><span class="muted">Lets a diary page hold 1, 2 or 4 photos: two sit side by side, four make a 2 × 2 grid.</span></span></label>
        <label class="check"><input type="checkbox" id="diary-titles" ${x.titles ? 'checked' : ''}><span><b>Titles</b><br><span class="muted">Adds an optional title to every diary page. It shows at the top of the page, under the date.</span></span></label>
        <label class="check"><input type="checkbox" id="starry" ${x.starry ? 'checked' : ''}><span><b>Starry Nights</b><br><span class="muted">Star a day to remember it: a yellow star for an exceptionally good day, an upside-down blue one for an exceptionally bad day. Starred days are listed under Memorable days.</span></span></label>
      </div></details>
      <details class="panel fold"><summary>Emotion names</summary><div class="fold-body">
        <p class="muted">Rename the five diary emotions. Leave a box empty to keep the original name.</p>
        <div id="mood-names">${MOOD_KEYS.map((k) => `<label class="field">${moodSprite(k)} <input data-mood="${k}" maxlength="14" autocomplete="off" placeholder="${MOODS[k].label}" value="${esc(names[k] ?? '')}" aria-label="Name for ${MOODS[k].label}"></label>`).join('')}</div>
      </div></details>`;
  };
  el.addEventListener('change', async (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'trackamaniac') {
      if (await updateExtras({ trackamaniac: t.checked })) notify(t.checked ? 'Meteorokinesis on. Diary pages now have a weather choice.' : 'Meteorokinesis off. Weather you already saved is kept.');
      return;
    }
    if (t.id === 'teleportation') {
      if (await updateExtras({ teleportation: t.checked })) notify(t.checked ? 'Teleportation on. Diary pages now have a location.' : 'Teleportation off. Locations you already saved are kept.');
      return;
    }
    if (t.id === 'photographer') {
      if (await updateExtras({ photographer: t.checked })) notify(t.checked ? 'Photographer on. Diary pages can hold up to 4 photos.' : 'Photographer off. Pages keep the photos they have, and new ones get one.');
      return;
    }
    if (t.id === 'diary-titles') {
      if (await updateExtras({ titles: t.checked })) notify(t.checked ? 'Titles on. Diary pages now have a title.' : 'Titles off. Titles you already wrote are kept.');
      return;
    }
    if (t.id === 'starry') {
      if (await updateExtras({ starry: t.checked })) notify(t.checked ? 'Starry Nights on. You can star days now.' : 'Starry Nights off. Stars you already gave are kept.');
      return;
    }
    const k = t.dataset.mood as Mood | undefined;
    if (k && t.closest('#mood-names')) {
      const next = { ...(diaryExtras().moodNames ?? {}) }, v = t.value.trim();
      if (v && v !== MOODS[k].label) next[k] = v; else delete next[k];
      await updateExtras({ moodNames: next });
    }
  });
  // Redraw when the data changes, but never under the cursor.
  onDiary(() => { if (!el.contains(document.activeElement)) draw(); });
  diaryInitialised.then(draw);
  draw();
}
