// Kitty Achievement's save, read and written without the app being open: Habit Kitty's combined backup needs it
// (the app itself only starts the first time it is shown).
import { Capacitor } from '@capacitor/core';
import { packBackup, unpackBackup } from '../backup.ts';
import { migrate } from '../ops.ts';
import { IndexedDbRepo, type Repo } from '../storage.ts';
import { FileRepo } from './filerepo.ts';

export const platformRepo = (): Repo => (Capacitor.isNativePlatform() ? new FileRepo() : new IndexedDbRepo());

// The save as an Kitty Achievement save file, or undefined when there is nothing saved yet or it can't be read.
export async function snapshotAchievement(): Promise<Uint8Array | undefined> {
  try {
    const { data, photos } = await platformRepo().load();
    return data ? await packBackup(migrate(data), photos) : undefined;
  } catch { return undefined; }
}

// Replaces what is saved with a save file. The caller reloads the page afterwards so the app starts from it.
export async function restoreAchievement(bytes: Uint8Array): Promise<void> {
  const { data, photos } = unpackBackup(bytes);
  await platformRepo().replaceAll(data, photos);
}

// How many achievements a save file holds, for the "restore this?" question; 0 when it can't be read.
export function achievementCount(bytes: Uint8Array): number {
  try { return unpackBackup(bytes).data.achievements.length; } catch { return 0; }
}
