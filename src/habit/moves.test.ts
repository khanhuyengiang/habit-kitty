import { describe, expect, it } from 'vitest';
import { CatMover, JUMP_MODES, jumpModeFor, routeBetween, type Surface } from './moves.ts';
import { surfacesFromSpots } from './surfaces.ts';
import { OFFICIAL_ROOM_SPOTS } from '../shared/scene.ts';

const floor: Surface = { id: 'floor', x0: 0, x1: 200, y: 300 };
const rug: Surface = { id: 'rug', x0: 60, x1: 100, y: 290 };
const sofa: Surface = { id: 'sofa', x0: 120, x1: 180, y: 270 };
const tree: Surface = { id: 'tree', x0: 190, x1: 220, y: 200 };

describe('jumpModeFor', () => {
  it('picks the gentlest jump that makes it', () => {
    expect(jumpModeFor(floor, rug)).toBe('low');
    expect(jumpModeFor(floor, sofa)).toBe('medium');
    expect(jumpModeFor(sofa, tree)).toBe('high');
  });
  it('is null when even a high jump cannot make it', () => {
    expect(jumpModeFor(floor, { id: 'x', x0: 0, x1: 10, y: 300 - JUMP_MODES.high.maxRise - 1 })).toBeNull();
    expect(jumpModeFor(floor, { id: 'x', x0: 400, x1: 410, y: 300 })).toBeNull();
  });
  it('lets a cat drop further than it can climb', () => {
    expect(jumpModeFor({ ...sofa, y: 300 - JUMP_MODES.low.maxRise * 2 }, floor)).toBe('low');
  });
});

describe('CatMover', () => {
  const run = (m: CatMover, ms = 20000) => { const modes = new Set<string>(); const anims = new Set<string>(); for (let t = 0; t < ms && m.busy; t += 16) { const p = m.update(16); if (m.busy) anims.add(p.anim); if (p.mode) modes.add(p.mode); } return { modes, anims }; };
  it('runs along a surface', () => {
    const m = new CatMover([floor], { surface: 'floor', x: 10 });
    expect(m.goTo('floor', 150)).toBe(true);
    const { anims } = run(m);
    expect([...anims]).toEqual(['run']);
    expect(m.pose.x).toBe(150);
    expect(m.busy).toBe(false);
  });
  it('jumps between surfaces and lands on the target', () => {
    const m = new CatMover([floor, rug, sofa, tree], { surface: 'floor', x: 10 });
    expect(m.goTo('tree', 205)).toBe(true);
    const { modes, anims } = run(m);
    expect(anims.has('jump')).toBe(true);
    expect(modes.has('high')).toBe(true);
    expect(m.pose).toMatchObject({ surface: 'tree', y: 200, x: 205 });
  });
  it('shows every jump frame in order, then the landing', () => {
    const m = new CatMover([floor, sofa], { surface: 'floor', x: 140 });
    m.goTo('sofa', 150);
    const frames: number[] = [];
    for (let t = 0; t < 4000 && m.busy; t += 8) { const p = m.update(8); if (p.anim === 'jump' && frames[frames.length - 1] !== p.frame) frames.push(p.frame); }
    expect(frames).toEqual([0, 1, 2, 3, 4]);
  });
  it('says no when there is no way there', () => {
    const m = new CatMover([floor, { id: 'far', x0: 900, x1: 920, y: 300 }], { surface: 'floor', x: 10 });
    expect(m.goTo('far', 910)).toBe(false);
    expect(m.busy).toBe(false);
  });
  it('runs faster when asked to', () => {
    const time = (speed: number) => { const m = new CatMover([floor], { surface: 'floor', x: 0 }); m.speed = speed; m.goTo('floor', 140); let t = 0; while (m.busy) { m.update(10); t += 10; } return t; };
    expect(time(2)).toBeLessThan(time(1) * 0.6);
  });
  it('can be forced to use a higher jump than it needs', () => {
    const m = new CatMover([floor, rug], { surface: 'floor', x: 70 }, 'high');
    m.goTo('rug', 80);
    expect(run(m).modes).toEqual(new Set(['high']));
  });
});

describe('the room', () => {
  it('lets a cat get from the floor to every kitty spot', () => {
    const { surfaces, surfaceOf } = surfacesFromSpots(OFFICIAL_ROOM_SPOTS, 30);
    OFFICIAL_ROOM_SPOTS.forEach((_, from) => OFFICIAL_ROOM_SPOTS.forEach((__, to) => {
      expect(surfaceOf[from] === surfaceOf[to] || routeBetween(surfaces, surfaceOf[from], surfaceOf[to]), `${from} -> ${to}`).toBeTruthy();
    }));
  });
  it('puts spots at the same height on one surface, a cat wide on each side', () => {
    const { surfaces, surfaceOf } = surfacesFromSpots([[10, 100], [80, 104], [40, 200]], 30);
    expect(surfaces).toHaveLength(2);
    expect(surfaceOf[0]).toBe(surfaceOf[1]);
    expect(surfaceOf[2]).not.toBe(surfaceOf[0]);
    const top = surfaces.find((s) => s.id === surfaceOf[0])!;
    expect(top.x0).toBeLessThan(25);
    expect(top.x1).toBeGreaterThan(95);
  });
});
