// Kitty Mart's data and every rule it follows, with no screen and no storage: the shopping lists (one per supermarket),
// the regulars (what you buy, how often, reminders), the recipes and the pantry (stuff you have). ./data.ts keeps it on
// the device, ./app.ts draws it.

// ---- categories: the user's own, each with sub-categories (used to sort the pantry), a picture and a colour ----
// A category is known by its id everywhere. The starting ones keep the ids they always had, so older data fits them.
// "Other" is always there: whatever loses its category goes into it.
export const CAT_COLORS = ['pink', 'lavender', 'blue', 'mint', 'lemon', 'peach'] as const;   // the notes' window colours
export type CatColor = (typeof CAT_COLORS)[number];
export type Category = string;
export interface Sub { id: string; name: string }
export interface Cat { id: string; name: string; icon: string; color: CatColor; subs: Sub[] }
export const OTHER = 'other';
const DEFAULT_CATS: [string, string, string, CatColor][] = [
  ['produce', 'Fruit & veg', 'apple', 'mint'], ['dairy', 'Dairy & eggs', 'chick', 'lemon'], ['bakery', 'Bakery', 'food', 'peach'],
  ['meat', 'Meat & fish', 'fish', 'pink'], ['frozen', 'Frozen', 'snow', 'blue'], ['pantry', 'Cupboard', 'home', 'peach'],
  ['drinks', 'Drinks', 'coffee', 'blue'], ['snacks', 'Snacks', 'cake', 'pink'], ['household', 'Household', 'bulb', 'lavender'],
  ['care', 'Personal care', 'sparkle', 'mint'], [OTHER, 'Other', 'bag', 'lavender'],
];
export const defaultCats = (): Cat[] => DEFAULT_CATS.map(([id, name, icon, color]) => ({ id, name, icon, color, subs: [] }));

// from: the recipes that put it on the list (shown next to it, greyed out)
export interface Item { id: string; name: string; qty: string; unit: string; cat: Category; done: boolean; dupOk?: boolean; from?: string[] }
const FROM_KEPT = 5;
export interface List { id: string; name: string; items: Item[] }
// How a regular comes back: only when you add it, on every trip, or every so many days.
export type Rule = 'none' | 'always' | 'every';
export interface Regular {
  name: string; store: string;          // the list it goes on ('' any)
  qty: string; unit: string; cat: Category;
  pinned: boolean; rule: Rule; every: number;   // days, for 'every'
  remind: string; repeat: number;       // a reminder on that day (YYYY-MM-DD, '' none), then again every `repeat` days (0 once)
  bought: number[];                     // when it was bought, the newest last (the last 12)
}
export interface Ingredient { name: string; qty: string; unit: string; cat: Category }
export interface Recipe { id: string; name: string; items: Ingredient[]; notes: string }
// sub: a sub-category's id ('' none). full: the amount it came in with, when − has counted it down since (that is what goes back in).
export interface Have { id: string; name: string; qty: string; unit: string; cat: Category; sub: string; low: boolean; full?: string }
// Something that was in the pantry and was used up: kept, so it can go back in with one tap.
export interface Had { name: string; qty: string; unit: string; cat: Category; sub: string; gone: number; times: number }
// Where an item goes, once you have put it somewhere yourself ("maple syrup is in the cupboard"). It wins over the guess.
export interface Place { cat: Category; sub: string }
// showEmpty: the pantry shows the categories with nothing in them too
export interface Options { sink: boolean; learn: boolean; toPantry: boolean; showEmpty: boolean }
export interface ShopData {
  v: 2; lists: List[]; regulars: Record<string, Regular>; recipes: Recipe[]; pantry: Have[];
  cats: Cat[];
  places: Record<string, Place>;        // an item's key → where it goes
  had: Record<string, Had>;             // an item's key → when it was last used up
  dismissed: Record<string, string>;    // a dismissed suggestion's key → the turn it was dismissed for
  opts: Options;
}

export const LIMITS = { lists: 30, items: 300, regulars: 1000, recipes: 300, pantry: 500, name: 60, notes: 4000, cats: 40, subs: 30, places: 2000, had: 1000 };
const BOUGHT_KEPT = 12;
const DAY = 86_400_000;

export const emptyData = (): ShopData => ({
  v: 2, lists: [], regulars: {}, recipes: [], pantry: [], cats: defaultCats(), places: {}, had: {}, dismissed: {}, opts: { sink: true, learn: true, toPantry: false, showEmpty: true },
});
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---- names ----
export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
// Two names are the same item when they match ignoring case, spaces and a plural s ("Eggs" and "egg").
export function keyOf(name: string): string {
  const k = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return k.length > 3 && k.endsWith('es') && /(ch|sh|ss|x|o)es$/.test(k) ? k.slice(0, -2) : k.length > 3 && k.endsWith('s') && !k.endsWith('ss') ? k.slice(0, -1) : k;
}

// ---- quantities: "2 milk", "500g flour", "flour 500 g", "1,5 l milk" ----
const UNITS = ['kg', 'g', 'mg', 'ml', 'cl', 'dl', 'l', 'pcs', 'pc', 'x', 'pack', 'packs', 'can', 'cans', 'bottle', 'bottles', 'bag', 'bags', 'box', 'boxes', 'jar', 'jars', 'bunch', 'tbsp', 'tsp', 'cup', 'cups', 'slices'];
const UNIT_RE = UNITS.join('|');
const LEAD = new RegExp(`^(\\d+(?:[.,]\\d+)?|\\d+/\\d+)\\s*(${UNIT_RE})?(?=\\s)\\s+(.+)$`, 'i');
const TAIL = new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?|\\d+/\\d+)\\s*(${UNIT_RE})?$`, 'i');
export function parseQuick(text: string): { name: string; qty: string; unit: string } {
  const t = text.replace(/\s+/g, ' ').trim();
  const fix = (unit: string | undefined) => { const u = (unit ?? '').toLowerCase(); return u === 'x' ? '' : u; };
  let m = LEAD.exec(t);
  if (m) return { qty: m[1], unit: fix(m[2]), name: cleanName(m[3]) };
  m = TAIL.exec(t);
  if (m) return { qty: m[2], unit: fix(m[3]), name: cleanName(m[1]) };
  return { qty: '', unit: '', name: cleanName(t) };
}
export const qtyText = (x: { qty: string; unit: string }) => [x.qty, x.unit].filter(Boolean).join(x.unit.length > 2 ? ' ' : '');
export const itemText = (x: { name: string; qty: string; unit: string }) => [qtyText(x), x.name].filter(Boolean).join(' ');

// ---- categories: where you put it before, else guessed from the name ----
const GUESS: [Category, RegExp][] = [
  ['dairy', /milk|cheese|yog(h)?urt|butter|cream|quark|egg|feta|mozzarella|parmesan|kefir|skyr/],
  ['produce', /apple|banana|orange|lemon|lime|pear|grape|berr|tomato|potato|onion|garlic|carrot|lettuce|salad|spinach|cucumber|pepper|zucchini|courgette|avocado|mushroom|herb|basil|parsley|ginger|fruit|veg|broccoli|cabbage|leek|celery|kiwi|mango|melon/],
  ['bakery', /bread|roll|bun|bagel|croissant|toast|baguette|cake|pretzel|wrap|tortilla/],
  ['meat', /chicken|beef|pork|mince|ham|bacon|sausage|salami|turkey|fish|salmon|tuna|shrimp|prawn|lamb|steak|tofu/],
  ['frozen', /frozen|ice cream|pizza|fries|peas/],
  ['drinks', /water|juice|coffee|tea|beer|wine|soda|cola|lemonade|drink/],
  ['snacks', /chocolate|chips|crisps|cookie|biscuit|candy|sweets|nuts|popcorn|snack|gum/],
  ['household', /paper|towel|tissue|detergent|soap|dish|sponge|bag|foil|cling|bin|bulb|batter|clean|bleach|softener|napkin/],
  ['care', /shampoo|conditioner|toothpaste|toothbrush|deodorant|razor|lotion|cream|plaster|floss|tampon|pad|vitamin|medicine/],
  ['pantry', /flour|sugar|salt|rice|pasta|noodle|oil|vinegar|sauce|spice|cereal|oat|bean|lentil|can|jam|honey|stock|broth|yeast|baking|ketchup|mustard|mayo/],
];
type Known = Partial<Pick<ShopData, 'regulars' | 'places' | 'had' | 'cats'>>;
export function guessCategory(name: string, d: Known = {}): Category {
  const k = keyOf(name);
  const known = d.places?.[k]?.cat ?? d.regulars?.[k]?.cat ?? d.had?.[k]?.cat;
  if (known) return known;
  const n = name.toLowerCase();
  const c = GUESS.find(([, re]) => re.test(n))?.[0] ?? OTHER;
  return !d.cats || d.cats.some((x) => x.id === c) ? c : OTHER;   // a guess into a category that was deleted goes to Other
}
export const catOf = (d: Pick<ShopData, 'cats'>, id: string) => d.cats.find((c) => c.id === id);
export const catName = (d: Pick<ShopData, 'cats'>, id: string) => catOf(d, id)?.name ?? 'Other';
const subIn = (d: Pick<ShopData, 'cats'>, cat: string, sub: string) => (sub && catOf(d, cat)?.subs.some((s) => s.id === sub) ? sub : '');
// Where an item goes: where you put it yourself, else the guess (with no sub-category).
export function placeOf(d: ShopData, name: string): Place {
  const k = keyOf(name), p = d.places[k];
  if (p) return p;
  const cat = guessCategory(name, d);
  const h = d.pantry.find((x) => keyOf(x.name) === k) ?? d.had[k];
  return { cat, sub: h && h.cat === cat ? h.sub : '' };
}

// You put an item somewhere: it goes there everywhere (on the lists, in the pantry, the regulars and the recipes) and
// from now on. With no `sub`, it keeps its sub-category if it stays in the same category.
export function learnPlace(d: ShopData, name: string, cat: Category, sub?: string): ShopData {
  if (!catOf(d, cat)) return d;
  const k = keyOf(name), was = placeOf(d, name);
  const s = subIn(d, cat, sub ?? (was.cat === cat ? was.sub : ''));
  const x = clone(d);
  if (x.places[k] || Object.keys(x.places).length < LIMITS.places) x.places[k] = { cat, sub: s };
  for (const l of x.lists) for (const i of l.items) if (keyOf(i.name) === k) i.cat = cat;
  for (const h of x.pantry) if (keyOf(h.name) === k) { h.cat = cat; h.sub = s; }
  if (x.had[k]) { x.had[k].cat = cat; x.had[k].sub = s; }
  if (x.regulars[k]) x.regulars[k].cat = cat;
  for (const r of x.recipes) for (const i of r.items) if (keyOf(i.name) === k) i.cat = cat;
  return x;
}

// ---- making and changing categories ----
export interface CatEdit { name: string; icon: string; color: CatColor; subs: { id: string; name: string }[] }   // a new sub has id ''
export const catNameTaken = (d: ShopData, name: string, id: string | null) => d.cats.some((c) => c.id !== id && c.name.toLowerCase() === cleanName(name).toLowerCase());
// Makes a category (id null; it goes before Other) or changes one. Sub-categories missing from `subs` are deleted: what was in them stays in the category.
export function saveCat(d: ShopData, id: string | null, e: CatEdit): { data: ShopData; id: string } | null {
  const name = cleanName(e.name);
  if (!name || catNameTaken(d, name, id) || (!id && d.cats.length >= LIMITS.cats)) return null;
  const x = clone(d);
  let c = id ? catOf(x, id) : undefined;
  if (id && !c) return null;
  if (!c) {
    c = { id: newId(), name, icon: '', color: 'lavender', subs: [] };
    const at = x.cats.findIndex((y) => y.id === OTHER);
    x.cats.splice(at < 0 ? x.cats.length : at, 0, c);
  }
  c.name = name;
  c.icon = /^[a-z0-9-]{1,20}$/.test(e.icon) ? e.icon : 'bag';
  c.color = (CAT_COLORS as readonly string[]).includes(e.color) ? e.color : 'lavender';
  const subs: Sub[] = [], seen = new Set<string>();
  for (const s of e.subs) {
    const n = cleanName(s.name);
    if (!n || seen.has(n.toLowerCase()) || subs.length >= LIMITS.subs) continue;
    seen.add(n.toLowerCase());
    subs.push({ id: c.subs.some((y) => y.id === s.id) ? s.id : newId(), name: n });
  }
  const gone = new Set(c.subs.map((s) => s.id).filter((s) => !subs.some((y) => y.id === s)));
  c.subs = subs;
  if (gone.size) for (const h of [...x.pantry, ...Object.values(x.had), ...Object.values(x.places)]) if (h.cat === c.id && gone.has(h.sub)) h.sub = '';
  return { data: x, id: c.id };
}
export function addSub(d: ShopData, catId: string, name: string): { data: ShopData; id: string } | null {
  const c = catOf(d, catId), n = cleanName(name);
  if (!c || !n) return null;
  const same = c.subs.find((s) => s.name.toLowerCase() === n.toLowerCase());
  if (same) return { data: d, id: same.id };
  const r = saveCat(d, catId, { ...c, subs: [...c.subs, { id: '', name: n }] });
  return r && { data: r.data, id: catOf(r.data, catId)!.subs.at(-1)!.id };
}
// Deletes a category (not Other): everything in it goes into Other.
export function deleteCat(d: ShopData, id: string): ShopData {
  if (id === OTHER || !catOf(d, id)) return d;
  const x = clone(d);
  x.cats = x.cats.filter((c) => c.id !== id);
  const move = (o: { cat: Category; sub?: string }) => { if (o.cat === id) { o.cat = OTHER; if (o.sub !== undefined) o.sub = ''; } };
  for (const l of x.lists) l.items.forEach(move);
  for (const r of x.recipes) r.items.forEach(move);
  [...x.pantry, ...Object.values(x.had), ...Object.values(x.places), ...Object.values(x.regulars)].forEach(move);
  return x;
}
// Moves a category one place earlier (-1) or later (1): the lists are sorted in this order too (the way through the shop).
export function moveCat(d: ShopData, id: string, by: -1 | 1): ShopData {
  const i = d.cats.findIndex((c) => c.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= d.cats.length) return d;
  const x = clone(d);
  [x.cats[i], x.cats[j]] = [x.cats[j], x.cats[i]];
  return x;
}

// ---- days ----
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const dayTime = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))).getTime();
export const addDays = (key: string, n: number) => { const d = new Date(dayTime(key)); d.setDate(d.getDate() + n); return dayKey(d.getTime()); };
export const daysSince = (t: number, now: number) => Math.round((dayTime(dayKey(now)) - dayTime(dayKey(t))) / DAY);

// ---- loading: anything damaged or missing becomes its default ----
const str = (v: unknown, max = LIMITS.name) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function sanitize(raw: unknown): ShopData {
  const r = obj(raw), d = emptyData();
  // the categories first (older data has none: it gets the starting ones, whose ids it already uses)
  const ids = new Set<string>();
  const cats: Cat[] = [];
  for (const c of arr(r.cats).slice(0, LIMITS.cats).map((x) => obj(x))) {
    const id = str(c.id, 20), name = cleanName(str(c.name));
    if (!id || !name || ids.has(id)) continue;
    ids.add(id);
    const subIds = new Set<string>();
    const subs = arr(c.subs).slice(0, LIMITS.subs).map((s) => obj(s)).map((s) => ({ id: str(s.id, 20), name: cleanName(str(s.name)) }))
      .filter((s) => s.id && s.name && !subIds.has(s.id) && subIds.add(s.id));
    cats.push({ id, name, icon: /^[a-z0-9-]{1,20}$/.test(str(c.icon)) ? str(c.icon) : 'bag', color: (CAT_COLORS as readonly string[]).includes(str(c.color)) ? (str(c.color) as CatColor) : 'lavender', subs });
  }
  if (cats.length) d.cats = cats;
  if (!d.cats.some((c) => c.id === OTHER)) d.cats.push(defaultCats().find((c) => c.id === OTHER)!);
  const cat = (v: unknown): Category => (typeof v === 'string' && d.cats.some((c) => c.id === v) ? v : OTHER);
  const sub = (c: Category, v: unknown) => subIn(d, c, str(v, 20));
  const o = obj(r.opts);
  d.opts = { sink: o.sink !== false, learn: o.learn !== false, toPantry: o.toPantry === true, showEmpty: o.showEmpty !== false };
  d.lists = arr(r.lists).slice(0, LIMITS.lists).map((l) => obj(l)).filter((l) => str(l.name).trim()).map((l) => ({
    id: str(l.id) || newId(), name: cleanName(str(l.name)),
    items: arr(l.items).slice(0, LIMITS.items).map((i) => obj(i)).filter((i) => str(i.name).trim()).map((i) => ({
      id: str(i.id) || newId(), name: cleanName(str(i.name)), qty: str(i.qty, 12), unit: str(i.unit, 12), cat: cat(i.cat), done: i.done === true, ...(i.dupOk === true && { dupOk: true }),
      ...(arr(i.from).length && { from: [...new Set(arr(i.from).map((f) => cleanName(str(f))).filter(Boolean))].slice(0, FROM_KEPT) }),
    })),
  }));
  for (const v of Object.values(obj(r.regulars)).slice(0, LIMITS.regulars)) {
    const g = obj(v), name = cleanName(str(g.name));
    if (!name) continue;
    const rule = g.rule === 'always' || g.rule === 'every' ? g.rule : 'none';
    d.regulars[keyOf(name)] = {
      name, store: str(g.store), qty: str(g.qty, 12), unit: str(g.unit, 12), cat: cat(g.cat), pinned: g.pinned === true, rule,
      every: num(g.every, 3650), remind: isDay(str(g.remind)) ? str(g.remind) : '', repeat: num(g.repeat, 3650),
      bought: arr(g.bought).filter((t): t is number => typeof t === 'number' && Number.isFinite(t)).sort((a, b) => a - b).slice(-BOUGHT_KEPT),
    };
  }
  const ing = (i: Record<string, unknown>): Ingredient => ({ name: cleanName(str(i.name)), qty: str(i.qty, 12), unit: str(i.unit, 12), cat: cat(i.cat) });
  d.recipes = arr(r.recipes).slice(0, LIMITS.recipes).map((x) => obj(x)).filter((x) => str(x.name).trim()).map((x) => ({
    id: str(x.id) || newId(), name: cleanName(str(x.name)), notes: str(x.notes, LIMITS.notes),
    items: arr(x.items).slice(0, 100).map((i) => ing(obj(i))).filter((i) => i.name),
  }));
  d.pantry = arr(r.pantry).slice(0, LIMITS.pantry).map((x) => obj(x)).filter((x) => str(x.name).trim()).map((x) => {
    const c = cat(x.cat);
    return { id: str(x.id) || newId(), name: cleanName(str(x.name)), qty: str(x.qty, 12), unit: str(x.unit, 12), cat: c, sub: sub(c, x.sub), low: x.low === true, ...(str(x.full, 12) && { full: str(x.full, 12) }) };
  });
  for (const [k, v] of Object.entries(obj(r.places)).slice(0, LIMITS.places)) {
    const p = obj(v), c = cat(p.cat);
    if (k && d.cats.some((x) => x.id === p.cat)) d.places[k.slice(0, LIMITS.name)] = { cat: c, sub: sub(c, p.sub) };
  }
  for (const v of Object.values(obj(r.had)).slice(0, LIMITS.had)) {
    const h = obj(v), name = cleanName(str(h.name));
    if (!name) continue;
    const c = cat(h.cat);
    d.had[keyOf(name)] = { name, qty: str(h.qty, 12), unit: str(h.unit, 12), cat: c, sub: sub(c, h.sub), gone: num(h.gone, 8.64e15), times: Math.max(1, num(h.times, 100000)) };
  }
  for (const [k, v] of Object.entries(obj(r.dismissed))) if (typeof v === 'string') d.dismissed[k] = v.slice(0, 20);
  return d;
}

// Every change below works on a copy: the old data stays as it was, so it can be put back (undo).
export const clone = (d: ShopData): ShopData => structuredClone(d);

// ---- lists ----
export const listOf = (d: ShopData, id: string) => d.lists.find((l) => l.id === id);
export const onList = (l: List | undefined, name: string) => !!l?.items.some((i) => !i.done && keyOf(i.name) === keyOf(name));
export const onAnyList = (d: ShopData, name: string) => d.lists.some((l) => onList(l, name));

export function addList(d: ShopData, name: string): { data: ShopData; id: string } | null {
  const n = cleanName(name);
  if (!n || d.lists.length >= LIMITS.lists) return null;
  const same = d.lists.find((l) => l.name.toLowerCase() === n.toLowerCase());
  if (same) return { data: d, id: same.id };
  const x = clone(d), id = newId();
  x.lists.push({ id, name: n, items: [] });
  return { data: x, id };
}

// Adds an item to a list. One that is already on it (not crossed out) is left alone, so nothing is added twice.
export function addItem(d: ShopData, listId: string, it: { name: string; qty?: string; unit?: string; cat?: Category; from?: string[] }): { data: ShopData; added: boolean } {
  const name = cleanName(it.name);
  const l = listOf(d, listId);
  if (!name || !l || l.items.length >= LIMITS.items) return { data: d, added: false };
  if (onList(l, name)) return { data: d, added: false };
  const x = clone(d), xl = listOf(x, listId)!;
  const known = x.regulars[keyOf(name)];
  const qty = it.qty ?? known?.qty ?? '', unit = it.qty ? it.unit ?? '' : it.unit ?? known?.unit ?? '';
  xl.items = xl.items.filter((i) => keyOf(i.name) !== keyOf(name));   // a crossed-out copy goes: it is back on the list
  const from = it.from?.filter(Boolean).slice(0, FROM_KEPT);
  xl.items.push({ id: newId(), name, qty, unit, cat: it.cat ?? guessCategory(name, x), done: false, ...(from?.length && { from }) });
  return { data: x, added: true };
}

export function updateItem(d: ShopData, listId: string, id: string, patch: Partial<Omit<Item, 'id'>>): ShopData {
  const x = clone(d), i = listOf(x, listId)?.items.find((y) => y.id === id);
  if (!i) return d;
  Object.assign(i, patch);
  if (patch.name !== undefined) { i.name = cleanName(patch.name) || i.name; delete i.dupOk; }
  return x;
}
export function removeItems(d: ShopData, listId: string, ids: string[]): ShopData {
  const x = clone(d), l = listOf(x, listId);
  if (l) l.items = l.items.filter((i) => !ids.includes(i.id));
  return x;
}
export function moveItem(d: ShopData, from: string, id: string, to: string): ShopData {
  const it = listOf(d, from)?.items.find((i) => i.id === id);
  if (!it || from === to || !listOf(d, to)) return d;
  const r = addItem(removeItems(d, from, [id]), to, it);
  return r.data;
}

// The other lists that already have this item: "Also in Aldi shopping list."
export const alsoIn = (d: ShopData, listId: string, item: Item): string[] =>
  item.done || item.dupOk ? [] : d.lists.filter((l) => l.id !== listId && onList(l, item.name)).map((l) => l.name);

// The items in the order they are shown: by category, and with `sink` the crossed-out ones last.
// Within a category, `subOf` (an item's sub-category, '' none) sorts them into its sub-categories: `shelves` has what has
// no sub-category first (name ''), then one shelf per sub-category that has something, in the category's order.
export interface ListGroup { cat: Category | 'done'; items: Item[]; shelves: { sub: string; name: string; items: Item[] }[] }
export function shownItems(l: List, sink: boolean, cats: Cat[] = defaultCats(), subOf: (name: string) => string = () => ''): ListGroup[] {
  const groups: ListGroup[] = [];
  const open = sink ? l.items.filter((i) => !i.done) : l.items;
  for (const c of cats) {
    const items = open.filter((i) => i.cat === c.id || (c.id === OTHER && !cats.some((x) => x.id === i.cat)));
    if (!items.length) continue;
    const sub = (i: Item) => { const s = subOf(i.name); return c.subs.some((x) => x.id === s) ? s : ''; };
    const shelves = [{ sub: '', name: '' }, ...c.subs.map((s) => ({ sub: s.id, name: s.name }))]
      .map((s) => ({ ...s, items: items.filter((i) => sub(i) === s.sub) })).filter((s) => s.items.length);
    groups.push({ cat: c.id, items: shelves.flatMap((s) => s.items), shelves });
  }
  const done = sink ? l.items.filter((i) => i.done) : [];
  if (done.length) groups.push({ cat: 'done', items: done, shelves: [{ sub: '', name: '', items: done }] });
  return groups;
}

// ---- the shopping trip ----
// Everything crossed out was bought: it leaves the list and is remembered (how often you buy it), and goes into the pantry
// when `toPantry`. Then the regulars marked "always" come back onto the list. `drop` are unchecked items to delete too.
export function finishTrip(d: ShopData, listId: string, now: number, o: { toPantry: boolean; drop?: string[] }): { data: ShopData; bought: number } {
  const l0 = listOf(d, listId);
  if (!l0) return { data: d, bought: 0 };
  let x = clone(d);
  const l = listOf(x, listId)!;
  const bought = l.items.filter((i) => i.done);
  for (const i of bought) {
    x = recordPurchase(x, i, listId, now);
    if (o.toPantry) x = putInPantry(x, i);
    else { const h = x.pantry.find((p) => keyOf(p.name) === keyOf(i.name)); if (h) h.low = false; }
  }
  const xl = listOf(x, listId)!;
  xl.items = xl.items.filter((i) => !i.done && !(o.drop ?? []).includes(i.id));
  x = refillAlways(x, listId);
  return { data: x, bought: bought.length };
}

function recordPurchase(x: ShopData, i: Item, listId: string, now: number): ShopData {
  const k = keyOf(i.name);
  const g = x.regulars[k];
  if (g) {
    g.bought = [...g.bought, now].slice(-BOUGHT_KEPT);
    if (i.qty || i.unit) { g.qty = i.qty; g.unit = i.unit; }
    g.cat = i.cat;
    if (!g.store) g.store = listId;
  } else if (Object.keys(x.regulars).length < LIMITS.regulars) {
    x.regulars[k] = { name: i.name, store: listId, qty: i.qty, unit: i.unit, cat: i.cat, pinned: false, rule: 'none', every: 0, remind: '', repeat: 0, bought: [now] };
  }
  return x;
}

// The "always" regulars of this list (or of any list, when they have none) that are not on it.
export function refillAlways(d: ShopData, listId: string): ShopData {
  let x = d;
  for (const g of Object.values(d.regulars)) {
    if (g.rule !== 'always' || (g.store && g.store !== listId)) continue;
    if (!g.store && onAnyList(x, g.name)) continue;
    x = addItem(x, listId, { name: g.name, qty: g.qty, unit: g.unit, cat: g.cat }).data;
  }
  return x;
}

// ---- regulars ----
export function regularOf(d: ShopData, name: string): Regular | undefined { return d.regulars[keyOf(name)]; }
export function setRegular(d: ShopData, name: string, patch: Partial<Regular>): ShopData {
  const n = cleanName(patch.name ?? name);
  if (!n) return d;
  const x = clone(d), k = keyOf(name);
  const old = x.regulars[k] ?? { name: n, store: '', qty: '', unit: '', cat: guessCategory(n, x), pinned: false, rule: 'none' as Rule, every: 0, remind: '', repeat: 0, bought: [] };
  if (!x.regulars[k] && Object.keys(x.regulars).length >= LIMITS.regulars) return d;
  delete x.regulars[k];
  const g = { ...old, ...patch, name: n };
  x.regulars[keyOf(n)] = g;
  // an "always" item goes onto its list at once (with no list of its own, onto the first one)
  const to = g.rule !== 'always' ? undefined : g.store ? listOf(x, g.store) : x.lists[0];
  return to ? refillAlways(x, to.id) : x;
}
export function forgetRegular(d: ShopData, name: string): ShopData {
  const x = clone(d);
  delete x.regulars[keyOf(name)];
  return x;
}

// How often it is bought: the typical number of days between purchases (the median), once it was bought 3 times.
export function usualGap(g: Regular): number | null {
  if (g.bought.length < 3) return null;
  const gaps = g.bought.slice(1).map((t, i) => Math.max(1, Math.round((t - g.bought[i]) / DAY))).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}
export const lastBought = (g: Regular) => (g.bought.length ? g.bought[g.bought.length - 1] : null);

// ---- suggestions ----
export type SuggestKind = 'remind' | 'always' | 'every' | 'low' | 'often';
export interface Suggestion { key: string; turn: string; kind: SuggestKind; name: string; store: string; qty: string; unit: string; cat: Category; why: string }

const everyText = (n: number) => (n === 7 ? 'every week' : n === 14 ? 'every 2 weeks' : n === 30 || n === 31 ? 'every month' : n % 7 === 0 ? `every ${n / 7} weeks` : `every ${n} days`);
export const ruleText = everyText;

// What might need buying now, at most one suggestion per item, most pressing first. Each one has a `turn`: dismissing it
// hides it until the next turn comes (the next due day, the next reminder, the next time it runs low).
export function suggestions(d: ShopData, now: number): Suggestion[] {
  const today = dayKey(now);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (kind: SuggestKind, turn: string, x: { name: string; qty: string; unit: string; cat: Category }, store: string, why: string) => {
    const k = keyOf(x.name), key = `${kind}:${k}`;
    if (seen.has(k) || d.dismissed[key] === turn) return;
    const where = store ? listOf(d, store) : undefined;
    if (where ? onList(where, x.name) : onAnyList(d, x.name)) return;
    seen.add(k);
    out.push({ key, turn, kind, name: x.name, store: where ? store : '', qty: x.qty, unit: x.unit, cat: x.cat, why });
  };
  const regs = Object.values(d.regulars);
  for (const g of regs) if (g.remind && g.remind <= today) push('remind', g.remind, g, g.store, g.repeat ? `Reminder, ${everyText(g.repeat)}` : 'Reminder');
  for (const g of regs) if (g.rule === 'always') push('always', 'always', g, g.store, 'Always buy');
  for (const g of regs) {
    if (g.rule !== 'every' || !g.every) continue;
    const last = lastBought(g);
    const due = last === null ? today : addDays(dayKey(last), g.every);
    if (due <= today) push('every', due, g, g.store, last === null ? `Buy ${everyText(g.every)}` : `Buy ${everyText(g.every)} · last ${agoText(last, now)}`);
  }
  for (const h of d.pantry) if (h.low) { const g = regularOf(d, h.name); push('low', 'low', { ...h, qty: g?.qty ?? h.qty, unit: g?.unit ?? h.unit }, g?.store ?? '', 'Running low'); }
  if (d.opts.learn) for (const g of regs) {
    if (g.rule !== 'none') continue;
    const gap = usualGap(g), last = lastBought(g);
    if (gap === null || last === null) continue;
    const due = addDays(dayKey(last), gap);
    if (due <= today) push('often', due, g, g.store, `You buy it about ${everyText(gap)}`);
  }
  return out;
}

export const agoText = (t: number, now: number) => { const n = daysSince(t, now); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };

// Taking a suggestion (adding it) or dismissing it. A reminder moves on to its next day, or ends; anything else is hidden for this turn.
export function settleSuggestion(d: ShopData, s: Suggestion, now: number): ShopData {
  const x = clone(d);
  if (s.kind === 'remind') {
    const g = x.regulars[keyOf(s.name)];
    if (g) { let next = g.remind; if (g.repeat) { while (next <= dayKey(now)) next = addDays(next, g.repeat); } else next = ''; g.remind = next; }
  } else x.dismissed[s.key] = s.turn;
  return x;
}
export function takeSuggestion(d: ShopData, s: Suggestion, listId: string, now: number): ShopData {
  return settleSuggestion(addItem(d, listId, { name: s.name, qty: s.qty, unit: s.unit, cat: s.cat }).data, s, now);
}

// ---- pantry: the stuff you have, sorted into categories and their sub-categories ----
// Puts something in (the callers pass a copy, which is changed). Something already in stays one thing: it is no longer low,
// and takes the new amount. Something new goes where it went before, in the category it comes with.
export function putInPantry(x: ShopData, it: { name: string; qty: string; unit: string; cat: Category; sub?: string }): ShopData {
  const h = inPantry(x, it.name);
  if (h) { h.low = false; if (it.qty) { h.qty = it.qty; h.unit = it.unit; delete h.full; } return x; }
  if (x.pantry.length >= LIMITS.pantry) return x;
  const p = placeOf(x, it.name), was = x.had[keyOf(it.name)];
  const name = was && it.name === it.name.toLowerCase() ? was.name : cleanName(it.name);   // "flour" keeps the way it was written ("Flour")
  x.pantry.push({ id: newId(), name, qty: it.qty, unit: it.unit, cat: it.cat, sub: subIn(x, it.cat, it.sub ?? (p.cat === it.cat ? p.sub : '')), low: false });
  return x;
}
// Adds to the pantry from its add box. With a category (added from that category's page) it goes there, and from now on
// everywhere; with none, wherever it went before.
export function addToPantry(d: ShopData, it: { name: string; qty: string; unit: string; cat?: Category; sub?: string }): ShopData {
  if (!cleanName(it.name)) return d;
  const x = it.cat && catOf(d, it.cat) ? learnPlace(d, it.name, it.cat, it.sub) : clone(d);
  const p = placeOf(x, it.name);
  return putInPantry(x === d ? clone(d) : x, { name: it.name, qty: it.qty, unit: it.unit, cat: p.cat, sub: p.sub });
}
export const inPantry = (d: ShopData, name: string) => d.pantry.find((p) => keyOf(p.name) === keyOf(name));

// Changes something in the pantry. A new category or sub-category is remembered for that item everywhere.
export function updateHave(d: ShopData, id: string, patch: Partial<Pick<Have, 'name' | 'qty' | 'unit' | 'low' | 'cat' | 'sub'>>): ShopData {
  let x = clone(d);
  const h = x.pantry.find((p) => p.id === id);
  if (!h) return d;
  if (patch.name !== undefined) h.name = cleanName(patch.name) || h.name;
  if (patch.qty !== undefined && patch.qty.trim().slice(0, 12) !== h.qty) { h.qty = patch.qty.trim().slice(0, 12); delete h.full; }
  if (patch.unit !== undefined) h.unit = patch.unit.trim().slice(0, 12);
  if (patch.low !== undefined) h.low = patch.low;
  const cat = patch.cat ?? h.cat, sub = subIn(x, cat, patch.sub ?? (cat === h.cat ? h.sub : ''));
  if (cat !== h.cat || sub !== h.sub || (patch.cat !== undefined && x.places[keyOf(h.name)]?.cat !== cat)) x = learnPlace(x, h.name, cat, sub);
  return x;
}

// Used up: it leaves the pantry and is remembered under "Had before".
export function useUp(d: ShopData, id: string, now: number): ShopData {
  const h = d.pantry.find((p) => p.id === id);
  if (!h) return d;
  const x = clone(d), k = keyOf(h.name), old = x.had[k];
  x.pantry = x.pantry.filter((p) => p.id !== id);
  if (old || Object.keys(x.had).length < LIMITS.had) x.had[k] = { name: h.name, qty: h.full ?? h.qty, unit: h.unit, cat: h.cat, sub: h.sub, gone: now, times: (old?.times ?? 0) + 1 };
  return x;
}
// Back in the pantry, as it was.
export function restock(d: ShopData, key: string): ShopData {
  const g = d.had[key];
  return g ? addToPantry(d, { name: g.name, qty: g.qty, unit: g.unit, cat: g.cat, sub: g.sub }) : d;
}
export function forgetHad(d: ShopData, key: string): ShopData {
  if (!d.had[key]) return d;
  const x = clone(d);
  delete x.had[key];
  return x;
}

// Things you count (6 eggs, 2 cans) get a − and a + key; taking the last one away uses it up.
const COUNTED = /^(|pcs?|packs?|cans?|bottles?|bags?|box(es)?|jars?|bunch|slices|rolls?|tins?)$/i;
export const canStep = (h: Have) => /^\d{1,4}$/.test(h.qty) && COUNTED.test(h.unit);
export function stepHave(d: ShopData, id: string, by: number, now: number): { data: ShopData; usedUp: boolean } {
  const h = d.pantry.find((p) => p.id === id);
  if (!h || !canStep(h)) return { data: d, usedUp: false };
  const n = Number(h.qty) + by;
  if (n <= 0) return { data: useUp(d, id, now), usedUp: true };
  const x = clone(d), y = x.pantry.find((p) => p.id === id)!;
  y.full ??= y.qty;
  y.qty = String(Math.min(n, 9999));
  if (y.qty === y.full) delete y.full;
  return { data: x, usedUp: false };
}

// A category's page: one shelf per sub-category (in their order, empty ones too), then what has no sub-category.
export interface Shelf { sub: string; name: string; items: Have[] }
export function shelves(d: ShopData, catId: string): Shelf[] {
  const c = catOf(d, catId);
  if (!c) return [];
  const mine = d.pantry.filter((h) => h.cat === catId).sort((a, b) => a.name.localeCompare(b.name));
  const out: Shelf[] = c.subs.map((s) => ({ sub: s.id, name: s.name, items: mine.filter((h) => h.sub === s.id) }));
  const loose = mine.filter((h) => !c.subs.some((s) => s.id === h.sub));
  if (loose.length || !out.length) out.push({ sub: '', name: c.subs.length ? 'Not sorted' : '', items: loose });
  return out;
}
// What was in the pantry before and isn't now, the most recent first (of one category, or of all).
export const hadBefore = (d: ShopData, catId?: string): (Had & { key: string })[] =>
  Object.entries(d.had).filter(([k, h]) => (!catId || h.cat === catId) && !d.pantry.some((p) => keyOf(p.name) === k))
    .map(([key, h]) => ({ key, ...h })).sort((a, b) => b.gone - a.gone);
export const pantryCount = (d: ShopData, catId: string) => {
  const items = d.pantry.filter((h) => h.cat === catId);
  return { n: items.length, low: items.filter((h) => h.low).length };
};
// The pantry search: what you have and what you had, whose name has the words typed.
export function findInPantry(d: ShopData, typed: string): { have: Have[]; had: (Had & { key: string })[] } {
  const q = parseQuick(typed).name.toLowerCase();
  if (!q) return { have: [], had: [] };
  const hit = (n: string) => n.toLowerCase().includes(q);
  return { have: d.pantry.filter((h) => hit(h.name)).sort((a, b) => a.name.localeCompare(b.name)), had: hadBefore(d).filter((h) => hit(h.name)) };
}

// ---- recipes ----
// Recipe ingredients are written one per line, like the quick add: "200 g flour".
export const parseIngredients = (text: string, known: Known = {}): Ingredient[] =>
  text.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean).slice(0, 100)
    .map((l) => { const p = parseQuick(l); return { ...p, cat: guessCategory(p.name, known) }; }).filter((i) => i.name);
export const ingredientsText = (items: Ingredient[]) => items.map(itemText).join('\n');

export type Need = 'have' | 'listed' | 'need';
// For each ingredient: you have it (in the pantry and not running low), it is already on the list, or it is missing.
export const recipeNeeds = (d: ShopData, r: Recipe, listId: string): { ing: Ingredient; need: Need }[] =>
  r.items.map((ing) => {
    const h = inPantry(d, ing.name);
    return { ing, need: h && !h.low ? 'have' : onList(listOf(d, listId), ing.name) ? 'listed' : 'need' };
  });
// Adds what is missing, marked with the recipe's name; what is already on the list gets the name too ("Broccoli (Stir fry, Soup)").
export function addRecipe(d: ShopData, r: Recipe, listId: string): { data: ShopData; added: number } {
  let x = d, added = 0;
  for (const { ing, need } of recipeNeeds(d, r, listId)) {
    if (need === 'need') {
      const res = addItem(x, listId, { ...ing, from: [r.name] });
      x = res.data; if (res.added) added++;
    } else if (need === 'listed') {
      const it = listOf(x, listId)?.items.find((i) => !i.done && keyOf(i.name) === keyOf(ing.name));
      if (!it || it.from?.includes(r.name) || (it.from?.length ?? 0) >= FROM_KEPT) continue;
      x = updateItem(x, listId, it.id, { from: [...(it.from ?? []), r.name] });
    }
  }
  return { data: x, added };
}

// ---- sharing a list as plain text, and reading one back ----
export const listToText = (l: List) => [`🛒 ${l.name}`, ...l.items.filter((i) => !i.done).map((i) => `- ${itemText(i)}`)].join('\n');
export function textToList(text: string): { name: string; items: { name: string; qty: string; unit: string }[] } {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const head = lines[0] && !/^([-*•]|\[[ x]\])/.test(lines[0]) ? lines.shift()!.replace(/^🛒\s*/u, '') : '';
  const items = lines.map((s) => s.replace(/^(?:[-*•]\s*)?(?:\[[ xX]\]\s*)?/, '')).filter(Boolean).slice(0, LIMITS.items).map(parseQuick).filter((i) => i.name);
  return { name: cleanName(head), items };
}

// ---- autocomplete ----
// The known items whose name starts with (then contains) what was typed, the most bought first.
export function complete(d: ShopData, typed: string, listId: string, max = 6): Regular[] {
  const q = parseQuick(typed).name.toLowerCase();
  if (!q) return [];
  const l = listOf(d, listId);
  const cand = Object.values(d.regulars).filter((g) => !onList(l, g.name) && g.name.toLowerCase().includes(q) && g.name.toLowerCase() !== q);
  const score = (g: Regular) => (g.name.toLowerCase().startsWith(q) ? 0 : 1) * 1000 - (g.pinned ? 100 : 0) - g.bought.length;
  return cand.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name)).slice(0, max);
}
