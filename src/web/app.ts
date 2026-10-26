// Phone playtest build of Habit Kitty. Bundled into one HTML page by `npm run build:web`.
import {
  CONFIG, newState, adoptCat, feedCat, startSitter, resumeCat, settleAll, addMindfulTask,
  doMindfulTask, setTaskDay, genderOf, daysUntilReady, removeMindfulTask, returnToShelter, habitToCat, dayIndex, dayStartHour, setDayStart, nextReset, levelProgress, hunger, sitterCooldownLeft,
  type ActionResult, type AppState, type Cat, type CatMode, type CatGender, type CatLook, type CatTrait, type GameEvent, type MindfulTask, type Reason, type TaskKind,
} from '../rules.ts';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { anyReminder, defaultReminder, planReminders, type LastCall, type ReminderSettings } from '../reminders.ts';
import { allCatsDiary, catDiary, clock } from '../catdiary.ts';
import { fedMessage } from '../encourage.ts';
import { achievements } from '../achievements.ts';
import { entriesSince, parseChangelog, type ChangeEntry } from '../changelog.ts';
import { VERSION } from '../version.ts';
import CHANGELOG_MD from '../../CHANGELOG.md';
import { pickThought, type ThoughtKind } from '../thoughts.ts';
import {
  PHOTO_MAX_BYTES, PHOTO_MAX_SIDE, dayFromName, diaryPath, entryFromMarkdown, entryToMarkdown, isZip, packBackup, photoPath, unpackBackup,
  type Backup, type DiaryEntry, type Mood,
} from '../store.ts';
import { CONFETTI_COLORS, TRAITS, notifyIconName, TRAIT_TEXT, BODY_H, BODY_W, FACE_W, NAP_H, NAP_W, bodySvg, faceSvg, miniSvg, napSvg, lookOf, popperSvg, randomLook, type Face } from '../pixelcat.ts';
import { BOOK_ART, FOODS, MARKS, ROOM_H, ROOM_W, TROPHY_ART, artSvg, heartSvg, iconSvg, markSvg, roomSvg } from '../pixelart.ts';
import { dateOf, dayOf, firstDay, habitStreak, monthGrid, streak, weekRow, type DayKind, type Trackable } from '../calendar.ts';

// ===================== Save =====================
interface LogLine { at: number; text: string }
interface Save {
  v: 1; state: AppState; offsetHours: number; log: LogLine[]; savedAt: number; logHidden?: boolean; unlimited?: boolean; roomName?: string; allowRename?: boolean; showClock?: boolean;
  diary?: Record<string, DiaryEntry>;   // in memory only: each page lives in its own file (see "Diary files")
  reminder?: ReminderSettings;
  returned?: Record<string, number>;   // cat id -> day it last came home (feeds the "welcome back" thoughts)
  timeTravel?: boolean;                // lets treats and kibbles be marked done on past days
  achieved?: Record<string, number>;   // achievement id -> day it was unlocked
  seenVersion?: string;                // last app version whose change log was shown
  sound?: Partial<Record<SoundKind, number>>;   // volume per sound, 0..100 (see SOUND_DEFAULTS)
  dayStart?: number;                   // hour the day starts (and the one before ends), 0..CONFIG.dayStartMax; CONFIG.resetHour when unset
}

const KEY = 'habit-kitty-save-v1';
const fresh = (): Save => ({ v: 1, state: newState(), offsetHours: 0, log: [], savedAt: 0, achieved: {}, seenVersion: VERSION });

function readLocal(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Older saves: every mindful item was a repeating habit with no history.
function normalize(sv: Save): Save {
  setDayStart(sv.dayStart);   // every day index from here on, this one included, follows the save's day start
  const day = dayIndex(new Date(Date.now() + (Number(sv.offsetHours) || 0) * 3_600_000));
  const tasks = (sv.state.tasks ?? []).map((k) => {
    const kind: TaskKind = k.kind ?? 'habit';
    const doneDays = k.doneDays ?? (k.lastDoneDay === null || k.lastDoneDay === undefined ? [] : [k.lastDoneDay]);
    return {
      ...k, kind, doneDays,
      xp: Math.min(kind === 'task' ? CONFIG.taskMaxXp : CONFIG.habitMaxXp, k.xp),
      createdDay: k.createdDay ?? doneDays[0] ?? day,
    };
  });
  return { ...sv, state: { ...sv.state, tasks } };
}

let save: Save = normalize(readLocal() ?? fresh());

// Optional account sync: only viewers who can write their own data get it.
type DocRef = { get(): Promise<{ exists: boolean; data(): unknown }>; set(d: object): Promise<void> };
let remote: DocRef | null = null;
let writing: Promise<void> = Promise.resolve();

// The game part of a save. Until the diary has been moved into files, the old copy in localStorage is kept so nothing is lost.
let diaryReady = false;
const gameOnly = (): Save => { const { diary, ...game } = save; return diaryReady ? game : save; };

function persist() {
  save.savedAt = Date.now();
  queueReminderSync();
  try { localStorage.setItem(KEY, JSON.stringify(gameOnly())); } catch { /* private mode: keep playing in memory */ }
  if (remote) {
    const ref = remote;
    const body = JSON.parse(JSON.stringify(gameOnly()));
    writing = writing.then(() => ref.set(body)).catch(() => { remote = null; renderSaved(); });
  }
}

async function connectAccount() {
  const claude = (window as any).claude;
  if (!claude?.use) return;
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  const id = await user?.id?.();
  if (!db || !id) return;
  try {
    const ref: DocRef = db.doc(`data/users/${id}/save`);
    const snap = await ref.get();
    const theirs = snap.exists ? (snap.data() as Save) : null;
    if (theirs?.state && theirs.savedAt > save.savedAt) {
      save = normalize({ ...theirs, diary: save.diary });
      try { localStorage.setItem(KEY, JSON.stringify(gameOnly())); } catch { /* ignore */ }
    }
    remote = ref;
    if (!theirs || theirs.savedAt < save.savedAt) persist();
    renderAll();
  } catch { remote = null; }
}

// ===================== Clock =====================
const now = () => new Date(Date.now() + save.offsetHours * 3_600_000);
const today = () => dayIndex(now());

// ===================== Helpers =====================
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const catName = (id: string) => save.state.cats.find((c) => c.id === id)?.name ?? 'Your cat';
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtDay = (day: number) =>
  dateOf(day).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const hourText = (h: number) => `${String(h).padStart(2, '0')}:00`;
const dayRuleText = (h = dayStartHour()) => (h === 0 ? 'A day runs from midnight to midnight.' : `A day runs from ${hourText(h)} to ${hourText(h)} the next day.`);

function eventText(e: GameEvent): string {
  const n = catName(e.catId);
  switch (e.type) {
    case 'starved': return `${n} went hungry (${plural(e.missed, 'missed day')} in a row).`;
    case 'died': return `${n} died after 3 days without food.`;
    case 'ranAway': return `${n} ran away. Do the habit to win them back.`;
    case 'leftWithSitter': return `${n} stayed with the sitter for good.`;
    case 'returned': return `${n} came back home!`;
    case 'leftForever': return `${n} left for good this time.`;
  }
}

function reasonText(r: Reason, cat?: Cat): string {
  const n = cat?.name ?? 'This cat';
  switch (r) {
    case 'invalid_input': return 'Give your cat a name and a habit.';
    case 'already_fed_today': return `${n} is already fed today. The next day starts at ${hourText(dayStartHour())}.`;
    case 'with_sitter': return `${n} is with the sitter. Bring them home first.`;
    case 'already_with_sitter': return `${n} is already with the sitter.`;
    case 'not_with_sitter': return `${n} isn't with the sitter.`;
    case 'sitter_cooldown':
      return `${n} can visit the sitter once every ${CONFIG.sitterCooldownDays} days. ` +
        `${plural(cat ? sitterCooldownLeft(cat, today()) : 0, 'day')} to go.`;
    case 'low_affection_cat_limit':
      return 'Your affection is below 0, so cats only trust you with one at a time. Feed your cat or do treats and kibbles to earn it back.';
    case 'future_day': return "That day hasn't happened yet.";
    case 'task_on_cooldown': return 'You did this one recently. It comes back after its repeat time.';
    case 'task_already_done': return 'This kibble is already done. Press and hold it to delete it.';
    case 'not_daily_habit': return 'Only daily habits can become a kitty.';
    case 'cat_limit': return `You can keep ${CONFIG.maxCats} kitties. Turn on Unlimited kitties in Settings if you really want more.`;
    case 'cat_not_active': return `${n} isn't here anymore.`;
    case 'no_such_cat': case 'no_such_task': return 'That no longer exists.';
  }
}

function logEvents(events: GameEvent[]) {
  const at = now().getTime();
  for (const e of events) {
    save.log.unshift({ at, text: eventText(e) });
    if (e.type === 'returned') save.returned = { ...save.returned, [e.catId]: today() };
  }
  if (events.length) save.logHidden = false;
  save.log = save.log.slice(0, 8);
}

let toastTimer = 0;
function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 3200);
}

// Settle elapsed days, then apply an action; logs events and persists.
function act(fn: (s: AppState, at: Date) => ActionResult, success: string | (() => string), cat?: Cat): boolean {
  const r = fn(save.state, now());
  save.state = r.state;
  logEvents(r.events);
  persist();
  renderAll();
  toast(r.ok ? (typeof success === 'function' ? success() : success) : reasonText(r.reason, cat));
  return r.ok;
}

function settle() {
  const r = settleAll(save.state, now());
  save.state = r.state;
  if (!r.events.length) return;
  logEvents(r.events);
  persist();
}

// ===================== Pixel cats =====================
const sprite = faceSvg;
const lookFor = lookOf;
const hash = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Pixel heart for petting.
const HEART = heartSvg();

document.documentElement.style.setProperty('--face-w', String(FACE_W));   // the cat card's picture column follows the art

// Static buttons in the page template name their icon with data-icon; draw them on the same pixel grid.
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', el.dataset.icon === 'cat' ? miniSvg('happy', { fur: '#ffb3cf', pattern: 'plain' }) : iconSvg(el.dataset.icon ?? 'x')));

// ===================== Food =====================
const FOOD_KEYS = Object.keys(FOODS);
const pixelArt = (art: string[], cls = '') => artSvg(art, `pixart ${cls}`);
// A different treat for every cat, every day (stable within the day).
const foodFor = (c: Cat, day: number) => FOOD_KEYS[hash(`${c.id}:${day}`) % FOOD_KEYS.length];
const foodIcon = (kind: string) => artSvg(FOODS[kind], 'food');

// ===================== Rendering =====================
const viewMonth = new Map<string, number>();   // cat id -> months back from current

// Level up: a pixel party popper bursts into confetti.
let lastLevel: number | null = null;
function celebrate(level: number) {
  toast(`Level ${level}! Your kitties are proud of you.`);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const party = document.createElement('div');
  party.className = 'party';
  party.setAttribute('aria-hidden', 'true');
  const piece = (i: number) => {
    const a = (-80 + Math.random() * 140) * (Math.PI / 180);   // fan out up and to the right of the cone's mouth
    const d = 90 + Math.random() * 150;
    return `<i style="--c:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};--x:${Math.round(Math.sin(a) * d)}px;--y:${Math.round(-Math.cos(a) * d)}px;--r:${Math.round(Math.random() * 360)}deg;--w:${Math.round(Math.random() * 120)}ms"></i>`;
  };
  party.innerHTML = `<div class="popper">${popperSvg()}</div>${Array.from({ length: 36 }, (_, i) => piece(i)).join('')}`;
  document.body.appendChild(party);
  setTimeout(() => party.remove(), 2800);
}

// ---- dark mode: follows the device until the toggle is used, then remembers the choice on this device ----
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : systemDark();
try { const t = localStorage.getItem('hk-theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; } catch { /* storage blocked: follow the device */ }
function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('hk-theme', next); } catch { /* not remembered */ }
  renderTop();
}

function renderTop() {
  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(save.state.xp);
  if (lastLevel !== null && level > lastLevel) celebrate(level);
  lastLevel = level;
  const filled = save.state.xp < 0 ? 0 : Math.round((10 * xpIntoLevel) / xpForNextLevel);
  const bar = Array.from({ length: 10 }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
  $('top').innerHTML = `
    <div class="brand"><h1>Habit <span>Kitty</span></h1>
      <div class="brand-r"><span class="muted">Level <b class="num">${level}</b></span>
        <button class="gear" type="button" data-action="theme-toggle" aria-label="${isDark() ? 'Switch to light mode' : 'Switch to dark mode'}">${iconSvg(isDark() ? 'sun' : 'moon')}</button>
        <button class="gear" type="button" data-action="settings-toggle" aria-label="Settings" aria-pressed="${tab === 'settings'}">${iconSvg('gear')}</button></div></div>
    <div class="meter">
      <div class="meter-row"><span>Affection <b>${save.state.xp}</b> XP</span>
        <span class="muted num">${xpIntoLevel}/${xpForNextLevel} to level ${level + 1}</span></div>
      <div class="bar" role="img" aria-label="${xpIntoLevel} of ${xpForNextLevel} XP to the next level">${bar}</div>
    </div>
    ${save.state.xp < CONFIG.lowXpThreshold
      ? '<p class="distrust">Your affection is below 0. Until it recovers, you can only keep one cat.</p>' : ''}`;
}

function renderLog() {
  const el = $('log');
  el.hidden = !save.log.length || !!save.logHidden;
  el.innerHTML = `<button class="x" type="button" data-action="log-close" aria-label="Close update">${iconSvg('x')}</button>
    <h2>Update · what happened</h2><ul style="list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;font-size:18px">${save.log.map((l) =>
    `<li><time class="muted num" style="font-size:15px;margin-right:8px">${new Date(l.at).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</time>${esc(l.text)}</li>`).join('')}</ul>`;
}

function catStatus(c: Cat, t: number): { face: Face; faded: boolean; chip: DayKind; label: string; note?: string } {
  const fate = c.mode === 'classic' ? 'dies' : 'runs away';
  switch (c.status) {
    case 'alive': {
      const h = hunger(c, t);
      if (h === 'fed') return { face: 'happy', faded: false, chip: 'fed', label: 'Fed today' };
      if (h === 'peckish') return { face: 'open', faded: false, chip: 'today', label: 'Waiting for today' };
      if (h === 'hungry') return { face: 'sad', faded: false, chip: 'missed', label: 'Hungry · missed 1 day' };
      return { face: 'starving', faded: false, chip: 'missed', label: 'Starving · missed 2 days',
        note: `Miss today too and ${c.name} ${fate}.` };
    }
    case 'sitter': {
      const day = t - (c.sitterStartDay ?? t) + 1;
      return { face: 'sleepy', faded: false, chip: 'sitter', label: `With the sitter · day ${Math.min(day, 7)} of 7`,
        note: day >= 7 ? `Last day: bring ${c.name} home today or they stay with the sitter.` : undefined };
    }
    case 'ranAway': return { face: 'open', faded: true, chip: 'none', label: 'Ran away',
      note: `Do your habit to bring ${c.name} back. This only works once.` };
    case 'dead': return { face: 'dead', faded: false, chip: 'none', label: `Died ${c.endedDay ? fmtDay(c.endedDay) : ''}` };
    case 'leftForever': return { face: 'open', faded: true, chip: 'none', label: 'Left for good' };
    case 'shelter': return { face: 'open', faded: true, chip: 'none', label: 'Returned to the shelter' };
    case 'gone': return { face: 'sleepy', faded: true, chip: 'none', label: 'Stayed with the sitter' };
  }
}

type Subject = Trackable & { id: string; name: string };
const habitSubject = (h: MindfulTask): Subject =>
  ({ id: h.id, name: h.name, fedDays: [], adoptedDay: h.createdDay, sitterTrips: [], endedDay: null, habitDays: h.doneDays, noMiss: true });

function renderMonth(c: Subject, t: number, habit?: MindfulTask): string {
  const back = viewMonth.get(c.id) ?? 0;
  const d = dateOf(t);
  const shown = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  const g = monthGrid(c, shown.getUTCFullYear(), shown.getUTCMonth(), t);
  const cells = [
    ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`),
    ...Array.from({ length: g.lead }, () => '<div class="px blank"></div>'),
    ...g.days.map((x) => `<div class="px ${x.kind}${x.day === t ? ' now' : ''}" title="${fmtDay(x.day)}: ${x.kind}"><span>${x.date}</span></div>`),
  ].join('');
  const pct = g.tracked ? Math.round((100 * g.count.fed) / g.tracked) : 0;
  const stats = habit
    ? `Done <b class="num">${g.count.habit}</b> ${g.count.habit === 1 ? 'day' : 'days'} this month` +
      (back === 0 && habit.cooldownDays === 1 ? ` · streak <b class="num">${habitStreak(habit.doneDays, t)}</b>` : '')
    : g.tracked
    ? `Fed <b class="num">${g.count.fed}/${g.tracked}</b> days (${pct}%)` +
      (g.count.sitter ? ` · ${plural(g.count.sitter, 'day')} with the sitter` : '') +
      (g.count.habit ? ` · ${g.count.habit} done as a habit` : '') +
      (back === 0 && (c as Partial<Cat>).status === 'alive' ? ` · streak <b class="num">${streak(c as Cat, t)}</b>` : '')
    : g.count.sitter ? 'With the sitter all month' : g.count.habit ? `Done <b class="num">${g.count.habit}</b> days as a habit` : 'Nothing tracked this month';
  const firstMonth = dateOf(firstDay(c));
  const atStart = shown.getUTCFullYear() * 12 + shown.getUTCMonth() <= firstMonth.getUTCFullYear() * 12 + firstMonth.getUTCMonth();
  return `<div class="month">
    <div class="month-nav">
      <button type="button" data-action="month" data-id="${c.id}" data-step="1" ${atStart ? 'disabled' : ''} aria-label="Previous month">${iconSvg('prev')}</button>
      ${monthTitle(c.id, shown.getUTCFullYear(), shown.getUTCMonth(), g.title, firstMonth.getUTCFullYear() * 12 + firstMonth.getUTCMonth())}
      <button type="button" data-action="month" data-id="${c.id}" data-step="-1" ${back === 0 ? 'disabled' : ''} aria-label="Next month">${iconSvg('next')}</button>
    </div>
    <div class="grid" role="img" aria-label="${esc(c.name)}, ${g.title}: ${habit ? `done ${g.count.habit} days` : `fed ${g.count.fed} of ${g.tracked} days`}">${cells}</div>
    <p class="stats">${stats}</p>
  </div>`;
}

const isActive = (c: Cat) => ['alive', 'sitter', 'ranAway'].includes(c.status);
const HEAT_HIDDEN = ['dead', 'ranAway', 'shelter'];   // cats that are gone drop off the heatmap
const heatCats = () => sortedCats().filter((c) => !HEAT_HIDDEN.includes(c.status));
const sortedCats = () => [...save.state.cats].sort((a, b) => Number(!isActive(a)) - Number(!isActive(b)));

function renderWeek(c: Subject | Cat, t: number): string {
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return `<div class="week" role="img" aria-label="${esc(c.name)} this week">${weekRow(c, t).map((x, i) =>
    `<div title="${fmtDay(x.day)}: ${x.kind}"><span class="dot ${x.kind}${x.day === t ? ' now' : ''}"></span>${names[i]}</div>`).join('')}</div>`;
}

// ---- Today tab: Home / Sitter / Memories ----
type TodayView = 'home' | 'sitter' | 'memories';
let todayView: TodayView = 'home';
const viewOf = (c: Cat): TodayView => (c.status === 'alive' ? 'home' : c.status === 'sitter' ? 'sitter' : 'memories');

// Condensed all-time heatmap, GitHub style: one column per week, a block per month with its own label.
function renderLife(c: Cat, t: number): string {
  const start = firstDay(c);
  const end = c.endedDay ?? t;   // departure day, inclusive
  const s0 = dateOf(start), e0 = dateOf(end);
  const blocks: string[] = [];
  let fed = 0, missed = 0, y = s0.getUTCFullYear(), m = s0.getUTCMonth();
  while (y * 12 + m <= e0.getUTCFullYear() * 12 + e0.getUTCMonth()) {
    const g = monthGrid(c, y, m, t);
    const cells = [
      ...Array.from({ length: g.lead }, () => '<i class="lc blank"></i>'),
      ...g.days.map((x) => {
        if (x.day < start || x.day > end) return '<i class="lc blank"></i>';
        if (x.kind === 'fed') fed++;
        if (x.kind === 'missed') missed++;
        return `<i class="lc ${x.kind}" title="${fmtDay(x.day)}: ${x.kind}"></i>`;
      }),
    ].join('');
    const month = new Date(Date.UTC(y, m, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
    const label = blocks.length === 0 || m === 0 ? `${month} ${y}` : month;
    blocks.push(`<div class="lm"><span>${label}</span><div class="lg">${cells}</div></div>`);
    if (++m > 11) { m = 0; y++; }
  }
  const tracked = fed + missed;
  return `<div class="life" role="img" aria-label="${esc(c.name)}, all time: fed ${fed} of ${tracked} days">${blocks.join('')}</div>
    <p class="stats">${fmtDay(start)} to ${fmtDay(end)} · fed <b class="num">${fed}/${tracked}</b> days${tracked ? ` (${Math.round((100 * fed) / tracked)}%)` : ''}</p>`;
}

// The face with its feed button, and the name, habit, state and health beside it (Today cards and the long-press menu).
function catHead(c: Cat, t: number, holdable: boolean): string {
  const s = catStatus(c, t);
  const ended = !isActive(c);
  let button = '';
  if (c.status === 'alive') {
    const fed = c.lastFedDay === t;
    button = `<button class="btn primary sq" data-action="feed" data-id="${c.id}" ${fed ? 'disabled' : ''} aria-label="${fed ? `${esc(c.name)} is fed today` : `Feed ${esc(c.name)}`}">${fed ? `<b>${iconSvg('check')}</b>` : foodIcon(foodFor(c, t))}</button>`;
  } else if (c.status === 'sitter') {
    button = `<button class="btn primary sq" data-action="resume" data-id="${c.id}" aria-label="Bring ${esc(c.name)} home"><b>${iconSvg('home')}</b></button>`;
  } else if (c.status === 'ranAway') {
    button = `<button class="btn primary sq" data-action="feed" data-id="${c.id}" aria-label="Call ${esc(c.name)} back">${foodIcon(foodFor(c, t))}</button>`;
  }
  const left = c.status === 'alive' ? 3 - c.missed : 0;
  const hp = `<div class="hp${left === 1 ? ' low' : ''}" role="img" aria-label="health ${left} of 3">${[0, 1, 2].map((i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</div>`;
  return `<div class="cat-head"${holdable ? ` data-hold="cat" data-id="${c.id}"` : ''}><div class="cat-side">${sprite(s.face, lookFor(c), s.faded)}${button}</div>
    <div><p class="cat-name">${esc(c.name)}<span class="mode">${c.mode === 'classic' ? 'classic' : 'light-hearted'} · ${genderOf(c)} · ${lookFor(c).trait}</span></p>
      <p class="cat-habit">${esc(c.habit)}</p>
      <span class="chip ${s.chip}">${s.label}</span>${ended ? '' : hp}</div>
</div>`;
}

function renderCats() {
  const t = today();
  const all = sortedCats();
  const seg = $('today-seg');
  seg.hidden = !all.length;
  const labels: Record<TodayView, string> = { home: 'Home', sitter: 'Sitter', memories: 'Memories' };
  seg.innerHTML = (Object.keys(labels) as TodayView[]).map((v) =>
    `<button type="button" role="tab" data-action="today-view" data-view="${v}" aria-selected="${v === todayView}">${labels[v]} <span class="num">${all.filter((c) => viewOf(c) === v).length}</span></button>`).join('');
  if (!all.length) {
    $('cats').innerHTML = `<div class="cat"><div class="cat-head">${sprite('open', { fur: '#e8a04c', pattern: 'plain' }, true)}
      <div><p class="cat-name">No cats yet</p><p class="cat-habit">Tap Adopt kitty to get your first one.</p></div></div></div>`;
    return;
  }
  const cats = all.filter((c) => viewOf(c) === todayView);
  if (todayView === 'memories') cats.sort((a, b) => Number(b.status === 'ranAway') - Number(a.status === 'ranAway') || (b.endedDay ?? 0) - (a.endedDay ?? 0));
  if (!cats.length) {
    const msg = { home: 'Nobody is home right now.', sitter: 'No cats with the pet sitter.', memories: 'No cats have left yet.' }[todayView];
    $('cats').innerHTML = `<p class="muted" style="text-align:center;padding:24px 0">${msg}</p>`;
    return;
  }
  $('cats').innerHTML = cats.map((c) => {
    const s = catStatus(c, t);
    const ended = !isActive(c);
    return `<article class="cat${ended ? ' ended' : ''}">
      ${catHead(c, t, c.status === 'ranAway' || !ended)}
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
      ${todayView === 'memories' ? renderLife(c, t) : renderWeek(c, t)}
    </article>`;
  }).join('');
}

function renderCombined(subjects: Subject[], key: string, title: string, keyHtml: string, note: string): string {
  const t = today();
  const back = viewMonth.get(key) ?? 0;
  const d = dateOf(t);
  const shown = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  const grids = subjects.map((c) => monthGrid(c, shown.getUTCFullYear(), shown.getUTCMonth(), t));
  const g0 = grids[0];
  const cols = Math.ceil(Math.sqrt(subjects.length));
  const cells = [
    ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`),
    ...Array.from({ length: g0.lead }, () => '<div class="px blank"></div>'),
    ...g0.days.map((x, i) => `<div class="cell${x.day === t ? ' now' : ''}" style="grid-template-columns:repeat(${cols},1fr)" title="${fmtDay(x.day)}">
      ${grids.map((g) => `<i class="s ${g.days[i].kind}"></i>`).join('')}<span>${x.date}</span></div>`),
  ].join('');
  const first = Math.min(...subjects.map(firstDay));
  const fm = dateOf(first);
  const atStart = shown.getUTCFullYear() * 12 + shown.getUTCMonth() <= fm.getUTCFullYear() * 12 + fm.getUTCMonth();
  return `<article class="cat"><div class="month">
    <div class="month-nav">
      <button type="button" data-action="month" data-id="${key}" data-step="1" ${atStart ? 'disabled' : ''} aria-label="Previous month">${iconSvg('prev')}</button>
      ${monthTitle(key, shown.getUTCFullYear(), shown.getUTCMonth(), g0.title, fm.getUTCFullYear() * 12 + fm.getUTCMonth())}
      <button type="button" data-action="month" data-id="${key}" data-step="-1" ${back === 0 ? 'disabled' : ''} aria-label="Next month">${iconSvg('next')}</button>
    </div>
    <div class="grid" role="img" aria-label="${title}, ${g0.title}">${cells}</div>
    <div class="slice-key" style="grid-template-columns:repeat(${cols},auto)">${keyHtml}</div>
    <p class="stats">${note}</p>
  </div></article>`;
}

const combinedCats = (cats: Cat[], t: number) => renderCombined(cats, 'all', 'All cats',
  cats.map((c, i) => `<span><b class="num">${i + 1}</b>${miniSvg(catStatus(c, t).face, lookFor(c), !isActive(c) && c.status !== 'dead')}${esc(c.name)}</span>`).join(''),
  'Each day is split into one slice per cat, in the order shown above.');

const combinedHabits = (habits: MindfulTask[]) => renderCombined(habits.map(habitSubject), 'all-habits', 'All treats',
  habits.map((h, i) => `<span><b class="num">${i + 1}</b>${esc(h.name)}</span>`).join(''),
  'Each day is split into one slice per habit, in the order shown above.');

const HEAT_LEGEND = `<div class="legend"><span><i class="fed"></i>fed</span><span><i class="habit"></i>done as a habit</span>
  <span><i class="missed"></i>missed</span><span><i class="today"></i>today (outlined)</span><span><i class="sitter"></i>with sitter</span><span><i></i>not tracked</span></div>`;

function renderHeat() {
  const cats = heatCats();
  const habits = save.state.tasks.filter((k) => k.kind === 'habit');
  const habitCards = habits.length ? `<h2>Treats</h2>${combinedHabits(habits)}` : '';
  const body = cats.length ? combinedCats(cats, today()) : '<p class="muted">No living cats to show.</p>';
  $('heat').innerHTML = body + habitCards + HEAT_LEGEND + '<p class="muted" style="text-align:center;font-size:15px">Press and hold a kitty to see just its heatmap.</p>';
}

// ---- cozy room: lives in real time (sky follows the clock, cats wander, sleep at night) ----
// Positions are [x, feet-y] in room pixels (108 x 150); a cat is 28 pixels wide and BODY_H tall, the same pixels as the room.
const PET_W = BODY_W, PET_H = BODY_H;
const SPOTS: [number, number][] = [
  [3, 113], [36, 139], [62, 131], [16, 134], [78, 142], [40, 118],   // cushion, rug, floor
  [77, 58], [71, 84], [78, 112],                                    // cat tree: top, middle, base
];
const NIGHT_SPOTS: [number, number][] = [[3, 113], [36, 139], [78, 112], [62, 131], [16, 134], [78, 142], [77, 58], [71, 84], [40, 118]];
const roomPos = new Map<string, number>(); // cat id -> index into SPOTS
let roomSig = '';
const skyPhase = (): 'day' | 'dusk' | 'night' => {
  const h = now().getHours();
  return h >= 8 && h < 17 ? 'day' : (h >= 6 && h < 8) || (h >= 17 && h < 20) ? 'dusk' : 'night';
};
// Cats go to bed at 10pm and get up at 6am, even though the sky starts to darken at 8pm.
const asleepNow = () => { const h = now().getHours(); return h >= 22 || h < 6; };
// A napping cat is wider than a sitting one, so it is centred on its spot and kept inside the room.
const napLeft = (x: number) => Math.max(0, Math.min(ROOM_W - NAP_W, x + (PET_W - NAP_W) / 2));
const petStyle = ([x, y]: [number, number], nap = false) =>
  `left:calc(${nap ? napLeft(x) : x} * var(--px));top:calc(${y - (nap ? NAP_H : PET_H)} * var(--px));z-index:${Math.round(y)}`;

// Naps: at night every kitty sleeps curled up; by day they doze off now and then (a lazy cat far more than a playful one).
const napUntil = new Map<string, number>();   // cat id -> when a daytime nap ends
const isNapping = (id: string, phase: 'day' | 'dusk' | 'night', asleep = phase === 'night') => asleep || (napUntil.get(id) ?? 0) > Date.now();

const roomBg = roomSvg;

// Cats that are away (sitter, ran away) aren't home, so they aren't in the room.
const homeCats = () => sortedCats().filter((c) => c.status === 'alive').slice(0, SPOTS.length);

function renderRoom() {
  const t = today();
  const phase = skyPhase();
  const pets = homeCats();
  const asleep = asleepNow();
  const faceOf = (c: Cat): Face => (asleep ? 'sleepy' : catStatus(c, t).face);
  const lookKey = (c: Cat) => Object.values(lookFor(c)).join('');
  const sig = phase + (asleep ? 'z' : '') + '|' + pets.map((c) => `${c.id}:${faceOf(c)}:${lookKey(c)}:${c.name}`).join('|');
  renderRoomNote();
  if (sig === roomSig) return;
  roomSig = sig;
  const taken = new Set<number>();
  const spotIdx = (c: Cat, i: number) => {
    let k = roomPos.get(c.id) ?? i;
    while (taken.has(k)) k = (k + 1) % SPOTS.length;
    taken.add(k);
    roomPos.set(c.id, k);
    return k;
  };
  $('room').innerHTML = `<div class="room ${phase}">${roomBg(phase)}${pets.map((c, i) => {
    const pos = asleep ? NIGHT_SPOTS[i] : SPOTS[spotIdx(c, i)];
    const nap = isNapping(c.id, phase, asleep);
    return `<div class="pet${nap ? ' napping' : ''}" data-id="${c.id}" data-fx="${pos[0]}" data-fy="${pos[1]}" data-nap="${nap ? 1 : ''}" data-hold="cat" style="${petStyle(pos, nap)}">${nap ? napSvg(lookFor(c)) : bodySvg(faceOf(c), lookFor(c), hash(c.id))}${nap ? '<b class="zz">z z</b>' : ''}<em>${esc(c.name)}</em></div>`;
  }).join('')}</div>`;
}

// The note under the room shows the time, so it is redrawn every few seconds, not only when the room itself changes.
function renderRoomNote() {
  const clock = now().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  const away = save.state.cats.filter((c) => c.status === 'sitter').length;
  $('room-note').textContent = !homeCats().length
    ? (away ? 'Everyone is with the pet sitter. The room is quiet.' : 'It is quiet in here. Adopt a kitty and they will move in.')
    : `It's ${clock}. ${asleepNow() ? 'Everyone is asleep.' : 'Your cats are making themselves at home.'}${away ? ` ${plural(away, 'cat')} with the sitter.` : ''}`;
}
setInterval(() => { if (tab === 'room') { renderRoom(); renderRoomNote(); } }, 5000);

// How often each personality gets up and goes somewhere (rolled every WANDER_MS).
const MOVE_CHANCE: Record<CatTrait, number> = { playful: 0.4, curious: 0.28, cuddly: 0.18, grumpy: 0.12, shy: 0.1, lazy: 0.04 };
const traitOf = (id: string): CatTrait => {
  const c = save.state.cats.find((k) => k.id === id);
  return c ? (lookFor(c).trait ?? 'curious') : 'curious';
};

// Swap a cat in the room between the sitting sprite and the curled-up napping one, keeping its feet where they were.
function setNap(el: HTMLElement, on: boolean) {
  const c = save.state.cats.find((k) => k.id === el.dataset.id);
  const old = el.querySelector('svg.sprite');
  if (!c || !old) return;
  const tpl = document.createElement('template');
  tpl.innerHTML = on ? napSvg(lookFor(c)) : bodySvg(catStatus(c, today()).face, lookFor(c), hash(c.id));
  old.replaceWith(tpl.content.firstElementChild as Element);
  el.dataset.nap = on ? '1' : '';
  el.classList.toggle('napping', on);
  el.querySelector('.zz')?.remove();
  if (on) el.insertAdjacentHTML('afterbegin', '<b class="zz">z z</b>');
  el.style.top = `calc(${Number(el.dataset.fy) - (on ? NAP_H : PET_H)} * var(--px))`;
  const fx = Number(el.dataset.fx);
  el.style.left = `calc(${on ? napLeft(fx) : fx} * var(--px))`;
}

const NAP_CHANCE: Record<CatTrait, number> = { lazy: 0.12, grumpy: 0.05, cuddly: 0.05, shy: 0.04, curious: 0.02, playful: 0.012 };

function wander() {
  if (tab !== 'room' || asleepNow()) return;
  const els = [...document.querySelectorAll<HTMLElement>('#room .pet')];
  const taken = new Set(els.map((el) => roomPos.get(el.dataset.id ?? '')));
  els.forEach((el) => {
    const id = el.dataset.id ?? '';
    if (el.dataset.nap === '1') {   // asleep: wake up when the nap is over
      if ((napUntil.get(id) ?? 0) <= Date.now()) { napUntil.delete(id); setNap(el, false); }
      return;
    }
    if (el.classList.contains('thinking') || el.classList.contains('zooming')) return;
    if (Math.random() < NAP_CHANCE[traitOf(id)]) {
      napUntil.set(id, Date.now() + (30 + Math.random() * 60) * 1000);
      setNap(el, true);
      return;
    }
    if (Math.random() > MOVE_CHANCE[traitOf(id)]) return;
    const from = roomPos.get(id) ?? 0;
    const free = SPOTS.map((_, i) => i).filter((i) => !taken.has(i));
    if (!free.length) return;
    const to = free[Math.floor(Math.random() * free.length)];
    taken.delete(from); taken.add(to);
    roomPos.set(id, to);
    el.dataset.fx = String(SPOTS[to][0]);
    el.dataset.fy = String(SPOTS[to][1]);
    el.setAttribute('style', petStyle(SPOTS[to]));
    el.classList.add('walking');
    setTimeout(() => el.classList.remove('walking'), 2600);
  });
  queueWidget();
}
const WANDER_MS = 8000;
setInterval(wander, WANDER_MS);

// Zoomies: at dusk and in the night a cat wakes with a burst of energy, races round the room, then curls up again.
const ZOOM_CHANCE: Record<CatTrait, number> = { playful: 0.9, curious: 0.5, cuddly: 0.3, grumpy: 0.25, shy: 0.15, lazy: 0.1 };
let zooming = false;
function zoomies() {
  const phase = skyPhase();
  if (phase === 'day' || tab !== 'room' || document.hidden || zooming || Math.random() > 0.4) return;
  const els = [...document.querySelectorAll<HTMLElement>('#room .pet')].filter((el) => !el.classList.contains('thinking'));
  const el = els[Math.floor(Math.random() * els.length)];
  if (!el || Math.random() > ZOOM_CHANCE[traitOf(el.dataset.id ?? '')]) return;
  zooming = true;
  const home = el.getAttribute('style') ?? '', homeFx = el.dataset.fx ?? '0', homeFy = el.dataset.fy ?? '0', wasNap = el.dataset.nap === '1';
  el.classList.add('zooming', 'walking');
  if (wasNap) setNap(el, false);
  const route = [...SPOTS].sort(() => Math.random() - 0.5).slice(0, 5);
  route.forEach(([x, y], i) => setTimeout(() => { el.dataset.fx = String(x); el.dataset.fy = String(y); el.setAttribute('style', petStyle([x, y])); }, 150 + i * 420));
  setTimeout(() => { el.dataset.fx = homeFx; el.dataset.fy = homeFy; el.setAttribute('style', home); }, 150 + route.length * 420);
  setTimeout(() => {
    el.classList.remove('zooming', 'walking');
    if (wasNap) setNap(el, true);
    zooming = false;
  }, 150 + route.length * 420 + 700);
}
setInterval(zoomies, 7000);

// ---- home-screen widget (Android): the room as three pictures, one per time of day ----
// The native widget (RoomWidgetProvider) picks the file that matches the clock. Cats sit where they are in the room now.
const RoomWidget = registerPlugin<{ refresh(): Promise<void>; pendingTab(): Promise<{ tab: string }> }>('RoomWidget');
const WIDGET_Y = 6, WIDGET_PX = 6;   // crop off the empty ceiling; 6 pixels per room unit

// One thought bubble per hour, so the picture holds still between pushes (the room itself rolls them live).
function widgetThought(phase: 'day' | 'dusk' | 'night') {
  if (phase === 'night') return null;
  let a = today() * 24 + now().getHours();
  const seeded = () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return (a / 4294967296) * 0.12; };   // low rolls: the widget shows one when anyone has someone on their mind
  return pickThought(save.state.cats, today(), save.returned ?? {}, () => true, seeded);
}

function roomPicture(phase: 'day' | 'dusk' | 'night'): string {
  const t = today();
  const thought = widgetThought(phase);
  const cats = homeCats().map((c, i) => {
    const [x, y] = phase === 'night' ? NIGHT_SPOTS[i] : SPOTS[roomPos.get(c.id) ?? i];
    const nap = isNapping(c.id, phase);
    const body = (nap ? napSvg(lookFor(c)) : bodySvg(catStatus(c, t).face, lookFor(c), hash(c.id)))
      .replace('<g class="tail b">', '<g display="none">').replace('<g class="blink">', '<g display="none">')   // no CSS here: show tail frame A only
      .replace('<svg ', `<svg x="${nap ? napLeft(x) : x}" y="${y - (nap ? NAP_H : PET_H)}" width="${nap ? NAP_W : PET_W}" height="${nap ? NAP_H : PET_H}" `);
    const name = `<text x="${x + PET_W / 2}" y="${y + 7}" font-size="7" font-family="Jersey 15, monospace" text-anchor="middle" fill="#5a4380">${esc(c.name)}</text>`;
    const about = thought?.thinker === c.id ? save.state.cats.find((k) => k.id === thought.subject) : undefined;
    let bubble = '';
    if (about && thought) {
      const v = THOUGHT_FACE[thought.kind];
      const bw = 26, bh = 14, bx = x + PET_W / 2 - bw / 2, by = y - PET_H - bh - 4;
      const edge = '#5a4380', R = (rx: number, ry: number, w: number, h: number, f: string) => `<rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="${f}"/>`;
      const mark = markSvg(v.mark).replace('<svg ', `<svg x="${bx + 17}" y="${by + 3}" width="${MARKS[v.mark][0].length}" height="${MARKS[v.mark].length}" `);
      bubble = `<g>${R(bx + 1, by, bw - 2, bh, edge)}${R(bx, by + 1, bw, bh - 2, edge)}${R(bx + 1, by + 1, bw - 2, bh - 2, '#fffafc')}
        ${R(bx + bw / 2 - 1, by + bh, 3, 1, edge)}${R(bx + bw / 2, by + bh + 1, 2, 1, edge)}
        ${miniSvg(v.face, lookFor(about), v.faded).replace('<svg ', `<svg x="${bx + 2}" y="${by + 2}" width="13" height="10" `)}${mark}</g>`;
    }
    return { y, body: body + name + bubble };
  }).sort((a, b) => a.y - b.y).map((c) => c.body).join('');
  const bg = roomBg(phase, 'bg').replace('<svg class="bg"', `<svg x="0" y="0" width="${ROOM_W}" height="${ROOM_H}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${WIDGET_Y} ${ROOM_W} ${ROOM_H - WIDGET_Y}" shape-rendering="crispEdges">${bg}${cats}</svg>`;
}

async function pictureData(svg: string): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = ROOM_W * WIDGET_PX; canvas.height = (ROOM_H - WIDGET_Y) * WIDGET_PX;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png').split(',')[1];
}

let widgetSig = '', widgetTimer = 0;
function queueWidget() {
  if (!Capacitor.isNativePlatform()) return;
  clearTimeout(widgetTimer);
  widgetTimer = window.setTimeout(pushWidget, 3000);
}
async function pushWidget() {
  clearTimeout(widgetTimer);
  const phases = ['day', 'dusk', 'night'] as const;
  const svgs = phases.map(roomPicture);
  const sig = svgs.join('');
  if (sig === widgetSig) return;
  widgetSig = sig;
  try {
    for (const [i, ph] of phases.entries()) {
      await Filesystem.writeFile({ path: `room-widget-${ph}.png`, directory: Directory.Data, data: await pictureData(svgs[i]) });
    }
    await RoomWidget.refresh();
  } catch { widgetSig = ''; /* try again next time */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pushWidget(); else openWidgetTab(); });

// Tapping the widget asks for the Room tab.
async function openWidgetTab() {
  if (!Capacitor.isNativePlatform()) return;
  try { if ((await RoomWidget.pendingTab()).tab === 'room') showTab('room'); } catch { /* no widget plugin */ }
}

// ---- thought bubbles: a cat at home now and then thinks of one that is away or gone ----
// Rolled every few seconds; at most one bubble at a time, with a gap between bubbles and a rest for each thinker.
const THINK_EVERY_MS = 4000, THINK_GAP_MS = 20_000, THINK_REST_MS = 90_000, THINK_SHOW_MS = 5000;
let lastThought = 0;
const thoughtAt = new Map<string, number>();
const THOUGHT_FACE: Record<ThoughtKind, { face: Face; faded: boolean; mark: string }> = {
  away:     { face: 'open',  faded: false, mark: 'dots' },
  returned: { face: 'happy', faded: false, mark: 'heart' },
  passed:   { face: 'open',  faded: true,  mark: 'heart-outline' },
  ranAway:  { face: 'open',  faded: true,  mark: 'question' },
};

function think() {
  if (tab !== 'room' || document.hidden || asleepNow() || document.querySelector('#room .thought')) return;
  const t = Date.now();
  if (t - lastThought < THINK_GAP_MS) return;
  const pick = pickThought(save.state.cats, today(), save.returned ?? {}, (id) => t - (thoughtAt.get(id) ?? 0) > THINK_REST_MS);
  const el = pick && document.querySelector<HTMLElement>(`#room .pet[data-id="${pick.thinker}"]`);
  const about = pick && save.state.cats.find((c) => c.id === pick.subject);
  if (!pick || !el || !about || el.dataset.nap === '1') return;
  lastThought = t;
  thoughtAt.set(pick.thinker, t);
  const v = THOUGHT_FACE[pick.kind];
  const bubble = document.createElement('div');
  bubble.className = 'thought';
  bubble.setAttribute('aria-hidden', 'true');
  bubble.innerHTML = miniSvg(v.face, lookFor(about), v.faded) + markSvg(v.mark);
  el.classList.add('thinking');
  el.style.zIndex = '300';
  el.appendChild(bubble);
  setTimeout(() => { bubble.remove(); el.classList.remove('thinking'); }, THINK_SHOW_MS);
}
setInterval(think, THINK_EVERY_MS);

// ===================== Sound =====================
// Strawberry Walk loops in the background, kitties in the room meow now and then, and a petted kitty may purr or meow.
// Browsers only play sound after the first tap or key press, so the music starts then. It pauses while the app is hidden.
declare const __SOUNDS__: Record<SoundKind, string>;   // file paths in the app, data URLs on the website (web/build.js)
type SoundKind = 'bgm' | 'meow' | 'purr';
const SOUND_DEFAULTS: Record<SoundKind, number> = { bgm: 40, meow: 70, purr: 70 };
const PET_MEOW = 0.1, PET_PURR = 0.4;                  // chances when petted: a meow, else a purr, else quiet
const MEOW_EVERY_MS = 15_000, MEOW_CHANCE = 0.12;      // a random meow about every two minutes in the room
const volumeOf = (k: SoundKind) => Math.min(100, Math.max(0, save.sound?.[k] ?? SOUND_DEFAULTS[k]));
let soundOk = false;
let music: HTMLAudioElement | null = null;
let purring: HTMLAudioElement | null = null;

function syncMusic() {
  const v = volumeOf('bgm') / 100;
  if (!soundOk || !v || document.hidden) { music?.pause(); return; }
  if (!music) { music = new Audio(__SOUNDS__.bgm); music.loop = true; }
  music.volume = v;
  if (music.paused) music.play().catch(() => { /* not allowed yet: the next tap tries again */ });
}

function playSound(k: 'meow' | 'purr') {
  const v = volumeOf(k) / 100;
  if (!soundOk || !v || document.hidden) return;
  if (k === 'purr' && purring && !purring.ended) return;   // one purr at a time, however fast the petting
  const a = new Audio(__SOUNDS__[k]);
  a.volume = v;
  if (k === 'purr') purring = a;
  a.play().catch(() => {});
}

const allowSound = () => { soundOk = true; if (music?.paused !== false) syncMusic(); };
document.addEventListener('click', allowSound, true);
document.addEventListener('keydown', allowSound, true);
document.addEventListener('visibilitychange', syncMusic);

setInterval(() => {
  if (tab !== 'room' || asleepNow() || Math.random() > MEOW_CHANCE) return;
  if ([...document.querySelectorAll<HTMLElement>('#room .pet')].some((el) => el.dataset.nap !== '1')) playSound('meow');
}, MEOW_EVERY_MS);

function renderSound() {
  for (const k of ['bgm', 'meow', 'purr'] as const) {
    const v = volumeOf(k), input = $<HTMLInputElement>(`vol-${k}`);
    input.value = String(v);
    input.style.setProperty('--fill', `${v}%`);
    $(`vol-${k}-out`).textContent = v ? `${v}%` : 'Off';
  }
}
for (const k of ['bgm', 'meow', 'purr'] as const) {
  const input = $<HTMLInputElement>(`vol-${k}`);
  input.addEventListener('input', () => {
    save.sound = { ...save.sound, [k]: Number(input.value) };
    renderSound();
    if (k === 'bgm') syncMusic();
  });
  input.addEventListener('change', () => { persist(); if (k !== 'bgm') playSound(k); });   // let go of a slider: hear how loud it is
}

// Double-tap an awake cat to make a heart float up from it.
let lastTap = { id: '', at: 0 };
$('room').addEventListener('click', (ev) => {
  const pet = (ev.target as HTMLElement).closest<HTMLElement>('.pet');
  if (!pet || asleepNow()) return;
  if (pet.dataset.nap === '1') { napUntil.delete(pet.dataset.id ?? ''); setNap(pet, false); return; }   // a tap wakes a napping cat
  const t = Date.now();
  const id = pet.dataset.id ?? '';
  const double = lastTap.id === id && t - lastTap.at < 350;
  lastTap = double ? { id: '', at: 0 } : { id, at: t };
  const r = pet.getBoundingClientRect();
  const ring = document.createElement('i');
  ring.className = 'ripple';
  ring.style.left = `${ev.clientX - r.left}px`;
  ring.style.top = `${ev.clientY - r.top}px`;
  pet.appendChild(ring);
  setTimeout(() => ring.remove(), 500);
  if (!double) return;
  const heart = document.createElement('i');
  heart.className = 'heart';
  heart.innerHTML = HEART;
  pet.appendChild(heart);
  setTimeout(() => heart.remove(), 1300);
  const roll = Math.random();
  if (roll < PET_MEOW) playSound('meow');
  else if (roll < PET_MEOW + PET_PURR) playSound('purr');
});

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const scheduleText = (k: MindfulTask) => k.weekdays?.length ? `on ${k.weekdays.map((d) => DAY_NAMES[d]).join(', ')}` : repeatText(k.cooldownDays);
const repeatText = (d: number) => d === 1 ? 'daily' : d === 7 ? 'weekly' : d === 14 ? 'every 2 weeks' : d === 30 ? 'monthly' : `every ${d} days`;

let mindfulView: TaskKind = 'habit';
const TRAVEL = (id: string) => save.timeTravel ? `<button class="btn small travel" data-action="travel" data-id="${id}" aria-label="Time travel: edit the days this was done">${iconSvg('rewind')}</button>` : '';
const DEL = (id: string) => `<button class="btn small del" data-action="task-del" data-id="${id}" aria-label="Delete">${iconSvg('x')}</button>`;

function renderTasks() {
  const t = today();
  const kind = mindfulView;
  const isTask = kind === 'task';
  const cap = isTask ? CONFIG.taskMaxXp : CONFIG.habitMaxXp;
  document.querySelectorAll<HTMLElement>('#mindful-seg [data-view]').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.view === kind)));
  $('mindful-title').textContent = isTask ? 'Kibbles' : 'Treats';
  $('mindful-desc').textContent = isTask
    ? `One-off jobs. Do it once, tick it off, earn up to ${cap} XP. Tap the X or press and hold to delete.`
    : `Small habits you might not want to do every day, like cleaning your desk after a work-from-home session. Earn up to ${cap} XP a day. Track them before you commit to a kitty. Tap the X or press and hold to delete.`;
  const e = save.state.mindfulEarned?.day === t ? save.state.mindfulEarned : undefined;
  $('mindful-travel').hidden = !save.timeTravel;
  $('mindful-cap').textContent = `Earned today: ${(isTask ? e?.task : e?.habit) ?? 0}/${cap} XP`;
  $('form-title').textContent = isTask ? 'New kibble' : 'New treat';
  $('task-xp-label').textContent = `Reward (XP, max ${cap})`;
  ($('task-xp') as HTMLInputElement).max = String(cap);
  ($('repeat-wrap') as HTMLElement).hidden = isTask;
  ($('task-days-wrap') as HTMLElement).hidden = isTask || ($('task-repeat') as HTMLSelectElement).value !== 'custom';
  ($('task-weekdays-wrap') as HTMLElement).hidden = isTask || ($('task-repeat') as HTMLSelectElement).value !== 'weekdays';
  ($('task-form').querySelector('.row') as HTMLElement).style.gridTemplateColumns = isTask ? '1fr' : '';
  $('task-submit').textContent = isTask ? 'Add kibble' : 'Add habit';
  ($('task-name') as HTMLInputElement).placeholder = isTask ? 'Book a dentist appointment' : 'Stretch for 5 minutes';

  const list = save.state.tasks.filter((k) => k.kind === kind);
  if (isTask) list.sort((a, b) => Number(a.lastDoneDay !== null) - Number(b.lastDoneDay !== null));
  $('tasks').innerHTML = list.length ? list.map((k) => {
    if (isTask) {
      const done = k.lastDoneDay !== null;
      return `<li data-task="${k.id}" data-hold="task"><span class="${done ? 'done' : ''}">${esc(k.name)} <span class="muted">· +${k.xp} XP</span></span>
        <span class="row-btns"><button class="btn small" data-action="task" data-id="${k.id}" ${done ? 'disabled' : ''}>${done ? `${iconSvg('check')} Done` : 'Done'}</button>${TRAVEL(k.id)}${DEL(k.id)}</span></li>`;
    }
    const left = daysUntilReady(k, t);
    const daily = k.cooldownDays === 1;
    return `<li class="habit" data-task="${k.id}" data-hold="task"><span>${esc(k.name)} <span class="muted">· +${k.xp} XP · ${scheduleText(k)}</span></span>
      <span class="row-btns"><button class="btn small" data-action="task" data-id="${k.id}" ${left ? 'disabled' : ''}>${left ? `in ${plural(left, 'day')}` : 'Done'}</button><button class="btn small" data-action="rename-habit" data-id="${k.id}" aria-label="Rename treat">Edit</button>${TRAVEL(k.id)}${DEL(k.id)}</span>
      ${renderWeek(habitSubject(k), t)}
      <span class="muted habit-foot">${k.doneDays.length ? `Done ${plural(k.doneDays.length, 'time')}` : 'Not done yet'}${daily ? ` · streak ${habitStreak(k.doneDays, t)}` : ''}</span>
      ${daily ? `<button class="btn small" data-action="habit-kitty" data-id="${k.id}">Make it a kitty</button>` : ''}</li>`;
  }).join('') : `<li class="muted">No ${isTask ? 'kibbles' : 'treats'} yet. Add one below.</li>`;
}

const roomTitle = () => save.roomName?.trim() || 'Cozy room';
function renderRoomTitle() {
  $('room-title').textContent = roomTitle();
  $('room-book').innerHTML = pixelArt(BOOK_ART);
  $('room-trophy').innerHTML = pixelArt(TROPHY_ART);
}

function renderClock() {
  const n = now();
  $('clock-now').textContent = n.toLocaleString('en', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ahead = Math.round(save.offsetHours), away = Math.abs(ahead);
  $('clock-label').textContent = ahead
    ? `${away >= 24 ? plural(Math.floor(away / 24), 'day') : plural(away, 'hour')}${away >= 24 && away % 24 ? ` ${plural(away % 24, 'hour')}` : ''} ${ahead > 0 ? 'ahead of' : 'behind'} real time`
    : 'Running on real time.';
  ($('real-time') as HTMLButtonElement).disabled = !ahead;
}

// ---- your day: one boundary, shown as a start and an end (a day is always 24 hours) ----
function renderDaySetting() {
  const h = dayStartHour();
  const hours = Array.from({ length: CONFIG.dayStartMax + 1 }, (_, i) => i);
  for (const [id, label] of [['day-start', hourText], ['day-end', (i: number) => `${hourText(i)} next day`]] as const) {
    const sel = $<HTMLSelectElement>(id);
    if (!sel.options.length) sel.innerHTML = hours.map((i) => `<option value="${i}">${label(i)}</option>`).join('');   // built once, so a re-render can't close an open list
    sel.value = String(h);
  }
  $('day-span').textContent = `${dayRuleText(h)} Moving one end moves the other.`;
  $('day-end-note').textContent = `The day ends at ${hourText(h)}.`;
  $('day-rule').textContent = dayRuleText(h);
}

// Refused when it would put you in a different day right now: going back would let you redo a day, going forward
// would end today early. Both settings agree on the day from the later hour on.
function setDayBoundary(h: number) {
  const old = dayStartHour(), before = today();
  setDayStart(h);
  if (today() !== before) {
    setDayStart(old);
    renderDaySetting();
    toast(`That would move you into a different day right now. Try again after ${hourText(Math.max(old, h))}.`);
    return;
  }
  save.dayStart = dayStartHour();
  persist(); renderAll();
  toast(dayRuleText());
}

function renderSaved() {
  ($('unlimited-cats') as HTMLInputElement).checked = !!save.unlimited;
  ($('allow-rename') as HTMLInputElement).checked = !!save.allowRename;
  ($('show-clock') as HTMLInputElement).checked = !!save.showClock;
  ($('time-travel') as HTMLInputElement).checked = !!save.timeTravel;
  renderDaySetting();
  renderSound();
  $('version').textContent = `v${VERSION}`;
  $('clock-pop').hidden = !save.showClock;
  if (!save.showClock) $('clock-pop').classList.remove('open');
  $('saved').textContent = remote ? 'Saved to your Claude account' : 'Saved on this device';
}

// ===================== Diary =====================
// Moods are little cats drawn with the same pixel sprites as everything else. Their fur follows the rainbow:
// warm for good feelings, cool for bad ones.
const MOODS: Record<Mood, { label: string; face: Face; fur: string }> = {
  joyful:   { label: 'Joyful',   face: 'happy',    fur: '#ffb8cf' },
  calm:     { label: 'Calm',     face: 'open',     fur: '#ffe58a' },
  tired:    { label: 'Tired',    face: 'sleepy',   fur: '#a9dfb0' },
  sad:      { label: 'Sad',      face: 'sad',      fur: '#9cc7f0' },
  stressed: { label: 'Stressed', face: 'starving', fur: '#c3a9ee' },
};
const MOOD_KEYS = Object.keys(MOODS) as Mood[];
const moodSprite = (m: Mood) => miniSvg(MOODS[m].face, { fur: MOODS[m].fur, pattern: 'plain' }).replace('class="sprite', 'class="sprite mood');
const hasPage = (e?: DiaryEntry) => !!e && (!!e.text.trim() || !!e.photo);   // a written page or a photo turns the day pink

// ---- Diary files: one Markdown file per day and one small JPEG per day, in the app's private storage ----
const ROOT = 'habit-kitty';
const at = (path: string) => ({ path: `${ROOT}/${path}`, directory: Directory.Data });

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function fileBytes(path: string): Promise<Uint8Array | undefined> {
  try {
    const r = await Filesystem.readFile(at(path));
    return typeof r.data === 'string' ? fromBase64(r.data) : new Uint8Array(await r.data.arrayBuffer());
  } catch { return undefined; }
}
async function fileNames(dir: string): Promise<string[]> {
  try { return (await Filesystem.readdir(at(dir))).files.map((f) => f.name); } catch { return []; }
}
async function removeFile(path: string) { try { await Filesystem.deleteFile(at(path)); } catch { /* already gone */ } }
async function writeOk(run: () => Promise<unknown>): Promise<boolean> {
  try { await run(); return true; } catch { return false; }
}

const writeEntry = (day: number, e: DiaryEntry) =>
  writeOk(() => Filesystem.writeFile({ ...at(diaryPath(day)), data: entryToMarkdown(e), encoding: Encoding.UTF8, recursive: true }));
const writePhoto = (day: number, bytes: Uint8Array) =>
  writeOk(() => Filesystem.writeFile({ ...at(photoPath(day)), data: toBase64(bytes), recursive: true }));
const getPhoto = async (day: number) => {
  const b = await fileBytes(photoPath(day));
  return b && new Blob([b as BlobPart], { type: 'image/jpeg' });
};
const clearDiaryFiles = () => writeOk(() => Filesystem.rmdir({ ...at(''), recursive: true }));

async function readDiaryFiles(): Promise<Record<string, DiaryEntry>> {
  const out: Record<string, DiaryEntry> = {};
  const photos = new Set(await fileNames('photos'));
  await Promise.all((await fileNames('diary')).map(async (name) => {
    const day = dayFromName(name.replace(/\.md$/, ''));
    const bytes = day === null ? undefined : await fileBytes(`diary/${name}`);
    const e = bytes && entryFromMarkdown(new TextDecoder().decode(bytes));
    if (day !== null && e) out[day] = { ...e, photo: photos.has(photoPath(day).slice('photos/'.length)) };
  }));
  return out;
}

// Replace everything on disk with these entries and photos (used by a restore).
async function writeDiaryFiles(diary: Record<number, DiaryEntry>, photos: Record<number, Uint8Array>): Promise<boolean> {
  if (!await clearDiaryFiles()) return false;
  for (const [k, e] of Object.entries(diary)) {
    if (!await writeEntry(Number(k), e)) return false;
    if (photos[Number(k)] && !await writePhoto(Number(k), photos[Number(k)])) return false;
  }
  return true;
}

// Old versions kept the diary text inside the save and the photos in IndexedDB. Move them into files once.
function legacyPhotos(): Promise<Record<number, Blob>> {
  return new Promise((resolve) => {
    const out: Record<number, Blob> = {};
    try {
      const req = indexedDB.open('habit-kitty-photos', 1);
      req.onupgradeneeded = () => { req.transaction?.abort(); };   // nothing was ever stored
      req.onerror = () => resolve(out);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) { db.close(); resolve(out); return; }
        const cur = db.transaction('photos').objectStore('photos').openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { out[Number(c.key)] = c.value; c.continue(); } else { db.close(); resolve(out); }
        };
        cur.onerror = () => { db.close(); resolve(out); };
      };
    } catch { resolve(out); }
  });
}

async function migrateLegacyDiary(): Promise<boolean> {
  const old = Object.entries(save.diary ?? {});
  if (!old.length) return true;
  const photos = await legacyPhotos();
  for (const [k, e] of old) {
    const day = Number(k);
    if (!await writeEntry(day, e)) return false;
    if (e.photo && photos[day]) {
      const small = await compressPhoto(photos[day]).catch(() => null);
      if (small && !await writePhoto(day, new Uint8Array(await small.arrayBuffer()))) return false;
    }
  }
  try { indexedDB.deleteDatabase('habit-kitty-photos'); } catch { /* ignore */ }
  return true;
}

async function loadDiary() {
  if (!await migrateLegacyDiary()) return;   // keep the old copy in the save and try again next launch
  save.diary = await readDiaryFiles();
  diaryReady = true;
  persist();   // from now on the save no longer carries the diary
  renderDiary();
}

// Scale down and re-encode as JPEG until it fits under PHOTO_MAX_BYTES.
// The full-size photo is decoded and drawn only once; every retry re-encodes from the small copy.
async function compressPhoto(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file);
  const draw = (src: CanvasImageSource, w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(src, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  const k0 = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
  let canvas = draw(img, img.width * k0, img.height * k0);
  img.close();
  const encode = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q));
  let quality = 0.7;
  for (let i = 0; ; i++) {
    const blob = await encode(canvas, quality);
    if (!blob) throw new Error('encode failed');
    if (blob.size <= PHOTO_MAX_BYTES || i >= 14 || Math.max(canvas.width, canvas.height) < 200) return blob;
    if (quality > 0.45) quality -= 0.1; else canvas = draw(canvas, canvas.width * 0.85, canvas.height * 0.85);
  }
}

// ---- Backup: one .kitty file (a zip) holding the game, every diary page and every photo ----
async function collectBackup(): Promise<Backup> {
  const diary: Record<number, DiaryEntry> = {};
  const photos: Record<number, Uint8Array> = {};
  for (const [k, e] of Object.entries(save.diary ?? {})) {
    diary[Number(k)] = e;
    if (e.photo) { const b = await fileBytes(photoPath(Number(k))); if (b) photos[Number(k)] = b; }
  }
  return { game: gameOnly(), diary, photos };
}

async function exportBackup() {
  const bytes = packBackup(await collectBackup());
  const name = `habit-kitty-${new Date().toISOString().slice(0, 10)}.kitty`;
  if (Capacitor.isNativePlatform()) {
    try {
      const f = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache });
      await Share.share({ title: 'Habit Kitty backup', files: [f.uri], dialogTitle: 'Save your Habit Kitty backup' });
    } catch (e) {
      if (!/cancel/i.test(String((e as Error)?.message ?? e))) toast("Couldn't make the backup file. Try again.");
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  toast('Backup downloaded.');
}

let pendingBackup: Backup | null = null;
function askRestore(b: Backup) {
  pendingBackup = b;
  const pages = Object.keys(b.diary).length, photos = Object.keys(b.photos).length;
  openModal(`<div class="panel"><h3>Restore this backup?</h3>
    <p>It holds your kitties, ${pages} diary ${pages === 1 ? 'page' : 'pages'} and ${photos} ${photos === 1 ? 'photo' : 'photos'}.</p>
    <p class="muted">Everything currently on this device will be replaced.</p>
    <div class="btns"><button class="btn" data-action="modal-close">Cancel</button>
    <button class="btn primary" data-action="restore-yes">Restore</button></div></div>`);
}

async function restoreBackup() {
  const b = pendingBackup;
  pendingBackup = null;
  if (!b) return;
  const g = validGame(b.game);
  if (!g || !await writeDiaryFiles(b.diary, b.photos)) { closeModal(); toast("Couldn't restore that backup."); return; }
  save = normalize({ ...g, diary: b.diary as unknown as Save['diary'] });
  lastLevel = null;
  diaryReady = true;
  persist(); settle(); renderAll(); closeModal();
  toast('Backup restored.');
}

// ---- calendar ----
let diaryYM: { y: number; m: number } | null = null;
const diaryMonth = () => {
  if (!diaryYM) { const d = dateOf(today()); diaryYM = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }
  return diaryYM;
};

function renderDiary() {
  const t = today();
  const { y, m } = diaryMonth();
  const first = dayOf(y, m, 1), last = dayOf(y, m + 1, 0);
  const lead = (dateOf(first).getUTCDay() + 6) % 7;
  const title = dateOf(first).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const cur = dateOf(t);
  const atNow = y * 12 + m >= cur.getUTCFullYear() * 12 + cur.getUTCMonth();
  let pages = 0;
  const cells = [
    ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`),
    ...Array.from({ length: lead }, () => '<div class="dc blank"></div>'),
  ];
  for (let d = first; d <= last; d++) {
    const e = save.diary?.[d];
    const has = hasPage(e);
    if (has) pages++;
    const future = d > t;
    const what = [has ? 'entry' : '', e?.mood ? `feeling ${MOODS[e.mood].label.toLowerCase()}` : ''].filter(Boolean).join(', ') || 'empty';
    cells.push(`<button type="button" class="dc${has ? ' has' : ''}${d === t ? ' now' : ''}" data-action="diary-open" data-day="${d}" ${future ? 'disabled' : ''}
      aria-label="${fmtDay(d)}: ${what}"><span class="dn">${d - first + 1}</span>${e?.mood ? moodSprite(e.mood) : ''}</button>`);
  }
  $('diary-cal').innerHTML = cells.join('');
  const head = $('diary-title');
  head.textContent = title;
  head.dataset.y = String(y); head.dataset.m = String(m);
  head.setAttribute('aria-label', `${title}. Pick a month`);
  ($('diary-next') as HTMLButtonElement).disabled = atNow;
  $('diary-stats').innerHTML = pages ? `<b class="num">${pages}</b> ${pages === 1 ? 'page' : 'pages'} written this month` : 'No pages this month yet. Tap a day to write one.';
  $('diary-legend').innerHTML = `<span><i class="has"></i>has an entry</span><span><i class="now"></i>today</span>` +
    MOOD_KEYS.map((k) => `<span>${moodSprite(k)}${MOODS[k].label}</span>`).join('');
}

// ---- one day's page ----
let diaryDraft: { day: number; mood?: Mood; photo: Blob | null; photoUrl: string; loaded?: Promise<unknown> } | null = null;

function drawDraftPhoto() {
  if (!diaryDraft) return;
  const box = $('diary-photo');
  box.innerHTML = diaryDraft.photoUrl
    ? `<img src="${diaryDraft.photoUrl}" alt="Attached photo"><button class="btn small" type="button" data-action="diary-photo-remove">Remove photo</button>`
    : '<p class="muted">No photo attached.</p>';
  box.parentElement?.querySelector<HTMLElement>('[data-action="diary-photo-add"]')?.replaceChildren(diaryDraft.photoUrl ? 'Change photo' : 'Add photo');
}
// A pixel bar that sweeps back and forth while a photo is being converted or loaded.
function showPhotoBusy(text: string) {
  $('diary-photo').innerHTML = `<div class="loading" role="status"><p class="muted">${text}</p><div class="bar busy"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
  document.querySelectorAll<HTMLButtonElement>('#diary-form [data-action="diary-photo-add"], #diary-form button[type="submit"]').forEach((b) => (b.disabled = true));
}
function setDraftPhoto(b: Blob | null) {
  document.querySelectorAll<HTMLButtonElement>('#diary-form [data-action="diary-photo-add"], #diary-form button[type="submit"]').forEach((x) => (x.disabled = false));
  if (!diaryDraft) return;
  if (diaryDraft.photoUrl) URL.revokeObjectURL(diaryDraft.photoUrl);
  diaryDraft.photo = b;
  diaryDraft.photoUrl = b ? URL.createObjectURL(b) : '';
  drawDraftPhoto();
}
function markMood() {
  document.querySelectorAll<HTMLElement>('#diary-moods [data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === diaryDraft?.mood)));
}

function openDiary(day: number) {
  const e = save.diary?.[day];
  diaryDraft = { day, mood: e?.mood, photo: null, photoUrl: '' };
  openModal(`<form class="panel" id="diary-form" novalidate><button class="x-close" type="button" data-action="modal-close" aria-label="Close">${iconSvg('x')}</button>
    <h3>${esc(dateOf(day).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))}</h3>
    <div class="field"><span>How are you feeling?</span>
      <div class="moods" id="diary-moods">${MOOD_KEYS.map((k) =>
        `<button type="button" data-action="diary-mood" data-mood="${k}" aria-pressed="false">${moodSprite(k)}<span>${MOODS[k].label}</span></button>`).join('')}</div></div>
    <label class="field">Dear diary <textarea id="diary-text" class="diary-text" maxlength="5000" placeholder="What happened today?">${esc(e?.text ?? '')}</textarea></label>
    <div class="field"><span>Photo</span><div id="diary-photo" class="diary-photo"></div>
      <div class="btns"><button class="btn" type="button" data-action="diary-photo-add">Add photo</button></div>
      <input type="file" id="diary-file" accept="image/*" hidden></div>
    <p class="form-error" id="diary-error" hidden></p>
    <div class="btns"><button class="btn" type="button" data-action="diary-clear">Clear</button><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div>
  </form>`);
  markMood();
  drawDraftPhoto();
  if (e?.photo) showPhotoBusy('Loading photo…');
  if (e?.photo) diaryDraft.loaded = getPhoto(day).then((b) => { if (diaryDraft?.day === day && !diaryDraft.photo) setDraftPhoto(b || null); });
}

async function saveDiary() {
  const dr = diaryDraft;
  if (!dr) return;
  await Promise.all([dr.loaded, diaryLoading]);   // don't mistake a photo that is still loading for a removed one
  const text = ($('diary-text') as HTMLTextAreaElement).value.replace(/\s+$/, '');
  const entries = { ...save.diary };
  if (!text.trim() && !dr.mood && !dr.photo) delete entries[dr.day];
  else entries[dr.day] = { text, mood: dr.mood, photo: !!dr.photo, updated: Date.now() };
  const entry = entries[dr.day];
  const stored = entry
    ? (!dr.photo || await writePhoto(dr.day, new Uint8Array(await dr.photo.arrayBuffer()))) && await writeEntry(dr.day, entry)
    : true;
  if (!stored) {
    const err = $('diary-error');
    err.textContent = "Couldn't store this page on the device. Try again.";
    err.hidden = false;
    return;
  }
  if (!entry) { await removeFile(diaryPath(dr.day)); }
  if (!dr.photo) await removeFile(photoPath(dr.day));
  save.diary = entries;
  persist();
  closeModal();
  renderDiary();
  checkAchievements();
  toast(entries[dr.day] ? 'Diary page saved.' : 'Diary page cleared.');
}

// ===================== Feeding reminders =====================
const NATIVE = Capacitor.isNativePlatform();
type Perm = 'granted' | 'denied' | 'prompt' | 'unsupported';
const reminderSettings = (): ReminderSettings => save.reminder ?? defaultReminder();
let reminderInfo: { perm: Perm; next: Date | null; error?: boolean } = { perm: 'prompt', next: null };

async function notifPermission(ask: boolean): Promise<Perm> {
  try {
    if (NATIVE) {
      const r = await (ask ? LocalNotifications.requestPermissions() : LocalNotifications.checkPermissions());
      return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt';
    }
    if (typeof Notification === 'undefined') return 'unsupported';
    const p = ask && Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
  } catch { return 'unsupported'; }
}

// The notification shows the kitty it is about, in its own fur and in the mood the reminder describes.
function notifyLargeIcon(p: { catId?: string; face: Face }): { largeIcon?: string } {
  const c = save.state.cats.find((k) => k.id === p.catId);
  return c ? { largeIcon: notifyIconName(lookFor(c), p.face) } : {};
}

let webTimer = 0;
let syncing: Promise<void> = Promise.resolve();
let syncDebounce = 0;
const queueReminderSync = () => {
  clearTimeout(syncDebounce);
  syncDebounce = window.setTimeout(() => { syncing = syncing.then(syncReminders); }, 400);
};

// Rebuilds every pending reminder from the current state. Each reminder has one id per date, so running
// this any number of times never leaves duplicates. Called after every change and every time the app opens.
async function syncReminders() {
  const r = reminderSettings();
  clearTimeout(webTimer);
  try {
    if (NATIVE) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    reminderInfo = { perm: await notifPermission(false), next: null };
    if (anyReminder(r) && reminderInfo.perm === 'granted') {
      const { plan, picks } = planReminders(save.state, r, now());
      // The playtest clock shifts game time away from real time; notifications fire in real time.
      const real = plan.map((p) => ({ ...p, at: new Date(p.at.getTime() - save.offsetHours * 3_600_000) }));
      if (JSON.stringify(picks) !== JSON.stringify(r.picks ?? {})) {
        save.reminder = { ...r, picks };
        try { localStorage.setItem(KEY, JSON.stringify(gameOnly())); } catch { /* ignore */ }
      }
      reminderInfo.next = real[0]?.at ?? null;
      if (NATIVE) {
        if (real.length) await LocalNotifications.schedule({ notifications: real.map((p) => ({
          id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true }, smallIcon: 'ic_stat_notify',
          ...notifyLargeIcon(p),
        })) });
      } else if (real[0]) {
        // The web page can only remind you while it is open.
        const first = real[0];
        webTimer = window.setTimeout(() => {
          if (save.reminder?.lastFired === first.id) return;   // already shown for this date
          try { new Notification(first.title, { body: first.body }); } catch { /* ignore */ }
          save.reminder = { ...reminderSettings(), lastFired: first.id };
          persist();
        }, Math.min(2_000_000_000, Math.max(0, first.at.getTime() - Date.now())));
      }
    }
  } catch { reminderInfo = { ...reminderInfo, error: true }; }
  renderReminder();
}

const hhmm = (a: { hour: number; minute: number }) => `${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')}`;

function renderReminder() {
  const r = reminderSettings();
  ($('reminder-on') as HTMLInputElement).checked = r.enabled;
  ($('reminder-time') as HTMLInputElement).value = hhmm(r);
  ($('reminder-time') as HTMLInputElement).disabled = !r.enabled;
  ($('last-call') as HTMLSelectElement).value = r.lastCall ?? 'off';
  const home = save.state.cats.filter((c) => c.status === 'alive');
  $('cat-alarms').innerHTML = home.length ? home.map((c) => {
    const a = r.catAlarms?.[c.id];
    return `<li><span class="nm">${esc(c.name)}</span><span class="when"><input type="time" data-cat-alarm="${c.id}" value="${a ? hhmm(a) : ''}" aria-label="Feeding alarm for ${esc(c.name)}">
      <button class="btn small" type="button" data-action="cat-alarm-clear" data-id="${c.id}" ${a ? '' : 'disabled'} aria-label="Remove alarm for ${esc(c.name)}">${iconSvg('x')}</button></span></li>`;
  }).join('') : '<li class="muted">No kitties at home.</li>';
  const { perm, next, error } = reminderInfo;
  const el = $('reminder-status');
  const on = anyReminder(r);
  let text = 'Off. Turn on the daily reminder, last-call alerts, or give a kitty its own alarm.';
  let bad = false;
  if (perm === 'unsupported') { text = "Notifications aren't available here."; bad = true; }
  else if (on && perm !== 'granted') {
    text = "Reminders are on, but notifications are blocked. Allow them for Habit Kitty in your phone's settings (Apps → Habit Kitty → Notifications), then reopen the app."; bad = true;
  } else if (error) { text = "Couldn't schedule reminders. Try again in a moment."; bad = true; }
  else if (on) {
    const when = next?.toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    text = (next ? `On. Next reminder: ${when} (your local time).` : 'On. Add a kitty and reminders start.') +
      (NATIVE ? '' : ' In a browser it only works while this page is open.');
  } else if (perm === 'denied') { text = "Off. Notifications are blocked for Habit Kitty, so you'll be asked to allow them in your phone's settings."; }
  el.textContent = text;
  el.classList.toggle('bad', bad);
}

// Asks for notification permission when something is being switched on. Says why when it can't have it.
async function ensureNotifications(): Promise<boolean> {
  const perm = await notifPermission(true);
  reminderInfo = { ...reminderInfo, perm };
  if (perm === 'granted') return true;
  toast(perm === 'denied' ? 'Notifications are blocked. Allow them in your phone settings first.' : "Notifications aren't available here.");
  return false;
}

function setReminders(next: Partial<ReminderSettings>) {
  save.reminder = { ...reminderSettings(), ...next };
  persist(); renderReminder();
}

async function setReminderEnabled(on: boolean) {
  if (on && !await ensureNotifications()) { setReminders({ enabled: false }); return; }
  const r = reminderSettings();
  setReminders({ enabled: on });
  toast(on ? `Reminders on, every day at ${hhmm(r)}.` : 'Reminders off.');
}

// ===================== Tabs & modal =====================
const TABS = ['room', 'mindful', 'today', 'heat', 'diary', 'settings'];
let tab = 'today';
let tabBeforeSettings = 'today';   // where the settings icon takes you back to
function showTab(name: string) {
  if (name !== 'settings') tabBeforeSettings = name;
  tab = name;
  if (name === 'diary') renderDiary();
  renderTop();
  for (const t of TABS) $(`tab-${t}`).classList.toggle('on', t === name);
  document.querySelectorAll<HTMLElement>('.tabbar [data-tab]').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  if (name === 'room') renderRoom();
  window.scrollTo(0, 0);
}

function closeModal() {
  closeLayer(false);
  if (diaryDraft?.photoUrl) URL.revokeObjectURL(diaryDraft.photoUrl);
  diaryDraft = null; gate = null; menuCat = null;
  $('modal').hidden = true; $('modal').innerHTML = '';
}
function openModal(html: string) {
  const m = $('modal');
  m.innerHTML = `<div class="scrim" data-action="modal-close">${html}</div>`;
  m.hidden = false;
  m.querySelector<HTMLElement>('input')?.focus();
}

// A small dialog over the page or over the open dialog, which keeps its state underneath. Focus goes to the
// selected choice (or the one marked data-focus) and back to whatever opened it.
let layerFrom: HTMLElement | null = null;
const LAYER_FOCUS = ['[aria-pressed="true"]:not(:disabled)', '.pick.now:not(:disabled)', '[data-focus]', '.pick:not(:disabled)', 'button:not(:disabled)'];
function openLayer(html: string, label: string, from?: HTMLElement) {
  const old = document.getElementById('layer');
  if (!old) layerFrom = from ?? (document.activeElement as HTMLElement | null);
  old?.remove();
  const el = document.createElement('div');
  el.id = 'layer';
  el.className = 'scrim layer';
  el.dataset.action = 'layer-close';
  el.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  document.body.appendChild(el);
  for (const q of LAYER_FOCUS) { const b = el.querySelector<HTMLElement>(q); if (b) { b.focus(); break; } }
}
function closeLayer(refocus = true) {
  const el = document.getElementById('layer');
  if (!el) return;
  el.remove();
  picker = null;
  if (refocus && layerFrom?.isConnected) layerFrom.focus();
  layerFrom = null;
}

// ---- month and year picker: tap a calendar's title (the diary, the heatmaps) to jump to any month up to now ----
interface Picker { key: string; y: number; m: number; year: number; first: number }   // year: the one being shown; first: earliest month allowed, as y * 12 + m
let picker: Picker | null = null;
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }));
const nowMonth = () => { const d = dateOf(today()); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const PICKER_YEARS = 12;   // the current year, the ten before it and next year (greyed), 4 x 3

const monthTitle = (key: string, y: number, m: number, title: string, first: number) =>
  `<button type="button" class="month-title" data-action="picker-open" data-key="${key}" data-y="${y}" data-m="${m}" data-first="${first}" aria-haspopup="dialog" aria-label="${title}. Pick a month">${title}</button>`;

function openPicker(btn: HTMLElement) {
  const y = Number(btn.dataset.y), m = Number(btn.dataset.m), first = Number(btn.dataset.first);
  picker = { key: btn.dataset.key ?? '', y, m, year: y, first: Number.isFinite(first) ? first : -Infinity };
  drawPicker('month', btn);
}

function drawPicker(view: 'month' | 'year', from?: HTMLElement) {
  const p = picker;
  if (!p) return;
  const cur = nowMonth(), curY = Math.floor(cur / 12);
  const close = `<button class="x-close" type="button" data-action="layer-close" aria-label="Close">${iconSvg('x')}</button>`;
  const cell = (cls: string, data: string, label: string, on: boolean, off: boolean, aria = label) =>
    `<button type="button" class="pick${cls}" ${data} aria-pressed="${on}" aria-label="${aria}" ${off ? 'disabled' : ''}>${label}</button>`;
  const html = view === 'month'
    ? `${close}<div class="picker-head"><button class="btn small" type="button" data-action="picker-years" aria-label="Back to years">${iconSvg('prev')}Back</button><strong>${p.year}</strong></div>
      <div class="pick-grid">${MONTH_NAMES.map((name, i) => {
        const ym = p.year * 12 + i;
        return cell(ym === cur ? ' now' : '', `data-action="picker-month" data-m="${i}"`, name, ym === p.y * 12 + p.m, ym > cur || ym < p.first, `${name} ${p.year}`);
      }).join('')}</div>`
    : `${close}<div class="picker-head"><strong>Pick a year</strong></div>
      <div class="pick-grid">${Array.from({ length: PICKER_YEARS }, (_, i) => curY - PICKER_YEARS + 2 + i).map((y) =>
        cell(y === curY ? ' now' : '', `data-action="picker-year" data-y="${y}"`, String(y), y === p.y, y > curY || (y + 1) * 12 <= p.first)).join('')}</div>`;
  openLayer(html, view === 'month' ? `Pick a month in ${p.year}` : 'Pick a year', from);
}

function pickMonth(m: number) {
  const p = picker;
  if (!p || p.year * 12 + m > nowMonth() || p.year * 12 + m < p.first) return;
  closeLayer(false);
  if (p.key === 'diary') { diaryYM = { y: p.year, m }; renderDiary(); }
  else {
    viewMonth.set(p.key, Math.max(0, nowMonth() - (p.year * 12 + m)));
    renderHeat();
    if (menuCat === p.key) openCatMenu(p.key);
  }
  document.querySelector<HTMLElement>(`[data-action="picker-open"][data-key="${CSS.escape(p.key)}"]`)?.focus();   // the title was redrawn
}

// ---- adopting: friendly nagging, a cap of 9, and a triple-confirm for unlimited mode ----
interface Step { title: string; text: string; yes: string; no?: string }
let gate: { steps: Step[]; done: () => void } | null = null;

function showGate() {
  const st = (gate as NonNullable<typeof gate>).steps[0];
  openModal(`<div class="panel"><h3>${st.title}</h3><p>${st.text}</p>
    <div class="btns"><button class="btn" data-action="modal-close">${st.no ?? 'Cancel'}</button>
    <button class="btn primary" data-action="gate-yes">${st.yes}</button></div></div>`);
}
function runGate(steps: Step[], done: () => void) { gate = { steps, done }; showGate(); }

const activeCount = () => save.state.cats.filter(isActive).length;

function startAdopt(habitId?: string) {
  const n = activeCount();
  const next = n + 1;
  const go = () => openAdopt(habitId);
  if (n >= CONFIG.maxCats) {
    if (!save.unlimited) {
      openModal(`<div class="panel"><h3>${next} habits is a lot</h3>
        <p>${next} habits is a lot for people to handle, and it will be very sad if a kitty goes hungry.</p>
        <p>Consider returning one kitty to the shelter to make room for a new one, or use a treat as a temporary try-out for a habit you're not sure about yet.</p>
        <div class="btns"><button class="btn" data-action="modal-close">OK</button>
        <button class="btn primary" data-action="goto-habits">Try a treat</button></div></div>`);
      return;
    }
    runGate([
      { title: `Kitty #${next}? That's a lot`, yes: 'I still want to',
        text: `${next} habits is a lot for people to handle, and it will be very sad if a kitty goes hungry. Consider returning a kitty to the shelter, or trying this one as a treat first.` },
      { title: 'Are you really sure?', yes: 'Yes, really',
        text: `Every kitty needs you every single day. Miss a day and you lose ${CONFIG.starvePenalty} affection for each hungry kitty, and a classic kitty can die. With ${next} kitties that adds up fast.` },
      { title: 'Last chance', yes: 'I promise',
        text: `Kitty #${next} will be counting on you tomorrow, and the day after, and the day after that. Promise to look after all ${next} of them?` },
    ], go);
    return;
  }
  if (n >= 5) {
    runGate([{ title: 'Another kitty?', yes: 'I can handle it', no: 'Let me think',
      text: `You already have ${n} kitties. Each one needs feeding every single day, and they do notice when you forget. Be responsible for your kitties, and make sure you can really handle ${next} of them.` }], go);
    return;
  }
  go();
}

let draftLook: CatLook = randomLook();
let draftGender: CatGender = Math.random() < 0.5 ? 'girl' : 'boy';
const cap1 = (w: string) => w[0].toUpperCase() + w.slice(1);
const lookPickers = () =>
  `<label class="field">Gender<select data-gender>${(['girl', 'boy'] as CatGender[]).map((g) =>
    `<option value="${g}" ${draftGender === g ? 'selected' : ''}>${cap1(g)}</option>`).join('')}</select></label>` +
  `<label class="field">Personality<select data-look="trait">${TRAITS.map((o) =>
    `<option value="${o}" ${draftLook.trait === o ? 'selected' : ''}>${cap1(o)}</option>`).join('')}</select></label>` +
  `<p class="muted">${TRAIT_TEXT[draftLook.trait ?? 'curious']}.</p>`;
const redrawLook = () => { $('adopt-preview').innerHTML = sprite('happy', draftLook); $('adopt-look').innerHTML = lookPickers(); };
let adoptFrom: string | null = null;   // mindful habit being turned into a cat
function openAdopt(habitId?: string) {
  draftLook = randomLook();
  draftGender = Math.random() < 0.5 ? 'girl' : 'boy';
  adoptFrom = habitId ?? null;
  const habit = habitId ? save.state.tasks.find((k) => k.id === habitId) : undefined;
  openModal(`<form class="panel" id="adopt" novalidate>
    <h3>${habit ? 'Make a kitty' : 'Adopt a kitty'}</h3>
    <div class="preview"><div id="adopt-preview">${sprite('happy', draftLook)}</div>
      <button class="btn" type="button" data-action="randomise">${iconSvg('dice')} Randomise look</button></div>
    <div class="look-pick" id="adopt-look">${lookPickers()}</div>
    <p class="muted">${habit ? `Your history with this habit comes along. Days you did it show in teal; days before the kitty show as empty.`
      : 'Each cat stands for one habit. Do the habit, feed the cat.'}</p>
    <label class="field">Cat's name <input id="adopt-name" maxlength="24" placeholder="Mochi" autocomplete="off"></label>
    <label class="field">Daily habit <input id="adopt-habit" maxlength="40" placeholder="Drink a glass of water" autocomplete="off" value="${habit ? esc(habit.name) : ''}" ${habit ? 'readonly' : ''}></label>
    <fieldset class="modes">
      <legend>If you neglect it for 3 days</legend>
      <label><input type="radio" name="mode" value="classic" checked><b>Classic</b>the cat dies</label>
      <label><input type="radio" name="mode" value="lighthearted"><b>Light-hearted</b>it runs away, and comes back once</label>
    </fieldset>
    <p class="form-error" id="adopt-error" hidden></p>
    <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">${habit ? 'Make kitty' : 'Adopt'}</button></div>
  </form>`);
}

// ---- achievements: worked out from the save; the unlocked ones are remembered so they never disappear ----
const diaryPageCount = () => Object.values(save.diary ?? {}).filter(hasPage).length;
function checkAchievements() {
  const got = achievements(save.state, diaryPageCount(), today()).filter((a) => a.unlocked);
  const known = save.achieved;
  const fresh = got.filter((a) => !known || !(a.id in known));
  if (!fresh.length) return;
  save.achieved = { ...known, ...Object.fromEntries(fresh.map((a) => [a.id, today()])) };
  persist();
  if (!known) return;   // a save from before achievements: hand out what is already earned quietly
  const names = fresh.map((a) => a.title);
  setTimeout(() => toast(`Achievement unlocked: ${names[0]}${names.length > 1 ? ` (+${names.length - 1} more)` : ''}`), 1800);
}

function openTrophies() {
  const list = achievements(save.state, diaryPageCount(), today());
  const unlocked = list.filter((a) => a.unlocked).length;
  const groups = [...new Set(list.map((a) => a.group))];
  openModal(`<div class="panel"><button class="x-close" type="button" data-action="modal-close" aria-label="Close">${iconSvg('x')}</button>
    <h3>Achievements</h3><p class="muted"><b class="num">${unlocked}</b> of ${list.length} unlocked</p>
    ${groups.map((g) => `<h4 class="ach-group">${g}</h4><ul class="ach">${list.filter((a) => a.group === g).map((a) =>
      `<li class="${a.unlocked ? 'got' : ''}"><span class="ach-icon">${a.unlocked ? pixelArt(TROPHY_ART) : pixelArt(TROPHY_ART, 'dim')}</span>
        <span><b>${esc(a.title)}</b><br><span class="muted">${esc(a.text)}</span>
        ${a.unlocked ? '' : `<span class="ach-bar" role="img" aria-label="${a.progress} of ${a.target}"><i style="width:${Math.round((100 * a.progress) / a.target)}%"></i></span>`}</span></li>`).join('')}</ul>`).join('')}</div>`);
}

// ---- everyone's diary: the kitties' days in one list ----
function openBook(day: number = today()) {
  const t = today();
  const home = sortedCats().filter((c) => c.status === 'alive');
  const first = Math.min(t, ...save.state.cats.map((c) => c.adoptedDay));
  const day0 = Math.max(first, Math.min(day, t));
  const clockNow = now().getHours() * 60 + now().getMinutes();
  const lines = allCatsDiary(home.filter((c) => c.adoptedDay <= day0), day0).filter((l) => day0 < t || l.minute <= clockNow);
  openModal(`<div class="panel"><button class="x-close" type="button" data-action="modal-close" aria-label="Close">${iconSvg('x')}</button>
    <h3>Kitty diary</h3>
    <div class="month-nav">
      <button type="button" data-action="book-day" data-day="${day0 - 1}" ${day0 <= first ? 'disabled' : ''} aria-label="Previous day">${iconSvg('prev')}</button>
      <strong>${day0 === t ? 'Today · ' : ''}${fmtDay(day0)}</strong>
      <button type="button" data-action="book-day" data-day="${day0 + 1}" ${day0 >= t ? 'disabled' : ''} aria-label="Next day">${iconSvg('next')}</button>
    </div>
    ${lines.length ? `<ul class="catlog">${lines.map((l) => `<li><span class="num">${clock(l.minute)}</span> ${esc(l.text)}</li>`).join('')}</ul>`
      : `<p class="muted">${home.length ? 'Nothing happened yet.' : 'Nobody is home, so nothing to write about.'}</p>`}</div>`);
}

// ---- time travel: mark or unmark a treat or kibble on any day up to today ----
let travelBack = 0;   // months back from the current one
function openTravel(id: string, back = travelBack) {
  const task = save.state.tasks.find((k) => k.id === id);
  if (!task) return;
  travelBack = back;
  const t = today(), d = dateOf(t);
  const shown = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  const y = shown.getUTCFullYear(), m = shown.getUTCMonth();
  const first = dayOf(y, m, 1), last = dayOf(y, m + 1, 0), lead = (dateOf(first).getUTCDay() + 6) % 7;
  const doneSet = new Set(task.doneDays);
  const cells = [
    ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`),
    ...Array.from({ length: lead }, () => '<div class="dc blank"></div>'),
    ...Array.from({ length: last - first + 1 }, (_, i) => {
      const day = first + i, on = doneSet.has(day);
      return `<button type="button" class="dc${on ? ' has' : ''}${day === t ? ' now' : ''}" data-action="travel-day" data-id="${id}" data-day="${day}" ${day > t ? 'disabled' : ''}
        aria-pressed="${on}" aria-label="${fmtDay(day)}: ${on ? 'done' : 'not done'}"><span class="dn">${i + 1}</span>${on ? `<b class="tick">${iconSvg('tick')}</b>` : ''}</button>`;
    }),
  ].join('');
  openModal(`<div class="panel"><button class="x-close" type="button" data-action="modal-close" aria-label="Close">${iconSvg('x')}</button>
    <h3>Time travel</h3><p><b>${esc(task.name)}</b></p>
    <p class="muted">Tap a day to mark it done or not done. This only fixes your record: no XP is paid or taken away.${task.kind === 'task' ? ' A kibble is done once, so tapping another day moves it.' : ''}</p>
    <div class="month-nav">
      <button type="button" data-action="travel-month" data-id="${id}" data-step="1" aria-label="Previous month">${iconSvg('prev')}</button>
      <strong>${dateOf(first).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
      <button type="button" data-action="travel-month" data-id="${id}" data-step="-1" ${back === 0 ? 'disabled' : ''} aria-label="Next month">${iconSvg('next')}</button>
    </div>
    <div class="dcal" role="group" aria-label="Days">${cells}</div>
    <div class="btns"><button class="btn primary" type="button" data-action="modal-close">Done</button></div></div>`);
}

// ---- change log: shown once after an update, and always in Settings ----
const CHANGES: ChangeEntry[] = parseChangelog(CHANGELOG_MD);
const changeBody = (e: ChangeEntry) => e.sections.map((sec) =>
  `${sec.title ? `<p class="change-title">${esc(sec.title)}</p>` : ''}<ul>${sec.items.map((i) =>
    `<li>${esc(i).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</li>`).join('')}</ul>`).join('');
const changeHead = (e: ChangeEntry) => `v${e.version}<span class="muted">${e.date ? ` · ${esc(e.date)}` : ''}</span>`;
// The pop-up after an update shows entries open; the list in Settings folds each version, with the newest open.
const changesHtml = (entries: ChangeEntry[]) => entries.map((e) =>
  `<section class="change"><h4>${changeHead(e)}</h4>${changeBody(e)}</section>`).join('');
const renderChangelog = () => {
  const el = $('changelog');
  const open = new Set([...el.querySelectorAll<HTMLDetailsElement>('details[data-v]')].filter((d) => d.open).map((d) => d.dataset.v));
  const first = !el.children.length;
  el.innerHTML = CHANGES.map((e, i) =>
    `<details class="change" data-v="${e.version}" ${(first ? i === 0 : open.has(e.version)) ? 'open' : ''}><summary>${changeHead(e)}</summary>${changeBody(e)}</details>`).join('');
};

function showWhatsNew() {
  const seen = save.seenVersion;
  if (seen === VERSION) return;
  const brandNew = !seen && !save.savedAt && !save.state.cats.length;
  const news = entriesSince(CHANGES, seen ?? '0.2.0', VERSION);
  save.seenVersion = VERSION;
  persist();
  if (brandNew || !news.length) return;
  openModal(`<div class="panel"><h3>What's new in v${VERSION}</h3>${changesHtml(news)}
    <p class="muted">You can read this again in Settings → Change log.</p>
    <div class="btns"><button class="btn primary" type="button" data-action="modal-close">Got it</button></div></div>`);
}

function renderAll() {
  renderTop(); renderLog(); renderCats(); renderHeat(); renderRoom(); renderRoomTitle(); renderTasks(); renderClock(); renderSaved(); renderChangelog(); renderDiary(); renderReminder();
  queueWidget();
  checkAchievements();
}

// ===================== Events =====================
document.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  const id = btn.dataset.id ?? '';
  const cat = save.state.cats.find((c) => c.id === id);
  switch (btn.dataset.action) {
    case 'feed':
      act((s, at) => feedCat(s, id, at), () => {
        const fed = save.state.cats.find((c) => c.id === id) as Cat;
        return cat?.status === 'ranAway' ? `${fed.name} came back! Welcome home.` : fedMessage(fed, foodFor(fed, today()), streak(fed, today()));
      }, cat);
      if (menuCat === id) openCatMenu(id);   // keep the open menu in step (fed, or called back)
      break;
    case 'sitter': closeModal(); act((s, at) => startSitter(s, id, at), `${cat?.name} is with the sitter. Bring them home within 7 days.`, cat); break;
    case 'resume': closeModal(); act((s, at) => resumeCat(s, id, at), `${cat?.name} is home. Feed them today.`, cat); break;
    case 'task': {
      const task = save.state.tasks.find((k) => k.id === id);
      if (!task) break;
      const kind = task.kind;
      const cap = kind === 'task' ? CONFIG.taskMaxXp : CONFIG.habitMaxXp;
      const earned = () => {
        const e = save.state.mindfulEarned;
        return e?.day === today() ? (e[kind] ?? 0) : 0;
      };
      const before = earned();
      act((s, at) => doMindfulTask(s, id, at), () => {
        const paid = earned() - before;
        return paid >= task.xp ? `Nice. +${paid} XP`
          : paid > 0 ? `+${paid} XP. That's today's ${cap} XP limit for ${kind}s.`
          : `Done! You've already earned today's ${cap} XP from ${kind}s, so no extra XP.`;
      });
      break;
    }
    case 'tab':
      showTab(btn.dataset.tab ?? 'today');
      break;
    case 'theme-toggle': toggleTheme(); break;
    case 'settings-toggle': showTab(tab === 'settings' ? tabBeforeSettings : 'settings'); break;
    case 'diary-month': {
      const d = diaryMonth(), n = new Date(Date.UTC(d.y, d.m + Number(btn.dataset.step), 1));
      if (n.getUTCFullYear() * 12 + n.getUTCMonth() > nowMonth()) break;   // never into a month that hasn't happened
      diaryYM = { y: n.getUTCFullYear(), m: n.getUTCMonth() };
      renderDiary();
      break;
    }
    case 'diary-today': diaryYM = null; renderDiary(); break;
    case 'picker-open': openPicker(btn); break;
    case 'picker-years': drawPicker('year'); break;
    case 'picker-year': if (picker) { picker.year = Number(btn.dataset.y); drawPicker('month'); } break;
    case 'picker-month': pickMonth(Number(btn.dataset.m)); break;
    case 'layer-close': if (ev.target === btn || btn.tagName === 'BUTTON') closeLayer(); break;
    case 'diary-open': openDiary(Number(btn.dataset.day)); break;
    case 'diary-mood':
      if (diaryDraft) { diaryDraft.mood = diaryDraft.mood === btn.dataset.mood ? undefined : (btn.dataset.mood as Mood); markMood(); }
      break;
    case 'diary-photo-add': $('diary-file').click(); break;
    case 'diary-photo-remove': setDraftPhoto(null); break;
    case 'diary-clear':
      openLayer(`<h3>Clear this page?</h3>
        <p>This empties the text, mood and photo on this diary page. Nothing is deleted until you press Save, so closing the page without saving keeps it as it was.</p>
        <div class="btns"><button class="btn" type="button" data-action="layer-close" data-focus>Cancel</button><button class="btn primary" type="button" data-action="diary-clear-yes">Clear</button></div>`, 'Clear this page?', btn);
      break;
    case 'diary-clear-yes':
      closeLayer();
      ($('diary-text') as HTMLTextAreaElement).value = '';
      if (diaryDraft) { diaryDraft.mood = undefined; markMood(); setDraftPhoto(null); }
      break;
    case 'log-close': save.logHidden = true; persist(); renderLog(); break;
    case 'adopt-open': startAdopt(); break;
    case 'habit-kitty': startAdopt(id); break;
    case 'task-del': askDeleteTask(id); break;
    case 'gate-yes': {
      const g = gate;
      if (!g) break;
      g.steps.shift();
      if (g.steps.length) { showGate(); break; }
      closeModal();
      g.done();
      break;
    }
    case 'goto-habits': closeModal(); mindfulView = 'habit'; renderTasks(); showTab('mindful'); break;
    case 'menu-tab': openCatMenu(id, btn.dataset.view as MenuTab); break;
    case 'mindful-view': mindfulView = btn.dataset.view === 'habit' ? 'habit' : 'task'; renderTasks(); break;
    case 'today-view': todayView = (btn.dataset.view as TodayView) ?? 'home'; renderCats(); break;
    case 'randomise':
      draftLook = randomLook();
      redrawLook();
      break;
    case 'sitter-ask':
      if (!cat) break;
      openModal(`<div class="panel"><h3>Send ${esc(cat.name)} to the pet sitter?</h3>
        <p>${esc(cat.name)} can stay up to ${CONFIG.sitterMaxDays} days. It costs ${CONFIG.sitterPenaltyPerDay} affection a day, and you can only do this once every ${CONFIG.sitterCooldownDays} days. Bring them home in time or they stay with the sitter for good.</p>
        <div class="btns"><button class="btn" data-action="modal-close">Cancel</button>
        <button class="btn primary" data-action="sitter" data-id="${id}">Send to sitter</button></div></div>`);
      break;
    case 'shelter-ask':
      if (!cat) break;
      openModal(`<div class="panel"><h3>Return ${esc(cat.name)} to the shelter?</h3>
        <p>Not feeling this habit anymore? ${esc(cat.name)} will go back to the shelter with no penalty. This can't be undone.</p>
        <div class="btns"><button class="btn" data-action="modal-close">Keep ${esc(cat.name)}</button>
        <button class="btn primary" data-action="shelter-yes" data-id="${id}">Return</button></div></div>`);
      break;
    case 'shelter-yes': {
      const name = cat?.name ?? 'Your cat';
      act((s, at) => returnToShelter(s, id, at), `${name} went back to the shelter. Take care, ${name}.`, cat);
      closeModal();
      break;
    }
    case 'rename-cat': {
      if (!cat || !save.allowRename) break;
      closeModal();
      openModal(`<form class="panel" id="rename-cat" data-id="${id}" novalidate><h3>Rename kitty</h3>
        <label class="field">Name <input id="rename-cat-input" maxlength="24" autocomplete="off" value="${esc(cat.name)}"></label>
        <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
      break;
    }
    case 'rename-habit': {
      const cur = cat ? cat.habit : save.state.tasks.find((k) => k.id === id)?.name;
      if (cur === undefined) break;
      closeModal();
      openModal(`<form class="panel" id="rename" data-id="${id}" novalidate><h3>Rename habit</h3>
        ${cat ? `<p class="muted">${esc(cat.name)}'s name stays the same. Only the habit changes.</p>` : ''}
        <label class="field">Habit name <input id="rename-input" maxlength="40" autocomplete="off" value="${esc(cur)}"></label>
        <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
      break;
    }
    case 'room-rename':
      openModal(`<form class="panel" id="room-name" novalidate><h3>Name your room</h3>
        <label class="field">Room name <input id="room-name-input" maxlength="24" autocomplete="off" placeholder="Cozy room" value="${esc(save.roomName ?? '')}"></label>
        <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
      break;
    case 'book': openBook(); break;
    case 'book-day': openBook(Number(btn.dataset.day)); break;
    case 'trophies': openTrophies(); break;
    case 'travel': travelBack = 0; openTravel(id, 0); break;
    case 'travel-month': openTravel(id, Math.max(0, travelBack + Number(btn.dataset.step))); break;
    case 'travel-day': {
      const day = Number(btn.dataset.day);
      const on = save.state.tasks.find((k) => k.id === id)?.doneDays.includes(day);
      if (act((s, at) => setTaskDay(s, id, day, !on, at), on ? `Unmarked ${fmtDay(day)}.` : `Marked ${fmtDay(day)} as done.`)) openTravel(id);
      break;
    }
    case 'clock-toggle': $('clock-pop').classList.toggle('open'); break;
    case 'modal-close': if (ev.target === btn) closeModal(); break;
    case 'delete-task-yes':
      save.state = removeMindfulTask(save.state, id);
      persist(); closeModal(); renderTasks(); toast('Kibble deleted.');
      break;
    case 'cat-alarm-clear': {
      const alarms = { ...reminderSettings().catAlarms };
      delete alarms[id];
      setReminders({ catAlarms: alarms });
      break;
    }
    case 'save-file': exportBackup(); break;
    case 'restore-yes': restoreBackup(); break;
    case 'save-copy': {
      const text = JSON.stringify(gameOnly());
      ($('save-text') as HTMLTextAreaElement).value = text;
      navigator.clipboard?.writeText(text).then(() => toast('Copied. Paste it somewhere safe.'), () => toast('Select the text below and copy it.'));
      break;
    }
    case 'load-text': loadSave(($('save-text') as HTMLTextAreaElement).value); break;
    case 'load-file': $('load-file').click(); break;
    case 'month':
      viewMonth.set(id, Math.max(0, (viewMonth.get(id) ?? 0) + Number(btn.dataset.step)));
      renderHeat();
      if (menuCat === id) openCatMenu(id);
      break;
    case 'skip': {
      const before = save.log.length ? save.log[0] : null;
      save.offsetHours += Number(btn.dataset.hours);
      settle();
      persist();
      renderAll();
      const news = save.log[0] && save.log[0] !== before ? save.log[0].text : null;
      toast(news ?? `Skipped to ${now().toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.`);
      break;
    }
    case 'real-time':
      save.offsetHours = 0;
      persist();
      renderAll();
      toast('Back to real time. Days you skipped still count.');
      break;
    case 'reset-ask':
      $('reset-area').innerHTML = `<span>Delete all cats and progress?</span>
        <button class="btn small" data-action="reset-yes">Delete</button><button class="btn small" data-action="reset-no">Keep</button>`;
      break;
    case 'reset-yes':
      save = fresh();
      setDayStart(save.dayStart);
      lastLevel = null;
      diaryReady = true;
      clearDiaryFiles();
      persist();
      renderAll();
      toast('Fresh start.');
      // fall through to restore the link
    case 'reset-no':
      $('reset-area').innerHTML = '<button class="linkish" type="button" data-action="reset-ask">Start over</button>';
      break;
  }
});

// A game save from a backup or pasted text, or null when it isn't one.
function validGame(d: any): Save | null {
  if (d?.v !== 1 || !Array.isArray(d.state?.cats) || !Array.isArray(d.state?.tasks) || typeof d.state.xp !== 'number') return null;
  const { diary, ...game } = d;
  return { ...game, log: Array.isArray(d.log) ? d.log : [], offsetHours: Number(d.offsetHours) || 0 };
}

// Game only: the diary and photos on this device stay as they are.
function loadSave(raw: string) {
  const err = $('save-error');
  try {
    const g = validGame(JSON.parse(raw));
    if (!g) throw new Error();
    save = normalize({ ...g, diary: save.diary });
    lastLevel = null;
    err.hidden = true;
    persist(); settle(); renderAll();
    toast('Save loaded.');
  } catch { err.textContent = "That doesn't look like a Habit Kitty save."; err.hidden = false; }
}

$('allow-rename').addEventListener('change', (ev) => {
  save.allowRename = (ev.target as HTMLInputElement).checked;
  persist();
  toast(save.allowRename ? 'Kitties can be renamed from their long-press menu.' : 'Kitty names are locked.');
});
$('show-clock').addEventListener('change', (ev) => {
  save.showClock = (ev.target as HTMLInputElement).checked;
  persist(); renderSaved();
});
$('time-travel').addEventListener('change', (ev) => {
  save.timeTravel = (ev.target as HTMLInputElement).checked;
  persist(); renderTasks();
  toast(save.timeTravel ? 'Time travel on. Every treat and kibble now has a rewind button.' : 'Time travel off.');
});
$('unlimited-cats').addEventListener('change', (ev) => {
  save.unlimited = (ev.target as HTMLInputElement).checked;
  persist();
  toast(save.unlimited ? 'Unlimited kitties on. You will be asked three times for every kitty past 9.' : `Back to a limit of ${CONFIG.maxCats} kitties.`);
});

for (const id of ['day-start', 'day-end']) $(id).addEventListener('change', (ev) => setDayBoundary(Number((ev.target as HTMLSelectElement).value)));
$('reminder-on').addEventListener('change', (ev) => setReminderEnabled((ev.target as HTMLInputElement).checked));
$('last-call').addEventListener('change', async (ev) => {
  const v = (ev.target as HTMLSelectElement).value as LastCall;
  if (v !== 'off' && !await ensureNotifications()) { setReminders({ lastCall: 'off' }); return; }
  setReminders({ lastCall: v });
  toast(v === 'off' ? 'Last-call alerts off.' : 'Last-call alerts on. They only go out for kitties that are still hungry.');
});
$('cat-alarms').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const id = input.dataset.catAlarm;
  if (!id) return;
  const alarms = { ...reminderSettings().catAlarms };
  const [h, m] = input.value.split(':').map(Number);
  if (Number.isInteger(h) && Number.isInteger(m)) {
    if (!await ensureNotifications()) { renderReminder(); return; }
    alarms[id] = { hour: h, minute: m };
    toast(`Alarm set: ${save.state.cats.find((c) => c.id === id)?.name ?? 'your kitty'} at ${input.value}.`);
  } else delete alarms[id];
  setReminders({ catAlarms: alarms });
});
$('reminder-time').addEventListener('change', (ev) => {
  const [h, m] = (ev.target as HTMLInputElement).value.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return;
  save.reminder = { ...reminderSettings(), hour: h, minute: m };
  persist(); renderReminder();
  toast(`Reminder time set to ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}.`);
});
document.addEventListener('change', (ev) => {
  const sel = ev.target as HTMLSelectElement;
  if (sel.dataset?.gender !== undefined) { draftGender = sel.value as CatGender; redrawLook(); return; }
  const key = sel.dataset?.look;
  if (!key) return;
  draftLook = { ...draftLook, [key]: sel.value } as CatLook;
  redrawLook();
});
// The file input lives inside the diary dialog, so listen on the document.
document.addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.id !== 'diary-file') return;
  const f = input.files?.[0];
  input.value = '';
  if (!f || !diaryDraft) return;
  const err = $('diary-error');
  try {
    err.hidden = true;
    showPhotoBusy('Shrinking photo…');
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));   // let the bar paint before the heavy work
    setDraftPhoto(await compressPhoto(f));
  } catch { setDraftPhoto(diaryDraft?.photo ?? null); err.textContent = "Couldn't read that photo. Try a different one."; err.hidden = false; }
});

$('load-file').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  const err = $('save-error');
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (!isZip(bytes)) { loadSave(new TextDecoder().decode(bytes)); return; }
  try { err.hidden = true; askRestore(unpackBackup(bytes)); }
  catch { err.textContent = "That doesn't look like a Habit Kitty backup."; err.hidden = false; }
});

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.target as HTMLFormElement;
  if (form.id === 'diary-form') { saveDiary(); return; }
  if (form.id === 'adopt') {
    const name = ($('adopt-name') as HTMLInputElement).value;
    const habit = ($('adopt-habit') as HTMLInputElement).value;
    const mode = (form.querySelector('input[name="mode"]:checked') as HTMLInputElement).value as CatMode;
    const input = { id: uid(), name, mode, look: draftLook, gender: draftGender, unlimited: !!save.unlimited };
    const r = adoptFrom ? habitToCat(save.state, adoptFrom, input, now()) : adoptCat(save.state, { ...input, habit }, now());
    save.state = r.state;
    logEvents(r.events);
    persist();
    renderAll();
    if (!r.ok) { const err = $('adopt-error'); err.textContent = reasonText(r.reason); err.hidden = false; return; }
    closeModal();
    toast(adoptFrom ? `${name.trim()} is a kitty now, and remembers your history.` : `Welcome home, ${name.trim()}! Feed them today.`);
    adoptFrom = null;
  } else if (form.id === 'rename-cat') {
    const id = form.dataset.id ?? '';
    const name = ($('rename-cat-input') as HTMLInputElement).value.trim();
    if (!name || !save.allowRename) return;
    save.state = { ...save.state, cats: save.state.cats.map((c) => (c.id === id ? { ...c, name } : c)) };
    persist(); closeModal(); renderAll(); toast('Kitty renamed.');
  } else if (form.id === 'rename') {
    const id = form.dataset.id ?? '';
    const name = ($('rename-input') as HTMLInputElement).value.trim();
    if (!name) return;
    save.state = {
      ...save.state,
      cats: save.state.cats.map((c) => (c.id === id ? { ...c, habit: name } : c)),
      tasks: save.state.tasks.map((k) => (k.id === id ? { ...k, name } : k)),
    };
    persist(); closeModal(); renderAll(); toast('Habit renamed.');
  } else if (form.id === 'room-name') {
    save.roomName = ($('room-name-input') as HTMLInputElement).value.trim() || undefined;
    persist(); closeModal(); renderRoomTitle(); toast('Room renamed.');
  } else if (form.id === 'task-form') {
    const input = $('task-name') as HTMLInputElement;
    const kind = mindfulView;
    if (!input.value.trim()) { toast(`Name the ${kind === 'habit' ? 'treat' : 'kibble'} first.`); return; }
    const rep = ($('task-repeat') as HTMLSelectElement).value;
    const weekdays = rep === 'weekdays'
      ? [...form.querySelectorAll<HTMLInputElement>('input[name="weekday"]:checked')].map((c) => Number(c.value)) : [];
    if (rep === 'weekdays' && !weekdays.length) { toast('Pick at least one weekday.'); return; }
    const days = rep === 'custom' ? Number(($('task-days') as HTMLInputElement).value) : Number(rep);
    save.state = addMindfulTask(save.state, {
      id: uid(), name: input.value, kind, xp: Number(($('task-xp') as HTMLInputElement).value) || 1, cooldownDays: days || 1, weekdays,
    }, now());
    input.value = '';
    form.querySelectorAll<HTMLInputElement>('input[name="weekday"]').forEach((c) => { c.checked = false; });
    persist();
    renderAll();
    toast(kind === 'task' ? 'Kibble added.' : 'Treat added.');
  }
});

document.addEventListener('click', (ev) => {
  if (!(ev.target as HTMLElement).closest('#clock-pop')) $('clock-pop').classList.remove('open');
});

$('task-repeat').addEventListener('change', () => renderTasks());

// Keys in a small dialog: Escape closes it, Tab stays inside it, arrows move around the month and year grids.
const GRID_STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
document.addEventListener('keydown', (ev) => {
  const layer = document.getElementById('layer');
  if (!layer) return;
  if (ev.key === 'Escape') { ev.preventDefault(); closeLayer(); return; }
  const at = document.activeElement as HTMLButtonElement;
  if (ev.key === 'Tab') {
    const all = [...layer.querySelectorAll<HTMLElement>('button:not(:disabled)')];
    const i = all.indexOf(at);
    const to = ev.shiftKey ? (i <= 0 ? all[all.length - 1] : null) : (i === -1 || i === all.length - 1 ? all[0] : null);
    if (to) { ev.preventDefault(); to.focus(); }
    return;
  }
  const grid = at?.closest('.pick-grid');
  if (!GRID_STEP[ev.key] || !grid) return;
  ev.preventDefault();
  const cells = [...grid.querySelectorAll<HTMLButtonElement>('button')];
  const next = cells[cells.indexOf(at) + GRID_STEP[ev.key]];
  if (next && !next.disabled) next.focus();
});

// Press and hold a task or a cat. Android also fires `contextmenu` on a long press (and then cancels
// the pointer), so that counts as the hold too; whichever comes first wins.
const HOLD_MS = 500;
let holdTimer = 0;
let holdEl: HTMLElement | null = null;
let holdFrom = { x: 0, y: 0 };

function endHold() { clearTimeout(holdTimer); holdEl?.classList.remove('pressing'); holdEl = null; }

function askDeleteTask(id: string) {
  const task = save.state.tasks.find((k) => k.id === id);
  if (!task) return;
    openModal(`<div class="panel"><h3>Delete this ${task.kind === 'habit' ? 'treat' : 'kibble'}?</h3><p>${esc(task.name)}</p>${task.kind === 'habit' && task.doneDays.length ? '<p class="muted">Its history will be lost.</p>' : ''}
      <div class="btns"><button class="btn" data-action="modal-close">Keep</button>
      <button class="btn primary" data-action="delete-task-yes" data-id="${id}">Delete</button></div></div>`);
}

function fireHold(el: HTMLElement) {
  endHold();
  const id = el.dataset.id ?? el.dataset.task ?? '';
  if (el.dataset.hold === 'cat') openCatMenu(id, 'diary');
  else askDeleteTask(id);
}

// Long press on a kitty: the same card as Today on top, then Diary (the default) / Heatmap / Options tabs.
type MenuTab = 'options' | 'heat' | 'diary';
let menuCat: string | null = null;
let menuTab: MenuTab = 'diary';
const MENU_TABS: Record<MenuTab, string> = { diary: 'Diary', heat: 'Heatmap', options: 'Options' };

function catDiaryHtml(cat: Cat): string {
  if (cat.status !== 'alive') return `<p class="muted">${esc(cat.name)} isn't home, so there is nothing to write about.</p>`;
  const clockNow = now().getHours() * 60 + now().getMinutes();
  const lines = catDiary(cat, save.state.cats, today()).filter((l) => l.minute <= clockNow);
  return lines.length
    ? `<ul class="catlog">${lines.map((l) => `<li><span class="num">${clock(l.minute)}</span> ${esc(l.text)}</li>`).join('')}</ul>`
    : `<p class="muted">Nothing happened yet today.</p>`;
}

function openCatMenu(id: string, tab?: MenuTab) {
  const cat = save.state.cats.find((c) => c.id === id);
  if (!cat) return;
  if (tab) menuTab = tab;
  menuCat = id;
  const away = cat.status === 'sitter';
  const sitterBtn = cat.status === 'alive'
    ? `<button class="btn" data-action="sitter-ask" data-id="${id}">Pet sitter</button>`
    : away ? `<button class="btn" data-action="resume" data-id="${id}">Bring ${esc(cat.name)} home</button>` : '';
  const pane = menuTab === 'heat'
    ? (cat.status === 'ranAway' ? `<p class="muted">${esc(cat.name)} ran away.</p>` : renderMonth(cat, today()) + HEAT_LEGEND)
    : menuTab === 'diary' ? catDiaryHtml(cat)
    : `<div style="display:grid;gap:8px">${sitterBtn}
      <button class="btn" data-action="rename-habit" data-id="${id}">Rename habit</button>
      ${save.allowRename ? `<button class="btn" data-action="rename-cat" data-id="${id}">Rename ${esc(cat.name)}</button>` : ''}
      <button class="btn" data-action="shelter-ask" data-id="${id}">Return to the shelter</button></div>`;
  openModal(`<div class="panel"><button class="x-close" type="button" data-action="modal-close" aria-label="Close">${iconSvg('x')}</button>
    ${catHead(cat, today(), false)}
    <div class="seg" role="tablist">${(Object.keys(MENU_TABS) as MenuTab[]).map((v) =>
      `<button type="button" role="tab" data-action="menu-tab" data-view="${v}" data-id="${id}" aria-selected="${v === menuTab}">${MENU_TABS[v]}</button>`).join('')}</div>
    ${pane}</div>`);
}

const holdTarget = (ev: Event) => (ev.target as HTMLElement).closest<HTMLElement>('[data-hold], li[data-task]');
document.addEventListener('pointerdown', (ev) => {
  const el = holdTarget(ev);
  if (!el || (ev.target as HTMLElement).closest('button')) return;
  endHold();
  holdEl = el;
  holdFrom = { x: ev.clientX, y: ev.clientY };
  el.classList.add('pressing');
  holdTimer = window.setTimeout(() => fireHold(el), HOLD_MS);
});
document.addEventListener('pointermove', (ev) => {
  if (holdEl && Math.hypot(ev.clientX - holdFrom.x, ev.clientY - holdFrom.y) > 12) endHold();
});
document.addEventListener('pointerup', endHold);
// Android cancels the pointer when its own long-press fires, so a cancel must not abort the hold;
// only an actual scroll does.
document.addEventListener('scroll', endHold, true);
document.addEventListener('contextmenu', (ev) => {
  const el = holdTarget(ev);
  if (!el) return;
  ev.preventDefault();
  fireHold(el);
});

// Re-settle when the page comes back and at each 2am rollover.
function tick() { settle(); renderAll(); queueReminderSync(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
function scheduleRollover() {
  setTimeout(() => { tick(); scheduleRollover(); }, Math.min(nextReset(now()).getTime() - now().getTime() + 1000, 60_000));
}

const diaryLoading = loadDiary();
settle();
renderAll();
showTab('today');
openWidgetTab();
scheduleRollover();
showWhatsNew();
connectAccount();
queueReminderSync();
