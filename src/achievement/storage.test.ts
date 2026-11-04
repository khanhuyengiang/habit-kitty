import { describe, expect, it } from 'vitest';
import { MemoryRepo, Saver, type Repo } from './storage.ts';
import { emptyData } from './ops.ts';

describe('Saver', () => {
  it('ends with the newest data when saves overlap', async () => {
    const repo = new MemoryRepo();
    const s = new Saver(repo);
    const a = emptyData(), b = { ...a, user: { ...a.user, displayName: 'B' } }, c = { ...a, user: { ...a.user, displayName: 'C' } };
    await Promise.all([s.save(a), s.save(b), s.save(c)]);
    expect(repo.data?.user.displayName).toBe('C');
  });
  it('reports a failed save and retries it', async () => {
    let fail = true;
    const repo: Repo = { ...new MemoryRepo(), load: async () => ({ data: null, photos: new Map() }), putPhoto: async () => {}, deletePhotos: async () => {}, replaceAll: async () => {},
      saveData: async () => { if (fail) throw new Error('disk full'); } };
    const s = new Saver(repo);
    expect(await s.save(emptyData())).toBe(false);
    expect(s.error).toBeTruthy();
    fail = false;
    expect(await s.retry()).toBe(true);
    expect(s.error).toBeNull();
  });
});
