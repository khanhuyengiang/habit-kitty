// The Diary's options (Trackamaniac, emotion names), drawn into the Settings screen under "Diary".
// They listen on their own container, so they work whichever screen is showing.
import type { Mood } from '../store.ts';
import { diaryExtras, diaryInitialised, diaryReady, onDiary, updateExtras } from './data.ts';
import { MOODS, MOOD_KEYS, moodSprite } from './moods.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function mountDiarySettings(el: HTMLElement, notify: (text: string) => void) {
  const draw = () => {
    if (!diaryReady()) { el.innerHTML = '<p class="muted">Loading the diary…</p>'; return; }
    const x = diaryExtras(), names = x.moodNames ?? {};
    el.innerHTML = `<details class="panel fold" open><summary>Pages</summary><div class="fold-body">
        <label class="check"><input type="checkbox" id="trackamaniac" ${x.trackamaniac ? 'checked' : ''}><span><b>Trackamaniac</b><br><span class="muted">Adds a weather choice (sunny, cloudy, rainy, storm, snow) to every diary page.</span></span></label>
      </div></details>
      <details class="panel fold"><summary>Emotion names</summary><div class="fold-body">
        <p class="muted">Rename the five diary emotions. Leave a box empty to keep the original name.</p>
        <div id="mood-names">${MOOD_KEYS.map((k) => `<label class="field">${moodSprite(k)} <input data-mood="${k}" maxlength="14" autocomplete="off" placeholder="${MOODS[k].label}" value="${esc(names[k] ?? '')}" aria-label="Name for ${MOODS[k].label}"></label>`).join('')}</div>
      </div></details>`;
  };
  el.addEventListener('change', async (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'trackamaniac') {
      if (await updateExtras({ trackamaniac: t.checked })) notify(t.checked ? 'Trackamaniac on. Diary pages now have a weather choice.' : 'Trackamaniac off. Weather you already saved is kept.');
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
