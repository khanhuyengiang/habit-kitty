// The home page: the menu to everything else, including Player Stat, which opens the player card (name, picture, ID and the three levels).
// The levels come from the three apps: Level from Kitty Achievement, HP from Habit Kitty's affection, MP from diary days
// (see ../player.ts). Moving between screens is the shell's job (src/web/shell.ts): the menu buttons are data-action="go".
import { PLAYER_GENDERS, PLAYER_GENDER_LABEL, type Data, type PlayerGender } from '../achievement/model.ts';
import { LIMITS, ageOf, levelOf, titleFor } from '../achievement/ops.ts';
import { avatarSvg } from '../achievement/pixelart.ts';
import { iconSvg } from '../pixelart.ts';
import { hpLine, lvLine, mpLine, shortId } from '../player.ts';
import { meterHtml } from '../shared/meter.ts';
import { lastApp, onAppShown } from '../shared/apps.ts';
import { compressPhoto } from '../shared/photo.ts';
import { avatarUrlOf, loadPlayerData, savePlayer } from '../shared/player.ts';
import { napSvg } from '../shared/pixelcat.ts';
import { artSvg } from '../shared/pixelart.ts';
import { esc } from '../shared/html.ts';
import { appName, playerButton, settingsButton, showToast, titleBar } from '../shared/ui.ts';
import { habitStats, onHabitStats } from '../shared/stats.ts';
import { VERSION } from '../version.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

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

function renderTop() {
  $('home-top').innerHTML = titleBar('Kitty', 'Home', playerButton() + settingsButton());
}

// A white feathered wing, copied from inspo/menu.jpg: the tip up and out, three tiers of feathers whose tips notch the
// outer edge, and a round joint with a curl at the bottom, next to the key. This is the left one; the right is drawn
// mirrored. o outline, w white, s feather line.
const WING = [
  '.oo.........',
  'owwoo.......',
  'owwwwoo.....',
  '.owwwwwoo...',
  'osssswwwwo..',
  'owwwwwwwwwo.',
  '.ossswwwwwwo',
  'owwwwwooowwo',
  'owwwwowwwowo',
  '.osssowswowo',
  '..owwowwwowo',
  '...oooooooo.',
];
const WING_PAL = { o: '#9a8cc8', w: '#ffffff', s: '#a29bb8' };
// The menu (after inspo/menu.jpg): short, long keys, one per app, each name written like its title bar. Player Stat is the
// person in the title bar.
const SLEEPER = { fur: '#fffafd', pattern: 'plain' as const };
const MENU: { name: [string, string]; to: string }[] = [
  { name: ['Habit', 'Kitty'], to: 'habit' },
  { name: ['Kitty', 'Journal'], to: 'diary' },
  { name: ['Kitty', 'Achievement'], to: 'achievement' },
  { name: ['Kitty', 'Mart'], to: 'shopping' },
];

function renderMenu() {
  const chosen = lastApp();
  $('home-menu').innerHTML = MENU.map((e, i) => {
    const btn = `<button class="btn menu-btn" type="button" style="--mb: var(--m${i + 1})" data-action="go" data-to="${e.to}">${appName(...e.name)}</button>`;
    // the key of the app opened last is the chosen one: a white outline that glows and a wing on each side
    const key = e.to === chosen
      ? `<div class="perch"><span class="wing l">${artSvg(WING, '', WING_PAL)}</span><span class="glow">${btn}</span><span class="wing r">${artSvg(WING, '', WING_PAL)}</span></div>`
      : btn;
    // a white cat always sleeps on Habit Kitty's key, whichever key is chosen
    return e.to === 'habit' ? `<div class="seat">${key}<span class="sitter">${napSvg(SLEEPER)}</span></div>` : key;
  }).join('');
  $('home-foot').textContent = `v${VERSION}`;
}

// ---------- editing the player ----------

interface Draft { name: string; gender: string; birthYear: string; picture: Blob | null; url: string; cat: boolean }
let draft: Draft | null = null;

const toast = (text: string) => showToast($('home-toast'), text);

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

// Player Stat is in every title bar, so it opens from any screen (its numbers are read again first); the card's own buttons
// are inside #home-modal, which sits outside every screen.
document.addEventListener('click', (ev) => {
  if (!(ev.target as Element).closest?.('[data-action="player-stat"]')) return;
  renderStat();
  load();
});
$('home-modal').addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn) return;
  switch (btn.dataset.action) {
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
$('home-modal').addEventListener('submit', (ev) => { ev.preventDefault(); if ((ev.target as HTMLElement).id === 'player-form') submitForm(); });
$('home-modal').addEventListener('change', (ev) => {
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
onAppShown('home', () => { renderTop(); renderMenu(); load(); });
onHabitStats(() => { if (view === 'stat') renderStat(); });

renderTop();
renderMenu();
load();
