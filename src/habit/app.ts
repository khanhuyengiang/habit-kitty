// Phone playtest build of Habit Kitty. Bundled into one HTML page by `npm run build:web`.
import {
  CONFIG, newState, adoptCat, feedCat, startSitter, resumeCat, settleAll, addMindfulTask,
  doMindfulTask, setTaskDay, setCatDay, replay, rewind, genderOf, daysUntilReady, removeMindfulTask, setHabitSchedule, returnToShelter, habitToCat, releaseToColony, strayVisible, strayWindow, strayNameOf, idHash, dayIndex, dayStartHour, setDayStart, nextReset, levelProgress, hunger, sitterCooldownLeft,
  type ActionResult, type AppState, type Cat, type CatMode, type CatGender, type CatLook, type CatTrait, type GameEvent, type MindfulTask, type Reason, type TaskKind,
} from './rules.ts';
import { BACKUP_EXT, BACKUP_PREFIX, backupNow, backupStatus, chooseFolder, folderBackups, markDirty, nativeBackups, onBackupStatus, readFolderBackup, refreshFolder, registerBackupSource, saveBackupToDevice, saveToDevice, shareBackup as shareBackupFile, shareFile, stopBackups } from '../shared/backupfolder.ts';
import { achievementCount, restoreAchievement, snapshotAchievement } from '../achievement/save.ts';
import { PICKER_ICONS, iconLabel, stickerSvg } from '../shared/stickers.ts';
import type { LastCall, ReminderSettings } from './reminders.ts';
import { allCatsDiary, catDiary, clock } from './catdiary.ts';
import { fedMessage } from './encourage.ts';
import { accomplishments } from './accomplishments.ts';
import { entriesSince, parseChangelog, type ChangeEntry } from './changelog.ts';
import { VERSION } from '../shared/version.ts';
import CHANGELOG_MD from '../../CHANGELOG.md';
import { pickThought, type ThoughtKind } from './thoughts.ts';
import { isZip, packBackup, unpackBackup, type Backup } from '../backup.ts';
import type { Mood } from '../diary/model.ts';
import { CONFETTI_COLORS, TRAITS, TRAIT_TEXT, BODY_H, BODY_W, FACE_W, NAP_H, NAP_W, bodySvg, faceSvg, miniSvg, napSvg, runSvg, jumpSvg, spriteBox, RUN_STYLES, lookOf, popperSvg, randomLook, type Face, type RunStyle } from '../shared/pixelcat.ts';
import type { Spot } from '../shared/scene.ts';
import { CatMover, routeBetween } from './moves.ts';
import { surfacesFromSpots } from './surfaces.ts';
import { GARDEN_SPOTS, MARKS, ROOM_H, ROOM_NIGHT_SPOTS, ROOM_SPOTS, ROOM_W, SHELF_BOOK, SHELF_TROPHY, TROPHY_ART, artSvg, petHeartSvg, iconSvg, markSvg, outdoorSvg, roomSvg, sceneVersion } from '../shared/art.ts';
import { GO_EVENT, TAB_EVENT, habitKittySvg, onAppShown, onShown, trophyIcon, type AppName } from '../shared/apps.ts';
import { mountDiarySettings } from '../diary/settings.ts';
import { collectBooks, collectNotes, initNotes, restoreBooks, restoreNotes } from '../notes/data.ts';
import { mountNotesSettings } from '../notes/settings.ts';
import { mountPixelSettings } from '../pixel/settings.ts';
import { change as changeShop, collectShopping, initShopping, restoreShopping, shopData, shopInitialised } from '../shopping/data.ts';
import { applyMartSettings, martSettingsOf } from '../shopping/model.ts';
import { collectPixel, initPixel, restorePixel, setPixelData } from '../pixel/data.ts';
import { PARTS, SETTINGS_EXT, SETTINGS_PREFIX, cleanDiary, isSettingsText, readSettings, settingsText, type HabitSettings, type Part, type SettingsFile } from '../settings-file.ts';
import { backupName } from '../shared/backup-schedule.ts';
import { mountLookSettings } from './look.ts';
import { publishHabitStats } from '../shared/stats.ts';
import { meterHtml } from '../shared/meter.ts';
import { hpLine } from '../shared/stat-lines.ts';
import { collectDiary, diaryExtras, diaryInitialised, initDiary, pageCount, restoreDiary, updateExtras } from '../diary/data.ts';
import { $, esc, plural } from '../shared/html.ts';
import { newId } from '../shared/id.ts';
import { makeLayer } from '../shared/layer.ts';
import { readJson, writeJson } from '../shared/local.ts';
import { pickerHtml } from '../shared/picker.ts';
import { backButton, closeX, fancyOn, homeButton, playerButton, setFancy, setThemeMode, settingsButton, showToast, themeMode, titleBar } from '../shared/ui.ts';
import { ensureNotifications, initReminders, queueReminderSync, reminderSettings, renderReminder, setReminderEnabled, setReminders } from './notify.ts';
import { initWidget, openWidgetTab, queueWidget, type WidgetPhase } from './widget.ts';
import { initSound, playSound, renderSound, syncMusic, toggleMute, useDefaultMusic, type SoundKind } from './sound.ts';
import { firstDay, habitStreak, monthGrid, streak, weekRow, type DayKind, type Trackable } from './calendar.ts';
import { dateOf, dayOf } from '../shared/dates.ts';

// ===================== Save =====================
interface LogLine { at: number; text: string }
interface Save {
  v: 1; state: AppState; offsetHours: number; log: LogLine[]; savedAt: number; logHidden?: boolean; unlimited?: boolean; roomName?: string; outdoorName?: string; allowRename?: boolean; showClock?: boolean;
  trackamaniac?: boolean;              // only in v0.5.0 backups, which kept the diary settings here (restoreDiary takes them)
  moodNames?: Partial<Record<Mood, string>>;   // likewise
  reminder?: ReminderSettings;
  returned?: Record<string, number>;   // cat id -> day it last came home (feeds the "welcome back" thoughts)
  timeTravel?: boolean;                // lets kitties, stray kitties and treats be marked fed or done on past days
  amnesia?: boolean;                   // asks about meals forgotten yesterday on the first open of a day
  amnesiaDay?: number;                 // the day Amnesia last asked
  accomplished?: Record<string, number>;   // accomplishment id -> day it was unlocked
  seenVersion?: string;                // last app version whose change log was shown
  sound?: Partial<Record<SoundKind, number>>;   // volume per sound, 0..100 (see SOUND_DEFAULTS)
  muted?: boolean;                    // every sound off, the volumes kept for when it is turned back on
  strayLeft?: Record<string, number>;  // stray id -> garden window it wandered off in after being fed
  dayStart?: number;                   // hour the day starts (and the one before ends), 0..CONFIG.dayStartMax; CONFIG.resetHour when unset
}

const KEY = 'habit-kitty-save-v1';
const fresh = (): Save => ({ v: 1, state: newState(), offsetHours: 0, log: [], savedAt: 0, accomplished: {}, seenVersion: VERSION });

function readLocal() { return readJson<Save>(KEY); }

// Every day index from here on follows the save's day start; and a task's XP never goes over the most it can be.
function normalize(sv: Save): Save {
  setDayStart(sv.dayStart);
  const tasks = (sv.state.tasks ?? []).map((k) => ({ ...k, xp: Math.min(k.kind === 'task' ? CONFIG.taskMaxXp : CONFIG.habitMaxXp, k.xp) }));
  return { ...sv, state: { ...sv.state, tasks } };
}

let save: Save = normalize(readLocal() ?? fresh());

// Optional account sync: only viewers who can write their own data get it.
type DocRef = { get(): Promise<{ exists: boolean; data(): unknown }>; set(d: object): Promise<void> };
let remote: DocRef | null = null;
let writing: Promise<void> = Promise.resolve();

function persist() {
  save.savedAt = Date.now();
  markDirty(BACKUP_PREFIX);
  publishStats();
  queueReminderSync();
  writeJson(KEY, save);   // private mode: keep playing in memory
  if (remote) {
    const ref = remote;
    const body = JSON.parse(JSON.stringify(save));
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
      save = normalize(theirs);
      writeJson(KEY, save);
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
const catName = (id: string) => save.state.cats.find((c) => c.id === id)?.name ?? 'Your cat';
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
      return 'Your affection is below 0, so cats only trust you with one at a time. Feed your cat, feed a stray or do treats to earn it back.';
    case 'future_day': return "That day hasn't happened yet.";
    case 'before_adoption': return `${n} wasn't with you yet that day.`;
    case 'task_on_cooldown': return 'You did this one recently. It comes back after its repeat time.';
    case 'task_already_done': return 'This treat is already done. Press and hold it to delete it.';
    case 'not_daily_habit': return 'Only daily habits can become a kitty.';
    case 'cat_limit': return `You can keep ${CONFIG.maxCats} kitties. Turn on Unlimited kitties in Settings if you really want more.`;
    case 'cat_not_active': return `${n} isn't here anymore.`;
    case 'no_such_cat': case 'no_such_task': return 'That no longer exists.';
  }
}

const xpChange = (before: number) =>
  save.state.xp === before ? 'Affection unchanged.' : `Affection ${before} → ${save.state.xp}.`;

function logEvents(events: GameEvent[]) {
  const at = now().getTime();
  for (const e of events) {
    save.log.unshift({ at, text: eventText(e) });
    if (e.type === 'returned') save.returned = { ...save.returned, [e.catId]: today() };
  }
  if (events.length) save.logHidden = false;
  save.log = save.log.slice(0, 8);
}

const toast = (text: string) => showToast($('toast'), text);

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

// The playtest clock. Going forward plays the days out like real time. Going back to an earlier day rewinds:
// anything logged after it is forgotten and every kitty is as hungry as it was then. True when it went back.
function moveClock(offsetHours: number): boolean {
  const from = today();
  save.offsetHours = offsetHours;
  const back = today() < from;
  if (back) save.state = rewind(save.state, now()); else settle();
  persist();
  renderAll();
  if (!back) checkAmnesia();
  return back;
}

// Amnesia: the first time the app is open on a new day, ask about kitties that went unfed yesterday, in case a
// meal wasn't logged. Saying yes marks it like time travel does, so a kitty lost to that missed meal comes back.
function checkAmnesia() {
  const t = today(), y = t - 1;
  if (!save.amnesia || save.amnesiaDay === t || !$('modal').hidden) return;   // a dialog is open: ask once it closes
  save.amnesiaDay = t;
  persist();
  const forgot = save.state.cats.filter((c) => c.adoptedDay <= y && !c.fedDays.includes(y)
    && (c.status === 'alive' || (['dead', 'ranAway', 'leftForever'].includes(c.status) && c.endedDay === t))
    && !c.sitterTrips.some((tr) => tr.start < y && (tr.end === null || tr.end > y)));
  if (!forgot.length) return;
  openModal(`<div class="panel"><h3>Did you feed a kitty yesterday?</h3>
    <p>Nothing was logged for ${forgot.length === 1 ? 'this kitty' : 'these kitties'} on ${fmtDay(y)}. Tick any you did feed and forgot to log.</p>
    ${forgot.map((c) => `<label class="check"><input type="checkbox" data-forgot="${c.id}"><span><b>${esc(c.name)}</b><br><span class="muted">${esc(c.habit)}${c.status === 'alive' ? '' : ` · ${c.status === 'dead' ? 'lost' : 'ran off'} last night`}</span></span></label>`).join('')}
    <div class="btns"><button class="btn" data-action="modal-close">No, all logged</button>
    <button class="btn primary" data-action="amnesia-yes">Log as fed</button></div></div>`);
}

// ===================== Pixel cats =====================
const sprite = faceSvg;
const lookFor = lookOf;
const hash = idHash;

// Pixel heart for petting.
const HEART = petHeartSvg();

document.documentElement.style.setProperty('--face-w', String(FACE_W));   // the cat card's picture column follows the art

// Static buttons in the page template name their icon with data-icon; draw them on the same pixel grid.
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', el.dataset.icon === 'cat' ? habitKittySvg() : el.dataset.icon === 'trophy' ? trophyIcon() : iconSvg(el.dataset.icon ?? 'x')));

// ===================== Food =====================
const pixelArt = (art: string[], cls = '') => artSvg(art, `pixart ${cls}`);
// A different treat for every cat, every day (stable within the day), from every sticker the kitties can eat (Kitty
// Gallery's too: "Can kitty eat this?"). With none at all, a heart.
const foodFor = (c: { id: string }, day: number) => {
  const keys = Object.keys(PICKER_ICONS).filter((k) => PICKER_ICONS[k].food);
  return keys.length ? keys[hash(`${c.id}:${day}`) % keys.length] : 'heart';
};
// Drawn as a sticker, 18 × 18 with its outline; one that is gone (deleted in Kitty Gallery) is a heart.
const foodIcon = (kind: string) => stickerSvg(kind, 1, 'food');
const foodName = (kind: string) => iconLabel(kind).toLowerCase();

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

// What the home page shows for HP (affection); the diary publishes its own days (MP).
const publishStats = () => publishHabitStats({ xp: save.state.xp, offsetHours: save.offsetHours });

function renderTop() {
  publishStats();
  const { level } = levelProgress(save.state.xp);
  if (lastLevel !== null && level > lastLevel) celebrate(level);
  lastLevel = level;
  if (tab === 'settings') {   // the one Settings screen, reached from every app's gear
    $('top').innerHTML = titleBar('Kitty', 'Settings', backButton('settings-back') + homeButton());
    return;
  }
  $('top').innerHTML = `${titleBar('Habit', 'Kitty', homeButton() + playerButton() + settingsButton('data-action="settings-open"'))}
    ${meterHtml('hp', 'HP', hpLine(save.state.xp))}
    ${save.state.xp < CONFIG.lowXpThreshold
      ? '<p class="distrust">Your affection is below 0. Until it recovers, you can only keep one cat.</p>' : ''}
    ${navHtml()}`;
}

function renderLog() {
  const el = $('log');
  el.hidden = !save.log.length || !!save.logHidden;
  el.innerHTML = `<button class="x" type="button" data-action="log-close" aria-label="Close update">${iconSvg('x')}</button>
    <h2>Update · what happened</h2><ul class="log-list">${save.log.map((l) =>
    `<li><time class="num">${new Date(l.at).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</time>${esc(l.text)}</li>`).join('')}</ul>`;
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

// Previous / title / next for a heatmap month; `shown` and `first` are the first days of the month on show and of the earliest one.
function monthNav(key: string, shown: Date, title: string, first: Date, atStart: boolean, back: number): string {
  return `<div class="month-nav">
      <button type="button" data-action="month" data-id="${key}" data-step="1" ${atStart ? 'disabled' : ''} aria-label="Previous month">${iconSvg('prev')}</button>
      ${monthTitle(key, shown.getUTCFullYear(), shown.getUTCMonth(), title, first.getUTCFullYear() * 12 + first.getUTCMonth())}
      <button type="button" data-action="month" data-id="${key}" data-step="-1" ${back === 0 ? 'disabled' : ''} aria-label="Next month">${iconSvg('next')}</button>
    </div>`;
}

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
    ${monthNav(c.id, shown, g.title, firstMonth, atStart, back)}
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

// The line under a week row: what was done so far, and (with Time travel on) the rewind button: the same on a kitty, a stray and a treat.
const catFoot = (c: Cat, t: number) => `<p class="muted habit-foot">${c.fedDays.length ? `Fed ${plural(c.fedDays.length, 'time')}` : 'Not fed yet'}${c.status === 'alive' ? ` · streak ${streak(c, t)}` : ''}${save.timeTravel ? ` ${TRAVEL(c.id)}` : ''}</p>`;

function renderCats() {
  const t = today();
  $('adopt-btn').hidden = todayView !== 'home';   // Pet sitter and Memory only list the kitties that are away or gone
  const all = sortedCats();
  if (!all.length && todayView === 'home') {
    $('cats').innerHTML = `<div class="cat"><div class="cat-head">${sprite('open', { fur: '#e8a04c', pattern: 'plain' }, true)}
      <div><p class="cat-name">No cats yet</p><p class="cat-habit">Tap Adopt kitty to get your first one.</p></div></div></div>`;
    return;
  }
  const cats = all.filter((c) => viewOf(c) === todayView);
  if (todayView === 'memories') cats.sort((a, b) => Number(b.status === 'ranAway') - Number(a.status === 'ranAway') || (b.endedDay ?? 0) - (a.endedDay ?? 0));
  if (!cats.length) {
    const msg = { home: 'Nobody is home right now.', sitter: 'No cats with the pet sitter.', memories: 'No cats have left yet.' }[todayView];
    $('cats').innerHTML = `<p class="muted hint-c">${msg}</p>`;
    return;
  }
  $('cats').innerHTML = cats.map((c) => {
    const s = catStatus(c, t);
    const ended = !isActive(c);
    return `<article class="cat${ended ? ' ended' : ''}">
      ${catHead(c, t, c.status === 'ranAway' || !ended)}
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
      ${todayView === 'memories' ? renderLife(c, t) : renderWeek(c, t) + catFoot(c, t)}
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
    ${monthNav(key, shown, g0.title, fm, atStart, back)}
    <div class="grid" role="img" aria-label="${title}, ${g0.title}">${cells}</div>
    <div class="slice-key" style="grid-template-columns:repeat(${cols},auto)">${keyHtml}</div>
    <p class="stats">${note}</p>
  </div></article>`;
}

const combinedCats = (cats: Cat[], t: number) => renderCombined(cats, 'all', 'All cats',
  cats.map((c, i) => `<span><b class="num">${i + 1}</b>${miniSvg(catStatus(c, t).face, lookFor(c), !isActive(c) && c.status !== 'dead')}${esc(c.name)}</span>`).join(''),
  'Each day is split into one slice per cat, in the order shown above.');

const combinedHabits = (habits: MindfulTask[]) => renderCombined(habits.map(habitSubject), 'all-habits', 'All stray kitties',
  habits.map((h, i) => `<span><b class="num">${i + 1}</b>${esc(h.name)}</span>`).join(''),
  'Each day is split into one slice per habit, in the order shown above.');

const HEAT_LEGEND = `<div class="legend"><span><i class="fed"></i>fed</span><span><i class="habit"></i>done as a habit</span>
  <span><i class="missed"></i>missed</span><span><i class="today"></i>today (outlined)</span><span><i class="sitter"></i>with sitter</span><span><i></i>not tracked</span></div>`;

function renderHeat() {
  if (heatMode === 'strays') {
    const habits = save.state.tasks.filter((k) => k.kind === 'habit');
    $('heat').innerHTML = (habits.length ? combinedHabits(habits) : '<p class="muted">No stray kitties yet.</p>') + HEAT_LEGEND +
      '<p class="muted hint-c">Press and hold a stray kitty to see just its heatmap.</p>';
    return;
  }
  const cats = heatCats();
  $('heat').innerHTML = (cats.length ? combinedCats(cats, today()) : '<p class="muted">No living cats to show.</p>') + HEAT_LEGEND +
    '<p class="muted hint-c">Press and hold a kitty to see just its heatmap.</p>';
}

// ---- cozy room: lives in real time (sky follows the clock, cats wander, sleep at night) ----
// Positions are [x, feet-y] in room pixels (240 x 320, see scene.ts); a cat is BODY_W pixels wide and BODY_H tall, the same pixels as the room.
const PET_W = BODY_W, PET_H = BODY_H;
const SPOTS = ROOM_SPOTS, NIGHT_SPOTS = ROOM_NIGHT_SPOTS;
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
// The diary book and the trophy on the wall shelf (drawn in roomSvg); these are their click areas, in room pixels.
const prop = (action: string, label: string, [x, y, w, h]: [number, number, number, number]) =>
  `<button class="prop" type="button" data-action="${action}" aria-label="${label}" style="left:calc(${x} * var(--px));top:calc(${y} * var(--px));width:calc(${w} * var(--px));height:calc(${h} * var(--px))"></button>`;
// Where they stand can change (a room drawn in Kitty Gallery puts them elsewhere), so they are placed on every draw.
const props = () => prop('book', "Kitty diary: everyone's day", SHELF_BOOK) + prop('trophies', 'Accomplishments', SHELF_TROPHY);

// Cats that are away (sitter, ran away) aren't home, so they aren't in the room.
const homeCats = () => sortedCats().filter((c) => c.status === 'alive').slice(0, SPOTS.length);

// The room tab has two rooms: the cozy room (kitties) and the outdoors (strays, who only turn up now and then).
type RoomView = 'indoor' | 'outdoor';
let roomView: RoomView = 'indoor';

function renderRoom() {
  $('room').hidden = roomView !== 'indoor';
  $('outdoor').hidden = roomView !== 'outdoor';
  if (roomView === 'outdoor') renderOutdoor(); else renderIndoor();
}

function renderIndoor() {
  const t = today();
  const phase = skyPhase();
  const pets = homeCats();
  const asleep = asleepNow();
  const faceOf = (c: Cat): Face => (asleep ? 'sleepy' : catStatus(c, t).face);
  const lookKey = (c: Cat) => Object.values(lookFor(c)).join('');
  const sig = phase + (asleep ? 'z' : '') + sceneVersion() + '|' + pets.map((c) => `${c.id}:${faceOf(c)}:${lookKey(c)}:${c.name}`).join('|');
  renderRoomNote();
  if (sig === roomSig) return;
  roomSig = sig;
  const taken = new Set<number>();
  const spotIdx = (c: Cat, i: number) => {
    let k = (roomPos.get(c.id) ?? i) % SPOTS.length;   // the room may have fewer spots than before
    while (taken.has(k)) k = (k + 1) % SPOTS.length;
    taken.add(k);
    roomPos.set(c.id, k);
    return k;
  };
  $('room').innerHTML = `<div class="room ${phase}">${roomBg(phase)}${props()}${pets.map((c, i) => {
    const pos = asleep ? NIGHT_SPOTS[i] : SPOTS[spotIdx(c, i)];
    const nap = isNapping(c.id, phase, asleep);
    return `<div class="pet${nap ? ' napping' : ''}" data-id="${c.id}" data-fx="${pos[0]}" data-fy="${pos[1]}" data-nap="${nap ? 1 : ''}" data-hold="cat" style="${petStyle(pos, nap)}">${nap ? napSvg(lookFor(c)) : bodySvg(faceOf(c), lookFor(c), hash(c.id))}${nap ? '<b class="zz">z z</b>' : ''}<em>${esc(c.name)}</em></div>`;
  }).join('')}</div>`;
}

// The note under the room shows the time, so it is redrawn every few seconds, not only when the room itself changes.
function renderRoomNote() {
  const clock = now().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  if (roomView === 'outdoor') {
    const n = visibleStrays().length, all = save.state.tasks.filter((k) => k.kind === 'habit').length;
    $('room-note').textContent = !all ? 'No strays live here yet. Add a stray kitty, or release a kitty to the stray colony.'
      : !n ? `It's ${clock}. No strays around right now. They drop by now and then.`
      : `It's ${clock}. ${plural(n, 'stray')} dropped by. Press and hold one to feed it.`;
    return;
  }
  const away = save.state.cats.filter((c) => c.status === 'sitter').length;
  $('room-note').textContent = !homeCats().length
    ? (away ? 'Everyone is with the pet sitter. The room is quiet.' : 'It is quiet in here. Adopt a kitty and they will move in.')
    : `It's ${clock}. ${asleepNow() ? 'Everyone is asleep.' : 'Your cats are making themselves at home.'}${away ? ` ${plural(away, 'cat')} with the sitter.` : ''}`;
}

// ---- outdoors: strays are habits, so there is nothing to save. Each one turns up with a 30% chance every 6 hours, one that is due to be fed today turns up with 80%, and one that is fed leaves with 50%. ----
const OUT_SPOTS = GARDEN_SPOTS;
const strayLook = (k: MindfulTask) => lookFor({ id: k.id, look: k.former?.look });
const strayName = strayNameOf;   // a nickname, a released kitty's name, or a stable one from its id
const strayDoneToday = (k: MindfulTask, t: number) => k.lastDoneDay === t;
// A stray that is due today and not yet fed turns up with an 80% chance and comes first; the rest keep the 30% roll.
// A stray that has turned up stays for the rest of its window, unless it wandered off after being fed.
const strayShown = new Map<string, number>();   // stray id -> window it turned up in
const visibleStrays = () => {
  const w = strayWindow(now()), t = today();
  const strays = save.state.tasks.filter((k) => k.kind === 'habit' && save.strayLeft?.[k.id] !== w);
  const due = (k: MindfulTask) => !strayDoneToday(k, t) && daysUntilReady(k, t) === 0;
  const shown = (k: MindfulTask) => strayShown.get(k.id) === w || strayVisible(k.id, w);
  const list = [...strays.filter((k) => due(k) && (strayShown.get(k.id) === w || strayVisible(k.id, w, CONFIG.strayDueChance))),
    ...strays.filter((k) => !due(k) && shown(k))].slice(0, OUT_SPOTS.length);
  for (const k of list) strayShown.set(k.id, w);
  return list;
};
const shortName = (s: string, n = 14) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
let outdoorSig = '';

function renderOutdoor() {
  const t = today();
  const phase = skyPhase();
  const asleep = asleepNow();
  const strays = visibleStrays();
  const faceOf = (k: MindfulTask): Face => (asleep ? 'sleepy' : strayDoneToday(k, t) ? 'happy' : 'open');
  const sig = phase + (asleep ? 'z' : '') + sceneVersion() + '|' + strays.map((k) => `${k.id}:${faceOf(k)}:${strayName(k)}`).join('|');
  renderRoomNote();
  if (sig === outdoorSig) return;
  outdoorSig = sig;
  $('outdoor').innerHTML = `<div class="room outdoor ${phase}">${outdoorSvg(phase)}${strays.map((k, i) => {
    const pos = OUT_SPOTS[i];
    const look = strayLook(k);
    return `<div class="pet${asleep ? ' napping' : ''}" data-id="${k.id}" data-fx="${pos[0]}" data-fy="${pos[1]}" data-nap="${asleep ? 1 : ''}" data-hold="stray" style="${petStyle(pos, asleep)}">${asleep ? napSvg(look) : bodySvg(faceOf(k), look, hash(k.id))}${asleep ? '<b class="zz">z z</b>' : ''}<em>${esc(shortName(strayName(k)))}</em></div>`;
  }).join('')}</div>`;
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

// A cat that crosses the room runs along whatever it stands on and jumps between surfaces (floor, rug, sofa, cat tree...), with
// the running and jumping sprites standing in for it until it arrives. The surfaces come from the kitty spots (./surfaces.ts),
// the movement from ./moves.ts. Each cat always has the same style (chibi or chonky), picked from its id.
const runStyleOf = (id: string): RunStyle => RUN_STYLES[hash(id) % RUN_STYLES.length];
const spotMid = (s: Spot) => s[0] + PET_W / 2;   // a spot is the cat's left edge; a cat in motion is placed by its middle
const nearestSpot = (x: number, y: number) => SPOTS.reduce((best, s, i) => (Math.hypot(s[0] - x, s[1] - y) < Math.hypot(SPOTS[best][0] - x, SPOTS[best][1] - y) ? i : best), 0);
const spotOf = (el: HTMLElement) => nearestSpot(Number(el.dataset.fx), Number(el.dataset.fy));
function canReach(from: number, to: number) {
  const { surfaces, surfaceOf } = surfacesFromSpots(SPOTS, PET_W);
  return surfaceOf[from] === surfaceOf[to] || !!routeBetween(surfaces, surfaceOf[from], surfaceOf[to]);
}

// Put a cat at a spot at once, with no walk there.
function placeAt(el: HTMLElement, at: [number, number]) {
  el.dataset.fx = String(at[0]);
  el.dataset.fy = String(at[1]);
  el.setAttribute('style', petStyle(at) + ';transition:none');
  void el.offsetWidth;
  el.style.removeProperty('transition');
}

interface Mover { el: HTMLElement; mover: CatMover; style: RunStyle; look: CatLook; shown: string; done: () => void }
const movers = new Set<Mover>();
let lastFrame = 0;

// Draw the cat's pose: swap the sprite when the frame changes, and put its paws where the mover says.
function showPose(mv: Mover, pose: ReturnType<CatMover['update']>) {
  if (pose.anim === 'idle') return;
  const { el } = mv, key = `${pose.anim}${pose.frame}${pose.flip ? 'L' : 'R'}`;
  if (key !== mv.shown) {
    const old = el.querySelector('svg.sprite');
    if (!old) return;
    const tpl = document.createElement('template');
    const opts = { style: mv.style, frame: pose.frame, flip: pose.flip };
    tpl.innerHTML = pose.anim === 'run' ? runSvg(mv.look, opts) : jumpSvg(mv.look, opts);
    old.replaceWith(tpl.content.firstElementChild as Element);
    el.classList.add('running');
    mv.shown = key;
  }
  const box = spriteBox(pose.anim, mv.style, pose.x, pose.y);
  el.style.left = `calc(${Math.round(box.left)} * var(--px))`;
  el.style.top = `calc(${Math.round(box.top)} * var(--px))`;
  el.style.zIndex = String(Math.round(pose.y));
}

function pump(t: number) {
  const dt = Math.min(100, t - lastFrame);
  lastFrame = t;
  for (const mv of movers) {
    if (!mv.el.isConnected) { movers.delete(mv); mv.done(); continue; }
    showPose(mv, mv.mover.update(dt));
    if (!mv.mover.busy) { movers.delete(mv); mv.done(); }
  }
  if (movers.size) requestAnimationFrame(pump);
}

// Send a cat to a spot. It resolves when the cat has got there (at once if there is no way there), still in its running
// pose: endRun sits it down, so a chain of moves doesn't flicker back to sitting between legs.
function moveTo(el: HTMLElement, to: Spot, speed = 1): Promise<void> {
  const c = save.state.cats.find((k) => k.id === el.dataset.id);
  const { surfaces, surfaceOf } = surfacesFromSpots(SPOTS, PET_W);
  const from = spotOf(el), dest = nearestSpot(to[0], to[1]);
  if (!c) return Promise.resolve();
  const mover = new CatMover(surfaces, { surface: surfaceOf[from], x: spotMid(SPOTS[from]) }, null);
  if (surfaceOf[from] === surfaceOf[dest] && from === dest) return Promise.resolve();
  mover.speed = speed;
  if (!mover.goTo(surfaceOf[dest], spotMid(SPOTS[dest]))) return Promise.resolve();
  el.classList.add('running');
  return new Promise((resolve) => {
    const mv: Mover = { el, mover, style: runStyleOf(c.id), look: lookFor(c), shown: '', done: () => { el.dataset.fx = String(SPOTS[dest][0]); el.dataset.fy = String(SPOTS[dest][1]); resolve(); } };
    if (!movers.size) { lastFrame = performance.now(); requestAnimationFrame(pump); }
    movers.add(mv);
  });
}

// Sit back down where the cat stopped: swap the running or jumping sprite for the sitting one.
function endRun(el: HTMLElement) {
  if (!el.classList.contains('running')) return;
  const c = save.state.cats.find((k) => k.id === el.dataset.id);
  const old = el.querySelector('svg.sprite');
  if (c && old) {
    const tpl = document.createElement('template');
    tpl.innerHTML = bodySvg(catStatus(c, today()).face, lookFor(c), hash(c.id));
    old.replaceWith(tpl.content.firstElementChild as Element);
  }
  el.classList.remove('running');
  placeAt(el, [Number(el.dataset.fx), Number(el.dataset.fy)]);
}

const NAP_CHANCE: Record<CatTrait, number> = { lazy: 0.12, grumpy: 0.05, cuddly: 0.05, shy: 0.04, curious: 0.02, playful: 0.012 };

function wander() {
  if (tab !== 'room' || roomView !== 'indoor' || asleepNow()) return;
  const els = [...document.querySelectorAll<HTMLElement>('#room .pet')];
  const taken = new Set(els.map((el) => roomPos.get(el.dataset.id ?? '')));
  els.forEach((el) => {
    const id = el.dataset.id ?? '';
    if (el.dataset.nap === '1') {   // asleep: wake up when the nap is over
      if ((napUntil.get(id) ?? 0) <= Date.now()) { napUntil.delete(id); setNap(el, false); }
      return;
    }
    if (el.classList.contains('thinking') || el.classList.contains('zooming') || el.classList.contains('running')) return;
    if (Math.random() < NAP_CHANCE[traitOf(id)]) {
      napUntil.set(id, Date.now() + (30 + Math.random() * 60) * 1000);
      setNap(el, true);
      return;
    }
    if (Math.random() > MOVE_CHANCE[traitOf(id)]) return;
    const from = roomPos.get(id) ?? 0;
    const free = SPOTS.map((_, i) => i).filter((i) => !taken.has(i) && canReach(spotOf(el), i));
    if (!free.length) return;
    const to = free[Math.floor(Math.random() * free.length)];
    taken.delete(from); taken.add(to);
    roomPos.set(id, to);
    el.classList.add('walking');
    moveTo(el, SPOTS[to]).then(() => { el.classList.remove('walking'); endRun(el); });
  });
  queueWidget();
}
const WANDER_MS = 8000;
setInterval(wander, WANDER_MS);

// Zoomies: at dusk and in the night a cat wakes with a burst of energy, races round the room, then curls up again.
const ZOOM_CHANCE: Record<CatTrait, number> = { playful: 0.9, curious: 0.5, cuddly: 0.3, grumpy: 0.25, shy: 0.15, lazy: 0.1 };
let zooming = false;
const ZOOM_SPEED = 2.5;   // zoomies run this many times faster than a stroll across the room
function zoomies() {
  const phase = skyPhase();
  if (phase === 'day' || tab !== 'room' || roomView !== 'indoor' || document.hidden || zooming || Math.random() > 0.4) return;
  const els = [...document.querySelectorAll<HTMLElement>('#room .pet')].filter((el) => !el.classList.contains('thinking'));
  const el = els[Math.floor(Math.random() * els.length)];
  if (!el || Math.random() > ZOOM_CHANCE[traitOf(el.dataset.id ?? '')]) return;
  zooming = true;
  const home: Spot = [Number(el.dataset.fx), Number(el.dataset.fy)], wasNap = el.dataset.nap === '1';
  el.classList.add('zooming', 'walking');
  if (wasNap) setNap(el, false);
  const here = spotOf(el);
  const route = SPOTS.filter((_, i) => canReach(here, i)).sort(() => Math.random() - 0.5).slice(0, 5);
  (async () => {
    try { for (const spot of [...route, home]) { if (!el.isConnected) break; await moveTo(el, spot, ZOOM_SPEED); } }
    finally {
      el.classList.remove('zooming', 'walking');
      endRun(el);
      if (wasNap) setNap(el, true);
      zooming = false;
    }
  })();
}
setInterval(zoomies, 7000);

// ---- home-screen widget (Android, see ./widget.ts): the room as three pictures, one per time of day ----
// Cats sit where they are in the room now.
const WIDGET_Y = 8, WIDGET_PX = 3;   // crop off the ceiling trim; 3 pixels per room unit

// One thought bubble per hour, so the picture holds still between pushes (the room itself rolls them live).
function widgetThought(phase: WidgetPhase) {
  if (phase === 'night') return null;
  let a = today() * 24 + now().getHours();
  const seeded = () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return (a / 4294967296) * 0.12; };   // low rolls: the widget shows one when anyone has someone on their mind
  return pickThought(save.state.cats, today(), save.returned ?? {}, () => true, seeded);
}

function roomPicture(phase: WidgetPhase): string {
  const t = today();
  const thought = widgetThought(phase);
  const cats = homeCats().map((c, i) => {
    const [x, y] = phase === 'night' ? NIGHT_SPOTS[i] : SPOTS[(roomPos.get(c.id) ?? i) % SPOTS.length];
    const nap = isNapping(c.id, phase);
    const body = (nap ? napSvg(lookFor(c)) : bodySvg(catStatus(c, t).face, lookFor(c), hash(c.id)))
      .replace('<g class="tail b">', '<g display="none">').replace('<g class="blink">', '<g display="none">')   // no CSS here: show tail frame A only
      .replace('<svg ', `<svg x="${nap ? napLeft(x) : x}" y="${y - (nap ? NAP_H : PET_H)}" width="${nap ? NAP_W : PET_W}" height="${nap ? NAP_H : PET_H}" `);
    const name = `<text x="${x + PET_W / 2}" y="${y + 7}" font-size="7" font-family="Jersey 15, monospace" text-anchor="middle" fill="#4a4084">${esc(c.name)}</text>`;
    const about = thought?.thinker === c.id ? save.state.cats.find((k) => k.id === thought.subject) : undefined;
    let bubble = '';
    if (about && thought) {
      const v = THOUGHT_FACE[thought.kind];
      const bw = 26, bh = 14, bx = x + PET_W / 2 - bw / 2, by = y - PET_H - bh - 4;
      const edge = '#4a4084', R = (rx: number, ry: number, w: number, h: number, f: string) => `<rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="${f}"/>`;
      const mark = markSvg(v.mark).replace('<svg ', `<svg x="${bx + 17}" y="${by + 3}" width="${MARKS[v.mark][0].length}" height="${MARKS[v.mark].length}" `);
      bubble = `<g>${R(bx + 1, by, bw - 2, bh, edge)}${R(bx, by + 1, bw, bh - 2, edge)}${R(bx + 1, by + 1, bw - 2, bh - 2, '#fffafd')}
        ${R(bx + bw / 2 - 1, by + bh, 3, 1, edge)}${R(bx + bw / 2, by + bh + 1, 2, 1, edge)}
        ${miniSvg(v.face, lookFor(about), v.faded).replace('<svg ', `<svg x="${bx + 2}" y="${by + 2}" width="13" height="10" `)}${mark}</g>`;
    }
    return { y, body: body + name + bubble };
  }).sort((a, b) => a.y - b.y).map((c) => c.body).join('');
  const bg = roomBg(phase, 'bg').replace('<svg class="bg"', `<svg x="0" y="0" width="${ROOM_W}" height="${ROOM_H}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${WIDGET_Y} ${ROOM_W} ${ROOM_H - WIDGET_Y}" shape-rendering="crispEdges">${bg}${cats}</svg>`;
}

initWidget((phase) => ({ svg: roomPicture(phase), w: ROOM_W, h: ROOM_H - WIDGET_Y, px: WIDGET_PX }));

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
  if (tab !== 'room' || roomView !== 'indoor' || document.hidden || asleepNow() || document.querySelector('#room .thought')) return;
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

// ===================== Sound (./sound.ts) =====================
const PET_MEOW = 0.1, PET_PURR = 0.4;   // chances when petted: a meow, else a purr, else quiet
initSound({ save: () => save, persist, toast, roomAwake: () => tab === 'room' && !asleepNow() });

// Double-tap an awake cat to make a heart float up from it.
let lastTap = { id: '', at: 0 };
for (const roomEl of [$('room'), $('outdoor')]) roomEl.addEventListener('click', (ev) => {
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

// Change how often a stray comes back: the same choices as the form that adds one.
const REPEAT_CHOICES: [string, string][] = [['1', 'Every day'], ['2', 'Every 2 days'], ['7', 'Every week'], ['14', 'Every 2 weeks'], ['30', 'Every month'],
  ['weekdays', 'On certain weekdays…'], ['custom', 'Every N days…']];
function openScheduleForm(k: MindfulTask) {
  const cur = k.weekdays?.length ? 'weekdays' : REPEAT_CHOICES.some(([v]) => v === String(k.cooldownDays)) ? String(k.cooldownDays) : 'custom';
  openModal(`<form class="panel" id="stray-schedule" data-id="${k.id}" novalidate><h3>How often ${esc(strayName(k))} comes</h3>
    <p class="muted">${esc(k.name)}. Its history stays as it is.</p>
    <label class="field">Repeat <select id="sched-repeat">${REPEAT_CHOICES.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field" id="sched-days-wrap" ${cur === 'custom' ? '' : 'hidden'}>Repeat every (days) <input id="sched-days" type="number" inputmode="numeric" min="1" max="365" value="${k.weekdays?.length ? 3 : k.cooldownDays}"></label>
    <fieldset class="field chips" id="sched-weekdays-wrap" ${cur === 'weekdays' ? '' : 'hidden'}><legend>Repeat on</legend>
      <div>${DAY_NAMES.map((n, i) => `<label><input type="checkbox" name="sched-day" value="${i}" ${k.weekdays?.includes(i) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
    <p class="muted">Only a stray that comes every day can be adopted as a kitty.</p>
    <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
}
document.addEventListener('change', (ev) => {
  const t = ev.target as HTMLSelectElement;
  if (t.id !== 'sched-repeat') return;
  ($('sched-days-wrap') as HTMLElement).hidden = t.value !== 'custom';
  ($('sched-weekdays-wrap') as HTMLElement).hidden = t.value !== 'weekdays';
});

let mindfulView: TaskKind = 'habit';
const TRAVEL = (id: string) => save.timeTravel ? `<button class="btn small travel" data-action="travel" data-id="${id}" aria-label="Time travel: edit the days this was done">${iconSvg('rewind')}</button>` : '';
const DEL = (id: string) => `<button class="btn small del" data-action="task-del" data-id="${id}" aria-label="Delete">${iconSvg('x')}</button>`;

function renderTasks() {
  const t = today();
  const kind = mindfulView;
  const isTask = kind === 'task';
  const cap = isTask ? CONFIG.taskMaxXp : CONFIG.habitMaxXp;
  $('mindful-title').textContent = isTask ? 'Treats' : 'Stray kitties';
  $('mindful-desc').textContent = isTask
    ? `One-off jobs. Do it once, tick it off, earn up to ${cap} XP. Tap the X or press and hold to delete.`
    : `Small habits you might not want to do every day, like cleaning your desk after a work-from-home session. Earn up to ${cap} XP a day. Feed them by doing them. Nothing bad happens if you skip a day. Adopt one as a kitty when you are ready to commit. Tap the X or press and hold to delete.`;
  const e = save.state.mindfulEarned?.day === t ? save.state.mindfulEarned : undefined;
  $('mindful-travel').hidden = !save.timeTravel;
  $('mindful-cap').textContent = `Earned today: ${(isTask ? e?.task : e?.habit) ?? 0}/${cap} XP`;
  $('form-title').textContent = isTask ? 'New treat' : 'New stray kitty';
  $('task-xp-label').textContent = `Reward (XP, max ${cap})`;
  ($('task-xp') as HTMLInputElement).max = String(cap);
  ($('repeat-wrap') as HTMLElement).hidden = isTask;
  ($('task-days-wrap') as HTMLElement).hidden = isTask || ($('task-repeat') as HTMLSelectElement).value !== 'custom';
  ($('task-weekdays-wrap') as HTMLElement).hidden = isTask || ($('task-repeat') as HTMLSelectElement).value !== 'weekdays';
  ($('task-form').querySelector('.row') as HTMLElement).style.gridTemplateColumns = isTask ? '1fr' : '';
  $('task-submit').textContent = isTask ? 'Add treat' : 'Add stray';
  ($('nick-wrap') as HTMLElement).hidden = isTask;
  $('task-name-label').textContent = isTask ? 'Name' : 'Habit';
  ($('task-name') as HTMLInputElement).placeholder = isTask ? 'Book a dentist appointment' : 'Stretch for 5 minutes';

  // Stray kitties look like the Today tab: one card per stray. Treats stay a plain list.
  $('tasks-panel').hidden = !isTask;
  $('strays').hidden = isTask;
  $('strays-note').hidden = isTask;
  $('tasks-done').hidden = !isTask;
  if (!isTask) {
    const strays = save.state.tasks.filter((k) => k.kind === 'habit');
    $('strays').innerHTML = strays.length ? strays.map((k) => `<article class="cat">
      ${strayHead(k, t, true)}
      ${renderWeek(habitSubject(k), t)}
      <p class="muted habit-foot">${k.doneDays.length ? `Fed ${plural(k.doneDays.length, 'time')}` : 'Not fed yet'}${k.cooldownDays === 1 && !k.weekdays?.length ? ` · streak ${habitStreak(k.doneDays, t)}` : ''}${save.timeTravel ? ` ${TRAVEL(k.id)}` : ''}</p>
    </article>`).join('')
      : `<div class="cat"><div class="cat-head">${sprite('open', { fur: '#e8a04c', pattern: 'plain' }, true)}
      <div><p class="cat-name">No stray kitties yet</p><p class="cat-habit">Add one below. Strays are habits with no penalty.</p></div></div></div>`;
    $('strays-note').textContent = `Earned today: ${e?.habit ?? 0}/${cap} XP · Press and hold a stray for more options.${save.timeTravel ? ' Time travel is on: use the rewind button on a card.' : ''}`;
    return;
  }
  const all = save.state.tasks.filter((k) => k.kind === kind);
  const doneTreats = all.filter((k) => k.lastDoneDay !== null);
  const list = all.filter((k) => k.lastDoneDay === null);
  const treatRow = (k: typeof all[number]) => `<li data-task="${k.id}" data-hold="task"><span class="done">${esc(k.name)} <span class="muted">· +${k.xp} XP</span></span>
        <span class="row-btns"><button class="btn small" data-action="task" data-id="${k.id}" disabled>${iconSvg('check')} Done</button>${TRAVEL(k.id)}${DEL(k.id)}</span></li>`;
  // Finished treats are tucked into a drop-down so the list stays short; it stays open across redraws.
  $('tasks-done').innerHTML = doneTreats.length ? `<details class="more" id="done-treats" ${doneTreatsOpen ? 'open' : ''}><summary>Done (${doneTreats.length})</summary>
    <ul class="tasks">${doneTreats.map(treatRow).join('')}</ul>
    <div class="btns"><button class="btn small" type="button" data-action="delete-done">Delete all done</button></div></details>` : '';
  $('tasks').innerHTML = list.length ? list.map((k) => {
    if (isTask) {
      return `<li data-task="${k.id}" data-hold="task"><span>${esc(k.name)} <span class="muted">· +${k.xp} XP</span></span>
        <span class="row-btns"><button class="btn small" data-action="task" data-id="${k.id}">Done</button>${TRAVEL(k.id)}${DEL(k.id)}</span></li>`;
    }
    const left = daysUntilReady(k, t);
    const daily = k.cooldownDays === 1;
    return `<li class="habit" data-task="${k.id}" data-hold="stray"><span>${esc(k.name)} <span class="muted">· +${k.xp} XP · ${scheduleText(k)}</span></span>
      <span class="row-btns"><button class="btn small" data-action="task" data-id="${k.id}" ${left ? 'disabled' : ''}>${left ? `in ${plural(left, 'day')}` : 'Feed'}</button><button class="btn small" data-action="rename-habit" data-id="${k.id}" aria-label="Rename stray kitty">Edit</button>${TRAVEL(k.id)}${DEL(k.id)}</span>
      ${renderWeek(habitSubject(k), t)}
      <span class="muted habit-foot">${k.doneDays.length ? `Done ${plural(k.doneDays.length, 'time')}` : 'Not done yet'}${daily ? ` · streak ${habitStreak(k.doneDays, t)}` : ''}</span>
      ${daily ? `<button class="btn small" data-action="habit-kitty" data-id="${k.id}">Adopt the kitty</button>` : ''}</li>`;
  }).join('') : `<li class="muted">${doneTreats.length ? 'Every treat is done.' : 'No treats yet. Add one below.'}</li>`;
}
let doneTreatsOpen = false;
$('tasks-done').addEventListener('toggle', (ev) => { doneTreatsOpen = (ev.target as HTMLDetailsElement).open; }, true);

// The tabs carry the two rooms' names ("Cosy Room" and "Garden" unless renamed).
const indoorName = () => save.roomName?.trim() || 'Cosy Room';
const outdoorName = () => save.outdoorName?.trim() || 'Garden';
function renderRoomTitle() { renderTop(); }   // the room names are on the navigation buttons

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
  ($('amnesia') as HTMLInputElement).checked = !!save.amnesia;
  renderDaySetting();
  renderSound();
  renderAutoBackup();
  $('version').textContent = `v${VERSION}`;
  $('clock-pop').hidden = !save.showClock;
  if (!save.showClock) $('clock-pop').classList.remove('open');
  $('saved').textContent = remote ? 'Saved to your Claude account' : 'Saved on this device';
}

// ===================== Diary data =====================
// The Diary screen (src/diary/) owns the diary. Habit Kitty starts its data, because the backup and the accomplishments need it.
async function loadDiary() {
  await initDiary();
  checkAccomplishments();
}

// ---- Backup: one .kitty file (a zip) holding the game, every diary page and every photo ----
async function collectBackup(): Promise<Backup> {
  await initPixel();
  return { game: save, ...await collectDiary(), notes: collectNotes(), notebooks: collectBooks(), shopping: collectShopping(), gallery: collectPixel(), achievement: await snapshotAchievement() };
}

registerBackupSource({ prefix: BACKUP_PREFIX, ext: BACKUP_EXT, pack: async () => packBackup(await collectBackup()) });

// Save as: the system picker asks where the file goes (a download in a browser).
async function saveBackupFile() {
  try {
    const where = await saveBackupToDevice();
    if (where !== null) toast(where ? `Backup saved: ${where}` : 'Backup downloaded.');
  } catch { toast("Couldn't save the backup file. Try again."); }
}

// Share sheet: Drive, Bluetooth, mail... (Android only).
async function shareBackup() {
  try { await shareBackupFile(); }
  catch (e) { if (!/cancel/i.test(String((e as Error)?.message ?? e))) toast("Couldn't make the backup file. Try again."); }
}

// ---- Auto-backup: the folder, when it last ran, and restoring from it ----
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};
function renderAutoBackup() {
  const box = $('auto-backup');
  box.hidden = !nativeBackups;
  document.querySelectorAll<HTMLElement>('[data-native-only]').forEach((el) => { el.hidden = !nativeBackups; });
  if (!nativeBackups) return;
  const st = backupStatus();
  const f = st.folder;
  const lines = f.chosen
    ? `<p>Folder: <b>${esc(f.name || 'chosen folder')}</b>${f.ok ? '' : ' (not reachable)'}<br>Last backup: ${st.running ? 'saving…' : st.last ? ago(st.last) : 'none yet'}</p>`
    : '<p class="muted">Off. Pick a folder once (for example Documents, then make a folder called IttyBittyKitty) and a fresh copy is saved there whenever you leave the app after changing something. The newest 7 days are kept.</p>';
  box.innerHTML = `<h4 class="sub">Auto-backup</h4>${lines}${st.error ? `<p class="form-error">${esc(st.error)}</p>` : ''}
    <div class="btns flow">${f.chosen
      ? `<button class="btn" type="button" data-action="backup-now" ${st.running ? 'disabled' : ''}>Back up now</button>
         <button class="btn" type="button" data-action="restore-folder">Restore from folder…</button>
         <button class="btn" type="button" data-action="backup-folder">Change folder</button>
         <button class="btn" type="button" data-action="backup-stop">Stop</button>`
      : '<button class="btn primary" type="button" data-action="backup-folder">Choose backup folder</button>'}</div>`;
}
onBackupStatus(renderAutoBackup);

async function openFolderRestore() {
  try {
    const names = await folderBackups(BACKUP_PREFIX, 'kitty');
    if (!names.length) { toast('No Habit Kitty backups in that folder yet.'); return; }
    openModal(`<div class="panel"><h3>Restore from folder</h3><p class="muted">Pick a backup. The newest is first.</p>
      <div class="btns col">${names.map((n) => `<button class="btn" type="button" data-action="restore-pick" data-name="${esc(n)}">${esc(n.replace(/^habit-kitty-|\.kitty$/g, ''))}</button>`).join('')}</div>
      <div class="btns"><button class="btn" data-action="modal-close">Cancel</button></div></div>`);
  } catch { toast("Couldn't open the backup folder."); refreshFolder(); }
}
async function pickFolderBackup(name: string) {
  try { askRestore(unpackBackup(await readFolderBackup(name))); }
  catch { closeModal(); toast("Couldn't read that backup."); }
}

let pendingBackup: Backup | null = null;
function askRestore(b: Backup) {
  pendingBackup = b;
  const pages = Object.keys(b.diary).length, photos = Object.keys(b.photos).length + Object.values(b.morePhotos ?? {}).reduce((n, l) => n + l.length, 0);
  const ach = b.achievement ? achievementCount(b.achievement) : 0;
  const parts = [
    b.game ? `your kitties, ${pages} diary ${pages === 1 ? 'page' : 'pages'} and ${photos} ${photos === 1 ? 'photo' : 'photos'}` : '',
    b.notes && Object.keys(b.notes).length ? `${plural(Object.keys(b.notes).length, 'note')}` : '',
    b.shopping ? 'your shopping lists' : '',
    b.gallery ? 'your Kitty Gallery icons' : '',
    b.achievement ? `${ach} ${ach === 1 ? 'achievement' : 'achievements'} (Kitty Achievement)` : '',
  ].filter(Boolean);
  openModal(`<div class="panel"><h3>Restore this backup?</h3>
    <p>It holds ${parts.join(' and ')}.</p>
    <p class="muted">${b.game && b.achievement ? 'Everything in both apps' : b.game ? 'Everything in Habit Kitty' : 'Everything in Kitty Achievement'} on this device will be replaced.${b.notes && Object.keys(b.notes).length ? ' So will your notes.' : ''}${b.shopping ? ' So will your shopping lists, recipes and pantry.' : ''}${b.gallery ? ' So will your Kitty Gallery icons.' : ''}</p>
    <div class="btns"><button class="btn" data-action="modal-close">Cancel</button>
    <button class="btn primary" data-action="restore-yes">Restore</button></div></div>`);
}

async function restoreBackup() {
  const b = pendingBackup;
  pendingBackup = null;
  if (!b) return;
  const g = b.game === null ? null : validGame(b.game);
  if (b.game !== null && !g) { closeModal(); toast("Couldn't restore that backup."); return; }
  // Kitty Achievement first: if it fails nothing has been touched yet.
  if (b.achievement) {
    try { await restoreAchievement(b.achievement); } catch { closeModal(); toast("Couldn't restore that backup."); return; }
  }
  if (g) {
    if (!await restoreDiary(b, g)) { closeModal(); toast("Couldn't restore the kitties and diary. Achievements were restored."); return; }
    if (b.notes && Object.keys(b.notes).length && !await restoreNotes(b.notes)) toast("Couldn't restore the notes. Everything else was restored.");   // a backup from before notes leaves yours alone
    if (b.notebooks && !await restoreBooks(b.notebooks)) toast("Couldn't restore the notebooks. Everything else was restored.");
    if (b.shopping && !await restoreShopping(b.shopping)) toast("Couldn't restore the shopping lists. Everything else was restored.");   // likewise for one from before Kitty Mart
    if (b.gallery && !await restorePixel(b.gallery)) toast("Couldn't restore the Kitty Gallery icons. Everything else was restored.");   // and for one from before the icons were in it
    else if (b.gallery) redrawPixelSettings();
    const { trackamaniac, moodNames, ...rest } = g;   // older backups kept the diary settings here (restoreDiary took them)
    save = normalize(rest);
    lastLevel = null;
    persist(); settle(); renderAll();
  }
  closeModal();
  if (b.achievement) {   // that app may already be running with the old save: start it again from the restored one
    toast('Backup restored. Reloading…');
    setTimeout(() => location.reload(), 900);
    return;
  }
  toast('Backup restored.');
}

// ---- Settings only: a .kittyset file (see src/settings-file.ts), to give someone your look, options and icons ----
// without your kitties, diary, notes or shopping lists. Loading one asks which parts to take, and replaces only those.
async function collectSettings(): Promise<SettingsFile> {
  await Promise.all([initPixel(), shopInitialised, diaryInitialised]);
  const { allowRename, showClock, timeTravel, amnesia, unlimited, sound, muted, roomName, outdoorName } = save;
  const habit: HabitSettings = {
    allowRename: !!allowRename, showClock: !!showClock, timeTravel: !!timeTravel, amnesia: !!amnesia, unlimited: !!unlimited, muted: !!muted,
    dayStart: dayStartHour(), roomName: roomName ?? '', outdoorName: outdoorName ?? '', ...(sound && { sound: { ...sound } }),
  };
  const icons = JSON.parse(collectPixel() ?? '{"icons":[]}').icons;
  return { look: { theme: themeMode(), fancy: fancyOn() }, habit, diary: cleanDiary(diaryExtras()), mart: martSettingsOf(shopData()), gallery: { icons } };
}
const settingsName = () => backupName(SETTINGS_PREFIX, SETTINGS_EXT);
const settingsBytes = async () => new TextEncoder().encode(settingsText(await collectSettings(), new Date().toISOString().slice(0, 10)));
async function saveSettingsFile() {
  try {
    const where = await saveToDevice(settingsName(), await settingsBytes());
    if (where !== null) toast(where ? `Settings saved: ${where}` : 'Settings downloaded.');
  } catch { toast("Couldn't save the settings file. Try again."); }
}
async function shareSettingsFile() {
  try { await shareFile(settingsName(), await settingsBytes(), 'Itty Bitty Kitty settings', 'Share your settings'); }
  catch (e) { if (!/cancel/i.test(String((e as Error)?.message ?? e))) toast("Couldn't make the settings file. Try again."); }
}

let pendingSettings: SettingsFile | null = null;
const SETTINGS_WARN: Partial<Record<Part, string>> = {
  habit: 'Your kitties, habits and reminders stay as they are.',
  diary: 'Your diary pages and birthdays stay as they are.',
  mart: 'Your lists, pantry and recipes stay; anything in a category the file has not got moves to Other.',
  gallery: 'Your icons become exactly the ones in the file: icons of your own that are not in it are deleted.',
};
function askSettings(s: SettingsFile) {
  pendingSettings = s;
  const parts = PARTS.filter(([k]) => s[k]);
  openModal(`<div class="panel"><h3>Load these settings?</h3>
    <p class="muted">Pick what to take. Each part you tick replaces yours.</p>
    <div id="settings-parts">${parts.map(([k, label]) => `<label class="check"><input type="checkbox" data-part="${k}" checked><span><b>${esc(label)}</b>${SETTINGS_WARN[k] ? `<br><span class="muted">${esc(SETTINGS_WARN[k]!)}</span>` : ''}</span></label>`).join('')}</div>
    <div class="btns"><button class="btn" data-action="modal-close">Cancel</button>
    <button class="btn primary" data-action="settings-yes">Load</button></div></div>`);
}

// Your day moves only when that leaves you in the same day right now (as in Settings → Your day).
function applyHabitSettings(h: HabitSettings): string {
  for (const k of ['allowRename', 'showClock', 'timeTravel', 'amnesia', 'unlimited', 'muted', 'roomName', 'outdoorName'] as const) {
    if (h[k] !== undefined) (save as unknown as Record<string, unknown>)[k] = h[k];
  }
  if (h.sound) save.sound = { ...save.sound, ...h.sound };
  let note = '';
  if (h.dayStart !== undefined && h.dayStart !== dayStartHour()) {
    const old = dayStartHour(), before = today();
    setDayStart(h.dayStart);
    if (today() !== before) { setDayStart(old); note = ` Your day was not moved: it would put you in a different day right now. Try again after ${hourText(Math.max(old, h.dayStart))}.`; }
    else save.dayStart = dayStartHour();
  }
  persist(); renderAll(); syncMusic();
  return note;
}

async function loadSettings() {
  const s = pendingSettings;
  pendingSettings = null;
  if (!s) return;
  const pick = new Set([...document.querySelectorAll<HTMLInputElement>('#settings-parts [data-part]')].filter((i) => i.checked).map((i) => i.dataset.part as Part));
  closeModal();
  if (!pick.size) return;
  const failed: string[] = [];
  let note = '';
  if (pick.has('look') && s.look) { setThemeMode(s.look.theme); setFancy(s.look.fancy); redrawLookSettings(); }
  if (pick.has('habit') && s.habit) note = applyHabitSettings(s.habit);
  if (pick.has('diary') && s.diary) {
    await diaryInitialised;
    const d = s.diary;
    if (!await updateExtras({ trackamaniac: !!d.trackamaniac, teleportation: !!d.teleportation, photographer: !!d.photographer, titles: !!d.titles, starry: !!d.starry, moodNames: d.moodNames ?? {} })) failed.push('diary options');
  }
  if (pick.has('mart') && s.mart) {
    await shopInitialised;
    if (!await changeShop(applyMartSettings(shopData(), s.mart), 'Loaded settings')) failed.push('Kitty Mart');
  }
  if (pick.has('gallery') && s.gallery) {
    await initPixel();
    if (!await setPixelData({ version: 1, icons: s.gallery.icons })) failed.push('Kitty Gallery icons');
    redrawPixelSettings(); renderAll();
  }
  toast(failed.length ? `Couldn't load the ${failed.join(' and ')}. The rest was loaded.` : `Settings loaded.${note}`);
}
async function readSettingsFile(f: File | undefined) {
  if (!f) return;
  const err = $('settings-error');
  try { err.hidden = true; askSettings(readSettings(await f.text())); }
  catch (e) { err.textContent = (e as Error).message || "That isn't a settings file."; err.hidden = false; }
}

// ===================== Feeding reminders (./notify.ts) =====================
initReminders({ save: () => save, now, persist, storeQuietly: () => writeJson(KEY, save), toast });

// ===================== Tabs & modal =====================
const TABS = ['room', 'mindful', 'today', 'heat', 'settings'];
let tab = 'today';
let tabBeforeSettings = 'today';   // where Back in Settings takes you, when you came from a Habit Kitty tab
let settingsFrom: AppName = 'habit';   // the screen whose gear opened Settings

// ---- the navigation: a bar along the bottom (Room / Kitty / Heatmap), and above the screen a switch for that tab ----
//   Room:    the cosy room (indoor) / the garden (outdoor)
//   Kitty:   Kitty / Stray / Treats (and Pet sitter, Memory while a kitty is with the sitter or has gone)
//   Heatmap: Kitty / Stray
// Each place is one of the screens below (today: the cat cards, mindful: strays and treats, room: indoors and outdoors, heat).
type Bottom = 'room' | 'kitty' | 'heat';
type Main = 'kitty' | 'stray' | 'treats' | 'sitter' | 'memory';
type Sub = 'list' | 'room' | 'heat';   // openNav's second argument: which tab (list = the Kitty tab)
let bottom: Bottom = 'kitty';
let navMain: Main = 'kitty';                      // the Kitty tab's section
let roomSide: RoomView = 'indoor';                // the Room tab's side
let heatMode: 'cats' | 'strays' = 'cats';         // the Heatmap tab's side
const catsIn = (v: TodayView) => save.state.cats.filter((c) => viewOf(c) === v).length;
const sectionOk = (m: Main) => (m === 'sitter' ? catsIn('sitter') > 0 : m === 'memory' ? catsIn('memories') > 0 : true);

// Points the screens' own switches (which cats, which list, which room) at the tab.
function syncViews() {
  if (!sectionOk(navMain)) navMain = 'kitty';
  todayView = navMain === 'sitter' ? 'sitter' : navMain === 'memory' ? 'memories' : 'home';
  mindfulView = navMain === 'treats' ? 'task' : 'habit';
  roomView = roomSide;
}
const screenOf = (): string =>
  bottom === 'room' ? 'room' : bottom === 'heat' ? 'heat' : navMain === 'stray' || navMain === 'treats' ? 'mindful' : 'today';
// Opens a place: a section of the Kitty tab ('list'), or the Room or Heatmap tab on the kitty's or the stray's side.
function openNav(main: Main, sub: Sub = 'list') {
  if (sub === 'room') { bottom = 'room'; roomSide = main === 'stray' ? 'outdoor' : 'indoor'; }
  else if (sub === 'heat') { bottom = 'heat'; heatMode = main === 'stray' ? 'strays' : 'cats'; }
  else { bottom = 'kitty'; navMain = main; }
  syncViews();
  showTab(screenOf());
}
function openBottom(b: Bottom) {
  bottom = b;
  syncViews();
  showTab(screenOf());
}

function navHtml(): string {
  syncViews();   // a section whose kitties are gone falls back to Kitty
  let items: [string, string, boolean, number | null][];
  if (bottom === 'room') items = [['indoor', indoorName(), roomSide === 'indoor', null], ['outdoor', outdoorName(), roomSide === 'outdoor', null]];
  else if (bottom === 'heat') items = [['cats', 'Kitty', heatMode === 'cats', null], ['strays', 'Stray', heatMode === 'strays', null]];
  else {
    items = [['kitty', 'Kitty', navMain === 'kitty', null], ['stray', 'Stray', navMain === 'stray', null], ['treats', 'Treats', navMain === 'treats', null]];
    if (catsIn('sitter')) items.push(['sitter', 'Pet sitter', navMain === 'sitter', catsIn('sitter')]);
    if (catsIn('memories')) items.push(['memory', 'Memory', navMain === 'memory', catsIn('memories')]);
  }
  const action = bottom === 'room' ? 'nav-room' : bottom === 'heat' ? 'nav-heat' : 'nav-main';
  return `<nav class="nav" aria-label="Views"><div class="seg" role="tablist">${items.map(([v, label, on, n]) =>
    `<button type="button" role="tab" data-action="${action}" data-v="${v}" aria-selected="${on}">${esc(label)}${n === null ? '' : ` <span class="num">${n}</span>`}</button>`).join('')}</div></nav>`;
}
// The bar along the bottom shows which tab is open (and hides in Settings).
function renderTabbar() {
  for (const b of document.querySelectorAll<HTMLElement>('#tabbar [data-bottom]')) b.setAttribute('aria-selected', String(tab !== 'settings' && b.dataset.bottom === bottom));
}

// Settings: a main page (everything shared, then a button per mini-app), and one page for each mini-app's own options.
const SETTINGS_PAGES = ['main', 'habit', 'diary', 'notes', 'achievement', 'pixel'] as const;
function showSettingsApp(app: string | null) {
  for (const p of SETTINGS_PAGES) $(`set-${p}`).hidden = p !== (app ?? 'main');
  if (app === 'pixel') redrawPixelSettings();   // its counts change in Kitty Gallery
  window.scrollTo(0, 0);
}
function showTab(name: string) {
  if (name !== 'settings') tabBeforeSettings = name;
  else showSettingsApp(null);   // Settings always opens on its main page
  tab = name;
  document.documentElement.dataset.tab = name;
  renderTop();
  renderTabbar();
  renderTab(name);
  for (const t of TABS) $(`tab-${t}`).classList.toggle('on', t === name);
  window.scrollTo(0, 0);
}

function closeModal() {
  closeLayer(false);
  gate = null; menuCat = null; menuStray = null;
  $('modal').hidden = true; $('modal').innerHTML = '';
  if (save.amnesia && save.amnesiaDay !== today()) queueMicrotask(checkAmnesia);   // it waited for this dialog
}
function openModal(html: string) {
  const m = $('modal');
  m.innerHTML = `<div class="scrim" data-action="modal-close">${html}</div>`;
  m.hidden = false;
  m.querySelector<HTMLElement>('input')?.focus();
}

// A small dialog over the page or over the open dialog, which keeps its state underneath (src/shared/layer.ts).
const layer = makeLayer('habit', { id: 'layer', host: () => document.body, onClose: () => { picker = null; } });
const openLayer = (html: string, label: string, from?: HTMLElement) => layer.open(html, label, { from });
const closeLayer = layer.close;

// ---- month and year picker: tap a calendar's title (the heatmaps) to jump to any month up to now ----
interface Picker { key: string; y: number; m: number; year: number; first: number }   // year: the one being shown; first: earliest month allowed, as y * 12 + m
let picker: Picker | null = null;
const nowMonth = () => { const d = dateOf(today()); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

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
  const { html, label } = pickerHtml(view, { year: p.year, sel: p.y * 12 + p.m, cur: nowMonth(), first: p.first });
  openLayer(html, label, from);
}

function pickMonth(m: number) {
  const p = picker;
  if (!p || p.year * 12 + m > nowMonth() || p.year * 12 + m < p.first) return;
  closeLayer(false);
  viewMonth.set(p.key, Math.max(0, nowMonth() - (p.year * 12 + m)));
  renderHeat();
  if (menuCat === p.key) openCatMenu(p.key);
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
        <p>Consider returning one kitty to the shelter to make room for a new one, or let a stray kitty be a temporary try-out for a habit you're not sure about yet.</p>
        <div class="btns"><button class="btn" data-action="modal-close">OK</button>
        <button class="btn primary" data-action="goto-habits">Try a stray</button></div></div>`);
      return;
    }
    runGate([
      { title: `Kitty #${next}? That's a lot`, yes: 'I still want to',
        text: `${next} habits is a lot for people to handle, and it will be very sad if a kitty goes hungry. Consider returning a kitty to the shelter, or trying this one as a stray first.` },
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
  adoptFrom = habitId ?? null;
  const habit = habitId ? save.state.tasks.find((k) => k.id === habitId) : undefined;
  const former = habit?.former;   // a released kitty comes back as itself
  draftLook = former?.look ? { ...former.look } : randomLook();
  draftGender = former?.gender ?? (Math.random() < 0.5 ? 'girl' : 'boy');
  openModal(`<form class="panel" id="adopt" novalidate>
    <h3>${habit ? 'Adopt the kitty' : 'Adopt a kitty'}</h3>
    <div class="preview"><div id="adopt-preview">${sprite('happy', draftLook)}</div>
      <button class="btn" type="button" data-action="randomise">${iconSvg('dice')} Randomise look</button></div>
    <div class="look-pick" id="adopt-look">${lookPickers()}</div>
    <p class="muted">${habit ? `Your history with this habit comes along. Days you did it show in teal; days before the kitty show as empty.`
      : 'Each cat stands for one habit. Do the habit, feed the cat.'}</p>
    <label class="field">Cat's name <input id="adopt-name" maxlength="24" placeholder="Mochi" autocomplete="off" value="${habit ? esc(strayName(habit)) : ''}"></label>
    <label class="field">Daily habit <input id="adopt-habit" maxlength="40" placeholder="Drink a glass of water" autocomplete="off" value="${habit ? esc(habit.name) : ''}" ${habit ? 'readonly' : ''}></label>
    <fieldset class="modes">
      <legend>If you neglect it for 3 days</legend>
      <label><input type="radio" name="mode" value="classic" ${former?.mode === 'lighthearted' ? '' : 'checked'}><b>Classic</b>the cat dies</label>
      <label><input type="radio" name="mode" value="lighthearted" ${former?.mode === 'lighthearted' ? 'checked' : ''}><b>Light-hearted</b>it runs away, and comes back once</label>
    </fieldset>
    <p class="form-error" id="adopt-error" hidden></p>
    <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Adopt</button></div>
  </form>`);
}

// ---- accomplishments: worked out from the save; the unlocked ones are remembered so they never disappear ----
const diaryPageCount = pageCount;
function checkAccomplishments() {
  const got = accomplishments(save.state, diaryPageCount(), today()).filter((a) => a.unlocked);
  const known = save.accomplished;
  const fresh = got.filter((a) => !known || !(a.id in known));
  if (!fresh.length) return;
  save.accomplished = { ...known, ...Object.fromEntries(fresh.map((a) => [a.id, today()])) };
  persist();
  if (!known) return;   // a save from before accomplishments: hand out what is already earned quietly
  const names = fresh.map((a) => a.title);
  setTimeout(() => toast(`Accomplishment unlocked: ${names[0]}${names.length > 1 ? ` (+${names.length - 1} more)` : ''}`), 1800);
}

function openTrophies() {
  const list = accomplishments(save.state, diaryPageCount(), today());
  const unlocked = list.filter((a) => a.unlocked).length;
  const groups = [...new Set(list.map((a) => a.group))];
  openModal(`<div class="panel">${closeX('modal-close')}
    <h3>Accomplishments</h3><p class="muted"><b class="num">${unlocked}</b> of ${list.length} unlocked</p>
    ${groups.map((g) => `<h4 class="acc-group">${g}</h4><ul class="acc">${list.filter((a) => a.group === g).map((a) =>
      `<li class="${a.unlocked ? 'got' : ''}"><span class="acc-icon">${a.unlocked ? pixelArt(TROPHY_ART) : pixelArt(TROPHY_ART, 'dim')}</span>
        <span><b>${esc(a.title)}</b><br><span class="muted">${esc(a.text)}</span>
        ${a.unlocked ? '' : `<span class="acc-bar" role="img" aria-label="${a.progress} of ${a.target}"><i style="width:${Math.round((100 * a.progress) / a.target)}%"></i></span>`}</span></li>`).join('')}</ul>`).join('')}</div>`);
}

// ---- everyone's diary: the kitties' days in one list ----
function openBook(day: number = today()) {
  const t = today();
  const home = sortedCats().filter((c) => c.status === 'alive');
  const first = Math.min(t, ...save.state.cats.map((c) => c.adoptedDay));
  const day0 = Math.max(first, Math.min(day, t));
  const clockNow = now().getHours() * 60 + now().getMinutes();
  const lines = allCatsDiary(home.filter((c) => c.adoptedDay <= day0), day0).filter((l) => day0 < t || l.minute <= clockNow);
  openModal(`<div class="panel">${closeX('modal-close')}
    <h3>Kitty diary</h3>
    <div class="month-nav">
      <button type="button" data-action="book-day" data-day="${day0 - 1}" ${day0 <= first ? 'disabled' : ''} aria-label="Previous day">${iconSvg('prev')}</button>
      <strong>${day0 === t ? 'Today · ' : ''}${fmtDay(day0)}</strong>
      <button type="button" data-action="book-day" data-day="${day0 + 1}" ${day0 >= t ? 'disabled' : ''} aria-label="Next day">${iconSvg('next')}</button>
    </div>
    ${lines.length ? `<ul class="catlog">${lines.map((l) => `<li><span class="num">${clock(l.minute)}</span> ${esc(l.text)}</li>`).join('')}</ul>`
      : `<p class="muted">${home.length ? 'Nothing happened yet.' : 'Nobody is home, so nothing to write about.'}</p>`}</div>`);
}

// ---- time travel: mark or unmark a stray kitty or treat on any day up to today ----
let travelBack = 0;   // months back from the current one
// Time travel works on a stray or treat (done days) and on a kitty (fed days, from its adoption on).
function openTravel(id: string, back = travelBack) {
  const task = save.state.tasks.find((k) => k.id === id);
  const cat = task ? undefined : save.state.cats.find((c) => c.id === id);
  if (!task && !cat) return;
  travelBack = back;
  const t = today(), d = dateOf(t);
  const shown = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  const y = shown.getUTCFullYear(), m = shown.getUTCMonth();
  const first = dayOf(y, m, 1), last = dayOf(y, m + 1, 0), lead = (dateOf(first).getUTCDay() + 6) % 7;
  const doneSet = new Set(task ? task.doneDays : cat?.fedDays);
  const word = cat ? 'fed' : 'done';
  const cells = [
    ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`),
    ...Array.from({ length: lead }, () => '<div class="dc blank"></div>'),
    ...Array.from({ length: last - first + 1 }, (_, i) => {
      const day = first + i, on = doneSet.has(day);
      const off = day > t || (cat && day < cat.adoptedDay);
      return `<button type="button" class="dc${on ? ' has' : ''}${day === t ? ' now' : ''}" data-action="travel-day" data-id="${id}" data-day="${day}" ${off ? 'disabled' : ''}
        aria-pressed="${on}" aria-label="${fmtDay(day)}: ${on ? word : `not ${word}`}"><span class="dn">${i + 1}</span>${on ? `<b class="tick">${iconSvg('tick')}</b>` : ''}</button>`;
    }),
  ].join('');
  openModal(`<div class="panel">${closeX('modal-close')}
    <h3>Time travel</h3><p><b>${esc(task ? task.name : `${cat?.name} · ${cat?.habit}`)}</b></p>
    <p class="muted">Tap a day to mark it ${word} or not ${word}. Affection is worked out again from your record${cat ? `, and so is how hungry ${esc(cat.name)} is` : ''}.${task?.kind === 'task' ? ' A treat is done once, so tapping another day moves it.' : ''}</p>
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

// Only the visible tab is drawn; showTab draws a tab when it is opened.
function renderTab(name: string) {
  switch (name) {
    case 'today': renderCats(); break;
    case 'heat': renderHeat(); break;
    case 'room': renderRoom(); break;
    case 'mindful': renderTasks(); break;
    case 'settings': renderChangelog(); renderReminder(); break;
  }
}
function renderAll() {
  renderTop(); renderLog(); renderRoomTitle(); renderClock(); renderSaved();   // the clock pop-up floats over every tab
  renderTab(tab);
  queueWidget();
  checkAccomplishments();
}

// ===================== Events =====================
onShown('habit', 'click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  const id = btn.dataset.id ?? '';
  const cat = save.state.cats.find((c) => c.id === id);
  switch (btn.dataset.action) {
    case 'feed':
      act((s, at) => feedCat(s, id, at), () => {
        const fed = save.state.cats.find((c) => c.id === id) as Cat;
        return cat?.status === 'ranAway' ? `${fed.name} came back! Welcome home.` : fedMessage(fed, foodName(foodFor(fed, today())), streak(fed, today()));
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
      // A stray fed while it is in the garden may wander off again.
      const leaves = kind === 'habit' && visibleStrays().some((k) => k.id === id) && Math.random() < CONFIG.strayLeaveChance;
      const ok = act((s, at) => doMindfulTask(s, id, at), () => {
        const paid = earned() - before;
        const xp = paid >= task.xp ? `Nice. +${paid} XP`
          : paid > 0 ? `+${paid} XP. That's today's ${cap} XP limit for ${kind === 'task' ? 'treats' : 'strays'}.`
          : `Done! You've already earned today's ${cap} XP from ${kind === 'task' ? 'treats' : 'strays'}, so no extra XP.`;
        return leaves ? `${strayName(task)} is fed and happily going roaming again. ${xp}` : xp;
      });
      if (ok && leaves) {
        const w = strayWindow(now());
        save.strayLeft = { ...Object.fromEntries(Object.entries(save.strayLeft ?? {}).filter(([, v]) => v === w)), [id]: w };
        persist();
        if (tab === 'room') renderRoom();
      }
      if (menuStray === id) openStrayMenu(id);   // keep the open menu in step (fed)
      break;
    }
    case 'nav-bottom': openBottom(btn.dataset.bottom as Bottom); break;
    case 'nav-main': openNav(btn.dataset.v as Main); break;
    case 'nav-room': openNav(btn.dataset.v === 'outdoor' ? 'stray' : 'kitty', 'room'); break;
    case 'nav-heat': openNav(btn.dataset.v === 'strays' ? 'stray' : 'kitty', 'heat'); break;
    case 'settings-open': settingsFrom = 'habit'; showTab('settings'); break;
    case 'settings-back':
      if (settingsFrom === 'habit') showTab(tabBeforeSettings);
      else document.dispatchEvent(new CustomEvent(GO_EVENT, { detail: { to: settingsFrom } }));
      break;
    case 'settings-app': showSettingsApp(btn.dataset.app ?? null); break;
    case 'settings-up': showSettingsApp(null); break;
    case 'ach-load': $('ach-file').click(); break;
    case 'picker-open': openPicker(btn); break;
    case 'picker-years': drawPicker('year'); break;
    case 'picker-year': if (picker) { picker.year = Number(btn.dataset.y); drawPicker('month'); } break;
    case 'picker-month': pickMonth(Number(btn.dataset.m)); break;
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
    case 'goto-habits': closeModal(); openNav('stray', 'list'); break;
    case 'menu-tab': openCatMenu(id, btn.dataset.view as MenuTab); break;
    case 'stray-tab': openStrayMenu(id, btn.dataset.view as StrayTab); break;
    case 'release-ask':
      if (!cat) break;
      openModal(`<div class="panel"><h3>Release ${esc(cat.name)} to the stray colony?</h3>
        <p>${esc(cat.name)} becomes a stray kitty: no penalty, and your history together comes along. Strays can't starve, so a missed day costs nothing. You can adopt ${esc(cat.name)} again any time.</p>
        <div class="btns"><button class="btn" data-action="modal-close">Keep ${esc(cat.name)}</button>
        <button class="btn primary" data-action="release-yes" data-id="${id}">Release</button></div></div>`);
      break;
    case 'release-yes': {
      const name = cat?.name ?? 'Your cat';
      closeModal();
      act((s, at) => releaseToColony(s, id, newId(), at), `${name} joined the stray colony. Find them in ${outdoorName()}, or adopt them again.`, cat);
      break;
    }
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
    case 'rename-stray': {
      const k = save.state.tasks.find((x) => x.id === id);
      if (!k) break;
      closeModal();
      openModal(`<form class="panel" id="rename-stray" data-id="${id}" novalidate><h3>Rename stray kitty</h3>
        <label class="field">Name <input id="rename-stray-input" maxlength="24" autocomplete="off" value="${esc(strayName(k))}"></label>
        <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
      break;
    }
    case 'stray-schedule': {
      const k = save.state.tasks.find((x) => x.id === id && x.kind === 'habit');
      if (!k) break;
      closeModal();
      openScheduleForm(k);
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
      openModal(`<form class="panel" id="room-name" novalidate><h3>Name your ${roomView === 'outdoor' ? 'garden' : 'room'}</h3>
        <label class="field">${roomView === 'outdoor' ? 'Garden' : 'Room'} name <input id="room-name-input" maxlength="24" autocomplete="off" placeholder="${roomView === 'outdoor' ? 'Garden' : 'Cosy Room'}" value="${esc((roomView === 'outdoor' ? save.outdoorName : save.roomName) ?? '')}"></label>
        <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
      break;
    case 'book': openBook(); break;
    case 'book-day': openBook(Number(btn.dataset.day)); break;
    case 'trophies': openTrophies(); break;
    case 'travel': travelBack = 0; openTravel(id, 0); break;
    case 'travel-month': openTravel(id, Math.max(0, travelBack + Number(btn.dataset.step))); break;
    case 'travel-day': {
      const day = Number(btn.dataset.day);
      const cat = save.state.cats.find((c) => c.id === id);
      const on = cat ? cat.fedDays.includes(day) : save.state.tasks.find((k) => k.id === id)?.doneDays.includes(day);
      const xp = save.state.xp;
      const told = () => `${on ? `Unmarked ${fmtDay(day)}` : `Marked ${fmtDay(day)} as ${cat ? 'fed' : 'done'}`}. ${xpChange(xp)}`;
      const ok = cat ? act((s, at) => setCatDay(s, id, day, !on, at), told, cat) : act((s, at) => setTaskDay(s, id, day, !on, at), told);
      if (ok) openTravel(id);
      break;
    }
    case 'fix-xp': {
      const next = replay(save.state, now());
      openModal(`<div class="panel"><h3>Fix affection?</h3>
        <p>Working it out again from your heatmaps and strays: <b>${save.state.xp}</b> → <b>${next.xp}</b>.</p>
        <p class="muted">Kitties' hunger is worked out again too. Strays and treats deleted before v0.4.1 can't be counted.</p>
        <div class="btns"><button class="btn" data-action="modal-close">Keep</button>
        <button class="btn primary" data-action="fix-xp-yes">Fix it</button></div></div>`);
      break;
    }
    case 'fix-xp-yes': {
      const xp = save.state.xp;
      save.state = replay(save.state, now());
      persist(); closeModal(); renderAll();
      toast(save.state.xp === xp ? 'Affection was already right.' : `Affection fixed: ${xp} → ${save.state.xp}.`);
      break;
    }
    case 'amnesia-yes': {
      const picked = [...document.querySelectorAll<HTMLInputElement>('#modal [data-forgot]:checked')].map((i) => i.dataset.forgot as string);
      closeModal();
      if (!picked.length) break;
      const xp = save.state.xp, y = today() - 1;
      for (const cid of picked) { const r = setCatDay(save.state, cid, y, true, now()); save.state = r.state; }
      const names = picked.map((cid) => catName(cid));
      save.log.unshift({ at: now().getTime(), text: `Remembered: ${names.join(', ')} ${names.length === 1 ? 'was' : 'were'} fed yesterday after all.` });
      save.log = save.log.slice(0, 8);
      persist(); renderAll();
      toast(`Logged for yesterday. ${xpChange(xp)}`);
      break;
    }
    case 'clock-toggle': $('clock-pop').classList.toggle('open'); break;
    // The scrim closes only on a tap outside the panel; a close button closes even when the tap lands on its icon.
    case 'modal-close': if (ev.target === btn || !btn.classList.contains('scrim')) closeModal(); break;
    case 'delete-done': {
      const n = save.state.tasks.filter((k) => k.kind === 'task' && k.lastDoneDay !== null).length;
      if (!n) break;
      openModal(`<div class="panel"><h3>Delete all done treats?</h3><p>${plural(n, 'finished treat')} will be removed. Treats you have not done yet stay.</p>
        <div class="btns"><button class="btn" data-action="modal-close">Keep</button>
        <button class="btn primary" data-action="delete-done-yes">Delete all</button></div></div>`);
      break;
    }
    case 'delete-done-yes':
      save.state = save.state.tasks.filter((k) => k.kind === 'task' && k.lastDoneDay !== null).reduce((s, k) => removeMindfulTask(s, k.id), save.state);
      persist(); closeModal(); renderTasks(); toast('Done treats deleted.');
      break;
    case 'delete-task-yes': {
      const removed = save.state.tasks.find((k) => k.id === id);
      save.state = removeMindfulTask(save.state, id);
      persist(); closeModal(); renderTasks(); toast(`${removed?.kind === 'habit' ? 'Stray kitty' : 'Treat'} deleted.`);
      break;
    }
    case 'cat-alarm-clear': {
      const alarms = { ...reminderSettings().catAlarms };
      delete alarms[id];
      setReminders({ catAlarms: alarms });
      break;
    }
    case 'save-file': saveBackupFile(); break;
    case 'share-file': shareBackup(); break;
    case 'backup-folder': chooseFolder(); break;
    case 'backup-now': backupNow().then(() => { const e = backupStatus().error; toast(e || 'Backed up.'); }); break;
    case 'backup-stop': stopBackups().then(() => toast('Auto-backup is off. Your old backups stay in the folder.')); break;
    case 'restore-folder': openFolderRestore(); break;
    case 'restore-pick': pickFolderBackup(btn.dataset.name ?? ''); break;
    case 'restore-yes': restoreBackup(); break;
    case 'settings-save': saveSettingsFile(); break;
    case 'settings-share': shareSettingsFile(); break;
    case 'settings-load': $('settings-file').click(); break;
    case 'settings-yes': loadSettings(); break;
    case 'save-copy': {
      const text = JSON.stringify(save);
      ($('save-text') as HTMLTextAreaElement).value = text;
      navigator.clipboard?.writeText(text).then(() => toast('Copied. Paste it somewhere safe.'), () => toast('Select the text below and copy it.'));
      break;
    }
    case 'load-text': loadSave(($('save-text') as HTMLTextAreaElement).value); break;
    case 'load-file': $('load-file').click(); break;
    case 'music-pick': $('music-file').click(); break;
    case 'mute-all': toggleMute(); break;
    case 'music-reset': useDefaultMusic(); break;
    case 'month':
      viewMonth.set(id, Math.max(0, (viewMonth.get(id) ?? 0) + Number(btn.dataset.step)));
      renderHeat();
      if (menuCat === id) openCatMenu(id);
      break;
    case 'skip': {
      const before = save.log.length ? save.log[0] : null;
      const back = moveClock(save.offsetHours + Number(btn.dataset.hours));
      const news = save.log[0] && save.log[0] !== before ? save.log[0].text : null;
      toast(back ? `Back to ${now().toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}. Anything logged after it is undone.`
        : news ?? `Skipped to ${now().toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.`);
      break;
    }
    case 'real-time':
      toast(moveClock(0) ? 'Back to real time. Anything logged on the days you skipped is undone.' : 'Back to real time.');
      break;
    case 'reset-ask':
      $('reset-area').innerHTML = `<span>Delete all cats and progress?</span>
        <button class="btn small" data-action="reset-yes">Delete</button><button class="btn small" data-action="reset-no">Keep</button>`;
      break;
    case 'reset-yes':
      save = fresh();
      setDayStart(save.dayStart);
      lastLevel = null;
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
  // Ids go into HTML attributes, so only plain ones are accepted.
  const plain = (x: any) => typeof x?.id === 'string' && /^[\w-]{1,64}$/.test(x.id);
  if (!Number.isFinite(d.state.xp) || !d.state.cats.every(plain) || !d.state.tasks.every(plain)) return null;
  const cats = d.state.cats.map((c: Cat) => ({ ...c, fedDays: c.fedDays ?? [], sitterTrips: c.sitterTrips ?? [] }));
  return { ...game, state: { ...d.state, cats }, log: Array.isArray(d.log) ? d.log : [], offsetHours: Number(d.offsetHours) || 0 };
}

// Game only: the diary, the achievements and the photos on this device stay as they are.
function loadSave(raw: string) {
  const err = $('save-error');
  try {
    const g = validGame(JSON.parse(raw));
    if (!g) throw new Error();
    save = normalize(g);
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
  toast(save.timeTravel ? "Time travel on. Strays and treats have a rewind button; kitties have one in their long-press menu." : 'Time travel off.');
});
$('amnesia').addEventListener('change', (ev) => {
  save.amnesia = (ev.target as HTMLInputElement).checked;
  save.amnesiaDay = today();   // the first question comes tomorrow
  persist();
  toast(save.amnesia ? "Amnesia on. Tomorrow you'll be asked about any meal you forgot to log." : 'Amnesia off.');
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
$('cat-alarms-on').addEventListener('change', (ev) => {
  const on = (ev.target as HTMLInputElement).checked;
  setReminders({ catAlarmsOn: on });
  if (on) ($('cat-alarms-fold') as HTMLDetailsElement).open = true;
  toast(on ? 'Pick a time for each kitty that should get its own alarm.' : 'Kitty alarms off. Their times are kept for when you turn them back on.');
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
onShown('habit', 'change', (ev) => {
  const sel = ev.target as HTMLSelectElement;
  if (sel.dataset?.gender !== undefined) { draftGender = sel.value as CatGender; redrawLook(); return; }
  const key = sel.dataset?.look;
  if (!key) return;
  draftLook = { ...draftLook, [key]: sel.value } as CatLook;
  redrawLook();
});
// Achievements only: from a backup or an older Kitty Achievement save file.
$('ach-file').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  const err = $('ach-error');
  try {
    const b = unpackBackup(new Uint8Array(await f.arrayBuffer()));
    if (!b.achievement) throw new Error('none');
    err.hidden = true;
    askRestore({ game: null, diary: {}, photos: {}, achievement: b.achievement });
  } catch { err.textContent = "That doesn't hold any achievements. Choose a .kitty backup or an .achkitty save file."; err.hidden = false; }
});

mountDiarySettings($('set-diary-body'), toast);
mountNotesSettings($('set-notes-body'), toast);
const redrawPixelSettings = mountPixelSettings($('set-pixel-body'), toast);
const redrawLookSettings = mountLookSettings($('set-look'));

$('settings-file').addEventListener('change', (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  readSettingsFile(f);
});
$('load-file').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  const err = $('save-error');
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (!isZip(bytes)) {
    const text = new TextDecoder().decode(bytes);
    if (isSettingsText(text)) { readSettingsFile(f); return; }   // a settings file picked under Restore: it only holds settings
    loadSave(text); return;
  }
  try { err.hidden = true; askRestore(unpackBackup(bytes)); }
  catch { err.textContent = "That doesn't look like a Habit Kitty backup."; err.hidden = false; }
});

onShown('habit', 'submit', (ev) => {
  ev.preventDefault();
  const form = ev.target as HTMLFormElement;
  if (form.id === 'adopt') {
    const name = ($('adopt-name') as HTMLInputElement).value;
    const habit = ($('adopt-habit') as HTMLInputElement).value;
    const mode = (form.querySelector('input[name="mode"]:checked') as HTMLInputElement).value as CatMode;
    const input = { id: newId(), name, mode, look: draftLook, gender: draftGender, unlimited: !!save.unlimited };
    const r = adoptFrom ? habitToCat(save.state, adoptFrom, input, now()) : adoptCat(save.state, { ...input, habit }, now());
    save.state = r.state;
    logEvents(r.events);
    persist();
    renderAll();
    if (!r.ok) { const err = $('adopt-error'); err.textContent = reasonText(r.reason); err.hidden = false; return; }
    closeModal();
    toast(adoptFrom ? `${name.trim()} is adopted, and remembers your history.` : `Welcome home, ${name.trim()}! Feed them today.`);
    adoptFrom = null;
  } else if (form.id === 'rename-cat') {
    const id = form.dataset.id ?? '';
    const name = ($('rename-cat-input') as HTMLInputElement).value.trim();
    if (!name || !save.allowRename) return;
    save.state = { ...save.state, cats: save.state.cats.map((c) => (c.id === id ? { ...c, name } : c)) };
    persist(); closeModal(); renderAll(); toast('Kitty renamed.');
  } else if (form.id === 'rename-stray') {
    const id = form.dataset.id ?? '';
    const nickname = ($('rename-stray-input') as HTMLInputElement).value.trim();
    if (!nickname) return;
    save.state = { ...save.state, tasks: save.state.tasks.map((k) => (k.id === id ? { ...k, nickname } : k)) };
    persist(); closeModal(); renderAll(); toast('Stray kitty renamed.');
  } else if (form.id === 'stray-schedule') {
    const id = form.dataset.id ?? '';
    const rep = ($('sched-repeat') as HTMLSelectElement).value;
    const weekdays = rep === 'weekdays' ? [...form.querySelectorAll<HTMLInputElement>('input[name="sched-day"]:checked')].map((c) => Number(c.value)) : [];
    if (rep === 'weekdays' && !weekdays.length) { toast('Pick at least one weekday.'); return; }
    const days = rep === 'custom' ? Number(($('sched-days') as HTMLInputElement).value) : Number(rep);
    if (rep !== 'weekdays' && !(days >= 1)) { toast('Pick how many days.'); return; }
    save.state = setHabitSchedule(save.state, id, { cooldownDays: days, weekdays });
    const k = save.state.tasks.find((x) => x.id === id);
    persist(); closeModal(); renderAll(); toast(k ? `${strayName(k)} now comes ${scheduleText(k)}.` : 'Saved.');
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
    const name = ($('room-name-input') as HTMLInputElement).value.trim() || undefined;
    if (roomView === 'outdoor') save.outdoorName = name; else save.roomName = name;
    persist(); closeModal(); renderRoomTitle(); renderRoomNote(); toast(roomView === 'outdoor' ? 'Garden renamed.' : 'Room renamed.');
  } else if (form.id === 'task-form') {
    const input = $('task-name') as HTMLInputElement;
    const kind = mindfulView;
    if (!input.value.trim()) { toast(`Name the ${kind === 'habit' ? 'stray kitty' : 'treat'} first.`); return; }
    const rep = ($('task-repeat') as HTMLSelectElement).value;
    const weekdays = rep === 'weekdays'
      ? [...form.querySelectorAll<HTMLInputElement>('input[name="weekday"]:checked')].map((c) => Number(c.value)) : [];
    if (rep === 'weekdays' && !weekdays.length) { toast('Pick at least one weekday.'); return; }
    const days = rep === 'custom' ? Number(($('task-days') as HTMLInputElement).value) : Number(rep);
    save.state = addMindfulTask(save.state, {
      id: newId(), name: input.value, kind, nickname: ($('task-nick') as HTMLInputElement).value, xp: Number(($('task-xp') as HTMLInputElement).value) || 1, cooldownDays: days || 1, weekdays,
    }, now());
    input.value = '';
    ($('task-nick') as HTMLInputElement).value = '';
    form.querySelectorAll<HTMLInputElement>('input[name="weekday"]').forEach((c) => { c.checked = false; });
    persist();
    renderAll();
    toast(kind === 'task' ? 'Treat added.' : 'Stray kitty added.');
  }
});

onShown('habit', 'click', (ev) => {
  if (!(ev.target as HTMLElement).closest('#clock-pop')) $('clock-pop').classList.remove('open');
});

$('task-repeat').addEventListener('change', () => renderTasks());

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
    openModal(`<div class="panel"><h3>Delete this ${task.kind === 'habit' ? 'stray kitty' : 'treat'}?</h3><p>${esc(task.name)}</p>${task.kind === 'habit' && task.doneDays.length ? '<p class="muted">Its history will be lost.</p>' : ''}
      <div class="btns"><button class="btn" data-action="modal-close">Keep</button>
      <button class="btn primary" data-action="delete-task-yes" data-id="${id}">Delete</button></div></div>`);
}

function fireHold(el: HTMLElement) {
  endHold();
  const id = el.dataset.id ?? el.dataset.task ?? '';
  if (el.dataset.hold === 'cat') openCatMenu(id);
  else if (el.dataset.hold === 'stray') openStrayMenu(id);
  else openTreatMenu(id);
}

// Long press on a kitty, a stray or a treat opens the same kind of menu: its card on top, then Heatmap (the default) / Options
// (a kitty also has its Diary). The options come in the same order: the main action, the renames, Time travel, then the way out.
type MenuTab = 'options' | 'heat' | 'diary';
let menuCat: string | null = null;
let menuTab: MenuTab = 'heat';
const MENU_TABS: Record<MenuTab, string> = { heat: 'Heatmap', diary: 'Diary', options: 'Options' };   // a stray has the same without the Diary

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
    : `<div class="stack">${sitterBtn}
      ${save.allowRename ? `<button class="btn" data-action="rename-cat" data-id="${id}">Rename ${esc(cat.name)}</button>` : ''}
      <button class="btn" data-action="rename-habit" data-id="${id}">Rename habit</button>
      ${save.timeTravel ? `<button class="btn" data-action="travel" data-id="${id}">Time travel</button>` : ''}
      ${cat.status === 'alive' ? `<button class="btn" data-action="release-ask" data-id="${id}">Release to the stray colony</button>` : ''}
      <button class="btn" data-action="shelter-ask" data-id="${id}">Return to the shelter</button></div>`;
  openModal(`<div class="panel">${closeX('modal-close')}
    ${catHead(cat, today(), false)}
    <div class="seg" role="tablist">${(Object.keys(MENU_TABS) as MenuTab[]).map((v) =>
      `<button type="button" role="tab" data-action="menu-tab" data-view="${v}" data-id="${id}" aria-selected="${v === menuTab}">${MENU_TABS[v]}</button>`).join('')}</div>
    ${pane}</div>`);
}

// Long press on a stray (in the stray list or outdoors): the same layout as the kitty menu, with Heatmap and Options tabs.
// A stray is a habit, so feeding one is doing the habit; nothing bad happens if you skip a day.
type StrayTab = 'heat' | 'options';
let menuStray: string | null = null;
let strayTab: StrayTab = 'heat';
const STRAY_TABS: Record<StrayTab, string> = { heat: 'Heatmap', options: 'Options' };

function strayHead(k: MindfulTask, t: number, holdable = false): string {
  const left = daysUntilReady(k, t);
  const fed = strayDoneToday(k, t);
  const look = strayLook(k);
  const face: Face = fed ? 'happy' : 'open';
  const label = fed ? 'Fed today' : left ? `Next in ${plural(left, 'day')}` : 'Waiting for a meal';
  const button = `<button class="btn primary sq" data-action="task" data-id="${k.id}" ${left ? 'disabled' : ''} aria-label="${left ? `${esc(k.name)} is fed for now` : `Feed ${esc(k.name)}`}">${left ? `<b>${iconSvg('check')}</b>` : foodIcon(foodFor(k, t))}</button>`;
  return `<div class="cat-head"${holdable ? ` data-hold="stray" data-id="${k.id}"` : ''}><div class="cat-side">${sprite(face, look)}${button}</div>
    <div><p class="cat-name">${esc(strayName(k))}<span class="mode">stray · ${look.trait}</span></p>
      <p class="cat-habit">${esc(k.name)} · ${scheduleText(k)} · +${k.xp} XP</p>
      <span class="chip ${fed ? 'fed' : left ? 'none' : 'today'}">${label}</span></div>
</div>`;
}

function openStrayMenu(id: string, tab?: StrayTab) {
  const k = save.state.tasks.find((x) => x.id === id && x.kind === 'habit');
  if (!k) return;
  if (tab) strayTab = tab;
  menuStray = id;
  const pane = strayTab === 'heat'
    ? renderMonth(habitSubject(k), today(), k) + HEAT_LEGEND
    : `<div class="stack">
      ${k.cooldownDays === 1 && !k.weekdays?.length ? `<button class="btn primary" data-action="habit-kitty" data-id="${id}">Adopt the kitty</button>` : '<p class="muted">Only daily strays can be adopted.</p>'}
      <button class="btn" data-action="rename-stray" data-id="${id}">Rename ${esc(strayName(k))}</button>
      <button class="btn" data-action="rename-habit" data-id="${id}">Rename habit</button>
      <button class="btn" data-action="stray-schedule" data-id="${id}">Change how often</button>
      ${save.timeTravel ? `<button class="btn" data-action="travel" data-id="${id}">Time travel</button>` : ''}
      <button class="btn" data-action="task-del" data-id="${id}">Delete stray kitty</button></div>`;
  openModal(`<div class="panel">${closeX('modal-close')}
    ${strayHead(k, today())}
    <div class="seg" role="tablist">${(Object.keys(STRAY_TABS) as StrayTab[]).map((v) =>
      `<button type="button" role="tab" data-action="stray-tab" data-view="${v}" data-id="${id}" aria-selected="${v === strayTab}">${STRAY_TABS[v]}</button>`).join('')}</div>
    ${pane}</div>`);
}

// A treat's menu: its name, what it pays, and the same options as the others (Time travel, then delete).
function openTreatMenu(id: string) {
  const k = save.state.tasks.find((x) => x.id === id && x.kind === 'task');
  if (!k) return;
  const done = k.lastDoneDay !== null;
  openModal(`<div class="panel">${closeX('modal-close')}
    <div class="cat-head solo"><div><p class="cat-name">${esc(k.name)}<span class="mode">treat · +${k.xp} XP</span></p>
      <span class="chip ${done ? 'fed' : 'today'}">${done ? 'Done' : 'To do'}</span></div></div>
    <div class="stack">
      ${save.timeTravel ? `<button class="btn" data-action="travel" data-id="${id}">Time travel</button>` : ''}
      <button class="btn" data-action="task-del" data-id="${id}">Delete treat</button></div></div>`);
}

const holdTarget = (ev: Event) => (ev.target as HTMLElement).closest<HTMLElement>('[data-hold], li[data-task]');
onShown('habit', 'pointerdown', (ev) => {
  const el = holdTarget(ev);
  if (!el || (ev.target as HTMLElement).closest('button')) return;
  endHold();
  holdEl = el;
  holdFrom = { x: ev.clientX, y: ev.clientY };
  el.classList.add('pressing');
  holdTimer = window.setTimeout(() => fireHold(el), HOLD_MS);
});
onShown('habit', 'pointermove', (ev) => {
  if (holdEl && Math.hypot(ev.clientX - holdFrom.x, ev.clientY - holdFrom.y) > 12) endHold();
});
onShown('habit', 'pointerup', endHold);
// Android cancels the pointer when its own long-press fires, so a cancel must not abort the hold;
// only an actual scroll does.
onShown('habit', 'scroll', endHold, true);
onShown('habit', 'contextmenu', (ev) => {
  const el = holdTarget(ev);
  if (!el) return;
  ev.preventDefault();
  fireHold(el);
});

// Re-settle when the page comes back and at each 2am rollover.
function tick() { settle(); renderAll(); queueReminderSync(); checkAmnesia(); checkAccomplishments(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
// Back from Kitty Achievement: the theme may have changed there, and the clock moved on.
onAppShown('habit', () => {
  if (tab === 'settings') showTab(tabBeforeSettings);   // coming back to Habit Kitty leaves Settings (unless Settings was asked for, below)
  tick();
});
// Asked for a tab from the home page or another app (Settings), or the widget (Room).
document.addEventListener(TAB_EVENT, (ev) => {
  const d = (ev as CustomEvent<{ app: string; tab: string; from?: AppName }>).detail;
  if (d.app !== 'habit') return;
  if (d.tab === 'settings') { settingsFrom = d.from ?? 'habit'; showTab('settings'); }
  else if (d.tab === 'room') openNav('kitty', 'room');
  else if (d.tab === 'today') openNav('kitty', 'list');
});
function scheduleRollover() {
  setTimeout(() => { tick(); scheduleRollover(); }, Math.min(nextReset(now()).getTime() - now().getTime() + 1000, 60_000));
}

loadDiary();
initNotes();
initShopping();
settle();
renderAll();
openNav('kitty', 'list');
openWidgetTab();
scheduleRollover();
showWhatsNew();
checkAmnesia();
connectAccount();
queueReminderSync();
