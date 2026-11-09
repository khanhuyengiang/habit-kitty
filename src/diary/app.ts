// The Diary screen: a month calendar of pages (tap a day to write one), a reflection for the month, and birthdays.
// The data lives in ./data.ts (Habit Kitty starts it); the pure parts are in ../store.ts and ./people.ts.
// Drawn with Habit Kitty's stylesheet, in web/diary.html's root.
import { dateOf, dayOf } from '../calendar.ts';
import { iconSvg, weatherSvg } from '../pixelart.ts';
import { mpLine } from '../player.ts';
import { dayIndex } from '../rules.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { esc } from '../shared/html.ts';
import { homeButton, playerButton, settingsButton, showToast, titleBar } from '../shared/ui.ts';
import { journalTabs, onAppShown, onShown } from '../shared/apps.ts';
import { meterHtml } from '../shared/meter.ts';
import { compressPhoto } from '../shared/photo.ts';
import { habitStats } from '../shared/stats.ts';
import { allNotes, noteOf } from '../notes/data.ts';
import { noteDate, parseNote } from '../notes/model.ts';
import { tint, winBar } from '../notes/window.ts';
import { MAX_PHOTOS, dayName, monthKey, type DiaryEntry, type Mood, type Person, type Star, type Weather } from '../store.ts';
import {
  dayCount, diaryEntries, diaryExtras, diaryInitialised, diaryReady, entryOf, getPhoto, hasPageOn, onDiary, reflectionOf, saveEntry,
  saveReflection, updateExtras,
} from './data.ts';
import { MOOD_KEYS, STAR_LABEL, WEATHER, feelingText, moodName, moodSprite, moodsSprite, pinSvg, starSvg } from './moods.ts';
import { MAX_PEOPLE, birthdaysOn, personErrors, personFrom, turning, upcoming, whenText } from './people.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

// ---- the clock: the same day as Habit Kitty (its day start, and its playtest clock) ----
const now = () => new Date(Date.now() + habitStats().offsetHours * 3_600_000);
const today = () => dayIndex(now());
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }));
const nowMonth = () => { const d = dateOf(today()); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const fullMonth = (y: number, m: number) => dateOf(dayOf(y, m, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const settings = () => diaryExtras();
const people = (): Person[] => settings().people ?? [];
const names = () => settings().moodNames ?? {};

const toast = (text: string) => showToast($('diary-toast'), text);

// ---- header ----
function renderTop() {
  $('diary-top').innerHTML = titleBar('Kitty', 'Journal', homeButton() + playerButton() + settingsButton()) + journalTabs('diary');
}

// ---- the page ----
const CAKE = ['.o.o.o.', '.o.o.o.', 'ooooooo', 'o.o.o.o', 'ooooooo', 'ooooooo'];
const cake = (cls: string) => `<span class="${cls}">${monoSvg(CAKE)}</span>`;
let ym: { y: number; m: number } | null = null;
const month = () => {
  if (!ym) { const d = dateOf(today()); ym = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }
  return ym;
};

let bdayOpen = false;   // the Birthdays fold starts closed, and stays as you left it while the page redraws
function birthdayCard(): string {
  const list = people();
  const t = today();
  const next = upcoming(list, t, 3);
  const rows = next.map(({ person: p, in: n, turning: age }) =>
    `<li><span class="who"><b>${esc(p.name)}</b>${age !== null ? `<span class="muted">turns ${age}</span>` : ''}</span><span class="soon">${n === 0 ? `${cake('bday-ico')} ` : ''}${whenText(n)}</span></li>`).join('');
  const todayCount = next.filter((x) => x.in === 0).length;
  return `<details class="panel fold" id="bday-fold" ${bdayOpen ? 'open' : ''}><summary>Birthdays${list.length ? ` (${list.length})` : ''}${todayCount ? ` ${cake('bday-ico')}` : ''}</summary><div class="fold-body">
    ${rows ? `<ul class="dlist">${rows}</ul>` : '<p class="muted">Add the people whose birthdays you want to remember. They show on the calendar and here.</p>'}
    <div class="btns">${list.length ? `<button class="btn" type="button" data-action="people-open">All ${list.length}</button>` : ''}<button class="btn" type="button" data-action="person-add">+ Add birthday</button></div></div></details>`;
}

// Starry Nights: the starred days, newest first, in two lists. Folded; it stays as you left it while the page redraws.
let memOpen = false;
function memorableCard(): string {
  if (!settings().starry) return '';
  const starred = Object.entries(diaryEntries()).filter(([, e]) => e.star).map(([k, e]) => ({ day: Number(k), e })).sort((a, b) => b.day - a.day);
  const section = (kind: Star, title: string, empty: string) => {
    const rows = starred.filter((x) => x.e.star === kind).map(({ day, e }) => {
      const label = settings().titles && e.title?.trim() ? e.title.trim() : excerptOf(e.text);
      return `<li><button type="button" class="memo" data-action="diary-open" data-day="${day}"><b>${esc(dateOf(day).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }))}</b>${label ? `<span class="muted">${esc(label)}</span>` : ''}</button></li>`;
    }).join('');
    return `<div class="memo-sec"><h4>${starSvg(kind)}${title} <span class="muted">(${starred.filter((x) => x.e.star === kind).length})</span></h4>${rows ? `<ul class="dlist">${rows}</ul>` : `<p class="muted">${empty}</p>`}</div>`;
  };
  return `<details class="panel fold" id="mem-fold" ${memOpen ? 'open' : ''}><summary>Memorable days${starred.length ? ` (${starred.length})` : ''}</summary><div class="fold-body">
    ${section('happy', 'Happy memories', 'No happy memories yet. Star an exceptionally good day.')}${section('sad', 'Sad memories', 'No sad memories yet.')}</div></details>`;
}
const excerptOf = (text: string) => { const l = text.split('\n').find((x) => x.trim())?.trim() ?? ''; return l.length > 60 ? `${l.slice(0, 59)}…` : l; };

// What the calendar's marks mean, in a small dialog (opened with the ? button).
function openLegend() {
  openLayer(`${closeX('layer-close')}<h3>Calendar marks</h3>
    <div class="dlegend"><span><i class="has"></i>has an entry</span><span><i class="now"></i>today</span><span>${cake('bday-ico')}birthday</span>${settings().starry ? `<span>${starSvg('happy')}happy memory</span><span>${starSvg('sad')}sad memory</span>` : ''}${
      MOOD_KEYS.map((k) => `<span>${moodSprite(k)}${esc(moodName(k, names()))}</span>`).join('')}</div>`, 'Calendar marks');
}

// With Titles on: the month's titled pages in a list, oldest first; each opens its page.
let glanceOpen = false;
function glanceCard(): string {
  if (!settings().titles) return '';
  const { y, m } = month();
  const first = dayOf(y, m, 1), last = dayOf(y, m + 1, 0);
  const rows: string[] = [];
  for (let d = first; d <= last; d++) {
    const title = entryOf(d)?.title?.trim();
    if (title) rows.push(`<li><button type="button" class="memo" data-action="diary-open" data-day="${d}"><b>${esc(dateOf(d).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }))}</b><span class="muted">${esc(title)}</span></button></li>`);
  }
  return `<details class="panel fold" id="glance-fold" ${glanceOpen ? 'open' : ''}><summary>Month at a glance</summary><div class="fold-body">
    ${rows.length ? `<ul class="dlist">${rows.join('')}</ul>` : '<p class="muted">No titled pages this month yet. Give a page a title to see it here.</p>'}</div></details>`;
}

function calendarCard(): string {
  const t = today();
  const { y, m } = month();
  const first = dayOf(y, m, 1), last = dayOf(y, m + 1, 0);
  const lead = (dateOf(first).getUTCDay() + 6) % 7;
  const title = fullMonth(y, m);
  const atNow = y * 12 + m >= nowMonth();
  let pages = 0;
  const cells = [
    ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`),
    ...Array.from({ length: lead }, () => '<div class="dc blank"></div>'),
  ];
  for (let d = first; d <= last; d++) {
    const e = entryOf(d);
    const has = hasPageOn(d);
    if (has) pages++;
    const born = birthdaysOn(people(), d);
    const star = settings().starry ? e?.star : undefined;
    const what = [has ? 'entry' : '', e?.mood ? `feeling ${feelingText(e, names()).toLowerCase()}` : '', e?.weather ? WEATHER[e.weather].toLowerCase() : '',
      born.length ? `birthday: ${born.map((p) => p.name).join(', ')}` : '', star ? STAR_LABEL[star].toLowerCase() : ''].filter(Boolean).join(', ') || 'empty';
    cells.push(`<button type="button" class="dc${has ? ' has' : ''}${d === t ? ' now' : ''}" data-action="diary-open" data-day="${d}" ${d > t ? 'disabled' : ''}
      aria-label="${esc(dateOf(d).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))}: ${esc(what)}"><span class="dn">${d - first + 1}</span>${born.length ? cake(star ? 'bday mid' : 'bday') : ''}${star ? starSvg(star, 'dstar') : ''}${e?.mood ? moodsSprite(e.mood, e.mood2) : ''}</button>`);
  }
  return `<article class="cat"><div class="month">
    <div class="month-nav">
      <button type="button" data-action="diary-month" data-step="-1" aria-label="Previous month">${iconSvg('prev')}</button>
      <button type="button" class="month-title" data-action="picker-open" aria-haspopup="dialog" aria-label="${esc(title)}. Pick a month">${esc(title)}</button>
      <button type="button" data-action="diary-month" data-step="1" aria-label="Next month" ${atNow ? 'disabled' : ''}>${iconSvg('next')}</button>
    </div>
    <div class="dcal" role="group" aria-label="Diary calendar">${cells.join('')}</div>
    <p class="stats">${pages ? `<b class="num">${pages}</b> ${pages === 1 ? 'page' : 'pages'} written this month` : 'No pages this month yet. Tap a day to write one.'}</p>
    <div class="btns start"><button class="btn small" type="button" data-action="diary-today">Jump to today</button>
      <button class="btn small" type="button" data-action="legend-open" aria-haspopup="dialog" aria-label="What the marks mean">?</button></div>
    </div></article>`;
}

function reflectionCard(): string {
  const { y, m } = month();
  const key = monthKey(y, m);
  const r = reflectionOf(key);
  const first = dayOf(y, m, 1), last = dayOf(y, m + 1, 0);
  const tally = new Map<Mood, number>();
  for (let d = first; d <= last; d++) { const e = entryOf(d); for (const k of [e?.mood, e?.mood2]) if (k) tally.set(k, (tally.get(k) ?? 0) + 1); }
  const feelings = MOOD_KEYS.filter((k) => tally.has(k)).map((k) => `<span>${moodSprite(k)}${esc(moodName(k, names()))} ×${tally.get(k)}</span>`).join('');
  return `<article class="cat"><div class="dhead"><h3>Reflection</h3></div>
    ${feelings ? `<div class="tally">${feelings}</div>` : ''}
    ${r ? `<p class="reflect-text">${esc(r.text)}</p>` : '<p class="muted">How was this month? What went well, what was hard, and what do you want to do differently?</p>'}
    <button class="btn small start" type="button" data-action="reflect-edit">${r ? 'Edit reflection' : 'Write reflection'}</button></article>`;
}

function renderBody() {
  if (!diaryReady()) { $('diary-body').innerHTML = '<div class="panel"><p class="muted">Loading the diary…</p></div>'; return; }
  $('diary-body').innerHTML = `${meterHtml('mp', 'MP', mpLine(dayCount()))}${calendarCard()}${glanceCard()}${reflectionCard()}${birthdayCard()}${memorableCard()}`;
}

// ---- dialogs ----
// A dialog over the page, and a smaller one over it (the month picker, a confirmation) that keeps the dialog below as it was.
function openModal(html: string) {
  const m = $('diary-modal');
  m.innerHTML = `<div class="scrim" data-action="modal-close">${html}</div>`;
  m.hidden = false;
  m.querySelector<HTMLElement>('input, textarea')?.focus();
}
function closeLayer() { document.getElementById('diary-layer')?.remove(); picker = null; }
function closeModal() {
  closeLayer();
  revokePhotos();
  draft = null;
  $('diary-modal').hidden = true; $('diary-modal').innerHTML = '';
  renderBody();   // what was written behind the dialog shows now
}
function openLayer(html: string, label: string) {
  document.getElementById('diary-layer')?.remove();   // replace the open one (the picker keeps its state while it redraws)
  const el = document.createElement('div');
  el.id = 'diary-layer';
  el.className = 'scrim layer';
  el.dataset.action = 'layer-close';
  el.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  document.querySelector('[data-app-root="diary"]')?.appendChild(el);
  (el.querySelector<HTMLElement>('[data-focus], .pick:not(:disabled), button:not(:disabled)'))?.focus();
}
const closeX = (action = 'modal-close') => `<button class="x-close" type="button" data-action="${action}" aria-label="Close">${iconSvg('x')}</button>`;

// ---- month and year picker ----
interface Picker { year: number }
let picker: Picker | null = null;
function drawPicker(view: 'month' | 'year') {
  const p = picker;
  if (!p) return;
  const cur = nowMonth(), curY = Math.floor(cur / 12);
  const { y, m } = month();
  const cell = (cls: string, data: string, label: string, on: boolean, off: boolean, aria = label) =>
    `<button type="button" class="pick${cls}" ${data} aria-pressed="${on}" aria-label="${aria}" ${off ? 'disabled' : ''}>${label}</button>`;
  const html = view === 'month'
    ? `${closeX('layer-close')}<div class="picker-head"><button class="btn small" type="button" data-action="picker-years" aria-label="Back to years">${iconSvg('prev')}Back</button><strong>${p.year}</strong></div>
      <div class="pick-grid">${MONTH_NAMES.map((name, i) => cell(p.year * 12 + i === cur ? ' now' : '', `data-action="picker-month" data-m="${i}"`, name, p.year * 12 + i === y * 12 + m, p.year * 12 + i > cur, `${name} ${p.year}`)).join('')}</div>`
    : `${closeX('layer-close')}<div class="picker-head"><strong>Pick a year</strong></div>
      <div class="pick-grid">${Array.from({ length: 12 }, (_, i) => curY - 10 + i).map((yy) =>
        cell(yy === curY ? ' now' : '', `data-action="picker-year" data-y="${yy}"`, String(yy), yy === y, yy > curY)).join('')}</div>`;
  openLayer(html, view === 'month' ? `Pick a month in ${p.year}` : 'Pick a year');
}

// ---- one day's page ----
interface DraftPhoto { blob: Blob; url: string }
// photos: the page's pictures in order (one, or up to four with the Photographer option); photoLost: a saved photo could not be
// read, so its file is kept as it is unless the photos are changed; busy: what is being done to them (they cannot be saved meanwhile).
interface Draft { day: number; moods: Mood[]; weather?: Weather; star?: Star; note?: string; photos: DraftPhoto[]; touched?: boolean; busy?: string; photoLost?: boolean; reading?: boolean; loaded?: Promise<unknown> }
let draft: Draft | null = null;
const maxPhotos = () => (settings().photographer ? MAX_PHOTOS : 1);
function revokePhotos() { draft?.photos.forEach((p) => URL.revokeObjectURL(p.url)); }

// One photo fills the width, two sit side by side, four make a 2 x 2 grid (web/diary.html, .photo-grid).
const photoGrid = (urls: string[], remove: boolean) => `<div class="photo-grid" data-n="${urls.length}">${urls.map((u, i) =>
  `<figure><img src="${u}" alt="Photo ${i + 1} of ${urls.length}">${remove ? `<button class="btn small" type="button" data-action="diary-photo-remove" data-i="${i}" aria-label="Remove photo ${i + 1}">${iconSvg('x')}</button>` : ''}</figure>`).join('')}</div>`;

function drawDraftPhoto() {
  if (!draft) return;
  const box = $('diary-photo');
  const form = document.getElementById('diary-form');
  form?.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((b) => (b.disabled = !!draft?.busy));
  const add = form?.querySelector<HTMLButtonElement>('[data-action="diary-photo-add"]');
  if (add) add.disabled = !!draft.busy || draft.photos.length >= maxPhotos();
  if (draft.busy) {   // a pixel bar that sweeps back and forth while photos are converted or loaded
    box.innerHTML = `<div class="loading" role="status"><p class="muted">${draft.busy}</p><div class="bar busy"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
    return;
  }
  const urls = draft.photos.map((p) => p.url);
  if (draft.reading) { box.innerHTML = urls.length ? photoGrid(urls, false) : ''; return; }
  box.innerHTML = urls.length ? photoGrid(urls, true) : '<p class="muted">No photo attached.</p>';
  const hint = document.getElementById('diary-photo-hint');
  if (hint) hint.textContent = settings().photographer ? `${urls.length} of ${MAX_PHOTOS}. A page has 1, 2 or 4 photos.` : '';
}
async function loadPhotos(day: number, count: number): Promise<{ photos: DraftPhoto[]; lost: boolean }> {
  const found = await Promise.all(Array.from({ length: count }, (_, i) => getPhoto(day, i)));
  const photos = found.filter((b): b is Blob => !!b).map((blob) => ({ blob, url: URL.createObjectURL(blob) }));
  return { photos, lost: photos.length < count };
}
function markMood() {
  document.querySelectorAll<HTMLElement>('#diary-moods [data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(!!draft?.moods.includes(b.dataset.mood as Mood))));
  document.querySelectorAll<HTMLElement>('#diary-stars [data-star]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.star === draft?.star)));
  document.querySelectorAll<HTMLElement>('#diary-weather [data-weather]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.weather === draft?.weather)));
}
const dateText = (day: number) => dateOf(day).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
// Previous day, the date, next day.
const diaryNav = (day: number) => `<div class="diary-nav">
  <button class="btn small" type="button" data-action="diary-go" data-day="${day - 1}" aria-label="Previous day">${iconSvg('prev')}</button>
  <h3 class="diary-date">${esc(dateText(day))}</h3>
  <button class="btn small" type="button" data-action="diary-go" data-day="${day + 1}" aria-label="Next day" ${day >= today() ? 'disabled' : ''}>${iconSvg('next')}</button></div>`;

// The notes that can be linked to a page: those from the same day first (suggested), then a list of the others.
function drawNoteLink() {
  const box = document.getElementById('diary-notes');
  if (!box || !draft) return;
  const all = allNotes(), day = dayName(draft.day);
  const same = all.filter((n) => noteDate(n) === day);
  const linked = draft.note;
  const chips = [...same.map((n) => n.name), ...(linked && !same.some((n) => n.name === linked) ? [linked] : [])];
  const others = all.filter((n) => !chips.includes(n.name));
  box.innerHTML = `${chips.length ? `<div class="note-chips">${chips.map((name) => `<button type="button" class="btn small" data-action="diary-note" data-name="${esc(name)}" aria-pressed="${name === linked}">${esc(name)}${same.some((n) => n.name === name) ? '' : noteOf(name) ? '' : ' (missing)'}</button>`).join('')}</div>` : ''}
    ${same.length ? '' : '<p class="muted">No note is dated this day.</p>'}
    ${others.length ? `<select id="diary-note-pick" aria-label="Link another note"><option value="">Another note…</option>${others.map((n) => `<option value="${esc(n.name)}">${esc(n.name)}</option>`).join('')}</select>` : ''}`;
}

// A page with text opens as read-only; an empty one, or "Edit entry", opens the form.
function openDiary(day: number, edit = false) {
  const e = entryOf(day);
  revokePhotos();
  const reading = !edit && !!e?.text.trim();
  draft = { day, moods: [e?.mood, e?.mood2].filter((m): m is Mood => !!m), weather: e?.weather, star: e?.star, note: e?.note, photos: [], busy: e?.photo ? 'Loading photo…' : undefined, reading };
  const born = birthdaysOn(people(), day);
  const birthday = born.length ? `<p class="mood-now">${cake('bday-ico')}<span>${esc(born.map((p) => `${p.name}'s birthday`).join(', '))}</span></p>` : '';
  if (reading && e) {
    const linked = e.note ? noteOf(e.note) : undefined;
    const p = linked && parseNote(linked.text);
    openModal(`<div class="panel" id="diary-read">${closeX()}
      ${diaryNav(day)}${settings().titles && e.title?.trim() ? `<h3 class="diary-date diary-title">${esc(e.title.trim())}</h3>` : ''}${birthday}
      <div class="diary-mood"><span class="mood-line">${e.mood ? `<span class="mood-now">${moodsSprite(e.mood, e.mood2)}<span>${esc(feelingText(e, names()))}</span></span>` : ''}${
        e.weather ? `<span class="mood-now">${weatherSvg(e.weather)}<span>${WEATHER[e.weather]}</span></span>` : ''}</span><button class="btn small" type="button" data-action="diary-edit">Edit</button></div>
      ${settings().teleportation && e.location?.trim() ? `<span class="mood-now where">${pinSvg()}<span>${esc(e.location.trim())}</span></span>` : ''}
      <p class="diary-read">${esc(e.text)}</p>
      ${linked && p ? `<div class="nwin nlink" style="${tint(p.color)}" role="note" aria-label="Linked note: ${esc(linked.name)}">${winBar(linked.name, p.face)}</div>` : ''}
      <div id="diary-photo" class="diary-photo"></div>
    </div>`);
    if (e.photo) draft.loaded = loadPhotos(day, e.photos ?? 1).then((r) => { if (draft?.day === day && !draft.photos.length) { draft.photos = r.photos; draft.busy = undefined; drawDraftPhoto(); } else r.photos.forEach((p) => URL.revokeObjectURL(p.url)); });
    return;
  }
  openModal(`<form class="panel" id="diary-form" novalidate>${closeX()}
    ${diaryNav(day)}${birthday}
    ${settings().titles ? `<label class="field">Title <input id="diary-title" maxlength="60" autocomplete="off" placeholder="Optional" value="${esc(e?.title ?? '')}"></label>` : ''}
    ${settings().teleportation ? `<label class="field">Location <input id="diary-location" maxlength="80" autocomplete="off" placeholder="Where are you? (optional)" value="${esc(e?.location ?? '')}"></label>` : ''}
    <div class="field"><span>How are you feeling? <span class="muted">(pick up to 2)</span></span>
      <div class="moods" id="diary-moods">${MOOD_KEYS.map((k) =>
        `<button type="button" data-action="diary-mood" data-mood="${k}" aria-pressed="false">${moodSprite(k)}<span>${esc(moodName(k, names()))}</span></button>`).join('')}</div>
      <input id="diary-feeling" maxlength="40" autocomplete="off" placeholder="In your own words (optional)" value="${esc(e?.feeling ?? '')}" aria-label="Your own word for this feeling"></div>
    ${settings().trackamaniac ? `<div class="field"><span>Weather</span>
      <div class="moods" id="diary-weather">${(Object.keys(WEATHER) as Weather[]).map((k) =>
        `<button type="button" data-action="diary-weather" data-weather="${k}" aria-pressed="false">${weatherSvg(k)}<span>${WEATHER[k]}</span></button>`).join('')}</div></div>` : ''}
    ${settings().starry ? `<div class="field"><span>Star this day <span class="muted">(to remember it)</span></span>
      <div class="stars" id="diary-stars">${(['happy', 'sad'] as Star[]).map((k) =>
        `<button type="button" class="btn small" data-action="diary-star" data-star="${k}" aria-pressed="false">${starSvg(k)}<span>${STAR_LABEL[k]}</span></button>`).join('')}</div></div>` : ''}
    <label class="field">Dear diary <textarea id="diary-text" class="diary-text" maxlength="5000" placeholder="What happened today?">${esc(e?.text ?? '')}</textarea></label>
    <div class="field"><span>Link to notes</span><div id="diary-notes" class="diary-notes"></div></div>
    <div class="field"><span>${settings().photographer ? 'Photos' : 'Photo'}</span><div id="diary-photo" class="diary-photo"></div>
      <div class="btns"><button class="btn" type="button" data-action="diary-photo-add">Add photo</button></div>
      <p class="muted" id="diary-photo-hint"></p>
      <input type="file" id="diary-file" accept="image/*" ${settings().photographer ? 'multiple' : ''} hidden></div>
    <p class="form-error" id="diary-error" hidden></p>
    <div class="btns"><button class="btn" type="button" data-action="diary-clear">Clear</button><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div>
  </form>`);
  markMood();
  drawNoteLink();
  drawDraftPhoto();
  if (e?.photo) draft.loaded = loadPhotos(day, e.photos ?? 1).then((r) => {
    if (draft?.day === day) { draft.photos = r.photos; draft.photoLost = r.lost; draft.busy = undefined; drawDraftPhoto(); } else r.photos.forEach((p) => URL.revokeObjectURL(p.url));
  });
}

async function saveDiary() {
  const dr = draft;
  if (!dr) return;
  await dr.loaded;   // don't mistake a photo that is still loading for a removed one
  const text = ($('diary-text') as HTMLTextAreaElement).value.replace(/\s+$/, '');
  const feeling = ($('diary-feeling') as HTMLInputElement).value.replace(/\s+/g, ' ').trim();
  const [mood, mood2] = dr.moods;
  const weather = settings().trackamaniac ? dr.weather : entryOf(dr.day)?.weather;   // the weather stays put while Meteorokinesis is off
  const title = settings().titles ? ($('diary-title') as HTMLInputElement).value.replace(/\s+/g, ' ').trim() : entryOf(dr.day)?.title;   // titles and stars stay put while their option is off
  const location = settings().teleportation ? ($('diary-location') as HTMLInputElement).value.replace(/\s+/g, ' ').trim() : entryOf(dr.day)?.location;   // stays put while Teleportation is off
  const star = settings().starry ? dr.star : entryOf(dr.day)?.star;
  const note = dr.note;
  const keep = !!dr.photoLost && !dr.touched;   // a photo that could not be read stays as it is
  const count = keep ? entryOf(dr.day)?.photos ?? 1 : dr.photos.length;
  if (settings().photographer && !keep && count === 3) {
    const err = $('diary-error');
    err.textContent = 'A page has 1, 2 or 4 photos. Add one more or remove one.';
    err.hidden = false;
    return;
  }
  const empty = !text.trim() && !title && !mood && !feeling && !weather && !star && !note && !location && !count;
  const entry: DiaryEntry | null = empty ? null
    : { text, ...(title && { title }), ...(location && { location }), mood, ...(mood2 && { mood2 }), ...(feeling && { feeling }), ...(weather && { weather }), ...(star && { star }), ...(note && { note }), ...(count > 1 && { photos: count }), photo: count > 0, updated: Date.now() };
  if (!await saveEntry(dr.day, entry, keep ? 'keep' : dr.photos.map((p) => p.blob))) {
    const err = $('diary-error');
    err.textContent = "Couldn't store this page on the device. Try again.";
    err.hidden = false;
    return;
  }
  closeModal();
  toast(entry ? 'Diary page saved.' : 'Diary page cleared.');
  if (entry?.text.trim()) openDiary(dr.day);   // back to the page, now read-only
}

// ---- the month's reflection ----
function openReflection() {
  const { y, m } = month();
  const r = reflectionOf(monthKey(y, m));
  openModal(`<form class="panel dform" id="reflect-form" novalidate>${closeX()}
    <h3>Reflection</h3><p class="muted">${esc(fullMonth(y, m))}</p>
    <label class="field">How was the month? <textarea id="reflect-text" class="reflect-area" maxlength="5000" placeholder="What went well? What was hard? What do you want to do differently next month?">${esc(r?.text ?? '')}</textarea></label>
    <p class="form-error" id="reflect-error" hidden></p>
    <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
}
async function submitReflection() {
  const { y, m } = month();
  const text = ($('reflect-text') as HTMLTextAreaElement).value;
  if (!await saveReflection(monthKey(y, m), text)) { const err = $('reflect-error'); err.textContent = "Couldn't store this on the device. Try again."; err.hidden = false; return; }
  closeModal();
  toast(text.trim() ? 'Reflection saved.' : 'Reflection cleared.');
}

// ---- birthdays ----
const dayMonthText = (p: Person) => `${p.day} ${MONTH_NAMES[p.month - 1]}${p.year !== undefined ? ` ${p.year}` : ''}`;
function openPeople() {
  const list = upcoming(people(), today(), MAX_PEOPLE);
  openModal(`<div class="panel">${closeX()}<h3>Birthdays</h3>
    ${list.length ? `<ul class="dlist">${list.map(({ person: p, in: n, turning: age }) =>
      `<li><span class="who"><b>${esc(p.name)}</b><span class="muted">${dayMonthText(p)} · ${whenText(n)}${age !== null ? ` · turns ${age}` : ''}${p.note ? ` · ${esc(p.note)}` : ''}</span></span>
        <button class="btn small" type="button" data-action="person-edit" data-id="${esc(p.id)}">Edit</button></li>`).join('')}</ul>` : '<p class="muted">No birthdays yet.</p>'}
    <div class="btns"><button class="btn" type="button" data-action="modal-close">Close</button><button class="btn primary" type="button" data-action="person-add">+ Add</button></div></div>`);
}

function openPerson(p?: Person, errors: Record<string, string> = {}, keep?: Partial<Record<string, string>>) {
  const v = (k: string, d: string) => keep?.[k] ?? d;
  const month = Number(v('month', String(p?.month ?? ''))) || 0;
  const err = (k: string) => (errors[k] ? `<span class="form-error">${esc(errors[k])}</span>` : '');
  openModal(`<form class="panel dform" id="person-form" data-id="${esc(p?.id ?? '')}" novalidate>${closeX()}
    <h3>${p ? 'Edit birthday' : 'Add birthday'}</h3>
    <label class="field">Name <input name="name" maxlength="40" autocomplete="off" value="${esc(v('name', p?.name ?? ''))}">${err('name')}</label>
    <div class="row">
      <label class="field">Month <select name="month"><option value="">–</option>${MONTH_NAMES.map((n, i) => `<option value="${i + 1}" ${month === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select>${err('month')}</label>
      <label class="field">Day <input name="day" inputmode="numeric" maxlength="2" autocomplete="off" value="${esc(v('day', String(p?.day ?? '')))}">${err('day')}</label>
      <label class="field">Year <input name="year" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="optional" value="${esc(v('year', p?.year === undefined ? '' : String(p.year)))}">${err('year')}</label>
    </div>
    <label class="field">Note <input name="note" maxlength="200" autocomplete="off" placeholder="optional" value="${esc(v('note', p?.note ?? ''))}">${err('note')}</label>
    <div class="btns">${p ? '<button class="btn" type="button" data-action="person-delete">Delete</button>' : ''}<button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
}

async function submitPerson(form: HTMLFormElement) {
  const f = (k: string) => (form.elements.namedItem(k) as HTMLInputElement).value;
  const year = f('year').trim();
  const input = { name: f('name'), month: Number(f('month')), day: Number(f('day')), year: year === '' ? null : Number(year), note: f('note') };
  const id = form.dataset.id ?? '';
  const existing = people().find((p) => p.id === id);
  const errors = personErrors(input, dateOf(today()).getUTCFullYear());
  if (!existing && people().length >= MAX_PEOPLE) errors.name = `That is the most birthdays (${MAX_PEOPLE}).`;
  if (Object.keys(errors).length) { openPerson(existing, errors, { name: f('name'), month: f('month'), day: f('day'), year: f('year'), note: f('note') }); return; }
  const person = personFrom(input, existing?.id ?? (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`));
  const next = existing ? people().map((p) => (p.id === id ? person : p)) : [...people(), person];
  if (!await updateExtras({ people: next })) { toast("Couldn't store that on the device. Try again."); return; }
  closeModal();
  toast(existing ? 'Birthday saved.' : 'Birthday added.');
}

// ---- events ----
onShown('diary', 'toggle', (ev) => {
  const el = ev.target as HTMLDetailsElement;
  if (el.id === 'bday-fold') bdayOpen = el.open;
  if (el.id === 'mem-fold') memOpen = el.open;
  if (el.id === 'glance-fold') glanceOpen = el.open;
}, true);

onShown('diary', 'click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  const a = btn.dataset.action;
  switch (a) {
    case 'diary-month': {
      const d = month(), n = new Date(Date.UTC(d.y, d.m + Number(btn.dataset.step), 1));
      if (n.getUTCFullYear() * 12 + n.getUTCMonth() > nowMonth()) break;   // never into a month that hasn't happened
      ym = { y: n.getUTCFullYear(), m: n.getUTCMonth() };
      renderBody();
      break;
    }
    case 'legend-open': openLegend(); break;
    case 'diary-today': ym = null; renderBody(); break;
    case 'picker-open': picker = { year: month().y }; drawPicker('month'); break;
    case 'picker-years': drawPicker('year'); break;
    case 'picker-year': if (picker) { picker.year = Number(btn.dataset.y); drawPicker('month'); } break;
    case 'picker-month': {
      const p = picker, mm = Number(btn.dataset.m);
      if (!p || p.year * 12 + mm > nowMonth()) break;
      ym = { y: p.year, m: mm };
      closeLayer(); renderBody();
      break;
    }
    case 'layer-close': if (ev.target === btn || btn.tagName === 'BUTTON') closeLayer(); break;
    case 'modal-close': if (ev.target === btn || btn.tagName === 'BUTTON') closeModal(); break;
    case 'diary-open': openDiary(Number(btn.dataset.day)); break;
    case 'diary-edit': if (draft) openDiary(draft.day, true); break;
    case 'diary-go': if (!btn.hasAttribute('disabled')) openDiary(Number(btn.dataset.day)); break;
    case 'diary-mood':
      if (draft) {
        const k = btn.dataset.mood as Mood, ms = draft.moods;
        draft.moods = ms.includes(k) ? ms.filter((x) => x !== k) : [...ms, k].slice(-2);   // a third pick replaces the oldest
        markMood();
      }
      break;
    case 'diary-weather':
      if (draft) { draft.weather = draft.weather === btn.dataset.weather ? undefined : (btn.dataset.weather as Weather); markMood(); }
      break;
    case 'diary-star': if (draft) { draft.star = draft.star === btn.dataset.star ? undefined : (btn.dataset.star as Star); markMood(); } break;
    case 'diary-note': if (draft) { draft.note = draft.note === btn.dataset.name ? undefined : btn.dataset.name; drawNoteLink(); } break;
    case 'diary-photo-add': $('diary-file').click(); break;
    case 'diary-photo-remove':
      if (draft) {
        const [gone] = draft.photos.splice(Number(btn.dataset.i), 1);
        if (gone) URL.revokeObjectURL(gone.url);
        draft.touched = true; draft.photoLost = false;
        drawDraftPhoto();
      }
      break;
    case 'diary-clear':
      openLayer(`<h3>Clear this page?</h3>
        <p>This empties the title, location, text, feelings, weather, star, linked note and photo on this diary page. Nothing is deleted until you press Save, so closing the page without saving keeps it as it was.</p>
        <div class="btns"><button class="btn" type="button" data-action="layer-close" data-focus>Cancel</button><button class="btn primary" type="button" data-action="diary-clear-yes">Clear</button></div>`, 'Clear this page?');
      break;
    case 'diary-clear-yes':
      closeLayer();
      ($('diary-text') as HTMLTextAreaElement).value = '';
      ($('diary-feeling') as HTMLInputElement).value = '';
      for (const id of ['diary-title', 'diary-location']) { const t = document.getElementById(id) as HTMLInputElement | null; if (t) t.value = ''; }
      if (draft) { draft.moods = []; draft.weather = undefined; draft.star = undefined; draft.note = undefined; drawNoteLink(); draft.photoLost = false; draft.touched = true; markMood(); revokePhotos(); draft.photos = []; drawDraftPhoto(); }
      break;
    case 'reflect-edit': openReflection(); break;
    case 'people-open': openPeople(); break;
    case 'person-add': openPerson(); break;
    case 'person-edit': openPerson(people().find((p) => p.id === btn.dataset.id)); break;
    case 'person-delete':
      openLayer(`<h3>Delete this birthday?</h3><div class="btns"><button class="btn" type="button" data-action="layer-close" data-focus>Keep</button><button class="btn primary" type="button" data-action="person-delete-yes">Delete</button></div>`, 'Delete this birthday?');
      break;
    case 'person-delete-yes': {
      const id = document.getElementById('person-form')?.dataset.id;
      closeLayer();
      updateExtras({ people: people().filter((p) => p.id !== id) }).then((ok) => { if (ok) { closeModal(); toast('Birthday deleted.'); } else toast("Couldn't store that on the device. Try again."); });
      break;
    }
  }
});

onShown('diary', 'submit', (ev) => {
  ev.preventDefault();
  const form = ev.target as HTMLFormElement;
  if (form.id === 'diary-form') saveDiary();
  else if (form.id === 'reflect-form') submitReflection();
  else if (form.id === 'person-form') submitPerson(form);
});

onShown('diary', 'change', async (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'diary-note-pick') { if (draft && t.value) { draft.note = t.value; drawNoteLink(); } return; }
  if (t.id !== 'diary-file') return;
  const d = draft;
  const files = [...(t.files ?? [])].slice(0, d ? maxPhotos() - d.photos.length : 0);
  t.value = '';
  if (!files.length || !d) return;
  const err = $('diary-error');
  err.hidden = true;
  d.busy = files.length > 1 ? 'Shrinking photos…' : 'Shrinking photo…';
  drawDraftPhoto();
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));   // let the bar paint before the heavy work
  for (const f of files) {
    try {
      const blob = await compressPhoto(f);
      if (draft !== d) return;   // the page was closed meanwhile
      d.photos.push({ blob, url: URL.createObjectURL(blob) });
      d.touched = true; d.photoLost = false;
    } catch { err.textContent = "Couldn't read that photo. Try a different one."; err.hidden = false; }
  }
  if (draft === d) { d.busy = undefined; drawDraftPhoto(); }
});

// ---- start ----
onDiary(() => { if (!document.getElementById('diary-modal')?.innerHTML) renderBody(); });   // not while a page is being written
onAppShown('diary', () => { ym = null; renderTop(); renderBody(); });
renderTop();
renderBody();
diaryInitialised.then(renderBody);
