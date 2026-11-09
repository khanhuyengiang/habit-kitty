import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE, PALETTE_HEXES, toPalette } from './palette.ts';

// Black is only used where its colour never shows: CSS masks (only the alpha counts) and colour parsing in the editor.
const ALLOWED = new Set(['#000000']);

const files = (dir: string, ext: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(join(dir, e.name), ext) : e.name.endsWith(ext) && !e.name.endsWith('.test.ts') && e.name !== 'palette.ts' ? [join(dir, e.name)] : []);

const full = (h: string) => (h.length <= 5 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h).toLowerCase();
const hex = (n: string) => (+n).toString(16).padStart(2, '0');

describe('palette', () => {
  it('has 60 distinct colours', () => {
    expect(Object.keys(PALETTE)).toHaveLength(60);
    expect(PALETTE_HEXES.size).toBe(60);
  });

  it('is the only source of colours in src/ and web/', () => {
    const stray: string[] = [];
    for (const f of [...files('src', '.ts'), ...files('web', '.html')]) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi)) {
          const c = full(m[0]).slice(0, 7);   // an alpha variant of a palette colour is fine
          if (!PALETTE_HEXES.has(c) && !ALLOWED.has(c)) stray.push(`${f}:${i + 1} ${m[0]}`);
        }
        for (const m of line.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
          const c = `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
          if (!PALETTE_HEXES.has(c)) stray.push(`${f}:${i + 1} ${m[0]})`);
        }
      });
    }
    expect(stray, 'colours outside src/shared/palette.ts (ask before adding one)').toEqual([]);
  });

  it('maps old colours to palette colours and leaves others alone', () => {
    expect(toPalette('#FF6FA5')).toBe(PALETTE.pink500);
    expect(toPalette(PALETTE.pink300)).toBe(PALETTE.pink300);
    expect(toPalette('#123456')).toBe('#123456');
  });
});
