// Talking to Dropbox: signing in (OAuth with PKCE, so no server and no secret) and one file in the app's own folder
// (Dropbox → Apps → <the app's name>; the app sees nothing else). Plain fetch, the same in the browser and on the phone.

export const APP_KEY = 'ww16ej2zaqp4mbu';
const AUTHORIZE = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const RPC = 'https://api.dropboxapi.com/2/';
const CONTENT = 'https://content.dropboxapi.com/2/';

export interface Tokens { access: string; expires: number; refresh: string }

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
  const r = await fetch(TOKEN, { method: 'POST', body: new URLSearchParams({ client_id: APP_KEY, ...params }) });
  if (!r.ok) throw new DropboxError(r.status, await r.text());
  return r.json();
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
  try { await fetch(`${RPC}auth/token/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${t.access}` } }); } catch { /* offline: it lapses anyway */ }
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
  async function send(make: (access: string) => Promise<Response>): Promise<Response> {
    if (Date.now() > t.expires - 60_000) { t = await refreshed(t); save(t); }
    let r = await make(t.access);
    if (r.status === 401) { t = await refreshed(t); save(t); r = await make(t.access); }
    if (!r.ok) throw new DropboxError(r.status, await r.text());
    return r;
  }
  const rpc = async <T>(path: string, arg: unknown): Promise<T> =>
    (await send((a) => fetch(RPC + path, { method: 'POST', headers: { Authorization: `Bearer ${a}`, 'Content-Type': 'application/json' }, body: JSON.stringify(arg) }))).json();
  const content = (path: string, arg: unknown, body?: Uint8Array) =>
    send((a) => fetch(CONTENT + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${a}`, 'Dropbox-API-Arg': JSON.stringify(arg), ...(body ? { 'Content-Type': 'application/octet-stream' } : {}) },
      ...(body ? { body: body as BodyInit } : {}),
    }));

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
        const r = await content('files/download', { path });
        const bytes = new Uint8Array(await r.arrayBuffer());
        let rev = '';
        try { rev = JSON.parse(r.headers.get('Dropbox-API-Result') ?? '{}').rev ?? ''; } catch { /* asked for below */ }
        return { bytes, rev: rev || (await this.rev(path)) || '' };
      } catch (e) { if (e instanceof DropboxError && e.notFound) return null; throw e; }
    },
    // Writes the file only if it is still at `rev` (null: only if there is none yet); throws a conflict otherwise.
    async upload(path: string, bytes: Uint8Array, rev: string | null): Promise<string> {
      const mode = rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' };
      const r = await content('files/upload', { path, mode, autorename: false, mute: true }, bytes);
      return (await r.json()).rev;
    },
  };
}
export type Session = ReturnType<typeof session>;
