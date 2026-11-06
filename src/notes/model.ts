// Notes, pure so they can be tested. A note is one Markdown file; its name is its title (so Obsidian shows it the same way).
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
export const titleFromText = (text: string): string => safeName(excerpt(text, MAX_NAME));

export const sortNotes = (notes: Note[]): Note[] => [...notes].sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));

// Every word of the search must be in the title or the text.
export function searchNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return notes;
  return notes.filter((n) => { const hay = `${n.name}\n${n.text}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
}

// The first line of text worth showing under the title, without the Markdown marks.
export function excerpt(text: string, max = 90): string {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '').replace(/[*_`~]|\[\[|\]\]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
    if (line && !/^(-{3,}|`{3})/.test(line)) return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
  }
  return '';
}

// ---- Markdown to HTML: the common parts, with everything escaped first, so a note can never inject markup ----
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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
