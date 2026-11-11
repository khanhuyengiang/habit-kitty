// The Notes screen: the notes as little window cards, two to a row, with a search box. A card opens the note to read;
// Edit turns it into the form (title, the card's picture, the text), which saves as you type.
// The data is in ./data.ts (Habit Kitty starts it), the pure parts in ./model.ts. Drawn with Habit Kitty's stylesheet, in web/notes.html.
import { iconSvg } from '../pixelart.ts';
import { PICKER_ICONS, PICKER_ICON_NAMES, iconSvg as uiIcon, stickerSvg } from '../achievement/pixelart.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { journalTabs, onAppShown, onShown } from '../shared/apps.ts';
import { esc } from '../shared/html.ts';
import { compressPhoto } from '../shared/photo.ts';
import { sharePicture } from '../shared/snapshot.ts';
import { homeButton, playerButton, settingsButton, showToast, titleBar } from '../shared/ui.ts';
import { COLOR, faceSvg, tint, winBar } from './window.ts';
import { allNotes, deleteNote, noteOf, notesInitialised, notesReady, onNotes, saveNote } from './data.ts';
import { MAX_NOTES, MAX_TEXT, NOTE_COLORS, NOTE_FACES, composeNote, continueList, excerpt, isDateText, parseNote, plainText, renderMarkdown, searchNotes, titleFromText, type Cover, type Note, type NoteColor, type NoteDoodle, type NoteFace } from './model.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
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
  kind: CoverKind; icon: string; image: string; color: NoteColor; doodle: NoteDoodle; face: NoteFace; date: string;
  editing: boolean; saved: boolean; iconOpen: boolean; doodleOpen: boolean;
}
let query = '';
let cur: Open | null = null;   // the open note (null: showing the cards)
let saveTimer = 0;
let saving: Promise<unknown> = Promise.resolve();

// The date under a card: the one set on the note, or else when it was last changed.
const dateTime = (date: string | undefined, mtime: number | null) => date ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8))).getTime() : mtime;
const when = (t: number) => new Date(t).toLocaleDateString('en', { day: 'numeric', month: 'short', year: t < Date.now() - 300 * 86_400_000 ? 'numeric' : undefined });

const foot = (t: number | null) => (t ? when(t) : '');

const coverOf = (o: Open): Cover =>
  o.kind === 'icon' && PICKER_ICONS[o.icon] ? { kind: 'icon', name: o.icon } : o.kind === 'image' && o.image ? { kind: 'image', src: o.image } : null;
const textOf = (o: Open) => composeNote({ front: o.front, cover: coverOf(o), color: o.color, doodle: o.doodle, face: o.face, date: o.date || undefined, body: o.body });
const nameOf = (o: Open) => o.title.trim() || o.name || titleFromText(o.body);
const isEmpty = (o: Open) => !o.title.trim() && !o.body.trim() && !coverOf(o);

function openNote(n: Note | null, editing: boolean): Open {
  const p = parseNote(n?.text ?? '');
  return {
    name: n?.name ?? null, title: n?.name ?? '', front: p.front, body: p.body,
    kind: p.cover?.kind ?? 'none', icon: p.cover?.kind === 'icon' ? p.cover.name : 'cat', image: p.cover?.kind === 'image' ? p.cover.src : '', color: p.color, doodle: p.doodle, face: p.face, date: p.date ?? '',
    editing, saved: true, iconOpen: p.cover?.kind !== 'icon', doodleOpen: false,
  };
}

// ---- the window card (after the "meow.exe" pictures in inspo/) ----
// A title bar with a cat, the name and three little window keys; under it a dotted screen with the picture and a few words
// (or, with no picture, the start of the text), sparkles in its corners, the note's doodle in the bottom one and a dotted
// line with the date. The note's colour (--nc) tints all of it. In the list every card is the same size (.ncard in web/notes.html).
// The bottom-left picture is one of Kitty Achievement's icons (a sticker at the note's own pixel) and the title bar's cat (./window.ts) is the
// outline of one of Habit Kitty's mini moods, so everything on the card is drawn on the same grid.
const doodleSvg = (d: NoteDoodle) => (PICKER_ICONS[d] ? stickerSvg(d, 1) : '');
const FACE_LABEL: Record<NoteFace, string> = { happy: 'Happy', open: 'Awake', sleepy: 'Sleepy', sad: 'Sad', starving: 'Hungry' };
const TWINKLE = ['..o..', '..o..', 'oo.oo', '..o..', '..o..'];
const decoHtml = (d: NoteDoodle) => `<span class="ndeco" aria-hidden="true">${['tl', 'tr', 'br'].map((c) => `<span class="tw ${c}">${monoSvg(TWINKLE)}</span>`).join('')}${
  !doodleSvg(d) ? '' : `<span class="ndoodle">${doodleSvg(d)}</span>`}</span>`;
const coverHtml = (c: Cover) => c?.kind === 'icon' ? `<span class="nart">${stickerSvg(c.name)}</span>`
  : c?.kind === 'image' ? `<span class="nart photo"><img src="${esc(c.src)}" alt=""></span>` : '';

function cardHtml(name: string, text: string, mtime: number | null, o: { preview?: boolean } = {}): string {
  const p = parseNote(text);
  const words = p.cover ? excerpt(p.body, 120) : plainText(p.body);
  const inner = `${winBar(name, p.face)}<span class="nwin-screen${p.cover ? '' : ' text-only'}">${decoHtml(p.doodle)}${coverHtml(p.cover)}
    <span class="ncard-text">${words ? esc(words) : '<span class="muted">Empty note</span>'}</span>
    <span class="ncard-foot">${foot(dateTime(p.date, mtime))}</span></span>`;
  return o.preview
    ? `<div class="nwin ncard" style="${tint(p.color)}" aria-hidden="true">${inner}</div>`
    : `<button type="button" class="nwin ncard" style="${tint(p.color)}" data-action="note-open" data-name="${esc(name)}" aria-label="${esc(name)}">${inner}</button>`;
}

// ---- the list ----
function renderList() {
  if (!notesReady()) { $('notes-body').innerHTML = '<div class="panel"><p class="muted">Loading the notes…</p></div>'; return; }
  const all = allNotes();
  const shown = searchNotes(all, query);
  $('notes-body').innerHTML = `<div class="nbar"><label class="field"><input id="notes-search" type="search" placeholder="Search notes" autocomplete="off" aria-label="Search notes" value="${esc(query)}"></label>
      <button class="btn primary" type="button" data-action="note-new" ${all.length >= MAX_NOTES ? 'disabled' : ''}>+ New</button></div>
    <div id="notes-list">${listHtml(all.length, shown)}</div>`;
}
function listHtml(total: number, shown: Note[]): string {
  if (!total) return '<div class="panel"><p class="muted">No notes yet. Tap New to write one. Notes are Markdown files, so you can open them in Obsidian too (Settings → Notes).</p></div>';
  if (!shown.length) return '<p class="muted">No note matches that.</p>';
  return `<div class="ngrid">${shown.map((n) => cardHtml(n.name, n.text, n.mtime)).join('')}</div>`;
}

// ---- reading: the note in a big window, not editable ----
function renderRead() {
  if (!cur) return;
  const c = coverOf(cur);
  $('notes-body').innerHTML = `<div class="ntools">
      <button class="btn small" type="button" data-action="note-back">${iconSvg('prev')} Notes</button>
      <span class="grow"></span>
      <button class="btn small" type="button" data-action="note-copy">Copy</button>
      <button class="btn small" type="button" data-action="note-share">Share</button>
      <button class="btn small primary" type="button" data-action="note-edit">${uiIcon('pencil')} Edit</button>
      <button class="btn small" type="button" data-action="note-delete" ${cur.name === null ? 'disabled' : ''}>Delete</button></div>
    <article class="nwin nread" style="${tint(cur.color)}">${winBar(nameOf(cur), cur.face)}<div class="nwin-screen">${decoHtml(cur.doodle)}${coverHtml(c)}
      <div class="md">${renderMarkdown(cur.body) || (c ? '' : '<p class="muted">Nothing written yet. Tap Edit.</p>')}</div>
      <span class="ncard-foot">${cur.date || cur.name ? foot(dateTime(cur.date, noteOf(cur.name ?? '')?.mtime ?? Date.now())) : ''}</span></div></article>`;
}

// ---- editing ----
const KINDS: [CoverKind, string][] = [['none', 'Text only'], ['icon', 'Icon'], ['image', 'Picture']];
function renderEditor() {
  if (!cur) return;
  $('notes-body').innerHTML = `<div class="ntools">
      <button class="btn small" type="button" data-action="note-back">${iconSvg('prev')} Notes</button>
      <span class="grow"></span>
      <span class="nstate" id="note-state">${cur.saved ? 'Saved' : ''}</span>
      <button class="btn small primary" type="button" data-action="note-done">Done</button>
      <button class="btn small" type="button" data-action="note-delete" ${cur.name === null ? 'disabled' : ''}>Delete</button></div>
    <div class="nedit-top"><div class="ngrid-one" id="note-preview">${previewHtml()}</div>
      <div class="nedit-fields"><label class="field">Title <input id="note-title" maxlength="80" autocomplete="off" placeholder="Untitled" value="${esc(cur.title)}"></label>
        <label class="field">Date <input id="note-date" type="date" value="${esc(cur.date || dateInputValue())}" aria-label="Date of the note"></label></div></div>
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
  const t = new Date(cur?.name ? noteOf(cur.name)?.mtime ?? Date.now() : Date.now());
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
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
function iconFold(id: string, name: string, sel: string, open: boolean, none: boolean): string {
  const label = PICKER_ICONS[sel]?.label ?? 'None';
  const pick = (n: string, text: string, art: string) => `<label title="${text}"><input type="radio" name="${name}" value="${n}" ${n === sel ? 'checked' : ''} aria-label="${text}"><span>${art}</span></label>`;
  return `<details class="icon-fold" id="${id}" ${open ? 'open' : ''}><summary class="fold-sum" aria-label="${esc(label)}. Change">${PICKER_ICONS[sel] ? stickerSvg(sel, 1) : ''}<span class="fold-name">${esc(label)}</span><span class="fold-chev">${uiIcon('chev')}</span></summary>
    <div class="icon-pick">${none ? pick('none', 'None', 'None') : ''}${PICKER_ICON_NAMES.map((n) => pick(n, PICKER_ICONS[n].label, stickerSvg(n, 1))).join('')}</div></details>`;
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

async function leaveNote() {
  await flush();
  cur = null;
  renderList();
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
    case 'note-new': cur = openNote(null, true); renderEditor(); break;
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
    case 'layer-close': if (ev.target === btn || btn.tagName === 'BUTTON') closeConfirm(); break;
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
  const el = document.createElement('div');
  el.id = 'notes-layer';
  el.className = 'scrim layer';
  el.dataset.action = 'layer-close';
  el.innerHTML = `<div class="panel" role="alertdialog" aria-modal="true" aria-label="Delete this note?"><h3>Delete this note?</h3><p>“${esc(cur.name)}” is deleted from this device (and from the notes folder, if you sync it).</p>
    <div class="btns"><button class="btn" type="button" data-action="layer-close" data-focus>Keep</button><button class="btn primary" type="button" data-action="note-delete-yes">Delete</button></div></div>`;
  $('notes-layer-host').appendChild(el);
  el.querySelector<HTMLElement>('[data-focus]')?.focus();
}
const closeConfirm = () => document.getElementById('notes-layer')?.remove();

onShown('notes', 'input', (ev) => {
  const t = ev.target as HTMLInputElement | HTMLTextAreaElement;
  if (t.id === 'notes-search') { query = t.value; const all = allNotes(); $('notes-list').innerHTML = listHtml(all.length, searchNotes(all, query)); return; }
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
  if (!cur) return;
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
  if (!cur) { renderList(); return; }
  flush().then(() => {
    const n = cur?.name ? noteOf(cur.name) : null;
    if (cur && n && cur.saved) { cur = openNote(n, cur.editing); render(); }
  });
});
renderTop();
renderList();
notesInitialised.then(() => { if (!cur) renderList(); });
