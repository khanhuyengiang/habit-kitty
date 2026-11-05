import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { dayFromName, dayName, entryFromMarkdown, entryToMarkdown, isZip, packBackup, unpackBackup, type DiaryEntry } from './store.ts';

const day = Math.round(Date.UTC(2026, 9, 12) / 86_400_000);

describe('diary markdown', () => {
  it('round-trips text with newlines, quotes and dashes', () => {
    const e: DiaryEntry = { text: 'Dear diary,\n\n"Quoted" --- not a fence\n---\nlast line', mood: 'calm', photo: true, updated: 1760000000000 };
    expect(entryFromMarkdown(entryToMarkdown(e))).toEqual(e);
  });
  it('round-trips an empty page with only a mood', () => {
    const e: DiaryEntry = { text: '', mood: 'sad', photo: false, updated: 5 };
    expect(entryFromMarkdown(entryToMarkdown(e))).toEqual(e);
  });
  it('is readable by a human', () => {
    expect(entryToMarkdown({ text: 'Hi', mood: 'joyful', updated: 1 })).toBe('---\nmood: joyful\nupdated: 1\n---\nHi\n');
  });
  it('round-trips a second emotion, your own word and the weather', () => {
    const e: DiaryEntry = { text: 'x', mood: 'joyful', mood2: 'tired', feeling: 'cosy: but sleepy', weather: 'snow', updated: 3 };
    expect(entryFromMarkdown(entryToMarkdown(e))).toEqual({ ...e, photo: false });
  });
  it('drops a second emotion that has no first or repeats it, and an unknown weather', () => {
    const e = entryFromMarkdown('---\nmood2: sad\nweather: hail\nupdated: 1\n---\nx');
    expect(e?.mood).toBeUndefined(); expect(e?.mood2).toBeUndefined(); expect(e?.weather).toBeUndefined();
    expect(entryFromMarkdown('---\nmood: sad\nmood2: sad\nupdated: 1\n---\nx')?.mood2).toBeUndefined();
  });
  it('ignores an unknown mood and rejects files without frontmatter', () => {
    expect(entryFromMarkdown('---\nmood: furious\nupdated: 1\n---\nx')?.mood).toBeUndefined();
    expect(entryFromMarkdown('just text')).toBeNull();
  });
});

describe('day names', () => {
  it('maps days to ISO dates and back', () => {
    expect(dayName(day)).toBe('2026-10-12');
    expect(dayFromName('2026-10-12')).toBe(day);
    expect(dayFromName('2026-02-30')).toBeNull();
    expect(dayFromName('nope')).toBeNull();
  });
});

describe('.kitty backup', () => {
  const photo = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const entries = { [day]: { text: 'a', mood: 'calm' as const, photo: true, updated: 1 }, [day + 1]: { text: 'b', updated: 2 } };

  it('round-trips game, diary and photos', () => {
    const zip = packBackup({ game: { v: 1, state: { cats: [] } }, diary: entries, photos: { [day]: photo } });
    expect(isZip(zip)).toBe(true);
    const back = unpackBackup(zip);
    expect(back.game).toEqual({ v: 1, state: { cats: [] } });
    expect(back.diary[day]).toEqual({ text: 'a', mood: 'calm', photo: true, updated: 1 });
    expect(back.diary[day + 1].photo).toBe(false);
    expect([...back.photos[day]]).toEqual([...photo]);
  });
  it('drops photos that have no diary page', () => {
    const back = unpackBackup(packBackup({ game: {}, diary: {}, photos: { [day]: photo } }));
    expect(back.photos).toEqual({});
  });
  it('carries Achievement Kitty\'s save inside, untouched', () => {
    const ach = new Uint8Array([0x50, 0x4b, 3, 4, 9, 9, 9]);   // stands for the nested save file
    const back = unpackBackup(packBackup({ game: { v: 1 }, diary: {}, photos: {}, achievement: ach }));
    expect(back.game).toEqual({ v: 1 });
    expect([...back.achievement!]).toEqual([...ach]);
    expect(unpackBackup(packBackup({ game: {}, diary: {}, photos: {} })).achievement).toBeUndefined();
  });
  it('still loads a format 1 file from before', () => {
    const old = zipSync({ 'manifest.json': strToU8('{"app":"habit-kitty","format":1}'), 'game.json': strToU8('{"v":1}') });
    expect(unpackBackup(old).game).toEqual({ v: 1 });
  });
  it('reads an older Achievement Kitty save file as achievements only', () => {
    const achOnly = zipSync({ 'manifest.json': strToU8('{"app":"achievement-kitty","format":1}'), 'data.json': strToU8('{}') });
    const back = unpackBackup(achOnly);
    expect(back.game).toBeNull();
    expect([...back.achievement!]).toEqual([...achOnly]);
  });
  it('rejects zips that are not backups and non-zips', () => {
    expect(() => unpackBackup(zipSync({ 'x.txt': strToU8('hi') }))).toThrow();
    expect(() => unpackBackup(strToU8('{"v":1}'))).toThrow();
    expect(isZip(strToU8('{"v":1}'))).toBe(false);
  });
});
