import { afterEach, describe, expect, it } from 'vitest';
import { CARD_FRIENDS, PICKER_ICONS, PICKER_ICON_NAMES, PICKER_ICON_GROUPS, UI_ICONS, iconLabel, pickable, stickerSvg } from '../achievement/pixelart.ts';
import { ICONS, OFFICIAL_WEATHER, WEATHER, weatherLabel, weatherSvg } from '../pixelart.ts';
import { applyIcons } from './live.ts';
import { GARDEN_SPOTS, ROOM_SPOTS, SHELF_BOOK, roomSvg } from '../scene.ts';
import { emptyData, officials, type PixelData } from './model.ts';

const blank18 = Array.from({ length: 18 }, () => '..................');
const teapot = blank18.map((r, y) => (y === 8 ? 'ssssssssssssssssss' : r));
const data = (icons: PixelData['icons']): PixelData => ({ version: 1, icons });

describe('applyIcons', () => {
  afterEach(() => applyIcons(emptyData()));

  it('puts your own stickers in every picker, in their group', () => {
    applyIcons(data([{ category: 'sticker', id: 'teapot', name: 'Teapot', group: 'kitchen', art: teapot, updated: 1 }]));
    expect(PICKER_ICONS.teapot).toEqual({ label: 'Teapot', group: 'kitchen', art: teapot });
    expect(PICKER_ICON_NAMES).toContain('teapot');
    expect(PICKER_ICON_GROUPS.find(([g]) => g === 'kitchen')?.[1]).toEqual(['teapot']);
    expect(pickable('teapot')).toBe('teapot');
    expect(stickerSvg('teapot')).not.toBe(stickerSvg('heart'));
  });

  it("adds new weather to the diary's choice after the official ones, and uses changed ones", () => {
    const hail = Array.from({ length: 10 }, (_, y) => (y === 5 ? 'wwwwwwwwwwwww' : '.............'));
    applyIcons(data([
      { category: 'weather', id: 'hail', name: 'Hail', group: 'default', art: hail, updated: 1 },
      { category: 'weather', id: 'sunny', name: 'Bright', group: 'default', art: hail, updated: 1 },
    ]));
    expect(Object.keys(WEATHER)).toEqual([...Object.keys(OFFICIAL_WEATHER), 'hail']);
    expect(WEATHER.sunny).toEqual({ label: 'Bright', art: hail });
    expect(weatherSvg('hail')).toContain('<svg');
    applyIcons(emptyData());
    expect(WEATHER.hail).toBeUndefined();
    expect(weatherSvg('hail')).toBe('');
    expect(weatherLabel('hail')).toBe('Hail');   // a page that still has it keeps its name
  });

  it('takes deleted official stickers and weather out of the app, and puts them back', () => {
    const weather = Object.keys(OFFICIAL_WEATHER)[0];
    applyIcons(data([
      { category: 'sticker', id: 'star', name: 'Star', group: 'default', art: PICKER_ICONS.star.art, deleted: true, updated: 1 },
      { category: 'weather', id: weather, name: 'Gone', group: 'default', art: OFFICIAL_WEATHER[weather].art, deleted: true, updated: 1 },
    ]));
    expect(PICKER_ICONS.star).toBeUndefined();
    expect(PICKER_ICON_NAMES).not.toContain('star');
    expect(pickable('star')).toBe('heart');
    expect(Object.keys(WEATHER)).not.toContain(weather);
    applyIcons(emptyData());
    expect(PICKER_ICON_NAMES).toContain('star');
    expect(Object.keys(WEATHER)).toContain(weather);
  });

  it('uses your changes to official icons, and puts them back when they are dropped', () => {
    const star = PICKER_ICONS.star;
    applyIcons(data([{ category: 'sticker', id: 'star', name: 'Twinkle', group: 'default', art: teapot, updated: 1 }]));
    expect(PICKER_ICONS.star).toEqual({ label: 'Twinkle', art: teapot });
    applyIcons(emptyData());
    expect(PICKER_ICONS.star).toEqual(star);
  });

  it('draws a deleted icon as a heart', () => {
    applyIcons(data([{ category: 'sticker', id: 'teapot', name: 'Teapot', group: 'user', art: teapot, updated: 1 }]));
    applyIcons(emptyData());
    expect(PICKER_ICONS.teapot).toBeUndefined();
    expect(PICKER_ICON_NAMES).not.toContain('teapot');
    expect(pickable('teapot')).toBe('heart');
    expect(iconLabel('teapot')).toBe('Heart');
    expect(stickerSvg('teapot', 1)).toBe(stickerSvg('heart', 1));
  });

  it('changes card friends and button icons in every list they are in', () => {
    const heart = ['o........', ...CARD_FRIENDS.heart.art.slice(1)];
    const x = ['ooooo', 'o...o', 'o...o', 'o...o', 'ooooo'];
    applyIcons(data([
      { category: 'friend', id: 'heart', name: 'Heart', group: 'default', art: heart, updated: 1 },
      { category: 'button', id: 'x', name: 'X', group: 'default', art: x, updated: 1 },
      { category: 'button', id: 'wand', name: 'Wand', group: 'user', art: ['ooooooo', ...Array(6).fill('.......')], updated: 1 },
    ]));
    expect(CARD_FRIENDS.heart.art).toEqual(heart);
    expect(ICONS.x).toEqual(x);
    expect(UI_ICONS.x).toEqual(x);
    expect(ICONS.wand).toBeTruthy();
    expect(UI_ICONS.wand).toBeUndefined();   // else Kitty Achievement would draw it for a sticker called "wand"
  });

  it('leaves Kitty Gallery listing only the code as official', () => {
    applyIcons(data([{ category: 'sticker', id: 'teapot', name: 'Teapot', group: 'user', art: teapot, updated: 1 }]));
    expect(officials('sticker').some((o) => o.id === 'teapot')).toBe(false);
  });

  it('draws a changed scene from its letters, with its spots, and puts the official one back', () => {
    const room = officials('scene').find((o) => o.id === 'room')!;
    const before = roomSvg('day'), spots = ROOM_SPOTS.map((p) => [...p]), garden = GARDEN_SPOTS.map((p) => [...p]);
    const art = room.art.map((r, y) => (y < 10 ? 'R'.repeat(240) : r));
    applyIcons(data([{ category: 'scene', id: 'room', name: 'Cosy room', group: 'default', art, spots: [[40, 200]], props: { book: [100, 100], trophy: [120, 100] }, updated: 1 }]));
    expect(ROOM_SPOTS).toEqual([[40, 200]]);
    expect(SHELF_BOOK.slice(0, 2)).toEqual([100, 100]);
    expect(roomSvg('day')).not.toBe(before);
    expect(GARDEN_SPOTS).toEqual(garden);
    applyIcons(emptyData());
    expect(ROOM_SPOTS).toEqual(spots);
    expect(SHELF_BOOK.slice(0, 2)).toEqual([9, 49]);
    expect(roomSvg('day')).toBe(before);
  });
});
