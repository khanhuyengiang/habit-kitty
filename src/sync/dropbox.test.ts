// The phone's way of talking to Dropbox (through Android, bytes as base64), with Android pretended.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: Record<string, any>[] = [];
let reply: (req: Record<string, any>) => { status: number; headers: Record<string, string>; data: unknown };
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: { request: async (req: Record<string, any>) => { calls.push(req); return reply(req); } },
}));
const { session, exchangeCode, DropboxError } = await import('./dropbox.ts');

const tokens = { access: 'a', refresh: 'r', expires: Date.now() + 3_600_000 };
const s = session(tokens, () => {});
// Android's base64 comes in lines of 76
const androidBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64').replace(/(.{76})/g, '$1\n');

beforeEach(() => { calls.length = 0; });

describe('Dropbox through Android', () => {
  it('signs in with a form', async () => {
    reply = () => ({ status: 200, headers: { 'Content-Type': 'application/json' }, data: { access_token: 'x', expires_in: 100, refresh_token: 'y' } });
    const t = await exchangeCode({ code: 'c', verifier: 'v', redirect: 'https://site/' });
    expect(t.refresh).toBe('y');
    expect(calls[0].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(calls[0].data).get('code')).toBe('c');
  });

  it('sends a file as base64, unchanged', async () => {
    reply = () => ({ status: 200, headers: {}, data: { rev: 'r9' } });
    const bytes = new Uint8Array([0, 255, 128, 80, 75, 3, 4]);
    expect(await s.upload('/f.kitty', bytes, 'r1')).toBe('r9');
    expect(calls[0].dataType).toBe('file');
    expect(Buffer.from(calls[0].data, 'base64')).toEqual(Buffer.from(bytes));
    expect(JSON.parse(calls[0].headers['Dropbox-API-Arg']).mode).toEqual({ '.tag': 'update', update: 'r1' });
  });

  it('gets a file back intact, with its revision', async () => {
    const bytes = new Uint8Array(Array.from({ length: 300 }, (_, i) => i % 256));
    reply = () => ({ status: 200, headers: { 'dropbox-api-result': JSON.stringify({ rev: 'r5' }) }, data: androidBase64(bytes) });
    const got = await s.download('/f.kitty');
    expect(got?.rev).toBe('r5');
    expect(got?.bytes).toEqual(bytes);
    expect(calls[0].responseType).toBe('arraybuffer');
  });

  it('tells a missing file and a conflict apart', async () => {
    reply = () => ({ status: 409, headers: { 'Content-Type': 'application/json' }, data: { error_summary: 'path/not_found/..' } });
    expect(await s.download('/f.kitty')).toBeNull();
    expect(await s.rev('/f.kitty')).toBeNull();
    reply = () => ({ status: 409, headers: {}, data: '{"error_summary": "path/conflict/file/"}' });
    const e = await s.upload('/f.kitty', new Uint8Array([1]), 'r1').catch((x) => x);
    expect(e).toBeInstanceOf(DropboxError);
    expect(e.conflict).toBe(true);
  });

  it('asks for the account with a body of null', async () => {
    reply = () => ({ status: 200, headers: {}, data: { name: { display_name: 'Kay' } } });
    expect(await s.accountName()).toBe('Kay');
    expect(calls[0].data).toBe('null');
  });
});
