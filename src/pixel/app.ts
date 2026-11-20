// The Kitty Gallery screen: draw the app's pixel icons. Three tabs:
//   Icons    every icon of a category (stickers, card friends, button icons, the diary's weather...), by group; tap one to see it and Edit to change it, or start a new
//            one; Organise picks several to move to another group, delete, or (stickers) make cat food or not; Export writes your icons to a file for the repo,
//            Import reads one back
//   Draw     the drawing board at the category's fixed size, the category's colours, and a preview as the app draws it, in
//            each note colour, so you see the base colour follow the card. Select lifts a box of pixels to move, flip,
//            duplicate or delete
//   Colours  every colour of the app's palette (src/shared/palette.ts), and which letter draws it
// The rules and the export file are in ./model.ts, kept on the device by ./data.ts. Drawn with Habit Kitty's stylesheet and
// its own, in web/pixel.html.
import { FINE, UI_ICONS, fineSvg, stickerArtSvg } from '../shared/stickers.ts';
import { iconSvg } from '../shared/art.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { onAppShown, onShown } from '../shared/apps.ts';
import { $, esc, plural } from '../shared/html.ts';
import { localDateKey } from '../shared/dates.ts';
import { makeLayer } from '../shared/layer.ts';
import { readJson, writeJson } from '../shared/local.ts';
import { PALETTE, PALETTE_GROUPS } from '../shared/palette.ts';
import { saveToDevice } from '../shared/backupfolder.ts';
import { closeX, homeButton, playerButton, settingsButton, showToast, titleBar } from '../shared/ui.ts';
import { COLOR } from '../notes/window.ts';
import type { NoteColor } from '../notes/model.ts';
import { initPixel, pixelData, pixelReady, setPixelData } from './data.ts';
import { scenePng } from './live.ts';
import { BOOK_ART, TROPHY_ART, ROOM_H, ROOM_W, type Spot } from '../shared/scene.ts';
import { PAL, artSvg } from '../shared/pixelart.ts';
import { FURS, bodySvg } from '../shared/pixelcat.ts';
import {
  BASE_ROWS, INK_ROWS, ALL_INKS, byHue,
  CATEGORIES, DEFAULT_GROUP, byName, LETTERS, LIMITS, USER_GROUP, blankGrid, categoryOf, cleanGroup, cleanName, dropCount, dropFloat, dropIcon, dropIcons,
  exportName, exportText, flipGrid, floodFill, groupsOf, iconsOf, liveIcons, canDeleteOfficial, deleteOfficial, restoreIcon, importClashes, importIcons, inRect, nameTaken, type PixelIcon, isBlank, letterName, liftArea, linePoints,
  moveIcons, newId, officialOf, putIcon, readExport, rectOf, renameGroup, setFood, shiftGrid, sizeOf, FREE_MAX, freeSize, resizeGrid, toArt, toGrid, type CategoryId, type Grid,
  DEFAULT_FPS, FPS_CHOICES, MAX_FRAMES, MAX_STEPS, cleanSequence, playOrder, newFrameId, shiftArt, trackShifts, nextFrameName, pingPong, removeFrame,
  type Rect, type Shown, CAT_SIZE, isFixed, MAX_SPOTS, SCENE_INKS, clampProp, clampSpot, sceneColors, type Props,
} from './model.ts';

const toast = (text: string) => showToast($('pixel-toast'), text);

type Tab = 'icons' | 'draw' | 'colours';
const TABS: [Tab, string][] = [['icons', 'Icons'], ['draw', 'Draw'], ['colours', 'Colours']];
type Tool = 'pencil' | 'erase' | 'fill' | 'pick' | 'select' | 'pan' | 'track';
const TOOLS: [Tool, string][] = [['pencil', 'Pencil'], ['erase', 'Eraser'], ['fill', 'Fill'], ['pick', 'Pick'], ['select', 'Select']];
// Every board can be zoomed in (a scene is too big to see whole anyway), so every board has a tool to move around it too.
const ALL_TOOLS: [Tool, string][] = [...TOOLS, ['pan', 'Move around']];
const TRACK_TOOL: [Tool, string] = ['track', 'Point of tracking'];
const ZOOMS = [1, 2, 4, 8];
// The drawing tools' icons: smooth line drawings (not pixel art, so they don't look like part of the picture), in the text colour.
const TOOL_ICONS: Record<Tool | 'mirror', string> = {
  track: '<circle cx="12" cy="12" r="4"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  pan: '<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
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

// The icon on the board. id null: a new one, not saved yet. A scene also has its kitty spots and (the room) its props.
// A kitty can be an animation: frames (each its own named grid; `grid` below is the one being drawn on, the frame at `cur`)
// and a sequence of frame ids that plays them (see Frame in ./model.ts).
interface DraftFrame { id: string; name: string; grid: Grid; pin?: [number, number] }
interface Draft { cat: CategoryId; id: string | null; name: string; group: string; grid: Grid; saved: string; spots?: Spot[]; props?: Props; food?: boolean;
  frames?: DraftFrame[]; cur?: number; sequence?: string[]; fps?: number }
let draft: Draft | null = null;
let undos: Grid[] = [], redos: Grid[] = [];
const artKey = (d: Draft) => `${d.name}\n${d.group}\n${toArt(d.grid).join('')}\n${JSON.stringify(d.spots ?? null)}${JSON.stringify(d.props ?? null)}${d.food ? '\nfood' : ''}`
  + (d.frames ? `\n${JSON.stringify(d.frames.map((f, i) => [f.id, f.name, toArt(i === d.cur ? d.grid : f.grid).join(''), f.pin ?? null]))}${JSON.stringify([d.sequence, d.fps])}` : '');
let stepSel: number | null = null;   // the step picked in the sequence
// A scene: how far it is zoomed in, and whether the board draws or places the kitty spots (and which one is picked).
let zoom = 1;
let sceneMode: 'draw' | 'spots' = 'draw';
type SpotKey = number | 'book' | 'trophy';
let pickedSpot: SpotKey | null = null;
const isScene = () => draft?.cat === 'scene';
const undoMax = () => (isScene() ? 30 : 100);   // a scene's grid is big
const dirty = () => !!draft && artKey(draft) !== draft.saved;

// The selection on the board. While it is lifted (float), its pixels are off the board and drawn on top at sel, so it can be
// moved over other pixels without wiping them; it is put down when you are done with it (or draw, save, undo, leave).
let sel: Rect | null = null;
let float: Grid | null = null;
const shownGrid = (): Grid => (draft && float && sel ? dropFloat(draft.grid, float, sel.x, sel.y) : draft?.grid ?? []);
function pushUndo() {
  if (!draft) return;
  undos.push(draft.grid.map((r) => r.slice())); if (undos.length > undoMax()) undos.shift();
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
// An icon as the app draws it: a sticker gets its lit and shaded edges, a card friend and a decoration are drawn as they are,
// a button icon in ink.
function pictureSvg(c: CategoryId, art: string[], big = false): string {
  if (c === 'scene') return `<img class="pix-scene${big ? ' big' : ''}" src="${scenePng(art, sceneColors()) ?? ''}" alt="">`;
  if (c === 'sticker') return stickerArtSvg(art, 1, 'x2');   // a card zooms it to twice its size
  if (c === 'friend' || c === 'deco' || c === 'weather' || c === 'kitty') return fineSvg(art, big ? 'x4' : 'x2');
  return monoSvg(art, big ? 'x4' : 'x2');
}
// The colour a letter is painted on the board (the base colours and the dark line follow the text colour, as outside a card).
const cellColor = (c: CategoryId, ch: string) => (ch === '.' ? '' : c === 'button' ? 'currentColor' : c === 'scene' ? SCENE_HEX[ch] ?? '' : FINE[ch] ?? '');
const SCENE_HEX = sceneColors();
const baseStyle = (c: CategoryId) => (c === 'button' ? '' : `color: ${COLOR[base][0]}`);

// ---------- the colours to draw with ----------
// Three to a row: the base colour on top (a line under it), then the rainbow, then the last colour picked with "Choose a colour".
const inkButton = (c: CategoryId, ch: string, action = 'pix-ink') => {
  const name = letterName(c, ch);
  return `<button type="button" class="pix-ink${'sld'.includes(ch) && c !== 'button' ? ' base' : ''}" role="radio" data-action="${action}" data-ink="${esc(ch)}"
    aria-checked="${ch === ink && tool !== 'erase'}" title="${esc(name)}"><i style="${baseStyle(c)}; background: ${cellColor(c, ch)}"></i><span>${esc(name)}</span></button>`;
};
// Only the category's letters (a decoration has no base colour); a row left empty is not shown.
const inkRows = (c: CategoryId, rows: string[]) => rows.map((r) => [...r].filter((ch) => categoryOf(c).letters.includes(ch)))
  .filter((r) => r.length).map((r) => `<div class="pix-irow">${r.map((ch) => inkButton(c, ch)).join('')}</div>`).join('');
// Empty is a colour too: drawn or filled with, it clears cells (the Fill tool can empty a whole area).
const emptyInk = () => `<div class="pix-irow"><button type="button" class="pix-ink" role="radio" data-action="pix-ink" data-ink="." aria-checked="${ink === '.' && tool !== 'erase'}" title="Empty"><i class="pix-empty"></i><span>Empty</span></button></div>`;
function inksHtml(c: CategoryId): string {
  if (c === 'button') return `<div class="pix-inks" role="radiogroup" aria-label="Colour">${inkRows(c, ['o'])}${emptyInk()}</div>`;
  const last = recentInks()[0];
  return `<div class="pix-inks" role="radiogroup" aria-label="Colour"><div class="pix-ibase">${inkRows(c, BASE_ROWS)}</div>${emptyInk()}${inkRows(c, INK_ROWS)}
    <div class="pix-irow">${last ? inkButton(c, last) : ''}<button type="button" class="pix-ink pix-choose" data-action="pix-more" aria-haspopup="dialog">${monoSvg(UI_ICONS.plus)}<span>Choose a colour…</span></button></div></div>`;
}
// The palette colours picked with "Choose a colour", latest first (kept on this device).
const RECENT_KEY = 'hk-pixel-recent', RECENT_MAX = 9;
function recentInks(): string[] {
  const v = readJson(RECENT_KEY);
  return Array.isArray(v) ? v.filter((ch): ch is string => typeof ch === 'string' && ch.length === 1 && ALL_INKS.includes(ch)).slice(0, RECENT_MAX) : [];
}
// Draws with a colour from now on (one from "Choose a colour" goes to the top of Previously used).
function useInk(ch: string) {
  ink = ch;
  if (ch.length !== 1 || !ALL_INKS.includes(ch)) return;
  writeJson(RECENT_KEY, [ch, ...recentInks().filter((r) => r !== ch)].slice(0, RECENT_MAX));   // not kept: fine
}
function openInks() {
  if (!draft) return;
  const c = draft.cat, recent = recentInks();
  const grid = (label: string, chs: string[]) => `<h4 class="pix-ihead">${label}</h4>
    <div class="pix-igrid" role="radiogroup" aria-label="${label}">${chs.map((ch) => inkButton(c, ch, 'pix-ink-pick')).join('')}</div>`;
  openLayer(`<h3>Choose a colour</h3>${recent.length ? grid('Previously used', recent) : ''}${grid('All colours', byHue([...ALL_INKS]))}`, 'Choose a colour');
}

// ---------- header ----------
function renderTop() {
  $('pixel-top').innerHTML = titleBar('Kitty', 'Gallery', homeButton() + playerButton() + settingsButton())
    + `<nav class="nav" aria-label="Kitty Gallery"><div class="seg" role="tablist">${TABS.map(([t, label]) =>
      `<button type="button" role="tab" data-action="pix-tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div></nav>`;
}

function render() {
  if (!pixelReady()) { $('pixel-body').innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>'; return; }
  // Every redraw (choosing a tool or a colour, Undo...) makes a new board box; keep a zoomed-in board where it was scrolled to.
  const old = tab === 'draw' ? document.getElementById('pix-board-wrap') : null;
  const at = old && zoom > 1 ? { left: old.scrollLeft, top: old.scrollTop } : null;
  $('pixel-body').innerHTML = tab === 'icons' ? iconsHtml() : tab === 'draw' ? drawHtml() : coloursHtml();
  if (tab === 'draw') renderBoard();
  const wrap = at && document.getElementById('pix-board-wrap');
  if (wrap && at) { wrap.scrollLeft = at.left; wrap.scrollTop = at.top; }
  restartAnim();
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
  const list = liveIcons(pixelData(), cat);
  const gone = iconsOf(pixelData(), cat).filter((i) => i.status === 'deleted').sort(byName);
  const mine = pixelData().icons.length;
  const groups = groupsOf(list);
  return `${catSeg()}
    <div class="panel pix-intro">
      <p class="muted">${c.free ? `Kitties can be any size up to ${FREE_MAX} × ${FREE_MAX} pixels: a new one starts at ${c.w} × ${c.h}, and the board can be resized while you draw.`
        : `${c.id === 'weather' ? 'Weather pictures' : `${esc(c.label)}s`} are ${c.w} × ${c.h} pixels.`} ${esc(c.where)}.${c.id === 'button' ? ' They take the text colour.' : c.base ? ` The <b>base colour</b> takes the colour of ${esc(c.base)}.` : ''}</p>
      ${c.id === 'scene' ? `<p class="muted">Draw on them, or turn a photo into one, and choose where the kitties can sit.</p>`
        : isFixed(c.id) ? ''
        : `<div class="btns flow"><button class="btn primary" type="button" data-action="pix-new">${iconSvg('pencil')} New ${esc(c.label.toLowerCase())}</button>
        <button class="btn${organise ? ' on' : ''}" type="button" data-action="pix-organise" aria-pressed="${organise}">Organise</button></div>`}
      ${organise ? `<p class="muted pix-note">Tap icons to pick them, then move them to another group${cat === 'sticker' ? ', make them cat food or not,' : ''} or delete them below.</p>` : ''}
    </div>
    ${groups.map((g) => groupHtml(g, list.filter((i) => i.group === g).sort(byName))).join('')}
    ${gone.length ? goneHtml(gone) : ''}
    ${organise ? organiseBar(groups) : ''}
    <div class="panel">
      <h3>Export</h3>
      <p class="muted">Your new icons, your changes and the official ones you deleted are in the backup, and in the settings file (Settings → Backup → Settings only),
        which gives someone your icons without your diary. Export puts just your icons in one file to make them official; Import reads one back.</p>
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
      ${i.status === 'official' ? '' : `<span class="badge ${i.status}">${i.status === 'new' ? 'New' : 'Changed'}</span>`}
      ${i.frames && i.frames.length > 1 ? `<span class="badge">${i.frames.length} frames</span>` : ''}
      ${organise && i.food ? '<span class="badge">Food</span>' : ''}</button>`).join('')}</div></section>`;
}

// The official icons you deleted: the app no longer shows or uses them, but they are still in the code, to bring back.
function goneHtml(list: Shown[]): string {
  return `<section class="panel pix-group pix-gone" aria-label="Deleted">
    <div class="pix-ghead"><h3>Deleted <span class="num muted">${list.length}</span></h3></div>
    <p class="muted">Official ${cat === 'weather' ? 'weather' : `${esc(categoryOf(cat).label.toLowerCase())}s`} you deleted: the app no longer shows or uses them. Tap one to bring it back.</p>
    <div class="pix-tiles" style="${baseStyle(cat)}">${list.map((i) => `<button class="pix-tile" type="button" data-action="pix-view" data-id="${esc(i.id)}" title="${esc(i.name)}">
      <span class="pix-pic">${pictureSvg(cat, i.art)}</span><span class="pix-tname">${esc(i.name)}</span></button>`).join('')}</div></section>`;
}

// Organising: the bar that stays at the bottom, with what is picked and where it goes.
function organiseBar(groups: string[]): string {
  const n = picked.size;
  const ids = [...picked], shown = liveIcons(pixelData(), cat).filter((i) => picked.has(i.id));
  const { deleted, official, reverted } = dropCount(pixelData(), cat, ids);
  const food = cat === 'sticker' ? `<div class="btns flow">
      <button class="btn" type="button" data-action="pix-food-set" data-food="1" ${shown.some((i) => !i.food) ? '' : 'disabled'}>Kitty can eat these</button>
      <button class="btn" type="button" data-action="pix-food-set" data-food="0" ${shown.some((i) => i.food) ? '' : 'disabled'}>Not cat food</button></div>` : '';
  return `<div class="panel pix-orgbar" role="region" aria-label="Organise picked icons">
    <p class="num"><b>${n ? `${plural(n, 'icon')} picked` : 'Nothing picked yet'}</b></p>
    <div class="pix-orgrow">${groupPicker('pix-move-to', 'Move to', groups, groups.includes(moveTo) || moveTo === DEFAULT_GROUP || moveTo === USER_GROUP ? moveTo : USER_GROUP)}</div>
    <div class="btns flow"><button class="btn primary" type="button" data-action="pix-move" ${n ? '' : 'disabled'}>Move</button>
      <button class="btn" type="button" data-action="pix-unpick" ${n ? '' : 'disabled'}>Unpick</button>
      <button class="btn" type="button" data-action="pix-organise">Done</button></div>
    ${food}
    <div class="btns flow"><button class="btn danger" type="button" data-action="pix-del-picked" ${deleted + official + reverted ? '' : 'disabled'}>${iconSvg('x')} Delete</button></div></div>`;
}
// Cat food or not, for every picked sticker.
async function foodPicked(food: boolean) {
  const n = liveIcons(pixelData(), 'sticker').filter((i) => picked.has(i.id) && !!i.food !== food).length;
  if (!await setPixelData(setFood(pixelData(), [...picked], food))) { toast("Couldn't change them. Try again."); return; }
  toast(food ? `Kitty can eat ${plural(n, 'more sticker')} now.` : `${plural(n, 'sticker')} ${n === 1 ? 'is' : 'are'} not cat food any more.`);
  render();
}
// Deleting the picked icons asks first: your own are gone for good, official ones are deleted where they can be (and can
// be brought back), and the other changed official ones go back as they were.
function askDeletePicked() {
  const { deleted, official, reverted } = dropCount(pixelData(), cat, [...picked]);
  const kept = picked.size - deleted - official - reverted;
  const lines = [
    deleted ? `${plural(deleted, 'icon')} of yours will be deleted.` : '',
    official ? `${plural(official, 'official icon')} will be deleted: the app no longer shows or uses ${official === 1 ? 'it' : 'them'}${cat === 'sticker' ? ' (anything that has one gets a heart)' : ''}. You can bring ${official === 1 ? 'it' : 'them'} back from Deleted.` : '',
    reverted ? `${plural(reverted, 'changed official icon')} will go back as ${reverted === 1 ? 'it was' : 'they were'}.` : '',
    kept ? `${plural(kept, 'official icon')} can't be deleted and ${kept === 1 ? 'stays' : 'stay'} as ${kept === 1 ? 'it is' : 'they are'}.` : '',
  ].filter(Boolean).map((l) => `<p class="muted">${l}</p>`).join('');
  openLayer(`<h3>Delete ${plural(deleted + official + reverted, 'icon')}?</h3>${lines}
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn danger" type="button" data-action="pix-del-confirm">${iconSvg('x')} Delete</button></div>`, 'Delete picked icons');
}
async function deletePicked() {
  closeLayer();
  const { deleted, official, reverted } = dropCount(pixelData(), cat, [...picked]);
  if (!await setPixelData(dropIcons(pixelData(), cat, [...picked]))) { toast("Couldn't delete them. Try again."); return; }
  picked.clear();
  toast([deleted + official ? `Deleted ${plural(deleted + official, 'icon')}` : '', reverted ? `${plural(reverted, 'icon')} back as ${reverted === 1 ? 'it was' : 'they were'}` : ''].filter(Boolean).join(', ') + '.');
  render();
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
  const [w, h] = (categoryOf(c).free && shown && freeSize(shown.art)) || sizeOf(c, shown && !asCopy ? shown.id : null);
  const grid = shown ? toGrid(shown.art.map((r) => r.padEnd(w, '.').slice(0, w))) : blankGrid(w, h);
  while (grid.length < h) grid.push(Array<string>(w).fill('.'));
  draft = { cat: c, id: shown ? shown.id : null, name: shown?.name ?? '', group: shown?.group ?? USER_GROUP, grid: grid.slice(0, h), saved: '' };
  if (c === 'sticker') draft.food = !!shown?.food;
  stepSel = null;
  if (c === 'kitty' && shown?.frames) {
    const gridOf = (art: string[]) => { const g = toGrid(art.map((r) => r.padEnd(w, '.').slice(0, w))); while (g.length < h) g.push(Array<string>(w).fill('.')); return g.slice(0, h); };
    draft.frames = shown.frames.map((f) => ({ id: f.id, name: f.name, grid: gridOf(f.art), ...(f.pin && { pin: [...f.pin] as [number, number] }) }));
    draft.cur = 0;
    draft.grid = draft.frames[0].grid;
    draft.sequence = cleanSequence(shown.sequence, shown.frames);
    draft.fps = shown.fps ?? DEFAULT_FPS;
  }
  if (c === 'scene') {
    draft.spots = (shown?.spots ?? []).map((p) => [...p] as Spot);
    if (shown?.props) draft.props = { book: [...shown.props.book] as Spot, trophy: [...shown.props.trophy] as Spot };
  }
  draft.saved = artKey(draft);
  zoom = 1; sceneMode = 'draw'; pickedSpot = null;
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
  const groups = groupsOf(liveIcons(pixelData(), d.cat));
  const group = cleanGroup(d.group, '');
  const scene = d.cat === 'scene', spots = scene && sceneMode === 'spots';
  return `<div class="panel pix-draw">
    <div class="pix-dhead"><h3>${esc(title)}</h3><span class="muted num" id="pix-size">${w} × ${h} · ${esc(c.label)}</span></div>
    ${c.free ? `<form class="pix-resize" id="pix-resize-form" novalidate>
      <label class="field">Width <input id="pix-w" type="number" inputmode="numeric" min="1" max="${FREE_MAX}" value="${w}"></label>
      <span aria-hidden="true">×</span>
      <label class="field">Height <input id="pix-h" type="number" inputmode="numeric" min="1" max="${FREE_MAX}" value="${h}"></label>
      <button class="btn small" type="submit">Resize</button>
      <span class="muted">Keeps the top-left corner; use the arrows below to move the drawing.</span></form>` : ''}
    ${scene ? `<div class="seg pix-modes" role="tablist" aria-label="Board">${([['draw', 'Draw'], ['spots', 'Kitty spots']] as const).map(([m, label]) =>
      `<button type="button" role="tab" data-action="pix-scene-mode" data-mode="${m}" aria-selected="${m === sceneMode}">${label}</button>`).join('')}</div>` : ''}
    ${d.cat === 'kitty' ? frameBar(d) : ''}
    <div class="pix-tools" ${spots ? 'hidden' : ''}>
      <div class="seg" role="toolbar" aria-label="Tool">${(d.frames ? [...ALL_TOOLS, TRACK_TOOL] : ALL_TOOLS).map(([t, label]) => `<button type="button" data-action="pix-tool" data-tool="${t}" aria-pressed="${t === tool}" aria-label="${label}" title="${label}">${toolIcon(t)}</button>`).join('')}</div>
      <div class="seg" role="toolbar" aria-label="Board"><button type="button" data-action="pix-mirror" aria-pressed="${mirror}" aria-label="Mirror" title="Mirror: draw on both halves">${toolIcon('mirror')}</button></div>
    </div>
    <div class="seg pix-zooms" role="radiogroup" aria-label="Zoom">${ZOOMS.map((z) =>
      `<button type="button" role="radio" data-action="pix-zoom" data-zoom="${z}" aria-checked="${z === zoom}">${z}×</button>`).join('')}</div>
    <div class="pix-board-wrap${scene ? ' scene' : ''}${zoom > 1 ? ' zoomed' : ''}" id="pix-board-wrap" style="${baseStyle(d.cat)}; --zoom: ${zoom}"><div class="pix-board${scene ? ' scene' : ''}${spots ? ' spots' : ''}" id="pix-board" data-tool="${tool}" style="--bw-cells: ${w}; --bh-cells: ${h}" role="img" aria-label="Drawing board, ${w} by ${h} pixels"></div></div>
    <div class="pix-selbar" id="pix-selbar" aria-live="polite"></div>
    ${scene && !spots ? `<div class="btns flow pix-photo"><button class="btn small" type="button" data-action="pix-photo">Use a photo…</button>
      <span class="muted">It is turned into pixel art in the app's colours, to touch up.</span><input type="file" id="pix-photo" accept="image/*" hidden></div>` : ''}
    <div class="pix-actions" ${spots ? 'hidden' : ''}>
      <button class="btn small" type="button" data-action="pix-undo" ${undos.length ? '' : 'disabled'}>Undo</button>
      <button class="btn small" type="button" data-action="pix-redo" ${redos.length ? '' : 'disabled'}>Redo</button>
      <button class="btn small" type="button" data-action="pix-flip" title="Flip the drawing, or the selection">Flip</button>
      <button class="btn small" type="button" data-action="pix-shift" data-dx="-1" data-dy="0" aria-label="Move left">${iconSvg('prev')}</button>
      <button class="btn small" type="button" data-action="pix-shift" data-dx="1" data-dy="0" aria-label="Move right">${iconSvg('next')}</button>
      <button class="btn small pix-up" type="button" data-action="pix-shift" data-dx="0" data-dy="-1" aria-label="Move up">${iconSvg('prev')}</button>
      <button class="btn small pix-down" type="button" data-action="pix-shift" data-dx="0" data-dy="1" aria-label="Move down">${iconSvg('next')}</button>
      <button class="btn small" type="button" data-action="pix-clear">Clear</button>
    </div>
    ${spots ? '' : inksHtml(d.cat)}
    ${!c.base ? '' : `<p class="muted pix-note">${c.outline ? 'The lit and shaded edges of the base colour are added for you where it touches the outside: draw the dark outline yourself. ' : ''}<b>Base colour</b> follows the card or note. Show it in:</p>
    <div class="seg pix-bases" role="radiogroup" aria-label="Show the base colour in">${NOTE_COLORS.map((n) =>
      `<button type="button" role="radio" data-action="pix-base" data-base="${n}" aria-checked="${n === base}"><i style="background: ${COLOR[n][0]}"></i>${COLOR[n][1]}</button>`).join('')}</div>`}
  </div>
  ${d.cat === 'kitty' ? animHtml(d) : ''}
  ${scene ? '' : '<div class="panel"><h3>Preview</h3><div id="pix-preview" class="pix-preview"></div></div>'}
  <form class="panel pix-save" id="pix-form" novalidate>
    <label class="field">Name <input id="pix-name" maxlength="${LIMITS.name}" autocomplete="off" value="${esc(d.name)}" placeholder="${esc(off?.name ?? 'Teapot')}"></label>
    ${scene ? '' : groupPicker('pix-group', 'Group', groups, group)}
    ${d.cat === 'sticker' ? `<label class="check"><input type="checkbox" id="pix-food" ${d.food ? 'checked' : ''}><span><b>Can kitty eat this?</b><br><span class="muted">Then it is cat food too: Habit Kitty's feed button gives each kitty a different one every day.</span></span></label>` : ''}
    <div class="btns flow">
      <button class="btn primary" type="submit">Save</button>
      ${d.id && !isFixed(d.cat) ? '<button class="btn" type="button" data-action="pix-copy">Save as a new icon</button>' : ''}
      ${off && saved ? '<button class="btn" type="button" data-action="pix-revert">Back to the official one</button>' : ''}
      ${(!off && saved) || (off && canDeleteOfficial(d.cat, off.id)) ? `<button class="btn danger" type="button" data-action="pix-delete">${iconSvg('x')} Delete</button>` : ''}
      <button class="btn" type="button" data-action="pix-close">Close</button>
    </div>
  </form>`;
}

// The board: one cell per pixel. Painting changes only the cells it touches; this redraws them all.
function renderBoard() {
  const b = document.getElementById('pix-board');
  if (!b || !draft) return;
  const d = draft, g = shownGrid(), w = g[0].length, h = g.length;
  b.style.setProperty('--bw-cells', String(w));
  b.style.setProperty('--bh-cells', String(h));
  b.setAttribute('aria-label', `Drawing board, ${w} by ${h} pixels`);
  const size = document.getElementById('pix-size');
  if (size) size.textContent = `${w} × ${h} · ${categoryOf(d.cat).label}`;
  for (const [id, v] of [['pix-w', w], ['pix-h', h]] as const) { const f = document.getElementById(id) as HTMLInputElement | null; if (f && document.activeElement !== f) f.value = String(v); }
  b.innerHTML = onionHtml(d) + (d.cat === 'scene' ? `<canvas width="${w}" height="${h}"></canvas><div class="pix-marks" id="pix-marks"></div>`
    : g.map((row, y) => row.map((ch, x) => `<i data-x="${x}" data-y="${y}" style="background: ${cellColor(d.cat, ch)}"></i>`).join('')).join(''))
    + pinHtml(d, w, h)
    + (sel ? `<b class="pix-sel${float ? ' lifted' : ''}" style="left: ${(sel.x / w) * 100}%; top: ${(sel.y / h) * 100}%; width: ${(sel.w / w) * 100}%; height: ${(sel.h / h) * 100}%"></b>` : '');
  b.dataset.tool = tool;
  if (d.cat === 'scene') { paintCanvas(g); renderMarks(); }
  renderSelbar();
  renderPreview();
  syncUndoKeys();
}
// A scene's board is one canvas, a pixel per cell (a cell each would be 76,800 elements).
const rgbOf = new Map<string, [number, number, number]>();
function cellRgb(ch: string): [number, number, number] | null {
  if (ch === '.') return null;
  let c = rgbOf.get(ch);
  if (!c) { const hex = SCENE_HEX[ch] ?? ''; if (!/^#[0-9a-f]{6}$/i.test(hex)) return null; c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number]; rgbOf.set(ch, c); }
  return c;
}
function paintCanvas(g: Grid) {
  const cv = document.querySelector<HTMLCanvasElement>('#pix-board canvas'), cx = cv?.getContext('2d');
  if (!cv || !cx) return;
  const img = cx.createImageData(cv.width, cv.height);
  g.forEach((row, y) => row.forEach((ch, x) => {
    const c = cellRgb(ch);
    if (!c) return;
    const o = (y * cv.width + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }));
  cx.putImageData(img, 0, 0);
}
function paintPixel(x: number, y: number, ch: string) {
  const cx = document.querySelector<HTMLCanvasElement>('#pix-board canvas')?.getContext('2d');
  if (!cx) return;
  const c = cellRgb(ch);
  if (!c) { cx.clearRect(x, y, 1, 1); return; }
  cx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  cx.fillRect(x, y, 1, 1);
}

// ---- kitty spots ----
// Each spot shows as a see-through kitty standing on it, numbered; the diary book and the trophy as themselves.
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const PROP_SIZE: Record<'book' | 'trophy', [number, number]> = { book: [BOOK_ART[0].length, BOOK_ART.length], trophy: [TROPHY_ART[0].length, TROPHY_ART.length] };
function renderMarks() {
  const el = document.getElementById('pix-marks');
  if (!el || !draft) return;
  if (sceneMode !== 'spots') { el.innerHTML = ''; return; }
  const spots = draft.spots ?? [];
  const box = (x: number, y: number, w: number, h: number) => `left: ${pct(x, ROOM_W)}; top: ${pct(y, ROOM_H)}; width: ${pct(w, ROOM_W)}; height: ${pct(h, ROOM_H)}`;
  el.innerHTML = spots.map(([x, y], i) => `<span class="pix-spot${pickedSpot === i ? ' on' : ''}" style="${box(x, y - CAT_SIZE, CAT_SIZE, CAT_SIZE)}">${bodySvg('happy', { fur: FURS[i % FURS.length] } as Parameters<typeof bodySvg>[1], i)}<b>${i + 1}</b></span>`).join('')
    + (draft.props ? (['book', 'trophy'] as const).map((k) => {
      const [x, y] = draft!.props![k], [w, h] = PROP_SIZE[k];
      return `<span class="pix-spot prop${pickedSpot === k ? ' on' : ''}" style="${box(x, y, w, h)}">${artSvg(k === 'book' ? BOOK_ART : TROPHY_ART, '', PAL)}</span>`;
    }).join('') : '');
}
// The spot or prop under a point of the scene (the props first: they are small), or null.
function spotAt(px: number, py: number): SpotKey | null {
  if (!draft) return null;
  for (const k of ['book', 'trophy'] as const) {
    const p = draft.props?.[k];
    if (p && px >= p[0] - 2 && px < p[0] + PROP_SIZE[k][0] + 2 && py >= p[1] - 2 && py < p[1] + PROP_SIZE[k][1] + 2) return k;
  }
  const spots = draft.spots ?? [];
  for (let i = spots.length - 1; i >= 0; i--) {
    const [x, y] = spots[i];
    if (px >= x && px < x + CAT_SIZE && py >= y - CAT_SIZE && py < y) return i;
  }
  return null;
}
const spotPos = (k: SpotKey): Spot => (typeof k === 'number' ? draft!.spots![k] : draft!.props![k]);
function moveSpot(k: SpotKey, x: number, y: number) {
  if (!draft) return;
  if (typeof k === 'number') draft.spots![k] = clampSpot([x, y]);
  else draft.props![k] = clampProp([x, y], ...PROP_SIZE[k]);
}
// What the selection can do, under the board (only with the Select tool, or while something is selected).
function renderSelbar() {
  const el = document.getElementById('pix-selbar');
  if (!el) return;
  if (isScene() && sceneMode === 'spots') {
    const n = draft?.spots?.length ?? 0;
    const what = pickedSpot === null ? '' : typeof pickedSpot === 'number' ? `Spot ${pickedSpot + 1}` : pickedSpot === 'book' ? 'The diary book' : 'The trophy';
    el.innerHTML = `<span class="muted">${draft?.id === 'garden' ? 'Strays' : 'Kitties'} sit where the kitties stand. Drag one to move it; tap an empty place to add one${draft?.props ? '. The diary book and the trophy open the diary and the accomplishments: put them where you can tap them' : ''}.</span>
      <span class="num"><b>${plural(n, 'spot')}</b> (up to ${MAX_SPOTS})${what ? ` · ${what} picked` : ''}</span>
      <div class="btns flow">${typeof pickedSpot === 'number' ? `<button class="btn small danger" type="button" data-action="pix-spot-del" ${n > 1 ? '' : 'disabled'}>${iconSvg('x')} Remove spot</button>` : ''}
        <button class="btn small" type="button" data-action="pix-spot-reset">Official spots</button></div>`;
    return;
  }
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
    if (draft.cat === 'scene') { paintPixel(xx, y, ch); continue; }
    const el = document.querySelector<HTMLElement>(`#pix-board > i[data-x="${xx}"][data-y="${y}"]`);
    if (el) el.style.background = cellColor(draft.cat, ch);
  }
}
function renderPreview() {
  const el = document.getElementById('pix-preview');
  if (!el || !draft || draft.cat === 'scene') return;
  const art = toArt(shownGrid()), c = draft.cat;
  if (c === 'button') {
    el.innerHTML = `<div class="pix-prow"><span class="pix-pbig">${pictureSvg(c, art, true)}</span>
      <span class="btn small" aria-hidden="true">${monoSvg(art)} Button</span><span class="gear" aria-hidden="true">${monoSvg(art)}</span></div>`;
    return;
  }
  // big: as a card's picture (a sticker zoomed to twice its size there), drawn twice as big again here; small: its real size
  const big = c === 'sticker' ? stickerArtSvg(art, 1, 'x4') : pictureSvg(c, art, true);
  const small = c === 'sticker' ? stickerArtSvg(art, 1) : fineSvg(art);
  const row = `<div class="pix-prow" style="${baseStyle(c)}"><span class="pix-pbig">${big}<span>${c === 'sticker' ? 'On a card (zoomed in)' : 'Zoomed in'}</span></span>
      <span class="pix-psmall">${small}<span>Real size</span></span></div>`;
  if (c === 'deco' || c === 'kitty') { el.innerHTML = row; return; }   // no base colour, and each is drawn in its own place
  if (c === 'weather') {   // no base colour; on a diary page it is a choice with its name under it
    el.innerHTML = `${row}<p class="muted">On a diary page:</p><div class="moods"><button type="button" aria-pressed="true" tabindex="-1" aria-hidden="true" style="pointer-events: none">${fineSvg(art, 'weather')}<span>${esc(draft.name || 'Untitled')}</span></button></div>`;
    return;
  }
  // cat food: also where it goes, on Habit Kitty's feed button
  const feed = c === 'sticker' && draft.food ? `<p class="muted">On the feed button:</p><div class="pix-prow"><span class="btn primary sq" aria-hidden="true">${stickerArtSvg(art, 1, 'food')}</span></div>` : '';
  el.innerHTML = `${row}
    <p class="muted">On each note colour (the base colour changes with it):</p>
    <div class="pix-prow pix-swatches">${NOTE_COLORS.map((n) => `<span class="pix-on" style="--nc: ${COLOR[n][0]}; color: ${COLOR[n][0]}" title="${COLOR[n][1]}">${pictureSvg(c, art)}</span>`).join('')}</div>${feed}`;
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
  undos.push(draft.grid.map((r) => r.slice())); if (undos.length > undoMax()) undos.shift();
  redos = [];
  draft.grid = next;
  renderBoard();
}
function step(from: Grid[], to: Grid[]) {
  settle();
  if (!draft || !from.length) { renderBoard(); return; }
  to.push(draft.grid);
  draft.grid = from.pop()!;
  fitFrames();
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
// A scene: dragging a spot, or moving around the zoomed-in board.
let spotDrag: { k: SpotKey; id: number; dx: number; dy: number } | null = null;
let pan: { id: number; x: number; y: number; left: number; top: number } | null = null;
// Where the pointer is on the scene, in (fractional) scene pixels.
function scenePoint(ev: PointerEvent): [number, number] | null {
  const b = document.getElementById('pix-board');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * ROOM_W, ((ev.clientY - r.top) / r.height) * ROOM_H];
}
function spotDown(ev: PointerEvent, board: HTMLElement) {
  if (!draft?.spots) return;
  const pt = scenePoint(ev);
  if (!pt) return;
  ev.preventDefault();
  let k = spotAt(pt[0], pt[1]);
  if (k === null) {   // an empty place: a new spot, the kitty centred on the finger
    if (draft.spots.length >= MAX_SPOTS) { toast(`That's all ${MAX_SPOTS} spots. Move one, or remove one first.`); return; }
    draft.spots.push(clampSpot([pt[0] - CAT_SIZE / 2, pt[1] + CAT_SIZE / 2]));
    k = draft.spots.length - 1;
  }
  const [x, y] = spotPos(k);
  pickedSpot = k;
  spotDrag = { k, id: ev.pointerId, dx: pt[0] - x, dy: pt[1] - y };
  try { board.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  renderMarks(); renderSelbar();
}
onShown('pixel', 'pointerdown', (ev) => {
  const board = (ev.target as Element).closest?.('#pix-board');
  if (!board || !draft || ev.button > 0 && ev.button !== 2) return;
  if (isScene() && sceneMode === 'spots') { spotDown(ev, board as HTMLElement); return; }
  if (tool === 'pan') {
    const wrap = document.getElementById('pix-board-wrap');
    if (!wrap) return;
    ev.preventDefault();
    pan = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, left: wrap.scrollLeft, top: wrap.scrollTop };
    try { (board as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
    return;
  }
  const at = cellAt(ev);
  if (!at) return;
  ev.preventDefault();
  const [x, y] = at;
  const t: Tool = ev.button === 2 ? 'erase' : tool;
  if (t === 'track') { setPin(x, y); return; }
  if (t === 'select') { selectDown(ev, board as HTMLElement, at); return; }
  if (sel) { settle(); renderBoard(); }
  if (t === 'pick') {
    const ch = draft.grid[y][x];
    useInk(ch); tool = 'pencil'; render();   // an empty cell picks Empty
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
  if (spotDrag && ev.pointerId === spotDrag.id) {
    const pt = scenePoint(ev);
    if (pt) { moveSpot(spotDrag.k, pt[0] - spotDrag.dx, pt[1] - spotDrag.dy); renderMarks(); }
    return;
  }
  if (pan && ev.pointerId === pan.id) {
    const wrap = document.getElementById('pix-board-wrap');
    if (wrap) { wrap.scrollLeft = pan.left - (ev.clientX - pan.x); wrap.scrollTop = pan.top - (ev.clientY - pan.y); }
    return;
  }
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
  if (spotDrag && ev.pointerId === spotDrag.id) { spotDrag = null; renderMarks(); renderSelbar(); }
  if (pan && ev.pointerId === pan.id) pan = null;
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
  const f = document.getElementById('pix-food') as HTMLInputElement | null;
  if (f) draft.food = f.checked;
  const fn = document.getElementById('pix-frame-name') as HTMLInputElement | null;
  if (fn && draft.frames && draft.cur !== undefined) draft.frames[draft.cur].name = fn.value;
}
async function save(asNew: boolean) {
  if (!draft) return;
  readFields();
  settle();
  const d = draft;
  syncFrame(); fitFrames();
  const frames = d.frames?.map((f) => ({ id: f.id, name: cleanName(f.name, 'Frame'), art: toArt(f.grid), ...(f.pin && { pin: f.pin }) }));
  const art = frames ? frames[0].art : toArt(d.grid);
  if (frames ? frames.every((f) => isBlank(f.art)) : isBlank(art)) { toast('Draw something first.'); return; }
  const twin = frames?.find((f, i) => frames.findIndex((o) => o.name.toLowerCase() === f.name.toLowerCase()) !== i);
  if (twin) { toast(`Two frames are called ${twin.name}. Give each frame its own name.`); return; }
  const off = d.id && !asNew ? officialOf(d.cat, d.id) : undefined;
  const name = cleanName(d.name, off?.name ?? 'Untitled');
  let group = cleanGroup(d.group, off?.group ?? USER_GROUP);
  if (asNew) {
    // a copy is a new icon: it goes in "user" rather than "default", and has a new icon's size
    if (group === DEFAULT_GROUP) group = USER_GROUP;
    const [w, h] = sizeOf(d.cat, null);
    if (!categoryOf(d.cat).free && (d.grid[0].length !== w || d.grid.length !== h)) { toast(`A new ${categoryOf(d.cat).label.toLowerCase()} is ${w} × ${h}, so this one can't be copied. Start a new one instead.`); return; }
  }
  const other = nameTaken(pixelData(), d.cat, name, asNew ? null : d.id);
  if (other) {
    toast(`There's already an icon called ${other.name}. Give this one another name.`);
    document.getElementById('pix-name')?.focus();
    return;
  }
  if (d.cat === 'scene' && !d.spots?.length) { toast('Give the kitties at least one spot.'); return; }
  const id = !asNew && d.id ? d.id : newId(name, d.cat, pixelData());
  const ok = await setPixelData(putIcon(pixelData(), { category: d.cat, id, name, group, art, ...(frames && { frames, sequence: cleanSequence(d.sequence, frames), fps: d.fps ?? DEFAULT_FPS }), ...(d.spots && { spots: d.spots }), ...(d.props && { props: d.props }), ...(d.cat === 'sticker' && { food: !!d.food }) }));
  if (!ok) { toast("Couldn't save. Try again."); return; }
  d.id = id; d.name = name; d.group = group; d.saved = artKey(d);
  toast(asNew ? `Saved as ${name}.` : `Saved ${name}.`);
  render();
}

// ---- a kitty animation: frames and a sequence ----
// The frames are named drawings. The sequence lists them by id, in play order, so a frame can be in it more than once
// (1 2 3 2 1) and what you draw on a frame shows in every step that plays it.
const thumb = (grid: Grid) => `<span class="pix-fth">${fineSvg(toArt(grid))}</span>`;
const liveGrid = (d: Draft, i: number) => (i === d.cur ? d.grid : d.frames![i].grid);
const fchip = (d: Draft, i: number, action: string, on: boolean, n?: number, ai?: number) =>
  `<button type="button" class="pix-fchip" data-action="${action}" data-i="${ai ?? i}" aria-pressed="${on}">${n === undefined ? '' : `<b class="num">${n}</b>`}${thumb(liveGrid(d, i))}<span>${esc(d.frames![i].name || 'Frame')}</span></button>`;
// Onion skin: the frame before the one on the board, faint (50%) behind what you draw, to line the two up. It can be turned off.
let onion = true;
function onionHtml(d: Draft): string {
  const prev = onion && d.frames && d.cur ? d.frames[d.cur - 1] : undefined;
  return prev ? `<div class="pix-onion" aria-hidden="true">${fineSvg(toArt(prev.grid))}</div>` : '';
}
// The point of tracking of the frame on the board: a ring on its cell. Every frame's point lines up with the first one's as it plays.
function pinHtml(d: Draft, w: number, h: number): string {
  const pin = d.frames?.[d.cur ?? 0]?.pin;
  return pin ? `<b class="pix-pin" aria-hidden="true" style="left: ${(pin[0] / w) * 100}%; top: ${(pin[1] / h) * 100}%; width: ${100 / w}%; height: ${100 / h}%"></b>` : '';
}
// The frames, just above the board: pick the one to draw on, add, copy or delete one.
function frameBar(d: Draft): string {
  if (!d.frames) return '';
  const frames = d.frames, cur = d.cur ?? 0;
  return `<div class="pix-framebar"><div class="pix-fstrip" role="group" aria-label="Frames">${frames.map((_, i) => fchip(d, i, 'pix-frame-pick', i === cur)).join('')}</div>
    <div class="btns flow"><button class="btn small" type="button" data-action="pix-frame-add" ${frames.length >= MAX_FRAMES ? 'disabled' : ''}>New frame</button>
      <button class="btn small" type="button" data-action="pix-frame-copy" ${frames.length >= MAX_FRAMES ? 'disabled' : ''}>Copy this frame</button>
      <button class="btn small" type="button" data-action="pix-frame-left" ${cur === 0 ? 'disabled' : ''} aria-label="Move this frame earlier">&larr; Earlier</button>
      <button class="btn small" type="button" data-action="pix-frame-right" ${cur >= frames.length - 1 ? 'disabled' : ''} aria-label="Move this frame later">Later &rarr;</button>
      <button class="btn small danger" type="button" data-action="pix-frame-del" ${frames.length < 2 ? 'disabled' : ''}>${iconSvg('x')} Delete frame</button></div>
    <div class="btns flow"><span class="muted">Point of tracking (optional): ${frames[cur].pin ? `cell ${frames[cur].pin![0] + 1}, ${frames[cur].pin![1] + 1}` : 'not set'}.</span>
      <button class="btn small" type="button" data-action="pix-tool" data-tool="track">Set point</button>
      <button class="btn small" type="button" data-action="pix-pin-clear" ${frames[cur].pin ? '' : 'disabled'}>Clear point</button></div>
    <p class="muted">Mark the same part on each frame, such as the front paw, then the back paw. As the animation plays the points line up, so the kitty moves from one to the next.</p>
    <label class="check"><input type="checkbox" id="pix-onion" ${onion ? 'checked' : ''}><span><b>Show the previous frame</b><br><span class="muted">Faint (50%) behind your drawing, to line the frames up. ${cur ? `Now showing ${esc(frames[cur - 1].name || 'Frame')}.` : 'The first frame has none before it.'}</span></span></label></div>`;
}
function animHtml(d: Draft): string {
  if (!d.frames) {
    return `<div class="panel pix-animp"><h3>Animation</h3>
      <p class="muted">Make this kitty an animation: several named frames, and a sequence that plays them, such as 1 2 3 2 1. Draw a frame once and every step that plays it shows it.</p>
      <button class="btn" type="button" data-action="pix-anim-start">Make an animation</button></div>`;
  }
  const frames = d.frames, cur = d.cur ?? 0, seq = d.sequence ?? [];
  const here = frames[cur];
  const uses = seq.filter((id) => id === here.id).length;
  const idx = new Map(frames.map((f, i) => [f.id, i]));
  const chip = (i: number, action: string, on: boolean, n?: number, ai?: number) => fchip(d, i, action, on, n, ai);
  return `<div class="panel pix-animp"><h3>Animation</h3>
    <label class="field">Frame name <input id="pix-frame-name" maxlength="${LIMITS.name}" autocomplete="off" value="${esc(here.name)}"></label>
    <p class="muted">You are drawing on <b>${esc(here.name || 'Frame')}</b>, which plays in ${plural(uses, 'step')}: changing it changes every one of them.</p>
    <h3>Sequence <span class="num muted">${seq.length}</span></h3>
    <div class="pix-fstrip" role="group" aria-label="Sequence">${seq.map((id, n) => chip(idx.get(id) ?? 0, 'pix-step-pick', n === stepSel, n + 1, n)).join('')}</div>
    <div class="btns flow"><button class="btn small" type="button" data-action="pix-step-add" ${seq.length >= MAX_STEPS ? 'disabled' : ''}>Add ${esc(here.name || 'Frame')} ${stepSel === null ? 'to the end' : `after step ${stepSel + 1}`}</button>
      <button class="btn small" type="button" data-action="pix-step-left" aria-label="Move step earlier" ${stepSel === null || stepSel < 1 ? 'disabled' : ''}>${iconSvg('prev')}</button>
      <button class="btn small" type="button" data-action="pix-step-right" aria-label="Move step later" ${stepSel === null || stepSel >= seq.length - 1 ? 'disabled' : ''}>${iconSvg('next')}</button>
      <button class="btn small" type="button" data-action="pix-step-del" ${stepSel === null || seq.length < 2 ? 'disabled' : ''}>Remove step</button></div>
    <div class="btns flow"><button class="btn small" type="button" data-action="pix-pingpong" title="Plays the frames forward, then back: 1 2 3 2 1">Ping-pong ${frames.length > 1 ? frames.map((_, i) => i + 1).join(' ') + ' ' + frames.slice(0, -1).map((_, i) => frames.length - 1 - i).join(' ') : ''}</button>
      <button class="btn small" type="button" data-action="pix-seq-reset">Frames in order</button></div>
    <div class="pix-animview"><div class="pix-animbox"><div class="pix-anim" id="pix-anim" style="--w:${d.grid[0].length};--h:${d.grid.length}" aria-hidden="true"></div><p class="muted pix-animcap" id="pix-animcap"></p></div>
      <div class="stack"><label class="field">Speed <select id="pix-fps">${FPS_CHOICES.map((n) => `<option value="${n}" ${n === (d.fps ?? DEFAULT_FPS) ? 'selected' : ''}>${n} steps a second</option>`).join('')}</select></label>
        <button class="btn small" type="button" data-action="pix-anim-toggle">${animPlaying ? 'Pause' : 'Play'}</button></div></div></div>`;
}

// The animation plays on the page while the board is open, at the speed chosen, from what is on the board now.
let animTimer: ReturnType<typeof setInterval> | undefined;
let animI = 0;
let animPlaying = true;
function drawAnim() {
  const el = document.getElementById('pix-anim');
  if (!el || !draft?.frames || !draft.sequence?.length) { stopAnim(); return; }
  const d = draft, byId = new Map(d.frames!.map((f, i) => [f.id, i]));
  const ids = d.sequence!.filter((id) => byId.has(id));
  if (!ids.length) return;
  animI %= ids.length;
  const i = byId.get(ids[animI])!;
  const sh = trackShifts(d.frames!.map((f, k) => ({ id: f.id, name: f.name, art: [], pin: f.pin })), d.sequence).get(d.frames![i].id);
  const art = toArt(liveGrid(d, i));
  el.innerHTML = fineSvg(sh && (sh[0] || sh[1]) ? shiftArt(art, sh[0], sh[1]) : art);   // only the picture changes: the canvas keeps its size
  const cap = document.getElementById('pix-animcap');
  if (cap) cap.textContent = `Step ${animI + 1} of ${ids.length}: ${d.frames![i].name || 'Frame'}`;
  animI++;
}
function stopAnim() { if (animTimer !== undefined) clearInterval(animTimer); animTimer = undefined; }
function restartAnim() {
  stopAnim();
  if (!draft?.frames || tab !== 'draw') return;
  drawAnim();
  if (animPlaying) animTimer = setInterval(drawAnim, 1000 / (draft.fps ?? DEFAULT_FPS));
}
// The frame on the board is stored with the others before anything switches, saves or counts them.
function syncFrame() { if (draft?.frames && draft.cur !== undefined) draft.frames[draft.cur].grid = draft.grid; }
// Every frame is the board's size (a resize, or an Undo of one, changes the board you are on).
function fitFrames() {
  if (!draft?.frames) return;
  const w = draft.grid[0].length, h = draft.grid.length;
  draft.frames.forEach((f, i) => {
    if (i === draft!.cur) f.grid = draft!.grid;
    else if (f.grid.length !== h || f.grid[0]?.length !== w) f.grid = resizeGrid(f.grid, w, h);
    if (f.pin && (f.pin[0] >= w || f.pin[1] >= h)) delete f.pin;
  });
}
function setPin(x: number, y: number) {
  const f = draft?.frames?.[draft.cur ?? 0];
  if (!f) return;
  f.pin = f.pin && f.pin[0] === x && f.pin[1] === y ? undefined : [x, y];   // tapping the same cell again takes it off
  if (!f.pin) delete f.pin;
  readFields(); render();
}
// Moves the frame on the board one place along the strip. The sequence names frames by id, so it plays the same; only the
// order of the strip (and which frame is the kitty's picture in lists: the first) changes.
function moveFrame(by: -1 | 1) {
  const d = draft;
  if (!d?.frames) return;
  const at = d.cur ?? 0, to = at + by;
  if (to < 0 || to >= d.frames.length) return;
  readFields(); settle(); syncFrame();
  [d.frames[at], d.frames[to]] = [d.frames[to], d.frames[at]];
  d.cur = to;
  render();
}
function selectFrame(i: number) {
  const d = draft;
  if (!d?.frames?.[i]) return;
  readFields(); settle(); syncFrame();
  d.cur = i; d.grid = d.frames[i].grid;
  undos = []; redos = []; sel = null; float = null;
  render();
}
function startAnimation() {
  if (!draft || draft.cat !== 'kitty' || draft.frames) return;
  readFields(); settle();
  draft.frames = [{ id: 'f1', name: 'Frame 1', grid: draft.grid }];
  draft.cur = 0; draft.sequence = ['f1']; draft.fps = DEFAULT_FPS;
  render();
}
function addFrame(copy: boolean) {
  const d = draft;
  if (!d?.frames || d.frames.length >= MAX_FRAMES) return;
  readFields(); settle(); syncFrame();
  const here = d.frames[d.cur ?? 0];
  const f: DraftFrame = { id: newFrameId(d.frames), name: nextFrameName(d.frames),   // a copy is named like a new frame: the next number
    grid: copy ? here.grid.map((r) => r.slice()) : blankGrid(here.grid[0].length, here.grid.length),
    ...(copy && here.pin && { pin: [...here.pin] as [number, number] }) };
  d.frames.push(f);
  d.sequence = [...(d.sequence ?? []), f.id].slice(0, MAX_STEPS);
  selectFrame(d.frames.length - 1);
}
function askDeleteFrame() {
  const d = draft;
  if (!d?.frames || d.frames.length < 2) return;
  readFields();
  const here = d.frames[d.cur ?? 0], uses = (d.sequence ?? []).filter((id) => id === here.id).length;
  openLayer(`<h3>Delete ${esc(here.name || 'Frame')}?</h3>
    <p class="muted">The drawing is lost${uses ? `, and ${plural(uses, 'step')} that play${uses === 1 ? 's' : ''} it ${uses === 1 ? 'is' : 'are'} taken out of the sequence` : ''}.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn danger" type="button" data-action="pix-frame-del-confirm">${iconSvg('x')} Delete</button></div>`, 'Delete frame');
}
function deleteFrame() {
  const d = draft;
  closeLayer();
  if (!d?.frames || d.frames.length < 2) return;
  syncFrame();
  const at = d.cur ?? 0, r = removeFrame(d.frames, d.sequence ?? [], d.frames[at].id);
  d.frames = r.frames; d.sequence = r.sequence; stepSel = null;
  d.cur = Math.min(at, d.frames.length - 1); d.grid = d.frames[d.cur].grid;
  undos = []; redos = []; sel = null; float = null;
  render();
}
// The sequence's own buttons.
function stepAction(a: 'pick' | 'add' | 'left' | 'right' | 'del' | 'pingpong' | 'reset', i = 0) {
  const d = draft;
  if (!d?.frames) return;
  readFields();
  const seq = [...(d.sequence ?? [])];
  if (a === 'pick') {
    stepSel = stepSel === i ? null : i;
    const f = d.frames.findIndex((x) => x.id === seq[i]);
    if (f >= 0 && f !== d.cur) { selectFrame(f); return; }   // tapping a step opens its frame to draw on
  } else if (a === 'add') {
    if (seq.length >= MAX_STEPS) { toast(`A sequence can have ${MAX_STEPS} steps.`); return; }
    const at = stepSel === null ? seq.length : stepSel + 1;
    seq.splice(at, 0, d.frames[d.cur ?? 0].id);
    stepSel = at;
  } else if (a === 'left' && stepSel !== null && stepSel > 0) {
    [seq[stepSel - 1], seq[stepSel]] = [seq[stepSel], seq[stepSel - 1]]; stepSel--;
  } else if (a === 'right' && stepSel !== null && stepSel < seq.length - 1) {
    [seq[stepSel + 1], seq[stepSel]] = [seq[stepSel], seq[stepSel + 1]]; stepSel++;
  } else if (a === 'del' && stepSel !== null && seq.length > 1) {
    seq.splice(stepSel, 1); stepSel = null;
  } else if (a === 'pingpong') {
    seq.splice(0, seq.length, ...pingPong(d.frames.map((f) => f.id)).slice(0, MAX_STEPS)); stepSel = null;
  } else if (a === 'reset') {
    seq.splice(0, seq.length, ...d.frames.map((f) => f.id)); stepSel = null;
  }
  d.sequence = seq;
  render();
}

// ---- the board's size (a free-size category, such as a kitty) ----
function resize() {
  if (!draft || !categoryOf(draft.cat).free) return;
  const read = (id: string) => Math.round(Number((document.getElementById(id) as HTMLInputElement | null)?.value));
  const w = read('pix-w'), h = read('pix-h');
  if (!(w >= 1 && h >= 1 && w <= FREE_MAX && h <= FREE_MAX)) { toast(`Width and height are 1 to ${FREE_MAX} pixels.`); return; }
  if (w === draft.grid[0].length && h === draft.grid.length) return;
  settle(); sel = null;
  edit((g) => resizeGrid(g, w, h));
  fitFrames();   // every frame is the board's size
}

// ---- a photo as a scene ----
// The photo fills the scene (cut to fit, from the middle), and each pixel becomes the nearest palette colour. A faint ordered
// dither lets soft shades come out as a pattern of two colours, as pixel art does it, instead of flat bands.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
async function usePhoto(file: File | undefined) {
  if (!file || !draft || draft.cat !== 'scene') return;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = draft.grid[0].length, h = draft.grid.length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const px = g.getImageData(0, 0, w, h).data;
    const inks = [...SCENE_INKS].map((ch) => [ch, cellRgb(ch)] as const).filter((e): e is readonly [string, [number, number, number]] => !!e[1]);
    const memo = new Map<number, string>();
    const nearest = (r: number, gr: number, b: number) => {
      const key = ((r >> 2) << 12) | ((gr >> 2) << 6) | (b >> 2);
      let best = memo.get(key);
      if (best) return best;
      let bd = Infinity;
      for (const [ch, c] of inks) {
        const rm = (r + c[0]) / 2, dr = r - c[0], dg = gr - c[1], db = b - c[2];
        const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
        if (d < bd) { bd = d; best = ch; }
      }
      memo.set(key, best!);
      return best!;
    };
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const grid: Grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
      const o = (y * w + x) * 4, t = (BAYER[(y % 4) * 4 + (x % 4)] / 16 - 0.47) * 24;
      return nearest(clamp(px[o] + t), clamp(px[o + 1] + t), clamp(px[o + 2] + t));
    }));
    sceneMode = 'draw';
    edit(() => grid);
    render();
    toast('Your photo is on the board. Touch it up, place the kitty spots, then Save.');
  } catch { toast("Couldn't read that photo."); } finally { URL.revokeObjectURL(url); }
}

// Zooms the scene in or out around the middle of what is on screen.
function setZoom(z: number) {
  const wrap = document.getElementById('pix-board-wrap');
  const cx = wrap ? (wrap.scrollLeft + wrap.clientWidth / 2) / wrap.scrollWidth : 0.5, cy = wrap ? (wrap.scrollTop + wrap.clientHeight / 2) / wrap.scrollHeight : 0.5;
  zoom = z;
  readFields(); render();
  const after = document.getElementById('pix-board-wrap');
  if (after) { after.scrollLeft = cx * after.scrollWidth - after.clientWidth / 2; after.scrollTop = cy * after.scrollHeight - after.clientHeight / 2; }
}

// ---- export and import ----
const today = () => localDateKey();
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
const dialog = makeLayer('pixel', {
  id: 'pix-layer', host: () => $('pixel-layer-host'), closeAction: 'pix-layer-close', focus: 'input, [data-focus]',
  onCancel: () => { afterDiscard = null; importing = null; },   // backed out of a question: forget what it was for
});
const openLayer = (html: string, label: string) => dialog.open(`${closeX('pix-layer-close')}${html}`, label);
const closeLayer = () => dialog.close();

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
// A deleted official one can only be brought back.
function openView(id: string) {
  const i = iconsOf(pixelData(), cat).find((s) => s.id === id);
  if (!i) return;
  const gone = i.status === 'deleted';
  openLayer(`<h3>${esc(i.name)}</h3>
    <p class="muted">${esc(groupLabel(i.group))}${i.status === 'official' ? '' : ` · <span class="badge ${i.status}">${{ new: 'New', changed: 'Changed', deleted: 'Deleted' }[i.status]}</span>`}</p>
    <div class="pix-preview pix-view${gone ? ' pix-gone' : ''}" style="${baseStyle(cat)}"><div class="pix-prow"><span class="pix-pbig" id="pix-view-pic">${pictureSvg(cat, i.art, true)}</span></div></div>
    ${i.frames ? `<p class="muted">An animation: ${plural(i.frames.length, 'frame')}, ${plural(i.sequence?.length ?? i.frames.length, 'step')}.</p>` : ''}
    ${gone ? '<p class="muted">The app no longer shows or uses it.</p>' : ''}
    <div class="btns flow"><button class="btn" type="button" data-action="pix-layer-close">Close</button>
    ${gone ? `<button class="btn primary" type="button" data-action="pix-restore" data-id="${esc(i.id)}" data-focus>Bring back</button>`
      : `<button class="btn primary" type="button" data-action="pix-open" data-id="${esc(i.id)}" data-focus>${iconSvg('pencil')} Edit</button>`}</div>`, i.name);
  if (i.frames && i.frames.length > 0) playView(playOrder(i.frames, i.sequence), i.fps ?? DEFAULT_FPS);
}
// An animation opened from the list plays, rather than showing its first frame; it stops when the dialog closes.
let viewTimer: ReturnType<typeof setInterval> | undefined;
function playView(pics: string[][], fps: number) {
  if (viewTimer !== undefined) clearInterval(viewTimer);
  let n = 0;
  const tick = () => {
    const el = document.getElementById('pix-view-pic');
    if (!el) { clearInterval(viewTimer); viewTimer = undefined; return; }
    el.innerHTML = fineSvg(pics[n++ % pics.length], 'x4');
  };
  if (pics.length > 1) viewTimer = setInterval(tick, 1000 / fps);
}
async function restore(id: string) {
  closeLayer();
  const name = iconsOf(pixelData(), cat).find((s) => s.id === id)?.name ?? 'It';
  if (!await setPixelData(restoreIcon(pixelData(), cat, id))) { toast("Couldn't bring it back. Try again."); return; }
  toast(`${name} is back.`);
  render();
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
      <p class="muted">The base colour (<b>s</b>) in a sticker or mini sticker is not one colour: it is the colour of the note, card or category the
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
      const ids = liveIcons(pixelData(), cat).filter((i) => i.group === b.dataset.group).map((i) => i.id);
      if (ids.every((id) => picked.has(id))) ids.forEach((id) => picked.delete(id)); else ids.forEach((id) => picked.add(id));
      render(); break;
    }
    case 'pix-unpick': picked.clear(); render(); break;
    case 'pix-move': movePicked(); break;
    case 'pix-food-set': foodPicked(b.dataset.food === '1'); break;
    case 'pix-del-picked': askDeletePicked(); break;
    case 'pix-del-confirm': deletePicked(); break;
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
    case 'pix-scene-mode': settle(); sceneMode = b.dataset.mode as 'draw' | 'spots'; pickedSpot = null; readFields(); render(); break;
    case 'pix-zoom': setZoom(Number(b.dataset.zoom)); break;
    case 'pix-anim-start': startAnimation(); break;
    case 'pix-frame-pick': selectFrame(Number(b.dataset.i)); break;
    case 'pix-pin-clear': { const f = draft?.frames?.[draft.cur ?? 0]; if (f) { delete f.pin; readFields(); render(); } break; }
    case 'pix-frame-left': moveFrame(-1); break;
    case 'pix-frame-right': moveFrame(1); break;
    case 'pix-frame-add': addFrame(false); break;
    case 'pix-frame-copy': addFrame(true); break;
    case 'pix-frame-del': askDeleteFrame(); break;
    case 'pix-frame-del-confirm': deleteFrame(); break;
    case 'pix-step-pick': stepAction('pick', Number(b.dataset.i)); break;
    case 'pix-step-add': stepAction('add'); break;
    case 'pix-step-left': stepAction('left'); break;
    case 'pix-step-right': stepAction('right'); break;
    case 'pix-step-del': stepAction('del'); break;
    case 'pix-pingpong': stepAction('pingpong'); break;
    case 'pix-seq-reset': stepAction('reset'); break;
    case 'pix-anim-toggle': animPlaying = !animPlaying; readFields(); render(); break;
    case 'pix-photo': document.getElementById('pix-photo')?.click(); break;
    case 'pix-spot-del':
      if (draft?.spots && typeof pickedSpot === 'number' && draft.spots.length > 1) { draft.spots.splice(pickedSpot, 1); pickedSpot = null; renderMarks(); renderSelbar(); }
      break;
    case 'pix-spot-reset': {
      const o = draft?.id ? officialOf('scene', draft.id) : undefined;
      if (draft && o) { draft.spots = (o.spots ?? []).map((p) => [...p] as Spot); if (o.props) draft.props = { book: [...o.props.book] as Spot, trophy: [...o.props.trophy] as Spot }; pickedSpot = null; renderMarks(); renderSelbar(); }
      break;
    }
    case 'pix-revert': revert(); break;
    case 'pix-delete': remove(); break;
    case 'pix-restore': restore(b.dataset.id!); break;
    case 'pix-export': exportIcons(); break;
    case 'pix-import': document.getElementById('pix-file')?.click(); break;
    case 'pix-import-replace': if (importing) finishImport(importing, 'replace'); break;
    case 'pix-import-keep': if (importing) finishImport(importing, 'keep'); break;
    case 'pix-group-rename': openGroupRename(b.dataset.group!); break;
    case 'pix-discard': { const then = afterDiscard; afterDiscard = null; closeLayer(); then?.(); break; }
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
// Your own icon is gone for good; an official one is deleted (it can be brought back, with your saved changes).
async function remove() {
  if (!draft?.id) return;
  const name = draft.name || 'The icon';
  const next = officialOf(draft.cat, draft.id) ? deleteOfficial(pixelData(), draft.cat, draft.id) : dropIcon(pixelData(), draft.cat, draft.id);
  if (!await setPixelData(next)) { toast("Couldn't delete it."); return; }
  draft = null; tab = 'icons';
  toast(`Deleted ${name}.`);
  renderTop(); render();
}

onShown('pixel', 'submit', async (ev) => {
  const f = ev.target as HTMLFormElement;
  if (f.id === 'pix-form') { ev.preventDefault(); save(false); }
  if (f.id === 'pix-resize-form') { ev.preventDefault(); resize(); }
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
  if (t.id === 'pix-photo') { usePhoto(t.files?.[0]); t.value = ''; }
  if (t.id === 'pix-food') { readFields(); renderPreview(); }
  if (t.id === 'pix-onion') { onion = (t as HTMLInputElement).checked; renderBoard(); }
  if (t.id === 'pix-fps' && draft) { draft.fps = FPS_CHOICES.includes(Number(t.value)) ? Number(t.value) : DEFAULT_FPS; restartAnim(); }
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
