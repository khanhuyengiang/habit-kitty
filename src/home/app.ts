// The home page: the menu to everything else, including Player Stat, which opens the player card (name, picture, ID and the three levels).
// The levels come from the three apps: Level from Achievement Kitty, HP from Habit Kitty's affection, MP from diary days
// (see ../player.ts). Moving between screens is the shell's job (src/web/shell.ts): the menu buttons are data-action="go".
import { PLAYER_GENDERS, PLAYER_GENDER_LABEL, type Data, type PlayerGender } from '../achievement/model.ts';
import { LIMITS, ageOf, levelOf, titleFor } from '../achievement/ops.ts';
import { avatarSvg } from '../achievement/pixelart.ts';
import { iconSvg } from '../pixelart.ts';
import { hpLine, lvLine, mpLine, shortId } from '../player.ts';
import { meterHtml } from '../shared/meter.ts';
import { habitKittySvg, onAppShown, onShown, trophyIcon } from '../shared/apps.ts';
import { paintBackdrop } from '../shared/backdrop.ts';
import { compressPhoto } from '../shared/photo.ts';
import { avatarUrlOf, loadPlayerData, savePlayer } from '../shared/player.ts';
import { bodySvg } from '../shared/pixelcat.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { habitStats, onHabitStats } from '../shared/stats.ts';
import { VERSION } from '../version.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

let data: Data | null = null;     // the saved player and achievements (null until read)
let avatar = '';                  // object URL of the player's picture
let failed = false;               // storage could not be read

// ---------- the player card (Player Stat) ----------

type View = 'stat' | 'form' | null;
let view: View = null;

function statCard(): string {
  if (!data) return `<div class="panel player"><button class="x-close" type="button" data-action="player-close" aria-label="Close">${iconSvg('x')}</button><p class="muted">${failed ? "Couldn't read the player." : 'Loading…'}</p></div>`;
  const u = data.user;
  const { xp, diaryDays } = habitStats();
  const age = ageOf(u);
  const facts = [age !== null ? `Age ${age}` : '', u.gender ? PLAYER_GENDER_LABEL[u.gender] : ''].filter(Boolean).join(' · ');
  const lv = levelOf(data);
  return `<div class="panel player">
    <button class="x-close" type="button" data-action="player-close" aria-label="Close">${iconSvg('x')}</button>
    <h3>Player stat</h3>
    <div class="player-head">
      <div class="avatar">${avatar ? `<img src="${esc(avatar)}" alt="">` : avatarSvg()}</div>
      <div class="p-info"><div class="p-name">${esc(u.displayName)}</div>
        ${facts ? `<span class="muted">${esc(facts)}</span>` : ''}
        <span class="muted num">Player ID #${esc(shortId(u.id))}</span></div>
      <button class="btn small icon" type="button" data-action="player-edit" aria-label="Edit player">${iconSvg('pencil')}</button>
    </div>
    <p class="title-line">${esc(titleFor(lv.level))}</p>
    <div class="pstats">
      ${meterHtml('lv', 'Lv', lvLine(lv))}
      ${meterHtml('hp', 'HP', xp === null ? null : hpLine(xp))}
      ${meterHtml('mp', 'MP', diaryDays === null ? null : mpLine(diaryDays))}
    </div></div>`;
}

function renderStat() {
  view = 'stat';
  $('home-modal').innerHTML = `<div class="scrim" data-action="player-close">${statCard()}</div>`;
  $('home-modal').hidden = false;
}

// ---------- header and menu ----------

const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;

function renderTop() {
  $('home-top').innerHTML = `<div class="brand"><h1>Kitty <span>Home</span></h1>
    <div class="brand-r">
      <button class="gear" type="button" data-action="home-theme" aria-label="${isDark() ? 'Switch to light mode' : 'Switch to dark mode'}">${iconSvg(isDark() ? 'sun' : 'moon')}</button>
      <button class="gear" type="button" data-action="go" data-to="habit" data-tab="settings" aria-label="Settings">${iconSvg('gear')}</button></div></div>`;
}

const WING = ['..........o.', '......oooooo', '...oooooooo.', '.ooooooooo..', 'oooooooooo..', '.o.oooooo...', '...o.ooo....', '.....o......'];
const PERSON = ['..ooo..', '.ooooo.', '.ooooo.', '..ooo..', 'ooooooo', 'ooooooo', 'ooooooo'];
interface Entry { label: string; icon: string; to?: string; tab?: string; soon?: boolean; action?: string }
const MENU: Entry[] = [
  { label: 'Habit Kitty', icon: habitKittySvg(), to: 'habit' },
  { label: 'Diary', icon: iconSvg('diary'), to: 'diary' },
  { label: 'Simple Notes', icon: iconSvg('pencil'), to: 'notes' },
  { label: 'Shopping Lists', icon: iconSvg('treats'), soon: true },
  { label: 'Achievements', icon: trophyIcon(), to: 'achievement' },
  { label: 'Player Stat', icon: monoSvg(PERSON), action: 'player-stat' },
];

function renderMenu() {
  $('home-menu').innerHTML = MENU.map((e, i) => {
    const btn = e.soon
      ? `<button class="btn menu-btn" type="button" disabled>${e.icon}<span>${e.label}</span><span class="soon">soon</span></button>`
      : e.action
        ? `<button class="btn menu-btn" type="button" data-action="${e.action}">${e.icon}<span>${e.label}</span></button>`
        : `<button class="btn menu-btn${i === 0 ? ' primary' : ''}" type="button" data-action="go" data-to="${e.to}"${e.tab ? ` data-tab="${e.tab}"` : ''}>${e.icon}<span>${e.label}</span></button>`;
    return i === 0
      ? `<div class="perch"><span class="wing l">${monoSvg(WING)}</span>${btn}<span class="wing r">${monoSvg(WING)}</span><span class="sitter">${bodySvg('happy', { fur: '#ffb98a', pattern: 'stripes' })}</span></div>`
      : btn;
  }).join('');
  $('home-foot').textContent = `v${VERSION}`;
}

// ---------- editing the player ----------

interface Draft { name: string; gender: string; birthYear: string; picture: Blob | null; url: string; cat: boolean }
let draft: Draft | null = null;

function toast(text: string) {
  const el = $('home-toast');
  el.textContent = text; el.hidden = false;
  clearTimeout((toast as unknown as { t?: number }).t);
  (toast as unknown as { t?: number }).t = window.setTimeout(() => (el.hidden = true), 3200);
}

function readDraftFields() {
  const f = document.getElementById('player-form') as HTMLFormElement | null;
  if (!f || !draft) return;
  draft.name = (f.elements.namedItem('name') as HTMLInputElement).value;
  draft.gender = (f.elements.namedItem('gender') as HTMLSelectElement).value;
  draft.birthYear = (f.elements.namedItem('birthYear') as HTMLInputElement).value;
}

function renderForm(errors: Record<string, string> = {}) {
  if (!draft || !data) return;
  view = 'form';
  const shown = draft.picture ? draft.url : draft.cat ? '' : avatar;
  const err = (k: string) => (errors[k] ? `<span class="form-error">${esc(errors[k])}</span>` : '');
  $('home-modal').innerHTML = `<div class="scrim" data-action="player-back"><form class="panel pform" id="player-form" novalidate>
    <button class="x-close" type="button" data-action="player-back" aria-label="Back">${iconSvg('x')}</button>
    <h3>Edit player</h3>
    <div class="avatar-row"><div class="avatar">${shown ? `<img src="${esc(shown)}" alt="">` : avatarSvg()}</div>
      <div class="avatar-btns"><button class="btn small" type="button" data-action="player-picture">Choose picture</button>
      ${shown ? '<button class="btn small" type="button" data-action="player-cat">Use the cat</button>' : ''}</div></div>
    <input type="file" id="player-file" accept="image/*" hidden>
    ${err('avatar')}
    <label class="field">Name <input name="name" maxlength="${LIMITS.name}" autocomplete="off" value="${esc(draft.name)}">${err('displayName')}</label>
    <div class="row">
      <label class="field">Gender <select name="gender"><option value="">Not set</option>${PLAYER_GENDERS.map((g) =>
        `<option value="${g}" ${draft!.gender === g ? 'selected' : ''}>${PLAYER_GENDER_LABEL[g]}</option>`).join('')}</select>${err('gender')}</label>
      <label class="field">Birth year <input name="birthYear" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(draft.birthYear)}">${err('birthYear')}</label>
    </div>
    <p class="muted">Player ID #${esc(shortId(data.user.id))} · shared by all the apps</p>
    <div class="btns"><button class="btn" type="button" data-action="player-back">Cancel</button><button class="btn primary" type="submit">Save</button></div>
  </form></div>`;
  $('home-modal').hidden = false;
}

function openForm() {
  if (!data) return;
  const u = data.user;
  draft = { name: u.displayName, gender: u.gender ?? '', birthYear: u.birthYear == null ? '' : String(u.birthYear), picture: null, url: '', cat: false };
  renderForm();
  document.querySelector<HTMLInputElement>('#player-form input[name="name"]')?.focus();
}

function dropDraft() {
  if (draft?.url) URL.revokeObjectURL(draft.url);
  draft = null;
}
function closeModal() {
  dropDraft();
  view = null;
  $('home-modal').hidden = true; $('home-modal').innerHTML = '';
}

async function submitForm() {
  if (!draft) return;
  readDraftFields();
  const year = draft.birthYear.trim();
  try {
    const r = await savePlayer({
      name: draft.name,
      gender: (draft.gender || null) as PlayerGender | null,
      birthYear: year === '' ? null : Number(year),
      avatar: draft.picture ?? (draft.cat ? 'cat' : 'keep'),
    });
    if (Object.keys(r.errors).length) { renderForm(r.errors); return; }
  } catch { renderForm({ avatar: "Couldn't save. Nothing was changed." }); return; }
  dropDraft();
  await load();
  renderStat();
  toast('Player saved.');
}

async function pickPicture(file: File | undefined) {
  if (!file || !draft) return;
  try {
    const blob = await compressPhoto(file, { maxSide: 256, square: true });
    readDraftFields();
    if (draft.url) URL.revokeObjectURL(draft.url);
    draft.picture = blob; draft.url = URL.createObjectURL(blob); draft.cat = false;
    renderForm();
  } catch { renderForm({ avatar: "Couldn't read that picture. Choose a normal picture file." }); }
}

// ---------- events ----------

onShown('home', 'click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn) return;
  switch (btn.dataset.action) {
    case 'home-theme': {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('hk-theme', next); } catch { /* not remembered */ }
      paintBackdrop(); renderTop();
      break;
    }
    case 'player-stat': renderStat(); break;
    case 'player-edit': openForm(); break;
    case 'player-close':
    case 'player-back': {
      // the dark scrim closes the dialog, but a click inside the panel must not
      if (btn.classList.contains('scrim') && ev.target !== btn) break;
      if (btn.dataset.action === 'player-back') { dropDraft(); renderStat(); } else closeModal();
      break;
    }
    case 'player-picture': document.getElementById('player-file')?.click(); break;
    case 'player-cat': readDraftFields(); if (draft) { draft.picture = null; draft.cat = true; renderForm(); } break;
  }
});
onShown('home', 'submit', (ev) => { ev.preventDefault(); if ((ev.target as HTMLElement).id === 'player-form') submitForm(); });
onShown('home', 'change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'player-file') { pickPicture(t.files?.[0]); t.value = ''; }
});

// ---------- start ----------

async function load() {
  try {
    const d = await loadPlayerData();
    const url = await avatarUrlOf(d);
    if (avatar.startsWith('blob:')) URL.revokeObjectURL(avatar);
    data = d; avatar = url; failed = false;
  } catch { failed = true; }
  if (view === 'stat') renderStat();
}

// The two apps change the player's numbers and may have changed the player itself: read everything again whenever home shows.
onAppShown('home', () => { renderTop(); load(); });
onHabitStats(() => { if (view === 'stat') renderStat(); });

renderTop();
renderMenu();
load();
