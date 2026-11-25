import { describe, expect, it } from 'vitest';
import { ANIM_OF, FACINGS, flipOf, sideFacing, sideOf, turnPath } from './facing.ts';

describe('how a kitty turns', () => {
  it('turns through its neighbours, never in one go', () => {
    expect(turnPath('F', 'SL')).toEqual(['F', 'TL', 'SL']);
    expect(turnPath('F', 'SR')).toEqual(['F', 'TR', 'SR']);
    expect(turnPath('B', 'SR')).toEqual(['B', 'TR', 'SR']);
    expect(turnPath('SL', 'SR')).toEqual(['SL', 'TL', 'F', 'TR', 'SR']);
    expect(turnPath('SL', 'SL')).toEqual(['SL']);
  });
  it('goes round only through the poses the sheet has', () => {
    const noFront = (f: string) => f !== 'F';
    expect(turnPath('SL', 'SR', noFront)).toEqual(['SL', 'TL', 'B', 'TR', 'SR']);   // round the back instead
    expect(turnPath('SL', 'SR', (f) => f === 'SL' || f === 'SR')).toEqual(['SL', 'SR']);   // nothing between: just turns
  });
  it('knows the way each facing is drawn', () => {
    expect(FACINGS.map((f) => ANIM_OF[f])).toEqual(['idle', 'threeq', 'front', 'threeq', 'idle', 'back']);
    expect([flipOf('SL'), flipOf('SR'), flipOf('TL'), flipOf('TR')]).toEqual([false, true, false, true]);
    expect([flipOf('F'), flipOf('F', true), flipOf('B', true)]).toEqual([false, true, true]);
    expect([sideOf('TL'), sideOf('SR'), sideOf('F'), sideOf('B')]).toEqual(['L', 'R', null, null]);
    expect([sideFacing('L'), sideFacing('R')]).toEqual(['SL', 'SR']);
  });
});
