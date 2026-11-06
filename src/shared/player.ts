// The player: one person across the apps. The record is the one Achievement Kitty always had (its `user`: id, name, gender,
// birth year, avatar), kept with its data, so nothing moves and backups carry it. These functions read and write it
// straight from storage, so the home page can show and edit the player while Achievement Kitty is not running.
// Achievement Kitty re-reads it whenever it is shown again.
import { IDB_PREFIX, isLocalRef } from '../achievement/storage.ts';
import { newId, type Data, type PlayerGender } from '../achievement/model.ts';
import { emptyData, updateProfile, type Errors } from '../achievement/ops.ts';
import { platformRepo } from '../achievement/web/snapshot.ts';

// The saved records, or a fresh set (not saved yet) when there are none. Throws when storage can't be read.
export async function loadPlayerData(): Promise<Data> {
  return (await platformRepo().loadData()) ?? emptyData();
}

// An object URL for a stored avatar ('' when there is none or it can't be read). The caller revokes it.
export async function avatarUrlOf(data: Data): Promise<string> {
  const ref = data.user.avatarUrl;
  if (!ref) return '';
  if (!isLocalRef(ref)) return ref;
  try {
    const blob = await platformRepo().getPhoto(ref);
    return blob ? URL.createObjectURL(blob) : '';
  } catch { return ''; }
}

export interface ProfileInput {
  name: string;
  gender: PlayerGender | null;
  birthYear: number | null;
  avatar: 'keep' | 'cat' | Blob;   // keep the picture, go back to the cat, or a new picture
}

// Saves the profile; errors (by field) when something is not valid, and then nothing is saved.
export async function savePlayer(p: ProfileInput): Promise<{ data: Data; errors: Errors }> {
  const repo = platformRepo();
  const current = (await repo.loadData()) ?? emptyData();
  const old = current.user.avatarUrl;
  const ref = p.avatar === 'keep' ? old : p.avatar === 'cat' ? null : `${IDB_PREFIX}${newId()}`;
  const r = updateProfile(current, { displayName: p.name, gender: p.gender, birthYear: p.birthYear, avatarUrl: ref });
  if (Object.keys(r.errors).length) return r;
  if (p.avatar instanceof Blob && ref) await repo.putPhoto(ref, p.avatar);
  await repo.saveData(r.data);
  // The old picture goes unless something else (an achievement photo) still uses it.
  if (old && old !== ref && isLocalRef(old) && !r.data.photos.some((x) => x.imageUrl === old)) {
    repo.deletePhotos([old]).catch(() => { /* an orphaned file is harmless */ });
  }
  return r;
}
