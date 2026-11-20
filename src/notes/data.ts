// The notes' data: one Markdown file per note in the app's private storage, named after the note's title:
//
//   habit-kitty-notes/Shopping ideas.md
//
// (Its own folder, so restoring the diary never touches it.) Everything is kept in memory too, so screens draw at once.
// Habit Kitty starts this (initNotes) because the backup needs it; the Notes screen and the folder sync read and write here.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { stagedReplace, writeOk } from '../shared/files.ts';
import { BACKUP_PREFIX, markDirty } from '../shared/backupfolder.ts';
import { MAX_NOTES, MAX_TEXT, parseNote, safeName, sameBook, sortNotes, uniqueName, withBook, type Note } from './model.ts';
import { jsonFile } from '../shared/jsonfile.ts';
import { booksOf, dropBook, emptyBooks, moveBook as moveIn, putBook, sanitizeBooks, type BookData, type Notebook } from './books.ts';

const ROOT = 'habit-kitty-notes';
const STAGE = 'habit-kitty-notes-restore';   // a restore is written here first, then swapped in
const path = (name: string, root = ROOT) => ({ path: `${root}/${name}.md`, directory: Directory.Data });
const dir = (root = ROOT) => ({ path: root, directory: Directory.Data });

// Read as UTF-8, as it is written: on the website Capacitor hands back the text as stored, so base64 would only work on the phone.
const readText = async (name: string): Promise<string | null> => {
  try {
    const r = await Filesystem.readFile({ ...path(name), encoding: Encoding.UTF8 });
    return typeof r.data === 'string' ? r.data : await r.data.text();
  } catch { return null; }
};
const writeText = (name: string, text: string, root = ROOT) =>
  writeOk(() => Filesystem.writeFile({ ...path(name, root), data: text, encoding: Encoding.UTF8, recursive: true }));

// What is on disk: each note's name and the file's own modified time (the sync compares these).
export async function statNotes(): Promise<{ name: string; mtime: number }[]> {
  try {
    return (await Filesystem.readdir(dir())).files
      .filter((f) => f.name.endsWith('.md') && (f.type ?? 'file') === 'file')
      .map((f) => ({ name: f.name.slice(0, -3), mtime: Number(f.mtime) || 0 }));
  } catch { return []; }
}

// ---- in memory ----
let notes: Note[] = [];
let ready = false;
const listeners = new Set<() => void>();
let removedHook: (name: string) => void = () => {};
export const notesReady = () => ready;
export const onNotes = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
// The folder sync asks to hear about a note deleted in the app, so it can delete the folder's copy too.
export const onNoteRemoved = (fn: (name: string) => void) => { removedHook = fn; };

export const allNotes = (): Note[] => sortNotes(notes);
export const noteCount = () => notes.length;
export const noteOf = (name: string): Note | undefined => notes.find((n) => n.name === name);

function changed() {
  markDirty(BACKUP_PREFIX);
  for (const l of listeners) l();
}

let started: Promise<void> | null = null;
let resolveInit: () => void = () => {};
export const notesInitialised = new Promise<void>((r) => { resolveInit = r; });

export function initNotes(): Promise<void> {
  started ??= (async () => { books = await bookFile.read(); await reload(); ready = true; resolveInit(); for (const l of listeners) l(); })();
  return started;
}

// Reads every note from disk again (after a sync); `notify` false when the caller has told the screens already.
export async function reload(notify = true) {
  const stats = await statNotes();
  const read = await Promise.all(stats.map(async (s) => {
    const text = await readText(s.name);
    return text === null ? null : { name: s.name, text, mtime: s.mtime };
  }));
  notes = read.filter((n): n is Note => !!n);
  if (ready && notify) changed();
}

// ---- notes ----
// Creates a note (`prev` null) or saves one, renaming its file when the title changed. Resolves to the name it ended up with.
export async function saveNote(prev: string | null, title: string, text: string): Promise<{ ok: boolean; name: string }> {
  if (text.length > MAX_TEXT) return { ok: false, name: prev ?? '' };
  if (prev === null && notes.length >= MAX_NOTES) return { ok: false, name: '' };
  const others = notes.filter((n) => n.name !== prev).map((n) => n.name);
  const wanted = safeName(title);
  const name = prev !== null && wanted.toLowerCase() === prev.toLowerCase() && !others.some((o) => o.toLowerCase() === wanted.toLowerCase()) ? wanted : uniqueName(wanted, others);
  if (!await writeText(name, text)) return { ok: false, name: prev ?? '' };
  if (prev !== null && prev !== name) {   // a rename changes the file; a change of case only does too, on a case-sensitive disk
    await Filesystem.deleteFile(path(prev)).catch(() => { /* already gone */ });
    removedHook(prev);
  }
  notes = [...notes.filter((n) => n.name !== prev && n.name !== name), { name, text, mtime: Date.now() }];
  changed();
  return { ok: true, name };
}

export async function deleteNote(name: string): Promise<boolean> {
  try { await Filesystem.deleteFile(path(name)); } catch { if (await readText(name) !== null) return false; }
  notes = notes.filter((n) => n.name !== name);
  removedHook(name);
  changed();
  return true;
}

// Adds notes from files (a name clash gets a number, so nothing is overwritten). Resolves to how many were added.
export async function importNotes(items: { name: string; text: string }[]): Promise<number> {
  let added = 0;
  for (const it of items) {
    if (notes.length >= MAX_NOTES || it.text.length > MAX_TEXT) continue;
    const name = uniqueName(it.name.replace(/\.(md|markdown|txt)$/i, ''), notes.map((n) => n.name));
    if (await writeText(name, it.text)) { notes = [...notes, { name, text: it.text, mtime: Date.now() }]; added++; }
  }
  if (added) changed();
  return added;
}

// Writes a note's text under exactly this name (the sync does: the name comes from the folder). Overwrites.
export async function putRaw(name: string, text: string): Promise<boolean> {
  if (text.length > MAX_TEXT || (!noteOf(name) && notes.length >= MAX_NOTES)) return false;
  if (!await writeText(name, text)) return false;
  notes = [...notes.filter((n) => n.name !== name), { name, text, mtime: Date.now() }];
  changed();
  return true;
}

// ---- notebooks (see ./books.ts) ----
// Their look and order, in their own folder so restoring the notes (a swap of the notes folder) leaves it alone.
const bookFile = jsonFile('habit-kitty-notebooks/notebooks.json', sanitizeBooks, emptyBooks);
let books: BookData = emptyBooks();
export const allBooks = (): Notebook[] => booksOf(books, notes);
const setBooks = async (next: BookData) => { books = next; const ok = await bookFile.write(books); changed(); return ok; };

// Writes these notes' new text (their names stay), for a notebook renamed or deleted.
async function rewrite(edits: { name: string; text: string }[]): Promise<boolean> {
  let ok = true;
  for (const e of edits) {
    if (!await writeText(e.name, e.text)) { ok = false; continue; }
    notes = [...notes.filter((n) => n.name !== e.name), { name: e.name, text: e.text, mtime: Date.now() }];
  }
  return ok;
}
const membersOf = (name: string) => notes.filter((n) => sameBook(parseNote(n.text).book, name));

// Makes a notebook (`prev` null) or changes one; a new name is written into each of its notes. False when the name is taken.
export async function saveBook(prev: string | null, b: Notebook): Promise<boolean> {
  const all = allBooks();
  if (all.some((x) => sameBook(x.name, b.name) && !sameBook(x.name, prev ?? ''))) return false;
  if (prev !== null && prev !== b.name) await rewrite(membersOf(prev).map((n) => ({ name: n.name, text: withBook(n.text, b.name) })));
  return setBooks(putBook(books, all, prev, b));
}
// Deletes a notebook; its notes are kept, in no notebook.
export async function deleteBook(name: string): Promise<boolean> {
  const all = allBooks();
  const ok = await rewrite(membersOf(name).map((n) => ({ name: n.name, text: withBook(n.text, '') })));
  return await setBooks(dropBook(all, name)) && ok;
}
export const moveBook = (name: string, by: number) => setBooks(moveIn(allBooks(), name, by));

// Another screen asks for a note to be opened (the diary's linked note): the Notes screen takes it when it shows.
let asked: { name: string; from: string } | null = null;
export const askToOpen = (name: string, from: string) => { asked = { name, from }; };
export const takeAsked = () => { const a = asked; asked = null; return a; };

// ---- backup ----
export const collectBooks = (): string | undefined => (books.books.length ? JSON.stringify(books) : undefined);
export async function restoreBooks(text: string): Promise<boolean> {
  const next = bookFile.parse(text);
  return next ? setBooks(next) : false;
}
export const collectNotes = (): Record<string, string> => Object.fromEntries(notes.map((n) => [n.name, n.text]));

// Replaces every note with these. Written next to the live folder and swapped in only when complete.
export async function restoreNotes(map: Record<string, string>): Promise<boolean> {
  const ok = await stagedReplace(ROOT, STAGE, async () => {
    for (const [name, text] of Object.entries(map)) if (!await writeText(name, text, STAGE)) throw new Error('write');
  });
  if (!ok) return false;
  const now = Date.now();
  notes = Object.entries(map).map(([name, text]) => ({ name, text, mtime: now }));
  ready = true;
  changed();
  return true;
}
