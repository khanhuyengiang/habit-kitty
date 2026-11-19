// An in-memory stand-in for Capacitor's Filesystem, for tests: files keyed by path (with a modified time), folders implied
// by the paths. In a test file:
//   vi.mock('@capacitor/filesystem', async () => (await import('./fsmock.ts')).fsModule);
//   const { fs, put, text } = await import('./fsmock.ts');
export interface MemFile { data: Buffer; mtime: number; stored?: string }
export const fs = new Map<string, MemFile>();
// Like the website (Capacitor in a browser) rather than the phone: a file keeps the string it was written with, and reading
// hands that string back whatever encoding is asked for. Turn on before the files are written.
export const browser = { on: false };
let clock = 1000;

export const put = (path: string, data: string | Buffer, mtime = ++clock) => { fs.set(path, { data: Buffer.isBuffer(data) ? data : Buffer.from(data), mtime }); };
export const text = (path: string) => fs.get(path)?.data.toString('utf8');

const missing = (): never => { throw new Error('File does not exist'); };
const trim = (p: string) => p.replace(/\/+$/, '');
const under = (k: string, p: string) => k.startsWith(`${p}/`);

export const fsModule = {
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    async writeFile({ path, data, encoding }: { path: string; data: string; encoding?: string }) {
      fs.set(path, { data: Buffer.from(data, encoding === 'utf8' ? 'utf8' : 'base64'), mtime: ++clock, ...(browser.on && { stored: data }) });
      return { uri: path };
    },
    async readFile({ path, encoding }: { path: string; encoding?: string }) {
      const f = fs.get(path) ?? missing();
      return { data: f.stored ?? f.data.toString(encoding === 'utf8' ? 'utf8' : 'base64') };
    },
    async readdir({ path }: { path: string }) {
      const p = trim(path);
      const files = [...fs.entries()].filter(([k]) => under(k, p) && !k.slice(p.length + 1).includes('/'))
        .map(([k, f]) => ({ name: k.slice(p.length + 1), type: 'file', mtime: f.mtime }));
      if (!files.length) missing();
      return { files };
    },
    async deleteFile({ path }: { path: string }) { if (!fs.delete(path)) missing(); },
    async mkdir() {},
    async rmdir({ path }: { path: string }) { const p = trim(path); for (const k of [...fs.keys()]) if (k === p || under(k, p)) fs.delete(k); },
    // A file or a whole folder.
    async rename({ from, to }: { from: string; to: string }) {
      const f = fs.get(from);
      if (f) { fs.delete(from); fs.set(to, f); return; }
      for (const [k, v] of [...fs.entries()]) if (under(k, from)) { fs.delete(k); fs.set(`${to}${k.slice(from.length)}`, v); }
    },
  },
};
