// Auto-backup rules, pure so they can be tested: what the files are called, when a backup is due and which old ones to delete.
// The folder itself is handled by src/shared/backupfolder.ts and the BackupFolder plugin on Android.
//
//   - a backup is made whenever something changed (a moment after the last change, and when the app is left)
//   - there is one file per 3-hour slot (00:00, 03:00 ... 21:00), so a slot keeps the last state it saw; a slot nothing
//     changed in has no file
//   - today's and yesterday's slots are all kept; of every older day only the day's last backup is kept
import { localDateKey } from './dates.ts';

export const SLOT_HOURS = 3;
export const KEEP_FULL_DAYS = 2;               // today and yesterday keep every slot
export const SETTLE_MS = 20_000;               // a change is backed up this long after the last one

// habit-kitty-2026-11-05-0900.kitty: the local date and the slot's hour. A second backup in the same slot replaces it.
// (Earlier versions made habit-kitty-2026-11-05.kitty, one a day: those still count, as that day's backup.)
export const slotOf = (d: Date) => String(Math.floor(d.getHours() / SLOT_HOURS) * SLOT_HOURS).padStart(2, '0') + '00';
export const backupName = (prefix: string, ext: string, d = new Date()) => `${prefix}-${localDateKey(d)}.${ext}`;
export const slotName = (prefix: string, ext: string, d = new Date()) => `${prefix}-${localDateKey(d)}-${slotOf(d)}.${ext}`;

// Something changed and has not been backed up yet.
export const isDue = (o: { dirty: boolean }): boolean => o.dirty;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parse = (name: string, prefix: string, ext: string) =>
  new RegExp(`^${esc(prefix)}-(\\d{4}-\\d{2}-\\d{2})(?:-(\\d{4}))?\\.${esc(ext)}$`).exec(name);
// What orders a folder's backups: the day, then the slot (a one-a-day file from before slots counts as the day's first).
const keyOf = (name: string, prefix: string, ext: string) => { const m = parse(name, prefix, ext)!; return `${m[1]}-${m[2] ?? '0000'}`; };

// The folder's backups for one app, newest first (the date in the name decides, not the file's modified time).
export function backupsOf(names: string[], prefix: string, ext: string): string[] {
  return names.filter((n) => parse(n, prefix, ext)).sort((a, b) => keyOf(b, prefix, ext).localeCompare(keyOf(a, prefix, ext)));
}

// "2026-11-20 09:00" for the restore list.
export function backupLabel(name: string, prefix: string, ext: string): string {
  const m = parse(name, prefix, ext);
  return !m ? name : m[2] ? `${m[1]} ${m[2].slice(0, 2)}:${m[2].slice(2)}` : m[1];
}

// The backups to delete: of every day before the last KEEP_FULL_DAYS, all but the day's last one.
export function toPrune(names: string[], prefix: string, ext: string, now = new Date()): string[] {
  const edge = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (KEEP_FULL_DAYS - 1));
  const oldest = localDateKey(edge);   // from this day on, every slot stays
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of backupsOf(names, prefix, ext)) {   // newest first: the first of a day is its last backup
    const day = parse(n, prefix, ext)![1];
    if (day >= oldest) continue;
    if (seen.has(day)) out.push(n); else seen.add(day);
  }
  return out;
}
