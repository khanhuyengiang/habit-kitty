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
import { monoSvg, runPaths } from '../shared/pixelart.ts';
import { inWardrobe, onAppShown, onShown } from '../shared/apps.ts';
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
import { SKIN_COLOURS, SKIN_PATTERNS, inkFor, sheetCatSvg } from '../shared/kittysheet.ts';
import { BOOK_ART, TROPHY_ART, ROOM_H, ROOM_W, type Spot } from '../shared/scene.ts';
import { PAL, artSvg } from '../shared/pixelart.ts';
import { FURS, bodySvg } from '../shared/pixelcat.ts';
import {
  BASE_ROWS, INK_ROWS, ALL_INKS, byHue,
  CATEGORIES, DEFAULT_GROUP, byName, LETTERS, LIMITS, USER_GROUP, blankGrid, categoryOf, cleanGroup, cleanName, dropCount, dropFloat, dropIcon, dropIcons,
  exportName, exportText, flipGrid, floodFill, groupsOf, iconsOf, liveIcons, canDeleteOfficial, deleteOfficial, restoreIcon, importClashes, importIcons, inRect, nameTaken, type PixelIcon, isBlank, letterName, liftArea, linePoints,
  moveIcons, newId, officialOf, putIcon, readExport, rectOf, renameGroup, setFood, shiftGrid, sizeOf, FREE_MAX, freeSize, resizeGrid, toArt, toGrid, type CategoryId, type Grid,
  DEFAULT_FPS, FPS_CHOICES, MAX_SPRITES, MAX_STEPS, MAX_ANIMS, GAME_ANIMS, SHEET_ID, SHEET_NAME, type Animation, cleanAnimations, newAnimId, newSpriteId, nextSpriteName, pingPong, removeSprite,
  stepsFromText, stepsToText, MAX_SHIFT, defaultGhosts, type Anchor, type Ghost, type Step,
  type Rect, type Shown, CAT_SIZE, isFixed, MAX_SPOTS, SCENE_INKS, clampProp, clampSpot, sceneColors, type Props,
} from './model.ts';

const toast = (text: string) => showToast($('pixel-toast'), text);

type Tab = 'icons' | 'draw' | 'colours' | 'skins';
const GALLERY_TABS: [Tab, string][] = [['icons', 'Icons'], ['draw', 'Draw'], ['colours', 'Colours']];
const WARDROBE_TABS: [Tab, string][] = [['icons', 'Kitty'], ['draw', 'Draw'], ['skins', 'Skins']];
const tabs = () => (inWardrobe() ? WARDROBE_TABS : GALLERY_TABS);
type Tool = 'pencil' | 'erase' | 'fill' | 'pick' | 'select' | 'pan';
const TOOLS: [Tool, string][] = [['pencil', 'Pencil'], ['erase', 'Eraser'], ['fill', 'Fill'], ['pick', 'Pick'], ['select', 'Select']];
// Every board can be zoomed in (a scene is too big to see whole anyway), so every board has a tool to move around it too.
const ALL_TOOLS: [Tool, string][] = [...TOOLS, ['pan', 'Move around']];
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
const keptFlag = (k: string, dflt: boolean) => { try { const v = localStorage.getItem(k); return v === null ? dflt : v === '1'; } catch { return dflt; } };
const keepFlag = (k: string, on: boolean) => { try { localStorage.setItem(k, on ? '1' : '0'); } catch { /* private window */ } };
let kittyHelp = keptFlag('pix-kitty-help', true);       // Kitty tab: the explanation is shown until closed
let animsOpen = keptFlag('pix-anims-open', true);       // Kitty tab: the animations and the sprites fold away
let spritesOpen = keptFlag('pix-sprites-open', true);
let spriteSort = false;                // Kitty tab: sprites listed by name (the numbers stay)
let zoneMode = false;                  // Draw (the kitty): the board shows and draws the sprites' zones, not their pictures
let zink = 'H';                        // the part drawn in zone mode
let clip: { grid: Grid; x: number; y: number; zone: boolean } | null = null;   // copied pixels (kept while you open other sprites), with where they were
let penOnly = (() => { try { return localStorage.getItem('pix-pen') === '1'; } catch { return false; } })();   // only a pen draws: fingers and palms are ignored
let organise = false;                  // Icons: tiles are picked to move, not opened
const picked = new Set<string>();      // the ids picked, in the shown category
let moveTo: string = USER_GROUP;       // the group they were last moved to

// The icon on the board. id null: a new one, not saved yet. A scene also has its kitty spots and (the room) its props.
// The kitty is the sprite sheet: sprites (each its own named grid; `grid` below is the one being drawn on, the sprite at `cur`)
// and animations that play them (`anim` is the one being edited; see Sprite and Animation in ./model.ts).
interface DraftSprite { id: string; name: string; grid: Grid; zone: Grid }   // zone: the part of the coat of each pixel (see fixZone)
interface Draft { cat: CategoryId; id: string | null; name: string; group: string; grid: Grid; saved: string; spots?: Spot[]; props?: Props; food?: boolean;
  sprites?: DraftSprite[]; cur?: number; anims?: Animation[]; anim?: number }
let draft: Draft | null = null;
let undos: Grid[] = [], redos: Grid[] = [];
const artKey = (d: Draft) => `${d.name}\n${d.group}\n${toArt(d.grid).join('')}\n${JSON.stringify(d.spots ?? null)}${JSON.stringify(d.props ?? null)}${d.food ? '\nfood' : ''}`
  + (d.sprites ? `\n${JSON.stringify(d.sprites.map((f, i) => [f.id, f.name, toArt(liveGrid(d, i)).join(''), zoneToRows(fixZone(liveGrid(d, i), liveZone(d, i))).join('/')]))}${JSON.stringify(d.anims)}` : '');
let stepSel: number | null = null;
let restSel: { anim: string; which: 'before' | 'after' } | null = null;   // the resting pose picked (the ghost before or after the steps), which has the same Forward and Up as a step   // the step picked in the animation
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
  fixCurZone();
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
  return `<div class="pix-inks" role="radiogroup" aria-label="Colour"><div class="pix-ibase">${inkRows(c, BASE_ROWS)}</div>${emptyInk()}${inkRows(c, INK_ROWS)}</div>`;
}
// Pinned above the board: the four colours used last, and Choose a colour (two rows of three), so the colour in hand is never a scroll away.
function recentBar(c: CategoryId): string {
  if (c === 'button') return '';
  const have = categoryOf(c).letters;
  const recent = recentInks().filter((ch) => have.includes(ch)).slice(0, 4);
  if (!recent.length && ink.length === 1 && have.includes(ink)) recent.push(ink);
  return `<div class="pix-irow pix-recent" role="radiogroup" aria-label="Recent colours">${recent.map((ch) => inkButton(c, ch)).join('')}<button type="button" class="pix-ink pix-choose" data-action="pix-more" aria-haspopup="dialog">${monoSvg(UI_ICONS.plus)}<span>Choose a colour…</span></button></div>`;
}
// The colours used last, latest first (kept on this device).
const RECENT_KEY = 'hk-pixel-recent', RECENT_MAX = 9;
function recentInks(): string[] {
  const v = readJson(RECENT_KEY);
  return Array.isArray(v) ? v.filter((ch): ch is string => typeof ch === 'string' && ch.length === 1 && ch !== '.').slice(0, RECENT_MAX) : [];
}
// Draws with a colour from now on (one from "Choose a colour" goes to the top of Previously used).
function useInk(ch: string) {
  ink = ch;
  if (ch.length !== 1 || ch === '.') return;
  writeJson(RECENT_KEY, [ch, ...recentInks().filter((r) => r !== ch)].slice(0, RECENT_MAX));   // not kept: fine
}
function openInks() {
  if (!draft) return;
  const c = draft.cat, recent = recentInks().filter((ch) => categoryOf(c).letters.includes(ch));
  const grid = (label: string, chs: string[]) => `<h4 class="pix-ihead">${label}</h4>
    <div class="pix-igrid" role="radiogroup" aria-label="${label}">${chs.map((ch) => inkButton(c, ch, 'pix-ink-pick')).join('')}</div>`;
  openLayer(`<h3>Choose a colour</h3>${recent.length ? grid('Previously used', recent) : ''}${grid('All colours', byHue([...ALL_INKS]))}`, 'Choose a colour');
}

// ---------- header ----------
function renderTop() {
  const w = inWardrobe();
  $('pixel-top').innerHTML = titleBar(w ? 'Wardrobe' : 'Gallery', '', homeButton() + playerButton() + settingsButton())
    + `<nav class="nav" aria-label="${w ? 'Kitty Wardrobe' : 'Kitty Gallery'}"><div class="seg" role="tablist">${tabs().map(([t, label]) =>
      `<button type="button" role="tab" data-action="pix-tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div></nav>`;
}

function render() {
  if (!pixelReady()) { $('pixel-body').innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>'; return; }
  // Every redraw (choosing a tool or a colour, Undo...) makes a new board box; keep a zoomed-in board where it was scrolled to.
  const old = tab === 'draw' ? document.getElementById('pix-board-wrap') : null;
  const at = old && zoom > 1 ? { left: old.scrollLeft, top: old.scrollTop } : null;
  $('pixel-body').innerHTML = tab === 'icons' ? iconsHtml() : tab === 'draw' ? drawHtml() : tab === 'skins' ? skinsHtml() : coloursHtml();
  if (tab === 'draw') renderBoard();
  const wrap = at && document.getElementById('pix-board-wrap');
  if (wrap && at) { wrap.scrollLeft = at.left; wrap.scrollTop = at.top; }
  restartAnim();
}

const catSeg = () => `<div class="seg pix-cats" role="tablist" aria-label="Category">${CATEGORIES.filter((c) => c.id !== 'kitty').map((c) =>
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
  if (inWardrobe()) { cat = 'kitty'; return kittyHtml(); }
  if (cat === 'kitty') cat = 'sticker';   // the kitty is in Kitty Wardrobe
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
    ${exportHtml(mine)}`;
}
function exportHtml(mine: number): string {
  return `<div class="panel">
      <h3>Export</h3>
      <p class="muted">Your new icons, your changes and the official ones you deleted are in the backup, and in the settings file (Settings → Backup → Settings only),
        which gives someone your icons without your diary. Export puts just your icons in one file to make them official; Import reads one back.</p>
      <p class="muted num">${mine ? `${plural(mine, 'icon')} of yours` : 'Nothing of yours yet'}.</p>
      <div class="btns flow"><button class="btn" type="button" data-action="pix-export" ${mine ? '' : 'disabled'}>Export icons</button>
        <button class="btn" type="button" data-action="pix-import">Import icons</button></div>
      <input type="file" id="pix-file" accept=".json,application/json" hidden>
    </div>`;
}
// =================== Skins (Kitty Wardrobe) ===================
// A kitty's coat is a pattern and a colour, chosen apart; the sprites (the core: outline, ears, nose and the shape) are the same for every
// coat. The big kitty plays any animation in the pair picked; the tiles show every colour in the pattern, and every pattern in the colour.
let skinPattern: (typeof SKIN_PATTERNS)[number]['id'] = 'stripes';
let skinFur = SKIN_COLOURS[0].fur;
let skinAnim = 'idle';
const sheetNow = () => iconsOf(pixelData(), 'kitty').find((i) => i.id === SHEET_ID);

// ---- the zones: where the parts of each sprite are ----
// Zones are drawn in the Draw tab, on the same board as the sprite and with the same tools (Zone button, next to Pen): the board then shows each coat pixel
// in its part's colour, plays like an animation, and copies and pastes between sprites like a drawing. The outline and the non-coat pixels are locked.
const ZONE_PARTS: [string, string, string][] = [['H', 'Face', PALETTE.blue300], ['E', 'Ear (left)', PALETTE.sun300], ['F', 'Ear (right)', PALETTE.orange], ['T', 'Tail', PALETTE.red], ['K', 'Patch 1', PALETTE.green500], ['J', 'Patch 2', PALETTE.violet], ['b', 'Body', PALETTE.grey300]];
const COAT_LETTERS = 'nNwuU';
const ZONE_LETTERS_OK = 'HEFTKJb';
const zoneColor = (z: string) => ZONE_PARTS.find((q) => q[0] === z)?.[2] ?? '';
// A sprite's zones as a grid the size of its art: a part for every coat pixel (Body where none was said), '.' everywhere else.
const fixZone = (art: Grid, zone?: Grid): Grid => art.map((row, y) => row.map((c, x) => (COAT_LETTERS.includes(c) ? (ZONE_LETTERS_OK.includes(zone?.[y]?.[x] ?? '') ? zone![y][x] : 'b') : '.')));
const zoneFromRows = (art: Grid, rows?: string[]): Grid => fixZone(art, rows?.map((r) => [...r]));
const zoneToRows = (g: Grid): string[] => g.map((r) => r.join('').replace(/\.+$/, ''));
// A sprite's zones as a picture: each coat pixel in its part's colour, the rest as drawn (a private letter stands for each part).
const ZPRIV: Record<string, string> = { H: '\u0001', E: '\u0002', F: '\u0003', T: '\u0004', K: '\u0005', J: '\u0006', b: '\u0007' };
const zinkOf = (ch: string): string | undefined => { const z = Object.entries(ZPRIV).find(([, v]) => v === ch); return z ? zoneColor(z[0]) : FINE[ch]; };
function zoneSvg(art: string[], zone: Grid): string {
  const zart = art.map((row, y) => [...row].map((c, x) => (COAT_LETTERS.includes(c) ? ZPRIV[zone[y]?.[x]] ?? ZPRIV.b : c)).join(''));
  const w = Math.max(...zart.map((r) => r.length));
  const body = Object.entries(runPaths(zart, (ch) => !!zinkOf(ch))).map(([ch, d]) => `<path style="fill:${zinkOf(ch)}" d="${d}"/>`).join('');
  return `<svg class="pxs fine" style="--w:${w};--h:${zart.length}" viewBox="0 0 ${w} ${zart.length}" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;
}
// A picture in the layer the board shows: as drawn, or in zone mode its zones.
const layerSvg = (art: string[], zone: Grid | null) => (zone ? zoneSvg(art, zone) : fineSvg(art));


function skinsHtml(): string {
  const sheet = sheetNow();
  const anims = (sheet?.animations ?? []).filter((a) => a.steps.length);
  if (!anims.some((a) => a.id === skinAnim)) skinAnim = anims.find((a) => a.id === 'idle')?.id ?? anims[0]?.id ?? 'idle';
  const pic = (fur: string, pattern: string, anim: string, still: boolean) => sheetCatSvg(anim, { fur, pattern: pattern as 'plain' }, 'sit', 0, still) ?? '';
  const tile = (action: string, data: string, on: boolean, fur: string, pattern: string, label: string, note = '') =>
    `<button class="pix-skin${on ? ' on' : ''}" type="button" data-action="${action}" ${data} aria-pressed="${on}"><span class="pix-skinpic">${pic(fur, pattern, 'idle', true)}</span><b>${esc(label)}</b>${note ? `<span class="muted">${esc(note)}</span>` : ''}</button>`;
  const cur = SKIN_COLOURS.find((c) => c.fur === skinFur) ?? SKIN_COLOURS[0], pat = SKIN_PATTERNS.find((p) => p.id === skinPattern) ?? SKIN_PATTERNS[0];
  return `<div class="panel pix-intro"><h3>Skins</h3>
      <p class="muted">A kitty's coat is a <b>colour</b> and a <b>pattern</b>. Every skin is drawn on the same core sprites (the outline, ears, nose and the shapes of the poses), so a skin only changes the coat colours. Point, patch and calico use the <b>zones</b>: draw them in the Draw tab with the Zone button.</p></div>
    <div class="panel"><div class="pix-skinbig"><span class="pix-skinpic big">${pic(skinFur, skinPattern, skinAnim, false)}</span></div>
      <p class="num"><b>${esc(pat.name)} · ${esc(cur.name)}</b></p>
      <label class="field">Plays <select id="pix-skin-anim">${anims.map((a) => `<option value="${esc(a.id)}" ${a.id === skinAnim ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label></div>
    <section class="panel pix-group" aria-label="Colour"><div class="pix-ghead"><h3>Colour</h3></div>
      <div class="pix-swatches" role="radiogroup" aria-label="Colour">${SKIN_COLOURS.map((c) => `<button class="pix-swatch" type="button" role="radio" data-action="pix-skin-colour" data-fur="${c.fur}" aria-checked="${c.fur === skinFur}"><i style="background: ${c.fur}"></i><span>${esc(c.name)}</span></button>`).join('')}</div></section>
    <section class="panel pix-group" aria-label="Pattern"><div class="pix-ghead"><h3>Pattern</h3></div>
      <div class="pix-skins">${SKIN_PATTERNS.map((p) => tile('pix-skin-pattern', `data-id="${p.id}"`, p.id === skinPattern, skinFur, p.id, p.name, p.note)).join('')}</div></section>`;
}

// The Kitty tab: not a list of icons but the one sprite sheet. Each animation opens to design it (its steps, the sprites they play and
// where they move them); the sprites are all listed below, each opening to draw on.
// The sprites that no animation plays (the sheet always keeps at least one sprite).
const unusedSprites = <T extends { id: string }>(sprites: T[], anims: Animation[]): T[] => {
  const used = new Set(anims.flatMap((a) => a.steps.map((st) => st.id)));
  const out = sprites.filter((sp) => !used.has(sp.id));
  return out.length >= sprites.length ? out.slice(1) : out;
};
function askPruneSprites() {
  const sheet = iconsOf(pixelData(), 'kitty').find((i) => i.id === SHEET_ID), un = unusedSprites(sheet?.sprites ?? [], sheet?.animations ?? []);
  if (!un.length) return;
  openLayer(`<h3>Remove ${plural(un.length, 'unused sprite')}?</h3><p class="muted">These sprites are not in any animation, so nothing plays them: ${un.map((sp) => esc(sp.name)).join(', ')}. Their drawings are lost, and the sprites after them get a lower number.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn danger" type="button" data-action="pix-sprites-prune-confirm">${iconSvg('x')} Remove</button></div>`, 'Remove unused sprites');
}
async function pruneSprites() {
  const sheet = iconsOf(pixelData(), 'kitty').find((i) => i.id === SHEET_ID);
  if (!sheet?.sprites) return;
  const gone = new Set(unusedSprites(sheet.sprites, sheet.animations ?? []).map((sp) => sp.id));
  closeLayer();
  if (!gone.size) return;
  const sprites = sheet.sprites.filter((sp) => !gone.has(sp.id));
  const ok = await setPixelData(putIcon(pixelData(), { category: 'kitty', id: SHEET_ID, name: SHEET_NAME, group: USER_GROUP, art: sprites[0].art, sprites, animations: cleanAnimations(sheet.animations ?? [], sprites), zones: sheet.zones }));
  toast(ok ? `Removed ${plural(gone.size, 'unused sprite')}.` : "Couldn't save. Try again.");
  render();
}
function kittyHtml(): string {
  const c = categoryOf('kitty');
  const sheet = iconsOf(pixelData(), 'kitty').find((i) => i.id === SHEET_ID);
  const sprites = sheet?.sprites ?? [], anims = sheet?.animations ?? [];
  const byId = new Map(sprites.map((sp) => [sp.id, sp]));
  const mine = pixelData().icons.length;
  const [w, h] = sheet ? [sheet.art[0].length, sheet.art.length] : [c.w, c.h];
  const unused = unusedSprites(sprites, anims);
  const have = new Set(anims.map((a) => a.id)), quick = GAME_ANIMS.filter((g) => !have.has(g.id)), full = anims.length >= MAX_ANIMS;
  return `${kittyHelp ? `<div class="panel pix-intro pix-help">${closeX('pix-help-close', 'Close the explanation')}
      <p class="muted">${esc(c.where)}.</p>
      <p class="muted">Tap an <b>animation</b> to design it: its steps are sprites from the list (or new ones you draw), each can be moved forward or up so the file knows when the kitty is in the air or has gone to the side. Every sprite is the same size (${w} × ${h}, up to ${FREE_MAX} × ${FREE_MAX}) and is drawn once, however many animations play it. The <b>base colour</b> is the kitty's fur: each kitty wears its own.</p>
    </div>` : `<div class="btns"><button class="btn small" type="button" data-action="pix-help-show">About this page</button></div>`}
    <details class="panel pix-group pix-fold" id="pix-fold-anims" aria-label="Animations" ${animsOpen ? 'open' : ''}>
      <summary><h3>Animations <span class="num muted">${anims.length}</span></h3></summary>
      ${anims.length ? `<ul class="pix-anims">${anims.map((a) => {
        const game = GAME_ANIMS.find((g) => g.id === a.id), first = byId.get(a.steps[0]?.id ?? '');
        return `<li><button class="pix-arow" type="button" data-action="pix-anim-open" data-id="${esc(a.id)}">
          <span class="pix-fth" style="${baseStyle('kitty')}">${first ? fineSvg(first.art) : ''}</span>
          <span class="pix-aname"><b>${esc(a.name)}</b><span class="muted num">${plural(a.steps.length, 'step')} · ${a.fps}/s${a.steps.some((st) => st.dx || st.dy) ? ' · moves' : ''}</span></span>
          ${game ? `<span class="badge" title="Shown in the game as ${esc(game.where)}">In the game</span>` : ''}</button></li>`;
      }).join('')}</ul>` : '<p class="muted">None yet.</p>'}
      <form class="pix-resize" id="pix-anim-new-form" novalidate><label class="field">New animation <input id="pix-anim-new" maxlength="${LIMITS.name}" autocomplete="off" placeholder="Happy dance" ${full ? 'disabled' : ''}></label>
        <button class="btn small" type="submit" ${full ? 'disabled' : ''}>Add</button></form>
      ${quick.length ? `<div class="btns flow">${quick.map((g) => `<button class="btn small" type="button" data-action="pix-anim-add" data-id="${g.id}" ${full ? 'disabled' : ''}>Add ${esc(g.name)}</button>`).join('')}</div>` : ''}
      <p class="muted">The game plays ${GAME_ANIMS.map((g) => `<b>${esc(g.name)}</b> (${esc(g.where)})`).join(' and ')}, and uses the poses Walk, Jump, Front, Back, Three-quarter, Sit side to stand side and Stand to sit where there are some. Where there is none, the room draws its own kitty.</p></details>
    <details class="panel pix-group pix-fold" id="pix-fold-sprites" aria-label="Sprites" ${spritesOpen ? 'open' : ''}>
      <summary><h3>Sprites <span class="num muted">${sprites.length}</span></h3></summary>
      <div class="btns flow"><button class="btn small" type="button" data-action="pix-sprites-sort" aria-pressed="${spriteSort}" title="List the sprites by name instead of by number">Sort by name${spriteSort ? ' ✓' : ''}</button>
        <button class="btn small" type="button" data-action="pix-sprites-prune" ${unused.length ? '' : 'disabled'} title="Takes out the sprites that no animation plays">Remove unused${unused.length ? ` (${unused.length})` : ''}</button>
        <button class="btn small" type="button" data-action="pix-sprite-new" ${sprites.length >= MAX_SPRITES ? 'disabled' : ''} aria-label="New sprite">+ New</button></div>
      <div class="pix-tiles" style="${baseStyle('kitty')}">${sprites.map((sp, n) => ({ sp, n })).sort((a, b) => spriteSort ? a.sp.name.localeCompare(b.sp.name, undefined, { numeric: true, sensitivity: 'base' }) || a.n - b.n : 0).map(({ sp, n }) => `<button class="pix-tile" type="button" data-action="pix-sprite-open" data-i="${n}" title="${esc(sp.name)}"><span class="pix-pic">${pictureSvg('kitty', sp.art)}</span>
        <span class="pix-tname"><b class="num">${n + 1}</b> ${esc(sp.name)}</span></button>`).join('')}</div></details>
    ${exportHtml(mine)}`;
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
  if (c === 'kitty') id = SHEET_ID;   // the kitty is the one sprite sheet
  const shown = id ? iconsOf(pixelData(), c).find((i) => i.id === id) : undefined;
  const [w, h] = (categoryOf(c).free && shown && freeSize(shown.art)) || sizeOf(c, shown && !asCopy ? shown.id : null);
  const grid = shown ? toGrid(shown.art.map((r) => r.padEnd(w, '.').slice(0, w))) : blankGrid(w, h);
  while (grid.length < h) grid.push(Array<string>(w).fill('.'));
  draft = { cat: c, id: shown ? shown.id : null, name: shown?.name ?? '', group: shown?.group ?? USER_GROUP, grid: grid.slice(0, h), saved: '' };
  if (c === 'kitty') { draft.id = SHEET_ID; draft.name = SHEET_NAME; draft.group = USER_GROUP; }
  if (c === 'sticker') draft.food = !!shown?.food;
  stepSel = null;
  if (c === 'kitty') {
    const gridOf = (art: string[]) => { const g = toGrid(art.map((r) => r.padEnd(w, '.').slice(0, w))); while (g.length < h) g.push(Array<string>(w).fill('.')); return g.slice(0, h); };
    zoneMode = false;
    draft.sprites = shown?.sprites ? shown.sprites.map((f) => { const g = gridOf(f.art); return { id: f.id, name: f.name, grid: g, zone: zoneFromRows(g, shown.zones?.[f.id]) }; }) : [{ id: 's1', name: 'Sprite 1', grid: draft.grid, zone: fixZone(draft.grid) }];
    draft.cur = 0;
    draft.grid = draft.sprites[0].grid;
    draft.anims = (shown?.animations ?? []).map((a) => ({ ...a, steps: a.steps.map((st) => ({ ...st })), ...(a.before && { before: { ...a.before } }), ...(a.after && { after: { ...a.after } }) }));
    draft.anim = -1;   // no animation yet: the sprite on the board is on its own (see openAnim)
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

// "Additional options", closed until opened: going back to the official one (for the sprite sheet, only the open animation).
function moreHtml(d: Draft, off: boolean, saved: boolean): string {
  let body = '';
  if (d.cat === 'kitty') {
    const a = curAnim(d), has = !!a && !!officialOf('kitty', SHEET_ID)?.animations?.some((x) => x.id === a.id);
    body = has ? `<button class="btn" type="button" data-action="pix-anim-revert">Back to the official ${esc(a!.name)}</button>
      <p class="muted">Only this animation goes back as it was (its steps, speed and moves). Your sprites and the other animations stay as they are.</p>`
      : '<p class="muted">Open an official animation to bring it back as it was. Only that animation changes, never the sprites.</p>';
  } else if (off && saved) body = '<button class="btn" type="button" data-action="pix-revert-ask">Back to the official one</button>';
  else return '';
  return `<details class="pix-more"><summary>Additional options</summary><div class="btns flow">${body}</div></details>`;
}

// Zone mode's colours: the parts of the coat (the same buttons as the colours, three to a row).
function zoneInksHtml(): string {
  return `<div class="pix-inks" role="radiogroup" aria-label="Part of the coat"><div class="pix-irow pix-zrow3">${ZONE_PARTS.map(([z, label, col]) =>
    `<button type="button" class="pix-ink" role="radio" data-action="pix-zink" data-z="${z}" aria-checked="${z === zink && tool !== 'erase'}" title="${esc(label)}"><i style="background: ${col}"></i><span>${esc(label)}</span></button>`).join('')}</div>
    <p class="muted pix-note">Zone: paint where the parts of the coat are, for the Point, Patch and Calico skins. Only the coat pixels can be painted; the rest is locked. The eraser puts a pixel back in Body. Copy and paste, undo and the animation work as they do for the sprites.</p></div>`;
}

function drawHtml(): string {
  if (!draft) return `${inWardrobe() ? '' : catSeg()}<div class="panel"><h3>Nothing on the board</h3>
    <p class="muted">Open an icon from the Icons tab to change it, or start a new one.</p>
    <div class="btns"><button class="btn primary" type="button" data-action="pix-new">${iconSvg('pencil')} New ${esc(categoryOf(cat).label.toLowerCase())}</button></div></div>`;
  const d = draft, c = categoryOf(d.cat);
  const w = d.grid[0].length, h = d.grid.length;
  const off = d.id ? officialOf(d.cat, d.id) : undefined;
  const saved = !!d.id && pixelData().icons.some((i) => i.category === d.cat && i.id === d.id);
  const sheet = d.cat === 'kitty';
  const title = sheet ? `Sprite ${(d.cur ?? 0) + 1}: ${d.sprites![d.cur ?? 0].name || 'Sprite'}` : d.id ? (off ? `Changing ${off.name}` : d.name || 'Untitled') : `New ${c.label.toLowerCase()}`;
  const groups = groupsOf(liveIcons(pixelData(), d.cat));
  const group = cleanGroup(d.group, '');
  const scene = d.cat === 'scene', spots = scene && sceneMode === 'spots';
  const resizeForm = c.free ? `<form class="pix-resize" id="pix-resize-form" novalidate>
      <label class="field">Width <input id="pix-w" type="number" inputmode="numeric" min="1" max="${FREE_MAX}" value="${w}"></label>
      <span aria-hidden="true">×</span>
      <label class="field">Height <input id="pix-h" type="number" inputmode="numeric" min="1" max="${FREE_MAX}" value="${h}"></label>
      <button class="btn small" type="submit">Resize</button>
      <span class="muted">${sheet ? 'Every sprite takes the new size. Keeps the bottom-left corner, where the kitty stands' : 'Keeps the top-left corner'}; use the arrows below to move the drawing.</span></form>` : '';
  return `<div class="panel pix-draw">
    <div class="pix-dhead">${sheet ? '<button class="btn small" type="button" data-action="pix-close">&larr; Kitty sprites</button>' : ''}<h3>${esc(title)}</h3><span class="muted num" id="pix-size">${w} × ${h} · ${esc(c.label)}</span></div>
    ${c.free && !sheet ? resizeForm : ''}
    ${scene ? `<div class="seg pix-modes" role="tablist" aria-label="Board">${([['draw', 'Draw'], ['spots', 'Kitty spots']] as const).map(([m, label]) =>
      `<button type="button" role="tab" data-action="pix-scene-mode" data-mode="${m}" aria-selected="${m === sceneMode}">${label}</button>`).join('')}</div>` : ''}
    <div class="pix-tools" ${spots ? 'hidden' : ''}>
      <div class="seg" role="toolbar" aria-label="Tool">${ALL_TOOLS.map(([t, label]) => `<button type="button" data-action="pix-tool" data-tool="${t}" aria-pressed="${t === tool}" aria-label="${label}" title="${label}">${toolIcon(t)}</button>`).join('')}</div>
      <div class="seg" role="toolbar" aria-label="Board"><button type="button" data-action="pix-mirror" aria-pressed="${mirror}" aria-label="Mirror" title="Mirror: draw on both halves">${toolIcon('mirror')}</button></div>
    </div>
    <div class="seg pix-zooms" role="radiogroup" aria-label="Zoom">${ZOOMS.map((z) =>
      `<button type="button" role="radio" data-action="pix-zoom" data-zoom="${z}" aria-checked="${z === zoom}">${z}×</button>`).join('')}</div>
    <div class="pix-stage">
    ${spots || zoneMode ? '' : recentBar(d.cat)}
    <div class="pix-board-wrap${scene ? ' scene' : ''}${zoom > 1 ? ' zoomed' : ''}" id="pix-board-wrap" style="${baseStyle(d.cat)}; --zoom: ${zoom}"><div class="pix-board${scene ? ' scene' : ''}${spots ? ' spots' : ''}" id="pix-board" data-tool="${tool}" style="--bw-cells: ${w}; --bh-cells: ${h}" role="img" aria-label="Drawing board, ${w} by ${h} pixels"></div></div>
    </div>
    <div class="pix-selbar" id="pix-selbar" aria-live="polite"></div>
    ${scene && !spots ? `<div class="btns flow pix-photo"><button class="btn small" type="button" data-action="pix-photo">Use a photo…</button>
      <span class="muted">It is turned into pixel art in the app's colours, to touch up.</span><input type="file" id="pix-photo" accept="image/*" hidden></div>` : ''}
    <div class="pix-actions" ${spots ? 'hidden' : ''}>
      <button class="btn small" type="button" data-action="pix-undo" ${undos.length ? '' : 'disabled'}>Undo</button>
      <button class="btn small" type="button" data-action="pix-redo" ${redos.length ? '' : 'disabled'}>Redo</button>
      <button class="btn small" type="button" data-action="pix-flip" title="Flip the drawing, or the selection" ${zoneMode ? 'disabled' : ''}>Flip</button>
      <button class="btn small" type="button" data-action="pix-clear">Clear</button>
      <span class="pix-break"></span>
      <button class="btn small" type="button" data-action="pix-pen" aria-pressed="${penOnly}" title="Pen: only the pen draws, fingers and the palm are ignored">Pen</button>
      ${sheet ? `<button class="btn small" type="button" data-action="pix-zone-mode" aria-pressed="${zoneMode}" title="Zone: draw where the parts of the coat are (face, ears, tail, patches) instead of the sprite">Zone</button>` : ''}
      <button class="btn small" type="button" data-action="pix-shift" data-dx="-1" data-dy="0" aria-label="Move left" ${zoneMode ? 'disabled' : ''}>${iconSvg('prev')}</button>
      <button class="btn small" type="button" data-action="pix-shift" data-dx="1" data-dy="0" aria-label="Move right" ${zoneMode ? 'disabled' : ''}>${iconSvg('next')}</button>
      <button class="btn small pix-up" type="button" data-action="pix-shift" data-dx="0" data-dy="-1" aria-label="Move up" ${zoneMode ? 'disabled' : ''}>${iconSvg('prev')}</button>
      <button class="btn small pix-down" type="button" data-action="pix-shift" data-dx="0" data-dy="1" aria-label="Move down" ${zoneMode ? 'disabled' : ''}>${iconSvg('next')}</button>
    </div>
    ${spots ? '' : zoneMode ? zoneInksHtml() : inksHtml(d.cat)}
    ${sheet ? spriteBar(d) + (zoneMode ? '' : resizeForm) : ''}
    ${!c.base || zoneMode ? '' : `<p class="muted pix-note">${c.outline ? 'The lit and shaded edges of the base colour are added for you where it touches the outside: draw the dark outline yourself. ' : ''}<b>Base colour</b> follows the card or note. Show it in:</p>
    <div class="seg pix-bases" role="radiogroup" aria-label="Show the base colour in">${NOTE_COLORS.map((n) =>
      `<button type="button" role="radio" data-action="pix-base" data-base="${n}" aria-checked="${n === base}"><i style="background: ${COLOR[n][0]}"></i>${COLOR[n][1]}</button>`).join('')}</div>`}
  </div>
  ${sheet ? animHtml(d) : ''}
  ${scene || sheet ? '' : '<div class="panel"><h3>Preview</h3><div id="pix-preview" class="pix-preview"></div></div>'}
  <form class="panel pix-save" id="pix-form" novalidate>
    ${sheet ? '' : `<label class="field">Name <input id="pix-name" maxlength="${LIMITS.name}" autocomplete="off" value="${esc(d.name)}" placeholder="${esc(off?.name ?? 'Teapot')}"></label>`}
    ${scene || sheet ? '' : groupPicker('pix-group', 'Group', groups, group)}
    ${d.cat === 'sticker' ? `<label class="check"><input type="checkbox" id="pix-food" ${d.food ? 'checked' : ''}><span><b>Can kitty eat this?</b><br><span class="muted">Then it is cat food too: Habit Kitty's feed button gives each kitty a different one every day.</span></span></label>` : ''}
    <div class="btns flow">
      <button class="btn primary" type="submit">Save</button>
      ${d.id && !isFixed(d.cat) && !sheet ? '<button class="btn" type="button" data-action="pix-copy">Save as a new icon</button>' : ''}
      ${(!off && saved) || (off && canDeleteOfficial(d.cat, off.id)) ? `<button class="btn danger" type="button" data-action="pix-delete">${iconSvg('x')} ${sheet ? 'Delete the sprite sheet' : 'Delete'}</button>` : ''}
      <button class="btn" type="button" data-action="pix-close">Close</button>
    </div>
    ${moreHtml(d, !!off, saved)}
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
    : g.map((row, y) => row.map((ch, x) => `<i data-x="${x}" data-y="${y}" style="background: ${boardColor(d, x, y, ch)}"></i>`).join('')).join(''))
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
        <button class="btn small" type="button" data-action="pix-sel-copy">Copy</button>
        ${clip && clip.zone === zoneMode ? '<button class="btn small" type="button" data-action="pix-sel-paste">Paste</button>' : ''}
        <button class="btn small danger" type="button" data-action="pix-sel-del">${iconSvg('x')} Delete</button>
        <button class="btn small primary" type="button" data-action="pix-sel-done">Done</button></div>`
    : tool === 'select'
      ? `<span class="muted">Drag a box over the drawing to pick it up.</span>
        <div class="btns flow"><button class="btn small" type="button" data-action="pix-sel-all">Select all</button>
          ${clip && clip.zone === zoneMode ? '<button class="btn small" type="button" data-action="pix-sel-paste">Paste</button>' : ''}</div>`
      : '';
}
// The colour of a board cell: its letter's colour, or in zone mode the colour of its part (a pixel that is not coat is shown as drawn, locked).
const isCoat = (d: Draft, x: number, y: number) => COAT_LETTERS.includes(d.sprites?.[d.cur ?? 0]?.grid[y]?.[x] ?? '.');
function boardColor(d: Draft, x: number, y: number, ch: string): string {
  if (!zoneMode) return cellColor(d.cat, ch);
  return isCoat(d, x, y) ? zoneColor(ch) || zoneColor('b') : cellColor(d.cat, d.sprites![d.cur ?? 0].grid[y]?.[x] ?? '.');
}
function paintCell(x: number, y: number, ch: string) {
  if (!draft) return;
  const g = draft.grid, w = g[0].length;
  const xs = mirror ? [x, w - 1 - x] : [x];
  if (zoneMode && ch === '.') ch = 'b';   // erasing a zone puts the pixel back in Body
  for (const xx of xs) {
    if (g[y]?.[xx] === undefined || g[y][xx] === ch) continue;
    if (zoneMode && !isCoat(draft, xx, y)) continue;   // the outline and the rest are locked
    g[y][xx] = ch;
    if (draft.cat === 'scene') { paintPixel(xx, y, ch); continue; }
    const el = document.querySelector<HTMLElement>(`#pix-board > i[data-x="${xx}"][data-y="${y}"]`);
    if (el) el.style.background = boardColor(draft, xx, y, ch);
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
  fitSprites();
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
  if (penOnly && ev.pointerType === 'touch') { ev.preventDefault(); return; }   // a finger or a palm, with Pen on
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
  if (t === 'select') { selectDown(ev, board as HTMLElement, at); return; }
  if (sel) { settle(); renderBoard(); }
  if (t === 'pick') {
    const ch = draft.grid[y][x];
    if (zoneMode) { if (ch !== '.') zink = ch; } else useInk(ch);
    tool = 'pencil'; render();   // an empty cell picks Empty
    return;
  }
  const ch = zoneMode ? (t === 'erase' ? 'b' : zink) : t === 'erase' ? '.' : ink;
  if (t === 'fill') { if (!zoneMode || isCoat(draft, x, y)) edit((g) => floodFill(g, x, y, ch)); return; }
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
  const fn = document.getElementById('pix-sprite-name') as HTMLInputElement | null;
  if (fn && draft.sprites && draft.cur !== undefined) draft.sprites[draft.cur].name = fn.value;
  const an = document.getElementById('pix-anim-name') as HTMLInputElement | null, a = curAnim(draft);
  if (an && a) a.name = an.value;
}
async function save(asNew: boolean) {
  if (!draft) return;
  readFields();
  settle();
  const d = draft;
  if (d.cat === 'kitty') { await saveSheet(d); return; }
  const art = toArt(d.grid);
  if (isBlank(art)) { toast('Draw something first.'); return; }
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
  const ok = await setPixelData(putIcon(pixelData(), { category: d.cat, id, name, group, art, ...(d.spots && { spots: d.spots }), ...(d.props && { props: d.props }), ...(d.cat === 'sticker' && { food: !!d.food }) }));
  if (!ok) { toast("Couldn't save. Try again."); return; }
  d.id = id; d.name = name; d.group = group; d.saved = artKey(d);
  toast(asNew ? `Saved as ${name}.` : `Saved ${name}.`);
  render();
}
// The sprite sheet: all the sprites and all the animations, saved together.
async function saveSheet(d: Draft) {
  syncSprite(); fitSprites();
  const sprites = d.sprites!.map((f) => ({ id: f.id, name: cleanName(f.name, 'Sprite'), art: toArt(f.grid) }));
  const zones = Object.fromEntries(d.sprites!.map((f) => [f.id, zoneToRows(fixZone(f.grid, f.zone))]));
  if (sprites.every((f) => isBlank(f.art))) { toast('Draw something first.'); return; }
  const twin = sprites.find((f, i) => sprites.findIndex((o) => o.name.toLowerCase() === f.name.toLowerCase()) !== i);
  if (twin) { toast(`Two sprites are called ${twin.name}. Give each sprite its own name.`); return; }
  const anims = d.anims ?? [];
  const same = anims.find((a, i) => anims.findIndex((o) => o.name.trim().toLowerCase() === a.name.trim().toLowerCase()) !== i);
  if (same) { toast(`Two animations are called ${same.name}. Give each animation its own name.`); return; }
  const ok = await setPixelData(putIcon(pixelData(), { category: 'kitty', id: SHEET_ID, name: SHEET_NAME, group: USER_GROUP, art: sprites[0].art, sprites, animations: cleanAnimations(anims, sprites), zones }));
  if (!ok) { toast("Couldn't save. Try again."); return; }
  d.saved = artKey(d);
  toast('Saved the sprite sheet.');
  render();
}

// ---- the kitty: a list of sprites, and animations that play them ----
// The sprites are named drawings (all one size), numbered by their place in the list. An animation is a list of steps: each plays a sprite
// and may move it (forward, up, from where it is drawn), so a sprite is drawn once and played by every animation (and at several places),
// and what you draw on it shows in every step that plays it. Open an animation (from the Kitty tab) to design it: pick its steps from the
// sprites, or make a new sprite, which goes into the one list of sprites.
// The pose the kitty rests in before and after an animation (sitting: Idle's first drawing, or standing: the last step of Sit side to stand side),
// shown faint (a ghost) before the first step and after the last, where the animation says it is (see Ghost in ./model.ts). Idle has none.
// A number to type. No inputmode: with one the phone's number pad has no minus sign, and without it (a plain number field) the pad has a minus.
const numField = (id: string, v: number) => `<input id="${id}" type="number" step="1" min="${-MAX_SHIFT}" max="${MAX_SHIFT}" value="${v}">`;
const REST_NAMES: Record<Anchor, string> = { idle: 'Sitting', stand: 'Standing' };
const restArt = (d: Draft, pose: Anchor): string[] | null => {
  const an = d.anims?.find((x) => x.id === (pose === 'idle' ? 'idle' : 'sit2stand')), id = pose === 'idle' ? an?.steps[0]?.id : an?.steps[an.steps.length - 1]?.id;
  const i = id ? d.sprites!.findIndex((f) => f.id === id) : -1;
  return i >= 0 ? toArt(liveGrid(d, i)) : null;
};
const restZone = (d: Draft, pose: Anchor): Grid | null => {
  if (!zoneMode) return null;
  const an = d.anims?.find((x) => x.id === (pose === 'idle' ? 'idle' : 'sit2stand')), id = pose === 'idle' ? an?.steps[0]?.id : an?.steps[an.steps.length - 1]?.id;
  const i = id ? d.sprites!.findIndex((f) => f.id === id) : -1;
  return i >= 0 ? liveZone(d, i) : null;
};
type Rest = { pose: Anchor; dx: number; dy: number; art: string[]; zone: Grid | null };
const restOf = (d: Draft, a: Animation, which: 'before' | 'after'): { pose: Anchor; dx: number; dy: number } => {
  const g = a[which];
  return { pose: g?.pose ?? defaultGhosts(a.id)[which], dx: g?.dx ?? 0, dy: g?.dy ?? 0 };
};
const ghostsOf = (d: Draft, a: Animation): { before: Rest | null; after: Rest | null } => {
  if (a.id === 'idle') return { before: null, after: null };
  const mk = (which: 'before' | 'after') => { const r = restOf(d, a, which), art = restArt(d, r.pose); return art ? { ...r, art, zone: restZone(d, r.pose) } : null; };
  return { before: mk('before'), after: mk('after') };
};
const ghostChip = (r: Rest, which: 'before' | 'after', on: boolean) =>
  `<button type="button" class="pix-fchip pix-ghost" data-action="pix-rest-pick" data-which="${which}" aria-pressed="${on}"><b class="num">&nbsp;</b><span class="pix-fth">${layerSvg(r.art, r.zone)}</span><span>${REST_NAMES[r.pose]} ${which}</span>${moveText(r) ? `<span class="muted pix-fmove">${esc(moveText(r))}</span>` : ''}</button>`;
const thumb = (d: Draft, i: number) => `<span class="pix-fth">${layerSvg(toArt(liveGrid(d, i)), zoneMode ? liveZone(d, i) : null)}</span>`;
// The picture and the zones of sprite i: the one on the board is d.grid in whichever layer is showing, the other layer is stored in the sprite.
const liveGrid = (d: Draft, i: number) => (i === d.cur && !zoneMode ? d.grid : d.sprites![i].grid);
const liveZone = (d: Draft, i: number) => (i === d.cur && zoneMode ? d.grid : d.sprites![i].zone);
const loadBoard = (d: Draft) => { const f = d.sprites![d.cur ?? 0]; d.grid = zoneMode ? f.zone : f.grid; };
const curAnim = (d: Draft): Animation | undefined => (d.anim !== undefined && d.anim >= 0 ? d.anims?.[d.anim] : undefined);
// "forward 3, up 2": what a step's move says, in words.
const moveText = (st: { dx?: number; dy?: number }) => [st.dx ? (st.dx > 0 ? `forward ${st.dx}` : `back ${-st.dx}`) : '', st.dy ? (st.dy > 0 ? `up ${st.dy}` : `down ${-st.dy}`) : ''].filter(Boolean).join(', ');
// n is the sprite's number in the list; ai is what the button hands over (a step's place, say) when that is not the sprite's.
const fchip = (d: Draft, i: number, action: string, on: boolean, n: number, ai?: number, sub = '') =>
  `<button type="button" class="pix-fchip" data-action="${action}" data-i="${ai ?? i}" aria-pressed="${on}"><b class="num">${n}</b>${thumb(d, i)}<span>${esc(d.sprites![i].name || 'Sprite')}</span>${sub ? `<span class="muted pix-fmove">${esc(sub)}</span>` : ''}</button>`;
// Onion skin: the step before the one on the board (or the sprite before it, when it is on its own), faint (50%) behind what you draw, where
// the move puts it, to line the two up. It can be turned off.
let onion = true;
let addOpen = false;   // the Add a step menu is closed until it is opened
function onionHtml(d: Draft): string {
  if (!onion || !d.sprites) return '';
  const a = curAnim(d), cur = d.cur ?? 0;
  let prev: DraftSprite | undefined, ox = 0, oy = 0;
  if (a && stepSel !== null && stepSel > 0 && a.steps[stepSel - 1]) {
    const was = a.steps[stepSel - 1], now = a.steps[stepSel];
    prev = d.sprites.find((f) => f.id === was.id);
    ox = (now.dx ?? 0) - (was.dx ?? 0); oy = (now.dy ?? 0) - (was.dy ?? 0);   // a step that moved forward 3 is 3 pixels further left
  } else if (!a && cur) prev = d.sprites[cur - 1];
  if (!prev) return '';
  const w = d.grid[0].length, h = d.grid.length;
  return `<div class="pix-onion" style="transform: translate(${(ox / w) * 100}%, ${(oy / h) * 100}%)" aria-hidden="true">${layerSvg(toArt(prev.grid), zoneMode ? prev.zone : null)}</div>`;
}
// The sprite on the board: its name, and to add another, copy it, move or delete it. Under the animation, above the board.
function spriteBar(d: Draft): string {
  if (!d.sprites) return '';
  const sprites = d.sprites, cur = d.cur ?? 0, a = curAnim(d);
  const prev = a && stepSel !== null && stepSel > 0 ? sprites.find((f) => f.id === a.steps[stepSel - 1]?.id) : !a && cur ? sprites[cur - 1] : undefined;
  return `<div class="pix-framebar">
    <label class="field">Sprite ${cur + 1} of ${sprites.length}: name <input id="pix-sprite-name" maxlength="${LIMITS.name}" autocomplete="off" value="${esc(sprites[cur].name)}"></label>
    <p class="muted">Draw the kitty standing on the bottom edge of the board: the animation moves it from there.</p>
    <div class="btns flow"><button class="btn small" type="button" data-action="pix-sprite-add" ${sprites.length >= MAX_SPRITES ? 'disabled' : ''}>New sprite</button>
      <button class="btn small" type="button" data-action="pix-sprite-copy" ${sprites.length >= MAX_SPRITES ? 'disabled' : ''}>Copy this sprite</button>
      <button class="btn small" type="button" data-action="pix-sprite-left" ${cur === 0 ? 'disabled' : ''} aria-label="Move this sprite earlier in the list">&larr; Earlier</button>
      <button class="btn small" type="button" data-action="pix-sprite-right" ${cur >= sprites.length - 1 ? 'disabled' : ''} aria-label="Move this sprite later in the list">Later &rarr;</button>
      <button class="btn small danger" type="button" data-action="pix-sprite-del" ${sprites.length < 2 ? 'disabled' : ''}>${iconSvg('x')} Delete sprite</button></div>
    <label class="check"><input type="checkbox" id="pix-onion" ${onion ? 'checked' : ''}><span><b>Show the step before</b><br><span class="muted">Faint (50%) behind your drawing, where its move puts it, to line the sprites up. ${prev ? `Now showing ${esc(prev.name || 'Sprite')}.` : 'There is none before this one.'}</span></span></label></div>`;
}
// The resting pose picked: sitting or standing, and the same Forward and Up as a step: where it is from the first step (before) or the last (after).
function restPanel(d: Draft, a: Animation, which: 'before' | 'after'): string {
  const r = restOf(d, a, which);
  return `<div class="pix-resize"><label class="field">Pose ${which === 'before' ? 'before the first step' : 'after the last step'}
      <select id="pix-rest-pose">${(['idle', 'stand'] as Anchor[]).map((p) => `<option value="${p}" ${p === r.pose ? 'selected' : ''} ${restArt(d, p) ? '' : 'disabled'}>${REST_NAMES[p]}</option>`).join('')}</select></label>
    <span class="muted">A walk goes from standing to standing; a jump can start and end either way. Forward and up (above the steps) say where this pose is from the ${which === 'before' ? 'first' : 'last'} step: move it until it lines up with that step.</span></div>`;
}
// The animation being designed, above the sprite on the board: its steps, where they move, the sprites to pick from, and a preview.
function animHtml(d: Draft): string {
  const sprites = d.sprites!, cur = d.cur ?? 0, anims = d.anims ?? [];
  const a = curAnim(d);
  if (!a) {
    return `<div class="panel pix-animp"><div class="pix-dhead"><h3>${esc(sprites[cur].name || 'Sprite')}</h3></div>
      <p class="muted">This sprite is on its own. Draw it below, or play it as a step of an animation:</p>
      ${anims.length ? `<div class="btns flow">${anims.map((x, i) => `<button class="btn small" type="button" data-action="pix-sprite-to-anim" data-i="${i}" ${x.steps.length >= MAX_STEPS ? 'disabled' : ''}>Add to ${esc(x.name)}</button>`).join('')}</div>` : '<p class="muted">There are no animations yet: make one on the Kitty tab.</p>'}</div>`;
  }
  const idx = new Map(sprites.map((f, i) => [f.id, i]));
  const game = GAME_ANIMS.find((g) => g.id === a.id);
  const seq = a.steps, st = stepSel !== null ? seq[stepSel] : undefined, ghost = ghostsOf(d, a), rs = restSel && restSel.anim === a.id && ghost[restSel.which] ? restSel.which : null;
  const picker = `<div class="pix-fstrip" role="group" aria-label="Sprites to add">${sprites.map((f, i) => fchip(d, i, 'pix-step-add', false, i + 1)).join('')}
    <button type="button" class="pix-fchip pix-fnew" data-action="pix-sprite-add" ${sprites.length >= MAX_SPRITES ? 'disabled' : ''}><b class="num">+</b><span>New sprite</span></button></div>`;
  return `<div class="panel pix-animp"><div class="pix-dhead"><h3>${esc(a.name)} <span class="num muted">${plural(seq.length, 'step')}</span></h3></div>
    <p class="muted">${game ? `The game plays this as ${esc(game.where)}.` : `The game plays ${GAME_ANIMS.map((g) => esc(g.name)).join(' and ')}, and the poses Walk, Jump, Front, Back, Three-quarter, Sit side to stand side and Stand to sit; this one is yours to keep.`}</p>
    <div class="pix-animview"><div class="pix-animbox"><div class="pix-anim" id="pix-anim" style="--w:${d.grid[0].length};--h:${d.grid.length};${baseStyle('kitty')}" aria-hidden="true"></div><p class="muted pix-animcap" id="pix-animcap"></p></div>
      <div class="stack"><label class="field">Animation name <input id="pix-anim-name" maxlength="${LIMITS.name}" autocomplete="off" value="${esc(a.name)}"></label>
        <label class="field">Speed <select id="pix-fps">${FPS_CHOICES.map((n) => `<option value="${n}" ${n === a.fps ? 'selected' : ''}>${n} ${n === 1 ? 'step' : 'steps'} a second</option>`).join('')}</select></label>
        <div class="btns flow"><button class="btn small" type="button" data-action="pix-anim-toggle">${animPlaying ? 'Pause' : 'Play'}</button>
          <button class="btn small" type="button" data-action="pix-anim-png" ${seq.length ? '' : 'disabled'} title="Every step side by side in one picture, to check the drawing">Save steps as a picture</button></div></div></div>
    ${st ? `<div class="pix-resize"><label class="field">Forward ${numField('pix-step-dx', st.dx ?? 0)}</label>
        <label class="field">Up ${numField('pix-step-dy', st.dy ?? 0)}</label>
        <span class="muted">How far step ${stepSel! + 1} moves its sprite from where it is drawn, in pixels: forward is the way the kitty faces (use a minus to go back), up is off the ground (in the air). Both 0 is where it is drawn.</span></div>`
      : rs ? `<div class="pix-resize"><label class="field">Forward ${numField('pix-step-dx', restOf(d, a, rs).dx)}</label>
        <label class="field">Up ${numField('pix-step-dy', restOf(d, a, rs).dy)}</label>
        <span class="muted">How far the ${REST_NAMES[restOf(d, a, rs).pose].toLowerCase()} pose is from the ${rs === 'before' ? 'first' : 'last'} step, in pixels (forward is the way the kitty faces; use a minus to go back).</span></div>` : ''}
    <h3>Steps</h3>
    ${seq.length ? `<div class="pix-fstrip" role="group" aria-label="Steps">${ghost.before ? ghostChip(ghost.before, 'before', rs === 'before') : ''}${seq.map((x, n) => fchip(d, idx.get(x.id) ?? 0, 'pix-step-pick', n === stepSel, (idx.get(x.id) ?? 0) + 1, n, moveText(x))).join('')}${ghost.after ? ghostChip(ghost.after, 'after', rs === 'after') : ''}</div>`
      : '<p class="muted">No steps yet. Pick a sprite below, or make a new one.</p>'}
    ${st ? `<div class="btns flow"><button class="btn small" type="button" data-action="pix-step-left" aria-label="Move step earlier" ${stepSel! < 1 ? 'disabled' : ''}>${iconSvg('prev')}</button>
      <button class="btn small" type="button" data-action="pix-step-right" aria-label="Move step later" ${stepSel! >= seq.length - 1 ? 'disabled' : ''}>${iconSvg('next')}</button>
      <button class="btn small" type="button" data-action="pix-step-dup" ${seq.length >= MAX_STEPS ? 'disabled' : ''}>Repeat step</button>
      <button class="btn small" type="button" data-action="pix-step-del">Remove step</button></div>`
      : rs ? restPanel(d, a, rs)
      : (seq.length ? `<p class="muted">Tap a step to draw its sprite, and to move it.${ghost.before || ghost.after ? ' Tap a faint kitty (the pose before and after) to line it up.' : ''}</p>` : '')}
    <details class="pix-add" id="pix-addstep" ${addOpen ? 'open' : ''}><summary><h3>Add a step</h3></summary>
    <p class="muted">Pick a sprite from the list ${stepSel === null ? 'to add at the end' : `to add after step ${stepSel + 1}`}, or make a new one: it goes into the list too.</p>
    ${picker}</details>
    <div class="btns flow"><button class="btn small" type="button" data-action="pix-pingpong" ${seq.length < 2 || seq.length * 2 - 1 > MAX_STEPS ? 'disabled' : ''} title="Plays the steps forward, then back again: 1 2 3 becomes 1 2 3 2 1">Play it back too</button>
      <button class="btn small danger" type="button" data-action="pix-anim-del">${iconSvg('x')} Delete animation</button></div>
    <label class="field">Sprite numbers <input id="pix-steps" inputmode="text" autocomplete="off" value="${esc(stepsToText(seq, sprites))}" placeholder="1 2 3 2 1"></label>
    <p class="muted">The same steps by their sprite numbers (typing them keeps the moves of steps that stay the same). <b>1-4</b> is 1 2 3 4, and <b>4-1</b> plays it backwards.</p></div>`;
}

// The animation plays on the page while the board is open, at the speed chosen, from what is on the board now, each step where its move puts it.
let animTimer: ReturnType<typeof setInterval> | undefined;
let animI = 0;
let animPlaying = true;
// A walk that loops ends on its first step again, moved on: that is where the next round starts, so it is not played twice (see loopOf in
// ../shared/kittysheet.ts).
const playedSteps = (steps: Step[]) => { const f = steps[0], l = steps[steps.length - 1]; return steps.length >= 3 && l.id === f.id && (l.dx || l.dy) ? steps.slice(0, -1) : steps; };
// The paths of a picture (the inside of its svg), to draw it moved.
const inner = (art: string[], zone: Grid | null = null) => layerSvg(art, zone).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
function drawAnim() {
  const el = document.getElementById('pix-anim');
  const d = draft, a = d && curAnim(d);
  if (!el || !d?.sprites || !a) { stopAnim(); return; }
  const byId = new Map(d.sprites.map((f, i) => [f.id, i]));
  const steps = playedSteps(a.steps.filter((st) => byId.has(st.id)));
  if (!steps.length) { el.innerHTML = ''; return; }
  // the box that holds every step where it is played, so the kitty is not still while the picture moves about
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of steps) toArt(liveGrid(d, byId.get(st.id)!)).forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') {
    x0 = Math.min(x0, x - (st.dx ?? 0)); x1 = Math.max(x1, x - (st.dx ?? 0)); y0 = Math.min(y0, y - (st.dy ?? 0)); y1 = Math.max(y1, y - (st.dy ?? 0)); } });
  // and the resting poses before and after, where the animation puts them (after: from the last step, which a looping walk's closing step carries)
  const gh = ghostsOf(d, a), end = a.steps[a.steps.length - 1] ?? {};
  const ghosts = [gh.before && { art: gh.before.art, zone: gh.before.zone, gx: gh.before.dx, gy: gh.before.dy }, gh.after && { art: gh.after.art, zone: gh.after.zone, gx: (end.dx ?? 0) + gh.after.dx, gy: (end.dy ?? 0) + gh.after.dy }].filter((g): g is { art: string[]; zone: Grid | null; gx: number; gy: number } => !!g);
  for (const { art, gx, gy } of ghosts) art.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') {
    x0 = Math.min(x0, x - gx); x1 = Math.max(x1, x - gx); y0 = Math.min(y0, y - gy); y1 = Math.max(y1, y - gy); } });
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = d.grid[0].length - 1; y1 = d.grid.length - 1; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  animI %= steps.length;
  const st = steps[animI], i = byId.get(st.id)!;
  el.style.setProperty('--w', String(w)); el.style.setProperty('--h', String(h));
  el.innerHTML = `<svg class="pxs fine" style="--w:${w};--h:${h}" viewBox="${x0} ${y0} ${w} ${h}" aria-hidden="true" shape-rendering="crispEdges">${ghosts.map(({ art, zone, gx, gy }) => `<g opacity=".35" transform="translate(${-gx} ${-gy})">${inner(art, zone)}</g>`).join('')}<g transform="translate(${-(st.dx ?? 0)} ${-(st.dy ?? 0)})">${inner(toArt(liveGrid(d, i)), zoneMode ? liveZone(d, i) : null)}</g></svg>`;
  const cap = document.getElementById('pix-animcap');
  if (cap) cap.textContent = `Step ${animI + 1} of ${steps.length}: sprite ${i + 1}, ${d.sprites[i].name || 'Sprite'}${moveText(st) ? `, ${moveText(st)}` : ''}`;
  animI++;
}
// The animation's steps side by side in one PNG, each as drawn (where its move puts it is written under it), to check the drawing.
async function exportStrip() {
  const d = draft, a = d && curAnim(d);
  if (!d?.sprites || !a) return;
  readFields();
  const byId = new Map(d.sprites.map((f, i) => [f.id, i]));
  const steps = playedSteps(a.steps.filter((st) => byId.has(st.id)));
  if (!steps.length) { toast('This animation has no steps yet.'); return; }
  type Layer = { art: string[]; ox: number; oy: number; alpha: number };
  type Cell = { layers: Layer[]; label: string; sub: string };
  const cells: Cell[] = steps.map((st, n) => ({ layers: [{ art: toArt(liveGrid(d, byId.get(st.id)!)), ox: 0, oy: 0, alpha: 1 }], label: `${n + 1}  sprite ${byId.get(st.id)! + 1}`, sub: moveText(st) }));
  // the resting poses before the first step and after the last, each over that step where the animation puts it (the steps are drawn where
  // their moves put them, so the poses are against them as they are in the room)
  const gh = ghostsOf(d, a), all = a.steps.filter((st) => byId.has(st.id)), f0 = all[0], fl = all[all.length - 1];
  const artOf = (st: Step) => toArt(liveGrid(d, byId.get(st.id)!));
  if (gh.before && f0) cells.unshift({ layers: [{ art: artOf(f0), ox: -(f0.dx ?? 0), oy: -(f0.dy ?? 0), alpha: 1 }, { art: gh.before.art, ox: -gh.before.dx, oy: -gh.before.dy, alpha: 0.4 }], label: `${REST_NAMES[gh.before.pose]} before`, sub: moveText(gh.before) });
  if (gh.after && fl) cells.push({ layers: [{ art: artOf(fl), ox: -(fl.dx ?? 0), oy: -(fl.dy ?? 0), alpha: 1 }, { art: gh.after.art, ox: -((fl.dx ?? 0) + gh.after.dx), oy: -((fl.dy ?? 0) + gh.after.dy), alpha: 0.4 }], label: `${REST_NAMES[gh.after.pose]} after`, sub: moveText(gh.after) });
  const box = (cs: Cell[]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cs) for (const l of c.layers) l.art.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') { x0 = Math.min(x0, x + l.ox); x1 = Math.max(x1, x + l.ox); y0 = Math.min(y0, y + l.oy); y1 = Math.max(y1, y + l.oy); } });
    return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  if (!isFinite(box(cells).x0)) { toast('The steps are empty.'); return; }
  const S = 6, G = 3 * S, head = 20, foot = 22;
  const fur = getComputedStyle(document.getElementById('pix-anim') ?? document.body).color.match(/\d+/g)?.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('') ?? 'ffb98a';
  const ink = inkFor(`#${fur}`);
  const real = box(cells.filter((c) => c.layers.length === 1)), own = cells.map((c) => (c.layers.length === 1 ? (isFinite(real.x0) ? real : box([c])) : box([c])));
  const cv = document.createElement('canvas');
  cv.width = G + own.reduce((n, b) => n + b.w * S + G, 0); cv.height = head + Math.max(...own.map((b) => b.h)) * S + foot + G;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fffafd'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = 'bold 15px monospace'; g.textBaseline = 'middle';
  let left = G;
  cells.forEach((c, n) => {
    const b = own[n], ghosted = c.layers.length > 1, hh = Math.max(...own.map((o) => o.h)) * S;
    g.strokeStyle = 'rgba(61,44,99,0.25)'; g.setLineDash(ghosted ? [4, 4] : []); g.lineWidth = 1; g.strokeRect(left - 0.5, head - 0.5, b.w * S + 1, hh + 1);
    for (const l of c.layers) {
      g.globalAlpha = l.alpha;
      l.art.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = row[x] !== '.' ? ink(row[x]) : undefined; if (col) { g.fillStyle = col; g.fillRect(left + (x + l.ox - b.x0) * S, head + (y + l.oy - b.y0) * S, S, S); } } });
    }
    g.globalAlpha = 1;
    g.fillStyle = '#3d2c63';
    g.fillText(c.label, left, head / 2);
    if (c.sub) g.fillText(c.sub, left, head + hh + foot / 2 + 2);
    left += b.w * S + G;
  });
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
  if (!blob) { toast("Couldn't make the picture."); return; }
  const name = `${(a.name || 'animation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'animation'}-steps-${today()}-${hhmm()}.png`;
  try {
    const where = await saveToDevice(name, new Uint8Array(await blob.arrayBuffer()));
    if (where !== null) toast(where ? `Saved: ${where}` : 'Picture downloaded.');
  } catch { toast("Couldn't save the picture."); }
}
function stopAnim() { if (animTimer !== undefined) clearInterval(animTimer); animTimer = undefined; }
function restartAnim() {
  stopAnim();
  const a = draft && curAnim(draft);
  if (!draft?.sprites || !a || tab !== 'draw') return;
  if (!animPlaying) animI = Math.max(0, animI - 1);   // paused: the page is drawn again (a tap, a step picked) but the picture holds still
  drawAnim();
  if (animPlaying) animTimer = setInterval(drawAnim, 1000 / (a.fps || DEFAULT_FPS));
}
// The sprite on the board is stored with the others before anything switches, saves or counts them.
function syncSprite() {
  if (!draft?.sprites || draft.cur === undefined) return;
  if (zoneMode) draft.sprites[draft.cur].zone = draft.grid; else draft.sprites[draft.cur].grid = draft.grid;
}
// Zone mode keeps every coat pixel in a part and every other pixel out of one (the picture can have changed since the zones were drawn).
function fixCurZone() {
  if (!zoneMode || !draft?.sprites || draft.cur === undefined) return;
  const fixed = fixZone(draft.sprites[draft.cur].grid, draft.grid);
  draft.grid.forEach((row, y) => row.forEach((c, x) => { if (c !== fixed[y][x]) row[x] = fixed[y][x]; }));
}
// Zone button: the board draws the zones instead of the pictures (and back). The pictures cannot change meanwhile, so the zones are checked against them first.
function toggleZone() {
  const d = draft;
  if (!d?.sprites) return;
  readFields(); settle(); syncSprite();
  zoneMode = !zoneMode;
  d.sprites.forEach((f) => { f.zone = fixZone(f.grid, f.zone); });
  loadBoard(d);
  undos = []; redos = []; sel = null; float = null;
  if (tool === 'erase' || tool === 'pick') tool = 'pencil';
  render();
}
// A sheet's sprites stand on the bottom edge of the board, so a different size keeps the bottom-left corner (other drawings keep the top-left).
function resizeGridBL(g: Grid, w: number, h: number): Grid {
  const out = blankGrid(w, h), dy = h - g.length;
  g.forEach((row, y) => row.forEach((c, x) => { if (x < w && y + dy >= 0) out[y + dy][x] = c; }));
  return out;
}
// Every sprite is the board's size (a resize, or an Undo of one, changes the board you are on).
function fitSprites() {
  if (!draft?.sprites) return;
  if (zoneMode) { syncSprite(); return; }   // (zone mode cannot resize the board)
  const w = draft.grid[0].length, h = draft.grid.length;
  draft.sprites.forEach((f, i) => {
    if (i === draft!.cur) f.grid = draft!.grid;
    else if (f.grid.length !== h || f.grid[0]?.length !== w) f.grid = resizeGridBL(f.grid, w, h);
    if (f.zone.length !== h || f.zone[0]?.length !== w) f.zone = fixZone(f.grid, resizeGridBL(f.zone, w, h));   // the zones stay where the drawing is
  });
}
// Moves the sprite on the board one place along the list. Animations name sprites by id, so they play the same; only the numbers
// (and which sprite is the sheet's picture in lists: the first) change.
function moveSprite(by: -1 | 1) {
  const d = draft;
  if (!d?.sprites) return;
  const at = d.cur ?? 0, to = at + by;
  if (to < 0 || to >= d.sprites.length) return;
  readFields(); settle(); syncSprite();
  [d.sprites[at], d.sprites[to]] = [d.sprites[to], d.sprites[at]];
  d.cur = to;
  render();
}
function selectSprite(i: number) {
  const d = draft;
  if (!d?.sprites?.[i]) return;
  readFields(); settle(); syncSprite();
  d.cur = i; loadBoard(d);
  undos = []; redos = []; sel = null; float = null;
  render();
}
// Open the sprite sheet on an animation (or on a sprite on its own: id null), from the Kitty tab.
function openKitty(animId: string | null, sprite?: number) {
  startDraft('kitty', SHEET_ID);
  const d = draft!;
  const ai = animId === null ? -1 : d.anims!.findIndex((a) => a.id === animId);
  d.anim = ai; stepSel = null; animI = 0; animPlaying = true;   // an animation opened plays
  const first = ai >= 0 ? d.sprites!.findIndex((f) => f.id === d.anims![ai].steps[0]?.id) : -1;
  if (first >= 0) { d.cur = first; loadBoard(d); stepSel = 0; }
  if (sprite !== undefined && d.sprites![sprite]) { d.cur = sprite; loadBoard(d); }
  tab = 'draw'; renderTop(); render(); window.scrollTo(0, 0);
}
// A sprite from the list opens in the first animation that plays it (on that step), or on its own.
function openSprite(i: number) {
  startDraft('kitty', SHEET_ID);
  const d = draft!, id = d.sprites![i]?.id;
  const ai = d.anims!.findIndex((a) => a.steps.some((st) => st.id === id));
  d.anim = ai; stepSel = ai >= 0 ? d.anims![ai].steps.findIndex((st) => st.id === id) : null; animI = 0;
  d.cur = i; loadBoard(d);
  tab = 'draw'; renderTop(); render(); window.scrollTo(0, 0);
}
// A new sprite, blank or a copy of the one on the board. In an animation it is also a new step (after the one picked, or at the end), which
// starts where the picked step is (so a copy carries on from it).
function addSprite(copy: boolean) {
  const d = draft;
  if (!d?.sprites || d.sprites.length >= MAX_SPRITES) return;
  readFields(); settle(); syncSprite();
  const here = d.sprites[d.cur ?? 0], a = curAnim(d);
  const sp = { id: newSpriteId(d.sprites), name: nextSpriteName(d.sprites),   // a copy is named like a new sprite: the next number
    grid: copy ? here.grid.map((r) => r.slice()) : blankGrid(here.grid[0].length, here.grid.length),
    zone: copy ? here.zone.map((r) => r.slice()) : blankGrid(here.grid[0].length, here.grid.length) };
  d.sprites.push(sp);
  if (a && a.steps.length < MAX_STEPS) {
    const at = stepSel === null ? a.steps.length : stepSel + 1, from = copy && stepSel !== null ? a.steps[stepSel] : undefined;
    a.steps.splice(at, 0, { id: sp.id, ...(from?.dx && { dx: from.dx }), ...(from?.dy && { dy: from.dy }) });
    stepSel = at;
  }
  selectSprite(d.sprites.length - 1);
}
function askDeleteSprite() {
  const d = draft;
  if (!d?.sprites || d.sprites.length < 2) return;
  readFields();
  const here = d.sprites[d.cur ?? 0];
  const uses = (d.anims ?? []).reduce((n, a) => n + a.steps.filter((st) => st.id === here.id).length, 0);
  openLayer(`<h3>Delete ${esc(here.name || 'Sprite')}?</h3>
    <p class="muted">The drawing is lost${uses ? `, and ${plural(uses, 'step')} that play${uses === 1 ? 's' : ''} it ${uses === 1 ? 'is' : 'are'} taken out of the animations` : ''}. The sprites after it get a number less.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn danger" type="button" data-action="pix-sprite-del-confirm">${iconSvg('x')} Delete</button></div>`, 'Delete sprite');
}
function deleteSprite() {
  const d = draft;
  closeLayer();
  if (!d?.sprites || d.sprites.length < 2) return;
  syncSprite();
  const at = d.cur ?? 0, r = removeSprite(d.sprites, d.anims ?? [], d.sprites[at].id);
  d.sprites = r.sprites; d.anims = r.animations; stepSel = null;
  d.cur = Math.min(at, d.sprites.length - 1); loadBoard(d);
  undos = []; redos = []; sel = null; float = null;
  render();
}
// A new animation, with no steps yet (id: one the game plays, such as idle), opened to design.
function addAnim(name: string, id?: string) {
  const d = draft;
  if (!d?.sprites) return;
  readFields();
  const anims = d.anims ?? (d.anims = []);
  const label = cleanName(name, '');
  if (!label) { toast('Give the animation a name.'); document.getElementById('pix-anim-new')?.focus(); return; }
  if (anims.length >= MAX_ANIMS) { toast(`There can be ${MAX_ANIMS} animations.`); return; }
  if (anims.some((a) => a.name.trim().toLowerCase() === label.toLowerCase())) { toast(`There's already an animation called ${label}.`); return; }
  anims.push({ id: id ?? newAnimId(label, anims), name: label, fps: DEFAULT_FPS, steps: [] });
  d.anim = anims.length - 1; stepSel = null; animI = 0;
  render();
}
function askDeleteAnim() {
  const a = draft && curAnim(draft);
  if (!a) return;
  readFields();
  openLayer(`<h3>Delete ${esc(a.name)}?</h3><p class="muted">Only the animation goes: its sprites stay in the list.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn danger" type="button" data-action="pix-anim-del-confirm">${iconSvg('x')} Delete</button></div>`, 'Delete animation');
}
function deleteAnim() {
  const d = draft;
  closeLayer();
  if (!d?.anims?.length || !curAnim(d)) return;
  d.anims.splice(d.anim ?? 0, 1);
  d.anim = -1; stepSel = null; animI = 0;   // back to the sprite on its own: Close goes to the Kitty tab
  render();
}
// The sprite numbers typed in become the animation's steps (a step that stays the same keeps its move).
function applySteps(text: string) {
  const d = draft, a = d && curAnim(d);
  if (!d?.sprites || !a) return;
  const { steps, bad } = stepsFromText(text, d.sprites, a.steps);
  if (bad.length) toast(`There is no sprite ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}: the sprites are 1 to ${d.sprites.length}.`);
  readFields();
  a.steps = steps; stepSel = null;
  render();
}
// The steps' own buttons. For 'add', i is the number of the sprite in the list (0 is the first).
function stepAction(act: 'pick' | 'add' | 'left' | 'right' | 'dup' | 'del' | 'pingpong', i = 0) {
  const d = draft, a = d && curAnim(d);
  if (!d?.sprites || !a) return;
  readFields();
  restSel = null;
  const seq = a.steps;
  if (act === 'pick') {
    stepSel = stepSel === i ? null : i;
    if (stepSel !== null) animI = animPlaying ? stepSel : stepSel + 1;   // the preview goes to the step (and holds there when paused)
    const f = d.sprites.findIndex((x) => x.id === seq[i]?.id);
    if (stepSel !== null && f >= 0 && f !== d.cur) { selectSprite(f); return; }   // tapping a step opens its sprite to draw on
  } else if (act === 'add') {
    if (seq.length >= MAX_STEPS) { toast(`An animation can have ${MAX_STEPS} steps.`); return; }
    if (!d.sprites[i]) return;
    const at = stepSel === null ? seq.length : stepSel + 1;
    seq.splice(at, 0, { id: d.sprites[i].id });
    stepSel = at;
    selectSprite(i); return;   // and it is on the board, to draw on
  } else if (act === 'left' && stepSel !== null && stepSel > 0) {
    [seq[stepSel - 1], seq[stepSel]] = [seq[stepSel], seq[stepSel - 1]]; stepSel--;
  } else if (act === 'right' && stepSel !== null && stepSel < seq.length - 1) {
    [seq[stepSel + 1], seq[stepSel]] = [seq[stepSel], seq[stepSel + 1]]; stepSel++;
  } else if (act === 'dup' && stepSel !== null) {
    if (seq.length >= MAX_STEPS) { toast(`An animation can have ${MAX_STEPS} steps.`); return; }
    seq.splice(stepSel + 1, 0, { ...seq[stepSel] }); stepSel++;
  } else if (act === 'del' && stepSel !== null) {
    seq.splice(stepSel, 1); stepSel = null;
  } else if (act === 'pingpong') {
    seq.push(...seq.slice(0, -1).reverse().map((st) => ({ ...st })));
    seq.splice(MAX_STEPS); stepSel = null;
  }
  render();
}
// The pose before or after the animation, or how far forward or up it is (whole pixels, a minus goes back or down).
function setRest(which: 'before' | 'after', field: 'pose' | 'dx' | 'dy', value: string) {
  const d = draft, a = d && curAnim(d);
  if (!d || !a) return;
  const r = restOf(d, a, which);
  if (field === 'pose') r.pose = value === 'stand' ? 'stand' : 'idle';
  else r[field] = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(Number(value)) || 0));
  a[which] = { pose: r.pose, ...(r.dx && { dx: r.dx }), ...(r.dy && { dy: r.dy }) } as Ghost;
  readFields();
  render();
}
// The move of the step picked: how far forward and up (whole pixels, a minus goes back or down).
function setMove(axis: 'dx' | 'dy', value: string) {
  const d = draft, a = d && curAnim(d);
  if (a && restSel && restSel.anim === a.id && stepSel === null) { setRest(restSel.which, axis, value); return; }
  if (!a || stepSel === null || !a.steps[stepSel]) return;
  const n = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, Math.round(Number(value)) || 0));
  const st = a.steps[stepSel];
  if (n) st[axis] = n; else delete st[axis];
  readFields();
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
  edit((g) => (draft!.cat === 'kitty' ? resizeGridBL(g, w, h) : resizeGrid(g, w, h)));
  fitSprites();   // every sprite is the board's size
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
const hhmm = () => { const t = new Date(); return `${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}`; };
async function exportIcons() {
  if (!pixelData().icons.length) { toast('Nothing to export yet.'); return; }
  const day = today();
  try {
    const where = await saveToDevice(exportName(day, hhmm()), new TextEncoder().encode(exportText(pixelData(), day)));
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
    case 'pix-sel-copy': copySel(); break;
    case 'pix-sel-paste': pasteClip(); break;
    case 'pix-pen': penOnly = !penOnly; try { localStorage.setItem('pix-pen', penOnly ? '1' : '0'); } catch { /* private window */ } toast(penOnly ? 'Pen on: only the pen draws.' : 'Pen off: fingers draw too.'); readFields(); render(); break;
    case 'pix-sel-del': deleteSel(); break;
    case 'pix-sel-done': settle(); renderBoard(); break;
    case 'pix-clear': edit((g) => (g.every((r) => r.every((c) => c === '.')) ? g : blankGrid(g[0].length, g.length))); break;
    case 'pix-copy': save(true); break;
    case 'pix-scene-mode': settle(); sceneMode = b.dataset.mode as 'draw' | 'spots'; pickedSpot = null; readFields(); render(); break;
    case 'pix-zoom': setZoom(Number(b.dataset.zoom)); break;
    case 'pix-anim-open': { const id = b.dataset.id ?? null; unlessDirty(() => openKitty(id)); break; }
    case 'pix-sprite-open': { const i = Number(b.dataset.i); unlessDirty(() => openSprite(i)); break; }
    case 'pix-sprite-new': unlessDirty(() => { openSprite(0); if (draft) { draft.anim = -1; stepSel = null; } addSprite(false); }); break;
    case 'pix-sprite-to-anim': if (draft?.sprites) { const i = Number(b.dataset.i), a = draft.anims?.[i]; if (a && a.steps.length < MAX_STEPS) { readFields(); a.steps.push({ id: draft.sprites[draft.cur ?? 0].id }); draft.anim = i; stepSel = a.steps.length - 1; animI = 0; render(); } } break;
    case 'pix-sprite-left': moveSprite(-1); break;
    case 'pix-sprite-right': moveSprite(1); break;
    case 'pix-sprite-add': addSprite(false); break;
    case 'pix-sprite-copy': addSprite(true); break;
    case 'pix-sprite-del': askDeleteSprite(); break;
    case 'pix-sprite-del-confirm': deleteSprite(); break;
    case 'pix-anim-add': { const g = GAME_ANIMS.find((x) => x.id === b.dataset.id); if (g) unlessDirty(() => { openSprite(0); addAnim(g.name, g.id); }); break; }
    case 'pix-skin-pattern': skinPattern = b.dataset.id as typeof skinPattern; render(); break;
    case 'pix-zone-mode': toggleZone(); break;
    case 'pix-help-close': kittyHelp = false; keepFlag('pix-kitty-help', false); render(); break;
    case 'pix-help-show': kittyHelp = true; keepFlag('pix-kitty-help', true); render(); break;
    case 'pix-zink': zink = b.dataset.z ?? 'H'; tool = tool === 'erase' || tool === 'pick' ? 'pencil' : tool; readFields(); render(); break;
    case 'pix-skin-colour': skinFur = b.dataset.fur ?? skinFur; render(); break;
    case 'pix-sprites-sort': spriteSort = !spriteSort; render(); break;
    case 'pix-sprites-prune': askPruneSprites(); break;
    case 'pix-sprites-prune-confirm': void pruneSprites(); break;
    case 'pix-anim-del': askDeleteAnim(); break;
    case 'pix-anim-del-confirm': deleteAnim(); break;
    case 'pix-step-pick': stepAction('pick', Number(b.dataset.i)); break;
    case 'pix-step-add': stepAction('add', Number(b.dataset.i)); break;
    case 'pix-step-dup': stepAction('dup'); break;
    case 'pix-step-left': stepAction('left'); break;
    case 'pix-step-right': stepAction('right'); break;
    case 'pix-step-del': stepAction('del'); break;
    case 'pix-pingpong': stepAction('pingpong'); break;
    case 'pix-rest-pick': { const a = draft && curAnim(draft); if (a) { const w = b.dataset.which as 'before' | 'after'; restSel = restSel?.anim === a.id && restSel.which === w ? null : { anim: a.id, which: w }; stepSel = null; readFields(); render(); } break; }
    case 'pix-anim-png': void exportStrip(); break;
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
    case 'pix-revert-ask': askRevert(); break;
    case 'pix-revert': void revert(); break;
    case 'pix-anim-revert': askAnimRevert(); break;
    case 'pix-anim-revert-confirm': animRevert(); break;
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
// Copy keeps the picked pixels; Paste puts them down on any sprite, in the same place, picked up to move.
function copySel() {
  if (!draft || !sel) return;
  const g = float ?? draft.grid.slice(sel.y, sel.y + sel.h).map((r) => r.slice(sel!.x, sel!.x + sel!.w));
  clip = { grid: g.map((r) => r.slice()), x: sel.x, y: sel.y, zone: zoneMode };
  toast(zoneMode ? 'Zones copied. Open another sprite and tap Paste.' : 'Copied. Open another sprite and tap Paste.');
  renderSelbar();
}
function pasteClip() {
  if (!draft || !clip) return;
  if (clip.zone !== zoneMode) { toast(clip.zone ? 'That was copied in zone mode: turn Zone on to paste it.' : 'That is a drawing: turn Zone off to paste it.'); return; }
  settle();
  const w = draft.grid[0].length, h = draft.grid.length;
  pushUndo();
  float = clip.grid.map((r) => r.slice());
  sel = { x: clip.x, y: clip.y, w: float[0].length, h: float.length };
  moveSel(sel.x, sel.y);
  tool = 'select';
  if (sel.x >= w || sel.y >= h) { toast("It doesn't fit this sprite."); }
  readFields(); render();
}
function deleteSel() {
  if (!draft || !sel) return;
  lift(); float = null; sel = null;
  renderBoard();
}

function askRevert() {
  if (!draft?.id) return;
  openLayer(`<h3>Back to the official ${esc(officialOf(draft.cat, draft.id)?.name ?? 'one')}?</h3><p class="muted">Your saved changes to it are gone.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn danger" type="button" data-action="pix-revert">Back to the official one</button></div>`, 'Back to the official one');
}
function askAnimRevert() {
  const a = draft && curAnim(draft);
  if (!a) return;
  readFields();
  openLayer(`<h3>Back to the official ${esc(a.name)}?</h3><p class="muted">Only this animation goes back as it was. Your sprites and the other animations stay. Save to keep it.</p>
    <div class="btns"><button class="btn" type="button" data-action="pix-layer-close" data-focus>Cancel</button>
    <button class="btn danger" type="button" data-action="pix-anim-revert-confirm">Back to the official one</button></div>`, 'Back to the official animation');
}
function animRevert() {
  const d = draft, a = d && curAnim(d);
  closeLayer();
  const o = a && officialOf('kitty', SHEET_ID);
  const oa = o?.animations?.find((x) => x.id === a!.id);
  if (!d?.sprites || !o?.sprites || !oa) return;
  const w = d.grid[0].length, h = d.grid.length;
  const have = new Set(d.sprites.map((f) => f.id));
  for (const st of oa.steps) {   // a sprite it plays that you took out comes back; the ones you have stay as you drew them
    const sp = o.sprites.find((f) => f.id === st.id);
    if (!sp || have.has(sp.id)) continue;
    const g = toGrid(sp.art.map((r) => r.padEnd(w, '.').slice(0, w))); while (g.length < h) g.push(Array<string>(w).fill('.'));
    const art = g.slice(0, h);
    d.sprites.push({ id: sp.id, name: sp.name, grid: art, zone: zoneFromRows(art, o.zones?.[sp.id]) }); have.add(sp.id);
  }
  d.anims![d.anim ?? 0] = JSON.parse(JSON.stringify(oa)) as Animation;
  stepSel = null; restSel = null; animI = 0;
  toast(`${oa.name} is back as it was. Save to keep it.`);
  render();
}

async function revert() {
  if (!draft?.id) return;
  closeLayer();
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
  if (f.id === 'pix-anim-new-form') { ev.preventDefault(); const name = (document.getElementById('pix-anim-new') as HTMLInputElement).value; unlessDirty(() => { openSprite(0); addAnim(name); }); }
  if (f.id === 'pix-group-form') {
    ev.preventDefault();
    const from = f.dataset.group!, to = (document.getElementById('pix-group-new') as HTMLInputElement).value;
    const ok = await setPixelData(renameGroup(pixelData(), cat, from, to));
    closeLayer();
    toast(ok ? `Moved ${from} to ${cleanGroup(to, from)}.` : "Couldn't rename the group.");
    render();
  }
});
onShown('pixel', 'toggle', (ev) => { const t = ev.target as HTMLElement; if (t.id === 'pix-addstep') addOpen = (t as HTMLDetailsElement).open;
  if (t.id === 'pix-fold-anims') { animsOpen = (t as HTMLDetailsElement).open; keepFlag('pix-anims-open', animsOpen); }
  if (t.id === 'pix-fold-sprites') { spritesOpen = (t as HTMLDetailsElement).open; keepFlag('pix-sprites-open', spritesOpen); } }, true);
onShown('pixel', 'change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'pix-file') { importFile(t.files?.[0]); t.value = ''; }
  if (t.id === 'pix-photo') { usePhoto(t.files?.[0]); t.value = ''; }
  if (t.id === 'pix-food') { readFields(); renderPreview(); }
  if (t.id === 'pix-onion') { onion = (t as HTMLInputElement).checked; renderBoard(); }
  if (t.id === 'pix-steps') applySteps(t.value);
  if (t.id === 'pix-skin-anim') { skinAnim = t.value; render(); }
  if (t.id === 'pix-rest-pose' && restSel) setRest(restSel.which, 'pose', t.value);
  if (t.id === 'pix-step-dx' || t.id === 'pix-step-dy') setMove(t.id === 'pix-step-dx' ? 'dx' : 'dy', t.value);
  if (t.id === 'pix-fps' && draft) { const a = curAnim(draft); if (a) { a.fps = FPS_CHOICES.includes(Number(t.value)) ? Number(t.value) : DEFAULT_FPS; restartAnim(); } }
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

// Kitty Gallery and Kitty Wardrobe are one page in two modes: coming from the other one starts on its first tab.
let shownMode = '';
onAppShown('pixel', () => {
  const mode = inWardrobe() ? 'wardrobe' : 'gallery';
  if (mode !== shownMode) {
    shownMode = mode; tab = 'icons'; picked.clear(); organise = false;
    if (draft && !dirty() && (draft.cat === 'kitty') !== (mode === 'wardrobe')) draft = null;
    cat = mode === 'wardrobe' ? 'kitty' : cat === 'kitty' ? 'sticker' : cat;
  }
  renderTop(); render();
});
renderTop();
render();
initPixel().then(render);
