import { describe, expect, it } from 'vitest';
import {
  addItem, addList, addRecipe, addToPantry, alsoIn, complete, dayKey, emptyData, finishTrip, guessCategory, itemText, keyOf, listOf,
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
    expect(guessCategory('milk', d.regulars)).toBe('drinks');
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
});
