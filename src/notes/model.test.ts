import { describe, expect, it } from 'vitest';
import { composeNote, continueList, excerpt, noteDate, parseNote, renderMarkdown, titleFromText, safeName, searchNotes, sortNotes, uniqueName, type Note } from './model.ts';
import { planSync } from './sync.ts';

describe('file names', () => {
  it('removes characters a file name cannot have', () => {
    expect(safeName('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
    expect(safeName('  ..hidden  ')).toBe('hidden');
    expect(safeName('   ')).toBe('Untitled');
    expect(safeName('x'.repeat(200)).length).toBe(80);
  });
  it('makes names unique, ignoring case', () => {
    expect(uniqueName('Ideas', [])).toBe('Ideas');
    expect(uniqueName('Ideas', ['ideas'])).toBe('Ideas 2');
    expect(uniqueName('Ideas', ['Ideas', 'Ideas 2', 'ideas 3'])).toBe('Ideas 4');
    expect(uniqueName('', ['Untitled'])).toBe('Untitled 2');
  });
});

describe('titleFromText', () => {
  it('uses the first line, cleaned up', () => {
    expect(titleFromText('# Plan for **May**\nmore')).toBe('Plan for May');
    expect(titleFromText('   \n')).toBe('Untitled');
    expect(titleFromText('a/b: c')).toBe('a b c');
  });
});

describe('listing', () => {
  const notes: Note[] = [{ name: 'Old', text: 'groceries and milk', mtime: 1 }, { name: 'New', text: 'Dentist on Monday', mtime: 9 }, { name: 'Milk run', text: '', mtime: 5 }];
  it('sorts the newest first', () => expect(sortNotes(notes).map((n) => n.name)).toEqual(['New', 'Milk run', 'Old']));
  it('searches the title and the text, every word', () => {
    expect(searchNotes(notes, 'milk').map((n) => n.name)).toEqual(['Old', 'Milk run']);
    expect(searchNotes(notes, 'dentist monday').map((n) => n.name)).toEqual(['New']);
    expect(searchNotes(notes, 'dentist milk')).toEqual([]);
    expect(searchNotes(notes, '  ')).toHaveLength(3);
  });
  it('shows the first real line under the title', () => {
    expect(excerpt('# Title\n\n**Bold** and [a link](http://x.y) here')).toBe('Title');
    expect(excerpt('---\n```\n- [ ] buy *milk*')).toBe('buy milk');
    expect(excerpt('')).toBe('');
    expect(excerpt('word '.repeat(50)).endsWith('…')).toBe(true);
  });
});

describe('markdown', () => {
  it('escapes everything first', () => {
    const html = renderMarkdown('<script>alert(1)</script> & "quotes"\n\n[x](javascript:alert(1))');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('&#60;script&#62;');
  });
  it('renders headings, emphasis, code and links', () => {
    expect(renderMarkdown('## Hi *there* **you** `a<b`')).toBe('<h2>Hi <em>there</em> <strong>you</strong> <code>a&#60;b</code></h2>');
    expect(renderMarkdown('see [site](https://example.com)')).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a>');
    expect(renderMarkdown('```\nlet x = 1 < 2;\n```')).toBe('<pre><code>let x = 1 &#60; 2;</code></pre>');
  });
  it('renders lists, tasks, quotes and rules', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
    expect(renderMarkdown('- [x] done\n- [ ] todo')).toContain('<li class="task"><input type="checkbox" disabled checked> done</li>');
    expect(renderMarkdown('> quoted\n> more')).toBe('<blockquote>quoted more</blockquote>');
    expect(renderMarkdown('a\n---\nb')).toBe('<p>a</p>\n<hr>\n<p>b</p>');
  });
  it('keeps line breaks inside a paragraph and shows wikilinks as text', () => {
    expect(renderMarkdown('one\ntwo')).toBe('<p>one<br>two</p>');
    expect(renderMarkdown('see [[Other note|that one]]')).toBe('<p>see <span class="wikilink">that one</span></p>');
  });
  it('does not turn snake_case or a * b into emphasis', () => {
    expect(renderMarkdown('snake_case_name and 2 * 3 * 4')).toBe('<p>snake_case_name and 2 * 3 * 4</p>');
  });
});

describe('planSync', () => {
  const state = { a: { l: 10, r: 20 }, b: { l: 10, r: 20 }, c: { l: 10, r: 20 }, d: { l: 10, r: 20 } };
  it('pushes what is only here and pulls what is only there', () => {
    expect(planSync([{ name: 'x', mtime: 1 }], [{ name: 'y', modified: 2 }], {})).toEqual([{ type: 'pull', name: 'y' }, { type: 'push', name: 'x' }].sort((p, q) => p.name.localeCompare(q.name)));
  });
  it('sends only what changed', () => {
    const local = [{ name: 'a', mtime: 10 }, { name: 'b', mtime: 11 }, { name: 'c', mtime: 10 }, { name: 'd', mtime: 12 }];
    const remote = [{ name: 'a', modified: 20 }, { name: 'b', modified: 20 }, { name: 'c', modified: 25 }, { name: 'd', modified: 26 }];
    expect(planSync(local, remote, state)).toEqual([{ type: 'push', name: 'b' }, { type: 'pull', name: 'c' }, { type: 'conflict', name: 'd' }]);
  });
  it('calls a note that exists on both sides but was never synced a conflict (the texts decide)', () => {
    expect(planSync([{ name: 'a', mtime: 1 }], [{ name: 'a', modified: 1 }], {})).toEqual([{ type: 'conflict', name: 'a' }]);
  });
});

describe('the card picture in the frontmatter', () => {
  it('reads an icon or an image, and keeps the other frontmatter', () => {
    expect(parseNote('just text')).toEqual({ front: [], cover: null, color: 'pink', doodle: 'heart', face: 'happy', body: 'just text' });
    expect(parseNote('---\ntags: [a]\nkitty-icon: cat\n---\n# Hi')).toEqual({ front: ['tags: [a]'], cover: { kind: 'icon', name: 'cat' }, color: 'pink', doodle: 'heart', face: 'happy', body: '# Hi' });
    expect(parseNote('---\nkitty-image: "data:image/jpeg;base64,AAAA"\n---\nx').cover).toEqual({ kind: 'image', src: 'data:image/jpeg;base64,AAAA' });
    expect(parseNote('---\nkitty-image: javascript:alert(1)\n---\nx').cover).toBeNull();
  });
  it('writes it back, and drops an empty frontmatter', () => {
    const p = parseNote('---\ntags: [a]\nkitty-icon: cat\n---\nbody');
    expect(composeNote({ ...p, cover: { kind: 'icon', name: 'star' } })).toBe('---\ntags: [a]\nkitty-icon: star\n---\nbody');
    expect(composeNote({ ...p, cover: null })).toBe('---\ntags: [a]\n---\nbody');
    expect(composeNote({ ...parseNote('---\nkitty-icon: cat\n---\nbody'), cover: null })).toBe('body');
    expect(composeNote({ front: [], cover: { kind: 'icon', name: 'cat' }, color: 'pink', doodle: 'heart', face: 'happy', body: 'b' })).toBe('---\nkitty-icon: cat\n---\nb');
  });
  it('keeps the colour and the doodle, writing only what is not the default', () => {
    const p = parseNote('---\nkitty-color: blue\nkitty-doodle: paw\nkitty-face: sleepy\n---\nx');
    expect([p.color, p.doodle, p.face]).toEqual(['blue', 'paw', 'sleepy']);
    expect(composeNote(p)).toBe('---\nkitty-color: blue\nkitty-doodle: paw\nkitty-face: sleepy\n---\nx');
    expect(composeNote({ ...p, color: 'pink', doodle: 'heart', face: 'happy' })).toBe('x');
    expect(parseNote('---\nkitty-color: <b>\nkitty-doodle: bomb\n---\nx')).toMatchObject({ color: 'pink', doodle: 'heart' });
  });
  it('is ignored by titles and search', () => {
    expect(titleFromText('---\nkitty-icon: cat\n---\nGroceries')).toBe('Groceries');
    expect(searchNotes([{ name: 'A', text: '---\nkitty-image: data:image/jpeg;base64,QUJD\n---\nhello', mtime: 1 }], 'QUJD')).toEqual([]);
  });
});

describe('continuing a list', () => {
  it('starts the next item', () => {
    expect(continueList('- milk', 6)).toEqual({ text: '- milk\n- ', caret: 9 });
    expect(continueList('1. a\n2. b', 9)).toEqual({ text: '1. a\n2. b\n3. ', caret: 13 });
    expect(continueList('- [x] done', 10)?.text).toBe('- [x] done\n- [ ] ');
  });
  it('ends the list on an empty item, and leaves other lines alone', () => {
    expect(continueList('- milk\n- ', 9)).toEqual({ text: '- milk\n', caret: 7 });
    expect(continueList('plain', 5)).toBeNull();
  });
});

describe('a note\'s date', () => {
  it('is kept in the frontmatter and written back', () => {
    const t = '---\nkitty-date: 2026-11-06\n---\nhi';
    expect(parseNote(t).date).toBe('2026-11-06');
    expect(composeNote(parseNote(t))).toBe(t);
    expect(parseNote('---\nkitty-date: 2026-02-30\n---\nhi').date).toBeUndefined();
    expect(noteDate({ text: t, mtime: 0 })).toBe('2026-11-06');
  });
});
