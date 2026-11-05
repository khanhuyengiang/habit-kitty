// Auto-backup rules, pure so they can be tested: what the files are called, when a backup is due and which old ones to delete.
// The folder itself is handled by src/shared/backupfolder.ts and the BackupFolder plugin on Android.

export const KEEP_BACKUPS = 7;                 // newest files kept per app; the rest are deleted
export const MIN_GAP_MS = 15 * 60_000;         // after a change, wait at least this long since the last backup
export const STALE_MS = 24 * 3_600_000;        // with no change at all, still refresh a backup this old when the app opens

const two = (n: number) => String(n).padStart(2, '0');

// habit-kitty-2026-11-05.kitty (the local date, so one file per day: a second backup the same day replaces it).
export const backupName = (prefix: string, ext: string, d = new Date()) =>
  `${prefix}-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}.${ext}`;

// `last` is 0 when there has never been a backup.
export function isDue(o: { dirty: boolean; last: number; now: number; launch?: boolean }): boolean {
  const age = o.now - o.last;
  if (o.dirty) return age >= MIN_GAP_MS;
  return !!o.launch && age >= STALE_MS;
}

// The folder's backups for one app, newest first (the date in the name decides, not the file's modified time).
export function backupsOf(names: string[], prefix: string, ext: string): string[] {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{4}-\\d{2}-\\d{2})\\.${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  return names.filter((n) => re.test(n)).sort().reverse();
}

export const toPrune = (names: string[], prefix: string, ext: string, keep = KEEP_BACKUPS): string[] =>
  backupsOf(names, prefix, ext).slice(keep);
