// Which way a sitting kitty faces, and how it turns. The sprites are drawn facing left, and every other way is one of them
// (turned over, for facing right):
//   SL  side on, facing left (the idle pose)        SR  the same, facing right (flipped)
//   TL  three-quarters, facing left                 TR  the same, facing right (flipped)
//   F   facing you                                  B   its back to you
// A kitty only ever turns to a neighbour, as a real one would not spin on the spot: from F to SL it goes F, TL, SL; from SL round to SR
// it goes SL, TL, F, TR, SR; from B to a side it goes B, T, S. It must be side on (SL or SR) before it walks.
export type Facing = 'SL' | 'TL' | 'F' | 'TR' | 'SR' | 'B';
export const FACINGS: Facing[] = ['SL', 'TL', 'F', 'TR', 'SR', 'B'];
const EDGES: [Facing, Facing][] = [['SL', 'TL'], ['TL', 'F'], ['F', 'TR'], ['TR', 'SR'], ['B', 'TL'], ['B', 'TR']];
export const ANIM_OF: Record<Facing, string> = { SL: 'idle', SR: 'idle', TL: 'threeq', TR: 'threeq', F: 'front', B: 'back' };
// Front and back look the same either way round, so they may be turned over for a change (`mirror`).
export const flipOf = (f: Facing, mirror = false) => (f === 'SR' || f === 'TR' ? true : f === 'F' || f === 'B' ? mirror : false);
export const sideOf = (f: Facing): 'L' | 'R' | null => (f === 'SL' || f === 'TL' ? 'L' : f === 'SR' || f === 'TR' ? 'R' : null);
export const sideFacing = (dir: 'L' | 'R'): Facing => (dir === 'L' ? 'SL' : 'SR');

// The turns to get from one facing to another (the first is where it is now), through facings it has a pose for (`have`); with no way
// through it just goes there.
export function turnPath(from: Facing, to: Facing, have: (f: Facing) => boolean = () => true): Facing[] {
  if (from === to) return [from];
  const prev = new Map<Facing, Facing>([[from, from]]);
  const queue: Facing[] = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === to) break;
    for (const [a, b] of EDGES) {
      const next = a === at ? b : b === at ? a : null;
      if (next && !prev.has(next) && (have(next) || next === to)) { prev.set(next, at); queue.push(next); }
    }
  }
  if (!prev.has(to)) return [from, to];
  const path: Facing[] = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}
