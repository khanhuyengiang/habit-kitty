// The change log is CHANGELOG.md (one place to edit); the app bundles it and shows it in Settings.
// Format: "## 0.2.1 - 2026-10-19" headings, each followed by "- " bullets, optionally under "### New" style sub-headings.
export interface ChangeEntry { version: string; date: string; sections: { title: string; items: string[] }[] }

export function parseChangelog(md: string): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  let entry: ChangeEntry | null = null;
  let section: { title: string; items: string[] } | null = null;
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const h = /^##\s+v?(\d+\.\d+\.\d+)\s*(?:[-–—]\s*(.+))?$/.exec(line);
    if (h) { entry = { version: h[1], date: (h[2] ?? '').trim(), sections: [] }; out.push(entry); section = null; continue; }
    if (!entry) continue;
    const s = /^###\s+(.+)$/.exec(line);
    if (s) { section = { title: s[1].trim(), items: [] }; entry.sections.push(section); continue; }
    const b = /^[-*]\s+(.+)$/.exec(line);
    if (b) {
      if (!section) { section = { title: '', items: [] }; entry.sections.push(section); }
      section.items.push(b[1].trim());
    }
  }
  return out;
}

export const versionParts = (v: string) => v.split('.').map((n) => Number(n) || 0);
export function compareVersions(a: string, b: string): number {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

// What to show once after an update: every entry newer than the version the player last saw, up to the running one.
export const entriesSince = (entries: ChangeEntry[], seen: string, current: string) =>
  entries.filter((e) => compareVersions(e.version, seen) > 0 && compareVersions(e.version, current) <= 0);
