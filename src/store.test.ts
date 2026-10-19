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
  it('rejects zips that are not backups and non-zips', () => {
    expect(() => unpackBackup(zipSync({ 'x.txt': strToU8('hi') }))).toThrow();
    expect(() => unpackBackup(strToU8('{"v":1}'))).toThrow();
    expect(isZip(strToU8('{"v":1}'))).toBe(false);
  });
});
