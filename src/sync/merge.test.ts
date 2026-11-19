import { describe, expect, it } from 'vitest';
import { NONE, merge3, mergeById, mergeDays, mergeDeep, mergeText, CLASH_LINE } from './merge3.ts';
import { mergeGame, type GameSave } from './merge-game.ts';
import { mergeBackups } from './merge.ts';
import { adoptCat, addMindfulTask, doMindfulTask, feedCat, newState, releaseToColony, removeMindfulTask, returnToShelter, setCatDay, type ActionResult, type AppState } from '../habit/rules.ts';
import { emptyData as emptyShop, sanitize as sanitizeShop } from '../shopping/model.ts';
import { emptyData as emptyAchievements } from '../achievement/ops.ts';
import { packBackup as packAchievement, unpackBackup as unpackAchievement } from '../achievement/backup.ts';
import { defaultBook } from '../notes/books.ts';
import type { Backup } from '../backup.ts';
import type { Data as AchievementData } from '../achievement/model.ts';

const at = (day: number, hour = 12) => new Date(2026, 0, 5 + day, hour, 0, 0);
const ok = (r: ActionResult): AppState => { if (!r.ok) throw new Error(r.reason); return r.state; };
const save = (state: AppState, extra: Partial<GameSave> = {}): GameSave => ({ v: 1, state, offsetHours: 0, log: [], savedAt: 0, ...extra });
const backup = (o: Partial<Backup> = {}): Backup => ({ game: save(newState()), diary: {}, photos: {}, ...o });
const catOf = (s: GameSave, id = 'c1') => s.state.cats.find((c) => c.id === id)!;

describe('three-way basics', () => {
  it('takes the side that changed, and mine when both did', () => {
    expect(merge3(1, 1, 2)).toBe(2);
    expect(merge3(1, 3, 1)).toBe(3);
    expect(merge3(1, 3, 2)).toBe(3);
    expect(merge3(1, 3, 2, 'theirs')).toBe(2);
  });

  it('keeps what only one side has when there is no base', () => {
    expect(merge3(NONE, undefined, 5)).toBe(5);
    expect(merge3(NONE, 5, undefined)).toBe(5);
  });

  it('merges sets of days: additions from both, removals from either', () => {
    expect(mergeDays([1, 2, 3], [1, 2, 3, 4], [1, 3, 5])).toEqual([1, 3, 4, 5]);
    expect(mergeDays(NONE, [1, 2], [2, 3])).toEqual([1, 2, 3]);
  });

  it('drops an item deleted on one side, keeps one changed on the other', () => {
    const base = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
    expect(mergeById(base, [{ id: 'b', v: 1 }], base)).toEqual([{ id: 'b', v: 1 }]);
    expect(mergeById(base, [{ id: 'b', v: 1 }], [{ id: 'a', v: 2 }, { id: 'b', v: 1 }])).toEqual([{ id: 'b', v: 1 }, { id: 'a', v: 2 }]);
  });

  it('a nested object follows the record that was changed last', () => {
    const prefer = (m: { u?: number }, t: { u?: number }) => (m.u === undefined || t.u === undefined ? undefined : t.u > m.u ? 'theirs' : 'mine');
    const row = (u: number, name: string) => ({ rows: [{ id: 'a', u, loc: { name } }] });
    expect(mergeDeep(row(1, 'x'), row(2, 'm'), row(3, 't'), prefer)).toEqual(row(3, 't'));
  });

  it('keeps a list reordered on one side while the other side added to it', () => {
    expect(mergeById([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], [{ id: 'c' }, { id: 'a' }, { id: 'b' }]).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(mergeDeep({ order: ['a', 'b', 'c'] }, { order: ['a', 'b', 'c'] }, { order: ['c', 'b', 'a'] })).toEqual({ order: ['c', 'b', 'a'] });
  });

  it('keeps both texts when both changed one', () => {
    expect(mergeText('a', 'a b', 'a c', 'theirs')).toBe(`a c${CLASH_LINE}a b`);
    expect(mergeText('a', 'a', 'a c', 'mine')).toBe('a c');
  });

  it('merges JSON field by field and record by record', () => {
    const base = { list: [{ id: 'x', name: 'Milk', done: false }], opts: { a: 1, b: 1 } };
    const mine = { list: [{ id: 'x', name: 'Milk', done: true }], opts: { a: 2, b: 1 } };
    const theirs = { list: [{ id: 'x', name: 'Oat milk', done: false }, { id: 'y', name: 'Tea', done: false }], opts: { a: 1, b: 3 } };
    expect(mergeDeep(base, mine, theirs)).toEqual({
      list: [{ id: 'x', name: 'Oat milk', done: true }, { id: 'y', name: 'Tea', done: false }], opts: { a: 2, b: 3 },
    });
  });
});

describe('Habit Kitty', () => {
  const base = ok(adoptCat(newState(), { id: 'c1', name: 'Mochi', habit: 'Meditate' }, at(0)));

  it('keeps meals given on either device and works affection out again', () => {
    const phone = ok(feedCat(base, 'c1', at(0)));
    const web = ok(feedCat(phone, 'c1', at(1)));   // the web had day 0 already; day 1 is new
    const tablet = ok(setCatDay(phone, 'c1', catOf(save(phone)).adoptedDay + 2, true, at(2)));
    const out = mergeGame(save(phone), save(web), save(tablet), at(2));
    expect(catOf(out).fedDays).toEqual([0, 1, 2].map((d) => catOf(save(phone)).adoptedDay + d));
    expect(out.state.xp).toBe(15);
    expect(catOf(out).totalFeedings).toBe(3);
  });

  it('lets a meal taken back with time travel stay taken back', () => {
    const fed = ok(feedCat(base, 'c1', at(0)));
    const unfed = ok(setCatDay(fed, 'c1', catOf(save(fed)).adoptedDay, false, at(0)));
    const out = mergeGame(save(fed), save(fed), save(unfed), at(0));
    expect(catOf(out).fedDays).toEqual([]);
    expect(out.state).toBe(save(unfed).state);   // one side's record as it is: no replay needed
  });

  it('combines both devices without a base', () => {
    const a = ok(feedCat(base, 'c1', at(0)));
    const b = ok(adoptCat(base, { id: 'c2', name: 'Tofu', habit: 'Read' }, at(0)));
    const out = mergeGame(null, save(a), save(b), at(0));
    expect(out.state.cats.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(catOf(out).fedDays.length).toBe(1);
  });

  it('a kitty given back to the shelter stays there, even if the other side fed it', () => {
    const gave = ok(returnToShelter(base, 'c1', at(1)));
    const fed = ok(feedCat(base, 'c1', at(1)));
    const out = mergeGame(save(base), save(fed), save(gave), at(1));
    expect(catOf(out).status).toBe('shelter');
    expect(catOf(out).fedDays.length).toBe(1);
  });

  it('a kitty released on one side is not brought back by a meal on the other; the meal goes to the stray', () => {
    const released = ok(releaseToColony(base, 'c1', 's1', at(1)));
    const fed = ok(feedCat(base, 'c1', at(1)));
    const out = mergeGame(save(base), save(released), save(fed), at(1));
    expect(out.state.cats).toEqual([]);
    const stray = out.state.tasks.find((t) => t.id === 's1')!;
    expect(stray.doneDays).toEqual([catOf(save(base)).adoptedDay + 1]);
  });

  it('keeps strays done on either side, and the log and accomplishments of both', () => {
    const withStray = addMindfulTask(base, { id: 's1', name: 'Walk', xp: 5 }, at(0));
    const a = ok(doMindfulTask(withStray, 's1', at(0)));
    const b = ok(doMindfulTask(withStray, 's1', at(1)));
    const out = mergeGame(
      save(withStray),
      save(a, { log: [{ at: 1, text: 'a' }], accomplished: { first: 3 }, sound: { music: 10 } }),
      save(b, { log: [{ at: 2, text: 'b' }], accomplished: { first: 2, other: 5 }, sound: { music: 90 } }),
      at(1),
    );
    expect(out.state.tasks[0].doneDays.length).toBe(2);
    expect(out.log).toEqual([{ at: 2, text: 'b' }, { at: 1, text: 'a' }]);
    expect(out.accomplished).toEqual({ first: 2, other: 5 });
    expect(out.sound).toEqual({ music: 10 });   // each device keeps its own sound
  });

  it('a stray deleted on one side and done on the other is not paid twice', () => {
    const s0 = ok(doMindfulTask(addMindfulTask(newState(), { id: 's1', name: 'Walk', xp: 5 }, at(0)), 's1', at(0)));
    const did = ok(doMindfulTask(s0, 's1', at(1)));
    const out = mergeGame(save(s0), save(removeMindfulTask(s0, 's1')), save(did), at(1));
    expect(out.state.tasks.map((t) => t.id)).toEqual(['s1']);
    expect(out.state.retired ?? []).toEqual([]);
    expect(out.state.xp).toBe(did.xp);
  });

  it('keeps two identical deleted treats', () => {
    let s = newState();
    for (const id of ['t1', 't2']) s = ok(doMindfulTask(addMindfulTask(s, { id, name: id, xp: 5, kind: 'task' } as never, at(0)), id, at(0)));
    s = removeMindfulTask(removeMindfulTask(s, 't1'), 't2');
    const out = mergeGame(null, save(s), save(addMindfulTask(s, { id: 'x', name: 'X', xp: 1 }, at(0))), at(0));
    expect(out.state.retired).toHaveLength(2);
    expect(out.state.xp).toBe(s.xp);
  });

  it('keeps each device\'s own reminders', () => {
    const out = mergeGame(save(base), save(base, { reminder: { on: 1 } }), save(base, { reminder: { on: 2 } }), at(0));
    expect(out.reminder).toEqual({ on: 1 });
  });

  it('a conversion both devices already share is not a second one', () => {
    const released = ok(releaseToColony(base, 'c1', 's1', at(1)));
    const out = mergeGame(save(base), save(released), save(released), at(1));
    expect(out.state.tasks.map((t) => t.id)).toEqual(['s1']);
  });

  it('a kitty released on both sides becomes one stray', () => {
    const a = ok(releaseToColony(base, 'c1', 'sA', at(1)));
    const b = ok(releaseToColony(ok(feedCat(base, 'c1', at(1))), 'c1', 'sB', at(1)));
    const out = mergeGame(save(base), save(a), save(b), at(1));
    expect(out.state.tasks.map((t) => t.id)).toEqual(['sA']);
    expect(out.state.tasks[0].doneDays).toHaveLength(1);   // the meal given before the other side released it
  });
});

describe('the whole save', () => {
  const books = (...names: string[]) => JSON.stringify({ books: names.map((n, i) => defaultBook(n, i)) });
  const bookNames = (b: Backup) => (b.notebooks ? JSON.parse(b.notebooks).books.map((x: { name: string }) => x.name) : []);

  it('keeps the order of notebooks arranged on one side while the other added one', async () => {
    const out = await mergeBackups(backup({ notebooks: books('A', 'B', 'C') }), backup({ notebooks: books('A', 'B', 'C', 'D') }), backup({ notebooks: books('C', 'B', 'A') }));
    expect(bookNames(out)).toEqual(['C', 'B', 'A', 'D']);
  });

  it('deleting the last notebook on one side deletes it, not brings it back', async () => {
    const out = await mergeBackups(backup({ notebooks: books('A') }), backup({}), backup({ notebooks: books('A') }));
    expect(out.notebooks).toBeUndefined();
  });

  it('a part only one side has is kept when there is no base to say it was deleted', async () => {
    expect(bookNames(await mergeBackups(null, backup({}), backup({ notebooks: books('A') })))).toEqual(['A']);
  });

  it('keeps photos added to one page on both sides', async () => {
    const photo = (...n: number[]) => ({ photos: { 1: new Uint8Array([n[0]]) }, ...(n.length > 1 ? { morePhotos: { 1: n.slice(1).map((x) => new Uint8Array([x])) } } : {}) });
    const page = (n: number) => ({ 1: { text: 'x', updated: 1, photo: true, ...(n > 1 ? { photos: n } : {}) } });
    const out = await mergeBackups(backup({ diary: page(1), ...photo(1) }), backup({ diary: page(2), ...photo(1, 2) }), backup({ diary: page(2), ...photo(1, 3) }));
    expect([out.photos[1], ...out.morePhotos![1]].map((p) => p[0])).toEqual([1, 2, 3]);
    expect(out.diary[1].photos).toBe(3);
  });

  it('treats notes whose names differ only by case as one note', async () => {
    const out = await mergeBackups(backup({ notes: { Ideas: 'a' } }), backup({ notes: { Ideas: 'a mine' } }), backup({ notes: { ideas: 'a' , Fresh: 'y' } }));
    expect(out.notes).toEqual({ Ideas: 'a mine', Fresh: 'y' });
  });
  it('takes the newer diary title whole instead of joining two', async () => {
    const bk = (title: string, updated: number) => backup({ diary: { 1: { text: 'x', title, updated } } });
    expect((await mergeBackups(bk('Old', 1), bk('Mine', 2), bk('Theirs', 3))).diary[1].title).toBe('Theirs');
  });

  it('merges diary pages, keeping both texts when both changed one', async () => {
    const page = (text: string, updated: number, mood?: 'calm' | 'sad') => ({ text, updated, ...(mood ? { mood } : {}) });
    const base = backup({ diary: { 10: page('Hi', 1) } });
    const mine = backup({ diary: { 10: page('Hi there', 5, 'calm'), 11: page('New', 5) } });
    const theirs = backup({ diary: { 10: page('Hi friend', 6) }, photos: { 10: new Uint8Array([1]) } });
    const out = await mergeBackups(base, mine, theirs);
    expect(out.diary[10]).toEqual({ text: `Hi friend${CLASH_LINE}Hi there`, updated: 6, mood: 'calm', photo: true });
    expect(out.photos[10]).toEqual(new Uint8Array([1]));
    expect(out.diary[11].text).toBe('New');
  });

  it('deletes a page deleted on one side', async () => {
    const p = { text: 'x', updated: 1 };
    const out = await mergeBackups(backup({ diary: { 1: p, 2: p } }), backup({ diary: { 1: p } }), backup({ diary: { 1: p, 2: p } }));
    expect(Object.keys(out.diary)).toEqual(['1']);
  });

  it('keeps a note changed on both sides as a conflict copy', async () => {
    const out = await mergeBackups(
      backup({ notes: { Ideas: 'a', Old: 'x' } }),
      backup({ notes: { Ideas: 'a mine', Old: 'x' } }),
      backup({ notes: { Ideas: 'a theirs', Fresh: 'y' } }),
    );
    expect(out.notes).toEqual({ Ideas: 'a mine', Fresh: 'y', 'Ideas (conflict)': 'a theirs' });
  });

  it('merges Kitty Mart lists item by item', async () => {
    const shop = (items: { id: string; name: string; done: boolean }[]) =>
      JSON.stringify(sanitizeShop({ ...emptyShop(), lists: [{ id: 'l1', name: 'Aldi', items: items.map((i) => ({ qty: '', unit: '', cat: 'other', ...i })) }] }));
    const milk = { id: 'i1', name: 'Milk', done: false };
    const out = await mergeBackups(
      backup({ shopping: shop([milk]) }),
      backup({ shopping: shop([{ ...milk, done: true }]) }),
      backup({ shopping: shop([milk, { id: 'i2', name: 'Bread', done: false }]) }),
    );
    const items = JSON.parse(out.shopping!).lists[0].items;
    expect(items.map((i: { name: string; done: boolean }) => [i.name, i.done])).toEqual([['Milk', true], ['Bread', false]]);
  });

  it('takes the Kitty Gallery icon changed last', async () => {
    const art = Array.from({ length: 18 }, () => '.'.repeat(18));
    const icon = (name: string, updated: number) => ({ category: 'sticker', id: 'my1', name, group: 'user', art, updated });
    const g = (...icons: object[]) => JSON.stringify({ version: 1, icons });
    const out = await mergeBackups(backup({ gallery: g(icon('One', 1)) }), backup({ gallery: g(icon('Two', 5)) }), backup({ gallery: g(icon('Three', 9)) }));
    expect(JSON.parse(out.gallery!).icons[0].name).toBe('Three');
  });

  it('merges Kitty Achievement row by row and brings back a quest something new was added to', async () => {
    const d0 = emptyAchievements(1);
    const quest = { id: 'q1', userId: d0.user.id, title: 'Travel', description: '', coverImageUrl: null, sortOrder: 0, createdAt: 1, updatedAt: 1, archivedAt: null };
    const ach = (id: string, title: string, updatedAt: number) => ({
      id, userId: d0.user.id, mainQuestId: 'q1', sideQuestId: null, title, description: '', location: '', tags: [], icon: 'star',
      status: 'planned' as const, rarity: 'normal' as const, plannedDate: null, completionDate: null, createdAt: 1, updatedAt,
    });
    const pack = (d: Partial<AchievementData>) => packAchievement({ ...d0, mainQuests: [quest], ...d }, new Map());
    const base = backup({ achievement: await pack({ achievements: [ach('a1', 'Paris', 1)] }) });
    const mine = backup({ achievement: await pack({ mainQuests: [], achievements: [] }) });   // deleted the quest
    const theirs = backup({ achievement: await pack({ achievements: [ach('a1', 'Paris', 1), ach('a2', 'Rome', 2)] }) });
    const { data } = unpackAchievement((await mergeBackups(base, mine, theirs)).achievement!);
    expect(data.achievements.map((a) => a.title)).toEqual(['Rome']);
    expect(data.mainQuests.map((q) => q.id)).toEqual(['q1']);
  });
});
