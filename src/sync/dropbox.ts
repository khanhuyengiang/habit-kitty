// Talking to Dropbox: signing in (OAuth with PKCE, so no server and no secret) and one file in the app's own folder
// (Dropbox → Apps → <the app's name>; the app sees nothing else).
//
// Requests go out with fetch in the browser. In the phone app they go through Android itself (CapacitorHttp): the app's
// web view refuses them ("no connection"). Android hands bytes over as base64, both ways, so the backup file arrives
// and leaves intact.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { fromBase64, toBase64 } from '../shared/files.ts';

export const APP_KEY = 'ww16ej2zaqp4mbu';
const AUTHORIZE = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const RPC = 'https://api.dropboxapi.com/2/';
const CONTENT = 'https://content.dropboxapi.com/2/';

export interface Tokens { access: string; expires: number; refresh: string }

// ---- one request, either way ----
type Body = { form: Record<string, string> } | { json: unknown } | { bytes: Uint8Array };
interface Req { url: string; headers?: Record<string, string>; body?: Body; binary?: boolean }   // binary: the answer is a file
interface Res { status: number; ok: boolean; header(name: string): string | null; text: string; bytes: Uint8Array }

async function viaFetch(r: Req): Promise<Res> {
  const b = r.body;
  const res = await fetch(r.url, {
    method: 'POST',
    headers: {
      ...r.headers,
      ...(b && 'json' in b ? { 'Content-Type': 'application/json' } : {}),
      ...(b && 'bytes' in b ? { 'Content-Type': 'application/octet-stream' } : {}),
    },
    ...(b ? { body: 'form' in b ? new URLSearchParams(b.form) : 'json' in b ? JSON.stringify(b.json) : b.bytes as BodyInit } : {}),
  });
  const bytes = r.binary && res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
  const text = r.binary && res.ok ? '' : await res.text();
  return { status: res.status, ok: res.ok, header: (n) => res.headers.get(n), text, bytes };
}

async function viaAndroid(r: Req): Promise<Res> {
  const b = r.body;
  const headers: Record<string, string> = { ...r.headers };
  let data: unknown, dataType: string | undefined;
  if (b && 'form' in b) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; data = new URLSearchParams(b.form).toString(); }
  else if (b && 'json' in b) { headers['Content-Type'] = 'application/json'; data = b.json === null ? 'null' : b.json; }
  else if (b && 'bytes' in b) { headers['Content-Type'] = 'application/octet-stream'; data = toBase64(b.bytes); dataType = 'file'; }
  const res = await CapacitorHttp.request({ url: r.url, method: 'POST', headers, data, ...(dataType ? { dataType: dataType as 'file' } : {}), responseType: r.binary ? 'arraybuffer' : 'text' });
  const ok = res.status >= 200 && res.status < 300;
  const lower = Object.fromEntries(Object.entries(res.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const text = r.binary && ok ? '' : typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? null);
  const bytes = r.binary && ok && typeof res.data === 'string' ? fromBase64(res.data.replace(/\s+/g, '')) : new Uint8Array();
  return { status: res.status, ok, header: (n) => lower[n.toLowerCase()] ?? null, text, bytes };
}

const send = (r: Req) => (Capacitor.isNativePlatform() ? viaAndroid(r) : viaFetch(r));

// ---- signing in ----
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomString = (n = 48) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function authorizeUrl(o: { redirect: string; state: string; verifier: string }): Promise<string> {
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(o.verifier))));
  const q = new URLSearchParams({
    client_id: APP_KEY, response_type: 'code', token_access_type: 'offline',
    code_challenge: challenge, code_challenge_method: 'S256', redirect_uri: o.redirect, state: o.state,
  });
  return `${AUTHORIZE}?${q}`;
}

async function token(params: Record<string, string>): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const r = await send({ url: TOKEN, body: { form: { client_id: APP_KEY, ...params } } });
  if (!r.ok) throw new DropboxError(r.status, r.text);
  return JSON.parse(r.text);
}
export async function exchangeCode(o: { code: string; verifier: string; redirect: string }): Promise<Tokens> {
  const t = await token({ grant_type: 'authorization_code', code: o.code, code_verifier: o.verifier, redirect_uri: o.redirect });
  if (!t.refresh_token) throw new Error('no refresh token');
  return { access: t.access_token, expires: Date.now() + t.expires_in * 1000, refresh: t.refresh_token };
}
async function refreshed(t: Tokens): Promise<Tokens> {
  const r = await token({ grant_type: 'refresh_token', refresh_token: t.refresh });
  return { ...t, access: r.access_token, expires: Date.now() + r.expires_in * 1000 };
}
// Forget the sign-in on Dropbox's side too (best effort).
export async function revoke(t: Tokens) {
  try { await send({ url: `${RPC}auth/token/revoke`, headers: { Authorization: `Bearer ${t.access}` } }); } catch { /* offline: it lapses anyway */ }
}

// ---- calls ----
export class DropboxError extends Error {
  constructor(readonly status: number, readonly body: string) { super(`Dropbox ${status}: ${body.slice(0, 200)}`); }
  get summary(): string { try { return JSON.parse(this.body).error_summary ?? ''; } catch { return ''; } }
  get notFound() { return this.status === 409 && /not_found/.test(this.summary); }
  get conflict() { return this.status === 409 && /conflict/.test(this.summary); }
  get signedOut() { return this.status === 401 || (this.status === 400 && /invalid_grant/.test(this.body)); }
}

// A signed-in session. `save` is told whenever the access token is renewed, so the caller can keep it.
export function session(tokens: Tokens, save: (t: Tokens) => void) {
  let t = tokens;
  async function call(make: (access: string) => Req): Promise<Res> {
    if (Date.now() > t.expires - 60_000) { t = await refreshed(t); save(t); }
    let r = await send(make(t.access));
    if (r.status === 401) { t = await refreshed(t); save(t); r = await send(make(t.access)); }
    if (!r.ok) throw new DropboxError(r.status, r.text);
    return r;
  }
  const auth = (a: string) => ({ Authorization: `Bearer ${a}` });
  const rpc = async <T>(path: string, arg: unknown): Promise<T> =>
    JSON.parse((await call((a) => ({ url: RPC + path, headers: auth(a), body: { json: arg } }))).text);
  const content = (path: string, arg: unknown, o: { bytes?: Uint8Array; binary?: boolean } = {}) =>
    call((a) => ({ url: CONTENT + path, headers: { ...auth(a), 'Dropbox-API-Arg': JSON.stringify(arg) }, ...(o.bytes ? { body: { bytes: o.bytes } } : {}), binary: o.binary }));

  return {
    async accountName(): Promise<string> {
      const r = await rpc<{ name?: { display_name?: string } }>('users/get_current_account', null);
      return r.name?.display_name ?? '';
    },
    // The file's revision, or null when there is no file yet.
    async rev(path: string): Promise<string | null> {
      try { return (await rpc<{ rev: string }>('files/get_metadata', { path })).rev; }
      catch (e) { if (e instanceof DropboxError && e.notFound) return null; throw e; }
    },
    async download(path: string): Promise<{ bytes: Uint8Array; rev: string } | null> {
      try {
        const r = await content('files/download', { path }, { binary: true });
        let rev = '';
        try { rev = JSON.parse(r.header('Dropbox-API-Result') ?? '{}').rev ?? ''; } catch { /* asked for below */ }
        return { bytes: r.bytes, rev: rev || (await this.rev(path)) || '' };
      } catch (e) { if (e instanceof DropboxError && e.notFound) return null; throw e; }
    },
    // Writes the file only if it is still at `rev` (null: only if there is none yet); throws a conflict otherwise.
    async upload(path: string, bytes: Uint8Array, rev: string | null): Promise<string> {
      const mode = rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' };
      const r = await content('files/upload', { path, mode, autorename: false, mute: true }, { bytes });
      return JSON.parse(r.text).rev;
    },
  };
}
export type Session = ReturnType<typeof session>;
