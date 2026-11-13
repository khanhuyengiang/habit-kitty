// The Kitty Gallery screen: draw the app's pixel icons. Three tabs:
//   Icons    every icon of a category (stickers, card friends, button icons), by group; tap one to see it and Edit to change it, or start a new
//            one; Organise picks several and moves them to another group; Export writes your icons to a file for the repo,
//            Import reads one back
//   Draw     the drawing board at the category's fixed size, the category's colours, and a preview as the app draws it, in
//            each note colour, so you see the base colour follow the card. Select lifts a box of pixels to move, flip,
//            duplicate or delete
//   Colours  every colour of the app's palette (src/shared/palette.ts), and which letter draws it
// The rules and the export file are in ./model.ts, kept on the device by ./data.ts. Drawn with Habit Kitty's stylesheet and
// its own, in web/pixel.html.
import { FINE, UI_ICONS, fineSvg, stickerArtSvg } from '../achievement/pixelart.ts';
import { iconSvg } from '../pixelart.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { onAppShown, onShown } from '../shared/apps.ts';
import { esc, plural } from '../shared/html.ts';
import { PALETTE, PALETTE_GROUPS } from '../shared/palette.ts';
import { saveToDevice } from '../shared/backupfolder.ts';
import { homeButton, playerButton, settingsButton, showToast, titleBar } from '../shared/ui.ts';
import { COLOR } from '../notes/window.ts';
import type { NoteColor } from '../notes/model.ts';
import { initPixel, pixelData, pixelReady, setPixelData } from './data.ts';
import {
  BASE_ROWS, INK_ROWS, MORE_INKS, byHue,
  CATEGORIES, DEFAULT_GROUP, byName, LETTERS, LIMITS, USER_GROUP, blankGrid, categoryOf, cleanGroup, cleanName, dropFloat, dropIcon,
  exportName, exportText, flipGrid, floodFill, groupsOf, iconsOf, importClashes, importIcons, inRect, nameTaken, type PixelIcon, isBlank, letterName, liftArea, linePoints,
  moveIcons, newId, officialOf, putIcon, readExport, rectOf, renameGroup, shiftGrid, sizeOf, toArt, toGrid, type CategoryId, type Grid,
  type Rect, type Shown,
} from './model.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const toast = (text: string) => showToast($('pixel-toast'), text);

type Tab = 'icons' | 'draw' | 'colours';
const TABS: [Tab, string][] = [['icons', 'Icons'], ['draw', 'Draw'], ['colours', 'Colours']];
type Tool = 'pencil' | 'erase' | 'fill' | 'pick' | 'select';
const TOOLS: [Tool, string][] = [['pencil', 'Pencil'], ['erase', 'Eraser'], ['fill', 'Fill'], ['pick', 'Pick'], ['select', 'Select']];
// The drawing tools' icons: smooth line drawings (not pixel art, so they don't look like part of the picture), in the text colour.
const TOOL_ICONS: Record<Tool | 'mirror', string> = {
  pencil: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19Z"/><path d="m13.5 7 3.5 3.5"/>',
  erase: '<path d="M3 15.5 13.5 5a2 2 0 0 1 2.8 0l3.7 3.7a2 2 0 0 1 0 2.8L11.5 20h-4Z"/><path d="m8.5 10 5.5 5.5"/><path d="M11.5 20H21"/>',
  fill: '<path d="m11 3 8 8-7 7a2 2 0 0 1-2.8 0L4 12.8a2 2 0 0 1 0-2.8Z"/><path d="M4.5 11h14"/><path d="M20.5 15s2 2.6 2 4a2 2 0 0 1-4 0c0-1.4 2-4 2-4Z"/>',
  pick: '<path d="m12 6 6 6"/><path d="M13 7 5 15l-1 5 5-1 8-8"/><path d="m14 8 2.8-2.8a2 2 0 0 1 2.8 2.8L16.8 10.8"/>',
  select: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M11 4h2M11 20h2M4 11v2M20 11v2"/>',
  mirror: '<path d="M12 3v2M12 9v2M12 13v2M12 19v2"/><path d="M9 6 3 18h6Z"/><path d="m15 6 6 12h-6Z"/>',
};
const toolIcon = (t: Tool | 'mirror') => `<svg class="pix-tico" viewBox="0 0 24 24" aria-hidden="true">${TOOL_ICONS[t]}</svg>`;
const NOTE_COLORS = Object.keys(COLOR) as NoteColor[];

let tab: Tab = 'icons';
let cat: CategoryId = 'sticker';
let tool: Tool = 'pencil';
let ink = 's';
let mirror = false;
let base: NoteColor = 'pink';          // the colour the base colour is shown in
let organise = false;                  // Icons: tiles are picked to move, not opened
const picked = new Set<string>();      // the ids picked, in the shown category
let moveTo: string = USER_GROUP;       // the group they were last moved to

// The icon on the board. id null: a new one, not saved yet.
interface Draft { cat: CategoryId; id: string | null; name: string; group: string; grid: Grid; saved: string }
let draft: Draft | null = null;
let undos: Grid[] = [], redos: Grid[] = [];
const artKey = (d: Draft) => `${d.name}\n${d.group}\n${toArt(d.grid).join('')}`;
const dirty = () => !!draft && artKey(draft) !== draft.saved;

// The selection on the board. While it is lifted (float), its pixels are off the board and drawn on top at sel, so it can be
// moved over other pixels without wiping them; it is put down when you are done with it (or draw, save, undo, leave).
let sel: Rect | null = null;
let float: Grid | null = null;
const shownGrid = (): Grid => (draft && float && sel ? dropFloat(draft.grid, float, sel.x, sel.y) : draft?.grid ?? []);
function pushUndo() {
  if (!draft) return;
  undos.push(draft.grid.map((r) => r.slice())); if (undos.length > 100) undos.shift();
  redos = [];
}
function lift() {
  if (!draft || !sel || float) return;
  pushUndo();
  ({ grid: draft.grid, float } = liftArea(draft.grid, sel));
}
// Puts the selection down and forgets it; a lift that changed nothing leaves no Undo step behind.
function settle() {
  if (draft && float && sel) {
    draft.grid = dropFloat(draft.grid, float, sel.x, sel.y);
    const before = undos[undos.length - 1];
    if (before && toArt(before).join() === toArt(draft.grid).join()) undos.pop();
  }
  float = null; sel = null;
}
// Moves the selection, keeping at least one column and row of it on the board.
function moveSel(x: number, y: number) {
  if (!draft || !sel) return;
  const w = draft.grid[0].length, h = draft.grid.length;
  sel = { ...sel, x: Math.min(w - 1, Math.max(1 - sel.w, x)), y: Math.min(h - 1, Math.max(1 - sel.h, y)) };
}

// ---------- pictures ----------
// An icon as the app draws it: a sticker gets its outline and lit edges, a card friend is drawn as it is, a button icon in ink.
function pictureSvg(c: CategoryId, art: string[], big = false): string {
  if (c === 'sticker') return stickerArtSvg(art, 1, 'x2');   // a card zooms it to twice its size
  if (c === 'friend') return fineSvg(art, big ? 'x4' : 'x2');
  return monoSvg(art, big ? 'x4' : 'x2');
}
// The colour a letter is painted on the board (the base colours and the dark line follow the text colour, as outside a card).
const cellColor = (c: CategoryId, ch: string) => (ch === '.' ? '' : c === 'button' ? 'currentColor' : FINE[ch] ?? '');
const baseStyle = (c: CategoryId) => (c === 'button' ? '' : `color: ${COLOR[base][0]}`);

// ---------- the colours to draw with ----------
// Three to a row: the base colour on top (a line under it), then the rainbow, then the last colour picked with "Choose a colour".
const inkButton = (c: CategoryId, ch: string, action = 'pix-ink') => {
  const name = letterName(c, ch);
  return `<button type="button" class="pix-ink${'sld'.includes(ch) && c !== 'button' ? ' base' : ''}" role="radio" data-action="${action}" data-ink="${esc(ch)}"
    aria-checked="${ch === ink && tool !== 'erase'}" title="${esc(name)}"><i style="${baseStyle(c)}; background: ${cellColor(c, ch)}"></i><span>${esc(name)}</span></button>`;
};
const inkRows = (c: CategoryId, rows: string[]) => rows.map((r) => `<div class="pix-irow">${[...r].map((ch) => inkButton(c, ch)).join('')}</div>`).join('');
function inksHtml(c: CategoryId): string {
  if (c === 'button') return `<div class="pix-inks" role="radiogroup" aria-label="Colour">${inkRows(c, ['o'])}</div>`;
  const last = recentInks()[0];
  return `<div class="pix-inks" role="radiogroup" aria-label="Colour"><div class="pix-ibase">${inkRows(c, BASE_ROWS)}</div>${inkRows(c, INK_ROWS)}
    <div class="pix-irow">${last ? inkButton(c, last) : ''}<button type="button" class="pix-ink pix-choose" data-action="pix-more" aria-haspopup="dialog">${monoSvg(UI_ICONS.plus)}<span>Choose a colour…</span></button></div></div>`;
}
// The palette colours picked with "Choose a colour", latest first (kept on this device).
const RECENT_KEY = 'hk-pixel-recent', RECENT_MAX = 9;
function recentInks(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((ch): ch is string => typeof ch === 'string' && ch.length === 1 && MORE_INKS.includes(ch)).slice(0, RECENT_MAX) : [];
  } catch { return []; }
}
// Draws with a colour from now on (one from "Choose a colour" goes to the top of Previously used).
function useInk(ch: string) {
  ink = ch;
  if (ch.length !== 1 || !MORE_INKS.includes(ch)) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([ch, ...recentInks().filter((r) => r !== ch)].slice(0, RECENT_MAX))); } catch { /* not kept: fine */ }
}
function openInks() {
  if (!draft) return;
  const c = draft.cat, recent = recentInks();
  const grid = (label: string, chs: string[]) => `<h4 class="pix-ihead">${label}</h4>
    <div class="pix-igrid" role="radiogroup" aria-label="${label}">${chs.map((ch) => inkButton(c, ch, 'pix-ink-pick')).join('')}</div>`;
  openLayer(`<h3>Choose a colour</h3>${recent.length ? grid('Previously used', recent) : ''}${grid('All colours', byHue([...MORE_INKS]))}`, 'Choose a colour');
}

// ---------- header ----------
function renderTop() {
  $('pixel-top').innerHTML = titleBar('Kitty', 'Gallery', homeButton() + playerButton() + settingsButton())
    + `<nav class="nav" aria-label="Kitty Gallery"><div class="seg" role="tablist">${TABS.map(([t, label]) =>
      `<button type="button" role="tab" data-action="pix-tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div></nav>`;
}

function render() {
  if (!pixelReady()) { $('pixel-body').innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>'; return; }
  $('pixel-body').innerHTML = tab === 'icons' ? iconsHtml() : tab === 'draw' ? drawHtml() : coloursHtml();
  if (tab === 'draw') renderBoard();
}

const catSeg = () => `<div class="seg pix-cats" role="tablist" aria-label="Category">${CATEGORIES.map((c) =>
  `<button type="button" role="tab" data-action="pix-cat" data-cat="${c.id}" aria-selected="${c.id === cat}">${esc(c.label)}</button>`).join('')}</div>`;

// A group dropdown: the category's groups, and New group… (value '', which no group can be) which shows a field for its
// name. cur '' starts on New group.
const NEW_GROUP = '';
const groupLabel = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);
function groupPicker(id: string, label: string, groups: string[], cur: string): string {
  const all = groupsOf([...groups, DEFAULT_GROUP, USER_GROUP, ...(cur ? [cur] : [])].map((group) => ({ group })));
  return `<div class="field pix-gpick"><label for="${id}">${label}</label><select id="${id}" data-group-select>${all.map((g) =>
      `<option value="${esc(g)}" ${g === cur ? 'selected' : ''}>${esc(groupLabel(g))}</option>`).join('')}
      <option value="${NEW_GROUP}" ${cur ? '' : 'selected'}>New group…</option></select></div>
    <label class="field pix-gnew" ${cur ? 'hidden' : ''}>New group name <input id="${id}-new" maxlength="${LIMITS.group}" autocomplete="off" placeholder="Kitchen"></label>`;
}
// What a group dropdown says: a group, the new name typed for it, or '' when New group has no name yet.
function groupValue(id: string): string | null {
  const s = document.getElementById(id) as HTMLSelectElement | null;
  if (!s) return null;
  return s.value === NEW_GROUP ? (document.getElementById(`${id}-new`) as HTMLInputElement).value.trim() : s.value;
}

// =================== Icons ===================
function iconsHtml(): string {
  const c = categoryOf(cat);
  const list = iconsOf(pixelData(), cat);
  const mine = pixelData().icons.length;
  const groups = groupsOf(list);
  return `${catSeg()}
    <div class="panel pix-intro">
      <p class="muted">${esc(c.label)}s are ${c.w} × ${c.h} pixels. ${esc(c.where)}.${c.id === 'button' ? ' They take the text colour.' : ' The <b>base colour</b> takes the colour of the card or note it is on.'}</p>
      <div class="btns flow"><button class="btn primary" type="button" data-action="pix-new">${iconSvg('pencil')} New ${esc(c.label.toLowerCase())}</button>
        <button class="btn${organise ? ' on' : ''}" type="button" data-action="pix-organise" aria-pressed="${organise}">Organise groups</button></div>
      ${organise ? '<p class="muted pix-note">Tap icons to pick them, then choose a group below and move them there.</p>' : ''}
    </div>
    ${groups.map((g) => groupHtml(g, list.filter((i) => i.group === g).sort(byName))).join('')}
    ${organise ? organiseBar(groups) : ''}
    <div class="panel">
      <h3>Export</h3>
      <p class="muted">Your new icons and your changes stay in Kitty Gallery (they are not in the backup). Export puts them in one file
        to share or to make official; Import reads one back.</p>
      <p class="muted num">${mine ? `${plural(mine, 'icon')} of yours` : 'Nothing of yours yet'}.</p>
      <div class="btns flow"><button class="btn" type="button" data-action="pix-export" ${mine ? '' : 'disabled'}>Export icons</button>
        <button class="btn" type="button" data-action="pix-import">Import icons</button></div>
      <input type="file" id="pix-file" accept=".json,application/json" hidden>
    </div>`;
}

function groupHtml(group: string, list: Shown[]): string {
  const canRename = group !== DEFAULT_GROUP;
  const all = list.every((i) => picked.has(i.id));
  const btn = organise
    ? `<button class="btn small" type="button" data-action="pix-pick-group" data-group="${esc(group)}">${all ? 'Unpick all' : 'Pick all'}</button>`
    : canRename ? `<button class="btn small" type="button" data-action="pix-group-rename" data-group="${esc(group)}">${iconSvg('pencil')} Rename</button>` : '';
  return `<section class="panel pix-group" aria-label="${esc(group)}">
    <div class="pix-ghead"><h3>${esc(group)} <span class="num muted">${list.length}</span></h3>${btn}</div>
    <div class="pix-tiles" style="${baseStyle(cat)}">${list.map((i) => `<button class="pix-tile" type="button" ${organise
      ? `data-action="pix-pick" aria-pressed="${picked.has(i.id)}"` : 'data-action="pix-view"'} data-id="${esc(i.id)}" title="${esc(i.name)}">
      <span class="pix-pic">${pictureSvg(cat, i.art)}</span><span class="pix-tname">${esc(i.name)}</span>
      ${i.status === 'official' ? '' : `<span class="badge ${i.status}">${i.status === 'new' ? 'New' : 'Changed'}</span>`}</button>`).join('')}</div></section>`;
}

// Organising: the bar that stays at the bottom, with what is picked and where it goes.
function organiseBar(groups: string[]): string {
  const n = picked.size;
  return `<div class="panel pix-orgbar" role="region" aria-label="Move picked icons">
    <p class="num"><b>${n ? `${plural(n, 'icon')} picked` : 'Nothing picked yet'}</b></p>
    <div class="pix-orgrow">${groupPicker('pix-move-to', 'Move to', groups, groups.includes(moveTo) || moveTo === DEFAULT_GROUP || moveTo === USER_GROUP ? moveTo : USER_GROUP)}</div>
    <div class="btns flow"><button class="btn primary" type="button" data-action="pix-move" ${n ? '' : 'disabled'}>Move</button>
      <button class="btn" type="button" data-action="pix-unpick" ${n ? '' : 'disabled'}>Unpick</button>
      <button class="btn" type="button" data-action="pix-organise">Done</button></div></div>`;
}
async function movePicked() {
  const to = groupValue('pix-move-to');
  if (!to) { toast('Give the new group a name.'); (document.getElementById('pix-move-to-new') as HTMLInputElement | null)?.focus(); return; }
  const group = cleanGroup(to), n = picked.size;
  if (!await setPixelData(moveIcons(pixelData(), cat, [...picked], group))) { toast("Couldn't move them. Try again."); return; }
  moveTo = group; picked.clear();
  toast(`Moved ${plural(n, 'icon')} to ${groupLabel(group)}.`);
  render();
}

// =================== Draw ===================
function startDraft(c: CategoryId, id: string | null, asCopy = false) {
  const shown = id ? iconsOf(pixelData(), c).find((i) => i.id === id) : undefined;
  const [w, h] = sizeOf(c, shown && !asCopy ? shown.id : null);
  const grid = shown ? toGrid(shown.art.map((r) => r.padEnd(w, '.').slice(0, w))) : blankGrid(w, h);
  while (grid.length < h) grid.push(Array<string>(w).fill('.'));
  draft = { cat: c, id: shown ? shown.id : null, name: shown?.name ?? '', group: shown?.group ?? USER_GROUP, grid: grid.slice(0, h), saved: '' };
  draft.saved = artKey(draft);
  undos = []; redos = []; sel = null; float = null;
  cat = c;
  if (!categoryOf(c).letters.includes(ink)) ink = categoryOf(c).letters[0];
  tool = 'pencil';
}

function drawHtml(): string {
  if (!draft) return `${catSeg()}<div class="panel"><h3>Nothing on the board</h3>
    <p class="muted">Open an icon from the Icons tab to change it, or start a new one.</p>
    <div class="btns"><button class="btn primary" type="button" data-action="pix-new">${iconSvg('pencil')} New ${esc(categoryOf(cat).label.toLowerCase())}</button></div></div>`;
  const d = draft, c = categoryOf(d.cat);
  const w = d.grid[0].length, h = d.grid.length;
  const off = d.id ? officialOf(d.cat, d.id) : undefined;
  const saved = !!d.id && pixelData().icons.some((i) => i.category === d.cat && i.id === d.id);
  const title = d.id ? (off ? `Changing ${off.name}` : d.name || 'Untitled') : `New ${c.label.toLowerCase()}`;
  const groups = groupsOf(iconsOf(pixelData(), d.cat));
  const group = cleanGroup(d.group, '');
  return `<div class="panel pix-draw">
    <div class="pix-dhead"><h3>${esc(title)}</h3><span class="muted num">${w} × ${h} · ${esc(c.label)}</span></div>
    <div class="pix-tools">
      <div class="seg" role="toolbar" aria-label="Tool">${TOOLS.map(([t, label]) => `<button type="button" data-action="pix-tool" data-tool="${t}" aria-pressed="${t === tool}" aria-label="${label}" title="${label}">${toolIcon(t)}</button>`).join('')}</div>
      <div class="seg" role="toolbar" aria-label="Board"><button type="button" data-action="pix-mirror" aria-pressed="${mirror}" aria-label="Mirror" title="Mirror: draw on both halves">${toolIcon('mirror')}</button></div>
    </div>
    <div class="pix-board-wrap" style="${baseStyle(d.cat)}"><div class="pix-board" id="pix-board" data-tool="${tool}" style="--bw-cells: ${w}; --bh-cells: ${h}" role="img" aria-label="Drawing board, ${w} by ${h} pixels"></div></div>
    <div class="pix-selbar" id="pix-selbar" aria-live="polite"></div>
    <div class="pix-actions">
      <button class="btn small" type="button" data-action="pix-undo" ${undos.length ? '' : 'disabled'}>Undo</button>
      <button class="btn small" type="button" data-action="pix-redo" ${redos.length ? '' : 'disabled'}>Redo</button>
      <button class="btn small" type="button" data-action="pix-flip" title="Flip the drawing, or the selection">Flip</button>
      <button class="btn small" type="button" data-action="pix-shift" data-dx="-1" data-dy="0" aria-label="Move left">${iconSvg('prev')}</button>
      <button class="btn small" type="button" data-action="pix-shift" data-dx="1" data-dy="0" aria-label="Move right">${iconSvg('next')}</button>
      <button class="btn small pix-up" type="button" data-action="pix-shift" data-dx="0" data-dy="-1" aria-label="Move up">${iconSvg('prev')}</button>
      <button class="btn small pix-down" type="button" data-action="pix-shift" data-dx="0" data-dy="1" aria-label="Move down">${iconSvg('next')}</button>
      <button class="btn small" type="button" data-action="pix-clear">Clear</button>
    </div>
    ${inksHtml(d.cat)}
    ${d.cat === 'button' ? '' : `<p class="muted pix-note">${c.outline ? 'The dark outline and the lit and shaded edges of the base colour are added for you: draw only the inside. ' : ''}<b>Base colour</b> follows the card or note. Show it in:</p>
    <div class="seg pix-bases" role="radiogroup" aria-label="Show the base colour in">${NOTE_COLORS.map((n) =>
      `<button type="button" role="radio" data-action="pix-base" data-base="${n}" aria-checked="${n === base}"><i style="background: ${COLOR[n][0]}"></i>${COLOR[n][1]}</button>`).join('')}</div>`}
  </div>
  <div class="panel"><h3>Preview</h3><div id="pix-preview" class="pix-preview"></div></div>
  <form class="panel pix-save" id="pix-form" novalidate>
    <label class="field">Name <input id="pix-name" maxlength="${LIMITS.name}" autocomplete="off" value="${esc(d.name)}" placeholder="${esc(off?.name ?? 'Teapot')}"></label>
    ${groupPicker('pix-group', 'Group', groups, group)}
    <div class="btns flow">
      <button class="btn primary" type="submit">Save</button>
      ${d.id ? '<button class="btn" type="button" data-action="pix-copy">Save as a new icon</button>' : ''}
      ${off && saved ? '<button class="btn" type="button" data-action="pix-revert">Back to the official one</button>' : ''}
      ${!off && saved ? `<button class="btn danger" type="button" data-action="pix-delete">${iconSvg('x')} Delete</button>` : ''}
      <button class="btn" type="button" data-action="pix-close">Close</button>
    </div>
  </form>`;
}

// The board: one cell per pixel. Painting changes only the cells it touches; this redraws them all.
function renderBoard() {
  const b = document.getElementById('pix-board');
  if (!b || !draft) return;
  const d = draft, g = shownGrid(), w = g[0].length, h = g.length;
  b.innerHTML = g.map((row, y) => row.map((ch, x) => `<i data-x="${x}" data-y="${y}" style="background: ${cellColor(d.cat, ch)}"></i>`).join('')).join('')
    + (sel ? `<b class="pix-sel${float ? ' lifted' : ''}" style="left: ${(sel.x / w) * 100}%; top: ${(sel.y / h) * 100}%; width: ${(sel.w / w) * 100}%; height: ${(sel.h / h) * 100}%"></b>` : '');
  b.dataset.tool = tool;
  renderSelbar();
  renderPreview();
  syncUndoKeys();
}
// What the selection can do, under the board (only with the Select tool, or while something is selected).
function renderSelbar() {
  const el = document.getElementById('pix-selbar');
  if (!el) return;
  el.innerHTML = sel
    ? `<span class="num"><b>${sel.w} × ${sel.h}</b> selected</span><span class="muted">Drag it or use the arrows to move it.</span>
      <div class="btns flow"><button class="btn small" type="button" data-action="pix-sel-dup">Duplicate</button>
        <button class="btn small danger" type="button" data-action="pix-sel-del">${iconSvg('x')} Delete</button>
        <button class="btn small primary" type="button" data-action="pix-sel-done">Done</button></div>`
    : tool === 'select'
      ? `<span class="muted">Drag a box over the drawing to pick it up.</span>
        <div class="btns flow"><button class="btn small" type="button" data-action="pix-sel-all">Select all</button></div>`
      : '';
}
function paintCell(x: number, y: number, ch: string) {
  if (!draft) return;
  const g = draft.grid, w = g[0].length;
  const xs = mirror ? [x, w - 1 - x] : [x];
  for (const xx of xs) {
    if (g[y]?.[xx] === undefined || g[y][xx] === ch) continue;
    g[y][xx] = ch;
    const el = document.querySelector<HTMLElement>(`#pix-board > i[data-x="${xx}"][data-y="${y}"]`);
    if (el) el.style.background = cellColor(draft.cat, ch);
  }
}
function renderPreview() {
  const el = document.getElementById('pix-preview');
  if (!el || !draft) return;
  const art = toArt(shownGrid()), c = draft.cat;
  if (c === 'button') {
    el.innerHTML = `<div class="pix-prow"><span class="pix-pbig">${pictureSvg(c, art, true)}</span>
      <span class="btn small" aria-hidden="true">${monoSvg(art)} Button</span><span class="gear" aria-hidden="true">${monoSvg(art)}</span></div>`;
    return;
  }
  // big: as a card's picture (a sticker zoomed to twice its size there), drawn twice as big again here; small: its real size
  const big = c === 'sticker' ? stickerArtSvg(art, 1, 'x4') : pictureSvg(c, art, true);
  const small = c === 'sticker' ? stickerArtSvg(art, 1) : fineSvg(art);
  el.innerHTML = `<div class="pix-prow" style="${baseStyle(c)}"><span class="pix-pbig">${big}<span>${c === 'sticker' ? 'On a card (zoomed in)' : 'Zoomed in'}</span></span>
      <span class="pix-psmall">${small}<span>Real size</span></span></div>
    <p class="muted">On each note colour (the base colour changes with it):</p>
    <div class="pix-prow pix-swatches">${NOTE_COLORS.map((n) => `<span class="pix-on" style="--nc: ${COLOR[n][0]}; color: ${COLOR[n][0]}" title="${COLOR[n][1]}">${pictureSvg(c, art)}</span>`).join('')}</div>`;
}
function syncUndoKeys() {
  const u = document.querySelector<HTMLButtonElement>('[data-action="pix-undo"]'), r = document.querySelector<HTMLButtonElement>('[data-action="pix-redo"]');
  if (u) u.disabled = !undos.length;
  if (r) r.disabled = !redos.length;
}

// A change to the whole board, with Undo.
function edit(fn: (g: Grid) => Grid) {
  if (!draft) return;
  settle();
  const next = fn(draft.grid);
  if (next === draft.grid) return;
  undos.push(draft.grid.map((r) => r.slice())); if (undos.length > 100) undos.shift();
  redos = [];
  draft.grid = next;
  renderBoard();
}
function step(from: Grid[], to: Grid[]) {
  settle();
  if (!draft || !from.length) { renderBoard(); return; }
  to.push(draft.grid);
  draft.grid = from.pop()!;
  renderBoard();
}

// ---- drawing with the finger or the mouse ----
let stroke: { last: [number, number]; ch: string; id: number } | null = null;
// A drag of the Select tool: a box being drawn from a corner, or the selection being moved.
let drag: { mode: 'box'; anchor: [number, number]; id: number } | { mode: 'move'; start: [number, number]; orig: [number, number]; id: number } | null = null;
// The cell under the pointer, even off the board (a selection can be dragged partly off it).
function rawCell(ev: PointerEvent): [number, number] | null {
  const b = document.getElementById('pix-board');
  if (!b || !draft) return null;
  const r = b.getBoundingClientRect(), w = draft.grid[0].length, h = draft.grid.length;
  return [Math.floor(((ev.clientX - r.left) / r.width) * w), Math.floor(((ev.clientY - r.top) / r.height) * h)];
}
function cellAt(ev: PointerEvent): [number, number] | null {
  const at = rawCell(ev);
  if (!at || !draft) return null;
  const [x, y] = at;
  return x >= 0 && y >= 0 && x < draft.grid[0].length && y < draft.grid.length ? at : null;
}
function selectDown(ev: PointerEvent, board: HTMLElement, at: [number, number]) {
  if (!draft) return;
  if (sel && inRect(sel, at[0], at[1])) {
    lift();
    drag = { mode: 'move', start: at, orig: [sel.x, sel.y], id: ev.pointerId };
  } else {
    settle();
    sel = rectOf(at, at, draft.grid[0].length, draft.grid.length);
    drag = { mode: 'box', anchor: at, id: ev.pointerId };
  }
  try { board.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  renderBoard();
}
onShown('pixel', 'pointerdown', (ev) => {
  const board = (ev.target as Element).closest?.('#pix-board');
  if (!board || !draft || ev.button > 0 && ev.button !== 2) return;
  const at = cellAt(ev);
  if (!at) return;
  ev.preventDefault();
  const [x, y] = at;
  const t: Tool = ev.button === 2 ? 'erase' : tool;
  if (t === 'select') { selectDown(ev, board as HTMLElement, at); return; }
  if (sel) { settle(); renderBoard(); }
  if (t === 'pick') {
    const ch = draft.grid[y][x];
    if (ch !== '.') { useInk(ch); tool = 'pencil'; render(); }
    return;
  }
  const ch = t === 'erase' ? '.' : ink;
  if (t === 'fill') { edit((g) => floodFill(g, x, y, ch)); return; }
  pushUndo();
  try { (board as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  stroke = { last: at, ch, id: ev.pointerId };
  paintCell(x, y, ch);
  renderPreview(); syncUndoKeys();
});
onShown('pixel', 'pointermove', (ev) => {
  if (drag && sel && draft && ev.pointerId === drag.id) {
    const at = rawCell(ev);
    if (!at) return;
    const before = `${sel.x},${sel.y},${sel.w},${sel.h}`;
    if (drag.mode === 'box') sel = rectOf(drag.anchor, at, draft.grid[0].length, draft.grid.length);
    else moveSel(drag.orig[0] + at[0] - drag.start[0], drag.orig[1] + at[1] - drag.start[1]);
    if (`${sel.x},${sel.y},${sel.w},${sel.h}` !== before) renderBoard();
    return;
  }
  if (!stroke || ev.pointerId !== stroke.id) return;
  const at = cellAt(ev);
  if (!at || (at[0] === stroke.last[0] && at[1] === stroke.last[1])) return;
  for (const [x, y] of linePoints(stroke.last, at)) paintCell(x, y, stroke.ch);
  stroke.last = at;
  renderPreview();
});
const endStroke = (ev: PointerEvent) => {
  if (drag && ev.pointerId === drag.id) {
    // a tap without a drag on an empty pixel lets go of the selection
    if (drag.mode === 'box' && sel && sel.w === 1 && sel.h === 1 && shownGrid()[sel.y]?.[sel.x] === '.') sel = null;
    drag = null;
    renderBoard();
  }
  if (stroke) { stroke = null; renderPreview(); }
};
onShown('pixel', 'pointerup', endStroke);
onShown('pixel', 'pointercancel', endStroke);
onShown('pixel', 'contextmenu', (ev) => { if ((ev.target as Element).closest?.('#pix-board')) ev.preventDefault(); });

// ---- saving ----
function readFields() {
  if (!draft) return;
  const n = document.getElementById('pix-name') as HTMLInputElement | null, g = groupValue('pix-group');
  if (n) draft.name = n.value;
  if (g !== null) draft.group = g;
}
async function save(asNew: boolean) {
  if (!draft) return;
  readFields();
  settle();
  const d = draft, art = toArt(d.grid);
  if (isBlank(art)) { toast('Draw something first.'); return; }
  const off = d.id && !asNew ? officialOf(d.cat, d.id) : undefined;
  const name = cleanName(d.name, off?.name ?? 'Untitled');
  let group = cleanGroup(d.group, off?.group ?? USER_GROUP);
  if (asNew) {
    // a copy is a new icon: it goes in "user" rather than "default", and has a new icon's size
    if (group === DEFAULT_GROUP) group = USER_GROUP;
    const [w, h] = sizeOf(d.cat, null);
    if (d.grid[0].length !== w || d.grid.length !== h) { toast(`A new ${categoryOf(d.cat).label.toLowerCase()} is ${w} × ${h}, so this one can't be copied. Start a new one instead.`); return; }
  }
  const other = nameTaken(pixelData(), d.cat, name, asNew ? null : d.id);
  if (other) {
    toast(`There's already an icon called ${other.name}. Give this one another name.`);
    document.getElementById('pix-name')?.focus();
    return;
  }
  const id = !asNew && d.id ? d.id : newId(name, d.cat, pixelData());
  const ok = await setPixelData(putIcon(pixelData(), { category: d.cat, id, name, group, art }));
  if (!ok) { toast("Couldn't save. Try again."); return; }
  d.id = id; d.name = name; d.group = group; d.saved = artKey(d);
  toast(asNew ? `Saved as ${name}.` : `Saved ${name}.`);
  render();
}

// ---- export and import ----
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
async function exportIcons() {
  if (!pixelData().icons.length) { toast('Nothing to export yet.'); return; }
  const day = today();
  try {
    const where = await saveToDevice(exportName(day), new TextEncoder().encode(exportText(pixelData(), day)));
    if (where !== null) toast(where ? `Exported: ${where}` : 'Icons downloaded.');
  } catch { toast("Couldn't export the icons."); }
}
// Asks first when the file would replace icons you have changed or drawn yourself.
let importing: Omit<PixelIcon, 'updated'>[] | null = null;
async function importFile(file: File | undefined) {
  if (!file) return;
  let icons: Omit<PixelIcon, 'updated'>[];
  try { icons = readExport(await file.text()); } catch (e) { toast(String((e as Error).message || "Couldn't read that file.")); return; }
  const clashes = importClashes(pixelData(), icons);
  if (!clashes.length) { finishImport(icons, 'replace'); return; }
  importing = icons;
  const names = clashes.map((i) => `<li>${esc(iconsOf(pixelData(), i.category).find((s) => s.id === i.id)?.name ?? i.name)}
    <span class="muted">(${esc(categoryOf(i.category).label.toLowerCase())})</span></li>`).join('');
  openLayer(`<h3>Replace your icons?</h3>
    <p class="muted">${clashes.length === 1 ? 'This icon is' : `These ${clashes.length} icons are`} different on this device. Importing
      replaces your version with the one in the file:</p><ul>${names}</ul>
    <p class="muted">Keep both adds the file's as a new icon beside yours.</p>
    <div class="btns flow"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn" type="button" data-action="pix-import-keep">Keep both</button>
    <button class="btn danger" type="button" data-action="pix-import-replace">Replace</button></div>`, 'Replace your icons?');
}
async function finishImport(icons: Omit<PixelIcon, 'updated'>[], mode: 'replace' | 'keep') {
  importing = null;
  closeLayer();
  const ok = await setPixelData(importIcons(pixelData(), icons, mode));
  toast(ok ? `Imported ${plural(icons.length, 'icon')}.` : "Couldn't save the imported icons.");
  render();
}

// ---- a small dialog ----
function openLayer(html: string, label: string) {
  closeLayer();
  const el = document.createElement('div');
  el.id = 'pix-layer'; el.className = 'scrim layer'; el.dataset.action = 'pix-layer-close';
  el.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    <button class="x-close" type="button" data-action="pix-layer-close" aria-label="Close">${iconSvg('x')}</button>${html}</div>`;
  $('pixel-layer-host').appendChild(el);
  el.querySelector<HTMLElement>('input, [data-focus]')?.focus();
}
const closeLayer = () => document.getElementById('pix-layer')?.remove();

// Asks first when the board has changes that would be lost.
let afterDiscard: (() => void) | null = null;
function unlessDirty(then: () => void) {
  readFields();
  settle();
  if (!dirty()) { then(); return; }
  afterDiscard = then;
  openLayer(`<h3>Leave this drawing?</h3><p class="muted">${esc(draft!.name || 'It')} has changes that aren't saved.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Keep drawing</button>
    <button class="btn danger" type="button" data-action="pix-discard">Discard changes</button></div>`, 'Unsaved changes');
}

// Tapping an icon shows it; Edit puts it on the board.
function openView(id: string) {
  const i = iconsOf(pixelData(), cat).find((s) => s.id === id);
  if (!i) return;
  openLayer(`<h3>${esc(i.name)}</h3>
    <p class="muted">${esc(groupLabel(i.group))}${i.status === 'official' ? '' : ` · <span class="badge ${i.status}">${i.status === 'new' ? 'New' : 'Changed'}</span>`}</p>
    <div class="pix-preview pix-view" style="${baseStyle(cat)}"><div class="pix-prow"><span class="pix-pbig">${pictureSvg(cat, i.art, true)}</span></div></div>
    <div class="btns flow"><button class="btn" type="button" data-action="pix-layer-close">Close</button>
    <button class="btn primary" type="button" data-action="pix-open" data-id="${esc(i.id)}" data-focus>${iconSvg('pencil')} Edit</button></div>`, i.name);
}

function openGroupRename(group: string) {
  openLayer(`<h3>Rename ${esc(group)}</h3><form class="stack" id="pix-group-form" data-group="${esc(group)}">
    <label class="field">New name <input id="pix-group-new" maxlength="${LIMITS.group}" autocomplete="off" value="${esc(group)}"></label>
    <p class="muted">Every ${esc(categoryOf(cat).label.toLowerCase())} in it moves to the new group.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close">Cancel</button><button class="btn primary" type="submit">Rename</button></div></form>`, `Rename ${group}`);
}

// =================== Colours ===================
function coloursHtml(): string {
  const letterOf = new Map(Object.entries(LETTERS).filter(([, v]) => v.palette).map(([k, v]) => [v.palette!, k]));
  return `<div class="panel"><h3>Base colours</h3>
      <p class="muted">The base colour (<b>s</b>) in a sticker or card friend is not one colour: it is the colour of the note, card or category the
        icon sits on. These are the note colours.</p>
      <ul class="pix-colours">${NOTE_COLORS.map((n) => `<li><i style="background: ${COLOR[n][0]}"></i><b>${COLOR[n][1]}</b><span class="muted num">${COLOR[n][0]}</span></li>`).join('')}</ul></div>
    ${PALETTE_GROUPS.map(([name, keys]) => `<div class="panel"><h3>${esc(name)} <span class="num muted">${keys.length}</span></h3>
      <ul class="pix-colours">${keys.map((k) => { const letter = letterOf.get(k); return `<li><i style="background: ${PALETTE[k]}"></i><b>${esc(k)}</b>
        <span class="muted num">${PALETTE[k]}</span>${letter ? `<span class="badge" title="Draw it with ${letter}">${esc(LETTERS[letter].name)} · ${letter}</span>` : ''}</li>`; }).join('')}</ul></div>`).join('')}
    <p class="muted pix-foot">Every colour in the app is one of these ${Object.keys(PALETTE).length}. Each can be drawn in Kitty Gallery, with the sign on its badge.</p>`;
}

// ---------- events ----------
onShown('pixel', 'click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!b || b.hasAttribute('disabled')) return;
  switch (b.dataset.action) {
    case 'pix-tab': readFields(); settle(); tab = b.dataset.tab as Tab; renderTop(); render(); break;
    case 'pix-cat': cat = b.dataset.cat as CategoryId; picked.clear(); render(); break;
    case 'pix-organise': organise = !organise; picked.clear(); render(); break;
    case 'pix-pick': { const id = b.dataset.id!; if (!picked.delete(id)) picked.add(id); render(); break; }
    case 'pix-pick-group': {
      const ids = iconsOf(pixelData(), cat).filter((i) => i.group === b.dataset.group).map((i) => i.id);
      if (ids.every((id) => picked.has(id))) ids.forEach((id) => picked.delete(id)); else ids.forEach((id) => picked.add(id));
      render(); break;
    }
    case 'pix-unpick': picked.clear(); render(); break;
    case 'pix-move': movePicked(); break;
    case 'pix-new': unlessDirty(() => { startDraft(cat, null); tab = 'draw'; renderTop(); render(); }); break;
    case 'pix-view': openView(b.dataset.id!); break;
    case 'pix-open': { const id = b.dataset.id!; closeLayer(); unlessDirty(() => { startDraft(cat, id); tab = 'draw'; renderTop(); render(); window.scrollTo(0, 0); }); break; }
    case 'pix-close': unlessDirty(() => { draft = null; tab = 'icons'; renderTop(); render(); }); break;
    case 'pix-tool': tool = b.dataset.tool as Tool; readFields(); if (tool !== 'select') settle(); render(); break;
    case 'pix-mirror': mirror = !mirror; readFields(); render(); break;
    case 'pix-ink': useInk(b.dataset.ink!); if (tool !== 'fill') { tool = 'pencil'; settle(); } readFields(); render(); break;
    case 'pix-ink-pick': useInk(b.dataset.ink!); closeLayer(); if (tool !== 'fill') { tool = 'pencil'; settle(); } readFields(); render(); break;
    case 'pix-more': readFields(); openInks(); break;
    case 'pix-base': base = b.dataset.base as NoteColor; readFields(); render(); break;
    case 'pix-undo': step(undos, redos); break;
    case 'pix-redo': step(redos, undos); break;
    case 'pix-flip': if (sel) { lift(); float = flipGrid(float!); renderBoard(); } else edit(flipGrid); break;
    case 'pix-shift': if (sel) nudge(Number(b.dataset.dx), Number(b.dataset.dy)); else edit((g) => shiftGrid(g, Number(b.dataset.dx), Number(b.dataset.dy))); break;
    case 'pix-sel-all': if (draft) { settle(); sel = { x: 0, y: 0, w: draft.grid[0].length, h: draft.grid.length }; tool = 'select'; readFields(); render(); } break;
    case 'pix-sel-dup': duplicate(); break;
    case 'pix-sel-del': deleteSel(); break;
    case 'pix-sel-done': settle(); renderBoard(); break;
    case 'pix-clear': edit((g) => (g.every((r) => r.every((c) => c === '.')) ? g : blankGrid(g[0].length, g.length))); break;
    case 'pix-copy': save(true); break;
    case 'pix-revert': revert(); break;
    case 'pix-delete': remove(); break;
    case 'pix-export': exportIcons(); break;
    case 'pix-import': document.getElementById('pix-file')?.click(); break;
    case 'pix-import-replace': if (importing) finishImport(importing, 'replace'); break;
    case 'pix-import-keep': if (importing) finishImport(importing, 'keep'); break;
    case 'pix-group-rename': openGroupRename(b.dataset.group!); break;
    case 'pix-discard': { const then = afterDiscard; afterDiscard = null; closeLayer(); then?.(); break; }
    case 'pix-layer-close': if (b.id === 'pix-layer' && ev.target !== b) break; afterDiscard = null; importing = null; closeLayer(); break;
  }
});

// ---- the selection's buttons ----
function nudge(dx: number, dy: number) {
  if (!sel) return;
  lift(); moveSel(sel.x + dx, sel.y + dy); renderBoard();
}
// Leaves a copy where the selection is, and lifts another a pixel down and right (or up and left at the edge) to move.
function duplicate() {
  if (!draft || !sel) return;
  if (float) draft.grid = dropFloat(draft.grid, float, sel.x, sel.y);
  else { pushUndo(); float = liftArea(draft.grid, sel).float; }
  const w = draft.grid[0].length, h = draft.grid.length;
  const dx = sel.x + sel.w < w ? 1 : sel.x > 0 ? -1 : 0, dy = sel.y + sel.h < h ? 1 : sel.y > 0 ? -1 : 0;
  moveSel(sel.x + dx, sel.y + dy);
  renderBoard();
}
function deleteSel() {
  if (!draft || !sel) return;
  lift(); float = null; sel = null;
  renderBoard();
}

async function revert() {
  if (!draft?.id) return;
  const id = draft.id, c = draft.cat;
  if (!await setPixelData(dropIcon(pixelData(), c, id))) { toast("Couldn't change it back."); return; }
  startDraft(c, id);
  toast(`${officialOf(c, id)?.name ?? 'It'} is back as it was.`);
  render();
}
async function remove() {
  if (!draft?.id) return;
  const name = draft.name || 'The icon';
  if (!await setPixelData(dropIcon(pixelData(), draft.cat, draft.id))) { toast("Couldn't delete it."); return; }
  draft = null; tab = 'icons';
  toast(`Deleted ${name}.`);
  renderTop(); render();
}

onShown('pixel', 'submit', async (ev) => {
  const f = ev.target as HTMLFormElement;
  if (f.id === 'pix-form') { ev.preventDefault(); save(false); }
  if (f.id === 'pix-group-form') {
    ev.preventDefault();
    const from = f.dataset.group!, to = (document.getElementById('pix-group-new') as HTMLInputElement).value;
    const ok = await setPixelData(renameGroup(pixelData(), cat, from, to));
    closeLayer();
    toast(ok ? `Moved ${from} to ${cleanGroup(to, from)}.` : "Couldn't rename the group.");
    render();
  }
});
onShown('pixel', 'change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'pix-file') { importFile(t.files?.[0]); t.value = ''; }
  if (t.matches('[data-group-select]')) {
    // New group… shows the field for its name
    const name = document.getElementById(`${t.id}-new`) as HTMLInputElement | null, box = name?.closest('label');
    if (!name || !box) return;
    box.hidden = t.value !== NEW_GROUP;
    if (!box.hidden) name.focus();
  }
});
onShown('pixel', 'keydown', (ev) => {
  if (tab !== 'draw' || !draft || (ev.target as HTMLElement).closest?.('input, textarea, select')) return;
  if (sel && ev.key.startsWith('Arrow') && !ev.ctrlKey && !ev.metaKey) {
    ev.preventDefault();
    nudge(ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0, ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0);
    return;
  }
  if (sel && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); deleteSel(); return; }
  if (sel && (ev.key === 'Escape' || ev.key === 'Enter')) { ev.preventDefault(); settle(); renderBoard(); return; }
  if (!(ev.ctrlKey || ev.metaKey) || ev.key.toLowerCase() !== 'z') return;
  ev.preventDefault();
  if (ev.shiftKey) step(redos, undos); else step(undos, redos);
});

onAppShown('pixel', () => { renderTop(); render(); });
renderTop();
render();
initPixel().then(render);
