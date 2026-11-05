import { describe, expect, it } from 'vitest';
import { packBackup, unpackBackup } from './backup.ts';
import { packBackup as packKitty } from '../store.ts';
import { emptyData, saveAchievement, saveMainQuest, saveSideQuest } from './ops.ts';
import { strToU8, zipSync } from 'fflate';

describe('save files', () => {
  it('round-trips the data and its photos', async () => {
    let d = emptyData();
    const m = saveMainQuest(d, { title: 'Thailand', description: '' }); d = m.data;
    const s = saveSideQuest(d, { mainQuestId: m.id, title: 'Food', color: '#ff6fa5', icon: 'food' }); d = s.data;
    const a = saveAchievement(d, { title: 'Pad thai', description: '', location: '', icon: 'food', tags: ['street'], mainQuestId: m.id, sideQuestId: s.id, status: 'completed', rarity: 'rare', date: '2026-10-01', photos: [{ imageUrl: 'idb:abc-1' }] });
    const photos = new Map([['idb:abc-1', new Blob([new Uint8Array([1, 2, 3])])]]);
    const back = unpackBackup(await packBackup(a.data, photos));
    expect(back.data).toEqual(a.data);
    expect(new Uint8Array(await back.photos.get('idb:abc-1')!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
  it('reads its save out of a combined .kitty backup, and says so when there is none', async () => {
    const d = emptyData();
    const inner = await packBackup(d, new Map());
    expect(unpackBackup(packKitty({ game: {}, diary: {}, photos: {}, achievement: inner })).data).toEqual(d);
    expect(() => unpackBackup(packKitty({ game: {}, diary: {}, photos: {} }))).toThrow(/no achievements/);
  });
  it('rejects files that are not backups', () => {
    expect(() => unpackBackup(new Uint8Array([1, 2, 3, 4]))).toThrow();
    expect(() => unpackBackup(zipSync({ 'manifest.json': strToU8('{"app":"habit-kitty","format":1}'), 'data.json': strToU8('{}') }))).toThrow(/no achievements/);
    expect(() => unpackBackup(zipSync({ 'manifest.json': strToU8('{"app":"achievement-kitty","format":1}'), 'data.json': strToU8('{"version":1}') }))).toThrow(/unreadable/);
  });
});
