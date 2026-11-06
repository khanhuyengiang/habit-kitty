import { describe, expect, it } from 'vitest';
import { diaryDaysToLeave, hpLine, litSegments, lvLine, mpLine, mpProgress, shortId } from './player.ts';

describe('MP level', () => {
  it('needs 10 days for level 1, 20 for level 2, and so on', () => {
    expect([1, 2, 3].map(diaryDaysToLeave)).toEqual([10, 20, 30]);
    expect(mpProgress(0)).toEqual({ level: 1, into: 0, per: 10 });
    expect(mpProgress(9)).toEqual({ level: 1, into: 9, per: 10 });
    expect(mpProgress(10)).toEqual({ level: 2, into: 0, per: 20 });
    expect(mpProgress(29)).toEqual({ level: 2, into: 19, per: 20 });
    expect(mpProgress(30)).toEqual({ level: 3, into: 0, per: 30 });
    expect(mpProgress(60)).toEqual({ level: 4, into: 0, per: 40 });
  });
  it('treats missing or odd counts as none', () => {
    expect(mpProgress(-5).level).toBe(1);
    expect(mpProgress(3.9).into).toBe(3);
  });
});

describe('bar segments', () => {
  it('lights none at the start and never all before the level is reached', () => {
    expect(litSegments(0, 10)).toBe(0);
    expect(litSegments(5, 10)).toBe(5);
    expect(litSegments(19, 20)).toBe(9);
    expect(litSegments(5, 0)).toBe(0);
  });
});

describe('shortId', () => {
  it('is the first 8 characters of the id, upper case', () => {
    expect(shortId('3f2a9c1e-7b44-4c8d-9a01-5e6f7a8b9c0d')).toBe('3F2A9C1E');
    expect(shortId('ab')).toBe('AB');
  });
});

describe('stat lines', () => {
  it('HP reports the running total and the way to the next level', () => {
    const l = hpLine(397);
    expect([l.tag, l.total, l.progress]).toEqual(['HP', '397', '97/300 to lvl 3']);
    expect(hpLine(0).progress).toBe('0/100 to lvl 1');
  });
  it('HP never lights the bar below zero', () => {
    expect(hpLine(-20).lit).toBe(0);
    expect(hpLine(-20).total).toBe('-20');
  });
  it('MP reports the days written', () => {
    const l = mpLine(34);
    expect([l.tag, l.total, l.progress]).toEqual(['MP', '34', '4/30 to lvl 4']);
    expect(mpLine(0).progress).toBe('0/10 to lvl 2');
  });
  it('Lv reports the level and the achievements unlocked', () => {
    const l = lvLine({ level: 4, completed: 11, into: 3, per: 5 });
    expect([l.tag, l.total, l.extra, l.progress]).toEqual(['Lv', '4', '11 unlocked', '3/5 to lvl 5']);
  });
});
