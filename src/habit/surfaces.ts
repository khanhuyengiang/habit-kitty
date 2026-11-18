// The cats' surfaces, worked out from the kitty spots of the room (which Kitty Gallery lets you move): spots that stand at
// about the same height are one surface the cats can run along, and cats jump between surfaces (see ./moves.ts).
import type { Spot } from '../shared/scene.ts';
import type { Surface } from './moves.ts';

export const SAME_LEVEL = 12;   // spots whose feet are within this many pixels of the lowest one in a group share a surface
export const SURFACE_PAD = 8;   // a surface reaches this far past its outer spots, so a lone spot is still somewhere to stand

export interface RoomSurfaces { surfaces: Surface[]; surfaceOf: string[] }   // surfaceOf[i] is the id of the surface of spot i

// width is the cat's width: a spot's x is its left edge, and a cat in motion is placed by its middle.
export function surfacesFromSpots(spots: readonly Spot[], width: number): RoomSurfaces {
  const order = spots.map((_, i) => i).sort((a, b) => spots[a][1] - spots[b][1]);
  const groups: number[][] = [];
  for (const i of order) {
    const g = groups[groups.length - 1];
    if (g && spots[i][1] - spots[g[0]][1] <= SAME_LEVEL) g.push(i); else groups.push([i]);
  }
  const surfaceOf: string[] = [];
  const surfaces = groups.map((g, n): Surface => {
    const centres = g.map((i) => spots[i][0] + width / 2);
    const id = `s${n}`;
    for (const i of g) surfaceOf[i] = id;
    return { id, x0: Math.min(...centres) - SURFACE_PAD, x1: Math.max(...centres) + SURFACE_PAD, y: Math.round(g.reduce((a, i) => a + spots[i][1], 0) / g.length) };
  });
  return { surfaces, surfaceOf };
}
