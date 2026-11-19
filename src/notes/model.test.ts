import { describe, expect, it } from 'vitest';
import { bookName, cardLines, composeNote, continueList, excerpt, noteDate, parseNote, plainText, renderMarkdown, titleFromText, safeName, searchNotes, sortNotes, indentLines, toggleLineKind, toggleTask, toggleWrap, uniqueName, withBook, type Note } from './model.ts';
import { booksOf, dropBook, emptyBooks, looseNotes, moveBook, notesIn, putBook, sanitizeBooks } from './books.ts';
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
    expect(renderMarkdown('- [x] done\n- [ ] todo')).toContain('<li class="task done"><input type="checkbox" disabled checked> done</li>');
    expect(renderMarkdown('# Shop\n- [ ] eggs\n- [x] milk', { tasks: true })).toContain('<input type="checkbox" data-line="1" >');
    expect(renderMarkdown('# Shop\n- [ ] eggs\n- [x] milk', { tasks: true })).toContain('<input type="checkbox" data-line="2" checked>');
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
    // a doodle no icon has (one deleted in Kitty Gallery, say) is kept, and drawn as a heart; one that can't be a name is a heart
    expect(parseNote('---\nkitty-color: <b>\nkitty-doodle: bomb\n---\nx')).toMatchObject({ color: 'pink', doodle: 'bomb' });
    expect(parseNote('---\nkitty-doodle: <b>\n---\nx')).toMatchObject({ doodle: 'heart' });
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

describe('tasks', () => {
  it('ticks and unticks one line', () => {
    expect(toggleTask('Shop\n- [ ] eggs\n  * [x] milk', 1)).toBe('Shop\n- [x] eggs\n  * [x] milk');
    expect(toggleTask('Shop\n- [ ] eggs\n  * [x] milk', 2)).toBe('Shop\n- [ ] eggs\n  * [ ] milk');
    expect(toggleTask('1. [X] call', 0)).toBe('1. [ ] call');
    expect(toggleTask('Shop\n- eggs', 1)).toBeNull();
    expect(toggleTask('Shop', 5)).toBeNull();
  });
  it('keeps the boxes on a card', () => {
    expect(cardLines('# Shop\n- [ ] eggs\n- [x] milk\nsoon')).toEqual([{ text: 'Shop', head: true }, { text: 'eggs', task: false }, { text: 'milk', task: true }, { text: 'soon' }]);
    expect(plainText('- [ ] eggs\nmilk')).toBe('eggs\nmilk');
  });
});

describe('notebooks', () => {
  it('is kept in the frontmatter, quoted', () => {
    const t = withBook('hello', 'Trips: 2026');
    expect(t).toBe('---\nkitty-notebook: "Trips: 2026"\n---\nhello');
    expect(parseNote(t).book).toBe('Trips: 2026');
    expect(withBook(t, '')).toBe('hello');
    expect(parseNote('---\nkitty-notebook: Ideas\n---\nx').book).toBe('Ideas');
    expect(bookName('  a "b"\n c ')).toBe('a b c');
  });
  const notes: Note[] = [
    { name: 'A', text: withBook('a', 'Recipes'), mtime: 1 }, { name: 'B', text: withBook('b', 'recipes'), mtime: 2 },
    { name: 'C', text: withBook('c', 'Zoo'), mtime: 3 }, { name: 'D', text: 'd', mtime: 4 },
  ];
  it('lists the file\'s notebooks, then those only notes name', () => {
    const d = sanitizeBooks({ books: [{ name: 'Zoo', icon: 'cat', color: 'blue' }, { name: 'Empty', icon: '<x>', color: 'red' }, { name: 'zoo' }] });
    expect(d.books).toEqual([{ name: 'Zoo', icon: 'cat', color: 'blue' }, { name: 'Empty', icon: 'book', color: 'lavender' }]);
    expect(booksOf(d, notes).map((b) => b.name)).toEqual(['Zoo', 'Empty', 'Recipes']);
    expect(notesIn(notes, 'RECIPES').map((n) => n.name)).toEqual(['A', 'B']);
    expect(looseNotes(notes).map((n) => n.name)).toEqual(['D']);
  });
  it('adds, changes, moves and drops one', () => {
    const all = booksOf(emptyBooks(), notes);
    const d = putBook(emptyBooks(), all, null, { name: 'New', icon: 'star', color: 'mint' });
    expect(d.books.map((b) => b.name)).toEqual(['Recipes', 'Zoo', 'New']);
    expect(putBook(d, d.books, 'zoo', { name: 'Animals', icon: 'dog', color: 'pink' }).books[1]).toEqual({ name: 'Animals', icon: 'dog', color: 'pink' });
    expect(moveBook(d.books, 'New', -1).books.map((b) => b.name)).toEqual(['Recipes', 'New', 'Zoo']);
    expect(moveBook(d.books, 'Recipes', -1).books.map((b) => b.name)).toEqual(['Recipes', 'Zoo', 'New']);
    expect(dropBook(d.books, 'zoo').books.map((b) => b.name)).toEqual(['Recipes', 'New']);
  });
});

describe('editing buttons', () => {
  it('cycles a line: bullet to checklist to paragraph', () => {
    const a = toggleLineKind('- milk', 3, 3, 'task');
    expect(a.text).toBe('- [ ] milk');
    expect(toggleLineKind(a.text, a.from, a.to, 'task').text).toBe('milk');
    expect(toggleLineKind('milk', 0, 0, 'h2').text).toBe('## milk');
    expect(toggleLineKind('# milk', 0, 0, 'h2').text).toBe('## milk');
    expect(toggleLineKind('1. a\n2. b', 0, 9, 'bullet').text).toBe('- a\n- b');
  });
  it('wraps and unwraps', () => {
    expect(toggleWrap('a word b', 2, 6, '**').text).toBe('a **word** b');
    expect(toggleWrap('a **word** b', 4, 8, '**').text).toBe('a word b');
    expect(toggleWrap('a **word** b', 4, 8, '*').text).toBe('a ***word*** b');
    expect(toggleWrap('a ~~x~~', 4, 5, '~~').text).toBe('a x');
    expect(toggleWrap('ab', 1, 1, '*')).toEqual({ text: 'a**b', from: 2, to: 2 });
  });
});

describe('numbered and nested lists', () => {
  it('numbers lines and carries on from above', () => {
    expect(toggleLineKind('a\nb', 0, 3, 'number').text).toBe('1. a\n2. b');
    expect(toggleLineKind('1. a\n- x\nb', 9, 9, 'number').text).toBe('1. a\n- x\n1. b');
    expect(toggleLineKind('1. a\nb', 5, 5, 'number').text).toBe('1. a\n2. b');
  });
  it('indents one level and back', () => {
    const r = indentLines('1. a\n- x\ntext', 5, 8, 'in');
    expect(r.text).toBe('1. a\n   - x\ntext');
    expect(indentLines(r.text, 5, 5, 'in').text).toBe(r.text);   // no deeper than one level
    expect(indentLines(r.text, 5, 5, 'out').text).toBe('1. a\n- x\ntext');
    expect(indentLines('text', 0, 0, 'in').text).toBe('text');
  });
  it('shows a list inside a numbered list and carries the numbers on', () => {
    const h = renderMarkdown('1. a\n   - x\n   - y\n2. b\n   - [ ] t\n3. c');
    expect(h).toBe('<ol><li>a<ul><li>x</li><li>y</li></ul></li><li>b<ul><li class="task"><input type="checkbox" disabled > t</li></ul></li><li>c</li></ol>');
  });
});
