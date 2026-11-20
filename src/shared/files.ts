// Small helpers over Capacitor's Filesystem: files in the app's private storage, under one folder per area.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export const ROOT = 'habit-kitty';
export const at = (path: string, root = ROOT) => ({ path: `${root}/${path}`, directory: Directory.Data });

export const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// What Filesystem.readFile gives back (base64 on the phone, a Blob on the web) as bytes.
export const dataBytes = async (data: string | Blob) => typeof data === 'string' ? fromBase64(data) : new Uint8Array(await data.arrayBuffer());

export async function fileBytes(path: string, root = ROOT): Promise<Uint8Array | undefined> {
  try { return await dataBytes((await Filesystem.readFile(at(path, root))).data); } catch { return undefined; }
}
// A text file (a diary page, a note, diary.json) as text, or undefined. Text is written as UTF-8, so it is read as UTF-8:
// on the website Capacitor hands back the text just as it was stored, so reading it as bytes (base64) only works on the phone.
export async function fileText(path: string, root = ROOT): Promise<string | undefined> {
  try {
    const { data } = await Filesystem.readFile({ ...at(path, root), encoding: Encoding.UTF8 });
    return typeof data === 'string' ? data : await data.text();
  } catch { return undefined; }
}
export async function fileNames(dir: string, root = ROOT): Promise<string[]> {
  try { return (await Filesystem.readdir(at(dir, root))).files.map((f) => f.name); } catch { return []; }
}
export async function removeFile(path: string, root = ROOT) { try { await Filesystem.deleteFile(at(path, root)); } catch { /* already gone */ } }
export async function writeOk(run: () => Promise<unknown>): Promise<boolean> {
  try { await run(); return true; } catch { return false; }
}

// Deletes a whole folder; true when it is gone (or was never there).
export async function clearFolder(root: string): Promise<boolean> {
  if (await writeOk(() => Filesystem.rmdir({ path: root, directory: Directory.Data, recursive: true }))) return true;
  return !await writeOk(() => Filesystem.readdir({ path: root, directory: Directory.Data }));
}

// Replaces the folder `root` with what `write` puts in `stage`: it is written next to the live folder and swapped in only
// when complete, so a failure leaves the old one untouched. Resolves to false when it failed.
export async function stagedReplace(root: string, stage: string, write: () => Promise<void>): Promise<boolean> {
  await clearFolder(stage);
  const staged = await writeOk(async () => { await Filesystem.mkdir({ path: stage, directory: Directory.Data, recursive: true }); await write(); });
  if (!staged || !await clearFolder(root)) { await clearFolder(stage); return false; }
  return writeOk(() => Filesystem.rename({ from: stage, to: root, directory: Directory.Data, toDirectory: Directory.Data }));
}
