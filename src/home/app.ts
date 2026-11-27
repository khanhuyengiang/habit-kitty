// The home page: the menu to everything else, including Player Stat, which opens the player card (name, picture, ID and the three levels).
// The levels come from the three apps: Level from Pawchievement, HP from Habit Kitty's affection, MP from diary days
// (see ../shared/stat-lines.ts). Moving between screens is the shell's job (src/web/shell.ts): the menu buttons are data-action="go".
import { PLAYER_GENDERS, PLAYER_GENDER_LABEL, type Data, type PlayerGender } from '../achievement/model.ts';
import { LIMITS, ageOf, levelOf, titleFor } from '../achievement/ops.ts';
import { avatarSvg } from '../shared/stickers.ts';
import { DECOS, iconSvg } from '../shared/art.ts';
import { fineSvg } from '../shared/stickers.ts';
import { hpLine, lvLine, mpLine, shortId } from '../shared/stat-lines.ts';
import { meterHtml } from '../shared/meter.ts';
import { lastApp, onAppShown, appShown, shownApp } from '../shared/apps.ts';
import { compressPhoto } from '../shared/photo.ts';
import { avatarUrlOf, loadPlayerData, savePlayer } from '../shared/player.ts';
import { napSvg } from '../shared/pixelcat.ts';
import { onSheetChange, sheetCatSvg } from '../shared/kittysheet.ts';
import { $, esc } from '../shared/html.ts';
import { winBar } from '../notes/window.ts';
import { appName, closeX, playerButton, settingsButton, showToast, titleBar } from '../shared/ui.ts';
import { habitStats, onHabitStats } from '../shared/stats.ts';
import { VERSION } from '../shared/version.ts';
import { litterData, litterReady, onLitter } from '../litterbox/data.ts';
import { dueCount, todayNum } from '../litterbox/model.ts';
import { dayIndex } from '../habit/rules.ts';
import { onDiary, pageDue } from '../diary/data.ts';
import { onShop, shopData, shopReady } from '../shopping/data.ts';
import { listsToShop } from '../shopping/model.ts';


let data: Data | null = null;     // the saved player and achievements (null until read)
let avatar = '';                  // object URL of the player's picture
let failed = false;               // storage could not be read

// ---------- the player card (Player Stat) ----------

type View = 'stat' | 'form' | null;
let view: View = null;

function statCard(): string {
  if (!data) return `<div class="panel player">${closeX('player-close')}<p class="muted">${failed ? "Couldn't read the player." : 'Loading…'}</p></div>`;
  const u = data.user;
  const { xp, diaryDays } = habitStats();
  const age = ageOf(u);
  const facts = [age !== null ? `Age ${age}` : '', u.gender ? PLAYER_GENDER_LABEL[u.gender] : ''].filter(Boolean).join(' · ');
  const lv = levelOf(data);
  return `<div class="panel player">
    ${closeX('player-close')}
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
  $('home-top').innerHTML = titleBar('Itty Bitty', 'Kitty', playerButton() + settingsButton());
}

// The menu is four cards, each a group of keys: Do (pink), Track (purple), Keep (blue) and Studio (orange). A key's number (`due`)
// says how much needs you now, `what` says what it counts; a card's title shows the total of its keys. A key with `soon` is a place
// held for an app to come. A new app is one entry here.
// The wing on each side of the chosen app's key is a Kitty Gallery decoration (DECOS.wing; the right one is mirrored).
// Each key's name is written like its title bar. Player Stat is the person in the title bar.
const SLEEPER = { fur: '#fffafd', pattern: 'plain' as const };
// the sleeping kitty is the sheet's Nap, on its side (the plain Nap, or the code's own kitty, when the sheet has none)
const sleeperSvg = () => sheetCatSvg('nap4', SLEEPER, 'nap') ?? sheetCatSvg('nap', SLEEPER, 'nap') ?? napSvg(SLEEPER);
// the wings wear their card's colours (--wing-* are set in home.html)
const WING_INK = { H: 'var(--wing-line)', '[': 'var(--wing-lit)', a: 'var(--wing-a)', v: 'var(--wing-b)' };
const diaryToday = () => dayIndex(new Date(Date.now() + habitStats().offsetHours * 3_600_000));

interface Key { name: [string] | [string, string]; to: string; soon?: boolean; due?: () => number; what?: string }
interface Card { sleeper?: boolean; title: string; tint: 'pink' | 'purple' | 'blue' | 'orange'; keys: Key[] }
const CARDS: Card[] = [
  { sleeper: true, title: 'Do', tint: 'pink', keys: [
    { name: ['Habit', 'Kitty'], to: 'habit', due: () => habitStats().habitDue ?? 0, what: 'to do' },
    { name: ['Litterbox'], to: 'litterbox', due: () => (litterReady() ? dueCount(litterData(), todayNum()) : 0), what: 'due' } ] },
  { title: 'Track', tint: 'purple', keys: [
    { name: ['Journal'], to: 'diary', due: () => pageDue(diaryToday()), what: 'to write' },
    { name: ['Clockwork'], to: 'clockwork', soon: true },
    { name: ['Bank'], to: 'bank', soon: true } ] },
  { title: 'Keep', tint: 'blue', keys: [
    { name: ['Mart'], to: 'shopping', due: () => (shopReady() ? listsToShop(shopData()) : 0), what: 'lists to shop' },
    { name: ['Library'], to: 'notes' },
    { name: ['Pawchievement'], to: 'achievement' } ] },
  { title: 'Studio', tint: 'orange', keys: [
    { name: ['Gallery'], to: 'pixel' },
    { name: ['Wardrobe'], to: 'wardrobe' } ] },   // each key only while it is on in Settings → Apps to show (Wardrobe is off until then)
];
const badgeText = (n: number) => (n > 99 ? '99+' : String(n));

function renderMenu() {
  const chosen = lastApp();
  $('home-menu').innerHTML = CARDS.map((card) => {
    const keys = card.keys.filter((k) => appShown(k.to));
    if (!keys.length) return '';   // every app of the card is hidden
    const total = keys.reduce((sum, k) => sum + (k.due?.() ?? 0), 0);
    const rows = keys.map((k, i) => {
      const n = k.due?.() ?? 0, what = k.what ?? '';
      const badge = k.soon ? '<span class="menu-soon">soon</span>'
        : n ? `<span class="menu-badge" role="img" aria-label="${n} ${what}">${badgeText(n)}</span>` : '';
      const btn = `<button class="btn menu-btn" type="button" style="--mb: var(--c${i + 1})" ${k.soon ? 'disabled' : `data-action="go" data-to="${k.to}"`}>${appName(...k.name)}${badge}</button>`;
      // the key of the app opened last is the chosen one: a white outline that glows and a wing on each side
      const key = k.to === chosen
        ? `<div class="perch"><span class="wing l">${fineSvg(DECOS.wing.art, '', WING_INK)}</span><span class="glow">${btn}</span><span class="wing r">${fineSvg(DECOS.wing.art, '', WING_INK)}</span></div>`
        : btn;
      return key;
    }).join('');
    const count = total ? `<span class="menu-badge card-badge" role="img" aria-label="${total} need you">${badgeText(total)}</span>` : '';
    const win = `<section class="nwin nread menu-card ${card.tint}" style="--nc: var(--tint)" aria-label="${card.title}">${winBar(card.title, 'happy').replace('<span class="nwin-btns"', `${count}<span class="nwin-btns"`).replace('<span class="nwin-bar">', `<span class="nwin-bar">${card.sleeper ? `<span class="sitter">${sleeperSvg()}</span>` : ''}`)}<div class="nwin-screen">${rows}</div></section>`;
    return win;
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
    ${closeX('player-back', 'Back')}
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
onLitter(renderMenu);
onSheetChange(renderMenu);   // the sleeping kitty is drawn from the kitty sheet, which loads after the page starts
onDiary(renderMenu);   // the same for the other apps' numbers
onShop(renderMenu);   // the chores load after the page starts, and change while it is open
setInterval(() => { if (shownApp() === 'home') renderMenu(); }, 60_000);   // the numbers change with the day (chores due, today's page)
onHabitStats(() => { if (view === 'stat') renderStat(); if (shownApp() === 'home') renderMenu(); });

renderTop();
renderMenu();
load();
