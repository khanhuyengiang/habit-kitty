import { describe, expect, it } from 'vitest';
import {
  achievementsToLeave, ageOf, titleFor, allTags, checkIntegrity, collection, counts, migrate, monthOf, deleteAchievement, deleteMainQuest, deleteSideQuest, emptyData, levelOf,
  moveSideQuest, photosOf, saveAchievement, saveMainQuest, saveSideQuest, setMainQuestArchived, setSideQuestArchived,
  sideQuestsOf, updateProfile, type AchievementInput,
} from './ops.ts';
import { inkFor, isValidDate } from './model.ts';

// A Thailand quest with Food and Sightseeing.
function world() {
  let d = emptyData();
  const m = saveMainQuest(d, { title: 'Discover Thailand', description: '' }); d = m.data;
  const f = saveSideQuest(d, { mainQuestId: m.id, title: 'Food', color: '#f26fa3', icon: 'food' }); d = f.data;
  const s = saveSideQuest(d, { mainQuestId: m.id, title: 'Sightseeing', color: '#4a9bea', icon: 'temple' }); d = s.data;
  return { d, main: m.id, food: f.id, sights: s.id };
}
const input = (w: ReturnType<typeof world>, over: Partial<AchievementInput> = {}): AchievementInput => ({
  title: 'Pad thai', description: 'Street stall', location: 'Bangkok', icon: 'food', tags: [], mainQuestId: w.main, sideQuestId: w.food,
  status: 'completed', rarity: 'rare', date: '2026-10-01', photos: [], ...over,
});

describe('quests', () => {
  it('creates main and side quests with stable ids and order', () => {
    const w = world();
    expect(w.d.mainQuests).toHaveLength(1);
    expect(sideQuestsOf(w.d, w.main).map((s) => s.title)).toEqual(['Food', 'Sightseeing']);
    expect(checkIntegrity(w.d)).toEqual([]);
  });
  it('rejects empty and duplicate names', () => {
    const w = world();
    expect(saveMainQuest(w.d, { title: '  ', description: '' }).errors.title).toBeTruthy();
    expect(saveSideQuest(w.d, { mainQuestId: w.main, title: 'food', color: '#f26fa3', icon: 'food' }).errors.title).toMatch(/already/);
    expect(saveSideQuest(w.d, { mainQuestId: w.main, title: 'X', color: 'red', icon: 'food' }).errors.color).toBeTruthy();
  });
  it('recolouring a side quest keeps its id, so its cards follow', () => {
    const w = world();
    const a = saveAchievement(w.d, input(w));
    const r = saveSideQuest(a.data, { mainQuestId: w.main, title: 'Food', color: '#45c27a', icon: 'food' }, w.food);
    expect(r.data.sideQuests.find((s) => s.id === w.food)?.color).toBe('#45c27a');
    expect(r.data.achievements[0].sideQuestId).toBe(w.food);
  });
  it('reorders side quests', () => {
    const w = world();
    expect(sideQuestsOf(moveSideQuest(w.d, w.sights, -1), w.main).map((s) => s.title)).toEqual(['Sightseeing', 'Food']);
    expect(moveSideQuest(w.d, w.food, -1)).toBe(w.d);
  });
  it('archives without losing cards, and deletes with them', () => {
    const w = world();
    const a = saveAchievement(w.d, input(w, { photos: [{ imageUrl: 'idb:1' }] }));
    expect(sideQuestsOf(setSideQuestArchived(a.data, w.food, true), w.main)).toHaveLength(1);
    expect(setMainQuestArchived(a.data, w.main, true).achievements).toHaveLength(1);
    const del = deleteSideQuest(a.data, w.food);
    expect(del.data.achievements).toHaveLength(0);
    expect(del.removedPhotos).toEqual(['idb:1']);
    expect(deleteMainQuest(a.data, w.main).data).toMatchObject({ mainQuests: [], sideQuests: [], achievements: [], photos: [] });
    expect(checkIntegrity(del.data)).toEqual([]);
  });
});

describe('achievements', () => {
  it('validates required fields and the side/main relationship', () => {
    const w = world();
    const other = saveMainQuest(w.d, { title: 'Laos', description: '' });
    expect(saveAchievement(w.d, input(w, { title: '' })).errors.title).toBeTruthy();
    expect(saveAchievement(w.d, input(w, { icon: 'nope' })).errors.icon).toBeTruthy();
    expect(saveAchievement(other.data, input(w, { mainQuestId: other.id })).errors.sideQuestId).toMatch(/different|no side/);
    expect(saveAchievement(w.d, input(w, { date: '2026-02-31' })).errors.date).toBeTruthy();
    expect(saveAchievement(w.d, input(w, { date: '' }), undefined, { requireDate: true }).errors.date).toBeTruthy();
  });
  it('keeps the location and limits its length', () => {
    const w = world();
    expect(saveAchievement(w.d, input(w)).data.achievements[0].location).toBe('Bangkok');
    expect(saveAchievement(w.d, input(w, { location: 'x'.repeat(61) })).errors.location).toBeTruthy();
  });
  it('planned cards never carry a rarity or a completion date', () => {
    const w = world();
    const r = saveAchievement(w.d, input(w, { status: 'planned', rarity: 'legendary', date: '2027-01-01' }));
    const a = r.data.achievements[0];
    expect(a).toMatchObject({ status: 'planned', rarity: 'normal', plannedDate: '2027-01-01', completionDate: null });
    expect(checkIntegrity(r.data)).toEqual([]);
  });
  it('completing a planned card updates the same record, no duplicate', () => {
    const w = world();
    const planned = saveAchievement(w.d, input(w, { status: 'planned', date: '2027-01-01', photos: [{ imageUrl: 'idb:ref' }] }));
    const ref = photosOf(planned.data, planned.id)[0];
    const done = saveAchievement(planned.data, input(w, { status: 'completed', rarity: 'mythical', date: '2027-01-05', photos: [{ id: ref.id, imageUrl: ref.imageUrl }, { imageUrl: 'idb:new' }] }), planned.id, { requireDate: true });
    expect(done.errors).toEqual({});
    expect(done.data.achievements).toHaveLength(1);
    expect(done.id).toBe(planned.id);
    expect(done.data.achievements[0]).toMatchObject({ status: 'completed', rarity: 'mythical', completionDate: '2027-01-05', plannedDate: '2027-01-01', icon: 'food' });
    expect(done.data.achievements[0].createdAt).toBe(planned.data.achievements[0].createdAt);
    expect(photosOf(done.data, done.id).map((p) => p.imageUrl)).toEqual(['idb:ref', 'idb:new']);
    expect(photosOf(done.data, done.id)[0].id).toBe(ref.id);
  });
  it('reports photos removed by an edit and by a delete', () => {
    const w = world();
    const a = saveAchievement(w.d, input(w, { photos: [{ imageUrl: 'idb:a' }, { imageUrl: 'idb:b' }] }));
    const [pa] = photosOf(a.data, a.id);
    const e = saveAchievement(a.data, input(w, { photos: [{ id: pa.id, imageUrl: pa.imageUrl }] }), a.id);
    expect(e.removedPhotos).toEqual(['idb:b']);
    const del = deleteAchievement(e.data, a.id);
    expect(del.removedPhotos).toEqual(['idb:a']);
    expect(del.data.mainQuests).toHaveLength(1);   // deleting a card keeps its quests
    expect(del.data.sideQuests).toHaveLength(2);
  });
  it('moving a card to another main quest needs one of its side quests, or none', () => {
    const w = world();
    const a = saveAchievement(w.d, input(w));
    const laos = saveMainQuest(a.data, { title: 'Laos', description: '' });
    const sw = saveSideQuest(laos.data, { mainQuestId: laos.id, title: 'Nature', color: '#45c27a', icon: 'tree' });
    expect(saveAchievement(sw.data, input(w, { mainQuestId: laos.id }), a.id).errors.sideQuestId).toBeTruthy();
    const moved = saveAchievement(sw.data, input(w, { mainQuestId: laos.id, sideQuestId: sw.id }), a.id);
    expect(moved.errors).toEqual({});
    expect(checkIntegrity(moved.data)).toEqual([]);
    const loose = saveAchievement(sw.data, input(w, { mainQuestId: laos.id, sideQuestId: '' }), a.id);
    expect(loose.errors).toEqual({});
    expect(loose.data.achievements[0].sideQuestId).toBeNull();
  });
  it('can sit directly in the main quest, without a side quest', () => {
    const w = world();
    const a = saveAchievement(w.d, input(w, { sideQuestId: '' }));
    expect(a.errors).toEqual({});
    expect(checkIntegrity(a.data)).toEqual([]);
    const b = saveAchievement(a.data, input(w, { title: 'Temple' })).data;
    expect(collection(b, w.main, { side: 'none', status: 'all' }).map((x) => x.title)).toEqual(['Pad thai']);
    expect(counts(b, w.main, null)).toEqual({ done: 1, planned: 0 });
    expect(counts(b, w.main)).toEqual({ done: 2, planned: 0 });
    expect(deleteSideQuest(b, w.food).data.achievements.map((x) => x.title)).toEqual(['Pad thai']);
  });
  it('tidies tags, limits them and filters by them', () => {
    const w = world();
    const a = saveAchievement(w.d, input(w, { tags: [' #Street food ', 'street  food', 'friends', ''] }));
    expect(a.data.achievements[0].tags).toEqual(['Street food', 'friends']);
    expect(saveAchievement(w.d, input(w, { tags: Array.from({ length: 11 }, (_, n) => `t${n}`) })).errors.tags).toBeTruthy();
    expect(saveAchievement(w.d, input(w, { tags: ['x'.repeat(25)] })).errors.tags).toBeTruthy();
    const d = saveAchievement(a.data, input(w, { title: 'Temple', tags: ['friends'] })).data;
    expect(collection(d, w.main, { side: 'all', status: 'all', tag: 'FRIENDS' })).toHaveLength(2);
    expect(collection(d, w.main, { side: 'all', status: 'all', tag: 'street food' }).map((x) => x.title)).toEqual(['Pad thai']);
    expect(allTags(d)).toEqual(['friends', 'Street food']);
  });
  it('knows the month of a card and fills in tags for older saves', () => {
    const w = world();
    const a = saveAchievement(w.d, input(w)).data;
    expect(monthOf(a.achievements[0])).toBe('2026-10');
    expect(monthOf({ ...a.achievements[0], status: 'planned', plannedDate: null })).toBe('');
    const old = { ...a, achievements: a.achievements.map(({ tags: _t, ...rest }) => rest) } as unknown as typeof a;
    expect(migrate(old).achievements[0].tags).toEqual([]);
    expect(migrate(a)).toBe(a);
  });
  it('moves side-quest colours saved before the palette to their palette colour', () => {
    const w = world();
    const old = { ...w.d, sideQuests: w.d.sideQuests.map((s) => ({ ...s, color: '#ff6fa5' })) };
    expect(migrate(old).sideQuests.every((s) => s.color === '#f26fa3')).toBe(true);
  });
  it('sorts completed first (newest first), then planned by date, and filters', () => {
    const w = world();
    let d = w.d;
    for (const [title, status, date, side] of [
      ['old', 'completed', '2026-01-01', w.food], ['new', 'completed', '2026-05-01', w.sights],
      ['later', 'planned', '2027-05-01', w.food], ['soon', 'planned', '2027-01-01', w.food], ['whenever', 'planned', '', w.sights],
    ] as const) d = saveAchievement(d, input(w, { title, status, date, sideQuestId: side })).data;
    expect(collection(d, w.main).map((a) => a.title)).toEqual(['new', 'old', 'soon', 'later', 'whenever']);
    expect(collection(d, w.main, { side: w.food, status: 'planned' }).map((a) => a.title)).toEqual(['soon', 'later']);
    expect(counts(d, w.main, w.sights)).toEqual({ done: 1, planned: 1 });
  });

  it("lists every card of every quest that is not archived when the main quest is ''", () => {
    const w = world();
    let d = saveAchievement(w.d, input(w, { title: 'Pad thai' })).data;
    const other = saveMainQuest(d, { title: 'Discover Japan', description: '' }); d = other.data;
    d = saveAchievement(d, input(w, { title: 'Ramen', mainQuestId: other.id, sideQuestId: '' })).data;
    expect(collection(d, '', { side: 'all', status: 'all', sort: 'name' }).map((a) => a.title)).toEqual(['Pad thai', 'Ramen']);
    expect(collection(d, '', { side: 'none', status: 'all' }).map((a) => a.title)).toEqual(['Ramen']);
    d = setMainQuestArchived(d, other.id, true);
    expect(collection(d, '').map((a) => a.title)).toEqual(['Pad thai']);
    expect(collection(d, other.id).map((a) => a.title)).toEqual(['Ramen']);
  });
});

describe('sorting', () => {
  it('sorts by name and by rarity', () => {
    const w = world();
    let d = w.d;
    for (const [title, status, rarity, date] of [['Banana', 'completed', 'rare', '2026-01-01'], ['apple', 'completed', 'legendary', '2026-02-01'], ['Cherry', 'completed', 'normal', '2026-03-01'], ['Date', 'planned', 'normal', '']] as const) {
      d = saveAchievement(d, input(w, { title, status, rarity, date })).data;
    }
    const names = (sort: 'time' | 'name' | 'rarity') => collection(d, w.main, { side: 'all', status: 'all', sort }).map((a) => a.title);
    expect(names('time')).toEqual(['Cherry', 'apple', 'Banana', 'Date']);
    expect(names('name')).toEqual(['apple', 'Banana', 'Cherry', 'Date']);
    expect(names('rarity')).toEqual(['apple', 'Banana', 'Cherry', 'Date']);
  });
});

describe('profile and helpers', () => {
  it('level counts completed cards only, and each level needs more than the last', () => {
    const w = world();
    let d = w.d;
    for (let n = 0; n < 4; n++) d = saveAchievement(d, input(w, { title: `c${n}` })).data;
    d = saveAchievement(d, input(w, { title: 'p', status: 'planned' })).data;
    expect(levelOf(d)).toMatchObject({ level: 2, completed: 4, into: 2, per: 3 });   // 2 left level 1, then 2 of the 3 for level 2
    expect(levelOf(emptyData())).toMatchObject({ level: 1, into: 0, per: 2 });
    expect([1, 2, 3, 4, 5, 10].map(achievementsToLeave)).toEqual([2, 3, 3, 4, 4, 7]);
  });

  it('gives a title every 10 levels', () => {
    expect([1, 9, 10, 19, 20, 39, 40, 500].map(titleFor)).toEqual([
      'Novice Adventurer', 'Novice Adventurer', 'Eager Wanderer', 'Eager Wanderer', 'Curious Explorer', 'Seasoned Adventurer', 'Trailblazer', 'Mythic Adventurer']);
  });

  it('keeps the name, gender and birth year, and the age grows each year', () => {
    const d = emptyData();
    const r = updateProfile(d, { displayName: ' Kay ', gender: 'girl', birthYear: 1998, avatarUrl: null }, 2026);
    expect(r.errors).toEqual({});
    expect(r.data.user).toMatchObject({ displayName: 'Kay', gender: 'girl', birthYear: 1998 });
    expect([2026, 2027].map((y) => ageOf(r.data.user, y))).toEqual([28, 29]);
    expect(ageOf(d.user)).toBeNull();
    expect(updateProfile(d, { displayName: 'K', gender: null, birthYear: null, avatarUrl: null }, 2026).errors).toEqual({});
    expect(updateProfile(d, { displayName: '', gender: 'x' as never, birthYear: 2027, avatarUrl: null }, 2026).errors)
      .toMatchObject({ displayName: expect.any(String), gender: expect.any(String), birthYear: expect.any(String) });
  });
  it('validates dates and picks a readable ink colour', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(inkFor('#f2b705')).toBe('#231d44');
    expect(inkFor('#6a6de8')).toBe('#ffffff');
  });
});
