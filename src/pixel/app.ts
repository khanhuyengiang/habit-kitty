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
import { FINE, UI_ICONS, bakeSticker, fineSvg, stickerArtSvg } from '../achievement/pixelart.ts';
import { iconSvg } from '../pixelart.ts';
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
import { BOOK_ART, TROPHY_ART, ROOM_H, ROOM_W, type Spot } from '../scene.ts';
import { PAL, artSvg } from '../shared/pixelart.ts';
import { FURS, bodySvg } from '../shared/pixelcat.ts';
import {
  BASE_ROWS, INK_ROWS, MORE_INKS, byHue,
  CATEGORIES, DEFAULT_GROUP, byName, LETTERS, LIMITS, USER_GROUP, blankGrid, categoryOf, cleanGroup, cleanName, dropCount, dropFloat, dropIcon, dropIcons,
  exportName, exportText, flipGrid, floodFill, groupsOf, iconsOf, liveIcons, canDeleteOfficial, deleteOfficial, restoreIcon, importClashes, importIcons, inRect, nameTaken, type PixelIcon, isBlank, letterName, liftArea, linePoints,
  moveIcons, newId, officialOf, putIcon, readExport, rectOf, renameGroup, setFood, shiftGrid, borderAll, oldStickers, sizeOf, toArt, toGrid, type CategoryId, type Grid,
  type Rect, type Shown, CAT_SIZE, isFixed, MAX_SPOTS, SCENE_INKS, clampProp, clampSpot, sceneColors, type Props,
} from './model.ts';

const toast = (text: string) => showToast($('pixel-toast'), text);

type Tab = 'icons' | 'draw' | 'colours';
const TABS: [Tab, string][] = [['icons', 'Icons'], ['draw', 'Draw'], ['colours', 'Colours']];
type Tool = 'pencil' | 'erase' | 'fill' | 'pick' | 'select' | 'pan';
const TOOLS: [Tool, string][] = [['pencil', 'Pencil'], ['erase', 'Eraser'], ['fill', 'Fill'], ['pick', 'Pick'], ['select', 'Select']];
// A scene is too big to see whole when zoomed in, so it has a tool to move around it too.
const SCENE_TOOLS: [Tool, string][] = [...TOOLS, ['pan', 'Move around']];
const ZOOMS = [1, 2, 4, 8];
// The drawing tools' icons: smooth line drawings (not pixel art, so they don't look like part of the picture), in the text colour.
const TOOL_ICONS: Record<Tool | 'mirror', string> = {
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
interface Draft { cat: CategoryId; id: string | null; name: string; group: string; grid: Grid; saved: string; spots?: Spot[]; props?: Props; food?: boolean }
let draft: Draft | null = null;
let undos: Grid[] = [], redos: Grid[] = [];
const artKey = (d: Draft) => `${d.name}\n${d.group}\n${toArt(d.grid).join('')}\n${JSON.stringify(d.spots ?? null)}${JSON.stringify(d.props ?? null)}${d.food ? '\nfood' : ''}`;
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
  if (c === 'friend' || c === 'deco' || c === 'weather') return fineSvg(art, big ? 'x4' : 'x2');
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
function inksHtml(c: CategoryId): string {
  if (c === 'button') return `<div class="pix-inks" role="radiogroup" aria-label="Colour">${inkRows(c, ['o'])}</div>`;
  const last = recentInks()[0];
  return `<div class="pix-inks" role="radiogroup" aria-label="Colour"><div class="pix-ibase">${inkRows(c, BASE_ROWS)}</div>${inkRows(c, INK_ROWS)}
    <div class="pix-irow">${last ? inkButton(c, last) : ''}<button type="button" class="pix-ink pix-choose" data-action="pix-more" aria-haspopup="dialog">${monoSvg(UI_ICONS.plus)}<span>Choose a colour…</span></button></div></div>`;
}
// The palette colours picked with "Choose a colour", latest first (kept on this device).
const RECENT_KEY = 'hk-pixel-recent', RECENT_MAX = 9;
function recentInks(): string[] {
  const v = readJson(RECENT_KEY);
  return Array.isArray(v) ? v.filter((ch): ch is string => typeof ch === 'string' && ch.length === 1 && MORE_INKS.includes(ch)).slice(0, RECENT_MAX) : [];
}
// Draws with a colour from now on (one from "Choose a colour" goes to the top of Previously used).
function useInk(ch: string) {
  ink = ch;
  if (ch.length !== 1 || !MORE_INKS.includes(ch)) return;
  writeJson(RECENT_KEY, [ch, ...recentInks().filter((r) => r !== ch)].slice(0, RECENT_MAX));   // not kept: fine
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
  const list = liveIcons(pixelData(), cat);
  const gone = iconsOf(pixelData(), cat).filter((i) => i.status === 'deleted').sort(byName);
  const mine = pixelData().icons.length;
  const groups = groupsOf(list);
  return `${catSeg()}
    <div class="panel pix-intro">
      <p class="muted">${c.id === 'weather' ? 'Weather pictures' : `${esc(c.label)}s`} are ${c.w} × ${c.h} pixels. ${esc(c.where)}.${c.id === 'button' ? ' They take the text colour.' : c.base ? ` The <b>base colour</b> takes the colour of ${esc(c.base)}.` : ''}</p>
      ${c.id === 'scene' ? `<p class="muted">Draw on them, or turn a photo into one, and choose where the kitties can sit.</p>`
        : isFixed(c.id) ? ''
        : `<div class="btns flow"><button class="btn primary" type="button" data-action="pix-new">${iconSvg('pencil')} New ${esc(c.label.toLowerCase())}</button>
        <button class="btn${organise ? ' on' : ''}" type="button" data-action="pix-organise" aria-pressed="${organise}">Organise</button></div>`}
      ${c.id === 'sticker' ? borderButton() : ''}
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

// TEMPORARY (stickers grew from 16×16 to 18×18): gives every 16×16 sticker of yours its empty pixel, dark outline and
// lit edges, so it looks as it did. To go in the next patch, with borderAll and oldStickers in ./model.ts.
function borderButton(): string {
  const n = oldStickers(pixelData());
  return `<p class="muted pix-note">Stickers are 18 × 18 now, with the dark outline drawn in. ${n ? `${plural(n, 'sticker')} of yours ${n === 1 ? 'is' : 'are'} still 16 × 16.` : 'All of yours are 18 × 18.'}</p>
    <div class="btns flow"><button class="btn" type="button" data-action="pix-border-all" ${n ? '' : 'disabled'}>Add border to all</button></div>`;
}
async function addBorders() {
  const n = oldStickers(pixelData());
  if (!await setPixelData(borderAll(pixelData()))) { toast("Couldn't add the borders. Try again."); return; }
  toast(`Added a border to ${plural(n, 'sticker')}.`);
  render();
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
  const [w, h] = sizeOf(c, shown && !asCopy ? shown.id : null);
  // TEMPORARY: a 16×16 sticker of yours opens with its border added, as "Add border to all" would
  const art = shown && c === 'sticker' && shown.art.length === 16 ? bakeSticker(shown.art) : shown?.art;
  const grid = art ? toGrid(art.map((r) => r.padEnd(w, '.').slice(0, w))) : blankGrid(w, h);
  while (grid.length < h) grid.push(Array<string>(w).fill('.'));
  draft = { cat: c, id: shown ? shown.id : null, name: shown?.name ?? '', group: shown?.group ?? USER_GROUP, grid: grid.slice(0, h), saved: '' };
  if (c === 'sticker') draft.food = !!shown?.food;
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
    <div class="pix-dhead"><h3>${esc(title)}</h3><span class="muted num">${w} × ${h} · ${esc(c.label)}</span></div>
    ${scene ? `<div class="seg pix-modes" role="tablist" aria-label="Board">${([['draw', 'Draw'], ['spots', 'Kitty spots']] as const).map(([m, label]) =>
      `<button type="button" role="tab" data-action="pix-scene-mode" data-mode="${m}" aria-selected="${m === sceneMode}">${label}</button>`).join('')}</div>` : ''}
    <div class="pix-tools" ${spots ? 'hidden' : ''}>
      <div class="seg" role="toolbar" aria-label="Tool">${(scene ? SCENE_TOOLS : TOOLS).map(([t, label]) => `<button type="button" data-action="pix-tool" data-tool="${t}" aria-pressed="${t === tool}" aria-label="${label}" title="${label}">${toolIcon(t)}</button>`).join('')}</div>
      <div class="seg" role="toolbar" aria-label="Board"><button type="button" data-action="pix-mirror" aria-pressed="${mirror}" aria-label="Mirror" title="Mirror: draw on both halves">${toolIcon('mirror')}</button></div>
    </div>
    ${scene ? `<div class="seg pix-zooms" role="radiogroup" aria-label="Zoom">${ZOOMS.map((z) =>
      `<button type="button" role="radio" data-action="pix-zoom" data-zoom="${z}" aria-checked="${z === zoom}">${z}×</button>`).join('')}</div>` : ''}
    <div class="pix-board-wrap${scene ? ' scene' : ''}" id="pix-board-wrap" style="${baseStyle(d.cat)}${scene ? `; --zoom: ${zoom}` : ''}"><div class="pix-board${scene ? ' scene' : ''}${spots ? ' spots' : ''}" id="pix-board" data-tool="${tool}" style="--bw-cells: ${w}; --bh-cells: ${h}" role="img" aria-label="Drawing board, ${w} by ${h} pixels"></div></div>
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
  b.innerHTML = (d.cat === 'scene' ? `<canvas width="${w}" height="${h}"></canvas><div class="pix-marks" id="pix-marks"></div>`
    : g.map((row, y) => row.map((ch, x) => `<i data-x="${x}" data-y="${y}" style="background: ${cellColor(d.cat, ch)}"></i>`).join('')).join(''))
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
  if (c === 'deco') { el.innerHTML = row; return; }   // no base colour, and each is drawn in its own place
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
  if (isScene() && tool === 'pan') {
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
  if (d.cat === 'scene' && !d.spots?.length) { toast('Give the kitties at least one spot.'); return; }
  const id = !asNew && d.id ? d.id : newId(name, d.cat, pixelData());
  const ok = await setPixelData(putIcon(pixelData(), { category: d.cat, id, name, group, art, ...(d.spots && { spots: d.spots }), ...(d.props && { props: d.props }), ...(d.cat === 'sticker' && { food: !!d.food }) }));
  if (!ok) { toast("Couldn't save. Try again."); return; }
  d.id = id; d.name = name; d.group = group; d.saved = artKey(d);
  toast(asNew ? `Saved as ${name}.` : `Saved ${name}.`);
  render();
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
    <div class="pix-preview pix-view${gone ? ' pix-gone' : ''}" style="${baseStyle(cat)}"><div class="pix-prow"><span class="pix-pbig">${pictureSvg(cat, i.art, true)}</span></div></div>
    ${gone ? '<p class="muted">The app no longer shows or uses it.</p>' : ''}
    <div class="btns flow"><button class="btn" type="button" data-action="pix-layer-close">Close</button>
    ${gone ? `<button class="btn primary" type="button" data-action="pix-restore" data-id="${esc(i.id)}" data-focus>Bring back</button>`
      : `<button class="btn primary" type="button" data-action="pix-open" data-id="${esc(i.id)}" data-focus>${iconSvg('pencil')} Edit</button>`}</div>`, i.name);
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
    case 'pix-border-all': addBorders(); break;
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
