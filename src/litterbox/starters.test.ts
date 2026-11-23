import { describe, expect, it } from 'vitest';
import { dayOf } from '../shared/dates.ts';
import { STARTERS, addStarters, hasStarter } from './starters.ts';
import { addChore, dayKey, dueOf, emptyData, sanitize, statusOf, weekdayOf } from './model.ts';

const TODAY = dayOf(2026, 4, 20);   // Wed 20 May 2026

describe('starter chores', () => {
  it('only use categories that exist, and have unique names', () => {
    const cats = new Set(emptyData().cats.map((c) => c.id));
    expect(STARTERS.every((s) => cats.has(s.cat))).toBe(true);
    expect(new Set(STARTERS.map((s) => s.name.toLowerCase())).size).toBe(STARTERS.length);
  });
  it('adds the chosen ones, spread out, none due today, with reminders and a heads-up', () => {
    const picks = STARTERS.slice(0, 6);
    const { data, added } = addStarters(emptyData(), picks, TODAY);
    expect(added).toBe(6);
    expect(data.chores.map((c) => c.name)).toEqual(picks.map((s) => s.name));
    const days = data.chores.map((c) => dueOf(c));
    expect(days.every((d) => d > TODAY)).toBe(true);
    expect(new Set(days).size).toBeGreaterThan(2);
    expect(data.chores.every((c) => c.remind && c.repeat && !c.rolling)).toBe(true);
    expect(data.chores.every((c) => statusOf(c, TODAY).status !== 'overdue')).toBe(true);
    expect(sanitize(JSON.parse(JSON.stringify(data))).chores).toEqual(data.chores);
  });
  it('keeps what an idea says: its day, laundry piling up, what to buy', () => {
    const pick = (name: string) => STARTERS.find((s) => s.name === name)!;
    const { data } = addStarters(emptyData(), [pick('Vacuum'), pick('Laundry'), pick('Replace the toothbrush')], TODAY);
    const [vac, laundry, brush] = data.chores;
    expect(weekdayOf(dueOf(vac))).toBe(5);
    expect(laundry.pile).toBe(true);
    expect(brush).toMatchObject({ buy: 'Toothbrush', every: { n: 6, unit: 'month' } });
    expect(dayKey(dueOf(brush)) > dayKey(TODAY)).toBe(true);
  });
  it('skips ones you already have, whatever the case, and says so', () => {
    const s = STARTERS[0];
    const d = addChore(emptyData(), { name: s.name.toUpperCase(), cat: 'bedroom', note: '', every: s.every, prefer: null, early: false, rolling: false, pile: false, lead: 0, remind: true, repeat: null, buy: '', next: TODAY })!.data;
    expect(hasStarter(d, s)).toBe(true);
    const r = addStarters(d, [s, STARTERS[1]], TODAY);
    expect(r.added).toBe(1);
    expect(r.data.chores).toHaveLength(2);
  });
});
