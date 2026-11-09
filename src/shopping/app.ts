// The Kitty Mart screen: four tabs.
//   Lists     suggestions on top (grouped by supermarket), then one shopping list per supermarket
//   Recipes   ingredients that go onto a list, only the ones you don't have and that aren't on it already
//   Pantry    the stuff you have; tick something when it is used up, mark it low to get it suggested
//   Regulars  everything you have bought: pin favourites, "always buy", "every 2 weeks", reminders (all optional)
// The data and its rules are in ./model.ts, kept on the device by ./data.ts (Habit Kitty starts it). Drawn with Habit
// Kitty's stylesheet and its own, in web/shopping.html.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { iconSvg } from '../pixelart.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { onAppShown, onShown } from '../shared/apps.ts';
import { esc, plural } from '../shared/html.ts';
import { homeButton, playerButton, settingsButton, titleBar } from '../shared/ui.ts';
import { change, onShop, shopData, shopInitialised, shopReady, undo, undoLabel } from './data.ts';
import {
  CATEGORIES, CATEGORY_LABEL, LIMITS, addItem, addList, addRecipe, addToPantry, agoText, alsoIn, clone, complete, dayTime, finishTrip,
  forgetRegular, guessCategory, ingredientsText, isDay, itemText, keyOf, lastBought, listOf, listToText, moveItem, newId, onList,
  parseIngredients, parseQuick, qtyText, recipeNeeds, regularOf, removeItems, ruleText, setRegular, settleSuggestion, shownItems,
  suggestions, takeSuggestion, textToList, updateItem, usualGap, type Category, type Item, type Recipe, type Regular, type Rule,
  type Suggestion,
} from './model.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const STAR = ['...o...', '..ooo..', 'ooooooo', '.ooooo.', '..ooooo', '.oo.oo.', 'oo...oo'];
const star = () => monoSvg(STAR, 'star');

type Tab = 'lists' | 'recipes' | 'pantry' | 'regulars';
const TABS: [Tab, string][] = [['lists', 'Lists'], ['recipes', 'Recipes'], ['pantry', 'Pantry'], ['regulars', 'Regulars']];
let tab: Tab = 'lists';
let listId = '';                 // the open shopping list
let typed = '';                  // what is in the list's add box
let suggOpen = true;             // the suggestions fold
let recipeId: string | null = null, recipeEditing = false, recipeTo = '';
let tripFor = '';                // the list whose trip-done dialog is open

// ---- the toast, with Undo when the change can be undone ----
let toastTimer = 0;
function toast(text: string, canUndo = false) {
  const el = $('shop-toast');
  el.innerHTML = `${esc(text)}${canUndo ? ' <button class="linkish" type="button" data-action="undo">Undo</button>' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), canUndo ? 6000 : 3200);
}
// A change that can be undone, with the toast that offers it.
const commit = (next: ReturnType<typeof shopData>, label: string, say = label) => { change(next, label); toast(say, true); };

// ---- header ----
function renderTop() {
  $('shop-top').innerHTML = titleBar('Kitty', 'Mart', homeButton() + playerButton() + settingsButton())
    + `<nav class="nav" aria-label="Kitty Mart"><div class="seg" role="tablist">${TABS.map(([t, label]) =>
      `<button type="button" role="tab" data-action="shop-tab" data-tab="${t}" aria-selected="${t === tab}">${label}</button>`).join('')}</div></nav>`;
}

// Redraws the open tab, keeping the focus (and the caret) where it was.
function render() {
  const a = document.activeElement as HTMLInputElement | null;
  const id = a && $('shop-body').contains(a) ? a.id : '';
  const sel = id && typeof a!.selectionStart === 'number' ? [a!.selectionStart, a!.selectionEnd] : null;
  if (!shopReady()) { $('shop-body').innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>'; return; }
  const u = undoLabel();
  const undoBar = u ? `<div class="shop-undo"><span class="muted">${esc(u)}</span><button class="btn small" type="button" data-action="undo">Undo</button></div>` : '';
  $('shop-body').innerHTML = undoBar + (tab === 'lists' ? listsHtml() : tab === 'recipes' ? recipesHtml() : tab === 'pantry' ? pantryHtml() : regularsHtml());
  if (id) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch { /* not a text box */ } }
  }
}

const catOptions = (sel: Category) => CATEGORIES.map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${CATEGORY_LABEL[c]}</option>`).join('');
const listOptions = (sel: string, any?: string) => (any !== undefined ? `<option value="">${esc(any)}</option>` : '')
  + shopData().lists.map((l) => `<option value="${l.id}" ${l.id === sel ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
const dayText = (k: string) => new Date(dayTime(k)).toLocaleDateString('en', { day: 'numeric', month: 'short' });

// =================== Lists ===================
function listsHtml(): string {
  const d = shopData();
  if (!d.lists.length) return `<div class="panel"><h3>No shopping lists yet</h3>
      <p class="muted">Make one list for each supermarket you go to. The supermarket's name is the list's title.</p>
      <form class="shop-add" id="list-new-form"><label class="field"><input id="list-new-name" maxlength="${LIMITS.name}" placeholder="Aldi, Lidl, Rewe…" autocomplete="off" aria-label="Supermarket"></label>
        <button class="btn primary" type="submit">Make list</button></form></div>`;
  if (!listOf(d, listId)) listId = d.lists[0].id;
  return suggestionsHtml() + storesHtml() + listHtml();
}

// ---- suggestions, grouped by supermarket ----
function suggestionsHtml(): string {
  const d = shopData();
  const all = suggestions(d, Date.now());
  if (!all.length) return '';
  const groups = new Map<string, Suggestion[]>();
  for (const s of all) groups.set(s.store, [...(groups.get(s.store) ?? []), s]);
  const order = [...d.lists.map((l) => l.id).filter((id) => groups.has(id)), ...(groups.has('') ? [''] : [])];
  const cur = listOf(d, listId)!;
  return `<details class="panel fold shop-sugg" id="shop-sugg" ${suggOpen ? 'open' : ''}><summary>Suggestions <span class="num muted">${all.length}</span></summary><div class="fold-body">
    ${order.map((store) => `<div class="sgroup"><h4>${store ? esc(listOf(d, store)!.name) : `Any shop <span class="muted">(adds to ${esc(cur.name)})</span>`}</h4>
      <ul class="srows">${groups.get(store)!.map((s) => `<li>
        <span class="sname"><b>${esc(itemText(s))}</b><span class="muted">${esc(s.why)}</span></span>
        <button class="btn small" type="button" data-action="sugg-add" data-key="${esc(s.key)}" aria-label="Add ${esc(s.name)}">+ Add</button>
        <button class="gear sm" type="button" data-action="sugg-dismiss" data-key="${esc(s.key)}" aria-label="Dismiss ${esc(s.name)}">${iconSvg('x')}</button></li>`).join('')}</ul></div>`).join('')}
  </div></details>`;
}

function storesHtml(): string {
  const d = shopData();
  return `<div class="shop-stores"><div class="seg" role="tablist" aria-label="Supermarkets">${d.lists.map((l) => {
    const n = l.items.filter((i) => !i.done).length;
    return `<button type="button" role="tab" data-action="list-pick" data-id="${l.id}" aria-selected="${l.id === listId}">${esc(l.name)} <span class="num">${n}</span></button>`;
  }).join('')}</div>
    <button class="btn small" type="button" data-action="list-new" ${d.lists.length >= LIMITS.lists ? 'disabled' : ''} aria-label="New list">+ List</button></div>`;
}

function itemHtml(it: Item): string {
  const d = shopData();
  const also = alsoIn(d, listId, it);
  return `<li class="shop-item${it.done ? ' done' : ''}">
    <label class="check"><input type="checkbox" data-item="${it.id}" ${it.done ? 'checked' : ''}><span class="iname">${it.qty || it.unit ? `<b class="qty">${esc(qtyText(it))}</b> ` : ''}${esc(it.name)}</span></label>
    <button class="gear sm" type="button" data-action="item-edit" data-id="${it.id}" aria-label="Change ${esc(it.name)}">${iconSvg('pencil')}</button>
    ${also.length ? `<p class="dup">Also in ${esc(also.join(' and '))} shopping list. <button class="linkish" type="button" data-action="dup-ok" data-id="${it.id}">Ignore</button></p>` : ''}</li>`;
}

function listHtml(): string {
  const d = shopData();
  const l = listOf(d, listId)!;
  const pins = Object.values(d.regulars).filter((g) => g.pinned && (!g.store || g.store === l.id) && !onList(l, g.name)).sort((a, b) => a.name.localeCompare(b.name));
  const groups = shownItems(l, d.opts.sink);
  const anyDone = l.items.some((i) => i.done);
  return `<section class="panel shop-list" aria-label="${esc(l.name)} shopping list">
    <div class="shop-head"><h3>${esc(l.name)}</h3><button class="btn small" type="button" data-action="list-menu">List…</button></div>
    <form class="shop-add" id="shop-add-form"><label class="field"><input id="shop-add-input" maxlength="80" placeholder="Add: 2 milk, 500 g flour" autocomplete="off" enterkeyhint="done" aria-label="Add an item" value="${esc(typed)}"></label>
      <button class="btn primary" type="submit">Add</button></form>
    <div class="shop-complete" id="shop-complete">${completeHtml()}</div>
    ${pins.length ? `<div class="shop-pins" aria-label="Favourites">${pins.map((g) => `<button class="btn small" type="button" data-action="pin-add" data-name="${esc(g.name)}">${star()} ${esc(g.name)}</button>`).join('')}</div>` : ''}
    ${groups.length ? groups.map((g) => `<div class="shop-group"><h4>${g.cat === 'done' ? 'In the basket' : CATEGORY_LABEL[g.cat]}</h4><ul class="shop-items">${g.items.map(itemHtml).join('')}</ul></div>`).join('')
      : '<p class="muted">Nothing on this list. Type above to add something.</p>'}
    <div class="shop-foot">
      <div class="seg" role="radiogroup" aria-label="Ticked items"><button type="button" role="radio" data-action="mode" data-sink="0" aria-checked="${!d.opts.sink}" aria-selected="${!d.opts.sink}">Cross out</button><button type="button" role="radio" data-action="mode" data-sink="1" aria-checked="${d.opts.sink}" aria-selected="${d.opts.sink}">Move to bottom</button></div>
      <button class="btn primary" type="button" data-action="trip-done" ${l.items.length ? '' : 'disabled'}>${anyDone ? 'Shopping trip done' : 'Shopping trip done…'}</button>
    </div></section>`;
}

function completeHtml(): string {
  if (!typed.trim()) return '';
  const c = complete(shopData(), typed, listId);
  return c.map((g) => `<button class="btn small" type="button" data-action="complete-pick" data-name="${esc(g.name)}">${esc(g.name)}${g.qty ? ` <span class="muted">${esc(qtyText(g))}</span>` : ''}</button>`).join('');
}

function addTyped(text: string) {
  const p = parseQuick(text);
  if (!p.name) return;
  const d = shopData();
  const known = regularOf(d, p.name);
  // typed in lower case, a known item keeps the way it was written before ("milk" → "Milk")
  const name = known && p.name === p.name.toLowerCase() ? known.name : p.name;
  const r = addItem(d, listId, { name, ...(p.qty ? { qty: p.qty, unit: p.unit } : {}), cat: guessCategory(p.name, d.regulars) });
  if (!r.added) { toast(onList(listOf(d, listId), p.name) ? `${p.name} is already on the list.` : `This list is full (${LIMITS.items} items).`); return; }
  typed = '';
  change(r.data);
}

// ---- dialogs ----
function openLayer(html: string, label: string) {
  closeLayer();
  const el = document.createElement('div');
  el.id = 'shop-layer';
  el.className = 'scrim layer';
  el.dataset.action = 'layer-close';
  el.innerHTML = `<div class="panel shop-dialog" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  $('shop-layer-host').appendChild(el);
  el.querySelector<HTMLElement>('[data-focus], input:not([type=checkbox]):not([type=radio]), button')?.focus();
}
const closeLayer = () => { document.getElementById('shop-layer')?.remove(); tripFor = ''; };

function openNewList() {
  openLayer(`<h3>New shopping list</h3><form class="stack" id="list-new-form">
    <label class="field">Supermarket <input id="list-new-name" maxlength="${LIMITS.name}" placeholder="Aldi, Lidl, Rewe…" autocomplete="off" data-focus></label>
    <div class="btns"><button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Make list</button></div></form>`, 'New shopping list');
}

function openListMenu() {
  const l = listOf(shopData(), listId);
  if (!l) return;
  openLayer(`<button class="x-close" type="button" data-action="layer-close" aria-label="Close">${iconSvg('x')}</button><h3>${esc(l.name)}</h3>
    <form class="shop-add" id="list-rename-form"><label class="field">Supermarket <input id="list-rename" maxlength="${LIMITS.name}" value="${esc(l.name)}" autocomplete="off"></label>
      <button class="btn" type="submit">Rename</button></form>
    <h4 class="sub">Share with someone</h4>
    <p class="muted">Sends the list as text (by message, mail…). Whoever gets it can paste it into their Kitty Mart. Lists don't stay in sync by themselves: share again after a change.</p>
    <div class="btns flow"><button class="btn" type="button" data-action="list-share">Share list…</button><button class="btn" type="button" data-action="list-import">Paste a shared list…</button></div>
    <h4 class="sub">Delete</h4>
    <div class="btns"><button class="btn danger" type="button" data-action="list-delete">Delete this list</button></div>`, `${l.name} list`);
}

function openImport() {
  const l = listOf(shopData(), listId);
  if (!l) return;
  openLayer(`<h3>Paste a shared list</h3><form class="stack" id="list-import-form">
    <label class="field">The list <textarea id="list-import-text" rows="8" placeholder="🛒 Aldi&#10;- 2 milk&#10;- 500g flour" data-focus></textarea></label>
    <p class="muted">Its items are added to ${esc(l.name)}. Anything already on it is skipped.</p>
    <div class="btns"><button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Add to ${esc(l.name)}</button></div></form>`, 'Paste a shared list');
}

async function shareList() {
  const l = listOf(shopData(), listId);
  if (!l) return;
  const text = listToText(l);
  try {
    if (Capacitor.isNativePlatform()) { await Share.share({ title: `${l.name} shopping list`, text }); return; }
    if (navigator.share) { await navigator.share({ title: `${l.name} shopping list`, text }); return; }
    await navigator.clipboard.writeText(text);
    toast('List copied. Paste it into a message.');
  } catch (e) { if (!/cancel|abort/i.test(String((e as Error)?.message ?? e))) toast("Couldn't share the list."); }
}

function openItem(id: string) {
  const d = shopData(), it = listOf(d, listId)?.items.find((i) => i.id === id);
  if (!it) return;
  const g = regularOf(d, it.name);
  openLayer(`<button class="x-close" type="button" data-action="layer-close" aria-label="Close">${iconSvg('x')}</button><h3>${esc(it.name)}</h3>
    <form class="stack" id="item-form" data-id="${it.id}">
      <label class="field">Name <input name="name" maxlength="${LIMITS.name}" value="${esc(it.name)}" autocomplete="off"></label>
      <div class="row"><label class="field">Amount <input name="qty" maxlength="12" inputmode="decimal" value="${esc(it.qty)}" autocomplete="off"></label>
        <label class="field">Unit <input name="unit" maxlength="12" value="${esc(it.unit)}" placeholder="g, l, pack…" autocomplete="off"></label></div>
      <label class="field">Category <select name="cat">${catOptions(it.cat)}</select></label>
      ${shopData().lists.length > 1 ? `<label class="field">On the list for <select name="list">${listOptions(listId)}</select></label>` : ''}
      <label class="check"><input type="checkbox" name="pinned" ${g?.pinned ? 'checked' : ''}><span><b>Favourite</b><br><span class="muted">Pinned under the add box, for one tap.</span></span></label>
      <div class="btns"><button class="btn danger" type="button" data-action="item-delete" data-id="${it.id}">Delete</button><span class="grow"></span>
        <button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, `Change ${it.name}`);
}

function saveItem(f: HTMLFormElement) {
  const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
  const id = f.dataset.id!;
  let d = shopData();
  const it = listOf(d, listId)?.items.find((i) => i.id === id);
  if (!it) return closeLayer();
  const name = v('name').trim() || it.name;
  d = updateItem(d, listId, id, { name, qty: v('qty').trim(), unit: v('unit').trim(), cat: v('cat') as Category });
  const pinned = (f.elements.namedItem('pinned') as HTMLInputElement).checked;
  if (pinned !== !!regularOf(d, name)?.pinned) d = setRegular(d, name, { pinned, ...(regularOf(d, name) ? {} : { cat: v('cat') as Category, store: listId }) });
  const to = v('list');
  if (to && to !== listId) { d = moveItem(d, listId, id, to); toast(`Moved ${name} to ${listOf(d, to)?.name}.`); }
  change(d, `Changed ${name}`);
  closeLayer();
}

// The trip is done: what was ticked leaves the list; whatever was not bought can be kept or deleted.
function openTrip() {
  const d = shopData(), l = listOf(d, listId);
  if (!l) return;
  const done = l.items.filter((i) => i.done), left = l.items.filter((i) => !i.done);
  openLayer(`<h3>Shopping trip done</h3>
    <p>${done.length ? `${plural(done.length, 'ticked item')} ${done.length === 1 ? 'leaves' : 'leave'} the list.` : 'Nothing is ticked, so nothing was bought.'}</p>
    ${done.length ? `<label class="check"><input type="checkbox" id="trip-pantry" ${d.opts.toPantry ? 'checked' : ''}><span><b>Put what I bought in the pantry</b></span></label>` : ''}
    ${left.length ? `<h4 class="sub">Not bought</h4><ul class="trip-left">${left.map((i) => `<li><span>${esc(itemText(i))}</span>
      <div class="keepdrop" role="radiogroup" aria-label="${esc(i.name)}"><label><input type="radio" name="left-${i.id}" value="keep" checked><span>Keep</span></label><label><input type="radio" name="left-${i.id}" value="drop"><span>Delete</span></label></div></li>`).join('')}</ul>` : ''}
    <div class="btns"><button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="button" data-action="trip-yes" data-focus>Done</button></div>`, 'Shopping trip done');
  tripFor = l.id;   // after openLayer, which clears it
}
function finishTripNow() {
  const d = shopData(), l = listOf(d, tripFor);
  if (!l) return closeLayer();
  const layer = $('shop-layer');
  const drop = l.items.filter((i) => !i.done && layer.querySelector<HTMLInputElement>(`input[name="left-${i.id}"][value="drop"]`)?.checked).map((i) => i.id);
  const pantryBox = document.getElementById('trip-pantry') as HTMLInputElement | null;
  const toPantry = pantryBox?.checked ?? d.opts.toPantry;
  const start = pantryBox ? { ...d, opts: { ...d.opts, toPantry } } : d;
  const r = finishTrip(start, l.id, Date.now(), { toPantry, drop });
  closeLayer();
  commit(r.data, `Finished the ${l.name} trip`, r.bought || drop.length
    ? `Trip done: ${[r.bought ? `${plural(r.bought, 'item')} bought` : '', drop.length ? `${drop.length} deleted` : ''].filter(Boolean).join(', ')}.` : 'Trip done.');
}

// =================== Recipes ===================
function recipesHtml(): string {
  const d = shopData();
  const r = recipeId ? d.recipes.find((x) => x.id === recipeId) : null;
  if (recipeEditing) return recipeFormHtml(r ?? null);
  if (r) return recipeHtml(r);
  recipeId = null;
  return `<div class="shop-bar"><span class="muted">${plural(d.recipes.length, 'recipe')}</span>
      <button class="btn primary" type="button" data-action="recipe-new" ${d.recipes.length >= LIMITS.recipes ? 'disabled' : ''}>+ New recipe</button></div>
    ${d.recipes.length ? `<ul class="shop-cards">${[...d.recipes].sort((a, b) => a.name.localeCompare(b.name)).map((x) =>
      `<li><button class="panel shop-card" type="button" data-action="recipe-open" data-id="${x.id}"><b>${esc(x.name)}</b><span class="muted">${plural(x.items.length, 'ingredient')}</span></button></li>`).join('')}</ul>`
      : '<div class="panel"><p class="muted">No recipes yet. Save one with its ingredients, then put what you are missing on a shopping list in one tap.</p></div>'}`;
}

function recipeHtml(r: Recipe): string {
  const d = shopData();
  if (!listOf(d, recipeTo)) recipeTo = listOf(d, listId)?.id ?? d.lists[0]?.id ?? '';
  const needs = recipeTo ? recipeNeeds(d, r, recipeTo) : r.items.map((ing) => ({ ing, need: 'need' as const }));
  const missing = needs.filter((n) => n.need === 'need').length;
  const BADGE = { have: ['ok', 'Have it'], listed: ['on', 'On the list'], need: ['need', 'Missing'] } as const;
  return `<div class="shop-bar"><button class="btn small" type="button" data-action="recipe-back">${iconSvg('prev')} Recipes</button><span class="grow"></span>
      <button class="btn small" type="button" data-action="recipe-edit">${iconSvg('pencil')} Edit</button>
      <button class="btn small danger" type="button" data-action="recipe-delete">Delete</button></div>
    <section class="panel"><h3>${esc(r.name)}</h3>
      ${r.items.length ? `<ul class="ings">${needs.map(({ ing, need }) => `<li class="${BADGE[need][0]}"><span>${esc(itemText(ing))}</span><span class="badge ${BADGE[need][0]}">${BADGE[need][1]}</span></li>`).join('')}</ul>`
        : '<p class="muted">No ingredients yet. Tap Edit.</p>'}
      ${d.lists.length ? `<div class="recipe-to"><label class="field">Shopping list <select id="recipe-to">${listOptions(recipeTo)}</select></label>
        <button class="btn primary" type="button" data-action="recipe-add" ${missing ? '' : 'disabled'}>${missing ? `Add ${plural(missing, 'missing item')}` : 'Nothing missing'}</button></div>
        <p class="muted">Only what you don't have in the pantry and isn't on the list yet.</p>` : '<p class="muted">Make a shopping list first (Lists tab) to put these on it.</p>'}
      ${r.notes.trim() ? `<div class="recipe-notes">${esc(r.notes)}</div>` : ''}
    </section>`;
}

function recipeFormHtml(r: Recipe | null): string {
  return `<form class="panel stack" id="recipe-form"><h3>${r ? 'Change recipe' : 'New recipe'}</h3>
    <label class="field">Name <input name="name" maxlength="${LIMITS.name}" value="${esc(r?.name ?? '')}" autocomplete="off" placeholder="Pancakes" required></label>
    <label class="field">Ingredients, one per line <textarea name="items" rows="8" placeholder="200 g flour&#10;2 eggs&#10;300 ml milk">${esc(ingredientsText(r?.items ?? []))}</textarea></label>
    <label class="field">Notes <textarea name="notes" rows="5" maxlength="${LIMITS.notes}" placeholder="How to make it (optional)">${esc(r?.notes ?? '')}</textarea></label>
    <div class="btns"><button class="btn" type="button" data-action="recipe-cancel">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
}

function saveRecipe(f: HTMLFormElement) {
  const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value;
  const name = v('name').trim().slice(0, LIMITS.name);
  if (!name) { toast('Give the recipe a name.'); return; }
  const d = clone(shopData());
  const items = parseIngredients(v('items'), d.regulars), notes = v('notes').slice(0, LIMITS.notes);
  const old = recipeId ? d.recipes.find((x) => x.id === recipeId) : undefined;
  if (old) Object.assign(old, { name, items, notes });
  else { recipeId = newId(); d.recipes.push({ id: recipeId, name, items, notes }); }
  recipeEditing = false;
  change(d, old ? `Changed ${name}` : `Added ${name}`);
}

// =================== Pantry ===================
function pantryHtml(): string {
  const d = shopData();
  const groups = CATEGORIES.map((c) => ({ c, items: d.pantry.filter((h) => h.cat === c).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.items.length);
  return `<section class="panel shop-list"><h3>Stuff you have</h3>
    <form class="shop-add" id="pantry-form"><label class="field"><input id="pantry-input" maxlength="80" placeholder="Add: rice, 6 eggs" autocomplete="off" enterkeyhint="done" aria-label="Add to the pantry"></label>
      <button class="btn primary" type="submit">Add</button></form>
    ${groups.length ? groups.map((g) => `<div class="shop-group"><h4>${CATEGORY_LABEL[g.c]}</h4><ul class="shop-items">${g.items.map((h) => `<li class="shop-item">
      <label class="check"><input type="checkbox" data-used="${h.id}"><span class="iname">${h.qty || h.unit ? `<b class="qty">${esc(qtyText(h))}</b> ` : ''}${esc(h.name)}</span></label>
      <button class="btn small low" type="button" data-action="pantry-low" data-id="${h.id}" aria-pressed="${h.low}">${h.low ? 'Low' : 'Low?'}</button></li>`).join('')}</ul></div>`).join('')
      : '<p class="muted">Nothing here yet.</p>'}
    <p class="muted">Tick something when it's used up. Mark it <b>Low</b> and it shows up in the suggestions.</p>
    <label class="check"><input type="checkbox" id="opt-topantry" ${d.opts.toPantry ? 'checked' : ''}><span><b>Fill from shopping trips</b><br><span class="muted">When a trip is done, what you bought is put in here.</span></span></label>
  </section>`;
}

// =================== Regulars ===================
function regularsHtml(): string {
  const d = shopData();
  const rank = (g: Regular) => (g.pinned ? 0 : g.rule !== 'none' || g.remind ? 1 : 2);
  const regs = Object.values(d.regulars).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return `<section class="panel"><h3>Regulars</h3>
    <p class="muted">Everything you have bought is remembered here. Set an item to come back on its own or to remind you on a day. All of it is optional.</p>
    <label class="check"><input type="checkbox" id="opt-learn" ${d.opts.learn ? 'checked' : ''}><span><b>Learn from my trips</b><br><span class="muted">After you buy something 3 times, it is suggested again when it's about time.</span></span></label>
    <form class="shop-add" id="reg-form-add"><label class="field"><input id="reg-input" maxlength="${LIMITS.name}" placeholder="Add an item to keep track of" autocomplete="off" aria-label="Item name"></label>
      <button class="btn" type="submit">Add</button></form>
    ${regs.length ? `<ul class="regs">${regs.map((g) => `<li><button class="reg" type="button" data-action="reg-open" data-name="${esc(g.name)}">
      <span class="reg-name">${g.pinned ? star() : ''}<b>${esc(g.name)}</b>${g.store && listOf(d, g.store) ? ` <span class="muted">· ${esc(listOf(d, g.store)!.name)}</span>` : ''}</span>
      <span class="chips">${regChips(g).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</span>
      <span class="muted reg-stat">${esc(regStat(g))}</span></button></li>`).join('')}</ul>` : '<p class="muted">Nothing yet. Finish a shopping trip, or add an item above.</p>'}
  </section>`;
}
const regChips = (g: Regular) => [g.rule === 'always' ? 'Always buy' : g.rule === 'every' && g.every ? `Buy ${ruleText(g.every)}` : '', g.remind ? `Reminder ${dayText(g.remind)}` : ''].filter(Boolean);
function regStat(g: Regular): string {
  const last = lastBought(g), gap = usualGap(g);
  if (last === null) return 'Not bought yet';
  return [`Bought ${g.bought.length === 1 ? 'once' : `${g.bought.length}×`}`, `last ${agoText(last, Date.now())}`, gap ? `about ${ruleText(gap)}` : ''].filter(Boolean).join(' · ');
}

const REPEATS: [number, string][] = [[0, 'Once'], [7, 'Every week'], [14, 'Every 2 weeks'], [30, 'Every month'], [91, 'Every 3 months'], [365, 'Every year']];
function openRegular(name: string) {
  const g = regularOf(shopData(), name);
  if (!g) return;
  const gap = usualGap(g);
  const radio = (r: Rule, label: string, extra = '') => `<label class="check"><input type="radio" name="rule" value="${r}" ${g.rule === r ? 'checked' : ''}><span>${label}${extra}</span></label>`;
  const repeats = REPEATS.some(([n]) => n === g.repeat) ? REPEATS : [...REPEATS, [g.repeat, `Every ${g.repeat} days`] as [number, string]];
  openLayer(`<button class="x-close" type="button" data-action="layer-close" aria-label="Close">${iconSvg('x')}</button><h3>${esc(g.name)}</h3>
    <p class="muted">${esc(regStat(g))}</p>
    <form class="stack" id="reg-form" data-name="${esc(g.name)}">
      ${shopData().lists.length ? `<label class="field">Usually from <select name="store">${listOptions(g.store, 'Any shop')}</select></label>` : ''}
      <div class="row"><label class="field">Amount <input name="qty" maxlength="12" value="${esc(g.qty)}" autocomplete="off"></label>
        <label class="field">Unit <input name="unit" maxlength="12" value="${esc(g.unit)}" autocomplete="off"></label></div>
      <label class="field">Category <select name="cat">${catOptions(g.cat)}</select></label>
      <label class="check"><input type="checkbox" name="pinned" ${g.pinned ? 'checked' : ''}><span><b>Favourite</b><br><span class="muted">Pinned under the add box, for one tap.</span></span></label>
      <fieldset class="field"><legend>Comes back</legend><div class="stack">
        ${radio('none', 'Only when I add it', gap && shopData().opts.learn ? `<br><span class="muted">Suggested about ${esc(ruleText(gap))}, learned from your trips.</span>` : '')}
        ${radio('always', '<b>Always buy</b><br><span class="muted">Back on the list after every trip.</span>')}
        ${radio('every', '<b>Buy periodically</b>', `<br><span class="every">every <input name="every" type="number" min="1" max="3650" inputmode="numeric" value="${g.every || gap || 14}" aria-label="Days"> days</span>`)}
      </div></fieldset>
      <fieldset class="field"><legend>Reminder</legend><div class="row">
        <label class="field">On <input name="remind" type="date" value="${esc(g.remind)}"></label>
        <label class="field">Repeat <select name="repeat">${repeats.map(([n, l]) => `<option value="${n}" ${n === g.repeat ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div></fieldset>
      <div class="btns"><button class="btn danger" type="button" data-action="reg-forget" data-name="${esc(g.name)}">Forget</button><span class="grow"></span>
        <button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, g.name);
}
function saveRegular(f: HTMLFormElement) {
  const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
  const name = f.dataset.name!;
  const rule = (f.querySelector<HTMLInputElement>('input[name="rule"]:checked')?.value ?? 'none') as Rule;
  const every = Math.min(3650, Math.max(1, Math.round(Number(v('every')) || 14)));
  const remind = isDay(v('remind')) ? v('remind') : '';
  const store = f.elements.namedItem('store') ? v('store') : regularOf(shopData(), name)?.store ?? '';
  change(setRegular(shopData(), name, {
    store, qty: v('qty').trim(), unit: v('unit').trim(), cat: v('cat') as Category, pinned: (f.elements.namedItem('pinned') as HTMLInputElement).checked,
    rule, every: rule === 'every' ? every : 0, remind, repeat: remind ? Number(v('repeat')) || 0 : 0,
  }), `Changed ${name}`);
  closeLayer();
}

// =================== events ===================
const findSugg = (key: string) => suggestions(shopData(), Date.now()).find((s) => s.key === key);

onShown('shopping', 'click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  const d = shopData();
  switch (btn.dataset.action) {
    case 'shop-tab': tab = btn.dataset.tab as Tab; recipeEditing = false; renderTop(); render(); window.scrollTo(0, 0); break;
    case 'undo': { const l = undo(); toast(l ? `Undone: ${l}.` : 'Nothing to undo.'); break; }
    case 'layer-close': if (ev.target === btn || btn.tagName === 'BUTTON') closeLayer(); break;
    // lists
    case 'list-pick': listId = btn.dataset.id!; typed = ''; render(); break;
    case 'list-new': openNewList(); break;
    case 'list-menu': openListMenu(); break;
    case 'list-share': shareList(); break;
    case 'list-import': openImport(); break;
    case 'list-delete': {
      const l = listOf(d, listId);
      if (!l) break;
      const x = clone(d);
      x.lists = x.lists.filter((y) => y.id !== l.id);
      closeLayer();
      commit(x, `Deleted the ${l.name} list`);
      break;
    }
    case 'complete-pick': {
      const g = regularOf(d, btn.dataset.name ?? '');
      if (!g) break;
      const p = parseQuick(typed);
      const r = addItem(d, listId, { name: g.name, cat: g.cat, ...(p.qty ? { qty: p.qty, unit: p.unit } : {}) });
      typed = '';
      if (r.added) change(r.data); else render();
      document.getElementById('shop-add-input')?.focus();
      break;
    }
    case 'pin-add': { const g = regularOf(d, btn.dataset.name ?? ''); if (g) change(addItem(d, listId, { name: g.name, cat: g.cat }).data); break; }
    case 'item-edit': openItem(btn.dataset.id!); break;
    case 'item-delete': {
      const it = listOf(d, listId)?.items.find((i) => i.id === btn.dataset.id);
      closeLayer();
      if (it) commit(removeItems(d, listId, [it.id]), `Deleted ${it.name}`);
      break;
    }
    case 'dup-ok': change(updateItem(d, listId, btn.dataset.id!, { dupOk: true })); break;
    case 'mode': change({ ...clone(d), opts: { ...d.opts, sink: btn.dataset.sink === '1' } }); break;
    case 'trip-done': openTrip(); break;
    case 'trip-yes': finishTripNow(); break;
    case 'sugg-add': {
      const s = findSugg(btn.dataset.key ?? '');
      if (!s) break;
      const to = s.store || listId;
      commit(takeSuggestion(d, s, to, Date.now()), `Added ${s.name}`, `Added ${s.name} to ${listOf(d, to)?.name}.`);
      break;
    }
    case 'sugg-dismiss': { const s = findSugg(btn.dataset.key ?? ''); if (s) commit(settleSuggestion(d, s, Date.now()), `Dismissed ${s.name}`); break; }
    // recipes
    case 'recipe-new': recipeId = null; recipeEditing = true; render(); document.querySelector<HTMLInputElement>('#recipe-form input')?.focus(); break;
    case 'recipe-open': recipeId = btn.dataset.id!; recipeEditing = false; render(); window.scrollTo(0, 0); break;
    case 'recipe-back': recipeId = null; render(); break;
    case 'recipe-edit': recipeEditing = true; render(); break;
    case 'recipe-cancel': recipeEditing = false; render(); break;
    case 'recipe-delete': {
      const r = d.recipes.find((x) => x.id === recipeId);
      if (!r) break;
      recipeId = null;
      commit({ ...clone(d), recipes: d.recipes.filter((x) => x.id !== r.id) }, `Deleted ${r.name}`);
      break;
    }
    case 'recipe-add': {
      const r = d.recipes.find((x) => x.id === recipeId);
      if (!r || !listOf(d, recipeTo)) break;
      const res = addRecipe(d, r, recipeTo);
      commit(res.data, `Added ${r.name} to ${listOf(d, recipeTo)!.name}`, `${plural(res.added, 'item')} added to ${listOf(d, recipeTo)!.name}.`);
      break;
    }
    // pantry
    case 'pantry-low': {
      const x = clone(d), h = x.pantry.find((p) => p.id === btn.dataset.id);
      if (h) { h.low = !h.low; change(x); }
      break;
    }
    // regulars
    case 'reg-open': openRegular(btn.dataset.name ?? ''); break;
    case 'reg-forget': { const n = btn.dataset.name ?? ''; closeLayer(); commit(forgetRegular(d, n), `Forgot ${n}`); break; }
  }
});

onShown('shopping', 'submit', (ev) => {
  ev.preventDefault();
  const f = ev.target as HTMLFormElement;
  const d = shopData();
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
  switch (f.id) {
    case 'list-new-form': {
      const r = addList(d, val('list-new-name'));
      if (!r) { toast(val('list-new-name').trim() ? `You can have up to ${LIMITS.lists} lists.` : 'Type the supermarket name.'); break; }
      closeLayer();
      listId = r.id; typed = '';
      change(r.data);
      break;
    }
    case 'list-rename-form': {
      const name = val('list-rename').trim().slice(0, LIMITS.name);
      if (!name) break;
      if (d.lists.some((l) => l.id !== listId && l.name.toLowerCase() === name.toLowerCase())) { toast(`There is already a ${name} list.`); break; }
      const x = clone(d), l = listOf(x, listId);
      if (l) { l.name = name; closeLayer(); change(x, 'Renamed the list'); }
      break;
    }
    case 'list-import-form': {
      const got = textToList(val('list-import-text'));
      let x = d, n = 0;
      for (const it of got.items) { const r = addItem(x, listId, it); x = r.data; if (r.added) n++; }
      closeLayer();
      if (n) commit(x, `Added a shared list`, `${plural(n, 'item')} added.`); else toast('Nothing new to add.');
      break;
    }
    case 'shop-add-form': addTyped(typed); break;
    case 'item-form': saveItem(f); break;
    case 'recipe-form': saveRecipe(f); break;
    case 'pantry-form': {
      const p = parseQuick(val('pantry-input'));
      if (!p.name) break;
      if (d.pantry.length >= LIMITS.pantry) { toast(`The pantry holds up to ${LIMITS.pantry} things.`); break; }
      (document.getElementById('pantry-input') as HTMLInputElement).value = '';
      change(addToPantry(d, p));
      break;
    }
    case 'reg-form-add': {
      const name = parseQuick(val('reg-input')).name;
      if (!name) break;
      if (regularOf(d, name)) { openRegular(name); break; }
      change(setRegular(d, name, {}));
      openRegular(name);
      break;
    }
    case 'reg-form': saveRegular(f); break;
  }
});

onShown('shopping', 'change', (ev) => {
  const t = ev.target as HTMLInputElement;
  const d = shopData();
  if (t.dataset.item) { change(updateItem(d, listId, t.dataset.item, { done: t.checked })); return; }
  if (t.dataset.used) {
    const h = d.pantry.find((p) => p.id === t.dataset.used);
    if (h) commit({ ...clone(d), pantry: d.pantry.filter((p) => p.id !== h.id) }, `Used up ${h.name}`);
    return;
  }
  if (t.id === 'recipe-to') { recipeTo = t.value; render(); return; }
  if (t.id === 'opt-topantry') { change({ ...clone(d), opts: { ...d.opts, toPantry: t.checked } }); return; }
  if (t.id === 'opt-learn') { change({ ...clone(d), opts: { ...d.opts, learn: t.checked } }); return; }
  if (t.name === 'every') { const r = t.closest('form')?.querySelector<HTMLInputElement>('input[name="rule"][value="every"]'); if (r) r.checked = true; }
});

onShown('shopping', 'input', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'shop-add-input') { typed = t.value; const c = document.getElementById('shop-complete'); if (c) c.innerHTML = completeHtml(); }
  if (t.name === 'every') { const r = t.closest('form')?.querySelector<HTMLInputElement>('input[name="rule"][value="every"]'); if (r) r.checked = true; }
});

// remember whether the suggestions are folded, so a redraw keeps them that way
onShown('shopping', 'toggle', (ev) => { if ((ev.target as HTMLElement).id === 'shop-sugg') suggOpen = (ev.target as HTMLDetailsElement).open; }, true);

// ---- start ----
onShop(render);
onAppShown('shopping', () => { renderTop(); render(); });
renderTop();
render();
shopInitialised.then(render);
