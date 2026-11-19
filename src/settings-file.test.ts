import { describe, expect, it } from 'vitest';
import { SETTINGS_FORMAT, isSettingsText, readSettings, settingsText, type SettingsFile } from './settings-file.ts';
import { applyMartSettings, emptyData, martSettingsOf, sanitize as sanitizeShop } from './shopping/model.ts';
import { isZip, packBackup, unpackBackup } from './backup.ts';

const blank18 = () => Array.from({ length: 18 }, () => '.'.repeat(18));
const teapot = () => { const a = blank18(); a[8] = '.....ssssssss.....'; return a; };

describe('the settings file', () => {
  const full: SettingsFile = {
    look: { theme: 'dark', fancy: false },
    habit: { allowRename: true, timeTravel: false, sound: { bgm: 10, meow: 0 }, muted: false, dayStart: 4, roomName: 'Attic', outdoorName: '' },
    diary: { trackamaniac: true, starry: true, moodNames: { calm: 'Zen' } },
    mart: { cats: emptyData().cats.reverse(), opts: { sink: false, learn: true, toPantry: true, showEmpty: false }, orders: { aldi: ['dairy', 'produce'] } },
    gallery: { icons: [{ category: 'sticker', id: 'teapot', name: 'Teapot', group: 'user', art: teapot(), updated: 5 }] },
  };

  it('reads back what it wrote', () => {
    const text = settingsText(full, '2026-11-16');
    expect(JSON.parse(text)).toMatchObject({ format: SETTINGS_FORMAT, version: 1, exported: '2026-11-16' });
    expect(isSettingsText(text)).toBe(true);
    expect(readSettings(text)).toEqual(full);
  });

  it('keeps only the parts it carries', () => {
    const s = readSettings(JSON.stringify({ format: SETTINGS_FORMAT, version: 1, look: { theme: 'light' } }));
    expect(s).toEqual({ look: { theme: 'light', fancy: true } });
  });

  it('never carries anything personal, even when a file has it', () => {
    const s = readSettings(JSON.stringify({
      format: SETTINGS_FORMAT, version: 1,
      diary: { titles: true, people: [{ name: 'Mum', month: 3, day: 4 }] },
      mart: { cats: [{ id: 'x', name: 'X', icon: 'bag', color: 'pink', subs: [] }], lists: [{ name: 'Aldi', items: [{ name: 'Milk' }] }], pantry: [{ name: 'Rice' }], places: { milk: { cat: 'x' } } },
    }));
    expect(s.diary).toEqual({ titles: true });
    expect(Object.keys(s.mart!)).toEqual(['cats', 'opts', 'orders']);
    expect(JSON.stringify(s)).not.toMatch(/Mum|Milk|Rice/);
  });

  it('checks what it reads', () => {
    const s = readSettings(JSON.stringify({
      format: SETTINGS_FORMAT, version: 1,
      look: { theme: 'neon' },
      habit: { allowRename: 'yes', sound: { bgm: 250, meow: -3, purr: 'loud' }, dayStart: 99, roomName: '  a   very long room name that keeps going on and on ' },
      mart: { orders: { ' Aldi ': ['dairy', 'nope', 'dairy'], lidl: ['nope'] } },
      gallery: { icons: [{ category: 'sticker', id: 'bad', name: 'Bad', art: ['x'] }] },
    }));
    expect(s.look).toEqual({ theme: 'device', fancy: true });
    expect(s.habit).toEqual({ sound: { bgm: 100, meow: 0 }, roomName: 'a very long room name that kee' });
    expect(s.mart!.orders).toEqual({ aldi: ['dairy'] });
    expect(s.gallery!.icons).toEqual([]);
  });

  it('refuses other files', () => {
    expect(() => readSettings('not json')).toThrow("That isn't a settings file.");
    expect(() => readSettings(JSON.stringify({ format: 'itty-bitty-kitty-icons', icons: [] }))).toThrow("That isn't a settings file.");
    expect(() => readSettings(JSON.stringify({ format: SETTINGS_FORMAT, version: 2 }))).toThrow(/newer version/);
    expect(() => readSettings(JSON.stringify({ format: SETTINGS_FORMAT, version: 1 }))).toThrow('There are no settings in that file.');
    expect(isSettingsText('{"v":1}')).toBe(false);
  });
});

describe("Kitty Mart's settings", () => {
  const mine = () => sanitizeShop({
    cats: [...emptyData().cats, { id: 'pets', name: 'Pets', icon: 'cat', color: 'pink', subs: [] }],
    lists: [{ id: 'a', name: 'Aldi', items: [{ id: '1', name: 'Kibble', qty: '', unit: '', cat: 'pets', done: false }, { id: '2', name: 'Milk', qty: '', unit: '', cat: 'dairy', done: false }] },
      { id: 'b', name: 'Corner shop', items: [], order: ['drinks'] }],
    pantry: [{ id: 'p', name: 'Rice', cat: 'pantry', sub: '' }],
  });

  it('takes the categories, options and aisle order, not the items', () => {
    const d = mine();
    d.lists[0].order = ['pets', 'dairy'];
    const s = martSettingsOf(d);
    expect(s.orders).toEqual({ aldi: ['pets', 'dairy'], 'corner shop': ['drinks'] });
    expect(JSON.stringify(s)).not.toMatch(/Kibble|Milk|Rice/);
  });

  it("puts them on someone else's data, keeping their lists", () => {
    const theirs = mine();
    const cats = emptyData().cats.reverse().map((c) => (c.id === 'dairy' ? { ...c, icon: 'cow', color: 'blue' as const } : c));
    const next = applyMartSettings(theirs, { cats, opts: { ...theirs.opts, sink: false }, orders: { ' ALDI': ['dairy', 'produce'] } });
    expect(next.cats.map((c) => c.id)).toEqual(cats.map((c) => c.id));
    expect(next.cats.find((c) => c.id === 'dairy')).toMatchObject({ icon: 'cow', color: 'blue' });
    expect(next.opts.sink).toBe(false);
    expect(next.lists[0].items.map((i) => [i.name, i.cat])).toEqual([['Kibble', 'other'], ['Milk', 'dairy']]);   // Pets is not in the settings
    expect(next.lists[0].order).toEqual(['dairy', 'produce']);
    expect(next.lists[1].order).toEqual(['drinks']);   // no order for it in the settings: kept
    expect(next.pantry.map((p) => p.name)).toEqual(['Rice']);
    expect(theirs.cats.some((c) => c.id === 'pets')).toBe(true);   // the data it was given is left alone
  });
});

describe('the backup carries Kitty Gallery', () => {
  const game = { v: 1, state: { cats: [], tasks: [], xp: 0 } };
  it('packs and unpacks gallery.json', () => {
    const gallery = JSON.stringify({ version: 1, icons: [] });
    const bytes = packBackup({ game, diary: {}, photos: {}, gallery });
    expect(isZip(bytes)).toBe(true);
    expect(unpackBackup(bytes).gallery).toBe(gallery);
  });
  it('has none in an older backup', () => {
    expect(unpackBackup(packBackup({ game, diary: {}, photos: {} })).gallery).toBeUndefined();
  });
});
