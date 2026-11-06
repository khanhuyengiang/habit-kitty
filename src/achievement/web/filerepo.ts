// The phone keeps the save as real files in the app's private folder (survives the webview being cleared), in a folder of
// its own next to Habit Kitty's:
//   achievement-kitty/data.json    the records
//   achievement-kitty/photos/<id>.jpg
// data.json is written to a temp file and renamed over the old one, so a crash mid-save never leaves half a file.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { Data } from '../model.ts';
import { IDB_PREFIX, type Repo } from '../storage.ts';

const dir = Directory.Data;
const ROOT = 'achievement-kitty';
const DATA = `${ROOT}/data.json`, TMP = `${DATA}.tmp`, PHOTOS = `${ROOT}/photos`;
const fileOf = (ref: string) => `${PHOTOS}/${ref.slice(IDB_PREFIX.length)}.jpg`;

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const base64ToBlob = (b64: string) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: 'image/jpeg' }); };

export class FileRepo implements Repo {
  async load() {
    let data: Data | null = null;
    try { data = JSON.parse((await Filesystem.readFile({ path: DATA, directory: dir, encoding: Encoding.UTF8 })).data as string); }
    catch (e) { if (!/not exist|no such|not found/i.test(String((e as Error)?.message ?? e))) throw e; }
    const photos = new Map<string, Blob>();
    let names: string[] = [];
    try { names = (await Filesystem.readdir({ path: PHOTOS, directory: dir })).files.map((f) => f.name); } catch { /* no photos yet */ }
    for (const n of names) {
      const r = await Filesystem.readFile({ path: `${PHOTOS}/${n}`, directory: dir });
      photos.set(`${IDB_PREFIX}${n.replace(/\.jpg$/, '')}`, base64ToBlob(r.data as string));
    }
    return { data, photos };
  }

  async loadData() {
    try { return JSON.parse((await Filesystem.readFile({ path: DATA, directory: dir, encoding: Encoding.UTF8 })).data as string) as Data; }
    catch (e) { if (!/not exist|no such|not found/i.test(String((e as Error)?.message ?? e))) throw e; return null; }
  }

  async getPhoto(ref: string) {
    try { return base64ToBlob((await Filesystem.readFile({ path: fileOf(ref), directory: dir })).data as string); } catch { return null; }
  }

  async saveData(d: Data) {
    await Filesystem.writeFile({ path: TMP, directory: dir, data: JSON.stringify(d), encoding: Encoding.UTF8, recursive: true });
    await Filesystem.rename({ from: TMP, to: DATA, directory: dir, toDirectory: dir });
  }

  async putPhoto(ref: string, blob: Blob) {
    await Filesystem.writeFile({ path: fileOf(ref), directory: dir, data: await blobToBase64(blob), recursive: true });
  }

  async deletePhotos(refs: string[]) {
    for (const r of refs) await Filesystem.deleteFile({ path: fileOf(r), directory: dir }).catch(() => { /* already gone */ });
  }

  async replaceAll(d: Data, photos: Map<string, Blob>) {
    await Filesystem.rmdir({ path: PHOTOS, directory: dir, recursive: true }).catch(() => {});
    for (const [ref, blob] of photos) await this.putPhoto(ref, blob);
    await this.saveData(d);
  }
}
