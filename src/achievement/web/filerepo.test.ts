import { describe, expect, it, vi } from 'vitest';
import { emptyData, saveMainQuest } from '../ops.ts';

vi.mock('@capacitor/filesystem', async () => (await import('../../test/fsmock.ts')).fsModule);
const { fs: files, put } = await import('../../test/fsmock.ts');
const { FileRepo } = await import('./filerepo.ts');

describe('FileRepo', () => {
  it("keeps Kitty Achievement's files in their own folder, next to Habit Kitty's", async () => {
    files.clear();
    put('habit-kitty/save.json', 'not ours');
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
