import { describe, expect, it } from 'vitest';
import { PICKER_ICONS, PICKER_ICON_NAMES } from '../achievement/icons.ts';
import {
  BASE_ROWS, INK_ROWS, MORE_INKS, byHue, categoryOf, paletteLabel,
  CATEGORIES, DEFAULT_GROUP, EXPORT_FORMAT, LETTERS, USER_GROUP, blankGrid, cleanArt, dropIcon, emptyData, exportText, floodFill,
  byName, countMine, dropFloat, groupsOf, resetIcons, iconsOf, importClashes, importIcons, nameTaken, uniqueNames, inRect, liftArea, linePoints, moveIcons, rectOf, newId, officials, putIcon, readExport, renameGroup, sanitize, shiftGrid, sizeOf, toArt, toGrid,
} from './model.ts';
import { PALETTE, type PaletteName } from '../shared/palette.ts';
import { FINE } from '../achievement/pixelart.ts';

const blank16 = () => Array.from({ length: 16 }, () => '.'.repeat(16));
const teapot = () => { const a = blank16(); a[8] = '....ssssssss....'; return a; };

describe('officials', () => {
  it('lists every picker icon as a sticker, in its group (default without one)', () => {
    const s = officials('sticker');
    expect(s.map((o) => o.id)).toEqual(Object.keys(PICKER_ICONS));
    expect(s.map((o) => o.group)).toEqual(Object.values(PICKER_ICONS).map((p) => p.group ?? DEFAULT_GROUP));
  });
  it('has the card friends and the button icons too', () => {
    expect(officials('friend').map((o) => o.id)).toEqual(['heart', 'flower']);
    expect(officials('button').map((o) => o.id)).toEqual(expect.arrayContaining(['x', 'gear', 'lock', 'trash']));
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
  const theirs = () => { const a = teapot(); a[2] = '....ssssssss....'; return [{ category: 'sticker' as const, id: 'star', name: 'Star', group: DEFAULT_GROUP, art: a }]; };
  it('finds only the icons that differ from your own version', () => {
    expect(importClashes(mine(), theirs()).map((i) => i.id)).toEqual(['star']);
    expect(importClashes(emptyData(), theirs())).toEqual([]);                       // the official one: nothing of yours lost
    expect(importClashes(mine(), [{ ...theirs()[0], art: teapot() }])).toEqual([]);  // the same as yours
  });
  it('replaces yours, or keeps both as Star 1 and Star 2', () => {
    expect(importIcons(mine(), theirs(), 'replace').icons.map((i) => [i.id, i.name, i.art[2]])).toEqual([['star', 'Star', '....ssssssss....']]);
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
