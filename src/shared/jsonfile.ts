// One app's data kept as a single JSON file in the app's private storage (Kitty Mart, Kitty Gallery). Writes go one after
// another, so an older save can never land after a newer one, and each marks the backup as due.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { writeOk } from './files.ts';
import { BACKUP_PREFIX, markDirty } from './backupfolder.ts';

export function jsonFile<T>(path: string, sanitize: (raw: unknown) => T, empty: () => T) {
  const file = { path, directory: Directory.Data };
  let writing: Promise<boolean> = Promise.resolve(true);
  return {
    // The data in the file; empty when there is no file yet (or a damaged one).
    async read(): Promise<T> {
      try {
        const r = await Filesystem.readFile({ ...file, encoding: Encoding.UTF8 });
        return sanitize(JSON.parse(typeof r.data === 'string' ? r.data : await r.data.text()));
      } catch { return empty(); }
    },
    // Text from a backup as data, or null when it can't be read.
    parse(text: string): T | null {
      try { return sanitize(JSON.parse(text)); } catch { return null; }
    },
    // Resolves to false when it could not be written.
    write(value: T): Promise<boolean> {
      const text = JSON.stringify(value);
      writing = writing.then(() => writeOk(() => Filesystem.writeFile({ ...file, data: text, encoding: Encoding.UTF8, recursive: true })));
      markDirty(BACKUP_PREFIX);
      return writing;
    },
  };
}
