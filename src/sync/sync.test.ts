// The sync engine against a pretend Dropbox (fetch) and a pretend device (the target), with the file system in memory.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/filesystem', async () => (await import('../test/fsmock.ts')).fsModule);
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false }, CapacitorHttp: {}, registerPlugin: () => ({}) }));
vi.mock('@capacitor/app', () => ({ App: { addListener: () => {}, getLaunchUrl: async () => undefined } }));
vi.mock('@capacitor/share', () => ({ Share: {} }));

const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } },
  location: { href: 'http://localhost/', hostname: 'localhost', origin: 'http://localhost', pathname: '/' },
});

const { packBackup, unpackBackup } = await import('../backup.ts');
const { markDirty, BACKUP_PREFIX } = await import('../shared/backupfolder.ts');
const sync = await import('./sync.ts');
const { newState } = await import('../habit/rules.ts');
type Backup = import('../backup.ts').Backup;

// ---- the cloud ----
let cloud: { bytes: Uint8Array; rev: string } | null = null;
let revs = 0, uploads = 0, sneakIn: (() => void) | null = null;
let kept: { path: string; bytes: Uint8Array }[] = [];   // files uploaded anywhere but the main one
const cloudNotes = () => (cloud ? unpackBackup(cloud.bytes).notes : undefined);
const putCloud = (b: Backup) => { cloud = { bytes: packBackup(b), rev: `r${++revs}` }; };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const notFound = () => json({ error_summary: 'path/not_found/.' }, 409);

globalThis.fetch = (async (url: string, init: RequestInit) => {
  const arg = JSON.parse((init.headers as Record<string, string>)['Dropbox-API-Arg'] ?? 'null');
  if (url.endsWith('/files/get_metadata')) return cloud ? json({ rev: cloud.rev }) : notFound();
  if (url.endsWith('/files/download')) {
    if (!cloud) return notFound();
    return new Response(cloud.bytes as BodyInit, { headers: { 'Dropbox-API-Result': JSON.stringify({ rev: cloud.rev }) } });
  }
  if (url.endsWith('/files/upload') && arg.path !== '/itty-bitty-kitty.kitty') {
    kept.push({ path: arg.path, bytes: new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer()) });
    return json({ rev: `k${kept.length}` });
  }
  if (url.endsWith('/files/upload')) {
    if (sneakIn) { const f = sneakIn; sneakIn = null; f(); }   // another device writes just before this one
    const want = arg.mode['.tag'] === 'update' ? arg.mode.update : null;
    if ((cloud?.rev ?? null) !== want) return json({ error_summary: 'path/conflict/file/..' }, 409);
    uploads++;
    cloud = { bytes: new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer()), rev: `r${++revs}` };
    return json({ rev: cloud.rev });
  }
  throw new Error(`unexpected ${url}`);
}) as typeof fetch;

// ---- this device ----
let local: Backup;
const game = () => ({ v: 1, state: newState(), offsetHours: 0, log: [], savedAt: 0 });
sync.registerSyncTarget({
  collect: async () => structuredClone(local),
  apply: async (b) => { local = structuredClone(b); return true; },
});
const edit = (f: (b: Backup) => void) => { f(local); markDirty(BACKUP_PREFIX); };

beforeEach(() => {
  mem.clear();
  localStorage.setItem('kitty-sync', JSON.stringify({ tokens: { access: 'a', refresh: 'r', expires: Date.now() + 3_600_000 } }));
  cloud = null; uploads = 0; sneakIn = null; kept = [];
  local = { game: game(), diary: {}, photos: {}, notes: { Mine: 'hello' } };
});

describe('sync', () => {
  it('sends everything the first time, then nothing while nothing changes', async () => {
    await sync.requestSync();
    expect(sync.syncStatus().error).toBe('');
    expect(cloudNotes()).toEqual({ Mine: 'hello' });
    await sync.requestSync();
    expect(uploads).toBe(1);
  });

  it("takes in another device's changes without sending them back", async () => {
    await sync.requestSync();
    putCloud({ ...unpackBackup(cloud!.bytes), notes: { Mine: 'hello', Theirs: 'hi' } });
    await sync.requestSync();
    expect(local.notes).toEqual({ Mine: 'hello', Theirs: 'hi' });
    expect(uploads).toBe(1);
  });

  it('merges when both sides changed, and sends the merge', async () => {
    await sync.requestSync();
    putCloud({ ...unpackBackup(cloud!.bytes), notes: { Mine: 'hello', Theirs: 'hi' } });
    edit((b) => { b.notes = { ...b.notes, Phone: 'yo' }; });
    await sync.requestSync();
    expect(local.notes).toEqual({ Mine: 'hello', Phone: 'yo', Theirs: 'hi' });
    expect(cloudNotes()).toEqual(local.notes);
  });

  it('on a conflict, keeps both files next to the cloud one before the merge replaces it', async () => {
    await sync.requestSync();
    putCloud({ ...unpackBackup(cloud!.bytes), notes: { Mine: 'hello', Theirs: 'hi' } });
    edit((b) => { b.notes = { ...b.notes, Phone: 'yo' }; });
    await sync.requestSync();
    expect(kept.map((k) => k.path.replace(/\d{8}-\d{6}/, 'T'))).toEqual(['/conflicts/itty-bitty-kitty-T-this-device.kitty', '/conflicts/itty-bitty-kitty-T-cloud.kitty']);
    expect(unpackBackup(kept[0].bytes).notes).toEqual({ Mine: 'hello', Phone: 'yo' });
    expect(unpackBackup(kept[1].bytes).notes).toEqual({ Mine: 'hello', Theirs: 'hi' });
    expect(cloudNotes()).toEqual({ Mine: 'hello', Phone: 'yo', Theirs: 'hi' });   // and the merge replaced the file
  });

  it('keeps nothing extra when only one side changed', async () => {
    await sync.requestSync();
    edit((b) => { b.notes = { ...b.notes, Phone: 'yo' }; });
    await sync.requestSync();
    putCloud({ ...unpackBackup(cloud!.bytes), notes: { Mine: 'hello', Phone: 'yo', Theirs: 'hi' } });
    await sync.requestSync();
    expect(kept).toEqual([]);
  });

  it('merges again when another device wrote while this one was sending', async () => {
    await sync.requestSync();
    edit((b) => { b.notes = { ...b.notes, Phone: 'yo' }; });
    sneakIn = () => putCloud({ ...unpackBackup(cloud!.bytes), notes: { Mine: 'hello', Tablet: 'hey' } });
    await sync.requestSync();
    expect(cloudNotes()).toEqual({ Mine: 'hello', Phone: 'yo', Tablet: 'hey' });
    expect(local.notes).toEqual(cloudNotes());
  });

  it('lets a new device join: the cloud leads on the first sync', async () => {
    putCloud({ game: { ...game(), roomName: 'Cosy corner', unlimited: true }, diary: {}, photos: {}, notes: { Old: 'from before' } });
    local = { game: { ...game(), unlimited: false, muted: true }, diary: {}, photos: {}, notes: {} };
    await sync.requestSync();
    const g = local.game as Record<string, unknown>;
    expect(g.roomName).toBe('Cosy corner');
    expect(g.unlimited).toBe(true);
    expect(g.muted).toBe(true);   // this device's own
    expect(local.notes).toEqual({ Old: 'from before' });
  });

  it('a note deleted here is deleted in the cloud too', async () => {
    local.notes = { Mine: 'hello', Gone: 'bye' };
    await sync.requestSync();
    edit((b) => { b.notes = { Mine: 'hello' }; });
    await sync.requestSync();
    expect(cloudNotes()).toEqual({ Mine: 'hello' });
  });
});
