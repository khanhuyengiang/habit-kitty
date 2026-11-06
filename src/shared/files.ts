// Small helpers over Capacitor's Filesystem: files in the app's private storage, under one folder per area.
import { Directory, Filesystem } from '@capacitor/filesystem';

export const ROOT = 'habit-kitty';
export const at = (path: string, root = ROOT) => ({ path: `${root}/${path}`, directory: Directory.Data });

export const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function fileBytes(path: string, root = ROOT): Promise<Uint8Array | undefined> {
  try {
    const r = await Filesystem.readFile(at(path, root));
    return typeof r.data === 'string' ? fromBase64(r.data) : new Uint8Array(await r.data.arrayBuffer());
  } catch { return undefined; }
}
export async function fileNames(dir: string, root = ROOT): Promise<string[]> {
  try { return (await Filesystem.readdir(at(dir, root))).files.map((f) => f.name); } catch { return []; }
}
export async function removeFile(path: string, root = ROOT) { try { await Filesystem.deleteFile(at(path, root)); } catch { /* already gone */ } }
export async function writeOk(run: () => Promise<unknown>): Promise<boolean> {
  try { await run(); return true; } catch { return false; }
}
