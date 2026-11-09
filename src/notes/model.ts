// Notes, pure so they can be tested. A note is one Markdown file; its name is its title (so Obsidian shows it the same way).
import { PICKER_ICON_NAMES } from '../achievement/icons.ts';
import { esc } from '../shared/html.ts';

export interface Note { name: string; text: string; mtime: number }   // name without ".md"

export const MAX_NOTES = 2000;
export const MAX_TEXT = 200_000;
const MAX_NAME = 80;

// A file name that is safe on every system: no slashes or other reserved characters, no leading dots, not empty.
export function safeName(raw: string): string {
  const n = raw.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').trim().slice(0, MAX_NAME).trim();
  return n || 'Untitled';
}

// `base` made unique among `taken` ("Untitled", "Untitled 2", ...). The comparison ignores case, as most file systems do.
export function uniqueName(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((t) => t.toLowerCase()));
  const root = safeName(base);
  if (!used.has(root.toLowerCase())) return root;
  for (let i = 2; ; i++) {
    const tail = ` ${i}`;
    const n = `${root.slice(0, MAX_NAME - tail.length).trim()}${tail}`;
    if (!used.has(n.toLowerCase())) return n;
  }
}

// A title for a note that has none: its first line, without the Markdown marks (or "Untitled").
export const titleFromText = (text: string): string => safeName(excerpt(parseNote(text).body, MAX_NAME));

export const sortNotes = (notes: Note[]): Note[] => [...notes].sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));

// Every word of the search must be in the title or the text (not the frontmatter, so a picture's data never matches).
export function searchNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return notes;
  return notes.filter((n) => { const hay = `${n.name}\n${parseNote(n.text).body}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
}

// ---- the card's look: kept in the note's frontmatter, so it travels with the .md file (folder sync, backup, export) ----
//
//   ---
//   kitty-icon: cat              an icon from the achievement picker, or
//   kitty-image: data:image/...  a small JPEG
//   kitty-color: blue            the window's colour (pink when not set)
//   kitty-doodle: paw            the little picture in the bottom corner, an icon from the achievement picker (a heart when not set; "none" for none)
//   kitty-face: sleepy           the mini kitty in the title bar, outline only (happy when not set)
//   kitty-date: 2026-11-06       the date the note is about (the day it was last changed when not set)
//   ---
//
// Any other frontmatter (Obsidian's tags, aliases...) is kept as it is. Only what differs from the default is written.
export type Cover = { kind: 'icon'; name: string } | { kind: 'image'; src: string } | null;
export const NOTE_COLORS = ['pink', 'lavender', 'blue', 'mint', 'lemon', 'peach'] as const;
export const NOTE_DOODLES = ['none', ...PICKER_ICON_NAMES] as const;
export const NOTE_FACES = ['happy', 'open', 'sleepy', 'sad', 'starving'] as const;
export type NoteColor = typeof NOTE_COLORS[number];
export type NoteDoodle = typeof NOTE_DOODLES[number];
export type NoteFace = typeof NOTE_FACES[number];
export interface ParsedNote { front: string[]; cover: Cover; color: NoteColor; doodle: NoteDoodle; face: NoteFace; date?: string; body: string }

const FRONT = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;
const KEY = /^kitty-(icon|image|color|doodle|face|date):\s*(.*)$/;
const unquote = (v: string) => v.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
const IMAGE_SRC = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const oneOf = <T extends string>(list: readonly T[], v: string | undefined, fallback: T): T => (list as readonly string[]).includes(v ?? '') ? v as T : fallback;

// "2026-11-06": a real calendar day.
export const isDateText = (v: string | undefined): v is string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === v;
};
// The day a note belongs to as "YYYY-MM-DD": the date set on it, or else the (local) day it was last changed.
export function noteDate(n: { text: string; mtime: number }): string {
  const d = parseNote(n.text).date;
  if (d) return d;
  const t = new Date(n.mtime);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function parseNote(text: string): ParsedNote {
  const m = FRONT.exec(text);
  const blank = { front: [], cover: null, color: 'pink', doodle: 'heart', face: 'happy' } as const;
  if (!m) return { ...blank, front: [], body: text };
  const front: string[] = [];
  const v: Record<string, string> = {};
  for (const line of m[1] ? m[1].split(/\r?\n/) : []) {
    const k = KEY.exec(line);
    if (k) v[k[1]] = unquote(k[2]); else front.push(line);
  }
  const cover: Cover = IMAGE_SRC.test(v.image ?? '') ? { kind: 'image', src: v.image } : /^[\w-]{1,40}$/.test(v.icon ?? '') ? { kind: 'icon', name: v.icon } : null;
  return { front, cover, color: oneOf(NOTE_COLORS, v.color, 'pink'), doodle: oneOf(NOTE_DOODLES, v.doodle, 'heart'), face: oneOf(NOTE_FACES, v.face, 'happy'),
    ...(isDateText(v.date) && { date: v.date }), body: text.slice(m[0].length) };
}

// The note's text again, with this look (no frontmatter at all when there is nothing to put in it).
export function composeNote({ front, cover, color, doodle, face, date, body }: ParsedNote): string {
  const lines = [...front];
  if (cover?.kind === 'icon') lines.push(`kitty-icon: ${cover.name}`);
  else if (cover?.kind === 'image') lines.push(`kitty-image: ${cover.src}`);
  if (color !== 'pink') lines.push(`kitty-color: ${color}`);
  if (doodle !== 'heart') lines.push(`kitty-doodle: ${doodle}`);
  if (face !== 'happy') lines.push(`kitty-face: ${face}`);
  if (date) lines.push(`kitty-date: ${date}`);
  return lines.some((l) => l.trim()) ? `---\n${lines.join('\n')}\n---\n${body}` : body;
}

// A line without its Markdown marks ('' for a rule or a code fence).
const cleanLine = (raw: string) => {
  const line = raw.replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '').replace(/[*_`~]|\[\[|\]\]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
  return /^(-{3,}|`{3})/.test(line) ? '' : line;
};
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

// The first line of text worth showing under the title, without the Markdown marks.
export function excerpt(text: string, max = 90): string {
  for (const raw of text.split('\n')) { const line = cleanLine(raw); if (line) return cut(line, max); }
  return '';
}

// The start of the text as plain lines (a card that has no picture shows this).
export const plainText = (text: string, max = 280): string =>
  cut(text.split('\n').map(cleanLine).filter(Boolean).join('\n'), max);

// ---- Markdown to HTML: the common parts, with everything escaped first, so a note can never inject markup ----

function inline(raw: string): string {
  const codes: string[] = [];
  let s = esc(raw).replace(/`([^`]+)`/g, (_, c: string) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s
    .replace(/\[\[([^\]]+)\]\]/g, (_, t: string) => `<span class="wikilink">${t.split('|').pop()}</span>`)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a: string, b: string) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*)_(?![_\w])/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const isBlock = (l: string) => /^(#{1,6}\s|>|\s*[-*+]\s|\s*\d+[.)]\s|`{3}|-{3,}\s*$)/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^`{3}/.exec(line);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !/^`{3}/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^-{3,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(line)) {
      const q: string[] = [];
      for (; i < lines.length && /^>/.test(lines[i]); i++) q.push(lines[i].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`);
      continue;
    }
    const list = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        const task = /^\[([ xX])\]\s+(.*)$/.exec(m[2]);
        items.push(task
          ? `<li class="task"><input type="checkbox" disabled ${task[1] === ' ' ? '' : 'checked'}> ${inline(task[2])}</li>`
          : `<li>${inline(m[2])}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const p: string[] = [];
    for (; i < lines.length && lines[i].trim() && !(p.length && isBlock(lines[i])); i++) p.push(lines[i]);
    out.push(`<p>${p.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}

// Enter in the text box: a line that starts a list ("- ", "* ", "1. ", "- [ ] ") gets the next one started for it, and Enter on
// an empty item ends the list (the marker goes, leaving a plain line). Returns the new text and caret, or null to leave Enter alone.
export function continueList(text: string, caret: number): { text: string; caret: number } | null {
  const start = text.lastIndexOf('\n', caret - 1) + 1;
  const line = text.slice(start, caret);
  const m = /^(\s*)(?:([-*+])(?: \[[ xX]\])?|(\d+)([.)]))\s/.exec(line);
  if (!m) return null;
  if (!line.slice(m[0].length).trim()) return { text: text.slice(0, start) + text.slice(caret), caret: start };
  const marker = m[3] ? `${Number(m[3]) + 1}${m[4]} ` : `${m[2]} ${/\[[ xX]\]/.test(m[0]) ? '[ ] ' : ''}`;
  const add = `\n${m[1]}${marker}`;
  return { text: text.slice(0, caret) + add + text.slice(caret), caret: caret + add.length };
}
