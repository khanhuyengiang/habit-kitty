import { describe, expect, it } from 'vitest';
import { PICKER_ICONS, PICKER_ICON_NAMES } from '../achievement/icons.ts';
import {
  BASE_ROWS, INK_ROWS, MORE_INKS, byHue, categoryOf, paletteLabel,
  CATEGORIES, DEFAULT_GROUP, EXPORT_FORMAT, LETTERS, USER_GROUP, blankGrid, cleanArt, dropIcon, emptyData, exportText, floodFill,
  borderAll, oldStickers, byName, canDeleteOfficial, deleteOfficial, liveIcons, restoreIcon, countMine, dropCount, dropFloat, dropIcons, groupsOf, setFood, resetIcons, iconsOf, importClashes, importIcons, nameTaken, uniqueNames, inRect, liftArea, linePoints, moveIcons, rectOf, newId, officials, putIcon, readExport, renameGroup, sanitize, shiftGrid, sizeOf, toArt, toGrid,
} from './model.ts';
import { PALETTE, type PaletteName } from '../shared/palette.ts';
import { FINE } from '../achievement/pixelart.ts';

const blank18 = () => Array.from({ length: 18 }, () => '.'.repeat(18));
const teapot = () => { const a = blank18(); a[8] = '.....ssssssss.....'; return a; };

describe('officials', () => {
  it('lists every picker icon as a sticker, in its group (default without one)', () => {
    const s = officials('sticker');
    expect(s.map((o) => o.id)).toEqual(Object.keys(PICKER_ICONS));
    expect(s.map((o) => o.group)).toEqual(Object.values(PICKER_ICONS).map((p) => p.group ?? DEFAULT_GROUP));
  });
  it('has the card friends and the button icons too', () => {
    expect(officials('friend').map((o) => o.id)).toEqual(['heart', 'flower']);
    expect(officials('button').map((o) => o.id)).toEqual(expect.arrayContaining(['x', 'gear', 'lock', 'trash']));
    expect(officials('sticker').filter((o) => o.food).map((o) => o.id)).toEqual(expect.arrayContaining(['fish', 'food', 'cake', 'apple']));
  });
  it('draws every official icon with its category letters only', () => {
    for (const c of CATEGORIES) for (const o of officials(c.id)) {
      expect(cleanArt(o.art, c.id, sizeOf(c.id, o.id)), `${c.id}/${o.id}`).toEqual(o.art);
    }
  });
  it('lists every sticker colour once in the drawing rows or under Choose a colour, and can draw every palette colour', () => {
    const shown = [...BASE_ROWS, ...INK_ROWS].join('') + MORE_INKS;
    expect(new Set(shown).size).toBe(shown.length);
    expect([...shown].sort()).toEqual([...categoryOf('sticker').letters].sort());
    for (const r of [...BASE_ROWS, ...INK_ROWS]) expect(r.length).toBeLessThanOrEqual(3);
    for (const ch of shown) expect(FINE[ch], ch).toBeTruthy();
    const drawn = new Set(Object.values(LETTERS).map((v) => v.palette));
    expect(Object.keys(PALETTE).filter((k) => !drawn.has(k as PaletteName))).toEqual([]);
    expect(paletteLabel('slateBlue')).toBe('Slate blue');
    expect(paletteLabel('lavender100')).toBe('Lavender 100');
  });
  it('orders colours by hue, the greys last', () => {
    const at = (k: string) => Object.keys(LETTERS).find((ch) => LETTERS[ch].palette === k)!;
    const order = byHue([at('charcoal'), at('pink700'), at('teal'), at('gold500'), at('blue50')]).map((ch) => LETTERS[ch].palette);
    expect(order).toEqual(['gold500', 'teal', 'blue50', 'pink700', 'charcoal']);
  });
  it('names letters with palette colours', () => {
    for (const v of Object.values(LETTERS)) if (v.palette) expect(PALETTE[v.palette]).toBeTruthy();
  });
});

describe('your icons', () => {
  it('adds a new icon after the official ones, in the user group', () => {
    const d = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: teapot() }, 5);
    const list = iconsOf(d, 'sticker');
    expect(list.at(-1)).toMatchObject({ id: 'teapot', status: 'new', group: USER_GROUP });
    expect(groupsOf(list).slice(0, 2)).toEqual([DEFAULT_GROUP, USER_GROUP]);
    expect(groupsOf(list).filter((g) => g === USER_GROUP)).toHaveLength(1);
  });
  it('changes an official icon in place, and puts it back', () => {
    const d = putIcon(emptyData(), { category: 'sticker', id: 'star', name: 'Star', group: DEFAULT_GROUP, art: teapot() });
    const star = iconsOf(d, 'sticker').find((i) => i.id === 'star')!;
    expect(star.status).toBe('changed');
    expect(star.art).toEqual(teapot());
    expect(iconsOf(dropIcon(d, 'sticker', 'star'), 'sticker').find((i) => i.id === 'star')!.status).toBe('official');
  });
  it('drops a change that leaves the official icon as it was', () => {
    const o = PICKER_ICONS.heart;
    expect(putIcon(emptyData(), { category: 'sticker', id: 'heart', name: o.label, group: DEFAULT_GROUP, art: o.art }).icons).toEqual([]);
  });
  it('makes ids from names that are not taken', () => {
    expect(newId('Ice cream!', 'sticker', emptyData())).toBe('icecream2');   // "icecream" is an official icon
    expect(newId('Teapot', 'sticker', emptyData())).toBe('teapot');
    expect(newId('', 'sticker', emptyData())).toBe('icon');
    expect(newId('Star', 'friend', emptyData())).toBe('star');                 // each category has its own names
  });
  it('renames a group, moving official icons too', () => {
    let d = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: 'kitchen', art: teapot() });
    d = renameGroup(d, 'sticker', 'kitchen', 'Food');
    expect(iconsOf(d, 'sticker').find((i) => i.id === 'teapot')!.group).toBe('food');
    d = renameGroup(d, 'sticker', DEFAULT_GROUP, 'classic');
    const groups = groupsOf(iconsOf(d, 'sticker'));
    expect(groups).toEqual(expect.arrayContaining(['classic', 'food']));
    expect(groups).not.toContain(DEFAULT_GROUP);
  });
  it('leaves broken icons out when read back', () => {
    const d = sanitize({ icons: [
      { category: 'sticker', id: 'ok', name: 'Ok', group: 'user', art: teapot(), updated: 1 },
      { category: 'sticker', id: 'small', name: 'Small', group: 'user', art: ['...'] },
      { category: 'nope', id: 'x', art: teapot() },
      { category: 'sticker', id: 'ok', name: 'Twice', group: 'user', art: teapot() },
    ] });
    expect(d.icons.map((i) => i.id)).toEqual(['ok']);
  });
  it('turns letters a category has not got into empty pixels', () => {
    expect(cleanArt(['oz.', 'sso', '...'], 'button', [3, 3])).toEqual(['o..', '..o', '...']);
  });
});

describe('the export file', () => {
  it('goes there and back', () => {
    let d = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: 'user', art: teapot() });
    d = putIcon(d, { category: 'sticker', id: 'star', name: 'Star', group: 'space', art: teapot() });
    const text = exportText(d, '2026-11-11');
    const raw = JSON.parse(text);
    expect(raw).toMatchObject({ format: EXPORT_FORMAT, version: 1, exported: '2026-11-11' });
    expect(raw.icons.map((i: { id: string; status: string }) => [i.id, i.status])).toEqual([['star', 'changed'], ['teapot', 'new']]);
    const back = importIcons(emptyData(), readExport(text), 'replace', 9);
    expect(iconsOf(back, 'sticker').filter((i) => i.status !== 'official').map((i) => i.id).sort()).toEqual(['star', 'teapot']);
  });
  it('keeps group changes made by hand in the file', () => {
    const d = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: 'user', art: teapot() });
    const text = exportText(d, '2026-11-11').replace('"group": "user"', '"group": "Kitchen"');
    expect(readExport(text)[0].group).toBe('kitchen');
  });
  it('says when a file is not an export', () => {
    expect(() => readExport('nope')).toThrow(/isn't an icon export/);
    expect(() => readExport('{"format":"other","icons":[]}')).toThrow(/isn't an icon export/);
    expect(() => readExport(`{"format":"${EXPORT_FORMAT}","icons":[]}`)).toThrow(/no icons/);
  });
});

describe('importing over your icons', () => {
  const mine = () => putIcon(emptyData(), { category: 'sticker', id: 'star', name: 'Star', group: DEFAULT_GROUP, art: teapot() });
  const theirs = () => { const a = teapot(); a[2] = '.....ssssssss.....'; return [{ category: 'sticker' as const, id: 'star', name: 'Star', group: DEFAULT_GROUP, art: a }]; };
  it('finds only the icons that differ from your own version', () => {
    expect(importClashes(mine(), theirs()).map((i) => i.id)).toEqual(['star']);
    expect(importClashes(emptyData(), theirs())).toEqual([]);                       // the official one: nothing of yours lost
    expect(importClashes(mine(), [{ ...theirs()[0], art: teapot() }])).toEqual([]);  // the same as yours
  });
  it('replaces yours, or keeps both as Star 1 and Star 2', () => {
    expect(importIcons(mine(), theirs(), 'replace').icons.map((i) => [i.id, i.name, i.art[2]])).toEqual([['star', 'Star', '.....ssssssss.....']]);
    const both = iconsOf(importIcons(mine(), theirs(), 'keep'), 'sticker').filter((i) => i.status !== 'official');
    expect(both.map((i) => [i.id, i.name, i.status, i.group])).toEqual([['star', 'Star 1', 'changed', DEFAULT_GROUP], ['star2', 'Star 2', 'new', USER_GROUP]]);
  });
  it('tells apart a new icon that takes a name already used', () => {
    const d = importIcons(emptyData(), [{ category: 'sticker', id: 'twinkle', name: 'star', group: USER_GROUP, art: teapot() }]);
    expect(iconsOf(d, 'sticker').filter((i) => /^star/i.test(i.name)).map((i) => [i.id, i.name])).toEqual([['star', 'Star 1'], ['twinkle', 'Star 2']]);
  });
});

describe('names', () => {
  it('finds a taken name in any case, but not the icon itself', () => {
    expect(nameTaken(emptyData(), 'sticker', ' STAR ', null)?.id).toBe('star');
    expect(nameTaken(emptyData(), 'sticker', 'Star', 'star')).toBeUndefined();
    expect(nameTaken(emptyData(), 'sticker', 'Teapot', null)).toBeUndefined();
  });
  it('numbers past names already taken, and leaves unique ones alone', () => {
    let d = putIcon(emptyData(), { category: 'sticker', id: 'a', name: 'Pot', group: USER_GROUP, art: teapot() });
    d = putIcon(d, { category: 'sticker', id: 'b', name: 'Pot', group: USER_GROUP, art: teapot() });
    d = putIcon(d, { category: 'sticker', id: 'c', name: 'Pot 1', group: USER_GROUP, art: teapot() });
    expect(uniqueNames(d).icons.map((i) => i.name)).toEqual(['Pot 1', 'Pot 2', 'Pot 3']);
    expect(uniqueNames(emptyData())).toEqual(emptyData());
  });
});

describe('the board', () => {
  it('fills only the touching pixels of one letter', () => {
    const g = floodFill([[...'..o'], [...'.o.'], [...'o..']], 0, 0, 's');
    expect(toArt(g)).toEqual(['sso', 'so.', 'o..']);
  });
  it('draws lines and moves the drawing', () => {
    expect(linePoints([0, 0], [3, 1])).toEqual([[0, 0], [1, 0], [2, 1], [3, 1]]);
    const g = blankGrid(3, 2); g[0][0] = 'o';
    expect(toArt(shiftGrid(g, 1, 1))).toEqual(['...', '.o.']);
    expect(toArt(shiftGrid(g, -1, 0))).toEqual(['...', '...']);
  });
});

describe('moveIcons', () => {
  it('moves picked icons, official or not, and leaves the rest', () => {
    const [a, b] = officials('sticker');
    let d = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: teapot() });
    d = moveIcons(d, 'sticker', [a.id, 'teapot'], ' Kitchen ', 5);
    const shown = iconsOf(d, 'sticker');
    expect(shown.find((i) => i.id === a.id)).toMatchObject({ group: 'kitchen', status: 'changed', art: a.art });
    expect(shown.find((i) => i.id === 'teapot')).toMatchObject({ group: 'kitchen', status: 'new' });
    expect(shown.find((i) => i.id === b.id)?.group).toBe(DEFAULT_GROUP);
  });
  it('putting an official icon back in its group drops the change', () => {
    const [a] = officials('sticker');
    const d = moveIcons(moveIcons(emptyData(), 'sticker', [a.id], 'kitchen'), 'sticker', [a.id], a.group);
    expect(d.icons).toEqual([]);
  });
});

describe('stickers at 18 × 18 (TEMPORARY: Add border to all)', () => {
  it('has every official sticker at 18 × 18', () => {
    for (const o of officials('sticker')) expect([o.art.length, ...new Set(o.art.map((r) => r.length))], o.id).toEqual([18, 18]);
  });
  it('keeps a 16 × 16 sticker of yours until it gets its border, which looks just as it used to', () => {
    const old = Array.from({ length: 16 }, (_, y) => (y === 8 ? '....ssssssss....' : '.'.repeat(16)));
    let d = sanitize({ version: 1, icons: [{ category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: old, updated: 1 }] });
    expect(oldStickers(d)).toBe(1);
    d = borderAll(d, 7);
    expect(oldStickers(d)).toBe(0);
    const empty = '.'.repeat(18);   // one row of base colour: lit along its top, with the dark line around it
    expect(d.icons[0].art).toEqual([...Array(8).fill(empty), '.....oooooooo.....', '....ollllllllo....', '.....oooooooo.....', ...Array(7).fill(empty)]);
    expect(sanitize(d).icons[0].art).toEqual(d.icons[0].art);
  });
});

describe('dropIcons', () => {
  it('deletes your own and official stickers (keeping their changes), but never the heart', () => {
    const [a, b, c] = officials('sticker').filter((o) => o.id !== 'heart');
    let d = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: teapot() });
    d = moveIcons(d, 'sticker', [a.id, b.id], 'kitchen');
    expect(dropCount(d, 'sticker', ['teapot', a.id, c.id, 'heart'])).toEqual({ deleted: 1, official: 2, reverted: 0 });
    d = dropIcons(d, 'sticker', ['teapot', a.id, c.id, 'heart'], 5);
    const shown = iconsOf(d, 'sticker');
    expect(shown.find((i) => i.id === 'teapot')).toBeUndefined();
    expect(shown.find((i) => i.id === a.id)).toMatchObject({ status: 'deleted', group: 'kitchen' });
    expect(shown.find((i) => i.id === b.id)).toMatchObject({ status: 'changed', group: 'kitchen' });
    expect(shown.find((i) => i.id === c.id)!.status).toBe('deleted');
    expect(shown.find((i) => i.id === 'heart')!.status).toBe('official');
    expect(liveIcons(d, 'sticker').map((i) => i.id)).not.toContain(a.id);
  });
  it("puts changed official icons back where they can't be deleted (buttons), and leaves the rest", () => {
    const [a, b, c] = officials('button');
    let d = moveIcons(emptyData(), 'button', [a.id, b.id], 'kitchen');
    expect(dropCount(d, 'button', [a.id, c.id])).toEqual({ deleted: 0, official: 0, reverted: 1 });
    d = dropIcons(d, 'button', [a.id, c.id]);
    expect(d.icons.map((i) => i.id)).toEqual([b.id]);
  });
});

describe('deleting an official icon', () => {
  const star = () => officials('sticker').find((o) => o.id === 'star')!;
  it('marks it deleted, keeps your change, and brings it back with it', () => {
    let d = putIcon(emptyData(), { ...star(), category: 'sticker', name: 'Twinkle' });
    d = deleteOfficial(d, 'sticker', 'star', 2);
    expect(d.icons).toEqual([expect.objectContaining({ id: 'star', name: 'Twinkle', deleted: true })]);
    expect(iconsOf(d, 'sticker').find((i) => i.id === 'star')!.status).toBe('deleted');
    d = restoreIcon(d, 'sticker', 'star', 3);
    expect(iconsOf(d, 'sticker').find((i) => i.id === 'star')).toMatchObject({ status: 'changed', name: 'Twinkle' });
    expect(d.icons[0].deleted).toBeUndefined();
  });
  it('brings an unchanged one back as official, with nothing kept', () => {
    const d = restoreIcon(deleteOfficial(emptyData(), 'weather', officials('weather')[0].id), 'weather', officials('weather')[0].id);
    expect(d.icons).toEqual([]);
  });
  it("can't delete the heart, a button, a card friend or your own icon", () => {
    expect(canDeleteOfficial('sticker', 'heart')).toBe(false);
    expect(deleteOfficial(emptyData(), 'sticker', 'heart').icons).toEqual([]);
    expect(deleteOfficial(emptyData(), 'button', officials('button')[0].id).icons).toEqual([]);
    expect(deleteOfficial(emptyData(), 'friend', 'flower').icons).toEqual([]);
    const mine = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: teapot() });
    expect(deleteOfficial(mine, 'sticker', 'teapot')).toEqual(mine);
    expect(putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: teapot(), deleted: true }).icons).toEqual([]);
  });
  it('stays deleted when its group is renamed or it is moved, and frees its name', () => {
    let d = deleteOfficial(emptyData(), 'sticker', 'star');
    d = renameGroup(d, 'sticker', star().group, 'sky');
    d = moveIcons(d, 'sticker', ['star'], 'night');
    expect(iconsOf(d, 'sticker').find((i) => i.id === 'star')!.status).toBe('deleted');
    expect(nameTaken(d, 'sticker', 'Star', null)).toBeUndefined();
    // a new "Star" while it is gone: bringing it back tells the two apart
    d = putIcon(d, { category: 'sticker', id: 'mystar', name: 'Star', group: USER_GROUP, art: teapot() });
    d = restoreIcon(d, 'sticker', 'star');
    expect(liveIcons(d, 'sticker').filter((i) => /^star/i.test(i.name)).map((i) => i.name).sort()).toEqual(['Star 1', 'Star 2']);
  });
  it('goes through the save file and the export', () => {
    const d = deleteOfficial(emptyData(), 'sticker', 'star', 7);
    expect(sanitize(JSON.parse(JSON.stringify(d)))).toEqual(d);
    const text = exportText(d, '2026-11-16');
    expect(JSON.parse(text).icons[0]).toMatchObject({ id: 'star', status: 'deleted', deleted: true });
    expect(iconsOf(importIcons(emptyData(), readExport(text)), 'sticker').find((i) => i.id === 'star')!.status).toBe('deleted');
    expect(sanitize({ icons: [{ ...d.icons[0], id: 'heart', art: officials('sticker').find((o) => o.id === 'heart')!.art }] }).icons[0]?.deleted).toBeUndefined();
  });
});

describe('setFood', () => {
  it('makes picked stickers cat food, or not, official or your own', () => {
    const notFood = officials('sticker').find((o) => !o.food)!, food = officials('sticker').find((o) => o.food)!;
    let d = putIcon(emptyData(), { category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: teapot() });
    d = setFood(d, ['teapot', notFood.id, food.id], true, 5);
    const shown = iconsOf(d, 'sticker');
    expect(shown.find((i) => i.id === 'teapot')?.food).toBe(true);
    expect(shown.find((i) => i.id === notFood.id)).toMatchObject({ food: true, status: 'changed' });
    expect(shown.find((i) => i.id === food.id)?.status).toBe('official');
    d = setFood(d, [notFood.id, food.id], false);
    expect(iconsOf(d, 'sticker').find((i) => i.id === food.id)).toMatchObject({ food: false, status: 'changed' });
    expect(d.icons.some((i) => i.id === notFood.id)).toBe(false);   // back as it was: the change is dropped
  });
});

describe('order', () => {
  it('sorts icons by name, ignoring case, with numbers in order', () => {
    const names = ['drink 2', 'Bee', 'Drink 10', 'apple', 'Drink 1'].map((name) => ({ name }));
    expect(names.sort(byName).map((n) => n.name)).toEqual(['apple', 'Bee', 'Drink 1', 'drink 2', 'Drink 10']);
  });
  it('lists the pickers by group, then by name', () => {
    const key = (n: string) => [PICKER_ICONS[n].group ?? '', PICKER_ICONS[n].label] as const;
    expect(PICKER_ICON_NAMES).toHaveLength(Object.keys(PICKER_ICONS).length);
    expect(key(PICKER_ICON_NAMES[0])[0]).toBe('');
    expect(PICKER_ICON_NAMES.indexOf('chocolate')).toBeLessThan(PICKER_ICON_NAMES.indexOf('strawberrycake'));
  });
});

describe('reset to original', () => {
  it('puts official icons back and keeps yours, or deletes everything', () => {
    let d = putIcon(emptyData(), { category: 'sticker', id: 'star', name: 'Star', group: DEFAULT_GROUP, art: teapot() });
    d = putIcon(d, { category: 'sticker', id: 'teapot', name: 'Teapot', group: USER_GROUP, art: teapot() });
    expect(countMine(d)).toEqual({ changed: 1, mine: 1 });
    expect(resetIcons(d).icons.map((i) => i.id)).toEqual(['teapot']);
    expect(iconsOf(resetIcons(d), 'sticker').find((i) => i.id === 'star')!.status).toBe('official');
    expect(resetIcons(d, true).icons).toEqual([]);
  });
});

describe('selection', () => {
  const g = () => [[...'ab.'], [...'cd.'], [...'...']];
  it('makes a box from any two corners, kept on the board', () => {
    expect(rectOf([2, 2], [0, 1], 3, 3)).toEqual({ x: 0, y: 1, w: 3, h: 2 });
    expect(rectOf([-4, 1], [9, 1], 3, 3)).toEqual({ x: 0, y: 1, w: 3, h: 1 });
    expect(inRect({ x: 1, y: 1, w: 2, h: 1 }, 2, 1)).toBe(true);
    expect(inRect({ x: 1, y: 1, w: 2, h: 1 }, 3, 1)).toBe(false);
  });
  it('lifts the box and puts it down somewhere else', () => {
    const { grid, float } = liftArea(g(), { x: 0, y: 0, w: 2, h: 2 });
    expect(toArt(grid)).toEqual(['...', '...', '...']);
    expect(toArt(float)).toEqual(['ab', 'cd']);
    expect(toArt(dropFloat(grid, float, 1, 1))).toEqual(['...', '.ab', '.cd']);
  });
  it('keeps what is under an empty lifted pixel, and loses what is off the board', () => {
    const base = toGrid(['xxx', 'xxx', 'xxx']);
    expect(toArt(dropFloat(base, toGrid(['a.', '.b']), 1, -1))).toEqual(['xxb', 'xxx', 'xxx']);
  });
});

describe('cat food', () => {
  it('keeps "Can kitty eat this?" with a sticker, and an official one ticked or unticked as it was is no change', () => {
    const fish = officials('sticker').find((o) => o.id === 'fish')!, star = officials('sticker').find((o) => o.id === 'star')!;
    const base = { category: 'sticker' as const, group: fish.group, name: fish.name, art: fish.art };
    expect(putIcon(emptyData(), { ...base, id: 'fish', food: true }).icons).toEqual([]);
    const off = putIcon(emptyData(), { ...base, id: 'fish', food: false });
    expect(iconsOf(off, 'sticker').find((i) => i.id === 'fish')!.food).toBe(false);
    const on = putIcon(emptyData(), { category: 'sticker', id: 'star', name: star.name, group: star.group, art: star.art, food: true });
    expect(iconsOf(on, 'sticker').find((i) => i.id === 'star')).toMatchObject({ food: true, status: 'changed' });
    const back = sanitize(JSON.parse(JSON.stringify(on)));
    expect(back.icons[0].food).toBe(true);
    const mine = putIcon(emptyData(), { category: 'sticker', id: 'treat', name: 'Treat', group: 'user', art: star.art, food: true });
    expect(iconsOf(mine, 'sticker').find((i) => i.id === 'treat')).toMatchObject({ food: true, status: 'new' });
  });
});

describe('decorations', () => {
  it('has the home screen wing, in the decoration colours, and takes no new ones', () => {
    const wing = officials('deco').find((o) => o.id === 'wing')!;
    expect(sizeOf('deco', 'wing')).toEqual([12, 12]);
    expect(wing.art.join('').replace(/\./g, '')).toMatch(/^[H[{]+$/);
    const ok = sanitize({ version: 1, icons: [{ category: 'deco', id: 'wing', name: 'Wing', group: 'default', art: wing.art.map((r) => r.replace(/\[/g, 'w')), updated: 1 },
      { category: 'deco', id: 'feather', name: 'Feather', group: 'default', art: wing.art, updated: 1 }] });
    expect(ok.icons.map((i) => i.id)).toEqual(['wing']);
  });
});

describe('scenes', () => {
  const room = () => officials('scene').find((o) => o.id === 'room')!;
  it('turns the official cosy room and garden into palette letters, every pixel of them', () => {
    for (const o of officials('scene')) {
      expect(o.art).toHaveLength(320);
      expect(o.art.every((r) => r.length === 240 && !r.includes('.')), o.id).toBe(true);
      expect(new Set(o.art.join('')).size).toBeGreaterThan(20);
      expect(o.spots?.length).toBeGreaterThan(0);
    }
    expect(room().props).toEqual({ book: [9, 49], trophy: [21, 48] });
    expect(officials('scene').find((o) => o.id === 'garden')!.props).toBeUndefined();
  });

  it('keeps your spots with a changed scene, and drops a change that is just the official one', () => {
    const o = room(), spots: [number, number][] = [[10, 100], [50, 200]];
    const d = putIcon(emptyData(), { category: 'scene', id: 'room', name: o.name, group: o.group, art: o.art, spots, props: o.props }, 1);
    expect(iconsOf(d, 'scene').find((i) => i.id === 'room')).toMatchObject({ status: 'changed', spots });
    expect(putIcon(d, { category: 'scene', id: 'room', name: o.name, group: o.group, art: o.art, spots: o.spots, props: o.props }, 2).icons).toEqual([]);
    // renaming keeps them
    expect(iconsOf(uniqueNames(d, 3), 'scene').find((i) => i.id === 'room')?.spots).toEqual(spots);
  });

  it('reads back only the two scenes, with spots kept inside the scene', () => {
    const o = room();
    const raw = { icons: [
      { category: 'scene', id: 'room', name: 'Mine', group: 'default', art: o.art, spots: [[-20, 5], [300, 400], 'x'], props: { book: [500, 0], trophy: [1, 1] } },
      { category: 'scene', id: 'attic', name: 'Attic', group: 'default', art: o.art },
    ] };
    const d = sanitize(raw);
    expect(d.icons).toHaveLength(1);
    expect(d.icons[0].spots).toEqual([[0, 30], [210, 320]]);
    expect(d.icons[0].props).toEqual({ book: [231, 0], trophy: [1, 1] });
    expect(readExport(exportText(d, '2026-11-15'))[0].spots).toEqual([[0, 30], [210, 320]]);
  });
});
