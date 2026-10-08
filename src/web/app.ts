// Phone playtest build of Habit Kitty. Bundled into one HTML page by `npm run build:web`.
import {
  CONFIG, newState, adoptCat, feedCat, startSitter, resumeCat, settleAll, addMindfulTask,
  doMindfulTask, removeMindfulTask, returnToShelter, dayIndex, nextReset, levelProgress, hunger, sitterCooldownLeft,
  type ActionResult, type AppState, type Cat, type CatMode, type CatLook, type CatPattern, type GameEvent, type Reason,
} from '../rules.ts';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { dateOf, monthGrid, streak, weekRow, type DayKind } from '../calendar.ts';

// ===================== Save =====================
interface LogLine { at: number; text: string }
interface Save { v: 1; state: AppState; offsetHours: number; log: LogLine[]; savedAt: number; logHidden?: boolean; combineHeat?: boolean }

const KEY = 'habit-kitty-save-v1';
const fresh = (): Save => ({ v: 1, state: newState(), offsetHours: 0, log: [], savedAt: 0 });

function readLocal(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let save: Save = readLocal() ?? fresh();

// Optional account sync: only viewers who can write their own data get it.
type DocRef = { get(): Promise<{ exists: boolean; data(): unknown }>; set(d: object): Promise<void> };
let remote: DocRef | null = null;
let writing: Promise<void> = Promise.resolve();

function persist() {
  save.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode: keep playing in memory */ }
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
      save = theirs;
      try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
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
    case 'already_fed_today': return `${n} is already fed today. The next day starts at 2am.`;
    case 'with_sitter': return `${n} is with the sitter. Bring them home first.`;
    case 'already_with_sitter': return `${n} is already with the sitter.`;
    case 'not_with_sitter': return `${n} isn't with the sitter.`;
    case 'sitter_cooldown':
      return `${n} can visit the sitter once every ${CONFIG.sitterCooldownDays} days. ` +
        `${plural(cat ? sitterCooldownLeft(cat, today()) : 0, 'day')} to go.`;
    case 'low_affection_cat_limit':
      return 'Your affection is below 0, so cats only trust you with one at a time. Feed your cat or do mindful tasks to earn it back.';
    case 'task_on_cooldown': return 'You did this one recently. It comes back after its cooldown.';
    case 'cat_not_active': return `${n} isn't here anymore.`;
    case 'no_such_cat': case 'no_such_task': return 'That no longer exists.';
  }
}

function logEvents(events: GameEvent[]) {
  const at = now().getTime();
  for (const e of events) save.log.unshift({ at, text: eventText(e) });
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
const SPRITE_BASE = [
  '.............',
  '.o.........o.',
  'ofo.......ofo',
  'ofpooooooopfo',
  'offfffffffffo',
  'offfffffffffo',
  '@@@@@@@@@@@@@',   // eyes, top row
  '#############',   // eyes, bottom row
  '$$$$$$$$$$$$$',   // cheeks / nose
  '%%%%%%%%%%%%%',   // mouth
  '.offfffffffo.',
  'offfffffffffo',
  'offwfffffwffo',
  '.ooooooooooo.',
];
type Face = 'open' | 'happy' | 'sleepy' | 'sad' | 'starving' | 'dead';
const FACES: Record<Face, [string, string, string, string]> = {
  open:     ['offEfffffEffo', 'offEfffffEffo', 'offffwnwffffo', 'offfffmfffffo'],
  happy:    ['offEfffffEffo', 'ofEfEfffEfEfo', 'ofpffwnwffpfo', 'offffmfmffffo'],
  sleepy:   ['offfffffffffo', 'ofEEEfffEEEfo', 'offffwnwffffo', 'offfffmfffffo'],
  sad:      ['offEfffffEffo', 'offEfffffEffo', 'offtfwnwftffo', 'offfffmfffffo'],
  starving: ['offEfffffEffo', 'offEfffffEffo', 'offtfwnwftffo', 'offffmmmffffo'],
  dead:     ['ofEfEfffEfEfo', 'offEfffffEffo', 'offffwnwffffo', 'offfffmfffffo'],
};
const FURS = ['#e8a04c', '#9aa0ad', '#4a4552', '#f0d9b5', '#a8714a', '#f4f1ea', '#d9884f', '#7d8796'];
const PATTERNS: CatPattern[] = ['plain', 'stripes', 'patch', 'mask'];
const randomLook = (): CatLook => ({
  fur: FURS[Math.floor(Math.random() * FURS.length)],
  pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
});
const hash = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// Cats adopted before appearances existed get a stable look derived from their id.
const lookFor = (c: Cat): CatLook => c.look ?? { fur: FURS[hash(c.id) % FURS.length], pattern: 'plain' };

const shade = (hex: string, f: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
const OVERLAY: Record<CatPattern, { cells: [number, number][]; light: boolean }> = {
  plain: { cells: [], light: false },
  stripes: { cells: [[4, 4], [6, 4], [8, 4], [6, 5], [1, 11], [11, 11], [1, 12], [11, 12]], light: false },
  patch: { cells: [[1, 4], [2, 4], [3, 4], [1, 5], [2, 5]], light: true },
  mask: { cells: [[4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11]], light: true },
};

function sprite(face: Face, look: CatLook, faded = false): string {
  const [e1, e2, nose, mouth] = FACES[face];
  const rows = SPRITE_BASE.map((r) =>
    r[0] === '@' ? e1 : r[0] === '#' ? e2 : r[0] === '$' ? nose : r[0] === '%' ? mouth : r);
  if (face === 'dead') rows[0] = '...hhhhhhh...';
  const fur = face === 'dead' ? '#c9c6d2' : look.fur;
  const color: Record<string, string> = {
    o: '#2a2433', f: fur, p: '#f2a7b8', E: '#2a2433',
    n: '#e0738c', m: '#2a2433', w: '#fbf8f2', t: '#6fb2ef', h: '#f0c45e',
  };
  const ov = OVERLAY[look.pattern] ?? OVERLAY.plain;
  const accent = ov.light ? '#fbf8f2' : shade(fur, 0.68);
  let rects = '';
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const patterned = ch === 'f' && ov.cells.some(([cx, cy]) => cx === x && cy === y);
    const fill = patterned ? accent : color[ch];
    if (fill) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
  }));
  return `<svg class="sprite${faded ? ' faded' : ''}" viewBox="0 0 13 14" aria-hidden="true" shape-rendering="crispEdges">${rects}</svg>`;
}

// Pixel heart for petting.
const HEART_ART = ['.oo..oo.', 'orroorro', 'orwrrrro', 'orrrrrro', '.orrrro.', '..orro..', '...oo...'];
const HEART = `<svg viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true">${HEART_ART.map((row, y) => [...row].map((ch, x) =>
  ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${ch === 'o' ? '#5a1f3a' : ch === 'w' ? '#ffd1dd' : '#ec4b78'}"/>`).join('')).join('')}</svg>`;

// ===================== Food =====================
const FOOD_PAL: Record<string, string> = {
  o: '#2a2433', b: '#a8714a', B: '#7a4f2e', u: '#6fb2ef', r: '#e0606f', w: '#fbf8f2', g: '#8fb4d4',
  s: '#c9d9e6', e: '#ee8a4c', c: '#e9b872', C: '#f6d9a0', m: '#c4524a', M: '#e08a7a', p: '#f2a7b8', y: '#f0c45e',
};
const FOODS: Record<string, { label: string; art: string[] }> = {
  kibbles: { label: 'kibbles', art: [
    '..........', '...b..b...', '..bBbbBb..', '.bbBbbbBb.', 'oooooooooo', 'ouuuuuuuuo', '.ouuuuuuo.', '..oooooo..'] },
  'wet food': { label: 'wet food', art: [
    '..........', '.oooooooo.', '.owwwwwwo.', '.orrrrrro.', '.orwppwro.', '.orrrrrro.', '.oooooooo.', '..........'] },
  fish: { label: 'fish', art: [
    '..........', '....oooo.o', '..ooggggoo', '.oggoggggo', 'oggggggggo', '.ogsssggoo', '..oogggoo.', '....oooo.o'] },
  chicken: { label: 'chicken', art: [
    '..oooo....', '.occCco...', '.oCccCco..', '.occCcco..', '..ooccoo..', '....oowo..', '.....owwo.', '......oo..'] },
  shrimp: { label: 'shrimp', art: [
    '...oooo...', '..oeeeeo..', '.oeeoeeeo.', '.oeeo.oeo.', '..oo.oeeo.', '....oeeeo.', '...oeeeo..', '..oeeoo...'] },
  meat: { label: 'meat', art: [
    '..........', '..oooooo..', '.ommmmmmo.', 'omMMmmmwmo', 'ommmMmmmmo', '.ommmmmmo.', '..oooooo..', '..........'] },
};
const FOOD_KEYS = Object.keys(FOODS);
// A different treat for every cat, every day (stable within the day).
const foodFor = (c: Cat, day: number) => FOOD_KEYS[hash(`${c.id}:${day}`) % FOOD_KEYS.length];
function foodIcon(kind: string): string {
  const art = FOODS[kind].art;
  let r = '';
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (FOOD_PAL[ch]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${FOOD_PAL[ch]}"/>`;
  }));
  return `<svg class="food" viewBox="0 0 10 8" aria-hidden="true" shape-rendering="crispEdges">${r}</svg>`;
}

// ===================== Rendering =====================
const viewMonth = new Map<string, number>();   // cat id -> months back from current

function renderTop() {
  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(save.state.xp);
  const filled = save.state.xp < 0 ? 0 : Math.round((10 * xpIntoLevel) / xpForNextLevel);
  const bar = Array.from({ length: 10 }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
  $('top').innerHTML = `
    <div class="brand"><h1>Habit <span>Kitty</span></h1><span class="muted">Level <b class="num">${level}</b></span></div>
    <div class="meter">
      <div class="meter-row"><span>Affection <b>${save.state.xp}</b> xp</span>
        <span class="muted num">${xpIntoLevel}/${xpForNextLevel} to level ${level + 1}</span></div>
      <div class="bar" role="img" aria-label="${xpIntoLevel} of ${xpForNextLevel} xp to the next level">${bar}</div>
    </div>
    ${save.state.xp < CONFIG.lowXpThreshold
      ? '<p class="distrust">Your affection is below 0. Until it recovers, you can only keep one cat.</p>' : ''}`;
}

function renderLog() {
  const el = $('log');
  el.hidden = !save.log.length || !!save.logHidden;
  el.innerHTML = `<button class="x" type="button" data-action="log-close" aria-label="Close update">✕</button>
    <h2>Update · what happened</h2><ul style="list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;font-size:15px">${save.log.map((l) =>
    `<li><time class="muted num" style="font-size:12px;margin-right:8px">${new Date(l.at).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</time>${esc(l.text)}</li>`).join('')}</ul>`;
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

function renderMonth(c: Cat, t: number): string {
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
  const stats = g.tracked
    ? `Fed <b class="num">${g.count.fed}/${g.tracked}</b> days (${pct}%)` +
      (g.count.sitter ? ` · ${plural(g.count.sitter, 'day')} with the sitter` : '') +
      (back === 0 && c.status === 'alive' ? ` · streak <b class="num">${streak(c, t)}</b>` : '')
    : g.count.sitter ? 'With the sitter all month' : 'Nothing tracked this month';
  const firstMonth = dateOf(c.adoptedDay);
  const atStart = shown.getUTCFullYear() * 12 + shown.getUTCMonth() <= firstMonth.getUTCFullYear() * 12 + firstMonth.getUTCMonth();
  return `<div class="month">
    <div class="month-nav">
      <button type="button" data-action="month" data-id="${c.id}" data-step="1" ${atStart ? 'disabled' : ''} aria-label="Previous month">‹</button>
      <strong>${g.title}</strong>
      <button type="button" data-action="month" data-id="${c.id}" data-step="-1" ${back === 0 ? 'disabled' : ''} aria-label="Next month">›</button>
    </div>
    <div class="grid" role="img" aria-label="${esc(c.name)}, ${g.title}: fed ${g.count.fed} of ${g.tracked} days">${cells}</div>
    <p class="stats">${stats}</p>
  </div>`;
}

const isActive = (c: Cat) => ['alive', 'sitter', 'ranAway'].includes(c.status);
const sortedCats = () => [...save.state.cats].sort((a, b) => Number(!isActive(a)) - Number(!isActive(b)));

function renderWeek(c: Cat, t: number): string {
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return `<div class="week" role="img" aria-label="${esc(c.name)} this week">${weekRow(c, t).map((x, i) =>
    `<div title="${fmtDay(x.day)}: ${x.kind}"><span class="dot ${x.kind}${x.day === t ? ' now' : ''}"></span>${names[i]}</div>`).join('')}</div>`;
}

function renderCats() {
  const t = today();
  const cats = sortedCats();
  if (!cats.length) {
    $('cats').innerHTML = `<div class="cat"><div class="cat-head">${sprite('open', { fur: '#e8a04c', pattern: 'plain' }, true)}
      <div><p class="cat-name">No cats yet</p><p class="cat-habit">Tap Adopt cat to get your first one.</p></div></div></div>`;
    return;
  }
  $('cats').innerHTML = cats.map((c) => {
    const s = catStatus(c, t);
    const ended = !isActive(c);
    let buttons = '';
    if (c.status === 'alive') {
      const fed = c.lastFedDay === t;
      buttons = `<button class="btn primary" data-action="feed" data-id="${c.id}" ${fed ? 'disabled' : ''}>${fed ? 'Fed today' : `${foodIcon(foodFor(c, t))} Feed`}</button>`;
    } else if (c.status === 'sitter') {
      buttons = `<button class="btn primary" data-action="resume" data-id="${c.id}">Bring home</button>`;
    } else if (c.status === 'ranAway') {
      buttons = `<button class="btn primary" data-action="feed" data-id="${c.id}">${foodIcon(foodFor(c, t))} Call them back</button>`;
    }
    const left = c.status === 'alive' ? 3 - c.missed : 0;
    const hp = `<div class="hp${left === 1 ? ' low' : ''}" role="img" aria-label="health ${left} of 3">${[0, 1, 2].map((i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</div>`;
    return `<article class="cat${ended ? ' ended' : ''}">
      <div class="cat-head"${ended ? '' : ` data-hold="cat" data-id="${c.id}"`}>${sprite(s.face, lookFor(c), s.faded)}
        <div><p class="cat-name">${esc(c.name)}<span class="mode">${c.mode === 'classic' ? 'classic' : 'light-hearted'}</span></p>
          <p class="cat-habit">${esc(c.habit)}</p>
          <span class="chip ${s.chip}">${s.label}</span>${hp}</div>
      </div>
      ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
      ${buttons ? `<div class="actions">${buttons}</div>` : ''}
      ${ended ? '' : renderWeek(c, t)}
    </article>`;
  }).join('');
}

function renderCombined(): string {
  const t = today();
  const cats = sortedCats();
  const back = viewMonth.get('all') ?? 0;
  const d = dateOf(t);
  const shown = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  const grids = cats.map((c) => monthGrid(c, shown.getUTCFullYear(), shown.getUTCMonth(), t));
  const g0 = grids[0];
  const cols = Math.ceil(Math.sqrt(cats.length));
  const cells = [
    ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<div class="dow">${x}</div>`),
    ...Array.from({ length: g0.lead }, () => '<div class="px blank"></div>'),
    ...g0.days.map((x, i) => `<div class="cell${x.day === t ? ' now' : ''}" style="grid-template-columns:repeat(${cols},1fr)" title="${fmtDay(x.day)}">
      ${grids.map((g) => `<i class="s ${g.days[i].kind}"></i>`).join('')}<span>${x.date}</span></div>`),
  ].join('');
  const first = Math.min(...cats.map((c) => c.adoptedDay));
  const fm = dateOf(first);
  const atStart = shown.getUTCFullYear() * 12 + shown.getUTCMonth() <= fm.getUTCFullYear() * 12 + fm.getUTCMonth();
  return `<article class="cat"><div class="month">
    <div class="month-nav">
      <button type="button" data-action="month" data-id="all" data-step="1" ${atStart ? 'disabled' : ''} aria-label="Previous month">‹</button>
      <strong>${g0.title}</strong>
      <button type="button" data-action="month" data-id="all" data-step="-1" ${back === 0 ? 'disabled' : ''} aria-label="Next month">›</button>
    </div>
    <div class="grid" role="img" aria-label="All cats, ${g0.title}">${cells}</div>
    <div class="slice-key" style="grid-template-columns:repeat(${cols},auto)">${cats.map((c, i) =>
      `<span><b class="num">${i + 1}</b>${sprite(catStatus(c, t).face, lookFor(c), !isActive(c) && c.status !== 'dead')}${esc(c.name)}</span>`).join('')}</div>
    <p class="stats">Each day is split into one slice per cat, in the order shown above.</p>
  </div></article>`;
}

function renderHeat() {
  const t = today();
  const cats = sortedCats();
  if (save.combineHeat && cats.length) {
    $('heat').innerHTML = renderCombined() + `<div class="legend"><span><i class="fed"></i>fed</span><span><i class="missed"></i>missed</span>
    <span><i class="today"></i>today (outlined)</span><span><i class="sitter"></i>with sitter</span><span><i></i>not tracked</span></div>`;
    return;
  }
  $('heat').innerHTML = cats.length ? cats.map((c) => `<article class="cat">
      <div class="cat-head">${sprite(catStatus(c, t).face, lookFor(c), !isActive(c) && c.status !== 'dead')}
        <div><p class="cat-name">${esc(c.name)}</p><p class="cat-habit">${esc(c.habit)}</p></div></div>
      ${renderMonth(c, t)}
    </article>`).join('') + `<div class="legend"><span><i class="fed"></i>fed</span><span><i class="missed"></i>missed</span>
    <span><i class="today"></i>today (outlined)</span><span><i class="sitter"></i>with sitter</span><span><i></i>not tracked</span></div>`
    : '<p class="muted">No cats yet.</p>';
}

// ---- cozy room: lives in real time (sky follows the clock, cats wander, sleep at night) ----
// Positions are [x, feet-y] in room units (80 x 112); a cat is 17.6 units wide and ~19 tall.
const ROOM_W = 80, ROOM_H = 112, PET_W = 17.6, PET_H = 19;
const SPOTS: [number, number][] = [
  [3, 84], [27, 104], [46, 98], [12, 100], [58, 105], [30, 88],   // cushion, rug, floor
  [59, 44], [53, 62], [61, 84],                                  // cat tree: top, middle, base
];
const NIGHT_SPOTS: [number, number][] = [[3, 84], [27, 104], [61, 84], [46, 98], [12, 100], [58, 105]];
const roomPos = new Map<string, number>(); // cat id -> index into SPOTS
let roomSig = '';
const skyPhase = (): 'day' | 'dusk' | 'night' => {
  const h = now().getHours();
  return h >= 8 && h < 17 ? 'day' : (h >= 6 && h < 8) || (h >= 17 && h < 20) ? 'dusk' : 'night';
};
const petStyle = ([x, y]: [number, number]) =>
  `left:${(x / ROOM_W) * 100}%;top:${((y - PET_H) / ROOM_H) * 100}%;z-index:${Math.round(y)}`;

function roomBg(phase: 'day' | 'dusk' | 'night'): string {
  const sky = { day: '#bfe4f5', dusk: '#f2a77b', night: '#1d2748' }[phase];
  const wall = { day: '#f3e3d0', dusk: '#ecd0b4', night: '#c9b3a6' }[phase];
  const sun = phase === 'day' ? '<rect x="35" y="14" width="5" height="5" fill="#f7d54a"/>'
    : phase === 'dusk' ? '<rect x="26" y="26" width="6" height="5" fill="#f7d54a"/>'
    : '<rect x="34" y="14" width="5" height="5" fill="#f4f1e0"/><rect x="36" y="14" width="3" height="3" fill="#1d2748"/><rect x="24" y="16" width="1" height="1" fill="#fff"/><rect x="28" y="26" width="1" height="1" fill="#fff"/><rect x="40" y="28" width="1" height="1" fill="#fff"/>';
  return `<svg class="bg" viewBox="0 0 ${ROOM_W} ${ROOM_H}" shape-rendering="crispEdges" aria-hidden="true">
    <rect width="80" height="112" fill="${wall}"/><rect width="80" height="6" fill="#e6cfb6"/>
    <rect y="68" width="80" height="44" fill="#b98a5e"/><rect y="68" width="80" height="2" fill="#8d6641"/>
    <g fill="#8d6641" opacity=".35"><rect y="76" width="80" height=".6"/><rect y="84" width="80" height=".6"/><rect y="92" width="80" height=".6"/><rect y="100" width="80" height=".6"/><rect y="108" width="80" height=".6"/></g>
    <rect x="18" y="10" width="28" height="26" fill="#6e4b32"/><rect x="20" y="12" width="24" height="22" fill="${sky}"/>${sun}
    <rect x="31" y="12" width="2" height="22" fill="#6e4b32"/><rect x="20" y="22" width="24" height="2" fill="#6e4b32"/>
    <rect x="16" y="36" width="32" height="2" fill="#6e4b32"/>
    <rect x="54" y="14" width="14" height="10" fill="#6e4b32"/><rect x="55" y="15" width="12" height="8" fill="#f2a7b8"/><rect x="57" y="17" width="4" height="4" fill="#fbf8f2"/>
    <rect x="6" y="52" width="9" height="9" fill="#a8714a"/><rect x="8" y="42" width="5" height="10" fill="#3a9d5d"/><rect x="5" y="46" width="4" height="6" fill="#4fbf78"/><rect x="12" y="45" width="4" height="7" fill="#4fbf78"/>
    <rect x="6" y="61" width="9" height="7" fill="#a8714a"/>
    <ellipse cx="38" cy="95" rx="30" ry="9" fill="#c2416b"/><ellipse cx="38" cy="95" rx="23" ry="6" fill="#e8809f"/>
    <rect x="2" y="84" width="24" height="9" fill="#7a5a8c"/><rect x="2" y="81" width="24" height="4" fill="#9a7aac"/>
    <g><!-- cat tree -->
      <rect x="64" y="46" width="5" height="38" fill="#d9b98a"/><g fill="#b8955f"><rect x="64" y="52" width="5" height="1"/><rect x="64" y="58" width="5" height="1"/><rect x="64" y="64" width="5" height="1"/><rect x="64" y="70" width="5" height="1"/><rect x="64" y="76" width="5" height="1"/></g>
      <rect x="56" y="44" width="23" height="4" fill="#8a63a8"/><rect x="56" y="48" width="23" height="1" fill="#5d3f78"/>
      <rect x="52" y="62" width="22" height="4" fill="#8a63a8"/><rect x="52" y="66" width="22" height="1" fill="#5d3f78"/>
      <rect x="58" y="82" width="22" height="22" fill="#c9a06a"/><rect x="58" y="82" width="22" height="3" fill="#8a63a8"/>
      <rect x="63" y="90" width="12" height="14" fill="#5d4330"/><rect x="65" y="88" width="8" height="2" fill="#5d4330"/><rect x="60" y="101" width="3" height="3" fill="#e0606f"/>
      <rect x="74" y="49" width="1" height="8" fill="#e0606f"/><rect x="73" y="57" width="3" height="3" fill="#f0c45e"/>
    </g>
    ${phase === 'night' ? '<rect width="80" height="112" fill="#1d2748" opacity=".38"/><rect x="5" y="26" width="3" height="3" fill="#ffe9a0"/><circle cx="6.5" cy="27.5" r="9" fill="#ffe9a0" opacity=".16"/>' : ''}
  </svg>`;
}

// Cats that are away (sitter, ran away) aren't home, so they aren't in the room.
const homeCats = () => sortedCats().filter((c) => c.status === 'alive').slice(0, SPOTS.length);

function renderRoom() {
  const t = today();
  const phase = skyPhase();
  const pets = homeCats();
  const faceOf = (c: Cat): Face => (phase === 'night' ? 'sleepy' : catStatus(c, t).face);
  const sig = phase + '|' + pets.map((c) => `${c.id}:${faceOf(c)}:${lookFor(c).fur}${lookFor(c).pattern}:${c.name}`).join('|');
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
    const pos = phase === 'night' ? NIGHT_SPOTS[i] : SPOTS[spotIdx(c, i)];
    return `<div class="pet" data-id="${c.id}" style="${petStyle(pos)}">${sprite(faceOf(c), lookFor(c))}${phase === 'night' ? '<b class="zz">z z</b>' : ''}<em>${esc(c.name)}</em></div>`;
  }).join('')}</div>`;
  const clock = now().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  const away = save.state.cats.filter((c) => c.status === 'sitter').length;
  $('room-note').textContent = !pets.length
    ? (away ? 'Everyone is with the pet sitter. The room is quiet.' : 'It is quiet in here. Adopt a cat and they will move in.')
    : `It's ${clock}. ${phase === 'night' ? 'Everyone is asleep.' : 'Your cats are making themselves at home.'}${away ? ` ${plural(away, 'cat')} with the sitter.` : ''}`;
}

function wander() {
  if (tab !== 'room' || skyPhase() === 'night') return;
  const els = [...document.querySelectorAll<HTMLElement>('#room .pet')];
  const taken = new Set(els.map((el) => roomPos.get(el.dataset.id ?? '')));
  els.forEach((el) => {
    if (Math.random() < 0.4) return;
    const id = el.dataset.id ?? '';
    const from = roomPos.get(id) ?? 0;
    const free = SPOTS.map((_, i) => i).filter((i) => !taken.has(i));
    if (!free.length) return;
    const to = free[Math.floor(Math.random() * free.length)];
    taken.delete(from); taken.add(to);
    roomPos.set(id, to);
    const spr = el.querySelector<SVGElement>('.sprite');
    if (spr) spr.style.transform = SPOTS[to][0] < SPOTS[from][0] ? 'scaleX(-1)' : '';
    el.setAttribute('style', petStyle(SPOTS[to]));
  });
}
setInterval(wander, 3500);

// Double-tap an awake cat to make a heart float up from it.
let lastTap = { id: '', at: 0 };
$('room').addEventListener('click', (ev) => {
  const pet = (ev.target as HTMLElement).closest<HTMLElement>('.pet');
  if (!pet || skyPhase() === 'night') return;
  const t = Date.now();
  const id = pet.dataset.id ?? '';
  const double = lastTap.id === id && t - lastTap.at < 350;
  lastTap = double ? { id: '', at: 0 } : { id, at: t };
  if (!double) return;
  const heart = document.createElement('i');
  heart.className = 'heart';
  heart.innerHTML = HEART;
  pet.appendChild(heart);
  setTimeout(() => heart.remove(), 1300);
});

const repeatText = (d: number) => d === 1 ? 'daily' : d === 7 ? 'weekly' : d === 14 ? 'every 2 weeks' : d === 30 ? 'monthly' : `every ${d} days`;

function renderTasks() {
  const t = today();
  const tasks = save.state.tasks;
  const earned = save.state.mindfulEarned?.day === t ? save.state.mindfulEarned.xp : 0;
  $('mindful-cap').textContent = `Earned today: ${earned}/${CONFIG.mindfulDailyCap} xp`;
  $('tasks').innerHTML = tasks.length ? tasks.map((k) => {
    const left = k.lastDoneDay === null ? 0 : Math.max(0, k.cooldownDays - (t - k.lastDoneDay));
    return `<li data-task="${k.id}" data-hold="task"><span>${esc(k.name)} <span class="muted">· +${k.xp} xp · ${repeatText(k.cooldownDays)}</span></span>
      <button class="btn small" data-action="task" data-id="${k.id}" ${left ? 'disabled' : ''}>${left ? `in ${plural(left, 'day')}` : 'Done'}</button></li>`;
  }).join('') : '<li class="muted">No tasks yet. Add one below.</li>';
}

function renderClock() {
  const n = now();
  $('clock-now').textContent = n.toLocaleString('en', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ahead = Math.round(save.offsetHours);
  $('clock-label').textContent = ahead
    ? `${ahead >= 24 ? plural(Math.floor(ahead / 24), 'day') : plural(ahead, 'hour')} ahead of real time`
    : 'Running on real time.';
  ($('real-time') as HTMLButtonElement).disabled = !ahead;
}

function renderSaved() {
  ($('combine-heat') as HTMLInputElement).checked = !!save.combineHeat;
  $('saved').textContent = remote ? 'Saved to your Claude account' : 'Saved on this device';
}

// ===================== Tabs & modal =====================
const TABS = ['room', 'mindful', 'today', 'heat', 'settings'];
let tab = 'today';
function showTab(name: string) {
  tab = name;
  for (const t of TABS) $(`tab-${t}`).classList.toggle('on', t === name);
  document.querySelectorAll<HTMLElement>('.tabbar [data-tab]').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  if (name === 'room') renderRoom();
  window.scrollTo(0, 0);
}

function closeModal() { $('modal').hidden = true; $('modal').innerHTML = ''; }
function openModal(html: string) {
  const m = $('modal');
  m.innerHTML = `<div class="scrim" data-action="modal-close">${html}</div>`;
  m.hidden = false;
  m.querySelector<HTMLElement>('input')?.focus();
}

let draftLook: CatLook = randomLook();
function openAdopt() {
  draftLook = randomLook();
  openModal(`<form class="panel" id="adopt" novalidate>
    <h3>Adopt a cat</h3>
    <div class="preview"><div id="adopt-preview">${sprite('happy', draftLook)}</div>
      <button class="btn" type="button" data-action="randomise">🎲 Randomise look</button></div>
    <p class="muted">Each cat stands for one habit. Do the habit, feed the cat.</p>
    <label class="field">Cat's name <input id="adopt-name" maxlength="24" placeholder="Mochi" autocomplete="off"></label>
    <label class="field">Daily habit <input id="adopt-habit" maxlength="40" placeholder="Drink a glass of water" autocomplete="off"></label>
    <fieldset class="modes">
      <legend>If you neglect it for 3 days</legend>
      <label><input type="radio" name="mode" value="classic" checked><b>Classic</b>the cat dies</label>
      <label><input type="radio" name="mode" value="lighthearted"><b>Light-hearted</b>it runs away, and comes back once</label>
    </fieldset>
    <p class="form-error" id="adopt-error" hidden></p>
    <div class="btns"><button class="btn" type="button" data-action="modal-close">Cancel</button><button class="btn primary" type="submit">Adopt</button></div>
  </form>`);
}

function renderAll() {
  renderTop(); renderLog(); renderCats(); renderHeat(); renderRoom(); renderTasks(); renderClock(); renderSaved();
}

// ===================== Events =====================
document.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  const id = btn.dataset.id ?? '';
  const cat = save.state.cats.find((c) => c.id === id);
  switch (btn.dataset.action) {
    case 'feed':
      act((s, at) => feedCat(s, id, at), cat?.status === 'ranAway' ? `${cat.name} came back!` : `${cat?.name} ate ${FOODS[foodFor(cat as Cat, today())].label}. +${CONFIG.xpPerFeeding} xp`, cat);
      break;
    case 'sitter': closeModal(); act((s, at) => startSitter(s, id, at), `${cat?.name} is with the sitter. Bring them home within 7 days.`, cat); break;
    case 'resume': closeModal(); act((s, at) => resumeCat(s, id, at), `${cat?.name} is home. Feed them today.`, cat); break;
    case 'task': {
      const task = save.state.tasks.find((k) => k.id === id);
      const earned = () => (save.state.mindfulEarned?.day === today() ? save.state.mindfulEarned.xp : 0);
      const before = earned();
      act((s, at) => doMindfulTask(s, id, at), () => {
        const paid = earned() - before;
        return paid >= (task?.xp ?? 0) ? `Nice. +${paid} xp`
          : paid > 0 ? `+${paid} xp. That's today's ${CONFIG.mindfulDailyCap} xp limit.`
          : `Done! You've already earned today's ${CONFIG.mindfulDailyCap} xp from tasks, so no extra xp.`;
      });
      break;
    }
    case 'tab': showTab(btn.dataset.tab ?? 'today'); break;
    case 'log-close': save.logHidden = true; persist(); renderLog(); break;
    case 'adopt-open': openAdopt(); break;
    case 'randomise':
      draftLook = randomLook();
      $('adopt-preview').innerHTML = sprite('happy', draftLook);
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
    case 'modal-close': if (ev.target === btn) closeModal(); break;
    case 'delete-task-yes':
      save.state = removeMindfulTask(save.state, id);
      persist(); closeModal(); renderTasks(); toast('Task deleted.');
      break;
    case 'save-file': case 'save-copy': {
      const text = JSON.stringify(save);
      ($('save-text') as HTMLTextAreaElement).value = text;
      if (btn.dataset.action === 'save-copy') {
        navigator.clipboard?.writeText(text).then(() => toast('Copied. Paste it somewhere safe.'), () => toast('Select the text below and copy it.'));
        break;
      }
      if (Capacitor.isNativePlatform()) {
        Share.share({ title: 'Habit Kitty save', text, dialogTitle: 'Save your Habit Kitty progress' })
          .catch((e) => { if (!/cancel/i.test(String(e?.message ?? e))) toast("Couldn't open the share sheet. Use Copy instead."); });
        break;
      }
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = `habit-kitty-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        toast('Downloaded. The text is also below.');
      } catch { toast('Copy the text below instead.'); }
      break;
    }
    case 'load-text': loadSave(($('save-text') as HTMLTextAreaElement).value); break;
    case 'load-file': $('load-file').click(); break;
    case 'month':
      viewMonth.set(id, Math.max(0, (viewMonth.get(id) ?? 0) + Number(btn.dataset.step)));
      renderHeat();
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
      persist();
      renderAll();
      toast('Fresh start.');
      // fall through to restore the link
    case 'reset-no':
      $('reset-area').innerHTML = '<button class="linkish" type="button" data-action="reset-ask">Start over</button>';
      break;
  }
});

function loadSave(raw: string) {
  const err = $('save-error');
  try {
    const d = JSON.parse(raw);
    if (d?.v !== 1 || !Array.isArray(d.state?.cats) || !Array.isArray(d.state?.tasks) || typeof d.state.xp !== 'number') throw new Error();
    save = { ...d, log: Array.isArray(d.log) ? d.log : [], offsetHours: Number(d.offsetHours) || 0 };
    err.hidden = true;
    persist(); settle(); renderAll();
    toast('Save loaded.');
  } catch { err.textContent = "That doesn't look like a Habit Kitty save."; err.hidden = false; }
}

$('combine-heat').addEventListener('change', (ev) => {
  save.combineHeat = (ev.target as HTMLInputElement).checked;
  persist();
  renderHeat();
});

$('load-file').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) loadSave(await f.text());
  input.value = '';
});

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.target as HTMLFormElement;
  if (form.id === 'adopt') {
    const name = ($('adopt-name') as HTMLInputElement).value;
    const habit = ($('adopt-habit') as HTMLInputElement).value;
    const mode = (form.querySelector('input[name="mode"]:checked') as HTMLInputElement).value as CatMode;
    const r = adoptCat(save.state, { id: uid(), name, habit, mode, look: draftLook }, now());
    save.state = r.state;
    logEvents(r.events);
    persist();
    renderAll();
    if (!r.ok) { const err = $('adopt-error'); err.textContent = reasonText(r.reason); err.hidden = false; return; }
    closeModal();
    toast(`Welcome home, ${name.trim()}! Feed them today.`);
  } else if (form.id === 'task-form') {
    const input = $('task-name') as HTMLInputElement;
    if (!input.value.trim()) { toast('Name the task first.'); return; }
    const rep = ($('task-repeat') as HTMLSelectElement).value;
    const days = rep === 'custom' ? Number(($('task-days') as HTMLInputElement).value) : Number(rep);
    save.state = addMindfulTask(save.state, {
      id: uid(), name: input.value, xp: Number(($('task-xp') as HTMLInputElement).value) || 1, cooldownDays: days || 1,
    });
    input.value = '';
    persist();
    renderTasks();
    toast('Task added.');
  }
});

$('task-repeat').addEventListener('change', (ev) => {
  ($('task-days-wrap') as HTMLElement).hidden = (ev.target as HTMLSelectElement).value !== 'custom';
});

// Press and hold a task or a cat. Android also fires `contextmenu` on a long press (and then cancels
// the pointer), so that counts as the hold too; whichever comes first wins.
const HOLD_MS = 500;
let holdTimer = 0;
let holdEl: HTMLElement | null = null;
let holdFrom = { x: 0, y: 0 };

function endHold() { clearTimeout(holdTimer); holdEl?.classList.remove('pressing'); holdEl = null; }

function fireHold(el: HTMLElement) {
  endHold();
  const id = el.dataset.id ?? el.dataset.task ?? '';
  if (el.dataset.hold === 'cat') {
    const cat = save.state.cats.find((c) => c.id === id);
    if (!cat) return;
    const away = cat.status === 'sitter';
    const sitterBtn = cat.status === 'alive'
      ? `<button class="btn primary" data-action="sitter-ask" data-id="${id}">Pet sitter</button>`
      : away ? `<button class="btn primary" data-action="resume" data-id="${id}">Bring ${esc(cat.name)} home</button>` : '';
    openModal(`<div class="panel"><h3>${esc(cat.name)}</h3><p class="muted">${esc(cat.habit)}</p>
      <div style="display:grid;gap:8px">${sitterBtn}
      <button class="btn" data-action="shelter-ask" data-id="${id}">Return to the shelter</button>
      <button class="btn" data-action="modal-close">Cancel</button></div></div>`);
  } else {
    const task = save.state.tasks.find((k) => k.id === id);
    if (!task) return;
    openModal(`<div class="panel"><h3>Delete this task?</h3><p>${esc(task.name)}</p>
      <div class="btns"><button class="btn" data-action="modal-close">Keep</button>
      <button class="btn primary" data-action="delete-task-yes" data-id="${id}">Delete</button></div></div>`);
  }
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
function tick() { settle(); renderAll(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
function scheduleRollover() {
  setTimeout(() => { tick(); scheduleRollover(); }, Math.min(nextReset(now()).getTime() - now().getTime() + 1000, 60_000));
}

settle();
renderAll();
showTab('today');
scheduleRollover();
connectAccount();
