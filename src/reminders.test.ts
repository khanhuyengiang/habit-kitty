import { describe, expect, it } from 'vitest';
import { adoptCat, dayIndex, feedCat, newState, type AppState } from './rules.ts';
import { HAPPY_BODY, planReminders, type ReminderSettings } from './reminders.ts';

const at = (h: number, m = 0, d = 10) => new Date(2026, 9, d, h, m);
const on: ReminderSettings = { enabled: true, hour: 18, minute: 0 };

function withCats(...names: string[]): AppState {
  let s = newState();
  for (const n of names) {
    const r = adoptCat(s, { id: n.toLowerCase(), name: n, habit: 'h' }, at(9));
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return s;
}

describe('planReminders', () => {
  it('plans nothing when disabled or when no cat is at home', () => {
    expect(planReminders(withCats('Mochi'), { ...on, enabled: false }, at(9)).plan).toEqual([]);
    expect(planReminders(newState(), on, at(9)).plan).toEqual([]);
  });

  it('names a hungry cat and uses the chosen local time', () => {
    const { plan } = planReminders(withCats('Mochi'), on, at(9), 3);
    expect(plan).toHaveLength(4);
    expect(plan[0].body).toBe('Mochi is hungry! Have you done "h" yet?');
    expect(plan[0].face).toBe('open');
    expect(plan[0].at.getHours()).toBe(18);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });

  it("skips today's reminder once its time has passed", () => {
    const { plan } = planReminders(withCats('Mochi'), on, at(19), 2);
    expect(plan).toHaveLength(2);
    expect(plan[0].at.getDate()).toBe(11);
  });

  it('sends the happy message today when everyone is fed, hungry messages afterwards', () => {
    let s = withCats('Mochi', 'Tofu');
    for (const id of ['mochi', 'tofu']) { const r = feedCat(s, id, at(10)); if (r.ok) s = r.state; }
    const { plan } = planReminders(s, on, at(11), 2);
    expect(plan[0].body).toBe(HAPPY_BODY);
    expect(plan[0].face).toBe('happy');
    expect(plan[1].body).toMatch(/is hungry/);
  });

  it('only names cats that have not been fed today', () => {
    let s = withCats('Mochi', 'Tofu');
    const r = feedCat(s, 'mochi', at(10)); if (r.ok) s = r.state;
    for (let i = 0; i < 20; i++) expect(planReminders(s, on, at(11), 0).plan[0].body).toContain('Tofu');
  });

  it('does not name the same cat two days in a row while others are unfed', () => {
    const s = withCats('Mochi', 'Tofu', 'Nori');
    for (let i = 0; i < 20; i++) {
      const { plan } = planReminders(s, on, at(9), 8);
      for (let k = 1; k < plan.length; k++) expect(plan[k].catId).not.toBe(plan[k - 1].catId);
    }
  });

  it('keeps earlier picks stable when replanning', () => {
    const s = withCats('Mochi', 'Tofu', 'Nori');
    const first = planReminders(s, on, at(9), 5);
    const again = planReminders(s, { ...on, picks: first.picks }, at(10), 5);
    expect(again.plan.map((p) => p.catId)).toEqual(first.plan.map((p) => p.catId));
    expect(Object.keys(first.picks)).toContain(String(dayIndex(at(18))));
  });
});

describe('per-kitty alarms', () => {
  it('schedules each kitty at its own time and skips a kitty already fed today', () => {
    let s = withCats('Mochi', 'Tofu');
    const r = feedCat(s, 'tofu', at(8)); if (r.ok) s = r.state;
    const settings: ReminderSettings = { enabled: false, hour: 18, minute: 0, catAlarms: { mochi: { hour: 7, minute: 30 }, tofu: { hour: 20, minute: 15 } } };
    const { plan } = planReminders(s, settings, at(9), 1);
    expect(plan.map((p) => p.body)).toEqual(['Time to feed Mochi! Do "h" first.', 'Time to feed Tofu! Do "h" first.']);
    expect(plan.every((p) => p.at.getDate() === 11)).toBe(true);   // today's 7:30 has passed and tofu is fed today
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
});

describe('last call', () => {
  const settings = (lastCall: 'gentle' | 'insistent'): ReminderSettings => ({ enabled: false, hour: 18, minute: 0, lastCall });
  it('alerts before the 2am day end, only for cats still hungry', () => {
    let s = withCats('Mochi', 'Tofu');
    const r = feedCat(s, 'mochi', at(8)); if (r.ok) s = r.state;
    const { plan } = planReminders(s, settings('insistent'), at(9), 0);
    expect(plan.map((p) => [p.at.getDate(), p.at.getHours(), p.at.getMinutes()])).toEqual([[10, 23, 0], [11, 1, 0], [11, 1, 45]]);
    expect(plan.every((p) => p.body.includes('Tofu') && !p.body.includes('Mochi'))).toBe(true);
  });
  it('sends one alert in gentle mode and none once everyone is fed', () => {
    const s = withCats('Mochi');
    expect(planReminders(s, settings('gentle'), at(9), 0).plan).toHaveLength(1);
    let fed = s; const r = feedCat(s, 'mochi', at(10)); if (r.ok) fed = r.state;
    expect(planReminders(fed, settings('gentle'), at(11), 0).plan).toHaveLength(0);
  });
  it('words the alerts by urgency and shortens long name lists', () => {
    const { plan } = planReminders(withCats('A', 'B', 'C', 'D'), settings('insistent'), at(9), 0);
    expect(plan[0].body).toBe('A, B and 2 more are still waiting to be fed. The day ends in 3 hours.');
    expect(plan[2].body).toContain('Last call');
  });
});

describe('the kitty in the notification', () => {
  it('looks sadder the longer the kitty has gone hungry', () => {
    const s = withCats('Mochi');
    const { plan } = planReminders(s, on, at(9), 3);
    expect(plan.map((p) => p.face)).toEqual(['open', 'sad', 'starving', 'starving']);
    expect(plan[1].body).toContain('missed yesterday');
    expect(plan[2].body).toContain('starving');
  });
  it('stays hopeful the day after a meal, and uses a sad face for last calls', () => {
    let s = withCats('Mochi');
    const r = feedCat(s, 'mochi', at(8)); if (r.ok) s = r.state;
    expect(planReminders(s, on, at(9), 2).plan.map((p) => p.face)).toEqual(['happy', 'open', 'sad']);
    const lc: ReminderSettings = { enabled: false, hour: 18, minute: 0, lastCall: 'gentle' };
    expect(planReminders(withCats('Mochi'), lc, at(9), 0).plan[0].face).toBe('sad');
  });
});
