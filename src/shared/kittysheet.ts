// The kitty sprite sheet drawn in Kitty Gallery, as the game uses it: the sprites and the animations that play them (see Sheet in
// ../pixel/model.ts). ../pixel/live.ts hands it over whenever the Gallery's data is read or changed. An animation that is not there
// (or has no steps) gives null, and the room draws its own kitty instead (see ./pixelcat.ts), so the sheet can be filled in piece by piece.
//
// The sprites are drawn with the Gallery's letters. `s` is the base colour: the kitty's fur, so one sheet dresses every kitty, with
// `l` (lit) and `d` (shaded) mixed from it the way the Gallery's board mixes them; `o` is the dark line every kitty has.
import { defaultGhosts, type Anchor, type Sheet, type Step } from '../pixel/model.ts';
import { runPaths } from './pixelart.ts';
import { toPalette } from './palette.ts';
import { FINE } from './stickers.ts';
import type { CatLook } from './pixelcat.ts';
import { KITTY_ZONES } from './kittyzones-art.ts';

let live: Sheet | null = null;
let version = 0;
const sheetListeners: (() => void)[] = [];
export const onSheetChange = (fn: () => void) => { sheetListeners.push(fn); };   // the sheet loads after the page starts, and changes when it is edited
export function useSheet(sheet: Sheet | null) { live = sheet; version++; for (const fn of sheetListeners) fn(); }
// Changes whenever the sheet does, so a room drawn from it knows to be drawn again.
export const sheetVersion = () => version;
// The size of an animation's sprites (all of them are one size), or null when there is no such animation to play.
// It is the size of what the animation draws, not of the sheet: the empty margin all round is cut off (see boxOf), so a small pose in a
// big sheet is placed and sized as the small pose it is.
export const sheetSize = (anim: string): [number, number] | null => { const b = boxOf(anim); return b ? [b.w, b.h] : null; };
// An animation's name with `@spot` after it is the same animation drawn on the spot: its sprites are not moved, because the room moves the
// kitty by hand (a jump onto the cat tree, see sheetLeap).
const SPOT = '@spot';
const baseOf = (anim: string) => (anim.endsWith(SPOT) ? anim.slice(0, -SPOT.length) : anim);
// The steps that can be played (a step whose sprite is gone is skipped).
const stepsOf = (anim: string) => live?.animations.get(baseOf(anim))?.steps.filter((st) => live!.sprites.has(st.id)) ?? [];
// A walk that goes somewhere is drawn as a loop. Its last step is its first one again, moved on: that is where the NEXT round starts,
// so it is not played twice. A step's move says where the kitty is in the world, counted from the start of the round, so the sprites
// themselves are drawn on the spot and the room moves the kitty (see sheetTravel). With a round of steps 1..n and a closing step that is
// step 1 moved on by `stride`, step i of round r is at r * stride + (its move), so a walk of 1 2 3 1 with moves 0 5 10 | 15 puts step 1 of
// the next round 15 on, step 2 of it at 15 + 5, and the one after the last step of a round is the closing step, 15 on from the first.
function loopOf(anim: string): { cycle: Required<Step>[]; stride: Required<Step> } | null {
  const steps = stepsOf(anim), last = steps[steps.length - 1];
  // The round starts at the first time the last step's drawing is shown: steps before it are a lead-in (getting going), which the room
  // has already played (standing up), so they are not part of the loop.
  const k = steps.findIndex((st) => st.id === last?.id);
  if (steps.length < 3 || k < 0 || k > steps.length - 3 || !(last.dx - steps[k].dx || last.dy - steps[k].dy)) return null;
  const from = steps[k], rel = (st: Step): Required<Step> => ({ id: st.id, dx: st.dx - from.dx, dy: st.dy - from.dy });
  return { cycle: steps.slice(k, -1).map(rel), stride: rel(last) };
}
// What the animation draws: a looping walk is its round, in place; any other animation is its steps, each where its move puts it.
const playOf = (anim: string): Required<Step>[] => {
  if (anim.endsWith(SPOT)) return stepsOf(anim).map((st) => ({ ...st, dx: 0, dy: 0 }));
  const loop = loopOf(anim); return loop ? loop.cycle.map((st) => ({ ...st, dx: 0, dy: 0 })) : stepsOf(anim); };
// ---- where each pose is, from the sitting kitty ----
// Every animation starts from a resting pose (sitting: Idle's first drawing, or standing: the last step of Sit side to stand side) and ends in one,
// and says where that pose is from its first step and from its last (`before`, `after`: forward and up, as a step's move). So a kitty that stands
// up, walks and sits down is drawn where it should be at each change. All of it is in forward/up pixels from where the sitting kitty is drawn.
type Rest = { pose: Anchor; dx: number; dy: number; set: boolean };
const standsUp = () => !!live?.animations.get('sit2stand');
function restOf(anim: string, which: 'before' | 'after'): Rest {
  const base = baseOf(anim), g = live?.animations.get(base)?.[which], pose = g?.pose ?? defaultGhosts(base)[which];
  return { pose: pose === 'stand' && !standsUp() ? 'idle' : pose, dx: g?.dx ?? 0, dy: g?.dy ?? 0, set: !!g };
}
// What the animation starts from and ends in.
export const sheetRests = (anim: string): { before: Anchor; after: Anchor } => ({ before: restOf(anim, 'before').pose, after: restOf(anim, 'after').pose });
const vec = (f: number, u: number) => ({ f, u });
// Where the standing kitty is from the sitting one: where standing up leaves it (its world is where sitting is, less its `before`).
function standAt() {
  const steps = stepsOf('sit2stand'), last = steps[steps.length - 1], b = restOf('sit2stand', 'before'), a = restOf('sit2stand', 'after');
  return last ? vec(-b.dx + last.dx + a.dx, -b.dy + last.dy + a.dy) : vec(0, 0);
}
const restAt = (pose: Anchor) => (pose === 'stand' ? standAt() : vec(0, 0));
// Where the animation's first step is drawn from where the sitting kitty is, and where its last one is: the pose it starts from is at `before`
// from the first step, so the first step is that pose less `before`; the pose it ends in is at `after` from the last step.
// `tail`: a looping walk's last step shown is not its closing one (the closing step is the next round's first), so the pose is that far on.
function placeOf(anim: string, ifSet = false) {
  const b = restOf(anim, 'before'), a = restOf(anim, 'after'), s0 = restAt(b.pose), s1 = restAt(a.pose), loop = loopOf(baseOf(anim));
  const tail = loop ? vec(loop.stride.dx - loop.cycle[loop.cycle.length - 1].dx, loop.stride.dy - loop.cycle[loop.cycle.length - 1].dy) : vec(0, 0);
  const set = b.set || a.set, none = ifSet && !set;   // an animation the sheet says nothing about is placed as before: on the spot
  return { start: none ? vec(0, 0) : vec(s0.f - b.dx, s0.u - b.dy), end: none ? vec(0, 0) : vec(s1.f - a.dx - tail.f, s1.u - a.dy - tail.u), set };
}
// How a looping walk moves the kitty: `at[i]` is how far forward step i of a round is from the first step (in sprite pixels, which are the
// room's pixels), `stride` how far a whole round takes it, `frameMs` how long a step is shown. The kitty is at
// round * stride + at[i] while step i of that round is shown. Null for an animation that does not travel.
export function sheetTravel(anim: string): { at: number[]; stride: number; frameMs: number; start: { f: number; u: number }; end: { f: number; u: number } } | null {
  const loop = loopOf(anim), a = live?.animations.get(anim);
  if (!loop || !a || loop.stride.dx <= 0) return null;
  const { start, end } = placeOf(anim, true);
  return { at: loop.cycle.map((st) => st.dx), stride: loop.stride.dx, frameMs: 1000 / a.fps, start, end };
}
// A jump that goes somewhere: not a loop, and its steps carry the kitty forward. `at[i]` is where step i is, forward and up, from the first
// step (so the last is how far the jump goes), `frameMs` how long a step is shown. Draw it as `<anim>@spot` and move the kitty by hand.
export function sheetLeap(anim: string): { at: { dx: number; dy: number }[]; frameMs: number; start: { f: number; u: number }; end: { f: number; u: number } } | null {
  const a = live?.animations.get(anim), steps = stepsOf(anim);
  if (!a || steps.length < 3 || loopOf(anim) || !(steps[steps.length - 1].dx > 0) || !steps.some((st) => st.dy > 0)) return null;   // it goes up and on
  const { start, end } = placeOf(anim, true);
  return { at: steps.map((st) => ({ dx: st.dx, dy: st.dy })), frameMs: 1000 / a.fps, start, end };
}
// Where a pose is drawn, from the sitting kitty (Idle). Poses that play a sprite that Idle plays are drawn on the same page, so the kitty
// does not shift when it changes from one to the other: `left` is how far its box starts to the right of Idle's (`right`: when it is turned
// the other way), and `top` where it starts from the row the feet stand on. Null for a pose with a page of its own (centre it on the spot).
export function sheetPlace(anim: string): { left: number; right: number; top: number; f: number; u: number } | null {
  const idle = boxOf('idle'), b = boxOf(anim), a = live?.animations.get('idle');
  if (!live || !idle || !b || !a) return null;
  const own = new Set(a.steps.map((st) => st.id));
  if (!(placeOf(anim).set || stepsOf(anim).some((st) => own.has(st.id))) || (!anim.endsWith(SPOT) && sheetLeap(anim))) return null;   // (a jump is placed by the room's own jump, which draws it as @spot)
  const { start } = placeOf(anim);
  return { left: b.x - idle.x, right: idle.x + idle.w - (b.x + b.w), top: b.y - (idle.y + idle.h), f: start.f, u: start.u };
}
// The smallest box that holds every drawn pixel of the animation's steps, each where its move puts it (the same box for every step, so the
// kitty does not jump about). A move is forward (left: the sprites face left) and up.
function boxOf(anim: string): { x: number; y: number; w: number; h: number } | null {
  const steps = playOf(anim);
  if (!live || !steps.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of steps) live.sprites.get(st.id)!.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') {
    x0 = Math.min(x0, x - st.dx); x1 = Math.max(x1, x - st.dx); y0 = Math.min(y0, y - st.dy); y1 = Math.max(y1, y - st.dy); } });
  return x1 < x0 ? { x: 0, y: 0, w: live.w, h: live.h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// How long one round of the animation takes, in milliseconds (null when there is no such animation to play).
export const sheetMs = (anim: string): number | null => {
  const a = live?.animations.get(baseOf(anim)), n = playOf(anim).length;
  return a && n ? Math.round((n / a.fps) * 1000) : null;
};

const OUTLINE = '#3d2c63';
// a of the way to b: `weight` is how much of a (CSS color-mix(a weight%, b)).
const mix = (a: string, b: string, weight: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * weight + parseInt(b.slice(i, i + 2), 16) * (1 - weight)).toString(16).padStart(2, '0')).join('');
// A fixed colour of the Gallery's palette as a hex: the lit and shaded note colours are written as a color-mix() there.
function fine(ch: string): string | undefined {
  const c = FINE[ch] ?? '';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = /^color-mix\(in srgb, (#[0-9a-f]{3,6}) (\d+)%, (#[0-9a-f]{3,6})\)$/i.exec(c);
  const full = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map((x) => x + x).join('') : h);   // #fff is #ffffff
  return m ? mix(full(m[1]), full(m[3]), Number(m[2]) / 100) : undefined;
}
// The skins in Kitty Wardrobe: a kitty's coat is a colour and a pattern, chosen apart. The colours are the older kitty's fur colours.
export const SKIN_COLOURS: { fur: string; name: string }[] = [
  { fur: '#ffb98a', name: 'Peach' }, { fur: '#4b4560', name: 'Charcoal' }, { fur: '#cdc8e0', name: 'Grey' }, { fur: '#fff3d1', name: 'Cream' },
  { fur: '#c99a73', name: 'Tan' }, { fur: '#fffafd', name: 'White' }, { fur: '#e8a04c', name: 'Orange' }, { fur: '#a29bb8', name: 'Slate' },
];
export const SKIN_PATTERNS: { id: CatLook['pattern']; name: string; note: string }[] = [
  { id: 'plain', name: 'Plain', note: 'One colour all over' },
  { id: 'stripes', name: 'Stripes', note: 'Taupe stripes over the colour' },
  { id: 'mask', name: 'Mask', note: 'White muzzle, chest and paws' },
  { id: 'point', name: 'Point', note: 'Pale body, dark ears, face, tail' },
  { id: 'patch', name: 'Patch', note: 'White with patches' },
  { id: 'calico', name: 'Calico', note: 'White with two kinds of patch' },
];
// The sprites are drawn in four coat letters: Wood n, Taupe N, Cream w and Peach lit u. A skin gives each coat pixel a role instead:
// 1 the colour, 2 a pale version of it, 3 a dark version, 4 taupe (the stripes), w white. The pattern says which role, from the letter drawn
// and the part of the body (KITTY_ZONES: H face, E and F ears, T tail, K and J body patches). Where a sprite has no zones (a new one), the parts are not told apart.
export function roleOf(pattern: string, c: string, zone: string): string {
  const dark = 'HEFT'.includes(zone) && zone !== '';
  switch (pattern) {
    case 'stripes': return c === 'N' ? '4' : '1';
    case 'mask': return c === 'w' ? 'w' : '1';
    case 'point': return c === 'w' ? 'w' : dark ? '3' : '2';
    case 'patch': return 'TEK'.includes(zone) && zone !== '' ? '1' : 'w';
    case 'calico': return ({ K: '1', J: '3', T: '1', E: '3', F: '1' } as Record<string, string>)[zone] ?? 'w';
    default: return '1';
  }
}
const recoated = new WeakMap<string[], Map<string, { zones: string[] | undefined; out: string[] }>>();
// `zones`: the sprite's zones when it has been given its own (Kitty Wardrobe); the shipped ones otherwise.
export function recoat(id: string, art: string[], pattern: string, own?: string[]): string[] {
  const zones = own ?? KITTY_ZONES[id];
  const seen = recoated.get(art) ?? new Map<string, { zones: string[] | undefined; out: string[] }>();
  recoated.set(art, seen);
  const hit = seen.get(pattern);
  if (hit && hit.zones === zones) return hit.out;
  const z = zones ?? [];
  const out = art.map((row, y) => [...row].map((c, x) => ('nNwu'.includes(c) ? roleOf(pattern, c, z[y]?.[x] ?? '') : c)).join(''));
  seen.set(pattern, { zones, out });
  return out;
}
// The colour of each letter on a kitty with this fur; undefined for a letter that is not drawn (empty, or one that follows the page).
// With a `pattern` the sheet is dressed as a skin (see recoat), and its outline is the older kitty's dark (umber would not show on a black kitty);
// without one it is shown as drawn (Kitty Wardrobe's Draw tab and the strip export do).
export function inkFor(fur: string, pattern?: string): (ch: string) => string | undefined {
  const base = toPalette(fur);
  const lit = mix(base, '#ffffff', 0.4), shaded = mix(base, '#231d44', 0.7);
  const skin: Record<string, string> = { 1: base, 2: mix(base, '#ffffff', 0.3), 3: mix(base, '#231d44', 0.6), 4: '#8a6a5a' };
  return (ch) => (pattern && ch in skin ? skin[ch] : pattern && ch === '(' ? OUTLINE : ch === 's' ? base : ch === 'l' ? lit : ch === 'd' ? shaded : ch === 'o' ? OUTLINE : ch === 'e' ? '#2b2352' : fine(ch));
}

// One sprite as a skin, for Kitty Wardrobe's zone editor: the sprite alone, cropped to what is drawn, in this pattern and colour and with these zones.
export function skinSpriteSvg(id: string, art: string[], look: CatLook, zones?: string[]): string {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  art.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  if (x1 < 0) return '';
  return `<svg class="sprite sheet" viewBox="${x0} ${y0} ${x1 - x0 + 1} ${y1 - y0 + 1}" aria-hidden="true" shape-rendering="crispEdges">${spritePaths(recoat(id, art, look.pattern, zones), inkFor(look.fur, look.pattern))}</svg>`;
}

// One sprite as paths, a path for each colour.
const spritePaths = (art: string[], ink: (ch: string) => string | undefined) =>
  Object.entries(runPaths(art, (ch) => !!ink(ch))).map(([ch, d]) => `<path fill="${ink(ch)}" d="${d}"/>`).join('');

// The animation as an svg: each step is a group that is shown for its turn (SMIL, no script or CSS needed, so it plays in the room
// and in anything else that draws svg). `still`: only the first step, for pictures that don't move. `seed` starts each kitty
// part-way through, so kitties are not in step with each other. `flip`: turned the other way (the sprites are all drawn facing left). `once`: plays through one time and stays on the last step
// (standing up, sitting down, a jump: the room swaps to the next pose when the time is up, and must not see the loop start again first).
export function sheetCatSvg(anim: string, look: CatLook, kind: 'sit' | 'nap', seed = 0, still = false, flip = false, once = false): string | null {
  const a = live?.animations.get(baseOf(anim));
  if (!live || !a) return null;
  const steps = playOf(anim);
  if (!steps.length) return null;
  const ink = inkFor(look.fur, look.pattern), box = boxOf(anim)!;
  const n = steps.length, moves = n > 1 && !still;
  // A kitty with a seed of its own (not 0) is out of step with the others: its round starts part-way through, and runs a little faster or slower.
  const mixed = (k: number) => (Math.imul((seed ^ (seed >>> 15)) + k * 0x9e3779b9, 2246822519) >>> 0) / 4294967296;
  const dur = (n / a.fps) * (seed ? 1 + (mixed(1) - 0.5) * 0.3 : 1), shift = seed ? mixed(2) * dur : 0;
  const first = Math.min(n - 1, Math.floor((shift / dur) * n));   // the step it starts on: drawn before the animation's clock starts, so the first picture is not another step
  const begin = `${-shift.toFixed(3)}s`;
  const t = (k: number) => String(+(k / n).toFixed(5));
  const groups = (moves ? steps : steps.slice(0, 1)).map((st, k) => {
    const paths = spritePaths(look.pattern ? recoat(st.id, live!.sprites.get(st.id)!, look.pattern, live!.zones.get(st.id)) : live!.sprites.get(st.id)!, ink);
    const body = st.dx || st.dy ? `<g transform="translate(${-st.dx} ${-st.dy})">${paths}</g>` : paths;
    if (!moves) return `<g>${body}</g>`;
    const [values, keyTimes] = k === 0 ? ['visible;hidden', `0;${t(1)}`] : k === n - 1 ? ['hidden;visible', `0;${t(n - 1)}`] : ['hidden;visible;hidden', `0;${t(k)};${t(k + 1)}`];
    return `<g visibility="${k === first ? 'visible' : 'hidden'}">${body}<animate attributeName="visibility" calcMode="discrete" values="${values}" keyTimes="${keyTimes}" dur="${dur}s" begin="${begin}" ${once ? 'repeatCount="1" fill="freeze"' : 'repeatCount="indefinite"'}/></g>`;
  }).join('');
  return `<svg class="sprite ${kind === 'sit' ? 'body' : 'sheetnap'} sheet" style="--w:${box.w}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" aria-hidden="true" shape-rendering="crispEdges">${flip ? `<g transform="translate(${2 * box.x + box.w} 0) scale(-1 1)">${groups}</g>` : groups}</svg>`;
}

// A kitty's picture for cards and profiles: its whole three-quarter view (cut to the pixels it draws), or null when the sheet has none.
export function sheetFaceSvg(look: CatLook, faded = false): string | null {
  const id = live?.animations.get('threeq')?.steps.find((st) => live!.sprites.has(st.id))?.id, art = id ? live!.sprites.get(id) : undefined;
  if (!id || !art) return null;
  const rows = art.map((r, y) => ({ y, r })).filter(({ r }) => /[^.]/.test(r));
  if (!rows.length) return null;
  const y0 = rows[0].y, y1 = rows[rows.length - 1].y;
  let x0 = Infinity, x1 = -Infinity;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < art[y].length; x++) if (art[y][x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  if (x1 < x0) return null;
  const full = look.pattern ? recoat(id, art, look.pattern, live!.zones.get(id)) : art;
  const paths = spritePaths(full, inkFor(look.fur, look.pattern));
  return `<svg class="sprite${faded ? ' faded' : ''}" style="--w:${x1 - x0 + 1}" viewBox="${x0} ${y0} ${x1 - x0 + 1} ${y1 - y0 + 1}" aria-hidden="true" shape-rendering="crispEdges">${paths}</svg>`;
}
