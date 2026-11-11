import { describe, expect, it } from 'vitest';
import {
  addItem, addList, addRecipe, addSub, addToPantry, alsoIn, deleteCat, findInPantry, hadBefore, learnPlace, moveCat, placeOf, restock, saveCat,
  shelves, stepHave, updateHave, useUp, complete, dayKey, emptyData, finishTrip, guessCategory, itemText, keyOf, listOf,
  listToText, moveItem, parseIngredients, parseQuick, recipeNeeds, sanitize, setRegular, settleSuggestion, shownItems, suggestions,
  takeSuggestion, textToList, updateItem, usualGap, type ShopData,
} from './model.ts';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 9, 12).getTime();

function withLists(...names: string[]): { d: ShopData; ids: string[] } {
  let d = emptyData();
  const ids: string[] = [];
  for (const n of names) { const r = addList(d, n)!; d = r.data; ids.push(r.id); }
  return { d, ids };
}

describe('parseQuick', () => {
  it('reads a quantity and a unit before or after the name', () => {
    expect(parseQuick('2 milk')).toEqual({ qty: '2', unit: '', name: 'milk' });
    expect(parseQuick('500g flour')).toEqual({ qty: '500', unit: 'g', name: 'flour' });
    expect(parseQuick('1,5 l  oat milk')).toEqual({ qty: '1,5', unit: 'l', name: 'oat milk' });
    expect(parseQuick('flour 500 g')).toEqual({ qty: '500', unit: 'g', name: 'flour' });
    expect(parseQuick('3x eggs')).toEqual({ qty: '3', unit: '', name: 'eggs' });
  });
  it('does not take the start of a word for a unit', () => {
    expect(parseQuick('2 lemons')).toEqual({ qty: '2', unit: '', name: 'lemons' });
    expect(parseQuick('7up')).toEqual({ qty: '', unit: '', name: '7up' });
    expect(parseQuick('Coke Zero')).toEqual({ qty: '', unit: '', name: 'Coke Zero' });
  });
  it('writes it back', () => {
    expect(itemText({ name: 'flour', qty: '500', unit: 'g' })).toBe('500g flour');
    expect(itemText({ name: 'beans', qty: '2', unit: 'cans' })).toBe('2 cans beans');
    expect(itemText({ name: 'milk', qty: '', unit: '' })).toBe('milk');
  });
});

describe('names and categories', () => {
  it('treats plurals and case as the same item', () => {
    expect(keyOf('Eggs')).toBe(keyOf('egg'));
    expect(keyOf('Tomatoes')).toBe(keyOf('tomato'));
    expect(keyOf('glass')).toBe('glass');
  });
  it('guesses a category, preferring what it learned', () => {
    expect(guessCategory('Whole milk')).toBe('dairy');
    expect(guessCategory('Bananas')).toBe('produce');
    expect(guessCategory('Mystery')).toBe('other');
    const d = setRegular(emptyData(), 'Milk', { cat: 'drinks' });
    expect(guessCategory('milk', d)).toBe('drinks');
  });
});

describe('lists', () => {
  it('makes one list per supermarket name', () => {
    const { d, ids } = withLists('Aldi', 'Lidl');
    expect(d.lists.map((l) => l.name)).toEqual(['Aldi', 'Lidl']);
    expect(addList(d, 'aldi')!.id).toBe(ids[0]);
  });
  it('never adds an item twice to the same list', () => {
    const { d, ids } = withLists('Aldi');
    const a = addItem(d, ids[0], { name: 'Milk' });
    const b = addItem(a.data, ids[0], { name: 'milk' });
    expect(b.added).toBe(false);
    expect(listOf(b.data, ids[0])!.items).toHaveLength(1);
    expect(listOf(d, ids[0])!.items).toHaveLength(0);   // the old data is untouched (undo)
  });
  it('warns when another list has the item, until told to ignore it', () => {
    let { d, ids } = withLists('Aldi', 'Lidl');
    d = addItem(d, ids[0], { name: 'Milk' }).data;
    d = addItem(d, ids[1], { name: 'milk' }).data;
    const lidlMilk = listOf(d, ids[1])!.items[0];
    expect(alsoIn(d, ids[1], lidlMilk)).toEqual(['Aldi']);
    d = updateItem(d, ids[1], lidlMilk.id, { dupOk: true });
    expect(alsoIn(d, ids[1], listOf(d, ids[1])!.items[0])).toEqual([]);
  });
  it('moves an item to another list', () => {
    let { d, ids } = withLists('Aldi', 'Lidl');
    d = addItem(d, ids[0], { name: 'Milk', qty: '2' }).data;
    d = moveItem(d, ids[0], listOf(d, ids[0])!.items[0].id, ids[1]);
    expect(listOf(d, ids[0])!.items).toHaveLength(0);
    expect(listOf(d, ids[1])!.items[0]).toMatchObject({ name: 'Milk', qty: '2' });
  });
  it('groups by category and can sink the checked ones', () => {
    let { d, ids } = withLists('Aldi');
    for (const n of ['Milk', 'Apples', 'Cheese']) d = addItem(d, ids[0], { name: n }).data;
    const l = listOf(d, ids[0])!;
    l.items[0].done = true;
    expect(shownItems(l, false).map((g) => [g.cat, g.items.map((i) => i.name)])).toEqual([['produce', ['Apples']], ['dairy', ['Milk', 'Cheese']]]);
    expect(shownItems(l, true).map((g) => [g.cat, g.items.map((i) => i.name)])).toEqual([['produce', ['Apples']], ['dairy', ['Cheese']], ['done', ['Milk']]]);
  });
});

describe('shopping trip', () => {
  it('removes what was bought, remembers it, and drops what was asked', () => {
    let { d, ids } = withLists('Aldi');
    for (const n of ['Milk', 'Bread', 'Soap']) d = addItem(d, ids[0], { name: n }).data;
    const l = listOf(d, ids[0])!;
    l.items[0].done = true;
    const r = finishTrip(d, ids[0], NOW, { toPantry: true, drop: [l.items[2].id] });
    expect(r.bought).toBe(1);
    expect(listOf(r.data, ids[0])!.items.map((i) => i.name)).toEqual(['Bread']);
    expect(r.data.regulars.milk).toMatchObject({ name: 'Milk', store: ids[0], bought: [NOW] });
    expect(r.data.pantry.map((p) => p.name)).toEqual(['Milk']);
  });
  it('puts the always-buy items back', () => {
    let { d, ids } = withLists('Aldi');
    d = setRegular(d, 'Bananas', { rule: 'always', store: ids[0] });
    expect(listOf(d, ids[0])!.items.map((i) => i.name)).toEqual(['Bananas']);
    listOf(d, ids[0])!.items[0].done = true;
    const r = finishTrip(d, ids[0], NOW, { toPantry: false });
    expect(listOf(r.data, ids[0])!.items.map((i) => [i.name, i.done])).toEqual([['Bananas', false]]);
  });
});

describe('suggestions', () => {
  it('suggests periodic items when due, and hides a dismissed one until the next turn', () => {
    let { d, ids } = withLists('Aldi');
    d = setRegular(d, 'Coffee', { rule: 'every', every: 14, store: ids[0], bought: [NOW - 15 * DAY] });
    const s = suggestions(d, NOW);
    expect(s.map((x) => [x.name, x.kind, x.store])).toEqual([['Coffee', 'every', ids[0]]]);
    d = settleSuggestion(d, s[0], NOW);
    expect(suggestions(d, NOW)).toEqual([]);
    d = setRegular(d, 'Coffee', { bought: [NOW] });
    expect(suggestions(d, NOW + 15 * DAY)).toHaveLength(1);
  });
  it('moves a repeating reminder on and ends a one-off one', () => {
    let { d, ids } = withLists('Aldi');
    d = setRegular(d, 'Gift wrap', { remind: dayKey(NOW), repeat: 30 });
    d = setRegular(d, 'Candles', { remind: dayKey(NOW - DAY), repeat: 0 });
    const s = suggestions(d, NOW);
    expect(s.map((x) => x.kind)).toEqual(['remind', 'remind']);
    for (const x of s) d = takeSuggestion(d, x, ids[0], NOW);
    expect(d.regulars['gift wrap'].remind).toBe(dayKey(NOW + 30 * DAY));
    expect(d.regulars.candle.remind).toBe('');
    expect(listOf(d, ids[0])!.items).toHaveLength(2);
  });
  it('learns how often something is bought (when allowed)', () => {
    const { d } = withLists('Aldi');
    const x = setRegular(d, 'Eggs', { bought: [NOW - 30 * DAY, NOW - 20 * DAY, NOW - 10 * DAY] });
    expect(usualGap(x.regulars.egg)).toBe(10);
    expect(suggestions(x, NOW).map((s) => s.kind)).toEqual(['often']);
    expect(suggestions({ ...x, opts: { ...x.opts, learn: false } }, NOW)).toEqual([]);
  });
  it('suggests low pantry items, and nothing already on a list', () => {
    let { d, ids } = withLists('Aldi');
    d = addToPantry(d, { name: 'Rice', qty: '', unit: '' });
    d.pantry[0].low = true;
    expect(suggestions(d, NOW).map((s) => s.why)).toEqual(['Running low']);
    d = addItem(d, ids[0], { name: 'rice' }).data;
    expect(suggestions(d, NOW)).toEqual([]);
  });
});

describe('recipes', () => {
  it('reads ingredients and adds only what is missing', () => {
    let { d, ids } = withLists('Aldi');
    const items = parseIngredients('- 200 g flour\n2 eggs\n\n1 l milk\nsalt');
    expect(items.map((i) => i.name)).toEqual(['flour', 'eggs', 'milk', 'salt']);
    const r = { id: 'r', name: 'Pancakes', items, notes: '' };
    d = addToPantry(d, { name: 'Salt', qty: '', unit: '' });
    d = addItem(d, ids[0], { name: 'Milk' }).data;
    expect(recipeNeeds(d, r, ids[0]).map((n) => n.need)).toEqual(['need', 'need', 'listed', 'have']);
    const res = addRecipe(d, r, ids[0]);
    expect(res.added).toBe(2);
    expect(listOf(res.data, ids[0])!.items.map(itemText)).toEqual(['Milk', '200g flour', '2 eggs']);
    expect(listOf(res.data, ids[0])!.items.map((i) => i.from)).toEqual([['Pancakes'], ['Pancakes'], ['Pancakes']]);
    const again = addRecipe(res.data, { ...r, name: 'Crêpes' }, ids[0]);
    expect(listOf(again.data, ids[0])!.items[1].from).toEqual(['Pancakes', 'Crêpes']);
  });
});

describe('sharing', () => {
  it('writes a list as text and reads it back', () => {
    let { d, ids } = withLists('Aldi');
    d = addItem(d, ids[0], { name: 'flour', qty: '500', unit: 'g' }).data;
    d = addItem(d, ids[0], { name: 'Milk', qty: '2' }).data;
    const text = listToText(listOf(d, ids[0])!);
    expect(text).toBe('🛒 Aldi\n- 500g flour\n- 2 Milk');
    expect(textToList(text)).toEqual({ name: 'Aldi', items: [{ name: 'flour', qty: '500', unit: 'g' }, { name: 'Milk', qty: '2', unit: '' }] });
    expect(textToList('- [x] eggs\n- [ ] bread').items.map((i) => i.name)).toEqual(['eggs', 'bread']);
  });
});

describe('autocomplete and loading', () => {
  it('completes from known items, not ones already on the list', () => {
    let { d, ids } = withLists('Aldi');
    d = setRegular(d, 'Milk', {});
    d = setRegular(d, 'Oat milk', { bought: [1, 2] });
    d = setRegular(d, 'Mint', {});
    expect(complete(d, 'mi', ids[0]).map((g) => g.name)).toEqual(['Milk', 'Mint', 'Oat milk']);
    d = addItem(d, ids[0], { name: 'Milk' }).data;
    expect(complete(d, '2 mi', ids[0]).map((g) => g.name)).toEqual(['Mint', 'Oat milk']);
  });
  it('survives damaged data', () => {
    expect(sanitize(null)).toEqual(emptyData());
    const d = sanitize({ lists: [{ name: 'Aldi', items: [{ name: 'Milk', cat: 'nope', done: 'yes' }, { qty: '2' }] }], regulars: { x: { name: 'Tea', rule: 'weird', bought: [3, 'a', 1] } } });
    expect(d.lists[0].items).toMatchObject([{ name: 'Milk', cat: 'other', done: false }]);
    expect(d.regulars.tea).toMatchObject({ rule: 'none', bought: [1, 3] });
  });
  it('shows empty pantry categories unless told not to', () => {
    expect(sanitize({}).opts.showEmpty).toBe(true);
    expect(sanitize({ opts: { showEmpty: false } }).opts.showEmpty).toBe(false);
  });
});

describe('categories and where things go', () => {
  it('remembers where you put an item, everywhere and from then on', () => {
    let { d, ids } = withLists('Aldi');
    d = addItem(d, ids[0], { name: 'Maple syrup' }).data;
    d = addToPantry(d, { name: 'Maple syrup', qty: '', unit: '' });
    expect(listOf(d, ids[0])!.items[0].cat).toBe('other');
    d = updateHave(d, d.pantry[0].id, { cat: 'pantry' });
    expect(listOf(d, ids[0])!.items[0].cat).toBe('pantry');
    expect(placeOf(d, 'maple syrup').cat).toBe('pantry');
    d = useUp(d, d.pantry[0].id, NOW);
    d = addItem(d, ids[0], { name: 'Maple Syrup' }).data;   // already on it: left alone
    const items = parseIngredients('maple syrup');
    expect(guessCategory('maple syrup', d)).toBe('pantry');
    expect(items[0].cat).toBe('other');
    expect(parseIngredients('maple syrup', d)[0].cat).toBe('pantry');
  });
  it('adds into the category (and sub-category) it was added from', () => {
    let d = emptyData();
    const s = addSub(d, 'pantry', 'Baking')!;
    d = addToPantry(s.data, { name: 'Flour', qty: '1', unit: 'kg', cat: 'pantry', sub: s.id });
    expect(d.pantry[0]).toMatchObject({ cat: 'pantry', sub: s.id });
    d = useUp(d, d.pantry[0].id, NOW);
    expect(hadBefore(d, 'pantry').map((h) => [h.name, h.times])).toEqual([['Flour', 1]]);
    d = addToPantry(d, { name: 'flour', qty: '', unit: '' });   // from the top: where it was before
    expect(d.pantry[0]).toMatchObject({ cat: 'pantry', sub: s.id });
    expect(hadBefore(d)).toEqual([]);
    expect(shelves(d, 'pantry').map((x) => [x.name, x.items.map((i) => i.name)])).toEqual([['Baking', ['Flour']]]);
  });
  it('sorts a list by sub-category inside each category', () => {
    let { d, ids } = withLists('Aldi');
    const a = addSub(d, 'pantry', 'Baking')!; d = a.data;
    const b = addSub(d, 'pantry', 'Tins')!; d = b.data;
    for (const n of ['Beans', 'Flour', 'Rice']) d = addItem(d, ids[0], { name: n, cat: 'pantry' }).data;
    d = learnPlace(d, 'Beans', 'pantry', b.id);
    d = learnPlace(d, 'Flour', 'pantry', a.id);
    const g = shownItems(listOf(d, ids[0])!, true, d.cats, (n) => placeOf(d, n).sub);
    expect(g[0].shelves.map((s) => [s.name, s.items.map((i) => i.name)])).toEqual([['', ['Rice']], ['Baking', ['Flour']], ['Tins', ['Beans']]]);
    expect(g[0].items.map((i) => i.name)).toEqual(['Rice', 'Flour', 'Beans']);
  });
  it('makes, changes, orders and deletes categories', () => {
    let d = emptyData();
    const r = saveCat(d, null, { name: 'Baby', icon: 'chick', color: 'pink', subs: [{ id: '', name: 'Nappies' }, { id: '', name: 'nappies' }] })!;
    d = r.data;
    expect(d.cats.at(-2)).toMatchObject({ name: 'Baby', subs: [{ name: 'Nappies' }] });
    expect(d.cats.at(-1)!.id).toBe('other');
    expect(saveCat(d, null, { name: 'baby', icon: 'x', color: 'pink', subs: [] })).toBeNull();
    d = addToPantry(d, { name: 'Wipes', qty: '', unit: '', cat: r.id, sub: d.cats.at(-2)!.subs[0].id });
    d = saveCat(d, r.id, { name: 'Baby stuff', icon: 'chick', color: 'pink', subs: [] })!.data;   // the sub-category went: its things stay
    expect(d.pantry[0]).toMatchObject({ cat: r.id, sub: '' });
    d = moveCat(d, r.id, -1);
    expect(d.cats.at(-3)!.id).toBe(r.id);
    d = deleteCat(d, r.id);
    expect(d.pantry[0].cat).toBe('other');
    expect(placeOf(d, 'wipes').cat).toBe('other');
    expect(deleteCat(d, 'other')).toBe(d);
  });
  it('counts things down and uses up the last one', () => {
    let d = addToPantry(emptyData(), { name: 'Eggs', qty: '2', unit: '' });
    d = stepHave(d, d.pantry[0].id, -1, NOW).data;
    expect(d.pantry[0].qty).toBe('1');
    const r = stepHave(d, d.pantry[0].id, -1, NOW);
    expect(r.usedUp).toBe(true);
    expect(r.data.pantry).toEqual([]);
    d = restock(r.data, 'egg');
    expect(d.pantry[0]).toMatchObject({ name: 'Eggs', qty: '2' });   // back in with what it came in with
    expect(findInPantry(d, 'eg').have.map((h) => h.name)).toEqual(['Eggs']);
  });
  it('keeps old data, and drops places in unknown categories', () => {
    const d = sanitize({ pantry: [{ name: 'Rice', cat: 'pantry' }], places: { rice: { cat: 'pantry', sub: 'nope' }, x: { cat: 'gone' } } });
    expect(d.cats.map((c) => c.id)).toContain('pantry');
    expect(d.pantry[0]).toMatchObject({ cat: 'pantry', sub: '' });
    expect(d.places).toEqual({ rice: { cat: 'pantry', sub: '' } });
    expect(learnPlace(d, 'rice', 'nope')).toBe(d);
  });
});
