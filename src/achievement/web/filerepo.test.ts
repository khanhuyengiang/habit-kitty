import { describe, expect, it, vi } from 'vitest';
import { emptyData, saveMainQuest } from '../ops.ts';

// The phone's files, in memory: path -> contents (base64 for photos, text for data.json).
const files = new Map<string, string>();
vi.mock('@capacitor/filesystem', () => {
  const missing = () => { throw new Error('File does not exist'); };
  return {
    Directory: { Data: 'DATA' },
    Encoding: { UTF8: 'utf8' },
    Filesystem: {
      readFile: async ({ path }: { path: string }) => ({ data: files.get(path) ?? missing() }),
      writeFile: async ({ path, data }: { path: string; data: string }) => { files.set(path, data); return { uri: path }; },
      rename: async ({ from, to }: { from: string; to: string }) => { files.set(to, files.get(from) ?? missing()); files.delete(from); },
      deleteFile: async ({ path }: { path: string }) => { if (!files.delete(path)) missing(); },
      readdir: async ({ path }: { path: string }) => {
        const names = [...files.keys()].filter((k) => k.startsWith(`${path}/`)).map((k) => k.slice(path.length + 1));
        if (!names.length) missing();
        return { files: names.map((name) => ({ name })) };
      },
      rmdir: async ({ path }: { path: string }) => { for (const k of [...files.keys()]) if (k.startsWith(`${path}/`)) files.delete(k); },
    },
  };
});
const { FileRepo } = await import('./filerepo.ts');

describe('FileRepo', () => {
  it("keeps Kitty Achievement's files in their own folder, next to Habit Kitty's", async () => {
    files.clear();
    files.set('habit-kitty/save.json', 'not ours');
    const repo = new FileRepo();
    expect((await repo.load()).data).toBeNull();   // a first start: nothing saved yet

    const d = saveMainQuest(emptyData(), { title: 'Thailand', description: '' }).data;
    await repo.replaceAll(d, new Map([['idb:p1', new Blob([new Uint8Array([7, 8, 9])])]]));
    expect([...files.keys()].sort()).toEqual(['achievement-kitty/data.json', 'achievement-kitty/photos/p1.jpg', 'habit-kitty/save.json']);

    const back = await repo.load();
    expect(back.data).toEqual(d);
    expect(new Uint8Array(await back.photos.get('idb:p1')!.arrayBuffer())).toEqual(new Uint8Array([7, 8, 9]));

    await repo.deletePhotos(['idb:p1']);
    expect([...files.keys()].sort()).toEqual(['achievement-kitty/data.json', 'habit-kitty/save.json']);
  });
});
