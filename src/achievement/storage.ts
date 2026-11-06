// Persistence behind one small interface. The records are one JSON document; each photo is a separate Blob.
// IndexedDbRepo keeps both in the browser. A server-backed repo can implement the same interface later.
import type { Data } from './model.ts';

export interface Repo {
  load(): Promise<{ data: Data | null; photos: Map<string, Blob> }>;
  // Just the records, or just one photo: for reading the player without loading every photo.
  loadData(): Promise<Data | null>;
  getPhoto(ref: string): Promise<Blob | null>;
  saveData(d: Data): Promise<void>;
  putPhoto(ref: string, blob: Blob): Promise<void>;
  deletePhotos(refs: string[]): Promise<void>;
  // Everything on disk becomes exactly this (a restore from a save file).
  replaceAll(d: Data, photos: Map<string, Blob>): Promise<void>;
}

export const IDB_PREFIX = 'idb:';
export const isLocalRef = (ref: string | null): ref is string => !!ref && ref.startsWith(IDB_PREFIX);

const DB = 'achievement-kitty', STATE = 'state', PHOTOS = 'photos', KEY = 'data';

const done = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const finished = (tx: IDBTransaction) => new Promise<void>((res, rej) => {
  tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('aborted'));
});

export class IndexedDbRepo implements Repo {
  private db: Promise<IDBDatabase>;

  constructor(name = DB) {
    this.db = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STATE); req.result.createObjectStore(PHOTOS); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('database blocked'));
    });
  }

  async load() {
    const db = await this.db;
    const tx = db.transaction([STATE, PHOTOS], 'readonly');
    const data = ((await done(tx.objectStore(STATE).get(KEY))) as Data | undefined) ?? null;
    const store = tx.objectStore(PHOTOS);
    const [keys, blobs] = await Promise.all([done(store.getAllKeys()), done(store.getAll())]);
    return { data, photos: new Map(keys.map((k, i) => [String(k), blobs[i] as Blob])) };
  }

  async loadData() {
    const tx = (await this.db).transaction(STATE, 'readonly');
    return ((await done(tx.objectStore(STATE).get(KEY))) as Data | undefined) ?? null;
  }

  async getPhoto(ref: string) {
    const tx = (await this.db).transaction(PHOTOS, 'readonly');
    return ((await done(tx.objectStore(PHOTOS).get(ref))) as Blob | undefined) ?? null;
  }

  async saveData(d: Data) {
    const tx = (await this.db).transaction(STATE, 'readwrite');
    tx.objectStore(STATE).put(d, KEY);
    await finished(tx);
  }

  async putPhoto(ref: string, blob: Blob) {
    const tx = (await this.db).transaction(PHOTOS, 'readwrite');
    tx.objectStore(PHOTOS).put(blob, ref);
    await finished(tx);
  }

  async deletePhotos(refs: string[]) {
    if (!refs.length) return;
    const tx = (await this.db).transaction(PHOTOS, 'readwrite');
    for (const r of refs) tx.objectStore(PHOTOS).delete(r);
    await finished(tx);
  }

  async replaceAll(d: Data, photos: Map<string, Blob>) {
    const tx = (await this.db).transaction([STATE, PHOTOS], 'readwrite');
    tx.objectStore(PHOTOS).clear();
    for (const [ref, blob] of photos) tx.objectStore(PHOTOS).put(blob, ref);
    tx.objectStore(STATE).put(d, KEY);
    await finished(tx);
  }
}

// For tests, and as the fallback when the browser refuses to store anything (the app then says so).
export class MemoryRepo implements Repo {
  data: Data | null = null;
  photos = new Map<string, Blob>();
  async load() { return { data: this.data ? structuredClone(this.data) : null, photos: new Map(this.photos) }; }
  async loadData() { return this.data ? structuredClone(this.data) : null; }
  async getPhoto(ref: string) { return this.photos.get(ref) ?? null; }
  async saveData(d: Data) { this.data = structuredClone(d); }
  async putPhoto(ref: string, blob: Blob) { this.photos.set(ref, blob); }
  async deletePhotos(refs: string[]) { for (const r of refs) this.photos.delete(r); }
  async replaceAll(d: Data, photos: Map<string, Blob>) { this.data = structuredClone(d); this.photos = new Map(photos); }
}

// Saves run one after another and always end with the newest data; a failed save can be retried.
export class Saver {
  private pending: Data | null = null;
  private running: Promise<void> | null = null;
  error: unknown = null;
  private failed: Data | null = null;

  private repo: Repo;
  private onChange: () => void;

  constructor(repo: Repo, onChange: () => void = () => {}) { this.repo = repo; this.onChange = onChange; }

  get busy() { return !!this.running; }

  retry(): Promise<boolean> { return this.failed ? this.save(this.failed) : Promise.resolve(true); }

  save(d: Data): Promise<boolean> {
    this.pending = d;
    this.running ??= this.drain();
    return this.running.then(() => !this.error);
  }

  private async drain() {
    this.onChange();
    while (this.pending) {
      const d = this.pending;
      this.pending = null;
      try { await this.repo.saveData(d); this.error = null; this.failed = null; }
      catch (e) { this.error = e; this.failed = d; }
    }
    this.running = null;
    this.onChange();
  }
}
