import { describe, expect, it } from 'vitest';
import { dayOf } from '../calendar.ts';
import type { Person } from '../store.ts';
import { birthdaysOn, daysUntil, personErrors, personFrom, turning, upcoming, whenText } from './people.ts';

const P = (name: string, month: number, day: number, year?: number): Person => ({ id: name, name, month, day, ...(year !== undefined && { year }) });
const d = (y: number, m: number, day: number) => dayOf(y, m - 1, day);   // m is 1-based here

describe('personErrors', () => {
  const ok = { name: 'Mochi', month: 3, day: 14, year: null, note: '' };
  it('accepts a normal person and a 29 February birthday', () => {
    expect(personErrors(ok, 2026)).toEqual({});
    expect(personErrors({ ...ok, month: 2, day: 29 }, 2026)).toEqual({});
  });
  it('checks the name, the day of the month and the year', () => {
    expect(personErrors({ ...ok, name: '  ' }, 2026).name).toBeTruthy();
    expect(personErrors({ ...ok, month: 2, day: 30 }, 2026).day).toBeTruthy();
    expect(personErrors({ ...ok, month: 4, day: 31 }, 2026).day).toBeTruthy();
    expect(personErrors({ ...ok, month: 13 }, 2026).month).toBeTruthy();
    expect(personErrors({ ...ok, year: 2030 }, 2026).year).toBeTruthy();
    expect(personErrors({ ...ok, year: 1850 }, 2026).year).toBeTruthy();
  });
});

describe('personFrom', () => {
  it('tidies the name and leaves out what is empty', () => {
    expect(personFrom({ name: '  Ada   Lovelace ', month: 12, day: 10, year: null, note: ' ' }, 'x')).toEqual({ id: 'x', name: 'Ada Lovelace', month: 12, day: 10 });
  });
});

describe('birthdaysOn', () => {
  const people = [P('Zed', 5, 1), P('Amy', 5, 1), P('Bob', 6, 2)];
  it('lists the people with a birthday that day, by name', () => {
    expect(birthdaysOn(people, d(2026, 5, 1)).map((p) => p.name)).toEqual(['Amy', 'Zed']);
    expect(birthdaysOn(people, d(2026, 5, 2))).toEqual([]);
  });
  it('keeps a 29 February birthday on the 28th in a year without one', () => {
    const leapling = [P('Leo', 2, 29)];
    expect(birthdaysOn(leapling, d(2027, 2, 28)).length).toBe(1);
    expect(birthdaysOn(leapling, d(2028, 2, 28)).length).toBe(0);
    expect(birthdaysOn(leapling, d(2028, 2, 29)).length).toBe(1);
  });
});

describe('daysUntil, turning and upcoming', () => {
  const today = d(2026, 11, 5);
  it('counts to the next birthday, today being 0', () => {
    expect(daysUntil(P('a', 11, 5), today)).toBe(0);
    expect(daysUntil(P('a', 11, 6), today)).toBe(1);
    expect(daysUntil(P('a', 11, 4), today)).toBe(364);
    expect(daysUntil(P('a', 1, 1), today)).toBe(57);   // into next year
  });
  it('works out the age they turn, when the year is known', () => {
    expect(turning(P('a', 11, 5, 2000), today)).toBe(26);
    expect(turning(P('a', 11, 4, 2000), today)).toBe(27);
    expect(turning(P('a', 11, 5), today)).toBeNull();
  });
  it('sorts the soonest first and limits the list', () => {
    const list = upcoming([P('late', 12, 25), P('now', 11, 5), P('soon', 11, 9), P('past', 10, 1)], today, 3);
    expect(list.map((x) => x.person.name)).toEqual(['now', 'soon', 'late']);
    expect(list[0].in).toBe(0);
  });
  it('says it in words', () => {
    expect([0, 1, 5].map(whenText)).toEqual(['today', 'tomorrow', 'in 5 days']);
  });
});
