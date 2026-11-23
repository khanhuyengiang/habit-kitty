import { describe, expect, it } from 'vitest';
import { LITTERBOX_ID_BASE } from '../shared/notifications.ts';
import { dayOf } from '../shared/dates.ts';
import { ALERT_DAYS, alertDays, alertText, planAlerts } from './reminders.ts';
import { addChore, choreOf, dayKey, emptyData, markDone, setAlerts, snooze, type ChoreEdit, type LitterData } from './model.ts';

const D = (y: number, m: number, d: number) => dayOf(y, m - 1, d);
const NOW = new Date(2026, 4, 20, 8, 0);   // Wed 20 May 2026, 08:00
const TODAY = D(2026, 5, 20);
const edit = (over: Partial<ChoreEdit> = {}): ChoreEdit => ({
  name: 'Change bedsheet', cat: 'bedroom', note: '', every: { n: 2, unit: 'week' }, prefer: null, early: false, rolling: false, pile: false, lead: 0,
  remind: true, repeat: null, next: D(2026, 5, 22), ...over,
});
const on = (d: LitterData) => setAlerts(d, { on: true, hour: 9, minute: 30 });
const make = (over: Partial<ChoreEdit> = {}, d: LitterData = on(emptyData())) => { const r = addChore(d, edit(over))!; return { d: r.data, id: r.id }; };
const when = (a: { at: Date }) => `${a.at.getFullYear()}-${String(a.at.getMonth() + 1).padStart(2, '0')}-${String(a.at.getDate()).padStart(2, '0')} ${String(a.at.getHours()).padStart(2, '0')}:${String(a.at.getMinutes()).padStart(2, '0')}`;

describe('what is planned', () => {
  it('plans nothing while notifications are off, or a chore has none', () => {
    expect(planAlerts(make({}, emptyData()).d, NOW)).toEqual([]);
    expect(planAlerts(make({ remind: false }).d, NOW)).toEqual([]);
  });
  it('plans the due day at the chosen time, once, when there is no repeat or heads-up', () => {
    const plan = planAlerts(make().d, NOW);
    expect(plan.map(when)).toEqual(['2026-05-22 09:30']);
    expect(plan[0]).toMatchObject({ title: 'Kitty Litterbox', body: 'Change bedsheet is due today', chores: ['Change bedsheet'] });
    expect(plan[0].id).toBeGreaterThanOrEqual(LITTERBOX_ID_BASE);
  });
  it('adds a heads-up before the due day', () => {
    const plan = planAlerts(make({ lead: 2 }).d, NOW);
    expect(plan.map(when)).toEqual(['2026-05-20 09:30', '2026-05-22 09:30']);
    expect(plan.map((p) => p.body)).toEqual(['Change bedsheet is due on Friday', 'Change bedsheet is due today']);
  });
  it('repeats after the due day until the end of the window', () => {
    const plan = planAlerts(make({ repeat: { n: 1, unit: 'day' } }).d, NOW);
    expect(plan).toHaveLength(ALERT_DAYS + 1 - 2);   // from Fri 22 May to the last day of the window
    expect(plan.slice(0, 3).map((p) => p.body)).toEqual(['Change bedsheet is due today', 'Change bedsheet is 1 day overdue', 'Change bedsheet is 2 days overdue']);
    expect(planAlerts(make({ repeat: { n: 1, unit: 'week' } }).d, NOW).map(when)).toEqual(['2026-05-22 09:30', '2026-05-29 09:30']);   // the window ends on 3 June
  });
  it('keeps nagging an overdue chore, from today if the time is still to come', () => {
    const { d } = make({ next: D(2026, 5, 15), repeat: { n: 1, unit: 'day' } });
    expect(when(planAlerts(d, NOW)[0])).toBe('2026-05-20 09:30');
    expect(when(planAlerts(d, new Date(2026, 4, 20, 10, 0))[0])).toBe('2026-05-21 09:30');
  });
  it('stops once the chore is done', () => {
    const { d, id } = make({ next: D(2026, 5, 15), repeat: { n: 1, unit: 'day' } });
    const done = markDone(d, id, TODAY);
    const plan = planAlerts(done, NOW);   // a fixed chore goes on to its next date, Fri 29 May: nothing before it
    expect(plan.map(when)[0]).toBe('2026-05-29 09:30');
    expect(plan[0].body).toBe('Change bedsheet is due today');
  });
  it('is quiet until a snooze ends, then speaks up even without a repeat', () => {
    const { d, id } = make({ next: D(2026, 5, 20) });
    expect(planAlerts(d, new Date(2026, 4, 20, 8, 0)).map(when)).toEqual(['2026-05-20 09:30']);
    const s = snooze(d, id, D(2026, 5, 23));
    expect(planAlerts(s, NOW).map(when)).toEqual(['2026-05-23 09:30']);
    expect(planAlerts(s, NOW)[0].body).toBe('Change bedsheet is 3 days overdue');
  });
  it('does not wake a chore whose turn is still far off', () => {
    const { d, id } = make({ next: D(2026, 8, 20), lead: 3 });
    expect(planAlerts(snooze(d, id, D(2026, 5, 23)), NOW)).toEqual([]);
  });
  it('follows a delayed date', () => {
    const { d, id } = make({ next: D(2026, 5, 20) });
    const delayed = { ...d, chores: d.chores.map((c) => (c.id === id ? { ...c, shift: dayKey(D(2026, 5, 27)) } : c)) };
    expect(planAlerts(delayed, NOW).map(when)).toEqual(['2026-05-27 09:30']);
  });
  it('puts chores that fall together in one notification', () => {
    let { d } = make({ name: 'Bedsheet' });
    for (const name of ['Dishwasher', 'Towels', 'Toothbrush']) d = addChore(d, edit({ name }))!.data;
    const plan = planAlerts(d, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].body).toBe('4 chores need you: Bedsheet, Dishwasher and 2 more.');
    expect(plan[0].chores).toHaveLength(4);
    expect(new Set(planAlerts(make({ lead: 1, repeat: { n: 1, unit: 'day' } }).d, NOW).map((p) => p.id)).size).toBeGreaterThan(5);
  });
  it('skips what is already past and what is beyond the window', () => {
    expect(planAlerts(make({ next: D(2026, 5, 19) }).d, NOW)).toEqual([]);
    expect(planAlerts(make({ next: D(2026, 7, 1) }).d, NOW)).toEqual([]);
  });
});

describe('words and days', () => {
  it('says what a chore needs on each day', () => {
    const c = { name: 'Dishwasher filter' };
    const t = D(2026, 5, 20);   // a Wednesday
    expect([alertText(c, t + 2, t), alertText(c, t + 2, t + 2), alertText(c, t + 2, t + 4)]).toEqual(['Dishwasher filter is due on Friday', 'Dishwasher filter is due today', 'Dishwasher filter is 2 days overdue']);
  });
  it('lists the days a chore speaks up on', () => {
    const { d, id } = make({ lead: 2, repeat: { n: 3, unit: 'day' } });
    expect(alertDays(choreOf(d, id)!, TODAY, TODAY + 10).map(dayKey)).toEqual(['2026-05-20', '2026-05-22', '2026-05-25', '2026-05-28']);   // the next would be 31 May
  });
});
