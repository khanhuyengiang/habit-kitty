// The Kitty Mart screen: four tabs.
//   Lists     suggestions on top (grouped by supermarket), then one shopping list per supermarket
//   Recipes   ingredients that go onto a list, only the ones you don't have and that aren't on it already
//   Pantry    the stuff you have: a card per category (yours to make), each opening a page sorted by sub-category, with
//             what was used up under "Had before"; mark something low to get it suggested. Where you put an item is
//             remembered, for that item everywhere
//   Regulars  everything you have bought: pin favourites, "always buy", "every 2 weeks", reminders (all optional)
// The data and its rules are in ./model.ts, kept on the device by ./data.ts (Habit Kitty starts it). Drawn with Habit
// Kitty's stylesheet and its own, in web/shopping.html.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { iconSvg } from '../pixelart.ts';
import { PICKER_ICONS, groupedPicks, stickerSvg } from '../achievement/pixelart.ts';
import { monoSvg } from '../shared/pixelart.ts';
import { onAppShown, onShown } from '../shared/apps.ts';
import { esc, plural } from '../shared/html.ts';
import { homeButton, playerButton, settingsButton, titleBar } from '../shared/ui.ts';
import { COLOR, tint, winBar } from '../notes/window.ts';
import { change, onShop, shopData, shopInitialised, shopReady, undo, undoLabel } from './data.ts';
import {
  CAT_COLORS, LIMITS, OTHER, addItem, addList, addRecipe, addSub, addToPantry, agoText, alsoIn, canStep, catName, catNameTaken, catOf,
  clone, complete, dayTime, deleteCat, findInPantry, finishTrip, forgetHad, forgetRegular, guessCategory, hadBefore, inPantry,
  ingredientsText, isDay, itemText, lastBought, learnPlace, listOf, listToText, moveCat, moveItem, newId, onList, pantryCount,
  parseIngredients, parseQuick, placeOf, qtyText, recipeNeeds, regularOf, removeItems, restock, ruleText, saveCat, setRegular,
  settleSuggestion, shelves, shownItems, stepHave, suggestions, takeSuggestion, textToList, updateHave, updateItem, useUp, usualGap,
  type Cat, type CatColor, type Category, type Had, type Have, type Item, type Recipe, type Regular, type Rule, type Suggestion,
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
let pantryCat: string | null = null;   // the category page that is open (null: the cards)
let pantryQuery = '';            // what is in the pantry's find-or-add box
let shelfSub = '';               // the sub-category picked in a category page's add box
let hadOpen = false;             // the "Had before" fold
let pantryView: 'cards' | 'list' = 'cards';   // the pantry's home: a card per category, or everything in one list

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

const catOptions = (sel: Category) => shopData().cats.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
const subOptions = (cat: Category, sel: string) => `<option value="">No sub-category</option>${(catOf(shopData(), cat)?.subs ?? [])
  .map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}`;
const catIcon = (c: Cat | undefined, size: 1 | 2 = 2) => stickerSvg(c && PICKER_ICONS[c.icon] ? c.icon : 'bag', size);
// "Cupboard · Baking"
const whereText = (x: { cat: Category; sub: string }) => { const c = catOf(shopData(), x.cat); return [c?.name ?? 'Other', c?.subs.find((s) => s.id === x.sub)?.name].filter(Boolean).join(' · '); };
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
    <label class="check"><input type="checkbox" data-item="${it.id}" ${it.done ? 'checked' : ''}><span class="iname">${it.qty || it.unit ? `<b class="qty">${esc(qtyText(it))}</b> ` : ''}${esc(it.name)}${it.from?.length ? ` <span class="from">(${esc(it.from.join(', '))})</span>` : ''}</span></label>
    <span class="ikeys"><button class="gear sm" type="button" data-action="item-edit" data-id="${it.id}" aria-label="Change ${esc(it.name)}">${iconSvg('pencil')}</button>
      <button class="gear sm" type="button" data-action="item-delete" data-id="${it.id}" aria-label="Delete ${esc(it.name)}">${iconSvg('x')}</button></span>
    ${also.length ? `<p class="dup">Also in ${esc(also.join(' and '))} shopping list. <button class="linkish" type="button" data-action="dup-ok" data-id="${it.id}">Ignore</button></p>` : ''}</li>`;
}

function listHtml(): string {
  const d = shopData();
  const l = listOf(d, listId)!;
  const pins = Object.values(d.regulars).filter((g) => g.pinned && (!g.store || g.store === l.id) && !onList(l, g.name)).sort((a, b) => a.name.localeCompare(b.name));
  const groups = shownItems(l, d.opts.sink, d.cats, (n) => placeOf(d, n).sub);
  const anyDone = l.items.some((i) => i.done);
  return `<section class="panel shop-list" aria-label="${esc(l.name)} shopping list">
    <div class="shop-head"><h3>${esc(l.name)}</h3><button class="btn small" type="button" data-action="list-menu">List…</button></div>
    <form class="shop-add" id="shop-add-form"><label class="field"><input id="shop-add-input" maxlength="80" placeholder="Add: 2 milk, 500 g flour" autocomplete="off" enterkeyhint="done" aria-label="Add an item" value="${esc(typed)}"></label>
      <button class="btn primary" type="submit">Add</button></form>
    <div class="shop-complete" id="shop-complete">${completeHtml()}</div>
    ${pins.length ? `<div class="shop-pins" aria-label="Favourites">${pins.map((g) => `<button class="btn small" type="button" data-action="pin-add" data-name="${esc(g.name)}">${star()} ${esc(g.name)}</button>`).join('')}</div>` : ''}
    ${groups.length ? groups.map((g) => `<div class="shop-group"><h4>${g.cat === 'done' ? 'In the basket' : esc(catName(d, g.cat))}</h4>${g.shelves.map((s) =>
      `${s.name ? `<h5>${esc(s.name)}</h5>` : ''}<ul class="shop-items">${s.items.map(itemHtml).join('')}</ul>`).join('')}</div>`).join('')
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
  const r = addItem(d, listId, { name, ...(p.qty ? { qty: p.qty, unit: p.unit } : {}), cat: guessCategory(p.name, d) });
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
      <div class="row"><label class="field">Category <select name="cat" id="item-cat">${catOptions(it.cat)}</select></label>
        <label class="field">Sub-category <select name="sub" id="item-sub">${subOptions(it.cat, placeOf(d, it.name).sub)}</select></label></div>
      ${it.from?.length ? `<p class="muted">For ${esc(it.from.join(', '))}.</p>` : ''}
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
  // put somewhere else: it goes there everywhere from now on
  if (v('cat') !== it.cat || v('sub') !== placeOf(d, name).sub) d = learnPlace(d, name, v('cat'), v('sub'));
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
  const items = parseIngredients(v('items'), d), notes = v('notes').slice(0, LIMITS.notes);
  const old = recipeId ? d.recipes.find((x) => x.id === recipeId) : undefined;
  if (old) Object.assign(old, { name, items, notes });
  else { recipeId = newId(); d.recipes.push({ id: recipeId, name, items, notes }); }
  recipeEditing = false;
  change(d, old ? `Changed ${name}` : `Added ${name}`);
}

// =================== Pantry ===================
// The categories as cards, two to a row (the notes' little windows); a card opens the category's page, with what is in it
// sorted by sub-category and what was in it before. The box on top finds something, or adds it where it went last time.
function pantryHtml(): string {
  const d = shopData();
  const c = pantryCat ? catOf(d, pantryCat) : undefined;
  if (!c) pantryCat = null;
  return c ? catPageHtml(c) : pantryHomeHtml();
}

function pantryHomeHtml(): string {
  const d = shopData();
  const low = d.pantry.filter((h) => h.low).length;
  return `<form class="shop-add" id="pantry-form"><label class="field"><input id="pantry-input" maxlength="80" placeholder="Find or add: rice, 6 eggs" autocomplete="off" enterkeyhint="done" aria-label="Find or add to the pantry" value="${esc(pantryQuery)}"></label>
      <button class="btn primary" type="submit">Add</button></form>
    <div class="seg pview" role="radiogroup" aria-label="Show the pantry as">${(['cards', 'list'] as const).map((v) =>
      `<button type="button" role="radio" data-action="pantry-view" data-view="${v}" aria-checked="${pantryView === v}" aria-selected="${pantryView === v}">${v === 'cards' ? 'Cards' : 'List'}</button>`).join('')}</div>
    <div id="pantry-main">${pantryMainHtml()}</div>
    <div class="shop-bar"><span class="muted">${plural(d.pantry.length, 'thing')} at home${low ? ` · ${low} running low` : ''}</span><span class="grow"></span>
      <button class="btn small" type="button" data-action="cat-new" ${d.cats.length >= LIMITS.cats ? 'disabled' : ''}>+ Category</button></div>
    <label class="check"><input type="checkbox" id="opt-showempty" ${d.opts.showEmpty ? 'checked' : ''}><span><b>Show empty categories</b><br><span class="muted">The cards of categories with nothing in them.</span></span></label>
    <label class="check"><input type="checkbox" id="opt-topantry" ${d.opts.toPantry ? 'checked' : ''}><span><b>Fill from shopping trips</b><br><span class="muted">When a trip is done, what you bought is put in here, where it went before.</span></span></label>`;
}

function pantryMainHtml(): string {
  const d = shopData();
  const name = parseQuick(pantryQuery).name;
  if (!name) {
    if (pantryView === 'list') return pantryListHtml();
    const cats = d.opts.showEmpty ? d.cats : d.cats.filter((c) => pantryCount(d, c.id).n);
    return cats.length ? `<div class="ngrid pgrid">${cats.map(catCardHtml).join('')}</div>`
      : '<div class="panel"><p class="muted">The pantry is empty. Type above to add something, or tick <b>Show empty categories</b> below.</p></div>';
  }
  const f = findInPantry(d, pantryQuery);
  const add = inPantry(d, name) ? '' : `<p class="muted">Tap <b>Add</b> to put ${esc(name)} in ${esc(whereText(placeOf(d, name)))}.</p>`;
  return `<section class="panel shop-list">
    ${f.have.length ? `<div class="shop-group"><h4>You have</h4><ul class="shop-items">${f.have.map((h) => haveRowHtml(h, true)).join('')}</ul></div>` : ''}
    ${f.had.length ? `<div class="shop-group"><h4>Had before</h4><ul class="srows">${f.had.map((h) => hadRowHtml(h, true)).join('')}</ul></div>` : ''}
    ${!f.have.length && !f.had.length ? '<p class="muted">Nothing called that yet.</p>' : ''}${add}</section>`;
}

// Everything at home on one page: a section per category that has something in it (in the categories' order), sorted
// into its sub-categories like the category's own page.
function pantryListHtml(): string {
  const d = shopData();
  const cats = d.cats.filter((c) => pantryCount(d, c.id).n);
  if (!cats.length) return '<div class="panel"><p class="muted">The pantry is empty. Type above to add something.</p></div>';
  return cats.map((c) => `<section class="panel shop-list" aria-label="${esc(c.name)}">
      <div class="shop-head"><h3 class="pcat-title" style="${tint(c.color)}"><span class="nart">${catIcon(c, 1)}</span>${esc(c.name)}</h3>
        <button class="btn small" type="button" data-action="cat-open" data-id="${c.id}" aria-label="Open ${esc(c.name)}">Open</button></div>
      ${shelves(d, c.id).filter((s) => s.items.length).map((s) => `<div class="shop-group">${s.name ? `<h4>${esc(s.name)}</h4>` : ''}
        <ul class="shop-items">${s.items.map((h) => haveRowHtml(h)).join('')}</ul></div>`).join('')}</section>`).join('');
}

function catCardHtml(c: Cat): string {
  const { n, low } = pantryCount(shopData(), c.id);
  const face = low ? 'starving' : n ? 'happy' : 'sleepy';
  return `<button type="button" class="nwin ncard pcard" style="${tint(c.color)}" data-action="cat-open" data-id="${c.id}" aria-label="${esc(c.name)}: ${plural(n, 'thing')}${low ? `, ${low} running low` : ''}">${winBar(c.name, face)}
    <span class="nwin-screen"><span class="nart">${catIcon(c)}</span>
      <span class="ncard-text">${n ? plural(n, 'thing') : '<span class="muted">Empty</span>'}</span>
      <span class="ncard-foot">${low ? `${low} running low` : c.subs.length ? esc(c.subs.slice(0, 3).map((s) => s.name).join(', ') + (c.subs.length > 3 ? '…' : '')) : ''}</span></span></button>`;
}

function catPageHtml(c: Cat): string {
  const d = shopData();
  const had = hadBefore(d, c.id);
  if (!c.subs.some((s) => s.id === shelfSub)) shelfSub = '';
  return `<div class="shop-bar"><button class="btn small" type="button" data-action="cat-back">${iconSvg('prev')} Pantry</button><span class="grow"></span>
      <button class="btn small" type="button" data-action="cat-edit">${iconSvg('pencil')} Edit</button></div>
    <section class="panel shop-list" aria-label="${esc(c.name)}">
      <div class="shop-head"><h3 class="pcat-title" style="${tint(c.color)}"><span class="nart">${catIcon(c, 1)}</span>${esc(c.name)}</h3></div>
      <form class="shop-add pshelf-add" id="shelf-form"><label class="field"><input id="shelf-input" maxlength="80" placeholder="Add: 2 beans" autocomplete="off" enterkeyhint="done" aria-label="Add to ${esc(c.name)}"></label>
        ${c.subs.length ? `<label class="field"><select id="shelf-sub" aria-label="Sub-category">${subOptions(c.id, shelfSub)}</select></label>` : ''}
        <button class="btn primary" type="submit">Add</button></form>
      ${shelves(d, c.id).map((s) => `<div class="shop-group">${s.name ? `<h4>${esc(s.name)}</h4>` : ''}
        ${s.items.length ? `<ul class="shop-items">${s.items.map((h) => haveRowHtml(h)).join('')}</ul>` : `<p class="muted">${s.sub ? 'Nothing here.' : 'Nothing here yet.'}</p>`}</div>`).join('')}
      <div class="btns"><button class="btn small" type="button" data-action="sub-new" ${c.subs.length >= LIMITS.subs ? 'disabled' : ''}>+ Sub-category</button></div>
    </section>
    ${had.length ? `<details class="panel fold" id="shop-had" ${hadOpen ? 'open' : ''}><summary>Had before <span class="num muted">${had.length}</span></summary><div class="fold-body">
      <p class="muted">What was in ${esc(c.name)} and got used up. Put it back in, or on a shopping list.</p>
      <ul class="srows">${had.map((h) => hadRowHtml(h)).join('')}</ul></div></details>` : ''}`;
}

function haveRowHtml(h: Have, where = false): string {
  return `<li class="prow">
    <button class="pname" type="button" data-action="have-edit" data-id="${h.id}" aria-label="Change ${esc(h.name)}"><span class="iname">${h.qty || h.unit ? `<b class="qty">${esc(qtyText(h))}</b> ` : ''}${esc(h.name)}</span>${where ? `<span class="muted">${esc(whereText(h))}</span>` : ''}</button>
    <span class="pkeys">${canStep(h) ? `<button class="btn small step" type="button" data-action="have-step" data-by="-1" data-id="${h.id}" aria-label="One ${esc(h.name)} less">−</button><button class="btn small step" type="button" data-action="have-step" data-by="1" data-id="${h.id}" aria-label="One ${esc(h.name)} more">+</button>` : ''}
      <button class="btn small low" type="button" data-action="pantry-low" data-id="${h.id}" aria-pressed="${h.low}">${h.low ? 'Low' : 'Low?'}</button></span></li>`;
}

function hadRowHtml(h: Had & { key: string }, where = false): string {
  const lists = shopData().lists.length > 0;
  const when = [where ? whereText(h) : '', `used up ${agoText(h.gone, Date.now())}`, h.times > 1 ? `had ${h.times}×` : ''].filter(Boolean).join(' · ');
  return `<li><span class="sname"><b>${esc(itemText(h))}</b><span class="muted">${esc(when)}</span></span>
    <button class="btn small" type="button" data-action="had-back" data-key="${esc(h.key)}" aria-label="Put ${esc(h.name)} back in">Back in</button>
    ${lists ? `<button class="btn small" type="button" data-action="had-list" data-key="${esc(h.key)}" aria-label="Put ${esc(h.name)} on the shopping list">+ List</button>` : ''}
    <button class="gear sm" type="button" data-action="had-forget" data-key="${esc(h.key)}" aria-label="Forget ${esc(h.name)}">${iconSvg('x')}</button></li>`;
}

// The list something from the pantry goes onto: the open one, else the one it is usually bought at, else the first.
const listFor = (name: string) => { const d = shopData(); return listOf(d, listId) ?? listOf(d, regularOf(d, name)?.store ?? '') ?? d.lists[0]; };
function toList(name: string, it: { qty: string; unit: string; cat: Category }) {
  const d = shopData(), l = listFor(name);
  if (!l) return;
  const r = addItem(d, l.id, { name, qty: it.qty, unit: it.unit, cat: it.cat });
  if (r.added) commit(r.data, `Added ${name} to ${l.name}`, `Added ${name} to ${l.name}.`);
  else toast(onList(l, name) ? `${name} is already on the ${l.name} list.` : `The ${l.name} list is full.`);
}

// ---- a thing in the pantry ----
function openHave(id: string) {
  const d = shopData(), h = d.pantry.find((p) => p.id === id);
  if (!h) return;
  const l = d.lists.length ? listFor(h.name) : undefined;
  openLayer(`<button class="x-close" type="button" data-action="layer-close" aria-label="Close">${iconSvg('x')}</button><h3>${esc(h.name)}</h3>
    <form class="stack" id="have-form" data-id="${h.id}">
      <label class="field">Name <input name="name" maxlength="${LIMITS.name}" value="${esc(h.name)}" autocomplete="off"></label>
      <div class="row"><label class="field">Amount <input name="qty" maxlength="12" inputmode="decimal" value="${esc(h.qty)}" autocomplete="off"></label>
        <label class="field">Unit <input name="unit" maxlength="12" value="${esc(h.unit)}" placeholder="g, l, pack…" autocomplete="off"></label></div>
      <div class="row"><label class="field">Category <select name="cat" id="have-cat">${catOptions(h.cat)}</select></label>
        <label class="field">Sub-category <select name="sub" id="have-sub">${subOptions(h.cat, h.sub)}</select></label></div>
      <p class="muted">Kitty Mart remembers where you put it: on your shopping lists too, and next time.</p>
      <label class="check"><input type="checkbox" name="low" ${h.low ? 'checked' : ''}><span><b>Running low</b><br><span class="muted">Shows up in the suggestions.</span></span></label>
      <div class="btns flow"><button class="btn" type="button" data-action="have-used" data-id="${h.id}">Used up</button>
        ${l ? `<button class="btn" type="button" data-action="have-list" data-id="${h.id}">+ ${esc(l.name)} list</button>` : ''}</div>
      <div class="btns"><span class="grow"></span><button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, `Change ${h.name}`);
}
function saveHave(f: HTMLFormElement) {
  const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
  const h = shopData().pantry.find((p) => p.id === f.dataset.id);
  if (!h) return closeLayer();
  const next = updateHave(shopData(), h.id, { name: v('name'), qty: v('qty'), unit: v('unit'), cat: v('cat'), sub: v('sub'), low: (f.elements.namedItem('low') as HTMLInputElement).checked });
  const moved = v('cat') !== h.cat;
  closeLayer();
  commit(next, `Changed ${h.name}`, moved ? `${h.name} is in ${whereText({ cat: v('cat'), sub: v('sub') })} now.` : `Changed ${h.name}`);
}

// ---- making and changing a category ----
const subRowHtml = (id: string, name: string) => `<li><label class="field"><input data-sub="${id}" maxlength="${LIMITS.name}" value="${esc(name)}" autocomplete="off" aria-label="Sub-category"></label>
  <button class="gear sm up" type="button" data-action="cat-sub-move" data-by="-1" aria-label="Move ${esc(name)} up">${iconSvg('prev')}</button>
  <button class="gear sm down" type="button" data-action="cat-sub-move" data-by="1" aria-label="Move ${esc(name)} down">${iconSvg('next')}</button>
  <button class="gear sm" type="button" data-action="cat-sub-del" aria-label="Delete ${esc(name)}">${iconSvg('x')}</button></li>`;
function openCat(id: string | null) {
  const d = shopData(), c = id ? catOf(d, id) : undefined;
  if (id && !c) return;
  const icon = c && PICKER_ICONS[c.icon] ? c.icon : 'bag', color = c?.color ?? CAT_COLORS[d.cats.length % CAT_COLORS.length];
  const at = c ? d.cats.indexOf(c) : -1;
  openLayer(`<button class="x-close" type="button" data-action="layer-close" aria-label="Close">${iconSvg('x')}</button><h3>${c ? `Change ${esc(c.name)}` : 'New category'}</h3>
    <form class="stack" id="cat-form" data-id="${c?.id ?? ''}">
      <label class="field">Name <input name="name" maxlength="${LIMITS.name}" value="${esc(c?.name ?? '')}" placeholder="Baby, Pets, Garden…" autocomplete="off" data-focus></label>
      <fieldset class="field"><legend>Colour</legend><div class="nswatches">${CAT_COLORS.map((k) =>
        `<label title="${COLOR[k][1]}"><input type="radio" name="color" value="${k}" ${k === color ? 'checked' : ''} aria-label="${COLOR[k][1]}"><span style="${tint(k)}"></span></label>`).join('')}</div></fieldset>
      <details class="pick-fold" id="cat-pick" style="${tint(color)}"><summary><span class="nart">${stickerSvg(icon, 1)}</span> Picture</summary>
        <div class="ndoodles picons">${groupedPicks((n) =>
          `<label title="${esc(PICKER_ICONS[n].label)}"><input type="radio" name="icon" value="${n}" ${n === icon ? 'checked' : ''} aria-label="${esc(PICKER_ICONS[n].label)}"><span>${stickerSvg(n, 1)}</span></label>`)}</div></details>
      <fieldset class="field"><legend>Sub-categories</legend><div class="stack">
        <ul class="subrows" id="cat-subs">${(c?.subs ?? []).map((s) => subRowHtml(s.id, s.name)).join('')}</ul>
        <div class="shop-add"><label class="field"><input id="cat-sub-new" maxlength="${LIMITS.name}" placeholder="Baking, Spices, Tins…" autocomplete="off" aria-label="New sub-category"></label>
          <button class="btn" type="button" data-action="cat-sub-add">+ Add</button></div>
        <p class="muted">The pantry page and your shopping lists are sorted by these, in this order. Deleting one keeps what was in it.</p></div></fieldset>
      ${c ? `<fieldset class="field"><legend>Order</legend><div class="btns flow">
          <button class="btn small" type="button" data-action="cat-move" data-by="-1" ${at <= 0 ? 'disabled' : ''}>${iconSvg('prev')} Earlier</button>
          <button class="btn small" type="button" data-action="cat-move" data-by="1" ${at >= d.cats.length - 1 ? 'disabled' : ''}>Later ${iconSvg('next')}</button></div>
        <p class="muted">The cards and your shopping lists follow this order: put it the way you walk through the shop.</p></fieldset>` : ''}
      <div class="btns">${c && c.id !== OTHER ? `<button class="btn danger" type="button" data-action="cat-delete">Delete</button>` : ''}<span class="grow"></span>
        <button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, c ? c.name : 'New category');
}
function addSubRow() {
  const box = document.getElementById('cat-sub-new') as HTMLInputElement | null, ul = document.getElementById('cat-subs');
  if (!box || !ul || !box.value.trim()) return;
  if (ul.children.length >= LIMITS.subs) { toast(`A category can have up to ${LIMITS.subs} sub-categories.`); return; }
  ul.insertAdjacentHTML('beforeend', subRowHtml('', box.value.trim()));
  box.value = '';
  box.focus();
}
function saveCatForm(f: HTMLFormElement) {
  const d = shopData(), id = f.dataset.id || null;
  const name = (f.elements.namedItem('name') as HTMLInputElement).value;
  if (!name.trim()) { toast('Give the category a name.'); return; }
  if (catNameTaken(d, name, id)) { toast(`There is already a ${name.trim()} category.`); return; }
  const pick = (n: string) => f.querySelector<HTMLInputElement>(`input[name="${n}"]:checked`)?.value ?? '';
  const subs = [...f.querySelectorAll<HTMLInputElement>('#cat-subs input[data-sub]')].map((i) => ({ id: i.dataset.sub ?? '', name: i.value }));
  const extra = (document.getElementById('cat-sub-new') as HTMLInputElement | null)?.value.trim();
  if (extra) subs.push({ id: '', name: extra });
  const r = saveCat(d, id, { name, icon: pick('icon') || catOf(d, id ?? '')?.icon || 'bag', color: (pick('color') || 'lavender') as CatColor, subs });
  if (!r) { toast(`You can have up to ${LIMITS.cats} categories.`); return; }
  closeLayer();
  if (!id) { pantryCat = r.id; pantryQuery = ''; }
  change(r.data, id ? `Changed ${name.trim()}` : `Added ${name.trim()}`);
}
function openNewSub() {
  const c = catOf(shopData(), pantryCat ?? '');
  if (!c) return;
  openLayer(`<h3>New sub-category</h3><form class="stack" id="sub-new-form">
    <label class="field">In ${esc(c.name)} <input id="sub-new-name" maxlength="${LIMITS.name}" placeholder="Baking, Spices, Tins…" autocomplete="off" data-focus></label>
    <div class="btns"><button class="btn" type="button" data-action="layer-close">Cancel</button><button class="btn primary" type="submit">Add</button></div></form>`, 'New sub-category');
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
  const oldCat = regularOf(shopData(), name)?.cat;
  let d = setRegular(shopData(), name, {
    store, qty: v('qty').trim(), unit: v('unit').trim(), cat: v('cat') as Category, pinned: (f.elements.namedItem('pinned') as HTMLInputElement).checked,
    rule, every: rule === 'every' ? every : 0, remind, repeat: remind ? Number(v('repeat')) || 0 : 0,
  });
  if (v('cat') !== oldCat) d = learnPlace(d, name, v('cat'));
  change(d, `Changed ${name}`);
  closeLayer();
}

// =================== events ===================
const findSugg = (key: string) => suggestions(shopData(), Date.now()).find((s) => s.key === key);

onShown('shopping', 'click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  const d = shopData();
  switch (btn.dataset.action) {
    case 'shop-tab': tab = btn.dataset.tab as Tab; recipeEditing = false; pantryCat = null; renderTop(); render(); window.scrollTo(0, 0); break;
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
    case 'pantry-low': { const h = d.pantry.find((p) => p.id === btn.dataset.id); if (h) change(updateHave(d, h.id, { low: !h.low })); break; }
    case 'pantry-view': pantryView = btn.dataset.view === 'list' ? 'list' : 'cards'; render(); break;
    case 'cat-open': pantryCat = btn.dataset.id!; pantryQuery = ''; render(); window.scrollTo(0, 0); break;
    case 'cat-back': pantryCat = null; render(); window.scrollTo(0, 0); break;
    case 'cat-new': openCat(null); break;
    case 'cat-edit': openCat(pantryCat); break;
    case 'cat-sub-add': addSubRow(); break;
    case 'cat-sub-del': btn.closest('li')?.remove(); break;
    case 'cat-sub-move': {   // only the rows move: the order is saved with Save
      const li = btn.closest('li'), to = btn.dataset.by === '1' ? li?.nextElementSibling?.nextElementSibling ?? null : li?.previousElementSibling;
      if (!li || (btn.dataset.by !== '1' && !to) || (btn.dataset.by === '1' && !li.nextElementSibling)) break;
      li.parentElement!.insertBefore(li, to ?? null);
      btn.focus();
      break;
    }
    case 'cat-move': {
      // moved at once (the rest of the form is saved with Save); the two keys follow
      const id = ($('shop-layer').querySelector('#cat-form') as HTMLFormElement | null)?.dataset.id ?? '';
      const x = moveCat(d, id, btn.dataset.by === '1' ? 1 : -1);
      if (x === d) break;
      change(x);
      const at = x.cats.findIndex((c) => c.id === id);
      $('shop-layer').querySelectorAll<HTMLButtonElement>('[data-action="cat-move"]').forEach((b) => { b.disabled = b.dataset.by === '1' ? at >= x.cats.length - 1 : at <= 0; });
      break;
    }
    case 'cat-delete': {
      const c = catOf(d, ($('shop-layer').querySelector('#cat-form') as HTMLFormElement | null)?.dataset.id ?? '');
      if (!c) break;
      closeLayer();
      pantryCat = null;
      commit(deleteCat(d, c.id), `Deleted ${c.name}`, `Deleted ${c.name}. What was in it is in ${catName(d, OTHER)} now.`);
      break;
    }
    case 'sub-new': openNewSub(); break;
    case 'have-edit': openHave(btn.dataset.id!); break;
    case 'have-step': {
      const h = d.pantry.find((p) => p.id === btn.dataset.id);
      if (!h) break;
      const r = stepHave(d, h.id, Number(btn.dataset.by) || 0, Date.now());
      if (r.usedUp) commit(r.data, `Used up ${h.name}`); else change(r.data);
      break;
    }
    case 'have-used': { const h = d.pantry.find((p) => p.id === btn.dataset.id); closeLayer(); if (h) commit(useUp(d, h.id, Date.now()), `Used up ${h.name}`); break; }
    case 'have-list': { const h = d.pantry.find((p) => p.id === btn.dataset.id); closeLayer(); if (h) toList(h.name, h); break; }
    case 'had-back': {
      const h = d.had[btn.dataset.key ?? ''];
      if (!h) break;
      if (d.pantry.length >= LIMITS.pantry) { toast(`The pantry holds up to ${LIMITS.pantry} things.`); break; }
      commit(restock(d, btn.dataset.key!), `Put ${h.name} back`, `${h.name} is back in ${whereText(h)}.`);
      break;
    }
    case 'had-list': { const h = d.had[btn.dataset.key ?? '']; if (h) toList(h.name, h); break; }
    case 'had-forget': { const h = d.had[btn.dataset.key ?? '']; if (h) commit(forgetHad(d, btn.dataset.key!), `Forgot ${h.name}`); break; }
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
    case 'pantry-form':
    case 'shelf-form': {
      const shelf = f.id === 'shelf-form';
      const p = parseQuick(val(shelf ? 'shelf-input' : 'pantry-input'));
      if (!p.name) break;
      const already = inPantry(d, p.name);
      if (!already && d.pantry.length >= LIMITS.pantry) { toast(`The pantry holds up to ${LIMITS.pantry} things.`); break; }
      const next = addToPantry(d, shelf && pantryCat ? { ...p, cat: pantryCat, sub: shelfSub || undefined } : p);
      const h = inPantry(next, p.name)!;
      if (!shelf) pantryQuery = '';
      change(next);
      // from the cards it goes where it went before (or the guess): say where, so a wrong guess is seen
      if (!shelf) toast(already ? `${h.name} is in ${whereText(h)}.` : `Added ${h.name} to ${whereText(h)}.`);
      break;
    }
    case 'have-form': saveHave(f); break;
    case 'cat-form':
      if ((document.activeElement as HTMLElement | null)?.id === 'cat-sub-new' && val('cat-sub-new').trim()) { addSubRow(); break; }   // Enter in the new sub-category box adds it
      saveCatForm(f);
      break;
    case 'sub-new-form': {
      const r = pantryCat ? addSub(d, pantryCat, val('sub-new-name')) : null;
      if (!r) { toast('Type a name for it.'); break; }
      closeLayer();
      shelfSub = r.id;
      change(r.data, 'Added a sub-category');
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
  if (t.id === 'have-cat' || t.id === 'item-cat') { const s = document.getElementById(t.id === 'have-cat' ? 'have-sub' : 'item-sub'); if (s) s.innerHTML = subOptions(t.value, ''); return; }
  if (t.id === 'shelf-sub') { shelfSub = t.value; return; }
  if (t.name === 'color' && t.closest('#cat-form')) { document.getElementById('cat-pick')?.setAttribute('style', tint(t.value as CatColor)); return; }
  if (t.name === 'icon' && t.closest('#cat-form')) { const n = document.querySelector('#cat-pick > summary .nart'); if (n) n.innerHTML = stickerSvg(t.value, 1); return; }
  if (t.id === 'recipe-to') { recipeTo = t.value; render(); return; }
  if (t.id === 'opt-showempty') { change({ ...clone(d), opts: { ...d.opts, showEmpty: t.checked } }); return; }
  if (t.id === 'opt-topantry') { change({ ...clone(d), opts: { ...d.opts, toPantry: t.checked } }); return; }
  if (t.id === 'opt-learn') { change({ ...clone(d), opts: { ...d.opts, learn: t.checked } }); return; }
  if (t.name === 'every') { const r = t.closest('form')?.querySelector<HTMLInputElement>('input[name="rule"][value="every"]'); if (r) r.checked = true; }
});

onShown('shopping', 'input', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'shop-add-input') { typed = t.value; const c = document.getElementById('shop-complete'); if (c) c.innerHTML = completeHtml(); }
  if (t.id === 'pantry-input') { pantryQuery = t.value; const m = document.getElementById('pantry-main'); if (m) m.innerHTML = pantryMainHtml(); }
  if (t.name === 'every') { const r = t.closest('form')?.querySelector<HTMLInputElement>('input[name="rule"][value="every"]'); if (r) r.checked = true; }
});

// remember whether the suggestions are folded, so a redraw keeps them that way
onShown('shopping', 'toggle', (ev) => {
  const el = ev.target as HTMLDetailsElement;
  if (el.id === 'shop-sugg') suggOpen = el.open;
  if (el.id === 'shop-had') hadOpen = el.open;
}, true);

// ---- start ----
onShop(render);
onAppShown('shopping', () => { renderTop(); render(); });
renderTop();
render();
shopInitialised.then(render);
