// Notes, pure so they can be tested. A note is one Markdown file; its name is its title (so Obsidian shows it the same way).
import { esc } from '../shared/html.ts';
import { localDateKey } from '../shared/dates.ts';

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
//   kitty-notebook: "Recipes"    the notebook it is in (none when not set; the notebooks' looks are in ./books.ts)
//   ---
//
// Any other frontmatter (Obsidian's tags, aliases...) is kept as it is. Only what differs from the default is written.
export type Cover = { kind: 'icon'; name: string } | { kind: 'image'; src: string } | null;
export const NOTE_COLORS = ['pink', 'lavender', 'blue', 'mint', 'lemon', 'peach'] as const;
// "none", or the name of a sticker icon (Kitty Gallery's too, so any name is kept: one that is gone is drawn as a heart).
const DOODLE = /^[\w-]{1,40}$/;
export const NOTE_FACES = ['happy', 'open', 'sleepy', 'sad', 'starving'] as const;
export type NoteColor = typeof NOTE_COLORS[number];
export type NoteDoodle = string;
export type NoteFace = typeof NOTE_FACES[number];
export interface ParsedNote { front: string[]; cover: Cover; color: NoteColor; doodle: NoteDoodle; face: NoteFace; date?: string; book?: string; body: string }

const FRONT = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;
const KEY = /^kitty-(icon|image|color|doodle|face|date|notebook):\s*(.*)$/;
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
  return localDateKey(n.mtime);
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
  return { front, cover, color: oneOf(NOTE_COLORS, v.color, 'pink'), doodle: DOODLE.test(v.doodle ?? '') ? v.doodle : 'heart', face: oneOf(NOTE_FACES, v.face, 'happy'),
    ...(isDateText(v.date) && { date: v.date }), ...(bookName(v.notebook ?? '') && { book: bookName(v.notebook) }), body: text.slice(m[0].length) };
}

// The note's text again, with this look (no frontmatter at all when there is nothing to put in it).
export function composeNote({ front, cover, color, doodle, face, date, book, body }: ParsedNote): string {
  const lines = [...front];
  if (cover?.kind === 'icon') lines.push(`kitty-icon: ${cover.name}`);
  else if (cover?.kind === 'image') lines.push(`kitty-image: ${cover.src}`);
  if (color !== 'pink') lines.push(`kitty-color: ${color}`);
  if (doodle !== 'heart') lines.push(`kitty-doodle: ${doodle}`);
  if (face !== 'happy') lines.push(`kitty-face: ${face}`);
  if (date) lines.push(`kitty-date: ${date}`);
  if (book && bookName(book)) lines.push(`kitty-notebook: "${bookName(book)}"`);   // quoted, so Obsidian reads any name as text
  return lines.some((l) => l.trim()) ? `---\n${lines.join('\n')}\n---\n${body}` : body;
}

// A notebook's name as it is kept: one line, no quotes or control characters, at most 40 characters ('' when nothing is left).
export const MAX_BOOK_NAME = 40;
export const bookName = (raw: string): string =>
  raw.normalize('NFC').replace(/["\\\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_BOOK_NAME).trim();
export const sameBook = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// The note's notebook changed (or taken away with ''), everything else kept as it is.
export const withBook = (text: string, book: string): string => composeNote({ ...parseNote(text), book: book || undefined });

// A task line ("- [ ] milk") ticked or unticked: `line` counts the body's lines from 0. Null when that line is not a task.
const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s)/;
export function toggleTask(body: string, line: number): string | null {
  const lines = body.split('\n');
  const m = TASK.exec(lines[line] ?? '');
  if (!m) return null;
  lines[line] = `${m[1]}${m[2] === ' ' ? 'x' : ' '}${m[3]}${lines[line].slice(m[0].length)}`;
  return lines.join('\n');
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
export const plainText = (text: string, max = 280): string => cardLines(text, max).map((l) => l.text).join('\n');

// The same, line by line, with a task line's tick: true (done) or false (to do); none on any other line.
// A heading line says head: true; a bullet or numbered line says its mark in bullet ("•", or "1."); a task line has its box instead.
export function cardLines(text: string, max = 280): { text: string; task?: boolean; head?: boolean; bullet?: string }[] {
  const out: { text: string; task?: boolean; head?: boolean; bullet?: string }[] = [];
  let left = max;
  for (const raw of text.split('\n')) {
    const t = cleanLine(raw);
    if (!t) continue;
    if (left <= 0) { const last = out[out.length - 1]; if (last && !last.text.endsWith('…')) last.text = `${last.text.trimEnd()}…`; break; }
    const box = TASK.exec(raw);
    const mark = box ? null : /^\s*(?:([-*+])|(\d+[.)]))\s+/.exec(raw);
    out.push({ text: cut(t, left), ...(box && { task: box[2] !== ' ' }), ...(/^\s*#{1,6}\s+/.test(raw) && { head: true }), ...(mark && { bullet: mark[1] ? '•' : mark[2] }) });
    left -= t.length + 1;
  }
  return out;
}

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

// `tasks`: the task boxes can be ticked (each says which line it is, data-line, see toggleTask); otherwise they are only shown.
export function renderMarkdown(md: string, o: { tasks?: boolean } = {}): string {
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
      // A list is its lines, one level deep: a line indented under another is inside that item (a bullet list in a numbered
      // one, say), and the numbers of the outer list carry on past it. Deeper indents count as that one level.
      const ordered = /\d/.test(list[1]);
      type Item = { ordered: boolean; text: string; line: number; kids: Item[] };
      const tops: Item[] = [];
      for (; i < lines.length; i++) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        const item: Item = { ordered: /\d/.test(m[2]), text: m[3], line: i, kids: [] };
        if (m[1] && tops.length) tops[tops.length - 1].kids.push(item);
        else if (item.ordered !== ordered) break;
        else tops.push(item);
      }
      const itemHtml = (it: Item): string => {
        const task = /^\[([ xX])\]\s+(.*)$/.exec(it.text);
        const kids = listHtml(it.kids);
        if (!task) return `<li>${inline(it.text)}${kids}</li>`;
        const done = task[1] === ' ' ? '' : ' done', box = task[1] === ' ' ? '' : 'checked';
        return o.tasks
          ? `<li class="task${done}"><label><input type="checkbox" data-line="${it.line}" ${box}> <span>${inline(task[2])}</span></label>${kids}</li>`
          : `<li class="task${done}"><input type="checkbox" disabled ${box}> ${inline(task[2])}${kids}</li>`;
      };
      // consecutive items of one kind make one <ul> or <ol>
      function listHtml(items: Item[]): string {
        let html = '';
        for (let k = 0; k < items.length;) {
          let e = k;
          while (e < items.length && items[e].ordered === items[k].ordered) e++;
          const tag = items[k].ordered ? 'ol' : 'ul';
          html += `<${tag}>${items.slice(k, e).map(itemHtml).join('')}</${tag}>`;
          k = e;
        }
        return html;
      }
      out.push(listHtml(tops));
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
  if (!line.slice(m[0].length).trim()) {
    if (m[1]) { const out = text.slice(0, start) + line.slice(m[1].length) + text.slice(caret); return { text: out, caret: caret - m[1].length }; }
    return { text: text.slice(0, start) + text.slice(caret), caret: start };
  }
  const marker = m[3] ? `${Number(m[3]) + 1}${m[4]} ` : `${m[2]} ${/\[[ xX]\]/.test(m[0]) ? '[ ] ' : ''}`;
  const add = `\n${m[1]}${marker}`;
  return { text: text.slice(0, caret) + add + text.slice(caret), caret: caret + add.length };
}

// ---- the editing buttons under the text box ----
export type LineKind = 'bullet' | 'number' | 'task' | 'h1' | 'h2';
const LINE_MARK: Record<LineKind, string> = { bullet: '- ', number: '1. ', task: '- [ ] ', h1: '# ', h2: '## ' };
const LINE_ANY = /^(\s*)(?:#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;
const kindOf = (line: string): LineKind | null => {
  if (/^\s*#\s/.test(line)) return 'h1';
  if (/^\s*##\s/.test(line)) return 'h2';
  if (/^\s*[-*+]\s+\[[ xX]\]\s/.test(line)) return 'task';
  if (/^\s*[-*+]\s/.test(line)) return 'bullet';
  if (/^\s*\d+[.)]\s/.test(line)) return 'number';
  return null;
};

// Makes the lines the selection touches a bullet, task, H1 or H2 line; on lines that already are that kind, back to a plain paragraph.
// Any other mark on a line (another kind, a numbered list) is replaced. Returns the new text and selection.
export function toggleLineKind(text: string, from: number, to: number, kind: LineKind): { text: string; from: number; to: number } {
  const start = text.lastIndexOf('\n', from - 1) + 1;
  let end = text.indexOf('\n', Math.max(to, from));
  if (end < 0) end = text.length;
  if (to > from && to > start && text[to - 1] === '\n') end = to - 1;   // a selection that ends at a line's start leaves that line alone
  const lines = text.slice(start, end).split('\n');
  const first = lines.find((l) => l.trim()) ?? lines[0];
  const plain = kindOf(first) === kind;
  // numbers: carry on from the line above if that is a numbered item at the same indent, else start at 1
  const above = text.slice(0, Math.max(0, start - 1)).split('\n').pop() ?? '';
  const prev = start > 0 ? /^(\s*)(\d+)[.)]\s/.exec(above) : null;
  let n = prev && prev[1].length === (LINE_ANY.exec(first)![1].length) ? Number(prev[2]) + 1 : 1;
  const out = lines.map((l) => {
    if (lines.length > 1 && !l.trim()) return l;
    const m = LINE_ANY.exec(l)!;
    return plain ? m[1] + l.slice(m[0].length) : m[1] + (kind === 'number' ? `${n++}. ` : LINE_MARK[kind]) + l.slice(m[0].length);
  });
  const block = out.join('\n');
  const delta = block.length - (end - start);
  const firstDelta = out[0].length - lines[0].length;
  return { text: text.slice(0, start) + block + text.slice(end), from: Math.max(start, from + firstDelta), to: Math.max(start, to + delta) };
}

// Wraps the selection in a mark (** for bold, * for italic, ~~ for strikethrough); if it already has it, takes it off.
// With nothing selected the pair goes in and the caret between. Returns the new text and selection.
export function toggleWrap(text: string, from: number, to: number, mark: string): { text: string; from: number; to: number } {
  const n = mark.length, sel = text.slice(from, to);
  const solo = (i: number) => mark !== '*' || text[i] !== '*';   // a lone * is italic; the ** of a bold is not
  if (sel.length > 2 * n && sel.startsWith(mark) && sel.endsWith(mark) && solo(n + from) && solo(to - n - 1))
    return { text: text.slice(0, from) + sel.slice(n, -n) + text.slice(to), from, to: to - 2 * n };
  if (text.slice(from - n, from) === mark && text.slice(to, to + n) === mark && solo(from - n - 1) && solo(to + n))
    return { text: text.slice(0, from - n) + sel + text.slice(to + n), from: from - n, to: to - n };
  return { text: text.slice(0, from) + mark + sel + mark + text.slice(to), from: from + n, to: to + n };
}

// Indent (one level, three spaces: it nests under a "1. " item too) or take back out the list lines the selection touches.
// Other lines are left alone, and a line that is indented already goes no deeper.
export const INDENT = '   ';
export function indentLines(text: string, from: number, to: number, dir: 'in' | 'out'): { text: string; from: number; to: number } {
  const start = text.lastIndexOf('\n', from - 1) + 1;
  let end = text.indexOf('\n', Math.max(to, from));
  if (end < 0) end = text.length;
  if (to > from && to > start && text[to - 1] === '\n') end = to - 1;
  let first = 0;
  const lines = text.slice(start, end).split('\n').map((l, k) => {
    let r = l;
    if (dir === 'in') { if (/^[-*+\d]/.test(l) && kindOf(l)) r = INDENT + l; }
    else r = l.replace(/^(?: {1,4}|\t)(?=\S)/, '');
    if (k === 0) first = r.length - l.length;
    return r;
  });
  const block = lines.join('\n');
  return { text: text.slice(0, start) + block + text.slice(end), from: Math.max(start, from + first), to: Math.max(start, to + block.length - (end - start)) };
}
