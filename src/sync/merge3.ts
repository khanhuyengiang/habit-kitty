// Three-way merging, the building blocks of sync. Each device keeps a copy of what it last synced (the base); merging
// what is on this device (mine) with what is in the cloud (theirs) against that base tells a change from something
// the other side simply never had: a value changed on one side only takes that change, an item added on either side is
// kept, an item deleted on one side and left alone on the other goes. Only when both sides changed the same thing does
// a rule pick (`prefer`). Without a base (the first sync) nothing counts as deleted: both sides are combined.
// Pure, so it can be tested; nothing here knows about any one app.

export const NONE: unique symbol = Symbol('no base');
export type Base<T> = T | typeof NONE;
export type Side = 'mine' | 'theirs';

const isBytes = (x: unknown): x is Uint8Array => x instanceof Uint8Array;
export const isPlain = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && !isBytes(x) && Object.getPrototypeOf(x) === Object.prototype;

// Deep equality for JSON-like data (and bytes). A missing key and one set to undefined are the same.
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isBytes(a) || isBytes(b)) return isBytes(a) && isBytes(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]));
  }
  if (isPlain(a) && isPlain(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (!equal(a[k], b[k])) return false;
    return true;
  }
  return false;
}

// One value: whichever side changed it; `prefer` when both did.
export function merge3<T>(base: Base<T>, mine: T, theirs: T, prefer: Side = 'mine'): T {
  if (equal(mine, theirs)) return mine;
  if (base !== NONE) {
    if (equal(mine, base)) return theirs;
    if (equal(theirs, base)) return mine;
  } else {   // nothing to tell a deletion by: what only one side has is kept
    if (mine === undefined) return theirs;
    if (theirs === undefined) return mine;
  }
  return prefer === 'mine' ? mine : theirs;
}

// The field of a base object (NONE when there is no base object at all).
export const field = <T, K extends keyof T>(base: Base<T> | undefined, k: K): Base<T[K]> =>
  base === NONE || base === undefined ? NONE : base[k];

type FieldMerge = (base: Base<any>, mine: any, theirs: any) => any;

// An object, field by field. `custom` merges the fields that need their own rule; undefined results are left out.
export function mergeFields<T extends object>(base: Base<T>, mine: T, theirs: T, prefer: Side = 'mine', custom: { [K in keyof T]?: FieldMerge } = {}): T {
  const out: Record<string, unknown> = {};
  const m = mine as Record<string, unknown>, t = theirs as Record<string, unknown>;
  for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) {
    const b = field(base as Base<Record<string, unknown>>, k);
    const own = (custom as Record<string, FieldMerge | undefined>)[k];
    const v = own ? own(b, m[k], t[k]) : merge3(b, m[k], t[k], prefer);
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

// A set of plain values (days, tags, ids): kept when both sides have it, or when one side added it; gone when either side
// removed it. Mine's order, then what only theirs has.
export function mergeSet<T extends string | number>(base: Base<readonly T[]> | undefined, mine: readonly T[] = [], theirs: readonly T[] = []): T[] {
  const m = new Set(mine), t = new Set(theirs);
  const b = base === NONE || base === undefined ? null : new Set(base);
  const keep = (x: T) => (m.has(x) && t.has(x)) || (!b && (m.has(x) || t.has(x))) || (!!b && !b.has(x));
  return [...new Set([...mine, ...theirs])].filter(keep);
}
export const mergeDays = (base: Base<readonly number[]> | undefined, mine?: readonly number[], theirs?: readonly number[]) =>
  mergeSet(base, mine, theirs).sort((a, b) => a - b);

export interface KeyedOptions<T> {
  // Both sides have it (and the base, if it had it): one item out of the three.
  item?: (base: Base<T>, mine: T, theirs: T) => T;
  // An item one side deleted while the other changed it is normally kept (a change beats a delete); true lets the delete win.
  deleteWins?: (key: string) => boolean;
}

// Items matched by key (an id, a name, a day). Mine's order, then the items only theirs has, in their order.
export function mergeKeyed<T>(base: Base<Map<string, T>>, mine: Map<string, T>, theirs: Map<string, T>, o: KeyedOptions<T> = {}): Map<string, T> {
  const item = o.item ?? ((b, m, t) => merge3(b, m, t));
  const out = new Map<string, T>();
  for (const k of keyOrder(base, mine, theirs)) {
    const b: Base<T> = base !== NONE && base.has(k) ? base.get(k) as T : NONE;
    const m = mine.get(k), t = theirs.get(k);
    if (mine.has(k) && theirs.has(k)) { out.set(k, item(b, m as T, t as T)); continue; }
    const only = (mine.has(k) ? m : t) as T;
    if (b === NONE) { out.set(k, only); continue; }                              // added on one side
    if (equal(only, b) || o.deleteWins?.(k)) continue;                             // deleted on the other, untouched here
    out.set(k, only);                                                              // deleted there, changed here: kept
  }
  return out;
}

// The order the keys come in: mine's, then what only theirs has. But when only theirs put the items it shares with mine
// (and the base) in another order, that is a reorder to keep, so theirs' order goes first. A side that left the list
// as the base had it gives the other side's order whole, new items in their places.
function keyOrder<T>(base: Base<Map<string, T>>, mine: Map<string, T>, theirs: Map<string, T>): string[] {
  const m = [...mine.keys()], t = [...theirs.keys()];
  if (base !== NONE) {
    const same = (keys: string[]) => keys.length === base.size && keys.every((k) => base.has(k)) && keys.join('\u0000') === [...base.keys()].join('\u0000');
    if (same(m)) return [...new Set([...t, ...m])];   // this side left the list alone: the other side's list as it is
    if (same(t)) return [...new Set([...m, ...t])];
    const common = new Set(m.filter((k) => theirs.has(k) && base.has(k)));
    const seq = (keys: Iterable<string>) => [...keys].filter((k) => common.has(k)).join('\u0000');
    if (seq(m) === seq(base.keys()) && seq(t) !== seq(base.keys())) return [...new Set([...t, ...m])];
  }
  return [...new Set([...m, ...t])];
}

export const byKey = <T>(items: readonly T[] = [], key: (x: T) => string) => new Map(items.map((x) => [key(x), x] as const));
const baseMap = <T>(base: Base<readonly T[]> | undefined, key: (x: T) => string): Base<Map<string, T>> =>
  base === NONE || base === undefined ? NONE : byKey(base, key);

export function mergeList<T>(base: Base<readonly T[]> | undefined, mine: readonly T[] = [], theirs: readonly T[] = [], key: (x: T) => string, o: KeyedOptions<T> = {}): T[] {
  return [...mergeKeyed(baseMap(base, key), byKey(mine, key), byKey(theirs, key), o).values()];
}
export const mergeById = <T extends { id: string }>(base: Base<readonly T[]> | undefined, mine: readonly T[] = [], theirs: readonly T[] = [], o: KeyedOptions<T> = {}) =>
  mergeList(base, mine, theirs, (x) => x.id, o);

const entries = <T>(r: Record<string, T> | undefined) => new Map(Object.entries(r ?? {}));
export function mergeRecord<T>(base: Base<Record<string, T>> | undefined, mine: Record<string, T> | undefined, theirs: Record<string, T> | undefined, o: KeyedOptions<T> = {}): Record<string, T> {
  return Object.fromEntries(mergeKeyed(base === NONE || base === undefined ? NONE : entries(base), entries(mine), entries(theirs), o));
}

// Which side wins a clash between two versions of one record: the one changed last, mine on a tie.
export const newer = (mine: number | undefined, theirs: number | undefined): Side => ((theirs ?? 0) > (mine ?? 0) ? 'theirs' : 'mine');

// Text both sides changed is never thrown away: the newer text first, the older one under a line.
export const CLASH_LINE = '\n\n---\n\n';
export function mergeText(base: Base<string>, mine: string, theirs: string, prefer: Side): string {
  if (equal(mine, theirs)) return mine;
  if (base !== NONE && (mine === base || theirs === base)) return merge3(base, mine, theirs);
  if (!mine.trim()) return theirs;
  if (!theirs.trim()) return mine;
  return prefer === 'mine' ? `${mine}${CLASH_LINE}${theirs}` : `${theirs}${CLASH_LINE}${mine}`;
}

// Any JSON data, without rules of its own: objects field by field, lists of objects with an id item by item, lists of
// plain values as sets, anything else as one value. `prefer` picks for each record on a clash (it sees both versions; undefined leaves it to the record around it).
export function mergeDeep(base: Base<unknown>, mine: unknown, theirs: unknown, prefer: (m: any, t: any) => Side | undefined = () => undefined): unknown {
  const deep = (b: Base<unknown>, m: unknown, t: unknown, side: Side): unknown => {
    if (isPlain(m) && isPlain(t)) {
      const s = prefer(m, t) ?? side;
      const out: Record<string, unknown> = {};
      for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) {
        const v = deep(isPlain(b) ? b[k] : NONE, m[k], t[k], s);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    if (Array.isArray(m) && Array.isArray(t)) {
      const bArr = Array.isArray(b) ? b : NONE;
      const hasId = (a: unknown[]) => a.every((x) => isPlain(x) && typeof x.id === 'string');
      if (hasId(m) && hasId(t) && (bArr === NONE || hasId(bArr))) {
        return mergeById(bArr as Base<{ id: string }[]>, m as { id: string }[], t as { id: string }[], { item: (bb, mm, tt) => deep(bb, mm, tt, side) as { id: string } });
      }
      const flat = (a: unknown[]) => a.every((x) => typeof x === 'string' || typeof x === 'number');
      if (flat(m) && flat(t) && (bArr === NONE || flat(bArr))) {
        if (equal(m, t)) return m;
        if (bArr !== NONE && equal(m, bArr)) return t;   // only one side changed it (a new order too): that one
        if (bArr !== NONE && equal(t, bArr)) return m;
        return mergeSet(bArr as Base<(string | number)[]>, m as (string | number)[], t as (string | number)[]);
      }
    }
    return merge3(b, m, t, side);
  };
  return deep(base, mine, theirs, 'mine');
}
