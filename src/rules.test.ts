import { describe, it, expect } from 'vitest';
import {
  newState, adoptCat, feedCat, startSitter, resumeCat, settleAll,
  addMindfulTask, doMindfulTask, removeMindfulTask, returnToShelter, habitToCat, dayIndex, levelFor, levelProgress,
  graveyard, runaways, hunger, type ActionResult, type AppState, type CatMode,
} from './rules';

// day n at a given hour (all test dates are local time)
const at = (day: number, hour = 12) => new Date(2026, 0, 5 + day, hour, 0, 0);
const ok = (r: ActionResult): AppState => {
  if (!r.ok) throw new Error('expected ok, got ' + r.reason);
  return r.state;
};
const setup = (mode: CatMode = 'classic') =>
  ok(adoptCat(newState(), { id: 'c1', name: 'Mochi', habit: 'Meditate', mode }, at(0)));

describe('day boundary', () => {
  it('rolls over at 2am, not midnight', () => {
    const evening = new Date(2026, 0, 5, 23, 0);
    expect(dayIndex(new Date(2026, 0, 6, 1, 59))).toBe(dayIndex(evening));
    expect(dayIndex(new Date(2026, 0, 6, 2, 0))).toBe(dayIndex(evening) + 1);
  });
});

describe('levels', () => {
  it('uses 100, 200, 300... per level, uncapped', () => {
    expect(levelFor(-50)).toBe(0);
    expect(levelFor(99)).toBe(0);
    expect(levelFor(100)).toBe(1);
    expect(levelFor(299)).toBe(1);
    expect(levelFor(300)).toBe(2);
    expect(levelFor(600)).toBe(3);
    expect(levelFor(10_000)).toBe(13);
  });
  it('reports progress', () => {
    expect(levelProgress(150)).toEqual({ level: 1, xpIntoLevel: 50, xpForNextLevel: 200 });
  });
});

describe('feeding', () => {
  it('gives +5 once per day', () => {
    let s = ok(feedCat(setup(), 'c1', at(0)));
    expect(s.xp).toBe(5);
    const again = feedCat(s, 'c1', at(0, 15));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('already_fed_today');
    expect(again.state.xp).toBe(5);
    s = ok(feedCat(s, 'c1', at(1)));
    expect(s.xp).toBe(10);
  });
  it('counts feeding before 2am toward the previous day', () => {
    let s = ok(feedCat(setup(), 'c1', new Date(2026, 0, 5, 12)));
    const r = feedCat(s, 'c1', new Date(2026, 0, 6, 1, 30)); // still "day 0"
    expect(r.ok).toBe(false);
  });
  it('records each day the cat was fed', () => {
    let s = ok(feedCat(setup(), 'c1', at(0)));
    s = feedCat(s, 'c1', at(0, 15)).state;   // rejected, not recorded twice
    s = ok(feedCat(s, 'c1', at(2)));
    expect(s.cats[0].fedDays).toEqual([dayIndex(at(0)), dayIndex(at(2))]);
  });
});

describe('starvation and death', () => {
  it('hungry -> starving -> dead with -15 per missed day', () => {
    let s = ok(feedCat(setup(), 'c1', at(0))); // xp 5
    s = settleAll(s, at(1)).state;
    expect(s.xp).toBe(5);
    expect(hunger(s.cats[0], dayIndex(at(1)))).toBe('peckish');

    s = settleAll(s, at(2)).state;
    expect(s.xp).toBe(-10);
    expect(hunger(s.cats[0], dayIndex(at(2)))).toBe('hungry');

    s = settleAll(s, at(3)).state;
    expect(s.xp).toBe(-25);
    expect(hunger(s.cats[0], dayIndex(at(3)))).toBe('starving');

    const r = settleAll(s, at(4));
    expect(r.state.xp).toBe(0);
    expect(r.state.cats[0].status).toBe('dead');
    expect(r.events.some((e) => e.type === 'died')).toBe(true);
    expect(graveyard(r.state)).toHaveLength(1);
  });

  it('caps the penalty at 3 misses even if the app was closed for ages', () => {
    const s = settleAll(ok(feedCat(setup(), 'c1', at(0))), at(40)).state;
    expect(s.cats[0].status).toBe('dead');
    expect(s.xp).toBe(0);
  });

  it('feeding a hungry cat rescues it', () => {
    let s = ok(feedCat(setup(), 'c1', at(0)));
    s = ok(feedCat(s, 'c1', at(2))); // settles -15 first, then +5
    expect(s.cats[0].status).toBe('alive');
    expect(s.cats[0].missed).toBe(0);
    expect(s.xp).toBe(-5);
  });

  it('settling twice in a row changes nothing', () => {
    const a = settleAll(setup(), at(2)).state;
    const b = settleAll(a, at(2)).state;
    expect(b).toEqual(a);
  });
});

describe('light-hearted mode', () => {
  it('runs away instead of dying', () => {
    const r = settleAll(setup('lighthearted'), at(10));
    expect(r.state.cats[0].status).toBe('ranAway');
    expect(graveyard(r.state)).toHaveLength(0);
    expect(runaways(r.state)).toHaveLength(1);
    expect(r.events.some((e) => e.type === 'ranAway')).toBe(true);
    expect(r.state.xp).toBe(-45); // same penalties as classic
  });

  it('comes back once when you do the habit, then leaves for good', () => {
    let s = settleAll(setup('lighthearted'), at(10)).state;   // ran away, xp -45

    const back = feedCat(s, 'c1', at(10));
    s = ok(back);
    expect(back.events.some((e) => e.type === 'returned')).toBe(true);
    expect(s.cats[0].status).toBe('alive');
    expect(s.cats[0].missed).toBe(0);
    expect(s.xp).toBe(-40);

    s = settleAll(s, at(20)).state;                            // neglected again
    expect(s.cats[0].status).toBe('leftForever');
    expect(s.cats[0].runAwayCount).toBe(2);
    expect(s.xp).toBe(-85);

    const r = feedCat(s, 'c1', at(20));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('cat_not_active');
  });

  it('a runaway cat still holds your one slot at low xp', () => {
    const s = settleAll(setup('lighthearted'), at(10)).state;  // xp -45, cat away
    const r = adoptCat(s, { id: 'c2', name: 'Pixel', habit: 'Read' }, at(10));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('low_affection_cat_limit');
  });
});

describe('classic mode', () => {
  it('a dead cat cannot be revived by feeding', () => {
    const s = settleAll(setup(), at(10)).state;
    const r = feedCat(s, 'c1', at(10));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('cat_not_active');
  });
});

describe('pet sitter', () => {
  it('freezes hunger, costs 5xp/day, and hunger resumes after', () => {
    let s = ok(feedCat(setup(), 'c1', at(0))); // xp 5
    s = ok(startSitter(s, 'c1', at(1)));
    s = ok(resumeCat(s, 'c1', at(4)));
    expect(s.xp).toBe(5 - 15);
    expect(s.cats[0].status).toBe('alive');
    expect(s.cats[0].missed).toBe(0);
    s = settleAll(s, at(5)).state; // day 4 (resume day) was not fed
    expect(s.cats[0].missed).toBe(1);
  });

  it('cat is gone for good if not resumed within the week', () => {
    let s = ok(feedCat(setup(), 'c1', at(0)));
    s = ok(startSitter(s, 'c1', at(1)));
    s = settleAll(s, at(7)).state;
    expect(s.cats[0].status).toBe('sitter'); // last day to resume
    expect(s.xp).toBe(5 - 30);
    s = settleAll(s, at(8)).state;
    expect(s.cats[0].status).toBe('gone');
    expect(s.xp).toBe(5 - 35);
    s = settleAll(s, at(30)).state;
    expect(s.xp).toBe(5 - 35); // no more drain
    const r = resumeCat(s, 'c1', at(30));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_with_sitter');
  });

  it('keeps a history of sitter trips', () => {
    let s = ok(startSitter(setup(), 'c1', at(1)));
    expect(s.cats[0].sitterTrips).toEqual([{ start: dayIndex(at(1)), end: null }]);
    s = ok(resumeCat(s, 'c1', at(4)));
    expect(s.cats[0].sitterTrips).toEqual([{ start: dayIndex(at(1)), end: dayIndex(at(4)) }]);


    s = ok(startSitter(setup(), 'c1', at(1)));
    s = settleAll(s, at(20)).state; // never resumed
    expect(s.cats[0].sitterTrips).toEqual([{ start: dayIndex(at(1)), end: dayIndex(at(8)) }]);
  });

  it('cannot feed a cat that is with the sitter', () => {
    const s = ok(startSitter(setup(), 'c1', at(0)));
    const r = feedCat(s, 'c1', at(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('with_sitter');
  });

  it('allows one trip per cat per 30 days', () => {
    const base = setup();
    const withLast = (d: number) =>
      ({ ...base, cats: [{ ...base.cats[0], lastSitterStartDay: dayIndex(at(d)) }] });
    expect(startSitter(withLast(-29), 'c1', at(0)).ok).toBe(false);
    expect(startSitter(withLast(-30), 'c1', at(0)).ok).toBe(true);
    const twice = startSitter(ok(startSitter(base, 'c1', at(0))), 'c1', at(0));
    expect(twice.ok).toBe(false);
  });
});

describe('low affection cat limit', () => {
  const second = { id: 'c2', name: 'Pixel', habit: 'Read' };

  it('blocks a 2nd cat while xp is negative', () => {
    const s = settleAll(setup(), at(1)).state; // missed a day -> xp -15
    expect(s.xp).toBe(-15);
    const r = adoptCat(s, second, at(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('low_affection_cat_limit');
  });

  it('still lets you adopt your first cat with negative xp', () => {
    const s = { ...newState(), xp: -100 };
    expect(adoptCat(s, second, at(0)).ok).toBe(true);
  });

  it('allows many cats when xp is healthy', () => {
    const s = ok(adoptCat(ok(feedCat(setup(), 'c1', at(0))), second, at(0)));
    expect(s.cats).toHaveLength(2);
  });
});

describe('mindful habits', () => {
  it('caps xp at 10, enforces the repeat time and tracks history', () => {
    let s = addMindfulTask(newState(), { id: 'h1', name: 'Clean the toilet', xp: 40, kind: 'habit', cooldownDays: 7 }, at(0));
    expect(s.tasks[0].xp).toBe(10);
    s = ok(doMindfulTask(s, 'h1', at(0)));
    expect(s.xp).toBe(10);
    const early = doMindfulTask(s, 'h1', at(3));
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toBe('task_on_cooldown');
    s = ok(doMindfulTask(s, 'h1', at(7)));
    expect(s.xp).toBe(20);
    expect(s.tasks[0].doneDays).toHaveLength(2);
  });

  it('pays at most 10 xp a day across habits but still lets them be done', () => {
    let s = addMindfulTask(newState(), { id: 'a', name: 'A', xp: 8, cooldownDays: 1 }, at(0));
    s = addMindfulTask(s, { id: 'b', name: 'B', xp: 8, cooldownDays: 1 }, at(0));
    s = ok(doMindfulTask(s, 'a', at(0)));
    s = ok(doMindfulTask(s, 'b', at(0)));
    expect(s.xp).toBe(10);
    s = ok(doMindfulTask(s, 'a', at(1)));
    expect(s.xp).toBe(18);
  });

  it('turns a daily habit into a cat that keeps its history', () => {
    let s = addMindfulTask(newState(), { id: 'h1', name: 'Drink water', xp: 2, cooldownDays: 1 }, at(0));
    s = ok(doMindfulTask(s, 'h1', at(0)));
    s = ok(doMindfulTask(s, 'h1', at(1)));
    s = ok(habitToCat(s, 'h1', { id: 'c1', name: 'Mochi' }, at(2)));
    expect(s.tasks).toHaveLength(0);
    expect(s.cats[0].habit).toBe('Drink water');
    expect(s.cats[0].habitDays).toEqual([dayIndex(at(0)), dayIndex(at(1))]);
    expect(s.cats[0].adoptedDay).toBe(dayIndex(at(2)));
  });

  it('only lets daily habits become cats', () => {
    const s = addMindfulTask(newState(), { id: 'h1', name: 'Call mum', xp: 2, cooldownDays: 7 }, at(0));
    const r = habitToCat(s, 'h1', { id: 'c1', name: 'Mochi' }, at(0));
    expect(r.ok).toBe(false);
  });

  it('removes a habit', () => {
    const s = addMindfulTask(newState(), { id: 't1', name: 'Stretch', xp: 2, cooldownDays: 1 }, at(0));
    expect(removeMindfulTask(s, 't1').tasks).toHaveLength(0);
  });
});

describe('one-off mindful tasks', () => {
  it('pay up to 15 xp once, then stay done', () => {
    let s = addMindfulTask(newState(), { id: 't1', name: 'Book dentist', xp: 40, kind: 'task' }, at(0));
    expect(s.tasks[0].xp).toBe(15);
    s = ok(doMindfulTask(s, 't1', at(0)));
    expect(s.xp).toBe(15);
    const again = doMindfulTask(s, 't1', at(30));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('task_already_done');
  });

  it('have a daily cap of 15 separate from habits', () => {
    let s = addMindfulTask(newState(), { id: 'a', name: 'A', xp: 12, kind: 'task' }, at(0));
    s = addMindfulTask(s, { id: 'b', name: 'B', xp: 12, kind: 'task' }, at(0));
    s = addMindfulTask(s, { id: 'h', name: 'H', xp: 6, kind: 'habit', cooldownDays: 1 }, at(0));
    s = ok(doMindfulTask(s, 'a', at(0)));
    s = ok(doMindfulTask(s, 'b', at(0)));
    s = ok(doMindfulTask(s, 'h', at(0)));
    expect(s.xp).toBe(15 + 6);
  });
});

describe('cat limit and shelter', () => {
  const adopt = (s: AppState, i: number, unlimited = false) =>
    adoptCat(s, { id: `c${i}`, name: `C${i}`, habit: 'x', unlimited }, at(0));
  const nine = () => {
    let s = newState();
    for (let i = 0; i < 9; i++) s = ok(adopt(s, i));
    return s;
  };

  it('stops at 9 cats unless unlimited', () => {
    const s = nine();
    const r = adopt(s, 9);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('cat_limit');
    expect(ok(adopt(s, 9, true)).cats).toHaveLength(10);
  });

  it('returns a cat to the shelter without penalty', () => {
    let s = ok(adoptCat(newState(), { id: 'c1', name: 'Mochi', habit: 'Water' }, at(0)));
    s = ok(returnToShelter(s, 'c1', at(0)));
    expect(s.cats[0].status).toBe('shelter');
    s = settleAll(s, at(10)).state;
    expect(s.xp).toBe(0);
    expect(returnToShelter(s, 'c1', at(10)).ok).toBe(false);
  });
});

describe('cat death', () => {
  it('resets affection to 0', () => {
    let s = ok(adoptCat(newState(), { id: 'c1', name: 'Mochi', habit: 'Water' }, at(0)));
    s = { ...s, xp: 80 };
    s = settleAll(s, at(3)).state;
    expect(s.cats[0].status).toBe('dead');
    expect(s.xp).toBe(0);
  });
});
