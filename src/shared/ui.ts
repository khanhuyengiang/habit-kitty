// The parts every screen draws the same way: the title bar with its square buttons, the look (light or dark, fancy background), and the toast.
import { iconSvg } from './art.ts';
import { UI_ICONS } from './stickers.ts';
import { monoSvg } from './pixelart.ts';
import { esc } from './html.ts';
import { getLocal, setLocal } from './local.ts';
import { paintBackdrop } from './backdrop.ts';

// ---- the look: light, dark or following the device (the default), and the fancy background. Kept on
// this device. Chosen in Settings → Look (src/habit/look.ts); read here first, so the first paint is already right.
// Only a choice other than the default is stored; the fancy background is on until it is turned off (stored as '0').
const THEME_KEY = 'hk-theme', FANCY_KEY = 'hk-fancy';
export type ThemeMode = 'device' | 'light' | 'dark';
const DEFAULT_THEME: ThemeMode = 'device';   // always: follow the device until someone picks light or dark
const stored = getLocal, store = setLocal;   // storage blocked: the defaults, and not remembered
{
  const t = stored(THEME_KEY) ?? DEFAULT_THEME;
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  if (stored(FANCY_KEY) !== '0') document.documentElement.dataset.fancy = '';
}

// The ✕ in a dialog's corner.
export const closeX = (action = 'layer-close', label = 'Close') =>
  `<button class="x-close" type="button" data-action="${action}" aria-label="${label}">${iconSvg('x')}</button>`;

export const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;
export const themeMode = (): ThemeMode => (document.documentElement.dataset.theme as ThemeMode | undefined) ?? 'device';
export function setThemeMode(m: ThemeMode) {
  if (m === 'device') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = m;
  store(THEME_KEY, m === DEFAULT_THEME ? null : m);
  paintBackdrop();
}
export const fancyOn = () => 'fancy' in document.documentElement.dataset;
export function setFancy(on: boolean) {
  if (on) document.documentElement.dataset.fancy = ''; else delete document.documentElement.dataset.fancy;
  store(FANCY_KEY, on ? null : '0');
  paintBackdrop();
}

// ---- the title bar ----
const square = (attrs: string, label: string, inner: string) => `<button class="gear" type="button" ${attrs} aria-label="${label}">${inner}</button>`;

export const homeButton = () => square('data-action="go" data-to="home"', 'Home', iconSvg('home'));
export const playerButton = () => square('data-action="player-stat"', 'Player stat', iconSvg('player'));
// Settings is one screen in Habit Kitty, reached from every app; Habit Kitty itself passes its own action.
export const settingsButton = (attrs = 'data-action="go" data-to="habit" data-tab="settings"') => square(attrs, 'Settings', iconSvg('gear'));
export const backButton = (action: string) => square(`data-action="${action}"`, 'Back', iconSvg('prev'));

// An app's name with "Kitty" in pink and the other word in the title colour: "Habit Kitty", "Kitty Journal".
export const appName = (first: string, second: string) =>
  [first, second].map((w) => (w === 'Kitty' ? `<span class="kitty">${w}</span>` : `<span class="name">${w}</span>`)).join(' ');
// The name on the left, the square buttons on the right: the same on every screen, so the buttons never move.
export const titleBar = (first: string, second: string, buttons: string) =>
  `<div class="brand"><h1>${appName(first, second)}</h1><div class="brand-r">${buttons}</div></div>`;

// ---- the toast: a short message at the bottom that goes away by itself ----
const toastTimers = new WeakMap<HTMLElement, number>();
export function showToast(el: HTMLElement, text: string) {
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimers.get(el));
  toastTimers.set(el, window.setTimeout(() => (el.hidden = true), 3200));
}

// ---- putting things in order ----
// The two buttons that move one thing up or down a list (data-action, data-id, data-by -1 or 1); the first can't go up, the
// last can't go down. Kitty Achievement's side quests and Kitty Mart's categories use them.
export const moveButtons = (action: string, id: string, label: string, first: boolean, last: boolean) =>
  `<button class="btn small" type="button" data-action="${action}" data-id="${esc(id)}" data-by="-1" aria-label="Move ${esc(label)} up" ${first ? 'disabled' : ''}>${monoSvg(UI_ICONS.up)}</button>`
  + `<button class="btn small" type="button" data-action="${action}" data-id="${esc(id)}" data-by="1" aria-label="Move ${esc(label)} down" ${last ? 'disabled' : ''}>${monoSvg(UI_ICONS.down)}</button>`;
// The Filter button (with how many settings differ from the default) and a choice in its panel, a <select> that carries
// data-filter="name". Kitty Achievement's collection and the notes use them; the panel is .filter-panel / .filter-grid (page.html).
export const filterButton = (open: boolean, changed: number, action = 'toggle-filter') =>
  `<button class="btn${changed ? ' on' : ''}" type="button" data-action="${action}" aria-expanded="${open}" aria-controls="filter-panel">${monoSvg(UI_ICONS.filter)} Filter${changed ? ` (${changed})` : ''}</button>`;
export const filterSelect = (name: string, label: string, opts: [string, string][], cur: string) =>
  `<div class="field"><label for="v-${name}">${label}</label><select id="v-${name}" data-filter="${name}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;

// A list to put in order: each row's name (and picture), with its up and down buttons (see moveButtons).
export const orderList = (action: string, rows: { id: string; name: string; pic?: string; style?: string }[]) =>
  `<ul class="order-list">${rows.map((r, i) => `<li${r.style ? ` style="${r.style}"` : ''}><span class="nm">${r.pic ?? ''}${esc(r.name)}</span>
    <span class="btns">${moveButtons(action, r.id, r.name, i === 0, i === rows.length - 1)}</span></li>`).join('')}</ul>`;
// After the list is drawn again, the focus goes back to the button that was pressed (or its partner, at the end of the list).
export function refocusMove(root: ParentNode, action: string, id: string, by: string) {
  const q = (b: string) => root.querySelector<HTMLButtonElement>(`[data-action="${action}"][data-id="${CSS.escape(id)}"][data-by="${b}"]:not(:disabled)`);
  (q(by) ?? q(by === '1' ? '-1' : '1'))?.focus();
}
