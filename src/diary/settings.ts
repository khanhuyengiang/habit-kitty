// The Diary's options (Meteorokinesis, Teleportation, Titles, Starry Nights, emotion names), drawn into the Settings screen under "Diary".
// They listen on their own container, so they work whichever screen is showing.
import type { Mood } from './model.ts';
import { diaryExtras, diaryInitialised, diaryReady, onDiary, updateExtras } from './data.ts';
import { MOODS, MOOD_KEYS, moodSprite } from './moods.ts';
import { esc } from '../shared/html.ts';

// The on/off options: the checkbox id, the diary.json key, the name, what it does, and what to say when it is turned on or off.
const OPTIONS = [
  { id: 'trackamaniac', key: 'trackamaniac', name: 'Meteorokinesis', text: 'Adds a weather choice (sunny, cloudy, windy, rainy, storm, snow, and any you draw in Kitty Gallery) to every diary page.',
    on: 'Meteorokinesis on. Diary pages now have a weather choice.', off: 'Meteorokinesis off. Weather you already saved is kept.' },
  { id: 'teleportation', key: 'teleportation', name: 'Teleportation', text: 'Adds a location to every diary page: where you were that day.',
    on: 'Teleportation on. Diary pages now have a location.', off: 'Teleportation off. Locations you already saved are kept.' },
  { id: 'photographer', key: 'photographer', name: 'Photographer', text: 'Lets a diary page hold 1, 2 or 4 photos: two sit side by side, four make a 2 × 2 grid.',
    on: 'Photographer on. Diary pages can hold up to 4 photos.', off: 'Photographer off. Pages keep the photos they have, and new ones get one.' },
  { id: 'diary-titles', key: 'titles', name: 'Titles', text: 'Adds an optional title to every diary page. It shows at the top of the page, under the date.',
    on: 'Titles on. Diary pages now have a title.', off: 'Titles off. Titles you already wrote are kept.' },
  { id: 'starry', key: 'starry', name: 'Starry Nights', text: 'Star a day to remember it: a yellow star for an exceptionally good day, an upside-down blue one for an exceptionally bad day. Starred days are listed under Memorable days.',
    on: 'Starry Nights on. You can star days now.', off: 'Starry Nights off. Stars you already gave are kept.' },
] as const;

export function mountDiarySettings(el: HTMLElement, notify: (text: string) => void) {
  const draw = () => {
    if (!diaryReady()) { el.innerHTML = '<p class="muted">Loading the diary…</p>'; return; }
    const x = diaryExtras(), names = x.moodNames ?? {};
    el.innerHTML = `<details class="panel fold" open><summary>Pages</summary><div class="fold-body">
        ${OPTIONS.map((o) => `<label class="check"><input type="checkbox" id="${o.id}" ${x[o.key] ? 'checked' : ''}><span><b>${o.name}</b><br><span class="muted">${o.text}</span></span></label>`).join('\n        ')}
      </div></details>
      <details class="panel fold"><summary>Emotion names</summary><div class="fold-body">
        <p class="muted">Rename the five diary emotions. Leave a box empty to keep the original name.</p>
        <div id="mood-names">${MOOD_KEYS.map((k) => `<label class="field">${moodSprite(k)} <input data-mood="${k}" maxlength="14" autocomplete="off" placeholder="${MOODS[k].label}" value="${esc(names[k] ?? '')}" aria-label="Name for ${MOODS[k].label}"></label>`).join('')}</div>
      </div></details>`;
  };
  el.addEventListener('change', async (ev) => {
    const t = ev.target as HTMLInputElement;
    const o = OPTIONS.find((p) => p.id === t.id);
    if (o) {
      if (await updateExtras({ [o.key]: t.checked })) notify(t.checked ? o.on : o.off);
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
