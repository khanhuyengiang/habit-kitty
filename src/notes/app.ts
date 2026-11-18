// The Notes screen: the notes as little window cards, two to a row, with a search box. A card opens the note to read;
// Edit turns it into the form (title, the card's picture, the text), which saves as you type. Notes can be put in notebooks
// (./books.ts): a notebook is a cover among the cards that opens to its notes, and the Filter (Kitty Achievement's) shows
// every note, those in no notebook or one notebook, as covers, under a heading per notebook or all together.
// The data is in ./data.ts (Habit Kitty starts it), the pure parts in ./model.ts. Drawn with Habit Kitty's stylesheet, in web/notes.html.
import { iconSvg } from '../shared/art.ts';
import { PICKER_ICONS, groupedPicks, iconLabel, uiIconSvg, pickable, stickerSvg } from '../shared/stickers.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { journalTabs, onAppShown, onShown } from '../shared/apps.ts';
import { $, esc } from '../shared/html.ts';
import { localDateKey } from '../shared/dates.ts';
import { makeLayer } from '../shared/layer.ts';
import { compressPhoto } from '../shared/photo.ts';
import { sharePicture } from '../shared/snapshot.ts';
import { filterButton, filterSelect, homeButton, orderList, playerButton, refocusMove, settingsButton, showToast, titleBar } from '../shared/ui.ts';
import { getLocal, setLocal } from '../shared/local.ts';
import { goTo } from '../shared/apps.ts';
import { plural } from '../shared/html.ts';
import { COLOR, faceSvg, tint, winBar } from './window.ts';
import { allBooks, allNotes, deleteBook, deleteNote, moveBook, noteOf, notesInitialised, notesReady, onNotes, saveBook, saveNote, takeAsked } from './data.ts';
import { MAX_BOOK_NAME, MAX_NOTES, MAX_TEXT, NOTE_COLORS, NOTE_FACES, bookName, cardLines, composeNote, continueList, isDateText, parseNote, renderMarkdown, sameBook, searchNotes, titleFromText, toggleTask, type Cover, type Note, type NoteColor, type NoteDoodle, type NoteFace } from './model.ts';
import { MAX_BOOKS, bookOf, defaultBook, looseNotes, notesIn, type Notebook } from './books.ts';

const toast = (text: string) => showToast($('notes-toast'), text);

// ---- header ----
function renderTop() {
  $('notes-top').innerHTML = titleBar('Kitty', 'Journal', homeButton() + playerButton() + settingsButton()) + journalTabs('notes');
}

// ---- state ----
// The note that is open. Its frontmatter is split off: the card's picture is chosen with the form, the rest is kept as it is.
// The icon and the picture are both remembered while the form is open, so switching between them loses neither.
type CoverKind = 'none' | 'icon' | 'image';
interface Open {
  name: string | null; title: string; front: string[]; body: string;
  kind: CoverKind; icon: string; image: string; color: NoteColor; doodle: NoteDoodle; face: NoteFace; date: string; book: string;
  editing: boolean; saved: boolean; iconOpen: boolean; doodleOpen: boolean;
}
let query = '';
let cur: Open | null = null;   // the open note (null: showing the cards)
let from: string | null = null;   // the screen that asked for the open note (the diary), where Back goes
// What the cards show: every note or those in no notebook (a notebook's own page is `book`), and how they are grouped:
// the notebooks as covers among the other notes (the default), a heading per notebook, or no grouping. The grouping is remembered.
type Group = 'covers' | 'book' | 'none';
const GROUP_KEY = 'kitty-notes-group';
let group: Group = ((g) => (g === 'book' || g === 'none' ? g : 'covers'))(getLocal(GROUP_KEY));
let show: 'all' | 'loose' = 'all';
let book: string | null = null;   // the notebook that is open
let filterOpen = false;
let saveTimer = 0;
let saving: Promise<unknown> = Promise.resolve();

// The date under a card: the one set on the note, or else when it was last changed.
const dateTime = (date: string | undefined, mtime: number | null) => date ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8))).getTime() : mtime;
const when = (t: number) => new Date(t).toLocaleDateString('en', { day: 'numeric', month: 'short', year: t < Date.now() - 300 * 86_400_000 ? 'numeric' : undefined });

const foot = (t: number | null) => (t ? when(t) : '');

const coverOf = (o: Open): Cover =>
  o.kind === 'icon' && o.icon ? { kind: 'icon', name: o.icon } : o.kind === 'image' && o.image ? { kind: 'image', src: o.image } : null;
const textOf = (o: Open) => composeNote({ front: o.front, cover: coverOf(o), color: o.color, doodle: o.doodle, face: o.face, date: o.date || undefined, book: o.book || undefined, body: o.body });
const nameOf = (o: Open) => o.title.trim() || o.name || titleFromText(o.body);
const isEmpty = (o: Open) => !o.title.trim() && !o.body.trim() && !coverOf(o);

function openNote(n: Note | null, editing: boolean): Open {
  const p = parseNote(n?.text ?? '');
  return {
    name: n?.name ?? null, title: n?.name ?? '', front: p.front, body: p.body,
    kind: p.cover?.kind ?? 'none', icon: p.cover?.kind === 'icon' ? p.cover.name : 'cat', image: p.cover?.kind === 'image' ? p.cover.src : '', color: p.color, doodle: p.doodle, face: p.face, date: p.date ?? '', book: p.book ?? '',
    editing, saved: true, iconOpen: p.cover?.kind !== 'icon', doodleOpen: false,
  };
}

// ---- the window card (after the "meow.exe" pictures in inspo/) ----
// A title bar with a cat, the name and three little window keys; under it a dotted screen with the picture and a few words
// (or, with no picture, the start of the text), sparkles in its corners, the note's doodle in the bottom one and a dotted
// line with the date. The note's colour (--nc) tints all of it. In the list every card is the same size (.ncard in web/notes.html).
// The bottom-left picture is one of Kitty Achievement's icons (a sticker at the note's own pixel) and the title bar's cat (./window.ts) is the
// outline of one of Habit Kitty's mini moods, so everything on the card is drawn on the same grid.
// An icon that is gone (deleted in Kitty Gallery) is drawn as a heart.
const doodleSvg = (d: NoteDoodle) => (d === 'none' ? '' : stickerSvg(d, 1));
const FACE_LABEL: Record<NoteFace, string> = { happy: 'Happy', open: 'Awake', sleepy: 'Sleepy', sad: 'Sad', starving: 'Hungry' };
const TWINKLE = ['..o..', '..o..', 'oo.oo', '..o..', '..o..'];
const decoHtml = (d: NoteDoodle) => `<span class="ndeco" aria-hidden="true">${['tl', 'tr', 'br'].map((c) => `<span class="tw ${c}">${monoSvg(TWINKLE)}</span>`).join('')}${
  !doodleSvg(d) ? '' : `<span class="ndoodle">${doodleSvg(d)}</span>`}</span>`;
const coverHtml = (c: Cover) => c?.kind === 'icon' ? `<span class="nart">${stickerSvg(c.name, 1)}</span>`
  : c?.kind === 'image' ? `<span class="nart photo"><img src="${esc(c.src)}" alt=""></span>` : '';

// A task line on a card shows its box, ticked or not (only to see: the boxes are ticked on the note's own page).
const BOX = ['ooooooo', 'o.....o', 'o.....o', 'o.....o', 'o.....o', 'o.....o', 'ooooooo'];
const TICKED = ['ooooooo', 'o.....o', 'o....oo', 'oo..o.o', 'o.oo..o', 'o.....o', 'ooooooo'];
const boxHtml = (done: boolean) => `<span class="ntask${done ? ' on' : ''}" aria-hidden="true">${monoSvg(done ? TICKED : BOX)}</span>`;
function cardWords(body: string, cover: boolean): string {
  const lines = cardLines(body, cover ? 120 : 280).slice(0, cover ? 1 : undefined);
  return lines.map((l) => `${l.task === undefined ? '' : boxHtml(l.task)}${esc(l.text)}`).join('\n');
}

function cardHtml(name: string, text: string, mtime: number | null, o: { preview?: boolean } = {}): string {
  const p = parseNote(text);
  const words = cardWords(p.body, !!p.cover);
  const inner = `${winBar(name, p.face)}<span class="nwin-screen${p.cover ? '' : ' text-only'}">${decoHtml(p.doodle)}${coverHtml(p.cover)}
    <span class="ncard-text">${words || '<span class="muted">Empty note</span>'}</span>
    <span class="ncard-foot">${foot(dateTime(p.date, mtime))}</span></span>`;
  return o.preview
    ? `<div class="nwin ncard" style="${tint(p.color)}" aria-hidden="true">${inner}</div>`
    : `<button type="button" class="nwin ncard" style="${tint(p.color)}" data-action="note-open" data-name="${esc(name)}" aria-label="${esc(name)}">${inner}</button>`;
}

// ---- a notebook's cover: the same size as a note's card, a spine with rings down the left, a label with its name ----
function bookCardHtml(b: Notebook, n: number): string {
  return `<button type="button" class="nwin ncard nbook" style="${tint(b.color)}" data-action="book-open" data-name="${esc(b.name)}" aria-label="${esc(b.name)}, notebook: ${plural(n, 'note')}">
    <span class="nbook-spine" aria-hidden="true"></span>
    <span class="nbook-face"><span class="nbook-label">${esc(b.name)}</span><span class="nart">${stickerSvg(b.icon, 1)}</span>
      <span class="ncard-foot">${n ? plural(n, 'note') : 'Empty'}</span></span></button>`;
}
const bookTitle = (b: Notebook, tag = 'h3', n?: string) =>
  `<${tag} class="pcat-title" style="${tint(b.color)}"><span class="nart">${stickerSvg(b.icon, 1)}</span><span>${esc(b.name)}</span>${n ? `<span class="n">${n}</span>` : ''}</${tag}>`;

// ---- the list ----
function renderList() {
  if (!notesReady()) { $('notes-body').innerHTML = '<div class="panel"><p class="muted">Loading the notes…</p></div>'; return; }
  const all = allNotes(), books = allBooks();
  const open = book ? bookOf(books, book) : undefined;
  if (!open) book = null;
  const changed = (!book && show !== 'all' ? 1 : 0) + (!book && group !== 'covers' ? 1 : 0);   // an open notebook is a page, not a filter (as a quest is in Kitty Achievement)
  const panel = filterOpen ? `<div class="panel filter-panel" id="filter-panel"><div class="filter-grid">
      ${filterSelect('show', 'Show', [['all', 'All notes'], ['loose', 'Not in a notebook'], ...books.map((b): [string, string] => [`book:${b.name}`, b.name])], open ? `book:${open.name}` : show)}
      ${open ? '' : filterSelect('group', 'Group by', [['covers', 'Notebook covers'], ['book', 'Notebook'], ['none', 'No grouping']], group)}</div>
      <div class="btns end"><button class="btn small" type="button" data-action="notes-filter-reset" ${changed ? '' : 'disabled'}>Reset</button><button class="btn small primary" type="button" data-action="notes-filter">Done</button></div></div>` : '';
  const head = open ? `<div class="ntools"><button class="btn small" type="button" data-action="book-back">${iconSvg('prev')} Notes</button><span class="grow"></span>
      <button class="btn small" type="button" data-action="book-edit">${uiIconSvg('pencil')} Edit</button></div>
    ${bookTitle(open, 'h2', plural(notesIn(all, open.name).length, 'note'))}` : '';
  $('notes-body').innerHTML = `${head}<div class="nbar"><label class="field"><input id="notes-search" type="search" placeholder="${open ? `Search ${esc(open.name)}` : 'Search notes'}" autocomplete="off" aria-label="Search notes" value="${esc(query)}"></label>
      <button class="btn primary" type="button" data-action="note-new" ${all.length >= MAX_NOTES ? 'disabled' : ''}>+ New</button></div>
    <div class="tools"><div class="toolbar">${filterButton(filterOpen, changed, 'notes-filter')}<span class="grow"></span>
      ${open ? '' : `${books.length > 1 ? '<button class="btn small" type="button" data-action="book-arrange">Arrange</button>' : ''}
      <button class="btn small" type="button" data-action="book-new" ${books.length >= MAX_BOOKS ? 'disabled' : ''}>+ Notebook</button>`}</div>${panel}</div>
    <div id="notes-list">${listHtml()}</div>`;
}
const grid = (cards: string) => `<div class="ngrid">${cards}</div>`;
const cards = (ns: Note[]) => ns.map((n) => cardHtml(n.name, n.text, n.mtime)).join('');
function listHtml(): string {
  const all = allNotes(), books = allBooks();
  const found = searchNotes(all, query);
  if (book) {
    const mine = notesIn(found, book);
    return mine.length ? grid(cards(mine)) : `<div class="panel"><p class="muted">${query ? 'No note in this notebook matches that.' : 'No notes in this notebook yet. Tap New to write one here, or choose this notebook when you edit a note.'}</p></div>`;
  }
  if (!all.length && !books.length) return '<div class="panel"><p class="muted">No notes yet. Tap New to write one. Notes are Markdown files, so you can open them in Obsidian too (Settings → Notes).</p></div>';
  const loose = looseNotes(found);
  if (show === 'loose') return loose.length ? grid(cards(loose)) : `<p class="muted">${query ? 'No note matches that.' : 'Every note is in a notebook.'}</p>`;
  if (group === 'none') return found.length ? grid(cards(found)) : '<p class="muted">No note matches that.</p>';
  if (group === 'covers' && !query) return grid(books.map((b) => bookCardHtml(b, notesIn(all, b.name).length)).join('') + cards(loose));
  // a heading per notebook (a search shows the notes it found this way too, so none is hidden inside a cover)
  const secs = books.map((b) => {
    const mine = notesIn(found, b.name);
    if (!mine.length && query) return '';
    return `<section class="side-sec" aria-label="${esc(b.name)}"><div class="nsec-head">${bookTitle(b, 'h3', String(notesIn(all, b.name).length))}
      <button class="btn small" type="button" data-action="book-open" data-name="${esc(b.name)}" aria-label="Open ${esc(b.name)}">Open</button></div>
      ${mine.length ? grid(cards(mine)) : '<p class="muted">No notes in it yet.</p>'}</section>`;
  });
  if (loose.length) secs.push(`<section class="side-sec" aria-label="Not in a notebook"><h3><span>Not in a notebook</span><span class="n">${loose.length}</span></h3>${grid(cards(loose))}</section>`);
  return secs.join('') || '<p class="muted">No note matches that.</p>';
}

// ---- a notebook's form: its name, colour and picture (Kitty Mart's category form, with the notes' pickers) ----
let bookForm: { prev: string | null; icon: string; iconOpen: boolean } | null = null;
function openBookForm(prev: string | null) {
  const books = allBooks();
  const b = prev ? bookOf(books, prev) : defaultBook('', books.length);
  if (!b) return;
  bookForm = { prev: prev ? b.name : null, icon: b.icon, iconOpen: false };
  layer.open(`<h3>${prev ? `Change ${esc(b.name)}` : 'New notebook'}</h3>
    <form class="stack" id="book-form">
      <label class="field">Name <input name="name" maxlength="${MAX_BOOK_NAME}" value="${esc(b.name)}" placeholder="Recipes, Ideas, Trips…" autocomplete="off" data-focus></label>
      <fieldset class="field"><legend>Colour</legend><div class="nswatches">${NOTE_COLORS.map((k) =>
        `<label title="${COLOR[k][1]}"><input type="radio" name="book-color" value="${k}" ${k === b.color ? 'checked' : ''} aria-label="${COLOR[k][1]}"><span style="${tint(k)}"></span></label>`).join('')}</div></fieldset>
      <fieldset class="field"><legend>Picture</legend><div id="book-icon">${iconFold('book-icon-fold', 'book-icon', b.icon, false, false)}</div></fieldset>
      <div class="btns">${prev ? '<button class="btn" type="button" data-action="book-delete">Delete</button>' : ''}<span class="grow"></span>
        <button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, prev ? b.name : 'New notebook');
}
async function submitBookForm(f: HTMLFormElement) {
  if (!bookForm) return;
  const name = bookName((f.elements.namedItem('name') as HTMLInputElement).value);
  if (!name) { toast('Give the notebook a name.'); return; }
  const color = (f.querySelector<HTMLInputElement>('input[name="book-color"]:checked')?.value ?? 'lavender') as NoteColor;
  const { prev, icon } = bookForm;
  await flush();
  if (!await saveBook(prev, { name, icon, color })) { toast(`There is already a notebook called ${name}.`); return; }
  bookForm = null;
  layer.close();
  if (prev === null || (book && sameBook(book, prev))) book = name;   // a new notebook opens; a renamed open one stays open
  if (cur && sameBook(cur.book, prev ?? '')) cur.book = name;
  query = '';
  renderList();
  toast(prev === null ? `Made ${name}.` : `Changed ${name}.`);
}
function openBookDelete() {
  const b = bookForm?.prev ? bookOf(allBooks(), bookForm.prev) : undefined;
  if (!b) return;
  const n = notesIn(allNotes(), b.name).length;
  layer.open(`<h3>Delete ${esc(b.name)}?</h3><p>${n ? `Its ${plural(n, 'note')} ${n === 1 ? 'is' : 'are'} kept, in no notebook.` : 'It has no notes.'}</p>
    <div class="btns"><button class="btn" type="button" data-action="layer-close" data-focus>Keep</button><button class="btn primary" type="button" data-action="book-delete-yes" data-name="${esc(b.name)}">Delete</button></div>`, `Delete ${b.name}?`, { role: 'alertdialog' });
}
const orderHtml = () => orderList('book-move', allBooks().map((b) => ({ id: b.name, name: b.name, pic: `<span class="nart">${stickerSvg(b.icon, 1)}</span>`, style: tint(b.color) })));
function openArrange() {
  layer.open(`<h3>Arrange the notebooks</h3><div id="book-order">${orderHtml()}</div>
    <div class="btns end"><button class="btn primary" type="button" data-action="layer-close">Done</button></div>`, 'Arrange the notebooks');
}

// ---- reading: the note in a big window, not editable ----
function renderRead() {
  if (!cur) return;
  const c = coverOf(cur);
  $('notes-body').innerHTML = `<div class="ntools">
      <button class="btn small" type="button" data-action="note-back">${iconSvg('prev')} ${backLabel()}</button>
      <span class="grow"></span>
      <button class="btn small" type="button" data-action="note-copy">Copy</button>
      <button class="btn small" type="button" data-action="note-share">Share</button>
      <button class="btn small primary" type="button" data-action="note-edit">${uiIconSvg('pencil')} Edit</button>
      <button class="btn small" type="button" data-action="note-delete" ${cur.name === null ? 'disabled' : ''}>Delete</button></div>
    <article class="nwin nread" style="${tint(cur.color)}">${winBar(nameOf(cur), cur.face)}<div class="nwin-screen">${decoHtml(cur.doodle)}${coverHtml(c)}
      <div class="md">${renderMarkdown(cur.body, { tasks: true }) || (c ? '' : '<p class="muted">Nothing written yet. Tap Edit.</p>')}</div>
      <span class="ncard-foot">${cur.date || cur.name ? foot(dateTime(cur.date, noteOf(cur.name ?? '')?.mtime ?? Date.now())) : ''}</span></div></article>`;
}

// ---- editing ----
const KINDS: [CoverKind, string][] = [['none', 'Text only'], ['icon', 'Icon'], ['image', 'Picture']];
function renderEditor() {
  if (!cur) return;
  $('notes-body').innerHTML = `<div class="ntools">
      <button class="btn small" type="button" data-action="note-back">${iconSvg('prev')} ${backLabel()}</button>
      <span class="grow"></span>
      <span class="nstate" id="note-state">${cur.saved ? 'Saved' : ''}</span>
      <button class="btn small primary" type="button" data-action="note-done">Done</button>
      <button class="btn small" type="button" data-action="note-delete" ${cur.name === null ? 'disabled' : ''}>Delete</button></div>
    <div class="nedit-top"><div class="ngrid-one" id="note-preview">${previewHtml()}</div>
      <div class="nedit-fields"><label class="field">Title <input id="note-title" maxlength="80" autocomplete="off" placeholder="Untitled" value="${esc(cur.title)}"></label>
        <label class="field">Date <input id="note-date" type="date" value="${esc(cur.date || dateInputValue())}" aria-label="Date of the note"></label>
        <label class="field">Notebook <select id="note-book">${[['', 'None'], ...allBooks().map((b): [string, string] => [b.name, b.name])].map(([v, t]) =>
          `<option value="${esc(v)}" ${sameBook(v, cur!.book) || (!v && !cur!.book) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div></div>
    <fieldset class="field"><legend>On the card</legend>
      <div class="nkinds" role="radiogroup">${KINDS.map(([k, label]) =>
        `<label><input type="radio" name="note-kind" value="${k}" ${cur!.kind === k ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>
      <div id="note-cover">${coverFieldHtml()}</div></fieldset>
    <fieldset class="field"><legend>Colour</legend>
      <div class="nswatches">${NOTE_COLORS.map((k) =>
        `<label title="${COLOR[k][1]}"><input type="radio" name="note-color" value="${k}" ${cur!.color === k ? 'checked' : ''} aria-label="${COLOR[k][1]}"><span style="${tint(k)}"></span></label>`).join('')}</div></fieldset>
    <fieldset class="field"><legend>Kitty in the corner</legend>
      <div class="ndoodles">${NOTE_FACES.map((k) =>
        `<label title="${FACE_LABEL[k]}"><input type="radio" name="note-face" value="${k}" ${cur!.face === k ? 'checked' : ''} aria-label="${FACE_LABEL[k]}"><span>${faceSvg(k)}</span></label>`).join('')}</div></fieldset>
    <fieldset class="field"><legend>Picture at the bottom</legend><div id="note-doodle">${doodleFieldHtml()}</div></fieldset>
    <label class="field">Note <textarea id="note-text" class="ntext" maxlength="${MAX_TEXT}" placeholder="Write in Markdown: # heading, **bold**, - list, - [ ] task" spellcheck="true">${esc(cur.body)}</textarea></label>`;
  if (cur.name === null && isEmpty(cur)) $('note-text').focus();
}
// What the date box shows when no date was set: the day the note was last changed (today, for a new one).
function dateInputValue(): string {
  return localDateKey(cur?.name ? noteOf(cur.name)?.mtime ?? Date.now() : Date.now());
}
const previewHtml = () => (cur ? cardHtml(nameOf(cur), textOf(cur), null, { preview: true }) : '');
function coverFieldHtml(): string {
  if (!cur || cur.kind === 'none') return '<p class="hint">The card shows the start of the note.</p>';
  if (cur.kind === 'icon') return iconFold('note-icon-fold', 'note-icon', cur.icon, cur.iconOpen, false);
  return `<div class="btns"><button class="btn" type="button" data-action="note-image">${cur.image ? 'Change picture…' : 'Choose picture…'}</button>
      ${cur.image ? '<button class="btn" type="button" data-action="note-image-remove">Remove</button>' : ''}</div>
    <input type="file" id="note-file" accept="image/*" hidden>
    <p class="hint">The picture is scaled down and kept inside the note's file.</p>`;
}
// The icon list (Kitty Achievement's), folded to the chosen one; `none` adds a "None" choice.
// An icon that is gone (deleted in Kitty Gallery) is a heart, so the heart is the one chosen.
function iconFold(id: string, name: string, sel: string, open: boolean, none: boolean): string {
  if (!(none && sel === 'none')) sel = pickable(sel);
  const label = sel === 'none' ? 'None' : iconLabel(sel);
  const pick = (n: string, text: string, art: string) => `<label title="${text}"><input type="radio" name="${name}" value="${n}" ${n === sel ? 'checked' : ''} aria-label="${text}"><span>${art}</span></label>`;
  return `<details class="icon-fold" id="${id}" ${open ? 'open' : ''}><summary class="fold-sum" aria-label="${esc(label)}. Change">${sel === 'none' ? '' : stickerSvg(sel, 1)}<span class="fold-name">${esc(label)}</span><span class="fold-chev">${uiIconSvg('chev')}</span></summary>
    <div class="icon-pick">${none ? pick('none', 'None', 'None') : ''}${groupedPicks((n) => pick(n, PICKER_ICONS[n].label, stickerSvg(n, 1)))}</div></details>`;
}
const doodleFieldHtml = () => (cur ? iconFold('note-doodle-fold', 'note-doodle', cur.doodle, cur.doodleOpen, true) : '');
const redrawPreview = () => { const el = document.getElementById('note-preview'); if (el) el.innerHTML = previewHtml(); };
function setState(text: string) { const el = document.getElementById('note-state'); if (el) el.textContent = text; }

// Writes the open note now (a new note is only created once it has something in it).
function flush(): Promise<unknown> {
  clearTimeout(saveTimer);
  const c = cur;
  if (!c || c.saved) return saving;
  if (c.name === null && isEmpty(c)) return saving;
  const name = nameOf(c), text = textOf(c);
  saving = saving.then(async () => {
    // an untitled note keeps the name it has; a new one is named after its first line
    const r = await saveNote(c.name, name, text);
    if (!r.ok) { setState("Couldn't save. Is there room on the phone?"); return; }
    c.name = r.name;
    if (nameOf(c) === name && textOf(c) === text) { c.saved = true; setState('Saved'); }
  });
  return saving;
}
function edited() {
  if (!cur) return;
  cur.saved = false;
  setState('…');
  redrawPreview();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 700);
}

// Back from a note: to the diary when it asked for the note, else to the cards (the notebook it was opened from).
const backLabel = () => (from === 'diary' ? 'Diary' : book ?? 'Notes');
async function leaveNote() {
  await flush();
  cur = null;
  if (from) { const to = from; from = null; renderList(); goTo(to === 'diary' ? 'diary' : 'notes'); return; }
  renderList();
}
// Opens the note another screen asked for (see takeAsked); false when none was asked for.
function openAsked(): boolean {
  const a = takeAsked();
  if (!a) return false;
  (async () => {
    await flush();
    await notesInitialised;
    const n = noteOf(a.name);
    if (!n) { cur = null; renderList(); toast("That note isn't here any more."); return; }
    cur = openNote(n, false); from = a.from;
    renderRead();
    window.scrollTo(0, 0);
  })();
  return true;
}
const render = () => (cur?.editing ? renderEditor() : renderRead());

async function pickImage(file: File) {
  const c = cur;
  if (!c) return;
  setState('Adding the picture…');
  try {
    const blob = await compressPhoto(file, { maxSide: 480 });
    const src = await new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(blob); });
    if (cur !== c) return;
    c.image = src; c.kind = 'image';
    $('note-cover').innerHTML = coverFieldHtml();
    edited();
  } catch { setState(''); toast("Couldn't read that picture. Try another one."); }
}

// ---- events ----
onShown('notes', 'click', async (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  switch (btn.dataset.action) {
    case 'note-new': cur = openNote(null, true); if (book) cur.book = book; renderEditor(); break;
    case 'notes-filter': filterOpen = !filterOpen; renderList(); if (filterOpen) document.getElementById('v-show')?.focus(); break;
    case 'notes-filter-reset': show = 'all'; book = null; group = 'covers'; setLocal(GROUP_KEY, null); renderList(); break;
    case 'book-open': book = btn.dataset.name ?? null; query = ''; renderList(); window.scrollTo(0, 0); break;
    case 'book-back': book = null; query = ''; renderList(); window.scrollTo(0, 0); break;
    case 'book-new': openBookForm(null); break;
    case 'book-edit': if (book) openBookForm(book); break;
    case 'book-delete': openBookDelete(); break;
    case 'book-delete-yes': {
      const name = btn.dataset.name ?? '';
      layer.close();
      await flush();
      if (!await deleteBook(name)) toast("Couldn't change every note. Try again.");
      else toast(`Deleted ${name}.`);
      if (book && sameBook(book, name)) book = null;
      if (cur && sameBook(cur.book, name)) cur.book = '';
      renderList();
      break;
    }
    case 'book-arrange': openArrange(); break;
    case 'book-move': {
      const id = btn.dataset.id ?? '', by = btn.dataset.by ?? '-1';
      await moveBook(id, by === '1' ? 1 : -1);
      const box = document.getElementById('book-order');
      if (box) { box.innerHTML = orderHtml(); refocusMove(box, 'book-move', id, by); }
      break;
    }
    case 'note-open': {
      const n = noteOf(btn.dataset.name ?? '');
      if (n) { cur = openNote(n, false); if (isEmpty(cur)) cur.editing = true; render(); }
      break;
    }
    case 'note-back': await leaveNote(); break;
    case 'note-edit': if (cur) { cur.editing = true; renderEditor(); } break;
    case 'note-done':
      if (!cur) break;
      await flush();
      if (cur.name === null) { cur = null; renderList(); } else { cur.editing = false; renderRead(); }
      break;
    case 'note-copy':
      if (cur) navigator.clipboard?.writeText(cur.body).then(() => toast('Copied.'), () => toast("Couldn't copy. Open Edit and select the text."));
      break;
    case 'note-share': {
      const el = document.querySelector<HTMLElement>('#notes-body .nread');
      if (cur && el) sharePicture(el, nameOf(cur) || 'Note').then((r) => { if (r === 'saved') toast('Picture saved.'); }, () => toast("Couldn't make the picture."));
      break;
    }
    case 'note-image': document.getElementById('note-file')?.click(); break;
    case 'note-image-remove': if (cur) { cur.image = ''; $('note-cover').innerHTML = coverFieldHtml(); edited(); } break;
    case 'note-delete': openConfirm(); break;
    case 'note-delete-yes': {
      const c = cur;
      closeConfirm();
      if (c?.name && await deleteNote(c.name)) { clearTimeout(saveTimer); cur = null; renderList(); toast('Note deleted.'); }
      else toast("Couldn't delete that note.");
      break;
    }
  }
});

function openConfirm() {
  if (!cur?.name) return;
  layer.open(`<h3>Delete this note?</h3><p>“${esc(cur.name)}” is deleted from this device (and from the notes folder, if you sync it).</p>
    <div class="btns"><button class="btn" type="button" data-action="layer-close" data-focus>Keep</button><button class="btn primary" type="button" data-action="note-delete-yes">Delete</button></div>`, 'Delete this note?', { role: 'alertdialog' });
}
const layer = makeLayer('notes', { id: 'notes-layer', host: () => $('notes-layer-host'), focus: '[data-focus]' });
const closeConfirm = () => layer.close();
onShown('notes', 'submit', (ev) => {
  const f = ev.target as HTMLFormElement;
  if (f.id !== 'book-form') return;
  ev.preventDefault();
  submitBookForm(f);
});

onShown('notes', 'input', (ev) => {
  const t = ev.target as HTMLInputElement | HTMLTextAreaElement;
  if (t.id === 'notes-search') { query = t.value; $('notes-list').innerHTML = listHtml(); return; }
  if (!cur) return;
  if (t.id === 'note-title') { cur.title = t.value; edited(); }
  else if (t.id === 'note-text') { cur.body = t.value; edited(); }
});
// Enter in a list carries the list on; Enter on an empty item ends it.
onShown('notes', 'keydown', (ev) => {
  const t = ev.target as HTMLTextAreaElement;
  if (t.id !== 'note-text' || ev.key !== 'Enter' || ev.shiftKey || ev.isComposing || t.selectionStart !== t.selectionEnd) return;
  const r = continueList(t.value, t.selectionStart);
  if (!r || !cur) return;
  ev.preventDefault();
  t.value = r.text; t.setSelectionRange(r.caret, r.caret);
  cur.body = r.text; edited();
});
onShown('notes', 'change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.dataset.filter === 'show') {
    const v = t.value;
    if (v.startsWith('book:')) { book = v.slice(5); show = 'all'; } else { book = null; show = v === 'loose' ? 'loose' : 'all'; }
    query = ''; renderList(); document.getElementById('v-show')?.focus(); return;
  }
  if (t.dataset.filter === 'group') {
    group = t.value === 'book' || t.value === 'none' ? t.value : 'covers';
    setLocal(GROUP_KEY, group === 'covers' ? null : group);
    renderList(); document.getElementById('v-group')?.focus(); return;
  }
  if (t.name === 'book-icon' && bookForm) {
    bookForm.icon = t.value;
    $('book-icon').innerHTML = iconFold('book-icon-fold', 'book-icon', t.value, false, false);
    return;
  }
  if (!cur) return;
  // a task's box ticked on the note's page: the line changes in the text, which is saved at once
  if (t.dataset.line !== undefined && t.closest('.nread')) {
    const body = toggleTask(cur.body, Number(t.dataset.line));
    if (body === null) { t.checked = !t.checked; return; }
    cur.body = body; cur.saved = false;
    t.closest('li')?.classList.toggle('done', t.checked);
    flush();
    return;
  }
  if (t.id === 'note-book') { cur.book = t.value; edited(); return; }
  if (t.name === 'note-kind') {
    cur.kind = t.value as CoverKind;
    $('note-cover').innerHTML = coverFieldHtml();
    edited();
    if (cur.kind === 'image' && !cur.image) document.getElementById('note-file')?.click();
  } else if (t.name === 'note-icon') {
    cur.icon = t.value; cur.iconOpen = false;
    $('note-cover').innerHTML = coverFieldHtml();
    edited();
  } else if (t.name === 'note-color') {
    cur.color = t.value as NoteColor; edited();
  } else if (t.name === 'note-face') {
    cur.face = t.value as NoteFace; edited();
  } else if (t.name === 'note-doodle') {
    cur.doodle = t.value as NoteDoodle; cur.doodleOpen = false;
    $('note-doodle').innerHTML = doodleFieldHtml();
    edited();
  } else if (t.id === 'note-date') {
    cur.date = isDateText(t.value) ? t.value : ''; edited();
  } else if (t.id === 'note-file') {
    const f = t.files?.[0];
    t.value = '';
    if (f) pickImage(f);
  }
});
// Remember whether the icon list is open, so a redraw keeps it the way it was.
onShown('notes', 'toggle', (ev) => {   // toggle does not bubble
  const id = (ev.target as HTMLElement).id;
  if (cur && id === 'note-icon-fold') cur.iconOpen = (ev.target as HTMLDetailsElement).open;
  if (cur && id === 'note-doodle-fold') cur.doodleOpen = (ev.target as HTMLDetailsElement).open;
}, true);

// Never lose what was typed: write it when the page is left or hidden.
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', () => { flush(); });

// ---- start ----
// The data changed (a sync pulled a note in, say): redraw the cards, or the note being read; never under the cursor in the form.
onNotes(() => {
  if (!cur) { renderList(); return; }
  const n = !cur.editing && cur.saved && cur.name ? noteOf(cur.name) : null;
  if (n && n.text !== textOf(cur)) { cur = openNote(n, false); renderRead(); }
});
onAppShown('notes', () => {
  renderTop();
  if (openAsked()) return;
  if (!cur) { renderList(); return; }
  flush().then(() => {
    const n = cur?.name ? noteOf(cur.name) : null;
    if (cur && n && cur.saved) { cur = openNote(n, cur.editing); render(); }
  });
});
renderTop();
if (!openAsked()) renderList();
notesInitialised.then(() => { if (!cur) renderList(); });
