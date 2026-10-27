import { describe, expect, it } from 'vitest';
import { BOOK_ART, FOODS, ICONS, MARKS, PAL, ROOM_H, ROOM_W, TROPHY_ART, artSvg, iconSvg, outdoorSvg, roomSvg } from './pixelart.ts';
import { BODY_H, BODY_W, FACE_W, FURS, MINI_W, PATTERNS, bodySvg, faceSvg, miniSvg, popperSvg } from './pixelcat.ts';

const arts: Record<string, string[]> = { book: BOOK_ART, trophy: TROPHY_ART, ...Object.fromEntries(Object.entries(FOODS)), ...MARKS };

describe('one pixel grid', () => {
  it('draws every picture as full rows of known palette letters', () => {
    for (const [name, art] of Object.entries(arts)) {
      const w = art[0].length;
      art.forEach((row) => { expect(row.length, name).toBe(w); [...row].forEach((ch) => expect(ch === '.' || PAL[ch] !== undefined || 'rwo'.includes(ch), `${name} ${ch}`).toBe(true)); });
    }
  });

  it('draws icons as rectangular one-colour art', () => {
    for (const [name, art] of Object.entries(ICONS)) {
      art.forEach((row) => { expect(row.length, name).toBe(art[0].length); expect(row).toMatch(/^[.o]+$/); });
    }
  });

  it('sizes svgs by their column and row counts (CSS multiplies them by --px)', () => {
    expect(artSvg(BOOK_ART)).toContain(`--w:${BOOK_ART[0].length};--h:${BOOK_ART.length}`);
    expect(iconSvg('x')).toContain('--w:5;--h:5');
  });

  it('sizes each cat from its own art', () => {
    expect(faceSvg('open', { fur: FURS[0], pattern: 'plain' })).toContain(`viewBox="2 0 ${FACE_W} 15"`);
    expect(bodySvg('open', { fur: FURS[0], pattern: 'plain' })).toContain(`viewBox="0 0 ${BODY_W} ${BODY_H}"`);
    PATTERNS.forEach((pattern) => expect(miniSvg('happy', { fur: FURS[0], pattern })).toContain(`viewBox="0 0 ${MINI_W} 10"`));
    expect(popperSvg()).toContain('viewBox="0 0 13 10"');
  });

  it('draws the room only with whole-pixel rectangles', () => {
    for (const phase of ['day', 'dusk', 'night'] as const) {
      for (const svg of [roomSvg(phase), outdoorSvg(phase)]) {
        expect(svg).toContain(`viewBox="0 0 ${ROOM_W} ${ROOM_H}"`);
        expect(svg).not.toMatch(/<(circle|ellipse|path|line)\b/);
        for (const m of svg.matchAll(/<rect x="([^"]*)" y="([^"]*)" width="([^"]*)" height="([^"]*)"/g)) {
          m.slice(1).forEach((v) => expect(Number.isInteger(Number(v)), `${phase} rect ${m[0]}`).toBe(true));
        }
      }
    }
  });
});

describe('napping cat', () => {
  it('draws at its own pixel size for every coat, and shares the sitting cat colour slots', async () => {
    const { napSvg, NAP, NAP_W, NAP_H } = await import('./pixelcat.ts');
    NAP.forEach((row, i) => expect(row.length, `nap row ${i}`).toBeLessThanOrEqual(NAP_W));
    for (const pattern of PATTERNS) {
      const svg = napSvg({ fur: FURS[0], pattern });
      expect(svg).toContain(`viewBox="0 0 ${NAP_W} ${NAP_H}"`);
      expect(svg).not.toContain('undefined');
    }
    expect(NAP_H).toBe(NAP.length);
  });
});
