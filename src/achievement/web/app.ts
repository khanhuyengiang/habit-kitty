// The Kitty Achievement page: renders from the data (see ops.ts for the rules, storage.ts for saving).
// Every change goes through commit(): it shows at once, then is saved, and a failed save says so and can be retried.
import {
  PLAYER_GENDERS, PLAYER_GENDER_LABEL, RARITIES, RARITY_LABEL, SIDE_COLORS, inkFor, isColor, newId, todayStr,
  type Achievement, type Data, type PlayerGender, type Rarity, type Status,
} from '../model.ts';
import {
  LIMITS, activeMainQuests, allTags, archivedMainQuests, collection, counts, deleteAchievement, deleteMainQuest, deleteSideQuest, emptyData,
  ageOf, levelOf, migrate, monthOf, moveSideQuest, photosOf, pickColor, progressOf, saveAchievement, stepProgress, saveMainQuest, saveSideQuest, setMainQuestArchived,
  setSideQuestArchived, sideQuestsOf, titleFor, updateProfile, type AchievementInput, type Errors, type Filter,
} from '../ops.ts';
import { IDB_PREFIX, MemoryRepo, Saver, isLocalRef, type Repo } from '../storage.ts';
import { Capacitor } from '@capacitor/core';
import { unpackBackup } from '../backup.ts';
import { BACKUP_PREFIX, backupStatus, markDirty, nativeBackups, saveBackupToDevice, shareBackup } from '../../shared/backupfolder.ts';
import { platformRepo } from './snapshot.ts';
import { onAppShown, onShown, shownApp } from '../../shared/apps.ts';
import { esc, plural } from '../../shared/html.ts';
import { homeButton, playerButton, settingsButton, showToast, titleBar } from '../../shared/ui.ts';
import { meterHtml } from '../../shared/meter.ts';
import { lvLine } from '../../player.ts';
import { paintBackdrop } from '../../shared/backdrop.ts';
import { music } from '../../shared/music.ts';
import { PHOTO_MAX_BYTES, compressPhoto } from '../../shared/photo.ts';
import { sharePicture } from '../../shared/snapshot.ts';
import {
  PICKER_ICONS, PICKER_ICON_NAMES, avatarSvg, groupedPicks, burstSvg, cornerSvg, flowerSvg, heartSvg, iconSvg, starsSvg, stickerSvg,
} from '../pixelart.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
// Queries stay inside this app's part of the page, so they never find Habit Kitty's elements.
const appRoot: ParentNode = document.querySelector('[data-app-root="achievement"]') ?? document;
const DEFAULT_COLOR = '#8f78d0';   // for cards without a side quest (or with a broken colour)
const colorOf = (s: { color: string } | undefined) => (s && isColor(s.color) ? s.color : DEFAULT_COLOR);
// The rarity's colour: the stars on a card, its glow and the dot in the form. Common is grey, then green, blue, purple, yellow.
const RARITY_COLOR: Record<Rarity, string> = { normal: '#a29bb8', uncommon: '#45c27a', rare: '#4a9bea', mythical: '#a45be0', legendary: '#ffd36e' };

function fmtDate(s: string | null): string {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------- state ----------

let data: Data = emptyData();
let repo: Repo = new MemoryRepo();
let saver = new Saver(repo);
let storageNote = '';                       // why changes will not survive a reload, if so
const urls = new Map<string, string>();     // photo reference -> object URL (photos are Blobs in storage)
const src = (ref: string | null) => (ref ? urls.get(ref) ?? (isLocalRef(ref) ? '' : ref) : '');
const views = new Map<string, Filter>();    // each quest remembers its filters, so coming back finds the same view
const DEFAULT_VIEW: Required<Filter> = { side: 'all', status: 'all', sort: 'time', tag: 'all', group: 'side' };
let filterFor = '';                          // the quest whose filter panel is open

// A filter can be saved: then it is the filter of every quest (a side quest it names only applies in its own quest) and
// is kept for next time. Otherwise each quest keeps its own, for as long as the page is open.
const FILTER_KEY = 'ak-filter';
const FILTER_OPTIONS = { status: ['all', 'completed', 'planned'], sort: ['time', 'name', 'rarity'], group: ['side', 'quest', 'month', 'none'] };
function loadSavedView(): Required<Filter> | null {
  try {
    const v = JSON.parse(readStore(FILTER_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return null;
    const pick = <K extends 'status' | 'sort' | 'group'>(k: K): Required<Filter>[K] => (FILTER_OPTIONS[k].includes(v[k]) ? v[k] : DEFAULT_VIEW[k]);
    return { status: pick('status'), sort: pick('sort'), group: pick('group'), side: typeof v.side === 'string' ? v.side : 'all', tag: typeof v.tag === 'string' ? v.tag : 'all' };
  } catch { return null; }
}
let savedView = loadSavedView();
const viewOf = (id: string): Required<Filter> => ({ ...DEFAULT_VIEW, ...(savedView ?? views.get(id)) });
function setView(id: string, v: Required<Filter>) {
  if (savedView) { savedView = v; writeStore(FILTER_KEY, JSON.stringify(v)); } else views.set(id, v);
}
const scrolls = new Map<string, number>();
const collapsed = new Set<string>(readStore('ak-collapsed')?.split(',').filter(Boolean) ?? []);
let unlocked: string | null = null;         // the card that was just completed: animates once
let detailPhoto = 0;
let openedInApp = false;
let ready = false;

function readStore(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function writeStore(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode: it just will not be remembered */ } }
function dropStore(k: string) { try { localStorage.removeItem(k); } catch { /* nothing to forget */ } }

// ---------- saving ----------

function commit(next: Data, removedPhotos: string[] = []) {
  data = next;
  markDirty(BACKUP_PREFIX);
  render();
  saver.save(next).then((ok) => {
    if (ok) {
      const gone = removedPhotos.filter((r) => !data.photos.some((p) => p.imageUrl === r) && data.user.avatarUrl !== r);
      for (const r of gone) { const u = urls.get(r); if (u) URL.revokeObjectURL(u); urls.delete(r); }
      repo.deletePhotos(gone.filter(isLocalRef)).catch(() => { /* an orphaned file is harmless */ });
    }
  });
}

const toast = (msg: string) => showToast($('ach-toast'), msg);

// ---------- routing ----------

// 'quest' and 'all' are the same page: every achievement, with the same filters. A quest page is that page with the main
// quest filter set to one quest (and that quest's name and options on top).
type Route = { page: 'home' } | { page: 'quest'; id: string; card?: string } | { page: 'all'; card?: string };
function route(): Route {
  const m = /^#\/quest\/([^/]+)(?:\/card\/([^/]+))?$/.exec(location.hash);
  if (m && data.mainQuests.some((q) => q.id === m[1])) return { page: 'quest', id: m[1], card: m[2] };
  const all = /^#\/all(?:\/card\/([^/]+))?$/.exec(location.hash);
  if (all) return { page: 'all', card: all[1] };
  return { page: 'home' };
}
const questHash = (id: string) => `#/quest/${id}`;
const ALL_HASH = '#/all';
const ALL_VIEW = 'all';   // the key of the filters of the all page (a quest page uses its quest's id)
const viewKey = (r: Route) => (r.page === 'quest' ? r.id : ALL_VIEW);
const pageKey = (r: Route) => (r.page === 'home' ? 'home' : r.page === 'all' ? 'all' : `quest:${r.id}`);

// ---------- pictures: cards ----------

// Cards are sized from the screen: two to a row as long as that fits (down to a very narrow phone, then one), with a card
// pixel a little bigger than the page's --px at most. The gap between the columns gives way first (down to 2 layout units)
// before the cards shrink. Sets --cu (the card's pixel), --cu-prev (the smaller preview card in the form), --cols and --cgap.
const CARD_PX = 108, CARD_MIN = 1.15;
function fitCards() {
  const root = document.documentElement;
  const app = $('app');
  const cs = getComputedStyle(app);
  const room = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const u = 2 * (parseFloat(getComputedStyle(root).getPropertyValue('--px')) || 1.5);   // --u, the layout unit
  const gapMin = 2 * u, gapMax = 5 * u, max = Math.max(1.3, u * 0.58);
  const fit = (n: number) => Math.floor(Math.min(max, (room - (n - 1) * gapMin) / n / CARD_PX) * 16) / 16;   // sixteenths of a px: no fractions that blur
  let n = fit(2) >= CARD_MIN ? 2 : 1;
  while (n < 6 && fit(n + 1) >= max - 0.001) n++;
  const cu = Math.max(fit(n), 0.5);
  const gap = n > 1 ? Math.min(gapMax, Math.floor(((room - n * CARD_PX * cu) / (n - 1)) * 100) / 100) : 0;
  root.style.setProperty('--cu', `${cu}px`);
  root.style.setProperty('--cu-prev', `${Math.floor(cu * 0.67 * 16) / 16}px`);
  root.style.setProperty('--cols', String(n));
  root.style.setProperty('--cgap', `${gap}px`);
}

interface CardView { id?: string; title: string; icon: string; sideIcon: string; status: Status; rarity: Rarity; color: string; date: string | null; location: string; description: string; photo: string | null; side: string; quest: string; goal: number | null; progress: number }

function cardView(a: Achievement): CardView {
  const side = data.sideQuests.find((s) => s.id === a.sideQuestId);
  return {
    id: a.id, title: a.title, icon: a.icon, sideIcon: side?.icon ?? 'trophy', status: a.status, rarity: a.rarity,
    side: side?.title ?? data.mainQuests.find((q) => q.id === a.mainQuestId)?.title ?? '', color: colorOf(side),
    quest: data.mainQuests.find((q) => q.id === a.mainQuestId)?.title ?? '',
    date: a.status === 'completed' ? a.completionDate : a.plannedDate,
    location: a.location ?? '', description: a.description, goal: a.goal ?? null, progress: a.progress ?? 0,
    photo: src(photosOf(data, a.id)[0]?.imageUrl ?? null) || null,
  };
}

const shortDate = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : '');

// One card: used in the collection, the detail view and the form preview. Drawn as a little pixel camera: a screwed
// frame, a top bar with the icon and name, a graph-paper screen with the picture and words, and a footer with the side
// quest's icon and the place; the rarity is the stars on the top rim. Big (on the card's own page), it is as wide as the page
// and as tall as its words, with nothing cut short. Every card of a side quest has that side quest's colour; rarity
// only changes the stars (one to five, in its colour) and the glow around the card. The main quest's name runs faintly along both long edges.
function cardHtml(v: CardView, o: { static?: boolean; unlock?: boolean; big?: boolean } = {}): string {
  const planned = v.status === 'planned';
  const cls = ['card', planned ? 'planned' : `rar-${v.rarity}`, o.static && 'static', o.big && 'big', o.unlock && 'unlock'].filter(Boolean).join(' ');
  const style = `--sqc:${v.color};--sqi:${inkFor(v.color)};--rar:${RARITY_COLOR[v.rarity]}`;
  const art = v.photo ? `<img src="${esc(v.photo)}" alt="">` : `${burstSvg()}${stickerSvg(v.icon, 1, 'zoom')}`;
  const p = progressOf(v);
  const date = v.date ? (planned ? `Plan ${shortDate(v.date)}` : shortDate(v.date)) : (planned && !p ? 'Someday' : '');
  const goal = p ? `<span class="card-goal"><span class="goal-bar"><i style="width:${Math.min(100, (p.n / p.goal) * 100)}%"></i></span><span class="goal-n">${p.n}/${p.goal}</span></span>` : '';
  const rim = v.quest ? `<span class="rim l" aria-hidden="true">${esc(v.quest)}</span><span class="rim r" aria-hidden="true">${esc(v.quest)}</span>` : '';
  const inner = `${(['tl', 'tr', 'bl', 'br'] as const).map((c) => cornerSvg(c, o.big)).join('')}${rim}${starsSvg(planned ? 0 : RARITIES.indexOf(v.rarity) + 1)}<span class="card-in">
    <span class="card-head">${stickerSvg(v.icon, 1)}<span class="card-title">${esc(v.title || 'Untitled')}</span></span>
    <span class="card-screen"><span class="card-row">${goal}<span class="card-count">${esc(date)}</span></span>
      <span class="card-art${v.photo ? ' has-photo' : ''}">${art}<span class="card-deco">${heartSvg()}${flowerSvg()}</span>${planned ? `<span class="lockmark">${iconSvg('lock')}</span>` : ''}</span>
      ${v.description ? `<span class="card-desc">${esc(v.description)}</span>` : ''}</span>
    <span class="card-foot">${stickerSvg(v.sideIcon, 1)}<span class="card-place">${v.location ? esc(v.location) : esc(v.side)}</span></span></span>`;
  if (o.static) return `<div class="${cls}" style="${style}">${inner}</div>`;
  const label = `${v.title}, ${v.side}, ${p ? `${p.n} of ${p.goal}, ` : ''}${planned ? 'locked' : `${RARITY_LABEL[v.rarity]}, unlocked`}`;
  return `<button type="button" class="${cls}" style="${style}" data-action="open-card" data-id="${v.id}" data-main="${data.achievements.find((x) => x.id === v.id)?.mainQuestId ?? ''}" aria-label="${esc(label)}">${inner}</button>`;
}

// ---------- pages ----------

function headerHtml(): string {
  return `<header class="top">${titleBar('Kitty', 'Achievement', `${saver.busy ? '<span class="saving">Saving…</span>' : ''}${homeButton() + playerButton() + settingsButton()}`)}</header>`;
}

function bannerHtml(): string {
  return storageNote
    ? `<div class="banner" role="alert"><span>${esc(storageNote)}</span></div>`
    : saver.error
      ? `<div class="banner" role="alert"><span>Your last change could not be saved.</span><button class="btn small" data-action="retry-save">Try again</button></div>` : '';
}

// The title bar and the save notice are separate from the page, so saving never rebuilds the page under your hands.
function renderStatus() {
  if (!ready) return;
  const head = $('head'), banner = $('status');
  const h = headerHtml(), b = bannerHtml();
  if (head.innerHTML !== h) { const focus = head.contains(document.activeElement); head.innerHTML = h; if (focus) head.querySelector<HTMLElement>('.gear')?.focus(); }
  if (banner.innerHTML !== b) banner.innerHTML = b;
}

// The player's level, as the same stat line the other screens have. The player themself (name, picture...) is on the home page.
function profileHtml(): string {
  return `<section class="stat-top" aria-label="Level">${meterHtml('lv', 'Lv', lvLine(levelOf(data)))}</section>`;
}

// One small block per achievement, in the side quest's colour (grey and dashed while locked), and a + block to add another.
function blockHtml(a: Achievement, color: string): string {
  const planned = a.status === 'planned';
  const p = progressOf(a);
  const label = `${a.title}, ${p ? `${p.n} of ${p.goal}, ` : ''}${planned ? 'locked' : 'unlocked'}`;
  const fill = p ? `<i class="blk-goal" style="--p:${Math.min(1, p.n / p.goal)}"></i>` : '';
  return `<button class="block${planned ? ' planned' : ''}" style="--c:${color}" title="${esc(p ? `${a.title} (${p.n}/${p.goal})` : a.title)}" aria-label="${esc(label)}" data-action="open-card" data-id="${a.id}" data-main="${a.mainQuestId}">${iconSvg(a.icon)}${fill}</button>`;
}

// A main quest on the main page. Open: its side quests (and the cards directly in it) as rows of blocks, with buttons to
// add a side quest or an achievement. Folded: one highlighted button to add an achievement. Long-press for everything else.
function questSection(q: Data['mainQuests'][number]): string {
  const sides = sideQuestsOf(data, q.id);
  const c = counts(data, q.id);
  const open = !collapsed.has(q.id);
  const box = (title: string, icon: string, col: string, sideId: string | null) => {
    const list = collection(data, q.id, { side: sideId ?? 'none', status: 'all' });
    const sc = counts(data, q.id, sideId);
    return `<div class="side-box" style="--c:${col}"><h4><span class="side-ico" style="color:${col}">${iconSvg(icon)}</span>${esc(title)}<span class="n">${sc.done}/${sc.done + sc.planned}</span></h4>
      <div class="blocks">${list.map((a) => blockHtml(a, col)).join('')}<button class="block add" data-action="add-card" data-status="completed" data-main="${q.id}" data-side="${sideId ?? ''}" aria-label="New achievement in ${esc(title)}">${iconSvg('plus')}</button></div></div>`;
  };
  const loose = counts(data, q.id, null);
  const boxes = (loose.done + loose.planned ? box('No side quest', 'trophy', DEFAULT_COLOR, null) : '') + sides.map((s) => box(s.title, s.icon, colorOf(s), s.id)).join('');
  return `<section class="panel quest" data-quest="${q.id}" data-action="open-quest" data-id="${q.id}" aria-labelledby="q-${q.id}">
    <div class="quest-info"><div class="quest-head"><button class="quest-title" id="q-${q.id}" data-action="open-quest" data-id="${q.id}">${esc(q.title)}</button>
      ${open ? '' : `<button class="btn small primary quick-add" data-action="add-card" data-status="completed" data-main="${q.id}" aria-label="New achievement in ${esc(q.title)}">${iconSvg('plus')} Achievement</button>`}
      <button class="toggle" data-action="toggle-quest" data-id="${q.id}" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(q.title)}">${iconSvg('chev')}</button></div>
    <p class="sub">${plural(sides.length, 'side quest')} · ${c.done} unlocked · ${c.planned} locked</p>
    ${open && q.description ? `<p class="sub">${esc(q.description)}</p>` : ''}</div>
    ${open ? `${boxes ? `<div class="sides">${boxes}</div>` : '<p class="muted">Nothing here yet. Add achievements straight to this quest, or sort them into side quests like Food or Sightseeing.</p>'}
      <div class="btns"><button class="btn small" data-action="new-side" data-main="${q.id}">${iconSvg('plus')} Side quest</button>
      <button class="btn small primary" data-action="add-card" data-status="completed" data-main="${q.id}">${iconSvg('plus')} Achievement</button></div>` : ''}</section>`;
}

function homeHtml(): string {
  const active = activeMainQuests(data);
  const archived = archivedMainQuests(data);
  const body = active.length
    ? `<div class="quests">${active.map(questSection).join('')}</div>
      <button class="btn primary new-quest" data-action="new-quest">${iconSvg('plus')} New main quest</button>`
    : `<section class="panel empty"><h3>Your adventure starts here</h3>
        <p>${archived.length ? 'All your quests are archived.' : 'A main quest is a big theme or journey, like “Discover Thailand”. Create your first one, then collect achievement cards in it.'}</p>
        <button class="btn primary" data-action="new-quest">${iconSvg('plus')} Create your first main quest</button></section>`;
  const arch = archived.length
    ? `<details class="panel"><summary><b>Archived quests (${archived.length})</b></summary><ul class="manage">${archived.map((q) => `
      <li><span class="nm">${esc(q.title)}</span><div class="btns"><button class="btn small" data-action="open-quest" data-id="${q.id}">View</button>
      <button class="btn small" data-action="restore-quest" data-id="${q.id}">Restore</button>
      <button class="btn small danger" data-action="delete-quest" data-id="${q.id}">${iconSvg('trash')} Delete</button></div></li>`).join('')}</ul></details>` : '';
  return `${profileHtml()}${viewSwitch('home')}
    <div class="section-head"><h2>Main quests</h2>${active.length ? '<span class="sub">Long-press a quest or your card for more</span>' : ''}</div>${body}${arch}`;
}

const monthName = (k: string) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// Home and All achievements are two views of the same collection, so they share a switch at the top.
const viewSwitch = (on: 'home' | 'all') => `<div class="seg nav" role="group" aria-label="View">
  <button type="button" data-action="show-home" aria-pressed="${on === 'home'}">Main quests</button>
  <button type="button" data-action="show-all" aria-pressed="${on === 'all'}">All achievements</button></div>`;

// The collection page: every achievement (id ''), or those of one main quest. A Filter button holds everything that
// narrows it (show, main quest, side quest, tag, group, sort), then the cards, grouped by main quest or side quest (the
// default), by month, or not at all. Picking a main quest in the filter is the same as opening that quest from the main page.
function questHtml(id: string): string {
  const q = id ? data.mainQuests.find((x) => x.id === id)! : undefined;
  const key = id || ALL_VIEW;
  const view = viewOf(key);
  const quests = activeMainQuests(data);
  const allSides = id ? sideQuestsOf(data, id, true) : quests.flatMap((m) => sideQuestsOf(data, m.id, true));
  const tags = allTags(data, id || undefined);
  const sideName = (s: { title: string; mainQuestId: string; archivedAt: number | null }) =>
    `${id ? '' : `${data.mainQuests.find((m) => m.id === s.mainQuestId)?.title ?? ''} · `}${s.title}${s.archivedAt ? ' (archived)' : ''}`;
  if (view.side !== 'all' && view.side !== 'none' && !allSides.some((s) => s.id === view.side)) view.side = 'all';
  if (view.tag !== 'all' && !tags.some((t) => t.toLowerCase() === view.tag.toLowerCase())) view.tag = 'all';
  if (id && view.group === 'quest') view.group = 'side';   // one quest: nothing to group by
  if (!savedView) views.set(key, view);   // (a saved filter stays as it was saved, even where a part of it does not apply)
  const list = collection(data, id, view);
  const grid = (cards: Achievement[]) => `<div class="cards">${cards.map((a) => cardHtml(cardView(a), { unlock: a.id === unlocked })).join('')}</div>`;
  const section = (title: string, icon: string, col: string, cards: Achievement[], n: string) =>
    `<section class="side-sec" style="--c:${col}" aria-label="${esc(title)}"><h3>${iconSvg(icon)}<span>${esc(title)}</span><span class="n">${n}</span></h3>
      ${cards.length ? grid(cards) : '<p class="muted">Nothing here yet.</p>'}</section>`;
  const narrowed = view.status !== 'all' || view.tag !== 'all' || view.side !== 'all';
  // the cards directly in a quest first, then each side quest; an empty one shows only when nothing is filtered out
  const sideGroups = (m: Data['mainQuests'][number], prefix: string) => {
    const groups = [{ id: null as string | null, title: 'No side quest', icon: 'trophy', col: DEFAULT_COLOR, quiet: true },
      ...sideQuestsOf(data, m.id, true).map((s) => ({ id: s.id as string | null, title: `${prefix || 'Side quest: '}${s.title}${s.archivedAt ? ' (archived)' : ''}`, icon: s.icon, col: colorOf(s), quiet: !!s.archivedAt }))];
    return groups.map((g) => {
      const cards = list.filter((a) => a.mainQuestId === m.id && a.sideQuestId === g.id);
      if (!cards.length && (narrowed || g.quiet)) return '';
      const sc = counts(data, m.id, g.id);
      return section(g.id === null && prefix ? `${prefix}${g.title}` : g.title, g.icon, g.col, cards, `${sc.done}/${sc.done + sc.planned}`);
    }).join('');
  };
  let body: string;
  if (!data.achievements.some((a) => (id ? a.mainQuestId === id : quests.some((m) => m.id === a.mainQuestId)))) {
    body = `<section class="panel empty"><h3>No achievements yet</h3><p>Add something you have already done, or one to unlock later. Locked achievements stay greyed out until you unlock them.</p>
      ${id || quests.length ? `<div class="btns"><button class="btn primary" data-action="add-card" data-status="completed">${iconSvg('plus')} Unlocked achievement</button>
      <button class="btn" data-action="add-card" data-status="planned">${iconSvg('lock')} Locked achievement</button></div>` : ''}</section>`;
  } else if (!list.length) {
    body = `<section class="panel empty"><h3>Nothing matches these filters</h3><p>Try another quest, side quest, tag or status.</p><button class="btn" data-action="clear-filters">Show everything</button></section>`;
  } else if (view.group === 'month') {
    const months = new Map<string, Achievement[]>();
    for (const a of list) months.set(monthOf(a), [...(months.get(monthOf(a)) ?? []), a]);
    const keys = [...months.keys()].sort((x, y) => (!x ? 1 : !y ? -1 : y.localeCompare(x)));   // newest month first, undated last
    body = keys.map((k) => section(k ? monthName(k) : 'No date', 'flag', DEFAULT_COLOR, months.get(k)!, plural(months.get(k)!.length, 'card'))).join('');
  } else if (view.group === 'none') {
    body = grid(list);
  } else if (view.group === 'quest') {
    body = quests.map((m) => {
      const cards = list.filter((a) => a.mainQuestId === m.id);
      if (!cards.length) return '';
      const c = counts(data, m.id);
      return section(m.title, 'flag', DEFAULT_COLOR, cards, `${c.done}/${c.done + c.planned}`);
    }).join('');
  } else if (id) {
    body = sideGroups(q!, '');
  } else {
    body = quests.map((m) => sideGroups(m, `${m.title} · `)).join('');
  }
  const changed = (Object.keys(DEFAULT_VIEW) as (keyof Filter)[]).filter((k) => view[k] !== DEFAULT_VIEW[k]).length;
  const sel = (name: string, label: string, opts: [string, string][], cur: string) =>
    `<div class="field"><label for="v-${name}">${label}</label><select id="v-${name}" data-filter="${name}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  const panel = filterFor === key ? `<div class="panel filter-panel" id="filter-panel"><div class="filter-grid">
      ${sel('status', 'Show', [['all', 'Everything'], ['completed', 'Unlocked'], ['planned', 'Locked']], view.status)}
      ${sel('quest', 'Main quest', [['', 'All main quests'], ...quests.map((m): [string, string] => [m.id, m.title]), ...(q?.archivedAt ? [[q.id, `${q.title} (archived)`] as [string, string]] : [])], id)}
      ${sel('side', 'Side quest', [['all', 'All'], ['none', 'No side quest'], ...allSides.map((s): [string, string] => [s.id, sideName(s)])], view.side)}
      ${tags.length ? sel('tag', 'Tag', [['all', 'All tags'], ...tags.map((t): [string, string] => [t, `#${t}`])], view.tag) : ''}
      ${sel('group', 'Group by', [['side', 'Side quest'], ...(id ? [] : [['quest', 'Main quest'] as [string, string]]), ['month', 'Month'], ['none', 'No grouping']], view.group)}
      ${sel('sort', 'Sort by', [['time', 'Time'], ['name', 'Name'], ['rarity', 'Rarity']], view.sort)}</div>
      <div class="save-filter"><label class="check"><input type="checkbox" data-filter-save ${savedView ? 'checked' : ''}><span>Save this filter setting</span></label>
        <p class="hint">Uses these settings on every page, and remembers them next time.</p></div>
      <div class="btns end"><button class="btn small" data-action="clear-filters" ${changed ? '' : 'disabled'}>Reset</button><button class="btn small primary" data-action="toggle-filter">Done</button></div></div>` : '';
  const head = q
    ? `<div class="qbar"><button class="btn small" data-action="back">${iconSvg('prev')} Back</button>
      <details class="menu"><summary class="btn small">Options</summary><div class="menu-list">
        <button class="btn small" data-action="edit-quest" data-id="${id}">${iconSvg('pencil')} Edit quest</button>
        <button class="btn small" data-action="new-side" data-main="${id}">${iconSvg('plus')} New side quest</button>
        ${allSides.length ? `<button class="btn small" data-action="manage-sides" data-id="${id}">Manage side quests</button>` : ''}
        ${q.archivedAt ? `<button class="btn small" data-action="restore-quest" data-id="${id}">Restore quest</button>` : `<button class="btn small" data-action="archive-quest" data-id="${id}">${iconSvg('archive')} Archive quest</button>`}
        <button class="btn small danger" data-action="delete-quest" data-id="${id}">${iconSvg('trash')} Delete quest</button></div></details></div>
    <section class="qhead"><h2 class="big">${esc(q.title)}</h2>${q.description ? `<p>${esc(q.description)}</p>` : ''}${q.archivedAt ? '<p class="sub">Archived</p>' : ''}</section>`
    : `${profileHtml()}${viewSwitch('all')}<section class="qhead"><h2 class="big">All achievements</h2></section>`;
  return `${head}
    <div class="tools"><div class="toolbar"><button class="btn${changed ? ' on' : ''}" data-action="toggle-filter" aria-expanded="${filterFor === key}" aria-controls="filter-panel">${iconSvg('filter')} Filter${changed ? ` (${changed})` : ''}</button>
      ${id || quests.length ? `<button class="btn primary" data-action="add-card" data-status="completed">${iconSvg('plus')} Achievement</button>` : ''}</div>
    ${panel}</div>
    ${body}`;
}

// An achievement on its own page (after a note being read): the buttons, the card drawn big with every word of it, the
// photos to switch between, and the facts.
function cardPageHtml(a: Achievement): string {
  const side = data.sideQuests.find((s) => s.id === a.sideQuestId);
  const main = data.mainQuests.find((q) => q.id === a.mainQuestId);
  const photos = photosOf(data, a.id);
  const i = Math.min(detailPhoto, Math.max(0, photos.length - 1));
  const v = { ...cardView(a), photo: src(photos[i]?.imageUrl ?? null) || null };
  const planned = a.status === 'planned';
  const p = progressOf(a);
  const when = planned ? ['Target date', a.plannedDate ? fmtDate(a.plannedDate) : 'No date set'] : ['Unlocked on', a.completionDate ? fmtDate(a.completionDate) : 'No date set'];
  return `<div class="ctools">
      <button class="btn small" data-action="close-detail">${iconSvg('prev')} Back</button><span class="grow"></span>
      ${planned ? `<button class="btn small primary" data-action="complete-card" data-id="${a.id}">${iconSvg('trophy')} Unlock it</button>` : ''}
      <button class="btn small" data-action="share-card" data-id="${a.id}">Share</button>
      <button class="btn small" data-action="edit-card" data-id="${a.id}">${iconSvg('pencil')} Edit</button>
      <button class="btn small danger" data-action="delete-card" data-id="${a.id}">${iconSvg('trash')} Delete</button></div>
    <h2 class="sr">${esc(a.title)}</h2>
    ${p ? `<section class="panel goal-panel" aria-label="Progress"><p class="goal-big" aria-live="polite"><b class="num">${p.n}</b> <span class="muted">/ ${p.goal}</span>${p.done ? ' <span class="tag">Goal reached</span>' : ''}</p>
      <div class="btns"><button class="btn" data-action="goal-down" data-id="${a.id}" aria-label="Count one less" ${p.n ? '' : 'disabled'}>−1</button>
      <button class="btn primary" data-action="goal-up" data-id="${a.id}" aria-label="Count one more">+1</button></div></section>` : ''}
    ${cardHtml(v, { static: true, big: true, unlock: a.id === unlocked })}
    ${photos.length > 1 ? `<div class="gallery" role="group" aria-label="Photos">${photos.map((p, n) => `<button data-action="gallery" data-i="${n}" aria-current="${n === i}" aria-label="Photo ${n + 1}"><img src="${esc(src(p.imageUrl))}" alt=""></button>`).join('')}</div>` : ''}
    <section class="panel facts" aria-label="Details"><dl>
      <dt>Main quest</dt><dd>${esc(main?.title ?? '')}</dd>
      <dt>Side quest</dt><dd>${side ? `<span class="side-ico" style="color:${colorOf(side)}">${iconSvg(side.icon)}</span>${esc(side.title)}` : 'None'}</dd>
      <dt>Status</dt><dd>${planned ? 'Locked' : 'Unlocked'}</dd>
      ${p ? `<dt>Progress</dt><dd>${p.n} of ${p.goal}</dd>` : ''}
      ${planned ? '' : `<dt>Rarity</dt><dd>${RARITY_LABEL[a.rarity]}</dd>`}
      ${a.location ? `<dt>Location</dt><dd>${esc(a.location)}</dd>` : ''}
      <dt>${when[0]}</dt><dd>${esc(when[1])}</dd>
      ${a.tags.length ? `<dt>Tags</dt><dd class="tags">${a.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</dd>` : ''}</dl></section>`;
}

// ---------- modals ----------

interface FormValues { title: string; description: string; location: string; icon: string; tags: string; mainQuestId: string; sideQuestId: string; status: Status; rarity: Rarity; date: string; goal: string; progress: string }
interface FormPhoto { imageUrl: string; existingId?: string; blob?: Blob }
type Modal =
  | { kind: 'achievement'; id?: string; v: FormValues; photos: FormPhoto[]; busy?: boolean; iconOpen?: boolean }
  | { kind: 'complete'; id: string; v: FormValues; photos: FormPhoto[]; busy?: boolean }
  | { kind: 'quest'; id?: string; title: string; description: string }
  | { kind: 'side'; mainId: string; id?: string; title: string; color: string; icon: string; onSaved?: (id: string) => void }
  | { kind: 'sides'; mainId: string }
  | { kind: 'quest-menu'; id: string }
  | { kind: 'profile'; name: string; gender: string; birthYear: string; avatar: string | null; avatarBlob?: Blob }
  | { kind: 'settings' }
  | { kind: 'confirm'; title: string; body: string; label: string; run: () => void };
const modals: Modal[] = [];
let openerSel = '';

const top = () => modals[modals.length - 1];

function field(label: string, name: string, control: string, hint = '', required = false): string {
  return `<div class="field"><label for="f-${name}">${label}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>${control}<p class="hint" id="h-${name}">${hint}</p><p class="err" data-err="${name}" role="alert"></p></div>`;
}
const iconLabel = (n: string) => PICKER_ICONS[n]?.label ?? 'Icon';
const iconSummary = (n: string) => `${stickerSvg(n, 1)}<span class="fold-name">${esc(iconLabel(n))}</span><span class="fold-chev">${iconSvg('chev')}</span>`;
// The icon list folds away once an icon is chosen; the chosen icon (in the summary) opens it again.
const iconPicker = (sel: string, open: boolean, name = 'icon') => `<div class="field"><fieldset class="field"><legend>Icon <span aria-hidden="true">*</span></legend>
  <details class="icon-fold" ${open ? 'open' : ''}><summary class="fold-sum" aria-label="Icon: ${esc(iconLabel(sel))}. Change">${iconSummary(sel)}</summary>
  <div class="icon-pick">${groupedPicks((n) =>
  `<label title="${PICKER_ICONS[n].label}"><input type="radio" name="${name}" value="${n}" ${n === sel ? 'checked' : ''} aria-label="${PICKER_ICONS[n].label}"><span>${iconSvg(n)}</span></label>`)}</div></details></fieldset><p class="err" data-err="${name}" role="alert"></p></div>`;

function photosField(m: { photos: FormPhoto[] }, label = 'Photos'): string {
  return `<div class="field"><label for="f-photos">${label}</label>
    <div class="photo-list" id="photo-list">${photoListHtml(m.photos)}</div>
    <input id="f-photos" name="photos" type="file" accept="image/*" multiple data-upload="photos">
    <p class="hint">Pictures are scaled down and kept on this device.</p><p class="err" data-err="photos" role="alert"></p></div>`;
}
const photoListHtml = (photos: FormPhoto[]) => photos.map((p, i) =>
  `<div class="photo"><img src="${esc(src(p.imageUrl))}" alt="Photo ${i + 1}"><button type="button" data-action="photo-remove" data-i="${i}" aria-label="Remove photo ${i + 1}">${iconSvg('x')}</button></div>`).join('');

function sideOptions(mainId: string, selected: string, keep?: string): string {
  const sides = sideQuestsOf(data, mainId).filter((s) => !s.archivedAt || s.id === keep);
  const all = [...sides, ...sideQuestsOf(data, mainId, true).filter((s) => s.archivedAt && s.id === keep && !sides.includes(s))];
  return `<option value="" ${selected ? '' : 'selected'}>None (directly in the main quest)</option>`
    + all.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.title)}${s.archivedAt ? ' (archived)' : ''}</option>`).join('');
}

const splitTags = (s: string) => s.split(',');
// The goal fields as typed: an empty goal is a one-off achievement. Anything else goes to the rules, which say what is wrong.
const formGoal = (v: FormValues) => (v.goal.trim() === '' ? { goal: null, progress: 0 } : { goal: Number(v.goal), progress: v.progress.trim() === '' ? 0 : Number(v.progress) });

function achievementForm(m: Extract<Modal, { kind: 'achievement' | 'complete' }>): string {
  const complete = m.kind === 'complete';
  const v = m.v;
  const editing = !!(m as { id?: string }).id;
  const rarityBlock = `<fieldset class="field" id="rarity-block" ${v.status === 'completed' ? '' : 'hidden'}><legend>Rarity</legend>
    <div class="chips">${RARITIES.map((r) => `<label><input type="radio" name="rarity" value="${r}" ${v.rarity === r ? 'checked' : ''}><span><i class="rar-dot" style="--r:${RARITY_COLOR[r]}"></i>${RARITY_LABEL[r]}</span></label>`).join('')}</div>
    <p class="hint">Rarity is how special it feels to you. You choose it, nothing is random.</p></fieldset>`;
  const mains = activeMainQuests(data).concat(data.mainQuests.filter((q) => q.archivedAt && q.id === v.mainQuestId));
  const where = complete ? '' : `<div class="row">
      ${field('Main quest', 'mainQuestId', `<select id="f-mainQuestId" name="mainQuestId" required>${mains.map((q) => `<option value="${q.id}" ${q.id === v.mainQuestId ? 'selected' : ''}>${esc(q.title)}</option>`).join('')}</select>`, '', true)}
      ${field('Side quest', 'sideQuestId', `<select id="f-sideQuestId" name="sideQuestId">${sideOptions(v.mainQuestId, v.sideQuestId, v.sideQuestId)}</select>`, '<button type="button" class="linkish" data-action="form-add-side">Add a side quest</button>')}</div>`;
  const status = complete ? '' : `<fieldset class="field"><legend>Status <span aria-hidden="true">*</span></legend><div class="chips">
      <label><input type="radio" name="status" value="completed" ${v.status === 'completed' ? 'checked' : ''}><span>Unlocked</span></label>
      <label><input type="radio" name="status" value="planned" ${v.status === 'planned' ? 'checked' : ''}><span>${iconSvg('lock')} Locked</span></label></div><p class="err" data-err="status" role="alert"></p></fieldset>`;
  const title = complete ? 'Unlock achievement' : editing ? 'Edit achievement' : v.status === 'planned' ? 'New locked achievement' : 'New achievement';
  const suggest = allTags(data).slice(0, 12).map((t) => `<button type="button" class="tag-sug" data-action="tag-add" data-tag="${esc(t)}">#${esc(t)}</button>`).join('');
  const tagsField = field('Tags', 'tags', `<input id="f-tags" name="tags" value="${esc(v.tags)}" placeholder="street food, friends" autocomplete="off">`,
    `Up to ${LIMITS.tags}, separated by commas.${suggest ? `<span class="tag-sugs">${suggest}</span>` : ''}`);
  return `<form data-form="${m.kind}" class="stable" novalidate>
    <div class="form-top"><h3 id="mt">${title}</h3><div class="preview-wrap" id="preview">${cardHtml(previewView(v, m.photos), { static: true })}</div></div>
    <div class="form-scroll">
    ${status}
    ${field('Title', 'title', `<input id="f-title" name="title" maxlength="80" value="${esc(v.title)}" autocomplete="off" required>`, '', true)}
    ${where}
    ${complete ? '' : iconPicker(v.icon, (m as { iconOpen?: boolean }).iconOpen ?? !editing)}
    ${complete ? '' : `<div class="row">
      ${field('Goal (times)', 'goal', `<input id="f-goal" name="goal" type="number" inputmode="numeric" min="1" max="${LIMITS.goal}" step="1" value="${esc(v.goal)}" placeholder="e.g. 10">`, 'Optional. For things you do many times, like 10 marathons.')}
      <div id="progress-block" ${v.goal.trim() ? '' : 'hidden'}>${field('Done so far', 'progress', `<input id="f-progress" name="progress" type="number" inputmode="numeric" min="0" max="${LIMITS.goal}" step="1" value="${esc(v.progress)}">`, 'Count up from its page.')}</div></div>`}
    ${field(v.status === 'planned' ? 'Target date' : complete ? 'Date it happened' : 'Date', 'date', `<input id="f-date" name="date" type="date" value="${esc(v.date)}">`, v.status === 'planned' ? 'Optional' : '', complete)}
    ${rarityBlock}
    ${field('Location', 'location', `<input id="f-location" name="location" maxlength="60" value="${esc(v.location)}" placeholder="Bangkok" autocomplete="off">`, 'Optional')}
    ${tagsField}
    ${field('Description or note', 'description', `<textarea id="f-description" name="description" maxlength="2000" rows="3">${esc(v.description)}</textarea>`)}
    ${photosField(m, complete ? 'Photos of the experience' : 'Photos')}
    <p class="err" data-err="form" role="alert"></p></div>
    <div class="btns end form-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="submit" ${m.busy ? 'disabled' : ''}>${complete ? 'Unlock it' : 'Save'}</button></div></form>`;
}

function previewView(v: FormValues, photos: FormPhoto[]): CardView {
  const side = data.sideQuests.find((s) => s.id === v.sideQuestId);
  return { title: v.title.trim(), icon: v.icon, sideIcon: side?.icon ?? 'trophy', status: v.status, rarity: v.rarity, side: side?.title ?? data.mainQuests.find((q) => q.id === v.mainQuestId)?.title ?? '', quest: data.mainQuests.find((q) => q.id === v.mainQuestId)?.title ?? '', color: colorOf(side), date: v.date || null, location: v.location.trim(), description: v.description.trim(), photo: photos[0] ? src(photos[0].imageUrl) : null, ...formGoal(v) };
}

function modalHtml(m: Modal): string {
  switch (m.kind) {
case 'achievement': case 'complete': return `<div class="panel wide form-panel" role="dialog" aria-modal="true" aria-labelledby="mt"><button class="x-close" data-action="close-modal" aria-label="Close">${iconSvg('x')}</button>${achievementForm(m)}</div>`;
    case 'quest': return `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mt"><button class="x-close" data-action="close-modal" aria-label="Close">${iconSvg('x')}</button>
      <form data-form="quest" novalidate><h3 id="mt">${m.id ? 'Edit main quest' : 'New main quest'}</h3>
      ${field('Name', 'title', `<input id="f-title" name="title" maxlength="60" value="${esc(m.title)}" placeholder="Discover Thailand" autocomplete="off" required>`, '', true)}
      ${field('Description', 'description', `<textarea id="f-description" name="description" maxlength="2000" rows="3">${esc(m.description)}</textarea>`, 'Optional')}
      <div class="btns end"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary">Save</button></div></form></div>`;
    case 'side': return `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mt"><button class="x-close" data-action="close-modal" aria-label="Close">${iconSvg('x')}</button>
      <form data-form="side" novalidate><h3 id="mt">${m.id ? 'Edit side quest' : 'New side quest'}</h3>
      ${field('Name', 'title', `<input id="f-title" name="title" maxlength="60" value="${esc(m.title)}" placeholder="Food" autocomplete="off" required>`, '', true)}
      <div class="field"><fieldset class="field"><legend>Colour <span aria-hidden="true">*</span></legend><div class="swatches">${SIDE_COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" aria-label="${c}" ${c === m.color.toLowerCase() ? 'checked' : ''}><span class="swatch" style="--c:${c}"></span></label>`).join('')}
        <label class="chip">Custom <input type="color" name="custom" value="${isColor(m.color) ? m.color : '#8f78d0'}" aria-label="Custom colour"></label></div></fieldset><p class="hint">Cards and icons of this side quest use this colour.</p><p class="err" data-err="color" role="alert"></p></div>
      ${iconPicker(m.icon, !m.id)}
      <div class="btns end"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary">Save</button></div></form></div>`;
    case 'sides': {
      const q = data.mainQuests.find((x) => x.id === m.mainId)!;
      const all = sideQuestsOf(data, m.mainId, true);
      const visible = all.filter((s) => !s.archivedAt);
      return `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mt"><button class="x-close" data-action="close-modal" aria-label="Close">${iconSvg('x')}</button>
        <h3 id="mt">Side quests in ${esc(q.title)}</h3>
        <ul class="manage">${all.map((s) => { const i = visible.indexOf(s); return `<li class="${s.archivedAt ? 'arch' : ''}" style="--c:${isColor(s.color) ? s.color : '#8f78d0'}">
          <span class="nm">${iconSvg(s.icon)}${esc(s.title)}${s.archivedAt ? ' <span class="tag">Archived</span>' : ''}</span>
          <div class="btns"><button class="btn small" data-action="side-edit" data-id="${s.id}">${iconSvg('pencil')} Edit</button>
          ${s.archivedAt ? `<button class="btn small" data-action="side-restore" data-id="${s.id}">Restore</button>` : `<button class="btn small" data-action="side-up" data-id="${s.id}" aria-label="Move ${esc(s.title)} up" ${i === 0 ? 'disabled' : ''}>${iconSvg('up')}</button>
          <button class="btn small" data-action="side-down" data-id="${s.id}" aria-label="Move ${esc(s.title)} down" ${i === visible.length - 1 ? 'disabled' : ''}>${iconSvg('down')}</button>
          <button class="btn small" data-action="side-archive" data-id="${s.id}">${iconSvg('archive')} Archive</button>`}
          <button class="btn small danger" data-action="side-delete" data-id="${s.id}">${iconSvg('trash')}<span class="sr">Delete ${esc(s.title)}</span></button></div></li>`; }).join('')}</ul>
        <div class="btns end"><button class="btn" data-action="new-side" data-main="${m.mainId}">${iconSvg('plus')} Side quest</button><button class="btn primary" data-action="close-modal">Done</button></div></div>`;
    }
    case 'quest-menu': {
      const q = data.mainQuests.find((x) => x.id === m.id)!;
      return `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mt"><button class="x-close" data-action="close-modal" aria-label="Close">${iconSvg('x')}</button>
        <h3 id="mt">${esc(q.title)}</h3><div class="menu-sheet">
        <button class="btn" data-action="open-quest" data-id="${q.id}">${iconSvg('next')} Open quest</button>
        <button class="btn" data-action="add-card" data-status="completed" data-main="${q.id}">${iconSvg('plus')} Achievement</button>
        <button class="btn" data-action="new-side" data-main="${q.id}">${iconSvg('plus')} Side quest</button>
        <button class="btn" data-action="edit-quest" data-id="${q.id}">${iconSvg('pencil')} Edit quest</button>
        ${sideQuestsOf(data, q.id, true).length ? `<button class="btn" data-action="manage-sides" data-id="${q.id}">Manage side quests</button>` : ''}
        <button class="btn" data-action="archive-quest" data-id="${q.id}">${iconSvg('archive')} Archive quest</button>
        <button class="btn danger" data-action="delete-quest" data-id="${q.id}">${iconSvg('trash')} Delete quest</button></div></div>`;
    }
    case 'profile': {
      const av = m.avatar && src(m.avatar) ? `<img src="${esc(src(m.avatar))}" alt="">` : avatarSvg();
      return `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mt"><button class="x-close" data-action="close-modal" aria-label="Close">${iconSvg('x')}</button>
        <form data-form="profile" novalidate><h3 id="mt">Your profile</h3>
        <div class="avatar-row"><div class="avatar" id="avatar-prev">${av}</div>
          <div class="avatar-btns"><label class="btn small">Choose picture<input class="sr" type="file" accept="image/*" data-upload="avatar"></label>
          ${m.avatar ? '<button type="button" class="btn small" data-action="avatar-clear">Use the cat</button>' : ''}</div></div><p class="err" data-err="avatar" role="alert"></p>
        ${field('Display name', 'displayName', `<input id="f-displayName" name="displayName" maxlength="30" value="${esc(m.name)}" autocomplete="off" required>`, '', true)}
        ${field('Gender', 'gender', `<select id="f-gender" name="gender"><option value="">Not set</option>${PLAYER_GENDERS.map((g) => `<option value="${g}" ${m.gender === g ? 'selected' : ''}>${PLAYER_GENDER_LABEL[g]}</option>`).join('')}</select>`)}
        ${field('Year of birth', 'birthYear', `<input id="f-birthYear" name="birthYear" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" step="1" value="${esc(m.birthYear)}" placeholder="e.g. 1998">`, 'Your age is worked out from it and goes up every new year.')}
        <div class="btns end"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary">Save</button></div></form></div>`;
    }
    case 'settings': return `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="mt"><button class="x-close" data-action="close-modal" aria-label="Close">${iconSvg('x')}</button>
      <h3 id="mt">Settings</h3>
      ${musicHtml()}
      <h4 class="sub">Save and load</h4>
      <p>${Capacitor.isNativePlatform() ? 'Your quests and photos are stored as files on this phone.' : 'Your quests and photos are stored in this browser.'} One backup file (.kitty) holds all of it <b>and Habit Kitty's kitties and diary</b>, so you can keep a copy or move to another device.</p>
      <p class="err" data-err="form" role="alert"></p>
      <div class="btns"><button class="btn primary grow" data-action="save-backup">Save to device</button>
      ${Capacitor.isNativePlatform() ? '<button class="btn grow" data-action="share-backup">Share…</button>' : ''}
      <label class="btn grow">Load achievements<input class="sr" type="file" data-upload="backup"></label></div>
      ${nativeBackups ? `<p class="hint">${backupStatus().folder.chosen ? 'It is also backed up automatically to your backup folder.' : 'To back up automatically, choose a backup folder in Habit Kitty → Settings → Backup.'}</p>` : ''}
      <p class="hint">Loading here only replaces your achievements, from a backup or an older Kitty Achievement save file. To restore everything, use Habit Kitty → Settings → Backup → Restore.</p></div>`;
    case 'confirm': return `<div class="panel" role="alertdialog" aria-modal="true" aria-labelledby="mt" aria-describedby="mb"><h3 id="mt">${esc(m.title)}</h3><p id="mb">${esc(m.body)}</p>
      <div class="btns end"><button class="btn" data-action="close-modal" autofocus>Cancel</button><button class="btn danger" data-action="confirm-yes">${esc(m.label)}</button></div></div>`;
  }
}

// The music is Habit Kitty's (see shared/music.ts): the same volume, and the song is picked in Habit Kitty's settings.
function musicHtml(): string {
  const m = music();
  if (!m) return '';
  const v = m.volume();
  return `<h4 class="sub">Music</h4>
      <label class="vol"><span>Volume</span><input type="range" data-music min="0" max="100" step="5" value="${v}" style="--fill:${v}%"><output class="num">${v ? `${v}%` : 'Off'}</output></label>
      <p class="hint">Playing: ${esc(m.playing())}. Habit Kitty's settings can change the song.</p>`;
}
function setMusic(input: HTMLInputElement, keep: boolean) {
  const v = Number(input.value);
  music()?.setVolume(v, keep);
  input.style.setProperty('--fill', `${v}%`);
  const out = input.parentElement?.querySelector('output');
  if (out) out.textContent = v ? `${v}%` : 'Off';
}

function renderModal() {
  const m = top();
  const layer = $('layer-modal');
  layer.innerHTML = m ? `<div class="scrim" data-scrim="${m.kind}">${modalHtml(m)}</div>` : '';
  syncScrollLock();
  if (m) {
    const first = layer.querySelector<HTMLElement>('[autofocus], input:not([type=radio]):not([type=file]):not([type=color]), textarea, button.primary');
    first?.focus();
    if (m.kind === 'achievement' || m.kind === 'complete') syncForm();
  } else if (openerSel) {
    appRoot.querySelector<HTMLElement>(openerSel)?.focus();
  }
}
const syncScrollLock = () => { document.body.style.overflow = $('layer-modal').firstElementChild ? 'hidden' : ''; };

function openModal(m: Modal) {
  if (!modals.length) {
    const a = document.activeElement as HTMLElement | null;
    const act = a?.dataset?.action;
    openerSel = a && act ? `[data-action="${act}"]${a.dataset.id ? `[data-id="${a.dataset.id}"]` : ''}` : '';
  }
  modals.push(m);
  renderModal();
}
function discardPhotos(photos: FormPhoto[]) {
  for (const p of photos) if (p.blob) { const u = urls.get(p.imageUrl); if (u) URL.revokeObjectURL(u); urls.delete(p.imageUrl); }
}
function closeModal(saved = false) {
  const m = modals.pop();
  if (m && !saved && (m.kind === 'achievement' || m.kind === 'complete')) discardPhotos(m.photos);
  if (m && !saved && m.kind === 'profile' && m.avatarBlob && m.avatar) { const u = urls.get(m.avatar); if (u) URL.revokeObjectURL(u); urls.delete(m.avatar); }
  renderModal();
}

function confirmDialog(title: string, body: string, label: string, run: () => void) { openModal({ kind: 'confirm', title, body, label, run }); }

// ---------- forms ----------

const blank = (mainId: string, sideId: string, status: Status): FormValues => ({
  title: '', description: '', location: '', tags: '', icon: PICKER_ICON_NAMES.includes(sideQuestIcon(sideId)) ? sideQuestIcon(sideId) : 'star', mainQuestId: mainId, sideQuestId: sideId,
  status, rarity: 'normal', date: status === 'completed' ? todayStr() : '', goal: '', progress: '0',
});
const sideQuestIcon = (id: string) => data.sideQuests.find((s) => s.id === id)?.icon ?? 'star';
const valuesOf = (a: Achievement): FormValues => ({
  title: a.title, description: a.description, location: a.location ?? '', tags: a.tags.join(', '), icon: a.icon, mainQuestId: a.mainQuestId, sideQuestId: a.sideQuestId ?? '', status: a.status, rarity: a.rarity,
  date: (a.status === 'completed' ? a.completionDate : a.plannedDate) ?? '',
  goal: a.goal ? String(a.goal) : '', progress: String(a.progress ?? 0),
});
const formPhotos = (id: string): FormPhoto[] => photosOf(data, id).map((p) => ({ imageUrl: p.imageUrl, existingId: p.id }));

function readValues(form: HTMLFormElement, base: FormValues): FormValues {
  const fd = new FormData(form);
  const get = (k: string, d: string) => (fd.has(k) ? String(fd.get(k)) : d);
  return {
    title: get('title', base.title), description: get('description', base.description), location: get('location', base.location), icon: get('icon', base.icon), tags: get('tags', base.tags),
    mainQuestId: get('mainQuestId', base.mainQuestId), sideQuestId: get('sideQuestId', base.sideQuestId),
    status: get('status', base.status) as Status, rarity: get('rarity', base.rarity) as Rarity, date: get('date', base.date),
    goal: get('goal', base.goal), progress: get('progress', base.progress),
  };
}

function showErrors(form: HTMLElement, errors: Errors) {
  form.querySelectorAll<HTMLElement>('[data-err]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  let first: HTMLElement | null = null;
  for (const [k, msg] of Object.entries(errors)) {
    const el = form.querySelector<HTMLElement>(`[data-err="${k}"]`) ?? form.querySelector<HTMLElement>('[data-err="form"]');
    if (el) el.textContent = msg;
    const input = form.querySelector<HTMLElement>(`[name="${k}"]`);
    if (input) { input.setAttribute('aria-invalid', 'true'); first ??= input; }
  }
  (first ?? form.querySelector<HTMLElement>('[data-err]:not(:empty)'))?.focus?.();
}

// Keeps the dependent parts of the achievement form right: side quests follow the main quest, rarity only for completed, the preview card.
function syncForm(changed?: string) {
  const m = top();
  const form = appRoot.querySelector<HTMLFormElement>('#layer-modal form');
  if (!form || !m || (m.kind !== 'achievement' && m.kind !== 'complete')) return;
  const prevStatus = m.v.status;
  const side = form.elements.namedItem('sideQuestId') as HTMLSelectElement | null;
  if (changed === 'mainQuestId' && side) {
    const mainId = (form.elements.namedItem('mainQuestId') as HTMLSelectElement).value;
    side.innerHTML = sideOptions(mainId, '');
    side.value = '';
  }
  m.v = readValues(form, m.v);
  if (changed === 'sideQuestId' && m.kind === 'achievement' && !m.id && !m.v.title) {   // a new card takes the icon of its side quest until you pick one
    const icon = sideQuestIcon(m.v.sideQuestId);
    const r = form.querySelector<HTMLInputElement>(`input[name="icon"][value="${icon}"]`);
    if (r) { r.checked = true; m.v.icon = icon; }
  }
  if (changed === 'status') {
    if (m.v.status === 'completed' && !m.v.date) { m.v.date = todayStr(); (form.elements.namedItem('date') as HTMLInputElement).value = m.v.date; }
    const lab = form.querySelector('label[for="f-date"]'); if (lab) lab.textContent = m.v.status === 'planned' ? 'Target date' : 'Date';
    if (prevStatus !== m.v.status) form.querySelector('#h-date')?.replaceChildren(document.createTextNode(m.v.status === 'planned' ? 'Optional' : ''));
  }
  const prog = form.querySelector<HTMLElement>('#progress-block');
  if (prog) prog.hidden = !m.v.goal.trim();
  const rarity = form.querySelector<HTMLElement>('#rarity-block');
  if (rarity) rarity.hidden = m.v.status !== 'completed';
  $('preview').innerHTML = cardHtml(previewView(m.v, m.photos), { static: true });
}

async function addPhotos(files: FileList | null, input: HTMLInputElement) {
  const m = top();
  if (!files?.length || !m || (m.kind !== 'achievement' && m.kind !== 'complete')) return;
  m.busy = true;
  const submit = document.getElementById('submit') as HTMLButtonElement | null;
  if (submit) submit.disabled = true;
  const failed: string[] = [];
  for (const f of Array.from(files)) {
    try {
      const blob = await compressPhoto(f);
      const ref = `${IDB_PREFIX}${newId()}`;
      urls.set(ref, URL.createObjectURL(blob));
      m.photos.push({ imageUrl: ref, blob });
    } catch { failed.push(f.name); }
  }
  input.value = '';
  m.busy = false;
  if (top() !== m) { discardPhotos(m.photos.filter((p) => p.blob)); return; }   // the form was closed while the pictures were being read
  $('photo-list').innerHTML = photoListHtml(m.photos);
  const err = appRoot.querySelector<HTMLElement>('[data-err="photos"]');
  if (err) err.textContent = failed.length ? `Could not read ${failed.join(', ')}. Choose a normal picture file.` : '';
  if (submit) submit.disabled = false;
  syncForm();
}

async function submitAchievement(form: HTMLFormElement) {
  const m = top();
  if (!m || (m.kind !== 'achievement' && m.kind !== 'complete') || m.busy) return;
  m.v = readValues(form, m.v);
  if (m.kind === 'complete') m.v.status = 'completed';
  const input = (): AchievementInput => ({ ...m.v, ...formGoal(m.v), tags: splitTags(m.v.tags), photos: m.photos.map((p) => ({ id: p.existingId, imageUrl: p.imageUrl })) });
  const opts = { requireDate: m.kind === 'complete' };
  const id = m.id;
  const check = saveAchievement(data, input(), id, opts);
  if (Object.keys(check.errors).length) { showErrors(form, check.errors); return; }
  m.busy = true;
  (document.getElementById('submit') as HTMLButtonElement).disabled = true;
  const fresh = m.photos.filter((p) => p.blob);
  const stored: string[] = [];
  try {
    for (const p of fresh) { await repo.putPhoto(p.imageUrl, p.blob as Blob); stored.push(p.imageUrl); }
  } catch {
    await repo.deletePhotos(stored).catch(() => {});
    m.busy = false;
    (document.getElementById('submit') as HTMLButtonElement).disabled = false;
    showErrors(form, { form: 'Could not store the photos, so nothing was saved. Try again, or remove the photos.' });
    return;
  }
  const before = levelOf(data).level;
  const res = saveAchievement(data, input(), id, opts);   // again, in case the data moved while the photos were saved
  commit(res.data, res.removedPhotos);
  closeModal(true);
  const wasPlanned = m.kind === 'complete';
  if (wasPlanned) { unlocked = res.id; setTimeout(() => { unlocked = null; }, 1500); render(); }
  const after = levelOf(res.data).level;
  toast(after > before ? `Level up! You are now LVL ${after}${titleFor(after) !== titleFor(before) ? `, ${titleFor(after)}` : ''}.` : wasPlanned ? 'Achievement unlocked!' : id ? 'Saved.' : m.v.status === 'planned' ? 'Locked achievement added.' : 'Added to your collection.');
}

// ---------- rendering ----------

let lastPage = '', lastKey = '';

function render() {
  if (!ready) return;
  const r = route();
  renderStatus();
  // an achievement opens on its own page (its hash is its quest's page, or the all page, with /card/<id> after it)
  const card = r.page !== 'home' && r.card ? data.achievements.find((a) => a.id === r.card && (r.page === 'all' || a.mainQuestId === r.id)) : undefined;
  const key = card ? `card:${card.id}` : pageKey(r);
  const html = card ? cardPageHtml(card) : r.page === 'home' ? homeHtml() : questHtml(r.page === 'quest' ? r.id : '');
  if (html !== lastPage || key !== lastKey) {
    const y = key === lastKey ? window.scrollY : 0;
    const a = document.activeElement as HTMLElement | null;
    const sel = a && $('page').contains(a) && a.dataset.action
      ? ['action', 'id', 'side', 'status', 'main'].filter((k) => a.dataset[k] !== undefined).map((k) => `[data-${k}="${a.dataset[k]}"]`).join('')
      : a && $('page').contains(a) && a.dataset.filter ? `[data-filter="${a.dataset.filter}"]` : a && $('page').contains(a) && a.dataset.filterSave !== undefined ? '[data-filter-save]' : '';
    $('page').innerHTML = html;
    if (sel && key === lastKey) appRoot.querySelector<HTMLElement>(sel)?.focus();
    lastPage = html;
    if (key !== lastKey) {
      lastKey = key;
      requestAnimationFrame(() => window.scrollTo(0, scrolls.get(key) ?? 0));
      if (card) $('page').querySelector<HTMLElement>('[data-action="close-detail"]')?.focus({ preventScroll: true });
      document.title = `${card ? card.title + ' · ' : r.page === 'quest' ? data.mainQuests.find((q) => q.id === r.id)!.title + ' · ' : r.page === 'all' ? 'All achievements · ' : ''}Kitty Achievement`;
    }
    else window.scrollTo(0, y);
  }
}

// ---------- events ----------

function closeDetail() {
  const r = route();
  if (r.page === 'home') return;
  detailPhoto = 0;
  if (openedInApp) { openedInApp = false; history.back(); } else location.replace(r.page === 'quest' ? questHash(r.id) : ALL_HASH);
}

// The main page always sits right under a quest page in the history (see keepHistoryTidy), so going home is one step
// back, or two with a card open. That is also what the phone's back button does.
function goHome() {
  const r = route();
  if (r.page === 'quest') history.go(r.card && openedInApp ? -2 : -1);
  else if (r.page === 'all') location.hash = '#/';
}

// A quest page opened from a link or after a reload has nothing under it: put the main page there, so back goes home
// instead of leaving the app. Entries we made are marked, so a reload does not do it twice.
function keepHistoryTidy() {
  if (history.state?.ak) return;
  const h = location.hash;
  const m = /^#\/quest\/([^/]+)(\/card\/[^/]+)?$/.exec(h);
  if (!m) { history.replaceState({ ak: 1 }, ''); return; }
  history.replaceState({ ak: 1 }, '', '#/');
  history.pushState({ ak: 1 }, '', questHash(m[1]));
  if (m[2]) { history.pushState({ ak: 1 }, '', h); openedInApp = true; }
}

function startAchievement(status: Status, mainId: string, sideId?: string) {
  const side = sideId && sideQuestsOf(data, mainId).some((s) => s.id === sideId) ? sideId : '';   // none: directly in the main quest
  openModal({ kind: 'achievement', v: blank(mainId, side, status), photos: [] });
}

function questDelete(id: string) {
  const q = data.mainQuests.find((x) => x.id === id)!;
  const n = data.achievements.filter((a) => a.mainQuestId === id).length;
  const s = data.sideQuests.filter((x) => x.mainQuestId === id).length;
  confirmDialog(`Delete “${q.title}”?`, `This permanently deletes the quest, its ${plural(s, 'side quest')} and ${plural(n, 'achievement')} with their photos. You can archive it instead to keep everything.`, 'Delete quest', () => {
    const r = deleteMainQuest(data, id);
    views.delete(id);
    goHome();
    commit(r.data, r.removedPhotos);
    toast('Quest deleted.');
  });
}

function onAction(el: HTMLElement) {
  el.closest('details.menu')?.removeAttribute('open');
  const id = el.dataset.id ?? '';
  const r = route();
  const questId = r.page === 'quest' ? r.id : '';
  const vk = viewKey(r);
  if (top()?.kind === 'quest-menu' && el.dataset.action !== 'close-modal') { modals.pop(); renderModal(); }   // a menu choice closes the menu
  const m = top();
  switch (el.dataset.action) {
    case 'open-settings': openModal({ kind: 'settings' }); break;
    case 'save-backup': exportBackup(); break;
    case 'share-backup': shareBackupFile(); break;
    case 'retry-save': saver.retry().then(() => renderStatus()); break;
    case 'edit-profile': openProfile(); break;
    case 'avatar-clear': if (m?.kind === 'profile') { keepProfileFields(m); m.avatar = null; m.avatarBlob = undefined; renderModal(); } break;
    case 'new-quest': openModal({ kind: 'quest', title: '', description: '' }); break;
    case 'edit-quest': { const q = data.mainQuests.find((x) => x.id === id)!; openModal({ kind: 'quest', id, title: q.title, description: q.description }); break; }
    case 'open-quest': location.hash = questHash(id); break;
    case 'toggle-quest': if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); writeStore('ak-collapsed', [...collapsed].join(',')); render(); break;
    case 'archive-quest': {
      const q = data.mainQuests.find((x) => x.id === id)!;
      confirmDialog(`Archive “${q.title}”?`, 'It leaves your main page but nothing is deleted. You can restore it from the archive at the bottom of the main page.', 'Archive', () => {
        goHome(); commit(setMainQuestArchived(data, id, true)); toast('Quest archived.');
      }); break;
    }
    case 'restore-quest': commit(setMainQuestArchived(data, id, false)); toast('Quest restored.'); break;
    case 'delete-quest': questDelete(id); break;
    case 'new-side': openModal({ kind: 'side', mainId: el.dataset.main ?? questId, title: '', color: pickColor(data, el.dataset.main ?? questId), icon: 'star' }); break;
    case 'form-add-side': {
      if (m?.kind !== 'achievement') break;
      const form = appRoot.querySelector<HTMLFormElement>('#layer-modal form')!;
      m.v = readValues(form, m.v);
      m.iconOpen = form.querySelector<HTMLDetailsElement>('details.icon-fold')?.open;
      openModal({ kind: 'side', mainId: m.v.mainQuestId, title: '', color: pickColor(data, m.v.mainQuestId), icon: 'star', onSaved: (sid) => { m.v.sideQuestId = sid; } });
      break;
    }
    case 'manage-sides': openModal({ kind: 'sides', mainId: id }); break;
    case 'side-edit': { const s = data.sideQuests.find((x) => x.id === id)!; openModal({ kind: 'side', mainId: s.mainQuestId, id, title: s.title, color: s.color, icon: s.icon }); break; }
    case 'side-up': case 'side-down': { commit(moveSideQuest(data, id, el.dataset.action === 'side-up' ? -1 : 1)); renderModal(); (appRoot.querySelector(`[data-action="${el.dataset.action}"][data-id="${id}"]:not(:disabled)`) as HTMLElement | null)?.focus(); break; }
    case 'side-archive': commit(setSideQuestArchived(data, id, true)); renderModal(); break;
    case 'side-restore': commit(setSideQuestArchived(data, id, false)); renderModal(); break;
    case 'side-delete': {
      const s = data.sideQuests.find((x) => x.id === id)!;
      const n = data.achievements.filter((a) => a.sideQuestId === id).length;
      confirmDialog(`Delete “${s.title}”?`, `This permanently deletes the side quest and its ${plural(n, 'achievement')}. Archive it instead to keep them.`, 'Delete side quest', () => {
        const res = deleteSideQuest(data, id); commit(res.data, res.removedPhotos); renderModal(); toast('Side quest deleted.');
      }); break;
    }
    case 'clear-filters': setView(vk, { ...DEFAULT_VIEW }); render(); break;
    case 'toggle-filter': {
      filterFor = filterFor === vk ? '' : vk; render();
      (appRoot.querySelector<HTMLElement>(filterFor ? '#filter-panel select' : '[data-action="toggle-filter"]'))?.focus(); break;
    }
    case 'tag-add': {
      const input = appRoot.querySelector<HTMLInputElement>('#f-tags');
      const tag = el.dataset.tag ?? '';
      if (!input || !tag) break;
      const have = splitTags(input.value).map((t) => t.trim()).filter(Boolean);
      if (!have.some((t) => t.toLowerCase() === tag.toLowerCase())) input.value = [...have, tag].join(', ');
      clearError(input); syncForm(); break;
    }
    case 'back': goHome(); break;
    case 'show-home': location.hash = '#/'; break;
    case 'show-all': location.hash = ALL_HASH; break;
    case 'add-card': {   // from a quest page filtered to one side quest, a new card starts in that side quest
      const v = viewOf(vk);
      const filtered = data.sideQuests.find((x) => x.id === v.side);   // on the all page, the filtered side quest decides the main quest
      startAchievement(el.dataset.status as Status, el.dataset.main ?? (questId || filtered?.mainQuestId || activeMainQuests(data)[0]?.id || ''), el.dataset.side ?? (v.side !== 'all' && v.side !== 'none' ? v.side : undefined)); break;
    }
    case 'open-card': scrolls.set(lastKey, window.scrollY); openedInApp = true; detailPhoto = 0; location.hash = r.page === 'all' ? `${ALL_HASH}/card/${id}` : `${questHash(el.dataset.main || questId)}/card/${id}`; break;
    case 'close-detail': closeDetail(); break;
    case 'goal-up': case 'goal-down': {
      const res = stepProgress(data, id, el.dataset.action === 'goal-up' ? 1 : -1);
      if (res.data === data) break;
      commit(res.data);
      if (res.reached) {   // the goal is met: offer to unlock the card right away
        const a = data.achievements.find((x) => x.id === id)!;
        toast('Goal reached!');
        openModal({ kind: 'complete', id, v: { ...valuesOf(a), status: 'completed', date: todayStr(), rarity: 'normal' }, photos: formPhotos(id) });
      }
      break;
    }
    case 'gallery': detailPhoto = Number(el.dataset.i); render(); break;
    case 'share-card': {
      const a = data.achievements.find((x) => x.id === id), card = document.querySelector<HTMLElement>('.card.big');
      if (a && card) sharePicture(card, a.title || 'Achievement').then((r) => { if (r === 'saved') toast('Picture saved.'); }, () => toast("Couldn't make the picture."));
      break;
    }
    case 'edit-card': { const a = data.achievements.find((x) => x.id === id)!; openModal({ kind: 'achievement', id, v: valuesOf(a), photos: formPhotos(id) }); break; }
    case 'complete-card': {
      const a = data.achievements.find((x) => x.id === id)!;
      openModal({ kind: 'complete', id, v: { ...valuesOf(a), status: 'completed', date: todayStr(), rarity: 'normal' }, photos: formPhotos(id) }); break;
    }
    case 'delete-card': {
      const a = data.achievements.find((x) => x.id === id)!;
      confirmDialog(`Delete “${a.title}”?`, 'This permanently deletes the card and its photos. Its quest and side quest stay.', 'Delete card', () => {
        const res = deleteAchievement(data, id); commit(res.data, res.removedPhotos); closeDetail(); toast('Achievement deleted.');
      }); break;
    }
    case 'photo-remove': if (m && (m.kind === 'achievement' || m.kind === 'complete')) {
      const [gone] = m.photos.splice(Number(el.dataset.i), 1);
      if (gone?.blob) discardPhotos([gone]);
      $('photo-list').innerHTML = photoListHtml(m.photos); syncForm();
    } break;
    case 'close-modal': closeModal(); break;
    case 'confirm-yes': if (m?.kind === 'confirm') { closeModal(); m.run(); } break;
  }
}

function onSubmit(form: HTMLFormElement) {
  const m = top();
  const fd = new FormData(form);
  const s = (k: string) => String(fd.get(k) ?? '');
  switch (form.dataset.form) {
    case 'achievement': case 'complete': submitAchievement(form); break;
    case 'quest': {
      if (m?.kind !== 'quest') return;
      const r = saveMainQuest(data, { title: s('title'), description: s('description') }, m.id);
      if (Object.keys(r.errors).length) { showErrors(form, r.errors); return; }
      commit(r.data); closeModal(true);
      if (!m.id) location.hash = questHash(r.id);
      toast(m.id ? 'Saved.' : 'Quest created.');
      break;
    }
    case 'side': {
      if (m?.kind !== 'side') return;
      const r = saveSideQuest(data, { mainQuestId: m.mainId, title: s('title'), color: s('color') || s('custom'), icon: s('icon') }, m.id);
      if (Object.keys(r.errors).length) { showErrors(form, r.errors); return; }
      commit(r.data); m.onSaved?.(r.id); closeModal(true);
      toast(m.id ? 'Saved.' : 'Side quest added.');
      break;
    }
    case 'profile': {
      if (m?.kind !== 'profile') return;
      const year = s('birthYear').trim();
      const r = updateProfile(data, { displayName: s('displayName'), gender: (s('gender') || null) as PlayerGender | null, birthYear: year === '' ? null : Number(year), avatarUrl: m.avatar });
      if (Object.keys(r.errors).length) { showErrors(form, r.errors); return; }
      const old = data.user.avatarUrl;
      const save = async () => {
        if (m.avatarBlob && m.avatar) await repo.putPhoto(m.avatar, m.avatarBlob);
        commit(r.data, old && old !== m.avatar ? [old] : []);
        closeModal(true); toast('Profile saved.');
      };
      save().catch(() => showErrors(form, { avatar: 'Could not store the picture. Nothing was saved.' }));
      break;
    }
  }
}

onShown('achievement', 'click', (e) => {
  if (pressed) { pressed = false; e.preventDefault(); return; }   // the click that ends a long press does nothing else
  const t = e.target as HTMLElement;
  const pick = t.closest<HTMLDetailsElement>('details.icon-fold');
  if (pick && t.closest('.icon-pick') && (e as MouseEvent).detail > 0) setTimeout(() => pick.removeAttribute('open'), 0);   // choosing with a tap or click folds the list (the arrow keys leave it open)
  const el = t.closest<HTMLElement>('[data-action]');
  if (el && !el.hasAttribute('disabled')) { onAction(el); return; }
  const scrim = t.closest<HTMLElement>('.scrim');
  if (scrim && t === scrim) {   // a click outside closes a dialog, but never a form with unsaved text
    const kind = scrim.dataset.scrim;
    if (kind === 'confirm' || kind === 'sides' || kind === 'quest-menu') closeModal();
  }
});
onShown('achievement', 'submit', (e) => { e.preventDefault(); onSubmit(e.target as HTMLFormElement); });
onShown('achievement', 'change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.matches('[data-music]')) { setMusic(t, true); return; }
  clearError(t);
  if (t.name === 'icon' && t.type === 'radio') {   // the summary shows the chosen icon
    const sum = t.closest('details.icon-fold')?.querySelector('summary');
    if (sum) { sum.innerHTML = iconSummary(t.value); sum.setAttribute('aria-label', `Icon: ${iconLabel(t.value)}. Change`); }
  }
  if (t.dataset.upload === 'photos') { addPhotos(t.files, t); return; }
  if (t.dataset.filterSave !== undefined) {   // the checkbox in the filter panel: keep these settings for every quest, or go back to one per quest
    const q = route();
    if (q.page !== 'home') {
      const now = viewOf(viewKey(q));
      if (t.checked) { savedView = now; writeStore(FILTER_KEY, JSON.stringify(now)); }
      else { savedView = null; dropStore(FILTER_KEY); views.set(viewKey(q), now); }
      render();
    }
    return;
  }
  if (t.dataset.filter) {
    const q = route();
    if (q.page === 'home') return;
    if (t.dataset.filter === 'quest') {   // the main quest filter is the page: one quest's, or all of them
      filterFor = '';
      if (t.value) { setView(t.value, { ...viewOf(t.value), side: 'all' }); filterFor = t.value; }
      else setView(ALL_VIEW, { ...viewOf(ALL_VIEW), side: 'all' });
      location.replace(t.value ? questHash(t.value) : ALL_HASH);
      return;
    }
    setView(viewKey(q), { ...viewOf(viewKey(q)), [t.dataset.filter]: t.value }); render();
    return;
  }
  if (t.dataset.upload === 'backup') { readBackup(t.files?.[0], t); return; }
  if (t.dataset.upload === 'avatar') { setAvatar(t.files?.[0], t); return; }
  if (t.closest('#layer-modal form[data-form="achievement"], #layer-modal form[data-form="complete"]')) syncForm(t.name);
  if (t.type === 'color' && t.name === 'custom') {   // picking a custom colour selects it
    t.closest('.swatches')?.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((r) => { r.checked = false; });
  }
});
function clearError(t: HTMLInputElement) {   // a message goes away as soon as you work on its field
  if (!t.name) return;
  t.removeAttribute('aria-invalid');
  const e = t.closest('form')?.querySelector<HTMLElement>(`[data-err="${t.name}"]`);
  if (e) e.textContent = '';
}
onShown('achievement', 'toggle', (e) => {   // a form that is rebuilt keeps its icon list open or folded
  const d = e.target as HTMLDetailsElement;
  const m = top();
  if (m?.kind === 'achievement' && d.classList?.contains('icon-fold')) m.iconOpen = d.open;
}, true);
onShown('achievement', 'animationend', (e) => { if ((e.target as Element).closest?.('.unlock')) unlocked = null; });
onShown('achievement', 'input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.matches('[data-music]')) { setMusic(t, false); return; }
  clearError(t);
  if (t.closest('#layer-modal form[data-form="achievement"], #layer-modal form[data-form="complete"]')) syncForm();
});
onShown('achievement', 'keydown', (e) => {
  if (e.key === 'Escape') {
    if (top()) closeModal(); else if ((route() as { card?: string }).card) closeDetail();
    return;
  }
  if (e.key !== 'Tab') return;
  const layer = top() ? $('layer-modal') : null;
  if (!layer) return;
  const f = Array.from(layer.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'))
    .filter((x) => !(x as HTMLButtonElement).disabled && x.offsetParent !== null && !(x as HTMLInputElement).hidden && (x as HTMLInputElement).type !== 'hidden');
  if (!f.length) return;
  const i = f.indexOf(document.activeElement as HTMLElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && (i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
});
// Long-pressing a quest on the main page (or right-clicking it, or the context-menu key) opens its menu.
let press: { timer: number; x: number; y: number } | null = null;
let pressed = false;
const openProfile = () => { if (top()?.kind !== 'profile') openModal({ kind: 'profile', name: data.user.displayName, gender: data.user.gender ?? '', birthYear: data.user.birthYear == null ? '' : String(data.user.birthYear), avatar: data.user.avatarUrl }); };
// A long press opens what the thing pressed has: a quest's menu, or the player's profile.
const openPressed = (el: HTMLElement) => (el.dataset.quest ? questMenu(el.dataset.quest) : openProfile());
const questMenu = (id: string) => { if (top()?.kind !== 'quest-menu') openModal({ kind: 'quest-menu', id }); };
const endPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
onShown('achievement', 'pointerdown', (e) => {
  pressed = false;
  const q = (e.target as HTMLElement).closest<HTMLElement>('[data-quest], [data-profile]');
  if (!q || e.button !== 0 || top()) return;
  press = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => { press = null; pressed = true; navigator.vibrate?.(15); openPressed(q); }, 500) };
});
onShown('achievement', 'pointermove', (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) endPress(); });
onShown('achievement', 'pointerup', endPress);
onShown('achievement', 'pointercancel', endPress);
onShown('achievement', 'contextmenu', (e) => {
  const q = (e.target as HTMLElement).closest<HTMLElement>('[data-quest], [data-profile]');
  if (!q || top()) return;
  e.preventDefault(); endPress(); openPressed(q);
});
window.addEventListener('scroll', () => { if (lastKey && shownApp() === 'achievement') scrolls.set(lastKey, window.scrollY); }, { passive: true });
window.addEventListener('resize', () => { if (shownApp() === 'achievement') fitCards(); });
window.addEventListener('hashchange', () => {
  if (shownApp() !== 'achievement') return;
  history.replaceState({ ak: 1 }, '');
  const r = route();
  if (!(r.page !== 'home' && r.card)) openedInApp = false;
  render();
});

// The profile form is rebuilt when the picture changes, so what was typed is kept first.
function keepProfileFields(m: Extract<Modal, { kind: 'profile' }>) {
  const form = appRoot.querySelector<HTMLFormElement>('#layer-modal form[data-form="profile"]');
  if (!form) return;
  m.name = (form.elements.namedItem('displayName') as HTMLInputElement).value;
  m.gender = (form.elements.namedItem('gender') as HTMLSelectElement).value;
  m.birthYear = (form.elements.namedItem('birthYear') as HTMLInputElement).value;
}

// ---- save files ----

function backupError(msg: string) {
  const el = appRoot.querySelector<HTMLElement>('#layer-modal [data-err="form"]');
  if (el) el.textContent = msg; else toast(msg);
}

// One backup file holds both apps (Habit Kitty builds it, see shared/backupfolder.ts), so Save and Share are the same here.
async function exportBackup() {
  try {
    const where = await saveBackupToDevice();
    if (where !== null) toast(where ? `Backup saved: ${where}` : 'Backup downloaded.');
  } catch { backupError("Couldn't make the backup file. Try again."); }
}
async function shareBackupFile() {
  try { await shareBackup(); } catch (e) { if (!/cancel/i.test(String((e as Error)?.message ?? e))) backupError("Couldn't make the backup file. Try again."); }
}

// Save files from before the two apps shared one limit can hold photos of a few hundred KB: shrink those to the same
// size as a new photo (the avatar as a new avatar). A photo that can't be decoded stays as it is. Says how many were shrunk.
const AVATAR = { maxSide: 256, square: true };
async function shrinkPhotos(d: Data, photos: Map<string, Blob>): Promise<number> {
  let n = 0;
  for (const [ref, blob] of photos) {
    if (blob.size <= PHOTO_MAX_BYTES) continue;
    const small = await compressPhoto(blob, ref === d.user.avatarUrl ? AVATAR : {}).catch(() => null);
    if (small && small.size < blob.size) { photos.set(ref, small); n++; }
  }
  return n;
}

async function readBackup(file: File | undefined, input: HTMLInputElement) {
  if (!file) return;
  let b: ReturnType<typeof unpackBackup>;
  try { b = unpackBackup(new Uint8Array(await file.arrayBuffer())); }
  catch { input.value = ''; backupError("That isn't a Habit Kitty backup or an Kitty Achievement save file."); return; }
  input.value = '';
  const n = b.data.achievements.length;
  confirmDialog('Replace everything?', `This file has ${plural(b.data.mainQuests.length, 'main quest')} and ${plural(n, 'achievement')}. Loading it deletes what is in the app now.`, 'Replace everything', async () => {
    let shrunk = 0;
    try {
      shrunk = await shrinkPhotos(b.data, b.photos);
      await repo.replaceAll(b.data, b.photos);
    } catch { openModal({ kind: 'settings' }); backupError("Couldn't load the file. Nothing was changed."); return; }
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls.clear();
    for (const [ref, blob] of b.photos) urls.set(ref, URL.createObjectURL(blob));
    data = b.data; views.clear(); collapsed.clear(); unlocked = null; lastPage = '';
    modals.length = 0; renderModal();
    goHome(); render();
    toast(shrunk ? `Save file loaded. ${plural(shrunk, 'big photo')} made smaller.` : 'Save file loaded.');
  });
}

async function setAvatar(file: File | undefined, input: HTMLInputElement) {
  const m = top();
  if (!file || m?.kind !== 'profile') return;
  try {
    const blob = await compressPhoto(file, AVATAR);
    if (m.avatarBlob && m.avatar) { const u = urls.get(m.avatar); if (u) URL.revokeObjectURL(u); urls.delete(m.avatar); }
    const ref = `${IDB_PREFIX}${newId()}`;
    urls.set(ref, URL.createObjectURL(blob));
    m.avatar = ref; m.avatarBlob = blob;
    if (top() === m) { keepProfileFields(m); renderModal(); }
  } catch {
    const err = appRoot.querySelector<HTMLElement>('[data-err="avatar"]');
    if (err) err.textContent = 'Could not read that picture. Choose a normal picture file.';
  }
  input.value = '';
}

// ---------- start ----------

const looksValid = (d: Data | null): d is Data => !!d && d.version === 1 && !!d.user && [d.mainQuests, d.sideQuests, d.achievements, d.photos].every(Array.isArray);

async function boot() {
  const theme = readStore('hk-theme');   // one light/dark choice for both apps
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  paintBackdrop();
  try {
    repo = platformRepo();
    const loaded = await repo.load();
    if (loaded.data && !looksValid(loaded.data)) throw new Error('unreadable');
    for (const [ref, blob] of loaded.photos) urls.set(ref, URL.createObjectURL(blob));
    data = loaded.data ? migrate(loaded.data) : emptyData();
    if (!loaded.data) await repo.saveData(data);
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    repo = new MemoryRepo();
    data = emptyData();
    storageNote = e instanceof Error && e.message === 'unreadable'
      ? 'Your saved data could not be read, so this session starts empty and will not overwrite it.'
      : 'This browser is not letting the app save anything. What you add will be lost when you close the page.';
  }
  saver = new Saver(repo, () => renderStatus());
  $('app').innerHTML = '<div id="head"></div><div id="status"></div><div id="page"></div>';
  ready = true;
  fitCards();
  keepHistoryTidy();
  render();
}
// Back from Habit Kitty: the window may have been resized, or the theme changed, while this app was hidden.
// The player (name, picture...) is shared and can be edited on the home page: read it again whenever this app is shown.
async function refreshPlayer() {
  if (!ready || repo instanceof MemoryRepo) return;
  try {
    const fresh = await repo.loadData();
    if (!fresh || JSON.stringify(fresh.user) === JSON.stringify(data.user)) return;
    const ref = fresh.user.avatarUrl;
    if (ref && isLocalRef(ref) && !urls.has(ref)) { const b = await repo.getPhoto(ref); if (b) urls.set(ref, URL.createObjectURL(b)); }
    data = { ...data, user: fresh.user };
    render();
  } catch { /* keep what is on screen */ }
}
onAppShown('achievement', () => { if (ready) { fitCards(); render(); refreshPlayer(); } });
boot();
