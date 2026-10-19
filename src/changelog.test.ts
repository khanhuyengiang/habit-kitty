import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareVersions, entriesSince, parseChangelog } from './changelog.ts';
import { VERSION } from './version.ts';

const md = `# Change log

## 0.2.1 - 2026-10-19
### New
- Time travel
- Achievements
### Changed
- Playtest clock can go back a day

## 0.2.0 - 2026-10-01
- Diary
`;

describe('changelog', () => {
  it('parses versions, sections and bullets', () => {
    const e = parseChangelog(md);
    expect(e.map((x) => x.version)).toEqual(['0.2.1', '0.2.0']);
    expect(e[0].date).toBe('2026-10-19');
    expect(e[0].sections).toEqual([{ title: 'New', items: ['Time travel', 'Achievements'] }, { title: 'Changed', items: ['Playtest clock can go back a day'] }]);
    expect(e[1].sections).toEqual([{ title: '', items: ['Diary'] }]);
  });
  it('compares versions numerically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.2.1', '0.2.1')).toBe(0);
  });
  it('shows only what is new since the version last seen', () => {
    const e = parseChangelog(md);
    expect(entriesSince(e, '0.2.0', '0.2.1').map((x) => x.version)).toEqual(['0.2.1']);
    expect(entriesSince(e, '0.1.0', '0.2.1')).toHaveLength(2);
    expect(entriesSince(e, '0.2.1', '0.2.1')).toEqual([]);
  });
  it('keeps CHANGELOG.md in step with the running version', () => {
    const real = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    expect(real[0].version).toBe(VERSION);
    expect(real[0].sections.flatMap((s) => s.items).length).toBeGreaterThan(0);
  });
});
