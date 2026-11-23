import { describe, expect, it } from 'vitest';
import {
  addChore, arrange, bandOf, choreOf, defaultLead, delay, delayTarget, deleteCat, dueLine, dueOf, editChore, emptyData, firstDue, gridDay, markDone,
  parseDay, dayKey, sanitize, behindBy, nextFromLast, saveCat, skip, skipTarget, snap, snooze, statusOf, summary, weekdayOf, whenText, noFilter,
  type ChoreEdit, type Every, type LitterData, type Prefer,
} from './model.ts';
import { dayOf } from '../shared/dates.ts';

// 1 May 2026 is a Friday.
const D = (y: number, m: number, d: number) => dayOf(y, m - 1, d);
const FRI = 4, THU = 3;
const edit = (over: Partial<ChoreEdit> = {}): ChoreEdit => ({
  name: 'Change bedsheet', cat: 'bedroom', note: '', every: { n: 2, unit: 'week' }, prefer: null, early: false, rolling: false, pile: false, lead: 1, next: D(2026, 5, 1), ...over,
});
const make = (over: Partial<ChoreEdit> = {}): { d: LitterData; id: string } => { const r = addChore(emptyData(), edit(over))!; return { d: r.data, id: r.id }; };
const due = (d: LitterData, id: string) => dayKey(dueOf(choreOf(d, id)!));

describe('days', () => {
  it('knows the weekday', () => { expect(weekdayOf(D(2026, 5, 1))).toBe(FRI); expect(weekdayOf(D(1970, 1, 1))).toBe(THU); });
  it('counts months from the anchor, so a 31st comes back', () => {
    const e: Every = { n: 1, unit: 'month' }, a = D(2026, 1, 31);
    expect([1, 2, 3].map((k) => dayKey(gridDay(a, e, k)))).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(dayKey(gridDay(D(2024, 1, 31), e, 1))).toBe('2024-02-29');
    expect(dayKey(gridDay(D(2026, 8, 15), { n: 6, unit: 'month' }, 1))).toBe('2027-02-15');
    expect(dayKey(gridDay(D(2024, 2, 29), { n: 1, unit: 'year' }, 1))).toBe('2025-02-28');
  });
});

describe('preferred day', () => {
  const fri: Prefer = { weekday: FRI };
  it('snaps a weekday back or forward', () => {
    expect(dayKey(snap(D(2026, 5, 21), fri, true))).toBe('2026-05-15');
    expect(dayKey(snap(D(2026, 5, 21), fri, false))).toBe('2026-05-22');
    expect(dayKey(snap(D(2026, 5, 22), fri, true))).toBe('2026-05-22');
    expect(dayKey(snap(D(2026, 5, 22), fri, false))).toBe('2026-05-22');
  });
  it('snaps a day of the month, across months and short months', () => {
    const third: Prefer = { dom: 3 }, last: Prefer = { dom: 0 }, thirty: Prefer = { dom: 31 };
    expect(dayKey(snap(D(2026, 5, 20), third, true))).toBe('2026-05-03');
    expect(dayKey(snap(D(2026, 5, 20), third, false))).toBe('2026-06-03');
    expect(dayKey(snap(D(2026, 1, 2), third, true))).toBe('2025-12-03');
    expect(dayKey(snap(D(2026, 2, 10), last, false))).toBe('2026-02-28');
    expect(dayKey(snap(D(2026, 2, 10), thirty, true))).toBe('2026-01-31');
    expect(dayKey(snap(D(2026, 2, 10), thirty, false))).toBe('2026-02-28');
  });
  it('finds the first day for a new chore', () => { expect(dayKey(firstDue(D(2026, 5, 2), { weekday: FRI }))).toBe('2026-05-08'); });
});

describe('rolling schedule', () => {
  it('is due early on the preferred day: done Fri 1 May, every 20 days, Fridays -> Fri 15 May', () => {
    const { d, id } = make({ every: { n: 20, unit: 'day' }, prefer: { weekday: FRI }, early: true, rolling: true, next: D(2026, 4, 1) });
    const done = markDone(d, id, D(2026, 5, 1));
    expect(due(done, id)).toBe('2026-05-15');
    // delayed on the 15th, it comes back the next Friday, and the one after that
    const once = delay(done, id, D(2026, 5, 15));
    expect(due(once, id)).toBe('2026-05-22');
    expect(due(delay(once, id, D(2026, 5, 22)), id)).toBe('2026-05-29');
  });
  it('is never early without "remind me early"', () => {
    const { d, id } = make({ every: { n: 20, unit: 'day' }, prefer: { weekday: FRI }, early: false, rolling: true });
    expect(due(markDone(d, id, D(2026, 5, 1)), id)).toBe('2026-05-22');
  });
  it('counts from the day it was done, even when that was a while ago', () => {
    const { d, id } = make({ every: { n: 1, unit: 'week' }, rolling: true });
    expect(due(markDone(d, id, D(2026, 5, 20), D(2026, 5, 18)), id)).toBe('2026-05-25');
  });
  it('never lands on or before the day it was done', () => {
    const { d, id } = make({ every: { n: 3, unit: 'day' }, prefer: { weekday: FRI }, early: true, rolling: true });
    expect(due(markDone(d, id, D(2026, 5, 4)), id)).toBe('2026-05-08');   // Mon + 3 = Thu; the Friday before is before it was done, so the next one
  });
});

describe('fixed schedule', () => {
  // every 2 weeks on Thursday, first on Thu 7 May
  const mk = () => make({ every: { n: 2, unit: 'week' }, prefer: { weekday: THU }, next: D(2026, 5, 7) });
  it('keeps its dates when it is done late', () => {
    const { d, id } = mk();
    expect(due(d, id)).toBe('2026-05-07');
    expect(due(markDone(d, id, D(2026, 5, 9)), id)).toBe('2026-05-21');
  });
  it('counts doing it early for the open cycle', () => {
    const { d, id } = mk();
    expect(due(markDone(d, id, D(2026, 5, 5)), id)).toBe('2026-05-21');
  });
  it('does not stack missed cycles', () => {
    const { d, id } = mk();
    expect(due(markDone(d, id, D(2026, 6, 20)), id)).toBe('2026-07-02');
  });
  it('delay moves only this one: the grid stays', () => {
    const { d, id } = mk();
    const late = delay(d, id, D(2026, 5, 7));
    expect(due(late, id)).toBe('2026-05-14');
    expect(due(markDone(late, id, D(2026, 5, 14)), id)).toBe('2026-05-21');
  });
  it('skip waits for the next date', () => {
    const { d, id } = mk();
    expect(due(skip(d, id, D(2026, 5, 7)), id)).toBe('2026-05-21');
    expect(dayKey(skipTarget(choreOf(d, id)!, D(2026, 5, 7)))).toBe('2026-05-21');
    expect(choreOf(skip(d, id, D(2026, 5, 7)), id)!.log).toEqual([{ day: '2026-05-07', kind: 'skip' }]);
  });
  it('a skipped overdue chore waits for a date in the future', () => {
    const { d, id } = mk();
    expect(due(skip(d, id, D(2026, 6, 20)), id)).toBe('2026-07-02');
  });
});

describe('missed dates', () => {
  // laundry: every week on Thursday, first on Thu 7 May; it is Thu 28 May, so 7, 14, 21 and 28 May are all owed
  const mk = (pile: boolean) => make({ every: { n: 1, unit: 'week' }, prefer: { weekday: THU }, next: D(2026, 5, 7), pile });
  const late = D(2026, 5, 28);
  it('one Done clears them all when they do not pile up', () => {
    const { d, id } = mk(false);
    expect(behindBy(choreOf(d, id)!, late)).toBe(0);
    expect(due(markDone(d, id, late), id)).toBe('2026-06-04');
  });
  it('each Done clears one when they pile up', () => {
    const { d, id } = mk(true);
    expect(behindBy(choreOf(d, id)!, late)).toBe(4);
    let x = markDone(d, id, late);
    expect(due(x, id)).toBe('2026-05-14');
    expect(statusOf(choreOf(x, id)!, late).behind).toBe(3);
    for (let i = 0; i < 3; i++) x = markDone(x, id, late);
    expect(due(x, id)).toBe('2026-06-04');
    expect(behindBy(choreOf(x, id)!, late)).toBe(0);
  });
  it('skip clears one when they pile up, and a rolling chore never piles up', () => {
    const { d, id } = mk(true);
    expect(due(skip(d, id, late), id)).toBe('2026-05-14');
    const r = make({ every: { n: 1, unit: 'week' }, rolling: true, pile: true, next: D(2026, 5, 7) });
    expect(behindBy(choreOf(r.d, r.id)!, late)).toBe(0);
    expect(due(markDone(r.d, r.id, late), r.id)).toBe('2026-06-04');
  });
  it('is kept when it is loaded', () => { const { d } = mk(true); expect(sanitize(JSON.parse(JSON.stringify(d))).chores[0].pile).toBe(true); });
});

describe('changing how often', () => {
  it('suggests a next date counted from the last time it was done', () => {
    const last = D(2026, 5, 1);   // a Friday
    expect(dayKey(nextFromLast({ every: { n: 3, unit: 'month' }, prefer: null, early: false }, last))).toBe('2026-08-01');
    expect(dayKey(nextFromLast({ every: { n: 20, unit: 'day' }, prefer: { weekday: FRI }, early: true }, last))).toBe('2026-05-15');
    expect(dayKey(nextFromLast({ every: { n: 3, unit: 'day' }, prefer: { weekday: FRI }, early: true }, last))).toBe('2026-05-08');
  });
  it('a new frequency takes over from the chosen next date and keeps the history', () => {
    const { d, id } = make({ every: { n: 6, unit: 'month' }, next: D(2026, 11, 1) });
    const done = markDone(d, id, D(2026, 5, 1));
    const next = nextFromLast({ every: { n: 3, unit: 'month' }, prefer: null, early: false }, D(2026, 5, 1));
    const e = editChore(done, id, edit({ every: { n: 3, unit: 'month' }, next }), D(2026, 5, 2));
    expect(due(e, id)).toBe('2026-08-01');
    expect(choreOf(e, id)!.log).toHaveLength(1);
    expect(due(markDone(e, id, D(2026, 8, 1)), id)).toBe('2026-11-01');
  });
});

describe('skip on a rolling schedule', () => {
  it('waits a whole interval after the due date: due the 21st, every 20 days -> the 41st day', () => {
    const { d, id } = make({ every: { n: 20, unit: 'day' }, rolling: true, next: D(2026, 5, 21) });
    expect(due(skip(d, id, D(2026, 5, 21)), id)).toBe('2026-06-10');
  });
});

describe('status', () => {
  const { d, id } = make({ every: { n: 1, unit: 'month' }, lead: 3, next: D(2026, 5, 10) });
  const at = (day: number) => statusOf(choreOf(d, id)!, D(2026, 5, day));
  it('goes from resting to overdue', () => {
    expect([at(1).status, at(7).status, at(10).status, at(11).status]).toEqual(['resting', 'soon', 'due', 'overdue']);
  });
  it('a snooze is quiet until its day, then the chore speaks up again', () => {
    const s = snooze(d, id, D(2026, 5, 13));
    expect(statusOf(choreOf(s, id)!, D(2026, 5, 11)).snoozed).toBe(true);
    expect(statusOf(choreOf(s, id)!, D(2026, 5, 13)).snoozed).toBe(false);
    expect(due(s, id)).toBe('2026-05-10');
    expect(choreOf(markDone(s, id, D(2026, 5, 11)), id)!.snooze).toBe('');
  });
  it('picks a heads-up from the interval', () => {
    expect([{ n: 1, unit: 'day' }, { n: 1, unit: 'week' }, { n: 1, unit: 'month' }, { n: 3, unit: 'month' }, { n: 1, unit: 'year' }].map((e) => defaultLead(e as Every))).toEqual([0, 1, 3, 7, 14]);
  });
});

describe('words', () => {
  const today = D(2026, 5, 20);   // a Wednesday
  it('says when', () => {
    const w = (n: number) => whenText(today + n, today);
    expect([w(-1), w(-3), w(0), w(1), w(2)]).toEqual(['1 day overdue', '3 days overdue', 'today', 'tomorrow', 'on Friday']);
    expect([w(3), w(4)]).toEqual(['this weekend', 'this weekend']);
    expect([w(7), w(10), w(11)]).toEqual(['next Wednesday', 'next weekend', 'next weekend']);
    expect([w(21), w(61), w(200), w(900)]).toEqual(['in 3 weeks', 'in 2 months', 'in 7 months', 'in 2 years']);
  });
  it('writes the line the list shows', () => {
    const { d, id } = make({ next: D(2026, 5, 23) });
    expect(dueLine(statusOf(choreOf(d, id)!, today), today)).toBe('due this weekend');
    expect(dueLine(statusOf(choreOf(markDone(d, id, today), id)!, today), today)).toBe('due in 2 weeks');
  });
  it('groups by how often', () => {
    expect([{ n: 1, unit: 'week' }, { n: 2, unit: 'week' }, { n: 1, unit: 'month' }, { n: 3, unit: 'month' }, { n: 6, unit: 'month' }, { n: 1, unit: 'year' }].map((e) => bandOf(e as Every)))
      .toEqual(['Every week or less', 'Every couple of weeks', 'Monthly', 'Every few months', 'Twice a year', 'Yearly or longer']);
  });
});

describe('editing', () => {
  it('keeps the history and the schedule when only the name changes', () => {
    const { d, id } = make();
    const done = markDone(d, id, D(2026, 5, 1));
    const e = editChore(done, id, edit({ name: 'Wash sheets', next: dueOf(choreOf(done, id)!) }), D(2026, 5, 2));
    expect(choreOf(e, id)!.name).toBe('Wash sheets');
    expect(choreOf(e, id)!.log).toHaveLength(1);
    expect(due(e, id)).toBe(due(done, id));
  });
  it('starts the row again from the next due day when the schedule changes', () => {
    const { d, id } = make();
    const e = editChore(d, id, edit({ every: { n: 1, unit: 'month' }, next: D(2026, 5, 10) }), D(2026, 5, 2));
    expect(due(e, id)).toBe('2026-05-10');
    expect(due(markDone(e, id, D(2026, 5, 10)), id)).toBe('2026-06-10');
  });
  it('refuses a chore with no name', () => { expect(addChore(emptyData(), edit({ name: '  ' }))).toBeNull(); });
});

describe('categories', () => {
  it('deleting one moves its chores to Other', () => {
    const { d, id } = make({ cat: 'bedroom' });
    const x = deleteCat(d, 'bedroom');
    expect(choreOf(x, id)!.cat).toBe('other');
    expect(x.cats.some((c) => c.id === 'bedroom')).toBe(false);
    expect(deleteCat(x, 'other')).toBe(x);
  });
  it('makes a category before Other and refuses a name that is taken', () => {
    const r = saveCat(emptyData(), null, { name: 'Pets', icon: 'paw', color: 'mint' })!;
    expect(r.data.cats.at(-1)!.id).toBe('other');
    expect(r.data.cats.at(-2)!.name).toBe('Pets');
    expect(saveCat(r.data, null, { name: 'pets', icon: 'paw', color: 'mint' })).toBeNull();
  });
});

describe('the list', () => {
  const today = D(2026, 5, 20);
  const build = () => {
    let d = emptyData();
    for (const [name, cat, every, next] of [['Toothbrush', 'health', { n: 6, unit: 'month' }, D(2027, 1, 1)], ['Bedsheet', 'bedroom', { n: 2, unit: 'week' }, D(2026, 5, 18)],
      ['Dishwasher', 'kitchen', { n: 1, unit: 'month' }, D(2026, 5, 21)], ['Smoke alarm', 'home', { n: 1, unit: 'year' }, D(2026, 5, 20)]] as const) {
      d = addChore(d, edit({ name, cat, every, next, lead: 3 }))!.data;
    }
    return d;
  };
  it('sorts by urgency: overdue first, resting last', () => {
    const g = arrange(build(), today, 'urgency', noFilter);
    expect(g.map((x) => x.title)).toEqual(['Due now', 'Coming up', 'Resting']);
    expect(g[0].items.map((v) => v.chore.name)).toEqual(['Bedsheet', 'Smoke alarm']);
  });
  it('groups by category and by frequency, and filters', () => {
    const d = build();
    expect(arrange(d, today, 'category', noFilter).map((x) => x.title)).toEqual(['Bedroom', 'Kitchen', 'Home', 'Health']);
    expect(arrange(d, today, 'frequency', noFilter).map((x) => x.title)).toEqual(['Every couple of weeks', 'Monthly', 'Twice a year', 'Yearly or longer']);
    expect(arrange(d, today, 'urgency', { cat: 'kitchen', status: 'all' }).flatMap((x) => x.items).map((v) => v.chore.name)).toEqual(['Dishwasher']);
    expect(arrange(d, today, 'urgency', { cat: '', status: 'resting' }).flatMap((x) => x.items).map((v) => v.chore.name)).toEqual(['Toothbrush']);
  });
  it('summarises', () => { expect(summary(build(), today)).toBe('2 due · 1 coming up'); expect(summary(emptyData(), today)).toBe(''); });
});

describe('loading', () => {
  it('starts empty from nothing', () => { expect(sanitize(null).chores).toEqual([]); expect(sanitize('x').cats.length).toBeGreaterThan(3); });
  it('keeps what is good and drops what is not', () => {
    const { d, id } = make({ prefer: { dom: 3 }, early: true });
    const back = sanitize(JSON.parse(JSON.stringify(d)));
    expect(back.chores).toEqual(d.chores);
    expect(back.chores[0].id).toBe(id);
    const bad = sanitize({ chores: [{ id: 'a', name: 'ok', anchor: '2026-05-01', every: { n: -4, unit: 'fortnight' }, cat: 'nope', cycle: 'x', log: [{ day: 'x', kind: 'done' }] }, { id: 'b', name: 'no date' }, null] });
    expect(bad.chores).toHaveLength(1);
    expect(bad.chores[0]).toMatchObject({ every: { n: 1, unit: 'week' }, cat: 'other', cycle: 0, log: [] });
  });
  it('parses days it wrote', () => { expect(dayKey(parseDay('2026-02-28'))).toBe('2026-02-28'); });
});
