// A cat's own diary: up to three little happenings per day, at made-up times. Pure and deterministic
// (seeded by the cats and the day), so reopening the page never reshuffles, and a pair event reads the
// same from both cats' side ("Nana played with Lulu" / "Lulu played with Nana").
import type { Cat } from './rules.ts';

export interface CatDiaryLine { minute: number; text: string; catId?: string; withId?: string }

export const MAX_LINES = 3;
const FIRST_MINUTE = 7 * 60, LAST_MINUTE = 23 * 60;   // 07:00 .. 22:59

const SOLO = [
  (n: string) => `${n} had a long wash`,
  (n: string) => `${n} napped in a sunbeam`,
  (n: string) => `${n} stared out of the window`,
  (n: string) => `${n} chased a dust bunny`,
  (n: string) => `${n} stretched and yawned`,
  (n: string) => `${n} watched the birds`,
  (n: string) => `${n} zoomed around the room`,
  (n: string) => `${n} knocked something off the shelf`,
  (n: string) => `${n} tried to fit into a tiny box`,
  (n: string) => `${n} purred for no reason`,
];
const PAIR = ['played with', 'napped next to', 'sat by the window with', 'explored the room with', 'shared a quiet moment with'];

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const minuteFrom = (r: () => number) => FIRST_MINUTE + Math.floor(r() * (LAST_MINUTE - FIRST_MINUTE));

export const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

export function catDiary(cat: Cat, cats: Cat[], day: number): CatDiaryLine[] {
  if (cat.status !== 'alive') return [];
  const others = cats.filter((o) => o.id !== cat.id && o.status === 'alive');
  const lines: CatDiaryLine[] = [];
  for (const o of others) {
    const [a, b] = [cat.id, o.id].sort();
    const r = rng(`${a}|${b}|${day}`);   // same roll from either side
    if (r() < Math.min(0.5, 1 / others.length)) lines.push({ minute: minuteFrom(r), text: `${cat.name} ${PAIR[Math.floor(r() * PAIR.length)]} ${o.name}`, catId: cat.id, withId: o.id });
  }
  lines.sort((x, y) => x.minute - y.minute);
  lines.length = Math.min(lines.length, MAX_LINES);
  const r = rng(`${cat.id}|${day}`);
  const want = 1 + Math.floor(r() * MAX_LINES);
  const used = new Set<number>();
  while (lines.length < want) {
    const i = Math.floor(r() * SOLO.length), minute = minuteFrom(r);
    if (used.has(i)) continue;
    used.add(i);
    lines.push({ minute, text: SOLO[i](cat.name), catId: cat.id });
  }
  return lines.sort((x, y) => x.minute - y.minute);
}

// Everyone's day in one list. A pair event shows up in both cats' diaries but is only listed once.
export function allCatsDiary(cats: Cat[], day: number): CatDiaryLine[] {
  const seen = new Set<string>();
  const out: CatDiaryLine[] = [];
  for (const c of cats) {
    for (const l of catDiary(c, cats, day)) {
      const key = `${l.minute}|${[l.catId, l.withId].filter(Boolean).sort().join('+')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(l);
    }
  }
  return out.sort((a, b) => a.minute - b.minute || a.text.localeCompare(b.text));
}
