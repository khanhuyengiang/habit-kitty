// Kitty Mart's data and every rule it follows, with no screen and no storage: the shopping lists (one per supermarket),
// the regulars (what you buy, how often, reminders), the recipes and the pantry (stuff you have). ./data.ts keeps it on
// the device, ./app.ts draws it.

export const CATEGORIES = ['produce', 'dairy', 'bakery', 'meat', 'frozen', 'pantry', 'drinks', 'snacks', 'household', 'care', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<Category, string> = {
  produce: 'Fruit & veg', dairy: 'Dairy & eggs', bakery: 'Bakery', meat: 'Meat & fish', frozen: 'Frozen', pantry: 'Cupboard',
  drinks: 'Drinks', snacks: 'Snacks', household: 'Household', care: 'Personal care', other: 'Other',
};

export interface Item { id: string; name: string; qty: string; unit: string; cat: Category; done: boolean; dupOk?: boolean }
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
export interface Have { id: string; name: string; qty: string; unit: string; cat: Category; low: boolean }
export interface Options { sink: boolean; learn: boolean; toPantry: boolean }
export interface ShopData {
  v: 1; lists: List[]; regulars: Record<string, Regular>; recipes: Recipe[]; pantry: Have[];
  dismissed: Record<string, string>;    // a dismissed suggestion's key → the turn it was dismissed for
  opts: Options;
}

export const LIMITS = { lists: 30, items: 300, regulars: 1000, recipes: 300, pantry: 500, name: 60, notes: 4000 };
const BOUGHT_KEPT = 12;
const DAY = 86_400_000;

export const emptyData = (): ShopData => ({ v: 1, lists: [], regulars: {}, recipes: [], pantry: [], dismissed: {}, opts: { sink: true, learn: true, toPantry: false } });
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

// ---- categories: guessed from the name, unless the item is known ----
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
export function guessCategory(name: string, regulars: Record<string, Regular> = {}): Category {
  const known = regulars[keyOf(name)];
  if (known) return known.cat;
  const n = name.toLowerCase();
  return GUESS.find(([, re]) => re.test(n))?.[0] ?? 'other';
}

// ---- days ----
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const dayTime = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))).getTime();
export const addDays = (key: string, n: number) => { const d = new Date(dayTime(key)); d.setDate(d.getDate() + n); return dayKey(d.getTime()); };
export const daysSince = (t: number, now: number) => Math.round((dayTime(dayKey(now)) - dayTime(dayKey(t))) / DAY);

// ---- loading: anything damaged or missing becomes its default ----
const str = (v: unknown, max = LIMITS.name) => (typeof v === 'string' ? v.slice(0, max) : '');
const cat = (v: unknown): Category => ((CATEGORIES as readonly string[]).includes(v as string) ? (v as Category) : 'other');
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function sanitize(raw: unknown): ShopData {
  const r = obj(raw), d = emptyData();
  const o = obj(r.opts);
  d.opts = { sink: o.sink !== false, learn: o.learn !== false, toPantry: o.toPantry === true };
  d.lists = arr(r.lists).slice(0, LIMITS.lists).map((l) => obj(l)).filter((l) => str(l.name).trim()).map((l) => ({
    id: str(l.id) || newId(), name: cleanName(str(l.name)),
    items: arr(l.items).slice(0, LIMITS.items).map((i) => obj(i)).filter((i) => str(i.name).trim()).map((i) => ({
      id: str(i.id) || newId(), name: cleanName(str(i.name)), qty: str(i.qty, 12), unit: str(i.unit, 12), cat: cat(i.cat), done: i.done === true, ...(i.dupOk === true && { dupOk: true }),
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
  d.pantry = arr(r.pantry).slice(0, LIMITS.pantry).map((x) => obj(x)).filter((x) => str(x.name).trim()).map((x) => ({
    id: str(x.id) || newId(), name: cleanName(str(x.name)), qty: str(x.qty, 12), unit: str(x.unit, 12), cat: cat(x.cat), low: x.low === true,
  }));
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
export function addItem(d: ShopData, listId: string, it: { name: string; qty?: string; unit?: string; cat?: Category }): { data: ShopData; added: boolean } {
  const name = cleanName(it.name);
  const l = listOf(d, listId);
  if (!name || !l || l.items.length >= LIMITS.items) return { data: d, added: false };
  if (onList(l, name)) return { data: d, added: false };
  const x = clone(d), xl = listOf(x, listId)!;
  const known = x.regulars[keyOf(name)];
  const qty = it.qty ?? known?.qty ?? '', unit = it.qty ? it.unit ?? '' : it.unit ?? known?.unit ?? '';
  xl.items = xl.items.filter((i) => keyOf(i.name) !== keyOf(name));   // a crossed-out copy goes: it is back on the list
  xl.items.push({ id: newId(), name, qty, unit, cat: it.cat ?? guessCategory(name, x.regulars), done: false });
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
export function shownItems(l: List, sink: boolean): { cat: Category | 'done'; items: Item[] }[] {
  const groups: { cat: Category | 'done'; items: Item[] }[] = [];
  const open = sink ? l.items.filter((i) => !i.done) : l.items;
  for (const c of CATEGORIES) { const items = open.filter((i) => i.cat === c); if (items.length) groups.push({ cat: c, items }); }
  const done = sink ? l.items.filter((i) => i.done) : [];
  if (done.length) groups.push({ cat: 'done', items: done });
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
  const old = x.regulars[k] ?? { name: n, store: '', qty: '', unit: '', cat: guessCategory(n), pinned: false, rule: 'none' as Rule, every: 0, remind: '', repeat: 0, bought: [] };
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

// ---- pantry ----
export function putInPantry(d: ShopData, it: { name: string; qty: string; unit: string; cat: Category }): ShopData {
  const x = d;   // changed in place: the callers pass a copy
  const h = x.pantry.find((p) => keyOf(p.name) === keyOf(it.name));
  if (h) { h.low = false; if (it.qty) { h.qty = it.qty; h.unit = it.unit; } }
  else if (x.pantry.length < LIMITS.pantry) x.pantry.push({ id: newId(), name: cleanName(it.name), qty: it.qty, unit: it.unit, cat: it.cat, low: false });
  return x;
}
export const addToPantry = (d: ShopData, it: { name: string; qty: string; unit: string; cat?: Category }) =>
  cleanName(it.name) ? putInPantry(clone(d), { ...it, cat: it.cat ?? guessCategory(it.name, d.regulars) }) : d;
export const inPantry = (d: ShopData, name: string) => d.pantry.find((p) => keyOf(p.name) === keyOf(name));

// ---- recipes ----
// Recipe ingredients are written one per line, like the quick add: "200 g flour".
export const parseIngredients = (text: string, regulars: Record<string, Regular> = {}): Ingredient[] =>
  text.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean).slice(0, 100)
    .map((l) => { const p = parseQuick(l); return { ...p, cat: guessCategory(p.name, regulars) }; }).filter((i) => i.name);
export const ingredientsText = (items: Ingredient[]) => items.map(itemText).join('\n');

export type Need = 'have' | 'listed' | 'need';
// For each ingredient: you have it (in the pantry and not running low), it is already on the list, or it is missing.
export const recipeNeeds = (d: ShopData, r: Recipe, listId: string): { ing: Ingredient; need: Need }[] =>
  r.items.map((ing) => {
    const h = inPantry(d, ing.name);
    return { ing, need: h && !h.low ? 'have' : onList(listOf(d, listId), ing.name) ? 'listed' : 'need' };
  });
export function addRecipe(d: ShopData, r: Recipe, listId: string): { data: ShopData; added: number } {
  let x = d, added = 0;
  for (const { ing, need } of recipeNeeds(d, r, listId)) {
    if (need !== 'need') continue;
    const res = addItem(x, listId, ing);
    x = res.data; if (res.added) added++;
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
