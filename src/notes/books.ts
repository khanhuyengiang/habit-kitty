// Notebooks, pure so they can be tested. A note says which notebook it is in (kitty-notebook in its frontmatter, see
// ./model.ts), so that travels with the .md file; what a notebook looks like (its picture and colour) and the order of the
// notebooks are kept here, in one small JSON file (./data.ts). A notebook a note names that is not in the file (a note that
// came from Obsidian, say) is shown all the same, with the default look; one with no notes stays until it is deleted.
import { NOTE_COLORS, bookName, parseNote, sameBook, type Note, type NoteColor } from './model.ts';

export interface Notebook { name: string; icon: string; color: NoteColor }
export interface BookData { books: Notebook[] }
export const MAX_BOOKS = 100;
export const emptyBooks = (): BookData => ({ books: [] });
export const defaultBook = (name: string, i = 0): Notebook => ({ name, icon: 'book', color: NOTE_COLORS[(i + 1) % NOTE_COLORS.length] });

const ICON = /^[\w-]{1,40}$/;
export function sanitizeBooks(raw: unknown): BookData {
  const list = Array.isArray((raw as BookData | null)?.books) ? (raw as BookData).books : [];
  const out: Notebook[] = [];
  for (const b of list.slice(0, MAX_BOOKS)) {
    const name = bookName(typeof b?.name === 'string' ? b.name : '');
    if (!name || out.some((o) => sameBook(o.name, name))) continue;
    out.push({ name, icon: typeof b.icon === 'string' && ICON.test(b.icon) ? b.icon : 'book',
      color: (NOTE_COLORS as readonly string[]).includes(b.color) ? b.color : 'lavender' });
  }
  return { books: out };
}

// Every notebook, in order: the file's, then those only the notes name (A to Z).
export function booksOf(d: BookData, notes: Note[]): Notebook[] {
  const out = [...d.books];
  const named = new Map<string, string>();
  for (const n of notes) { const b = parseNote(n.text).book; if (b && !named.has(b.toLowerCase())) named.set(b.toLowerCase(), b); }
  const extra = [...named.values()].filter((b) => !out.some((o) => sameBook(o.name, b))).sort((a, b) => a.localeCompare(b));
  return [...out, ...extra.map((b, i) => defaultBook(b, out.length + i))];
}
export const bookOf = (books: Notebook[], name: string) => books.find((b) => sameBook(b.name, name));
export const notesIn = (notes: Note[], name: string) => notes.filter((n) => sameBook(parseNote(n.text).book, name));
export const looseNotes = (notes: Note[]) => notes.filter((n) => !parseNote(n.text).book);

// The file with this notebook made or changed (`prev` null: a new one, at the end). The caller checks the name is free.
export function putBook(d: BookData, all: Notebook[], prev: string | null, b: Notebook): BookData {
  const books = all.map((x) => ({ ...x }));   // every notebook goes in the file, so their order is kept from now on
  const i = prev === null ? -1 : books.findIndex((x) => sameBook(x.name, prev));
  if (i < 0) books.push(b); else books[i] = b;
  return sanitizeBooks({ ...d, books });
}
export const dropBook = (all: Notebook[], name: string): BookData => ({ books: all.filter((b) => !sameBook(b.name, name)) });
export function moveBook(all: Notebook[], name: string, by: number): BookData {
  const books = [...all];
  const i = books.findIndex((b) => sameBook(b.name, name)), j = i + by;
  if (i < 0 || j < 0 || j >= books.length) return { books };
  [books[i], books[j]] = [books[j], books[i]];
  return { books };
}
