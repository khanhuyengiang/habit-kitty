import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACE_HALF, PATTERNS, SIT_HALF, WIDTH, bodySvg, faceSvg, lookOf, randomLook, notifyIconName, NOTIFY_FACES, FURS, type Face } from './pixelcat.ts';

const FACES: Face[] = ['open', 'happy', 'sleepy', 'sad', 'starving', 'dead'];
const look = { fur: '#ffb98a', pattern: 'plain' as const };

describe('pixel cats', () => {
  it('has templates that are 14 columns wide on every row', () => {
    for (const row of [...FACE_HALF, ...SIT_HALF]) expect(row).toHaveLength(14);
    expect(WIDTH).toBe(27);
  });
  it('draws every face and pattern, for both the face and the sitting cat', () => {
    for (const f of FACES) { expect(faceSvg(f, look)).toContain('<rect'); expect(bodySvg(f, look)).toContain('<rect'); }
    for (const p of PATTERNS) {
      expect(faceSvg('open', { ...look, pattern: p })).toContain('<svg');
      expect(bodySvg('open', { ...look, pattern: p })).toContain('<svg');
    }
  });
  it('gives the sitting cat a swishing tail, and a blink only when the eyes are open', () => {
    expect(bodySvg('open', look)).toContain('class="blink"');
    expect(bodySvg('sleepy', look)).not.toContain('class="blink"');
    expect(bodySvg('open', look)).toContain('tail a');
  });
  it('colours calico patches differently on each side', () => {
    const svg = faceSvg('open', { fur: '#fffafc', pattern: 'calico' });
    expect(svg).toContain('#6b4a45');
    expect(svg).toContain('#ffb06a');
  });
  it('derives a stable personality for cats saved before looks existed', () => {
    expect(lookOf({ id: 'mochi' })).toEqual(lookOf({ id: 'mochi' }));
    expect(lookOf({ id: 'mochi' }).trait).toBeTruthy();
    expect(lookOf({ id: 'x', look: { ...look, trait: 'lazy' } }).trait).toBe('lazy');
  });
  it('gives calico and point cats a base coat that suits the pattern', () => {
    for (let i = 0; i < 60; i++) {
      const l = randomLook();
      if (l.pattern === 'calico') expect(l.fur).toBe('#fffafc');
      if (l.pattern === 'point') expect(l.fur).toBe('#f8eadb');
    }
  });
});

describe('notification icons', () => {
  it('names a resource per base fur and face, falling back for unusual furs', () => {
    expect(notifyIconName({ fur: FURS[3], pattern: 'plain' }, 'sad')).toBe('notif_3_sad');
    expect(notifyIconName({ fur: '#123456', pattern: 'plain' }, 'happy')).toBe('notif_5_happy');
    expect(notifyIconName(look, 'sleepy')).toBe('notif_0_open');
    expect(NOTIFY_FACES).toContain('starving');
  });
  it('has a drawn PNG for every fur and face (run `npm run icons` if this fails)', () => {
    FURS.forEach((_, i) => NOTIFY_FACES.forEach((f) => expect(existsSync(`android/app/src/main/res/drawable-nodpi/notif_${i}_${f}.png`)).toBe(true)));
  });
});
