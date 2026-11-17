// Thought bubbles: who a cat at home might be thinking about. Pure, the room decides when to roll.
import type { Cat } from './rules.ts';

export type ThoughtKind = 'away' | 'returned' | 'passed' | 'ranAway';
export interface Thought { thinker: string; subject: string; kind: ThoughtKind }

// Chance per roll (one roll every few seconds) that a cat thinks about this one.
export const AWAY_BASE = 0.015;     // a cat that just left
export const AWAY_PER_DAY = 1.2;    // the chance grows with every day away...
export const AWAY_MAX = 0.12;       // ...up to this
export const MEMORY_CHANCE = 0.003; // passed away or ran away: rare
export const RETURN_CHANCE = 0.008; // came home recently
export const RETURN_DAYS = 7;       // how long a return stays worth mentioning

// Last day a cat came back from the sitter or from running away, if it is home now.
function returnDay(c: Cat, returned: Record<string, number>): number | null {
  if (c.status !== 'alive') return null;
  const trip = c.sitterTrips[c.sitterTrips.length - 1];
  const days = [returned[c.id], trip?.end ?? undefined].filter((d): d is number => d !== undefined);
  return days.length ? Math.max(...days) : null;
}

// Why a cat is on someone's mind right now, from its *current* status only (so it can never contradict it).
export function thoughtAbout(c: Cat, today: number, returned: Record<string, number> = {}): { kind: ThoughtKind; chance: number } | null {
  switch (c.status) {
    case 'sitter': {
      const away = Math.max(0, today - (c.sitterStartDay ?? today));
      return { kind: 'away', chance: Math.min(AWAY_MAX, AWAY_BASE * (1 + AWAY_PER_DAY * away)) };
    }
    case 'dead': return { kind: 'passed', chance: MEMORY_CHANCE };
    case 'ranAway': case 'leftForever': case 'gone': return { kind: 'ranAway', chance: MEMORY_CHANCE };
    case 'alive': {
      const day = returnDay(c, returned);
      return day !== null && today - day >= 0 && today - day <= RETURN_DAYS ? { kind: 'returned', chance: RETURN_CHANCE } : null;
    }
    default: return null;   // shelter: no thoughts
  }
}

export function pickThought(
  cats: Cat[],
  today: number,
  returned: Record<string, number>,
  canThink: (catId: string) => boolean,
  random: () => number = Math.random,
): Thought | null {
  const subjects = cats.flatMap((c) => { const t = thoughtAbout(c, today, returned); return t ? [{ id: c.id, ...t }] : []; });
  if (!subjects.length) return null;
  const thinkers = cats.filter((c) => c.status === 'alive' && canThink(c.id)).sort(() => random() - 0.5);
  for (const th of thinkers) {
    const options = subjects.filter((s) => s.id !== th.id);
    const total = options.reduce((n, s) => n + s.chance, 0);
    let r = random();
    if (r >= total) continue;
    for (const s of options) {
      if (r < s.chance) return { thinker: th.id, subject: s.id, kind: s.kind };
      r -= s.chance;
    }
  }
  return null;
}
