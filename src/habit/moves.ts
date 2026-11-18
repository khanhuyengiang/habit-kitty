// How cats get around the house: they run along whatever they are standing on and jump between surfaces
// (floor, sofa, scratching post, shelf...). Pure logic, no drawing: each tick a CatMover says where the cat is,
// whether it is running, jumping or standing still, and which sprite frame to show. cats.ts draws that frame.
//
// Units are room pixels, the same pixels the sprites are drawn in; y grows downwards like the screen.

// Something a cat can stand on. x0..x1 is the walkable span and y the line the paws stand on.
export interface Surface { id: string; x0: number; x1: number; y: number }

export type JumpMode = 'low' | 'medium' | 'high';
export const JUMP_MODE_NAMES: JumpMode[] = ['low', 'medium', 'high'];

// EDIT ME: how each kind of jump feels.
//   maxRise  the highest step up this jump can make (a drop down counts half, cats jump down easily). The room's
//            tallest step from one spot to the next is 74 pixels, so a high jump has to clear that.
//   reach    the widest gap it can clear sideways
//   arc      how far above the higher end the leap peaks
//   air      time in the air (ms) for a full-reach jump; shorter hops are a little quicker
//   crouch   wind-up before take-off (ms)        land   time spent soaking up the landing (ms)
//   flight   when in the air [take-off ends, flight ends] as fractions of the air time; a low hop skips the
//            stretched-out flight frame and goes straight from take-off to descent
export interface JumpSpec { maxRise: number; reach: number; arc: number; air: number; crouch: number; land: number; flight: [number, number] }
export const JUMP_MODES: Record<JumpMode, JumpSpec> = {
  low:    { maxRise: 14, reach: 44, arc: 6,  air: 360, crouch: 90,  land: 110, flight: [0.5, 0.5] },
  medium: { maxRise: 34, reach: 70, arc: 14, air: 520, crouch: 140, land: 140, flight: [0.3, 0.62] },
  high:   { maxRise: 76, reach: 96, arc: 24, air: 700, crouch: 200, land: 170, flight: [0.25, 0.7] },
};

export const RUN_SPEED = 70;   // room pixels per second while running
export const RUN_STRIDE = 7;   // pixels of ground covered per run frame, so the paws don't skate
export const MIN_HOP = 14;     // even a straight up-or-down jump drifts this far sideways, so the arc reads

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// How far up the jump goes (a drop counts half) and how wide the gap is.
function effort(from: Surface, to: Surface) {
  const rise = from.y - to.y;
  const gap = Math.max(0, to.x0 - from.x1, from.x0 - to.x1);
  return { up: rise > 0 ? rise : -rise / 2, gap };
}

// The gentlest jump that makes it from one surface to the other, or null if even a high jump can't.
export function jumpModeFor(from: Surface, to: Surface): JumpMode | null {
  const { up, gap } = effort(from, to);
  return JUMP_MODE_NAMES.find((m) => up <= JUMP_MODES[m].maxRise && gap <= JUMP_MODES[m].reach) ?? null;
}

// The surfaces to hop through to get from one to another (both ends included), fewest jumps first.
// Null if there is no way there, e.g. a shelf too high to reach from anything.
export function routeBetween(surfaces: Surface[], fromId: string, toId: string): Surface[] | null {
  const byId = new Map(surfaces.map((s) => [s.id, s]));
  const prev = new Map<string, string | null>([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift()!;
    if (id === toId) break;
    for (const next of surfaces) {
      if (prev.has(next.id) || !jumpModeFor(byId.get(id)!, next)) continue;
      prev.set(next.id, id);
      queue.push(next.id);
    }
  }
  if (!prev.has(toId)) return null;
  const path: Surface[] = [];
  for (let id: string | null = toId; id !== null; id = prev.get(id) ?? null) path.unshift(byId.get(id)!);
  return path;
}

type Step =
  | { kind: 'run'; x: number }
  | { kind: 'jump'; to: Surface; x: number; mode: JumpMode };

// Where to leave one surface and land on the next: the closest edges if they are apart,
// or straight up/down with a small sideways drift if one is above the other.
function hopPoints(from: Surface, to: Surface, fromX: number, goalX: number) {
  if (to.x0 > from.x1) return { takeoff: from.x1 - 2, landing: to.x0 + 4 };
  if (to.x1 < from.x0) return { takeoff: from.x0 + 2, landing: to.x1 - 4 };
  const takeoff = clamp(clamp(goalX, to.x0, to.x1), from.x0, from.x1);
  const dir = goalX >= fromX ? 1 : -1;
  let landing = clamp(takeoff + dir * MIN_HOP, to.x0 + 2, to.x1 - 2);
  if (Math.abs(landing - takeoff) < MIN_HOP / 2) landing = clamp(takeoff - dir * MIN_HOP, to.x0 + 2, to.x1 - 2);
  return { takeoff, landing };
}

export interface Pose {
  x: number; y: number;               // where the paws are, in room pixels
  anim: 'idle' | 'run' | 'jump';      // which sprite set to draw: idle is yours (e.g. the sitting cat)
  frame: number;                      // frame of that set: run 0-3, jump 0 crouch, 1 take-off, 2 flight, 3 descent, 4 landing
  flip: boolean;                      // true when facing left
  mode: JumpMode | null;              // the jump being made, while jumping
  surface: string;                    // what the cat is standing on (the one it is jumping to, mid-air)
}

export class CatMover {
  private steps: Step[] = [];
  private t = 0;                      // time spent on the current jump (ms)
  private ran = 0;                    // ground covered while running, for the stride
  private from = { x: 0, y: 0 };
  private surfaces: Surface[];
  private forced: JumpMode | null;
  speed = 1;                          // how fast it runs, as a multiple of RUN_SPEED (zoomies race)
  pose: Pose;

  constructor(surfaces: Surface[], start: { surface: string; x: number }, forced: JumpMode | null = null) {
    this.surfaces = surfaces;
    this.forced = forced;
    const s = this.find(start.surface);
    this.pose = { x: clamp(start.x, s.x0, s.x1), y: s.y, anim: 'idle', frame: 0, flip: false, mode: null, surface: s.id };
  }

  private find(id: string) {
    const s = this.surfaces.find((x) => x.id === id);
    if (!s) throw new Error(`no surface called ${id}`);
    return s;
  }

  get busy() { return this.steps.length > 0; }

  // Use one jump mode for every jump (e.g. a lazy cat that only hops low), or null to pick the gentlest that makes it.
  // A forced mode is still used only when it can make the jump; a harder jump falls back to the mode that can.
  forceMode(mode: JumpMode | null) { this.forced = mode; }

  // Head for a spot on a surface, running and jumping (through other surfaces if needed). False if it can't get there.
  // Called mid-jump, the cat finishes the leap first and plans the rest from where it lands.
  goTo(surfaceId: string, x: number): boolean {
    const current = this.steps[0];
    const keep = current?.kind === 'jump' && this.t > 0 ? current : null;
    const route = routeBetween(this.surfaces, keep ? keep.to.id : this.pose.surface, surfaceId);
    if (!route) return false;
    const steps: Step[] = keep ? [keep] : [];
    let here = keep ? keep.x : this.pose.x;
    for (let i = 0; i + 1 < route.length; i++) {
      const a = route[i], b = route[i + 1];
      const goal = i + 2 < route.length ? (route[i + 2].x0 + route[i + 2].x1) / 2 : x;
      const { takeoff, landing } = hopPoints(a, b, here, goal);
      const needed = jumpModeFor(a, b)!;
      const mode = this.forced && JUMP_MODE_NAMES.indexOf(this.forced) >= JUMP_MODE_NAMES.indexOf(needed) ? this.forced : needed;
      steps.push({ kind: 'run', x: takeoff }, { kind: 'jump', to: b, x: landing, mode });
      here = landing;
    }
    const last = route[route.length - 1];
    steps.push({ kind: 'run', x: clamp(x, last.x0, last.x1) });
    this.steps = steps;
    if (!keep) this.t = 0;
    return true;
  }

  // Stop where it is. Mid-jump it still lands first (a cat can't stop in the air).
  stop() {
    const current = this.steps[0];
    if (current?.kind === 'jump' && this.t > 0) { this.steps = [current]; return; }
    this.steps = [];
    this.pose = { ...this.pose, anim: 'idle', frame: 0, mode: null };
  }

  // Advance by dt milliseconds and return the new pose.
  update(dt: number): Pose {
    let left = dt;
    while (left > 0 && this.steps.length) left = this.advance(this.steps[0], left);
    if (!this.steps.length && this.pose.anim !== 'idle') this.pose = { ...this.pose, anim: 'idle', frame: 0, mode: null };
    return this.pose;
  }

  // Works on one step; returns the time left over once that step is done (0 if it is still going).
  private advance(step: Step, dt: number): number {
    const p = this.pose;
    if (step.kind === 'run') {
      const rate = RUN_SPEED * this.speed, dx = step.x - p.x, move = (rate * dt) / 1000;
      if (Math.abs(dx) <= move) {
        this.ran += Math.abs(dx);
        this.pose = { ...p, x: step.x, anim: 'run', frame: Math.floor(this.ran / RUN_STRIDE) % 4, flip: dx === 0 ? p.flip : dx < 0, mode: null };
        this.steps.shift();
        return dt - (Math.abs(dx) / rate) * 1000;
      }
      this.ran += move;
      this.pose = { ...p, x: p.x + Math.sign(dx) * move, anim: 'run', frame: Math.floor(this.ran / RUN_STRIDE) % 4, flip: dx < 0, mode: null };
      return 0;
    }
    const spec = JUMP_MODES[step.mode];
    if (this.t === 0) this.from = { x: p.x, y: p.y };
    const dist = Math.hypot(step.x - this.from.x, step.to.y - this.from.y);
    const air = spec.air * (0.7 + 0.3 * Math.min(1, dist / spec.reach));
    const total = spec.crouch + air + spec.land;
    const t = Math.min(this.t + dt, total);
    const flip = step.x === this.from.x ? p.flip : step.x < this.from.x;
    let x = this.from.x, y = this.from.y, frame = 0, surface = p.surface;
    if (t >= spec.crouch + air) {                       // landed
      x = step.x; y = step.to.y; frame = 4; surface = step.to.id;
    } else if (t > spec.crouch) {                       // in the air: a straight line plus a bump for the arc
      const u = (t - spec.crouch) / air;
      const bump = spec.arc + Math.abs(this.from.y - step.to.y) / 2;
      x = this.from.x + (step.x - this.from.x) * u;
      y = this.from.y + (step.to.y - this.from.y) * u - bump * 4 * u * (1 - u);
      frame = u < spec.flight[0] ? 1 : u < spec.flight[1] ? 2 : 3;
      surface = step.to.id;
    }
    this.pose = { x, y, anim: 'jump', frame, flip, mode: step.mode, surface };
    if (t >= total) {
      const over = this.t + dt - total;
      this.t = 0;
      this.steps.shift();
      return Math.max(0, over);
    }
    this.t = t;
    return 0;
  }
}
