import { describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for Capacitor's Filesystem: files keyed by path (with a modified time), folders implied.
const fs = new Map<string, { data: Buffer; mtime: number }>();
let clock = 1000;
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    async writeFile({ path, data, encoding }: { path: string; data: string; encoding?: string }) { fs.set(path, { data: Buffer.from(data, encoding === 'utf8' ? 'utf8' : 'base64'), mtime: ++clock }); return { uri: path }; },
    async readFile({ path }: { path: string }) { const f = fs.get(path); if (!f) throw new Error('File does not exist'); return { data: f.data.toString('base64') }; },
    async readdir({ path }: { path: string }) {
      const p = path.replace(/\/+$/, '');
      const files = [...fs.entries()].filter(([k]) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/')).map(([k, f]) => ({ name: k.slice(p.length + 1), type: 'file', mtime: f.mtime }));
      if (!files.length) throw new Error('Folder does not exist');
      return { files };
    },
    async deleteFile({ path }: { path: string }) { if (!fs.delete(path)) throw new Error('File does not exist'); },
    async rmdir({ path }: { path: string }) { const p = path.replace(/\/+$/, ''); for (const k of [...fs.keys()]) if (k === p || k.startsWith(`${p}/`)) fs.delete(k); },
    async rename({ from, to }: { from: string; to: string }) { for (const [k, v] of [...fs.entries()]) if (k.startsWith(`${from}/`)) { fs.delete(k); fs.set(`${to}${k.slice(from.length)}`, v); } },
  },
}));

const data = await import('./data.ts');
const names = () => data.allNotes().map((n) => n.name).sort();
const onDisk = () => [...fs.keys()].filter((k) => k.startsWith('habit-kitty-notes/')).map((k) => k.slice('habit-kitty-notes/'.length)).sort();

describe('notes data', () => {
  it('starts with the notes that are already files, and ignores other files', async () => {
    fs.set('habit-kitty-notes/Old note.md', { data: Buffer.from('from before'), mtime: 5 });
    fs.set('habit-kitty-notes/readme.txt', { data: Buffer.from('not a note'), mtime: 6 });
    await data.initNotes();
    expect(data.notesReady()).toBe(true);
    expect(names()).toEqual(['Old note']);
    expect(data.noteOf('Old note')?.text).toBe('from before');
    expect(data.noteOf('Old note')?.mtime).toBe(5);
  });

  it('creates a note named after its title, and numbers a clash', async () => {
    expect(await data.saveNote(null, 'Ideas', '# Ideas')).toEqual({ ok: true, name: 'Ideas' });
    expect(await data.saveNote(null, 'ideas', 'other')).toEqual({ ok: true, name: 'ideas 2' });
    expect(await data.saveNote(null, 'a/b', 'x')).toEqual({ ok: true, name: 'a b' });
    expect(onDisk()).toContain('Ideas.md');
    expect(onDisk()).toContain('ideas 2.md');
  });

  it('keeps a note\'s name while it is edited, and renames its file when the title changes', async () => {
    expect(await data.saveNote('Ideas', 'Ideas', '# Ideas\nmore')).toEqual({ ok: true, name: 'Ideas' });
    expect(data.noteOf('Ideas')?.text).toBe('# Ideas\nmore');
    const gone: string[] = [];
    data.onNoteRemoved((n) => gone.push(n));
    expect(await data.saveNote('Ideas', 'Better name', '# Ideas\nmore')).toEqual({ ok: true, name: 'Better name' });
    expect(names()).not.toContain('Ideas');
    expect(onDisk()).not.toContain('Ideas.md');
    expect(onDisk()).toContain('Better name.md');
    expect(gone).toEqual(['Ideas']);
  });

  it('does not rename onto another note', async () => {
    expect(await data.saveNote('Better name', 'Old note', 'x')).toEqual({ ok: true, name: 'Old note 2' });
  });

  it('refuses a note that is too long', async () => {
    expect((await data.saveNote(null, 'Huge', 'x'.repeat(200_001))).ok).toBe(false);
    expect(names()).not.toContain('Huge');
  });

  it('deletes a note, its file and tells the sync', async () => {
    const gone: string[] = [];
    data.onNoteRemoved((n) => gone.push(n));
    expect(await data.deleteNote('Old note')).toBe(true);
    expect(names()).not.toContain('Old note');
    expect(onDisk()).not.toContain('Old note.md');
    expect(gone).toEqual(['Old note']);
  });

  it('imports files without overwriting, numbering a clash', async () => {
    const before = names().length;
    expect(await data.importNotes([{ name: 'a b.md', text: 'imported' }, { name: 'Note.markdown', text: 'new' }, { name: 'x.txt', text: 'y'.repeat(200_001) }])).toBe(2);
    expect(names().length).toBe(before + 2);
    expect(data.noteOf('a b')?.text).toBe('x');          // the existing one is untouched
    expect(data.noteOf('a b 2')?.text).toBe('imported');
    expect(data.noteOf('Note')?.text).toBe('new');
  });

  it('backs up and restores, replacing every note', async () => {
    const backup = data.collectNotes();
    expect(Object.keys(backup).sort()).toEqual(names());
    expect(await data.restoreNotes({ Restored: 'only me' })).toBe(true);
    expect(names()).toEqual(['Restored']);
    expect(onDisk()).toEqual(['Restored.md']);
    expect([...fs.keys()].some((k) => k.startsWith('habit-kitty-notes-restore'))).toBe(false);
    expect(await data.restoreNotes(backup)).toBe(true);
    expect(names()).toEqual(Object.keys(backup).sort());
    expect(await data.restoreNotes({})).toBe(true);
    expect(names()).toEqual([]);
  });
});
