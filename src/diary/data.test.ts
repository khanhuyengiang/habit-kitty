import { beforeAll, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for Capacitor's Filesystem: files keyed by path, folders implied by the paths.
const fs = new Map<string, Buffer>();
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    async writeFile({ path, data, encoding }: { path: string; data: string; encoding?: string }) { fs.set(path, Buffer.from(data, encoding === 'utf8' ? 'utf8' : 'base64')); return { uri: path }; },
    async readFile({ path }: { path: string }) { const b = fs.get(path); if (!b) throw new Error('File does not exist'); return { data: b.toString('base64') }; },
    async readdir({ path }: { path: string }) {
      const names = [...fs.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/')).map((k) => ({ name: k.slice(path.length + 1) }));
      if (!names.length) throw new Error('Folder does not exist');
      return { files: names };
    },
    async deleteFile({ path }: { path: string }) { if (!fs.delete(path)) throw new Error('File does not exist'); },
    async mkdir() {},
    async rmdir({ path }: { path: string }) { const p = path.replace(/\/+$/, ''); for (const k of [...fs.keys()]) if (k === p || k.startsWith(`${p}/`)) fs.delete(k); },
    async rename({ from, to }: { from: string; to: string }) { for (const [k, v] of [...fs.entries()]) if (k.startsWith(`${from}/`)) { fs.delete(k); fs.set(`${to}${k.slice(from.length)}`, v); } },
  },
}));

const data = await import('./data.ts');
const { dayOf } = await import('../calendar.ts');
const day = dayOf(2026, 9, 12);
const text = (path: string) => fs.get(path)?.toString('utf8');

describe('diary data', () => {
  beforeAll(async () => {
    // an old save: one page inside it, and the diary settings that used to live in the game
    fs.set('habit-kitty/diary/2026-10-01.md', Buffer.from('---\nmood: calm\nupdated: 1\n---\nAlready a file\n'));
    expect(await data.initDiary({ diary: { [day]: { text: 'From the old save', updated: 5 } }, trackamaniac: true, moodNames: { joyful: 'Yay' } })).toBe(true);
  });

  it('moves an old save\'s pages into files and keeps the pages already there', () => {
    expect(data.diaryReady()).toBe(true);
    expect(data.entryOf(day)?.text).toBe('From the old save');
    expect(data.entryOf(dayOf(2026, 9, 1))?.mood).toBe('calm');
    expect(text(`habit-kitty/diary/2026-10-12.md`)).toContain('From the old save');
    expect(data.dayCount()).toBe(2);
  });

  it('starts a new diary with every option on, and the emotion names the old save had, in diary.json', () => {
    const want = { trackamaniac: true, teleportation: true, photographer: true, titles: true, starry: true, moodNames: { joyful: 'Yay' } };
    expect(data.diaryExtras()).toEqual(want);
    expect(JSON.parse(text('habit-kitty/diary.json')!)).toEqual(want);
  });

  it('saves a page with a photo, and clears it again', async () => {
    const d = dayOf(2026, 9, 20);
    expect(await data.saveEntry(d, { text: 'Hello', photo: true, updated: 9 }, new Blob([new Uint8Array([1, 2, 3])]))).toBe(true);
    expect(data.hasPageOn(d)).toBe(true);
    expect(fs.has('habit-kitty/photos/2026-10-20.jpg')).toBe(true);
    expect([...(await (await data.getPhoto(d))!.arrayBuffer().then((b) => new Uint8Array(b)))]).toEqual([1, 2, 3]);
    expect(data.pageCount()).toBe(3);
    expect(await data.saveEntry(d, null, 'none')).toBe(true);
    expect(data.entryOf(d)).toBeUndefined();
    expect(fs.has('habit-kitty/diary/2026-10-20.md')).toBe(false);
    expect(fs.has('habit-kitty/photos/2026-10-20.jpg')).toBe(false);
  });

  it('stores up to four photos and drops the extra ones when there are fewer', async () => {
    const d = dayOf(2026, 9, 25);
    const blobs = [1, 2, 3, 4].map((n) => new Blob([new Uint8Array([n])]));
    expect(await data.saveEntry(d, { text: 'Four', photo: true, photos: 4, updated: 1 }, blobs)).toBe(true);
    for (const f of ['', '-2', '-3', '-4']) expect(fs.has(`habit-kitty/photos/2026-10-25${f}.jpg`)).toBe(true);
    expect(await data.saveEntry(d, { text: 'Two', photo: true, photos: 2, updated: 2 }, blobs.slice(0, 2))).toBe(true);
    expect(fs.has('habit-kitty/photos/2026-10-25-2.jpg')).toBe(true);
    expect(fs.has('habit-kitty/photos/2026-10-25-3.jpg')).toBe(false);
    expect(fs.has('habit-kitty/photos/2026-10-25-4.jpg')).toBe(false);
    expect(await data.saveEntry(d, null, 'none')).toBe(true);
    expect(fs.has('habit-kitty/photos/2026-10-25-2.jpg')).toBe(false);
  });

  it('keeps the stored photo when asked to', async () => {
    const d = dayOf(2026, 9, 21);
    await data.saveEntry(d, { text: 'a', photo: true, updated: 1 }, new Blob([new Uint8Array([7])]));
    await data.saveEntry(d, { text: 'b', photo: true, updated: 2 }, 'keep');
    expect(fs.has('habit-kitty/photos/2026-10-21.jpg')).toBe(true);
    await data.saveEntry(d, null, 'none');
  });

  it('saves, edits and clears a month\'s reflection', async () => {
    expect(await data.saveReflection('2026-10', 'A good month.\n')).toBe(true);
    expect(data.reflectionOf('2026-10')?.text).toBe('A good month.');
    expect(text('habit-kitty/reflections/2026-10.md')).toContain('A good month.');
    expect(await data.saveReflection('2026-13', 'nope')).toBe(false);
    expect(await data.saveReflection('2026-10', '   ')).toBe(true);
    expect(data.reflectionOf('2026-10')).toBeUndefined();
    expect(fs.has('habit-kitty/reflections/2026-10.md')).toBe(false);
  });

  it('keeps people and settings, and drops what is malformed', async () => {
    expect(await data.updateExtras({ people: [{ id: 'a', name: 'Mum', month: 3, day: 14, year: 1965 }, { id: 'b', name: 'Bad', month: 2, day: 31 }] })).toBe(true);
    expect(data.diaryExtras().people?.map((p) => p.name)).toEqual(['Mum']);
    expect(data.diaryExtras().trackamaniac).toBe(true);   // untouched settings stay
  });

  it('backs up and restores everything, replacing what was there', async () => {
    await data.saveReflection('2026-09', 'September');
    const b = await data.collectDiary();
    expect(Object.keys(b.diary).length).toBe(2);
    expect(b.reflections['2026-09'].text).toBe('September');
    expect(b.extras.people?.[0].name).toBe('Mum');

    await data.saveEntry(dayOf(2026, 9, 25), { text: 'written after the backup', updated: 3 }, 'none');
    const other = { diary: { [dayOf(2026, 8, 1)]: { text: 'Restored', updated: 4, photo: true } }, photos: { [dayOf(2026, 8, 1)]: new Uint8Array([9, 9]) },
      reflections: { '2026-08': { text: 'August', updated: 1 } }, extras: { people: [{ id: 'z', name: 'Zoe', month: 1, day: 2 }] } };
    expect(await data.restoreDiary(other)).toBe(true);
    expect(Object.keys(data.diaryEntries()).length).toBe(1);
    expect(data.entryOf(dayOf(2026, 8, 1))?.photo).toBe(true);
    expect(data.reflectionOf('2026-09')).toBeUndefined();
    expect(data.reflectionOf('2026-08')?.text).toBe('August');
    expect(data.diaryExtras()).toEqual({ people: [{ id: 'z', name: 'Zoe', month: 1, day: 2 }] });
    expect([...fs.keys()].filter((k) => k.startsWith('habit-kitty/')).sort()).toEqual([
      'habit-kitty/diary.json', 'habit-kitty/diary/2026-09-01.md', 'habit-kitty/photos/2026-09-01.jpg', 'habit-kitty/reflections/2026-08.md']);
    expect([...fs.keys()].some((k) => k.startsWith('habit-kitty-restore'))).toBe(false);

    expect(await data.restoreDiary(b)).toBe(true);   // and back again
    expect(data.reflectionOf('2026-09')?.text).toBe('September');
    expect(data.diaryExtras().people?.[0].name).toBe('Mum');
  });

  it('takes the settings from an older backup that kept them in the game', async () => {
    expect(await data.restoreDiary({ diary: {}, photos: {} }, { trackamaniac: true, moodNames: { sad: 'Blue' } })).toBe(true);
    expect(data.diaryExtras()).toEqual({ trackamaniac: true, moodNames: { sad: 'Blue' } });
  });
});
