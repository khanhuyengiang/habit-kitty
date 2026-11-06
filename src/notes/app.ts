// The Notes screen: a list of notes with a search box, and an editor with a Markdown preview. Notes are saved as you type.
// The data is in ./data.ts (Habit Kitty starts it), the pure parts in ./model.ts. Drawn with Habit Kitty's stylesheet, in web/notes.html.
import { iconSvg } from '../pixelart.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { onAppShown, onShown } from '../shared/apps.ts';
import { paintBackdrop } from '../shared/backdrop.ts';
import { allNotes, deleteNote, noteOf, notesInitialised, notesReady, onNotes, saveNote } from './data.ts';
import { MAX_NOTES, MAX_TEXT, excerpt, renderMarkdown, searchNotes, titleFromText } from './model.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let toastTimer = 0;
function toast(text: string) {
  const el = $('notes-toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 3200);
}

// ---- header ----
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;
const HOUSE = ['....o....', '...ooo...', '..ooooo..', '.ooooooo.', '..ooooo..', '..oo.oo..', '..oo.oo..'];
function renderTop() {
  $('notes-top').innerHTML = `<div class="brand"><h1>Kitty <span>Notes</span></h1>
    <div class="brand-r">
      <button class="gear" type="button" data-action="go" data-to="home" aria-label="Home">${monoSvg(HOUSE)}</button>
      <button class="gear" type="button" data-action="notes-theme" aria-label="${isDark() ? 'Switch to light mode' : 'Switch to dark mode'}">${iconSvg(isDark() ? 'sun' : 'moon')}</button>
      <button class="gear" type="button" data-action="go" data-to="habit" data-tab="settings" aria-label="Settings">${iconSvg('gear')}</button></div></div>`;
}

// ---- state ----
interface Editing { name: string | null; title: string; text: string; preview: boolean; saved: boolean }
let query = '';
let cur: Editing | null = null;   // the note being edited (null: showing the list)
let saveTimer = 0;
let saving: Promise<unknown> = Promise.resolve();

const when = (t: number) => new Date(t).toLocaleDateString('en', { day: 'numeric', month: 'short', year: t < Date.now() - 300 * 86_400_000 ? 'numeric' : undefined });

// ---- the list ----
function renderList() {
  if (!notesReady()) { $('notes-body').innerHTML = '<div class="panel"><p class="muted">Loading the notes…</p></div>'; return; }
  const all = allNotes();
  const shown = searchNotes(all, query);
  $('notes-body').innerHTML = `<div class="nbar"><label class="field"><input id="notes-search" type="search" placeholder="Search notes" autocomplete="off" aria-label="Search notes" value="${esc(query)}"></label>
      <button class="btn primary" type="button" data-action="note-new" ${all.length >= MAX_NOTES ? 'disabled' : ''}>+ New</button></div>
    <div class="nlist" id="notes-list">${listHtml(all.length, shown)}</div>`;
}
function listHtml(total: number, shown: ReturnType<typeof allNotes>): string {
  if (!total) return '<div class="panel"><p class="muted">No notes yet. Tap New to write one. Notes are Markdown files, so you can open them in Obsidian too (Settings → Notes).</p></div>';
  if (!shown.length) return '<p class="muted">No note matches that.</p>';
  return shown.map((n) => `<button type="button" class="btn note-row" data-action="note-open" data-name="${esc(n.name)}"><b>${esc(n.name)}</b>
    ${excerpt(n.text) ? `<span class="ex">${esc(excerpt(n.text))}</span>` : ''}<span class="when">${when(n.mtime)}</span></button>`).join('');
}

// ---- the editor ----
function renderEditor() {
  if (!cur) return;
  $('notes-body').innerHTML = `<div class="ntools">
      <button class="btn small" type="button" data-action="note-back">${iconSvg('prev')} Notes</button>
      <span class="grow"></span>
      <button class="btn small" type="button" data-action="note-mode" aria-pressed="${cur.preview}">${cur.preview ? 'Edit' : 'Preview'}</button>
      <button class="btn small" type="button" data-action="note-delete" ${cur.name === null ? 'disabled' : ''}>Delete</button></div>
    ${cur.preview
      ? `<p class="nstate">${esc(cur.title.trim() || cur.name || titleFromText(cur.text))}.md</p><div class="md">${renderMarkdown(cur.text) || '<p class="muted">Nothing to show yet.</p>'}</div>`
      : `<label class="field">Title <input id="note-title" maxlength="80" autocomplete="off" placeholder="Untitled" value="${esc(cur.title)}"></label>
         <label class="field">Note <textarea id="note-text" class="ntext" maxlength="${MAX_TEXT}" placeholder="Write in Markdown: # heading, **bold**, - list, - [ ] task" spellcheck="true">${esc(cur.text)}</textarea></label>`}
    <span class="nstate" id="note-state">${cur.saved ? 'Saved' : ''}</span>`;
  if (!cur.preview && cur.name === null && !cur.text) $('note-text').focus();
}
function setState(text: string) { const el = document.getElementById('note-state'); if (el) el.textContent = text; }

// Writes the open note now (a new note is only created once it has something in it).
function flush(): Promise<unknown> {
  clearTimeout(saveTimer);
  const c = cur;
  if (!c || c.saved) return saving;
  if (c.name === null && !c.title.trim() && !c.text.trim()) return saving;
  const { title, text } = c;
  saving = saving.then(async () => {
    // an untitled note keeps the name it has; a new one is named after its first line
    const r = await saveNote(c.name, title.trim() || c.name || titleFromText(text), text);
    if (!r.ok) { setState("Couldn't save. Is there room on the phone?"); return; }
    c.name = r.name;
    if (c.title === title && c.text === text) { c.saved = true; setState('Saved'); }
  });
  return saving;
}
function edited() {
  if (!cur) return;
  cur.saved = false;
  setState('…');
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 700);
}

async function leaveEditor() {
  await flush();
  cur = null;
  renderList();
}

// ---- events ----
onShown('notes', 'click', async (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  switch (btn.dataset.action) {
    case 'notes-theme': {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('hk-theme', next); } catch { /* not remembered */ }
      paintBackdrop(); renderTop();
      break;
    }
    case 'note-new': cur = { name: null, title: '', text: '', preview: false, saved: true }; renderEditor(); break;
    case 'note-open': {
      const n = noteOf(btn.dataset.name ?? '');
      if (n) { cur = { name: n.name, title: n.name, text: n.text, preview: false, saved: true }; renderEditor(); }
      break;
    }
    case 'note-back': await leaveEditor(); break;
    case 'note-mode':
      if (cur) {
        if (!cur.preview) { const t = document.getElementById('note-text') as HTMLTextAreaElement | null; if (t) cur.text = t.value; }
        cur.preview = !cur.preview; renderEditor();
      }
      break;
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
  else if (t.id === 'note-text') { cur.text = t.value; edited(); }
});

// Never lose what was typed: write it when the page is left or hidden.
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', () => { flush(); });

// ---- start ----
// The data changed (a sync pulled a note in, say): redraw the list, but not under the cursor in the editor.
onNotes(() => { if (!cur) renderList(); });
onAppShown('notes', () => { renderTop(); if (cur) flush().then(() => { const n = cur?.name ? noteOf(cur.name) : null; if (cur && n && cur.saved) { cur.text = n.text; cur.title = n.name; renderEditor(); } }); else renderList(); });
renderTop();
renderList();
notesInitialised.then(() => { if (!cur) renderList(); });
