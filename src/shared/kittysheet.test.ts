import { afterEach, describe, expect, it } from 'vitest';
import { emptyData, putIcon, sheetOf, SHEET_ID } from '../pixel/model.ts';
import { applyIcons } from '../pixel/live.ts';
import { OFFICIAL_SHEET } from './kittysheet-art.ts';
import { inkFor, sheetCatSvg, sheetLeap, sheetMs, sheetPlace, sheetRests, sheetSize, sheetTravel, sheetVersion, useSheet } from './kittysheet.ts';

const art = (ch: string) => ['....', `.${ch}${ch}.`, '....'];
const data = () => putIcon(emptyData(), {
  category: 'kitty', id: SHEET_ID, name: 'Kitty sprites', group: 'user', art: art('s'),
  sprites: [{ id: 's1', name: 'A', art: art('s') }, { id: 's2', name: 'B', art: art('o') }, { id: 's3', name: 'C', art: art('l') }],
  animations: [{ id: 'idle', name: 'Idle', fps: 4, steps: ['s1', 's2', 's1', 's3'] }, { id: 'nap', name: 'Nap', fps: 2, steps: ['s3'] }, { id: 'walk', name: 'Walk', fps: 4, steps: [] }],
}, 1);
const look = { fur: '#ffb98a', pattern: 'plain' as const };

describe('the kitty sheet in the game', () => {
  afterEach(() => useSheet(null));

  it('has nothing to draw until the Gallery has a sheet, so the room draws its own kitty', () => {
    expect(sheetCatSvg('idle', look, 'sit')).toBeNull();
    expect(sheetSize('idle')).toBeNull();
  });

  it('is handed over with the Gallery data, and knows which animations it can play', () => {
    const v = sheetVersion();
    applyIcons(data());
    expect(sheetVersion()).toBeGreaterThan(v);
    expect(sheetSize('idle')).toEqual([2, 1]);   // the empty margin is cut off
    expect(sheetSize('nap')).toEqual([2, 1]);
    expect(sheetSize('walk')).toBeNull();   // no steps
    expect(sheetSize('happy')).toBeNull();  // no such animation
    applyIcons(emptyData());
    expect(sheetSize('idle')).toEqual([41, 33]);   // the official sheet
    expect(sheetSize('nap')).not.toBeNull();
  });

  it('dresses every kitty in its own fur (base colour s, with lit and shaded mixed from it)', () => {
    useSheet(sheetOf(data()));
    const orange = sheetCatSvg('idle', look, 'sit', 0)!, grey = sheetCatSvg('idle', { fur: '#4b4560', pattern: 'plain' }, 'sit', 0)!;
    expect(orange).toContain('fill="#ffb98a"');
    expect(orange).not.toContain('fill="#4b4560"');
    expect(grey).toContain('fill="#4b4560"');
    const ink = inkFor('#ffb98a');
    expect(ink('s')).toBe('#ffb98a');
    expect(ink('l')).not.toBe(ink('d'));
    expect(ink('.')).toBeUndefined();
    expect(ink('o')).toBe('#3d2c63');
  });

  it('plays its steps in turn (one group each, shown at its time), and a still picture is just the first step', () => {
    useSheet(sheetOf(data()));
    const svg = sheetCatSvg('idle', look, 'sit', 0)!;
    expect(svg).toContain('viewBox="1 1 2 1"');
    expect(svg.match(/<animate /g)).toHaveLength(4);
    expect(svg).toContain('dur="1s"');            // 4 steps at 4 a second
    expect(svg).toContain('keyTimes="0;0.25"');   // the first step shows for the first quarter
    expect(svg).toContain('keyTimes="0;0.75"');   // the last, for the last quarter
    expect(svg).toContain('keyTimes="0;0.25;0.5"');
    const still = sheetCatSvg('idle', look, 'sit', 0, true)!;
    expect(still).not.toContain('<animate');
    expect(still.match(/<g>/g)).toHaveLength(1);
    expect(sheetCatSvg('nap', look, 'nap', 0)!).not.toContain('<animate');   // one step: nothing to play
    expect(sheetCatSvg('nap', look, 'nap', 0)!).toContain('sheetnap');
  });

  it('plays through once and stays on its last step when asked (standing up, sitting down), instead of starting again', () => {
    useSheet(sheetOf(data()));
    expect(sheetCatSvg('idle', look, 'sit', 0)).toContain('repeatCount="indefinite"');
    const once = sheetCatSvg('idle', look, 'sit', 0, false, false, true)!;
    expect(once).toContain('repeatCount="1" fill="freeze"');
    expect(once).not.toContain('indefinite');
  });

  it('starts each kitty part-way through, by its seed', () => {
    useSheet(sheetOf(data()));
    expect(sheetCatSvg('idle', look, 'sit', 0)).toContain('begin="0s"');
    expect(sheetCatSvg('idle', look, 'sit', 2)).toContain('begin="-0.5s"');
    expect(sheetCatSvg('idle', look, 'sit', 6)).toContain('begin="-0.5s"');
  });
});

describe('the colours of the Gallery palette in the room', () => {
  it('draws the lit and shaded note colours (they are written as a color-mix in the palette)', () => {
    const ink = inkFor('#ffb98a');
    for (const ch of 'uUpPjJ') expect(ink(ch), ch).toMatch(/^#[0-9a-f]{6}$/);
    expect(ink('u')).toBe('#ffe3d0');   // #ffb98a 40% with white
  });
});

describe('how long an animation takes', () => {
  it('is its steps over its speed, in milliseconds', () => {
    applyIcons(data());
    expect(sheetMs('idle')).toBe(1000);   // 4 steps at 4 per second
    expect(sheetMs('walk')).toBeNull();   // no steps
    expect(sheetMs('happy')).toBeNull();
  });
});

describe('a kitty turned the other way', () => {
  it('is the same drawing mirrored about its own middle', () => {
    applyIcons(data());
    const plain = sheetCatSvg('idle', look, 'sit', 0, true)!, flipped = sheetCatSvg('idle', look, 'sit', 0, true, true)!;
    expect(plain).not.toContain('scale(-1 1)');
    expect(flipped).toContain('transform="translate(4 0) scale(-1 1)"');   // box x 1, width 2: x becomes 4 - x
    expect(flipped.replace(/<g transform="[^"]*">/, '').replace('</g></svg>', '</svg>')).toBe(plain);
  });
});

describe('a step that moves its sprite', () => {
  const moved = () => putIcon(emptyData(), {
    category: 'kitty', id: SHEET_ID, name: 'Kitty sprites', group: 'user', art: art('s'),
    sprites: [{ id: 's1', name: 'A', art: art('s') }, { id: 's2', name: 'B', art: art('o') }],
    animations: [{ id: 'idle', name: 'Idle', fps: 4, steps: [{ id: 's1' }, { id: 's2', dx: 3, dy: 2 }] }],
  }, 1);
  it('draws it forward (left) and up, and the box holds every step where it is played', () => {
    applyIcons(moved());
    // the sprite is at x 1-2, y 1; at dx 3, dy 2 it is at x -2..-1, y -1
    expect(sheetSize('idle')).toEqual([5, 3]);
    const svg = sheetCatSvg('idle', look, 'sit')!;
    expect(svg).toContain('viewBox="-2 -1 5 3"');
    expect(svg).toContain('<g transform="translate(-3 -2)">');
    expect(sheetCatSvg('idle', look, 'sit', 0, true)).not.toContain('translate(-3 -2)');   // a still picture is the first step, which does not move
  });
  it('mirrors the whole box when the kitty is turned the other way, so it moves forward the other way', () => {
    applyIcons(moved());
    expect(sheetCatSvg('idle', look, 'sit', 0, false, true)).toContain('transform="translate(1 0) scale(-1 1)"');   // about the middle of the box (x -2 to 3): 2 * -2 + 5
  });
});

describe('a walk that goes somewhere', () => {
  const loop = (closing: { dx?: number; dy?: number } | null) => putIcon(emptyData(), {
    category: 'kitty', id: SHEET_ID, name: 'Kitty sprites', group: 'user', art: art('s'),
    sprites: [{ id: 's1', name: 'A', art: art('s') }, { id: 's2', name: 'B', art: art('o') }, { id: 's3', name: 'C', art: art('l') }],
    animations: [{ id: 'walk', name: 'Walk', fps: 6, steps: [{ id: 's1' }, { id: 's2', dx: 5 }, { id: 's3', dx: 10 }, ...(closing ? [{ id: 's1', ...closing }] : [])] }],
  }, 1);
  it('ends on its first step again, which is where the next round starts, so that step is not played twice', () => {
    applyIcons(loop({ dx: 15 }));
    expect(sheetTravel('walk')).toEqual({ at: [0, 5, 10], stride: 15, frameMs: 1000 / 6, start: { f: 0, u: 0 }, end: { f: 0, u: 0 } });
    expect(sheetMs('walk')).toBe(500);   // three steps at 6 a second, not four
    expect(sheetCatSvg('walk', look, 'sit', 0)!.match(/<animate /g)).toHaveLength(3);
  });
  it('is drawn on the spot, because the room moves the kitty', () => {
    applyIcons(loop({ dx: 15 }));
    expect(sheetCatSvg('walk', look, 'sit', 0)).not.toContain('translate(-');
    expect(sheetSize('walk')).toEqual([2, 1]);
  });
  it('puts step i of round r at r * stride + its move: 5 on from the first step is the second, and the next round starts 15 on', () => {
    applyIcons(loop({ dx: 15 }));
    const tv = sheetTravel('walk')!;
    const at = (j: number) => Math.floor(j / tv.at.length) * tv.stride + tv.at[j % tv.at.length];
    expect([0, 1, 2, 3, 4, 5, 6].map(at)).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });
  it('is an ordinary animation when its last step is not its first again, or goes nowhere', () => {
    applyIcons(loop(null));
    expect(sheetTravel('walk')).toBeNull();
    applyIcons(loop({}));
    expect(sheetTravel('walk')).toBeNull();
    expect(sheetMs('walk')).toBe(667);   // four steps
  });
});

describe('a pose on the sitting kitty\'s page, and a jump', () => {
  // idle plays s1 (x 3-4 of 10); standing up plays s1 and s2 (wider, starts further left); the jump is s3 moved on and up, and ends sitting
  const row = (a: number, b: number) => Array.from({ length: 10 }, (_, x) => (x >= a && x <= b ? 's' : '.')).join('');
  const pic = (a: number, b: number) => [row(a, b), row(a, b)];
  const sheet = () => putIcon(emptyData(), {
    category: 'kitty', id: SHEET_ID, name: 'Kitty sprites', group: 'user', art: pic(3, 4),
    sprites: [{ id: 's1', name: 'A', art: pic(3, 4) }, { id: 's2', name: 'B', art: pic(0, 4) }, { id: 's3', name: 'C', art: pic(5, 8) }],
    animations: [
      { id: 'idle', name: 'Idle', fps: 4, steps: [{ id: 's1' }, { id: 's1' }] },
      { id: 'standup', name: 'Up', fps: 4, steps: [{ id: 's1' }, { id: 's2' }] },
      { id: 'nap', name: 'Nap', fps: 2, steps: [{ id: 's3' }] },
      { id: 'jump', name: 'Jump', fps: 6, steps: [{ id: 's3' }, { id: 's3', dx: 4, dy: 3 }, { id: 's3', dx: 8, dy: 3 }, { id: 's1', dx: 10 }] },
    ],
  }, 1);
  it('is drawn where Idle is, so the kitty does not shift when one gives way to the other', () => {
    applyIcons(sheet());
    expect(sheetPlace('idle')).toEqual({ left: 0, right: 0, top: -2, f: 0, u: 0 });
    expect(sheetPlace('standup')).toEqual({ left: -3, right: 0, top: -2, f: 0, u: 0 });   // starts 3 left of Idle, ends where it ends
    expect(sheetPlace('nap')).toBeNull();   // its own page: the room centres it
  });
  it('is a leap when it carries the kitty on and up, played on the spot with the room moving it', () => {
    applyIcons(sheet());
    expect(sheetLeap('jump')).toEqual({ at: [{ dx: 0, dy: 0 }, { dx: 4, dy: 3 }, { dx: 8, dy: 3 }, { dx: 10, dy: 0 }], frameMs: 1000 / 6, start: { f: 0, u: 0 }, end: { f: 0, u: 0 } });
    expect(sheetLeap('idle')).toBeNull();
    expect(sheetLeap('standup')).toBeNull();
    expect(sheetSize('jump@spot')).toEqual([6, 2]);   // the pictures where they are drawn (x 3 to 8), not moved
    expect(sheetCatSvg('jump@spot', look, 'sit', 0)).not.toContain('translate(-');
    expect(sheetCatSvg('jump', look, 'sit', 0)).toContain('translate(-4 -3)');
    expect(sheetMs('jump@spot')).toBe(667);
  });
});

describe('the pose before and after an animation', () => {
  const sheet = (ghosts: Record<string, object>) => putIcon(emptyData(), {
    category: 'kitty', id: SHEET_ID, name: 'Kitty sprites', group: 'user', art: art('s'),
    sprites: [{ id: 's1', name: 'A', art: art('s') }, { id: 's2', name: 'B', art: art('o') }, { id: 's3', name: 'C', art: art('l') }],
    animations: [
      { id: 'idle', name: 'Idle', fps: 4, steps: [{ id: 's1' }] },
      { id: 'sit2stand', name: 'Up', fps: 4, steps: [{ id: 's1' }, { id: 's2', dx: 5 }] },
      { id: 'walk', name: 'Walk', fps: 6, steps: [{ id: 's3' }, { id: 's2', dx: 4 }, { id: 's1', dx: 8 }, { id: 's3', dx: 12 }], ...ghosts.walk },
      { id: 'jump', name: 'Jump', fps: 6, steps: [{ id: 's3' }, { id: 's2', dx: 10, dy: 6 }, { id: 's1', dx: 20 }], ...ghosts.jump },
    ],
  }, 1);
  it('is sitting or standing: a walk goes from standing to standing, a jump from sitting to sitting, unless it says', () => {
    applyIcons(sheet({}));
    expect(sheetRests('walk')).toEqual({ before: 'stand', after: 'stand' });
    expect(sheetRests('jump')).toEqual({ before: 'idle', after: 'idle' });
    applyIcons(sheet({ jump: { before: { pose: 'stand' }, after: { pose: 'stand' } } }));
    expect(sheetRests('jump')).toEqual({ before: 'stand', after: 'stand' });
  });
  it('is placed where the sheet says: the first step is the pose it starts from less its move, and standing is where standing up leaves the kitty', () => {
    applyIcons(sheet({ jump: { before: { pose: 'idle', dx: 3, dy: -2 }, after: { pose: 'stand', dx: 1 } } }));
    const lp = sheetLeap('jump')!;
    expect(lp.start).toEqual({ f: -3, u: 2 });   // sitting is 3 forward and 2 down from the first step, so the first step is 3 back and 2 up of it
    expect(lp.end).toEqual({ f: 5 - 1, u: 0 });   // standing is at 5 forward of sitting (standing up moved it 5), and 1 forward of the last step
  });
  it('is on the spot (as before) for an animation that says nothing', () => {
    applyIcons(sheet({}));
    expect(sheetTravel('walk')).not.toBeNull();
    expect(sheetLeap('jump')!.start).toEqual({ f: 0, u: 0 });
  });

  it('dresses the kitty as a skin: a pattern of roles, and a colour for each role', async () => {
    const { roleOf, recoat, SKIN_PATTERNS } = await import('./kittysheet.ts');
    const { KITTY_ZONES } = await import('./kittyzones-art.ts');
    const plain = inkFor('#ffb98a', 'plain'), drawn = inkFor('#ffb98a');
    expect(plain('1')).toBe('#ffb98a');
    expect(plain('4')).toBe('#8a6a5a');
    expect(plain('(')).toBe('#3d2c63');   // the older kitty's dark outline
    expect(drawn('(')).not.toBe('#3d2c63');   // no pattern: the sheet as drawn
    expect(roleOf('plain', 'N', 'T')).toBe('1');
    expect(roleOf('stripes', 'N', '')).toBe('4');
    expect(roleOf('stripes', 'n', '')).toBe('1');
    expect(roleOf('mask', 'w', '')).toBe('w');
    expect(roleOf('point', 'n', 'T')).toBe('3');   // dark tail, pale body, white stays white
    expect(roleOf('point', 'n', 'b')).toBe('2');
    expect(roleOf('point', 'w', 'H')).toBe('w');
    expect(roleOf('patch', 'n', 'K')).toBe('1');
    expect(roleOf('patch', 'n', 'b')).toBe('w');
    expect(roleOf('calico', 'n', 'J')).toBe('3');
    // the zones are as big as the sprites, and every pattern keeps the outline and the sprite's size
    const art = OFFICIAL_SHEET.sprites[0].art;
    expect(KITTY_ZONES[OFFICIAL_SHEET.sprites[0].id].length).toBeLessThanOrEqual(art.length);
    for (const p of SKIN_PATTERNS) {
      const out = recoat(OFFICIAL_SHEET.sprites[0].id, art, p.id);
      expect(out.map((r) => r.length)).toEqual(art.map((r) => r.length));
      expect(out.join('').split('(').length).toBe(art.join('').split('(').length);
    }
  });
});
