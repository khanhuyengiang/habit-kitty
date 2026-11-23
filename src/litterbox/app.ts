// The Kitty Litterbox screen: chores that come back now and then (the bedsheet every 2 weeks, the toothbrush every 6 months).
//   the list     what is due now, what is coming up, what is snoozed and what is resting (grayed out until its turn),
//                or the same chores grouped by category or by how often; a Filter for category and state
//   a chore      Done, Snooze, Delay (to its next preferred day), Skip (this time), Edit
// The data and its rules are in ./model.ts, kept on the device by ./data.ts. Drawn with Habit Kitty's stylesheet and its own,
// in web/litterbox.html.
import { iconSvg } from '../shared/art.ts';
import { PICKER_ICONS, groupedPicks, pickable, stickerSvg } from '../shared/stickers.ts';
import { onAppShown, onShown } from '../shared/apps.ts';
import { $, esc, plural } from '../shared/html.ts';
import { two } from '../shared/dates.ts';
import { getLocal, setLocal } from '../shared/local.ts';
import { makeLayer } from '../shared/layer.ts';
import { closeX, filterButton, filterSelect, homeButton, playerButton, settingsButton, titleBar } from '../shared/ui.ts';
import { COLOR, tint } from '../notes/window.ts';
import { NATIVE } from '../shared/notifications.ts';
import { alertPermission, askAlertPermission, onAlertInfo } from './notify.ts';
import { planAlerts } from './reminders.ts';
import { change, initLitterbox, litterData, litterInitialised, litterReady, onLitter, undo, undoLabel, undoTop } from './data.ts';
import {
  CAT_COLORS, LEADS, OTHER, addChore, agoText, arrange, catNameTaken, catOf, choreOf, deleteCat, defaultLead, defaultRepeat, everyText, setAlerts, delay, delayTarget, dueLine, dueOf, dayKey,
  editChore, firstDue, isDay, lastDone, markDone, nextFromLast, noFilter, ordinal, parseDay, removeChore, saveCat, scheduleText, skip, skipTarget, snooze, statusOf,
  summary, todayNum, unsnooze, weekdayName, whenText, type Arrange, type Cat, type CatColor, type ChoreEdit, type Every, type Filter,
  type LitterData, type Prefer, type StatusFilter, type Unit, type View,
} from './model.ts';

const VIEW_KEY = 'hk-litterbox-view';
const HOWS: [Arrange, string][] = [['urgency', 'Urgency'], ['category', 'Category'], ['frequency', 'Frequency']];
let how: Arrange = (HOWS.find(([h]) => h === getLocal(VIEW_KEY))?.[0]) ?? 'urgency';
let filter: Filter = { ...noFilter };
let filterOpen = false;
let shownDay = 0;                // the day the list was drawn for, so it is drawn again once the day changes

const today = () => todayNum();
// "Fri 22 May"
const dayText = (n: number) => new Date(n * 86_400_000).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// ---- the toast, with Undo when the change can be undone ----
let toastTimer = 0;
function toast(text: string, canUndo = false) {
  const el = $('lb-toast');
  el.innerHTML = `${esc(text)}${canUndo ? ' <button class="linkish" type="button" data-action="undo">Undo</button>' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), canUndo ? 6000 : 3200);
}
let hiddenUndo: object | null = null;
const commit = (next: LitterData, label: string, say = label) => { change(next, label); toast(say, true); };

// ---- header ----
const renderTop = () => { $('lb-top').innerHTML = titleBar('Kitty', 'Litterbox', homeButton() + playerButton() + settingsButton()); };

// ---- the list ----
const catIcon = (c: Cat | undefined) => `<span class="nart">${stickerSvg(c?.icon || 'bag', 1)}</span>`;
const changedFilters = () => (filter.cat ? 1 : 0) + (filter.status !== 'all' ? 1 : 0);

function choreHtml(v: View, d: LitterData, t: number): string {
  const c = v.chore, cat = catOf(d, c.cat);
  const note = (v.snoozed ? `snoozed until ${dayText(parseDay(c.snooze))}` : dueLine(v, t)) + (v.behind > 1 ? ` · ${v.behind} to catch up` : '');
  return `<li class="chore ${v.status}${v.snoozed ? ' snoozed' : ''}">
    <button class="chore-main" type="button" data-action="chore-open" data-id="${c.id}" style="${tint(cat?.color ?? 'lavender')}">
      <span class="lb-ico">${catIcon(cat)}</span>
      <span class="cname"><b>${esc(c.name)}</b><span class="when">${esc(note)}</span><span class="muted">${esc(scheduleText(c))}${c.rolling ? ', counted from when it was done' : ''}</span></span></button>
    ${v.status === 'resting' ? '' : `<button class="btn small primary" type="button" data-action="chore-done" data-id="${c.id}" aria-label="Done: ${esc(c.name)}">Done</button>`}</li>`;
}

function render() {
  const a = document.activeElement as HTMLInputElement | null;
  const id = a && $('lb-body').contains(a) ? a.id : '';
  if (!litterReady()) { $('lb-body').innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>'; return; }
  const d = litterData(), t = today();
  shownDay = t;
  const u = undoLabel(), top = undoTop();
  const undoBar = u && top !== hiddenUndo ? `<div class="lb-undo"><span class="muted">${esc(u)}</span><button class="btn small" type="button" data-action="undo">Undo</button><button class="btn small" type="button" data-action="undo-hide">Cancel</button></div>` : '';
  const panel = filterOpen ? `<div class="panel filter-panel" id="filter-panel"><div class="filter-grid">
      ${filterSelect('cat', 'Category', [['', 'All categories'], ...d.cats.map((c): [string, string] => [c.id, c.name])], filter.cat)}
      ${filterSelect('status', 'Show', [['all', 'Everything'], ['now', 'Due now'], ['coming', 'Coming up'], ['resting', 'Resting']], filter.status)}</div>
      <div class="btns end"><button class="btn small" type="button" data-action="lb-filter-reset" ${changedFilters() ? '' : 'disabled'}>Reset</button><button class="btn small primary" type="button" data-action="lb-filter">Done</button></div></div>` : '';
  const groups = arrange(d, t, how, filter);
  const list = !d.chores.length
    ? `<div class="panel"><h3>No chores yet</h3><p class="muted">Add what comes back now and then: the bedsheet, the toothbrush, the dishwasher filter. Litterbox says what is due, and when the next one is.</p>
        <div class="btns"><button class="btn primary" type="button" data-action="chore-new">+ Chore</button></div></div>`
    : groups.length ? groups.map((g) => `<section class="lb-group"><h4>${g.cat ? `<span class="lb-ico" style="${tint(g.cat.color)}">${catIcon(g.cat)}</span>` : ''}${esc(g.title)} <span class="num muted">${g.items.length}</span></h4>
        <ul class="chores">${g.items.map((v) => choreHtml(v, d, t)).join('')}</ul></section>`).join('')
      : '<div class="panel"><p class="muted">Nothing matches that filter.</p></div>';
  $('lb-body').innerHTML = `${undoBar}${d.chores.length ? `<p class="muted lb-sum">${esc(summary(d, t))}</p>` : ''}
    <div class="lb-arrange"><div class="seg" role="group" aria-label="Arrange by">${HOWS.map(([h, label]) => `<button type="button" data-action="lb-arrange" data-how="${h}" aria-pressed="${h === how}">${label}</button>`).join('')}</div></div>
    <div class="tools"><div class="toolbar">${filterButton(filterOpen, changedFilters(), 'lb-filter')}<span class="grow"></span>
      <button class="btn" type="button" data-action="alerts-open">Reminders</button><button class="btn" type="button" data-action="cats-open">Categories</button><button class="btn primary" type="button" data-action="chore-new" ${d.chores.length ? '' : 'hidden'}>+ Chore</button></div>${panel}</div>
    ${list}`;
  if (id) document.getElementById(id)?.focus();
}

// ---- dialogs ----
const dialog = makeLayer('litterbox', { id: 'lb-layer', host: () => $('lb-layer-host'), panelClass: 'lb-dialog', focus: '[data-focus], input:not([type=checkbox]):not([type=radio]), button' });
const openLayer = (html: string, label: string) => dialog.open(html, label);
const closeLayer = () => dialog.close();
let openId = '';                // the chore whose dialog is open

function openChore(id: string) {
  const d = litterData(), c = choreOf(d, id);
  if (!c) return;
  const t = today(), v = statusOf(c, t), cat = catOf(d, c.cat);
  const last = lastDone(c);
  const history = [...c.log].reverse().slice(0, 5).map((e) => `<li>${e.kind === 'done' ? 'Done' : 'Skipped'} ${esc(dayText(parseDay(e.day)))} <span class="muted">${esc(agoText(e.day, t))}</span></li>`).join('');
  openId = id;
  openLayer(`${closeX()}<h3>${esc(c.name)}</h3>
    <p class="muted">${esc(cat?.name ?? 'Other')} · ${esc(scheduleText(c))}${c.rolling ? ', counted from when it was done' : ''}${c.prefer && c.early ? ', reminds early' : ''}</p>
    <p><b>${esc(dueLine(v, t))}</b> <span class="muted">(${esc(dayText(v.due))})</span>${v.behind > 1 ? `<br><span class="muted">${v.behind} dates are waiting: each Done clears one.</span>` : ''}${v.snoozed ? `<br><span class="muted">Snoozed until ${esc(dayText(parseDay(c.snooze)))}.</span>` : ''}<br>
      <span class="muted">${last ? `Last done ${esc(agoText(last, t))}.` : 'Not done yet.'}</span>${c.note ? `<br>${esc(c.note)}` : ''}</p>
    <div class="stack">
      <button class="btn primary" type="button" data-action="chore-done-today" data-id="${id}" data-focus>Done today</button>
      <form class="lb-on" id="chore-done-on" data-id="${id}"><label class="field">I did it on <input type="date" name="on" max="${dayKey(t)}" value="${dayKey(t)}"></label><button class="btn" type="submit">Save</button></form>
      <fieldset class="field"><legend>Snooze until</legend><div class="btns flow">
        ${[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([l, n]) => `<button class="btn small" type="button" data-action="chore-snooze" data-id="${id}" data-days="${n}">${l}</button>`).join('')}
        ${v.snoozed ? `<button class="btn small" type="button" data-action="chore-unsnooze" data-id="${id}">Wake it now</button>` : ''}</div></fieldset>
      <button class="btn" type="button" data-action="chore-delay" data-id="${id}">Delay to ${esc(dayText(delayTarget(c, t)))}</button>
      <button class="btn" type="button" data-action="chore-skip" data-id="${id}">Skip this time (next: ${esc(dayText(skipTarget(c, t)))})</button>
    </div>
    ${history ? `<h4 class="sub">History</h4><ul class="lb-hist">${history}</ul>` : ''}
    <div class="btns"><button class="btn danger" type="button" data-action="chore-delete" data-id="${id}">Delete</button><span class="grow"></span>
      <button class="btn" type="button" data-action="chore-howoften" data-id="${id}">Change how often</button><button class="btn" type="button" data-action="chore-edit" data-id="${id}">Edit</button></div>`, c.name);
}

// ---- adding and changing a chore ----
const PRESETS: [string, string][] = [['1d', 'Every day'], ['2d', 'Every 2 days'], ['1w', 'Every week'], ['2w', 'Every 2 weeks'], ['1m', 'Every month'], ['3m', 'Every 3 months'], ['6m', 'Every 6 months'], ['1y', 'Every year']];
const UNITS: [Unit, string][] = [['day', 'days'], ['week', 'weeks'], ['month', 'months'], ['year', 'years']];
const LEAD_TEXT = (n: number) => (n === 0 ? 'On the day' : n === 7 ? '1 week before' : n === 14 ? '2 weeks before' : `${plural(n, 'day')} before`);
// How often a chore reminds you again after its due day, until it is done.
const REPEATS: [string, string][] = [['', "Don't repeat"], ['1d', 'Every day'], ['2d', 'Every 2 days'], ['3d', 'Every 3 days'], ['1w', 'Every week'], ['2w', 'Every 2 weeks'], ['1m', 'Every month']];
const repeatKey = (e: Every | null) => (e ? presetOf(e) : '');
const presetOf = (e: Every) => `${e.n}${e.unit[0]}`;

function openChoreForm(id: string | null, repeatFirst = false) {
  const d = litterData(), c = id ? choreOf(d, id) : undefined, t = today();
  if (id && !c) return;
  const every: Every = c?.every ?? { n: 1, unit: 'week' }, prefer: Prefer = c?.prefer ?? null;
  const preset = PRESETS.some(([v]) => v === presetOf(every)) ? presetOf(every) : 'custom';
  const kind = !prefer ? '' : 'weekday' in prefer ? 'weekday' : 'dom';
  const lead = c?.lead ?? defaultLead(every);
  const leads = [...new Set<number>([...LEADS, lead])].sort((a, b) => a - b);
  const next = c ? dueOf(c) : firstDue(t, null);
  const repeat = c ? c.repeat : defaultRepeat(every), repeats = REPEATS.some(([v]) => v === repeatKey(repeat)) ? REPEATS : [...REPEATS, [repeatKey(repeat), `${everyText(repeat!)[0].toUpperCase()}${everyText(repeat!).slice(1)}`] as [string, string]];
  const last = c ? lastDone(c) : '';
  openLayer(`${closeX()}<h3>${c ? 'Change chore' : 'New chore'}</h3>
    <form class="stack" id="chore-form" data-id="${c?.id ?? ''}" data-lead="${c ? 'set' : ''}" data-last="${last ? parseDay(last) : ''}" data-rep="${c ? 'set' : ''}" novalidate>
      <label class="field">Name <input name="name" maxlength="60" value="${esc(c?.name ?? '')}" placeholder="Change bedsheet, new toothbrush…" autocomplete="off" ${repeatFirst ? '' : 'data-focus'}></label>
      <label class="field">Category <select name="cat">${d.cats.map((k) => `<option value="${k.id}" ${k.id === (c?.cat ?? 'other') ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>
      <label class="field">Repeat <select name="preset" id="lb-preset" ${repeatFirst ? 'data-focus' : ''}>${PRESETS.map(([v, l]) => `<option value="${v}" ${v === preset ? 'selected' : ''}>${l}</option>`).join('')}<option value="custom" ${preset === 'custom' ? 'selected' : ''}>Every N…</option></select></label>
      <div class="row" id="lb-custom" ${preset === 'custom' ? '' : 'hidden'}><label class="field">Every <input name="n" type="number" inputmode="numeric" min="1" max="999" value="${every.n}"></label>
        <label class="field">Unit <select name="unit">${UNITS.map(([u, l]) => `<option value="${u}" ${u === every.unit ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <fieldset class="field"><legend>Preferred day</legend><div class="stack">
        <select name="pref" id="lb-pref" aria-label="Preferred day"><option value="">No preference</option><option value="weekday" ${kind === 'weekday' ? 'selected' : ''}>A weekday</option><option value="dom" ${kind === 'dom' ? 'selected' : ''}>A day of the month</option></select>
        <select name="weekday" id="lb-weekday" aria-label="Weekday" ${kind === 'weekday' ? '' : 'hidden'}>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<option value="${i}" ${prefer && 'weekday' in prefer && prefer.weekday === i ? 'selected' : ''}>${weekdayName(i)}</option>`).join('')}</select>
        <select name="dom" id="lb-dom" aria-label="Day of the month" ${kind === 'dom' ? '' : 'hidden'}>${[...Array(31).keys()].map((i) => i + 1).concat(0).map((i) => `<option value="${i}" ${prefer && 'dom' in prefer && prefer.dom === i ? 'selected' : ''}>${i === 0 ? 'The last day' : `The ${ordinal(i)}`}</option>`).join('')}</select></div></fieldset>
      <label class="check" id="lb-early" ${kind ? '' : 'hidden'}><input type="checkbox" name="early" ${c?.early ?? true ? 'checked' : ''}><span><b>Remind me early</b><br><span class="muted">When the due date is not on that day, take the one before it. Off: the one after.</span></span></label>
      <label class="field">Schedule <select name="mode"><option value="fixed" ${c?.rolling ? '' : 'selected'}>Fixed: keeps its dates, even when I am late</option><option value="rolling" ${c?.rolling ? 'selected' : ''}>Rolling: counted from when I do it</option></select></label>
      <label class="check" id="lb-pile" ${c?.rolling ? 'hidden' : ''}><input type="checkbox" name="pile" ${c?.pile ? 'checked' : ''}><span><b>Missed dates pile up</b><br><span class="muted">When I am several dates behind, each one stays owed and Done clears one at a time (laundry). Off: one Done catches up on all of them.</span></span></label>
      <label class="field">${c ? 'Next due' : 'First due'} <input type="date" name="next" value="${dayKey(next)}"></label>
      <p class="muted" id="lb-next-hint" hidden></p>
      <label class="field">Heads-up <select name="lead" id="lb-lead">${leads.map((n) => `<option value="${n}" ${n === lead ? 'selected' : ''}>${LEAD_TEXT(n)}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="remind" ${c?.remind ?? true ? 'checked' : ''}><span><b>Remind me</b><br><span class="muted">With a notification (switch them on under Reminders).</span></span></label>
      <label class="field" id="lb-repeat-wrap" ${c?.remind ?? true ? '' : 'hidden'}>Then remind me again <select name="repeat" id="lb-repeat">${repeats.map(([v, l]) => `<option value="${v}" ${v === repeatKey(repeat) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">Note <textarea name="note" rows="2" maxlength="1000" placeholder="Which brand, where it is kept…">${esc(c?.note ?? '')}</textarea></label>
      <div class="btns"><button class="btn" type="button" data-action="layer-close">Cancel</button><span class="grow"></span><button class="btn primary" type="submit">Save</button></div></form>`, c ? 'Change chore' : 'New chore');
}

// How often, the preferred day and "early", as the form has them now.
function formSchedule(f: HTMLFormElement): { every: Every; prefer: Prefer; early: boolean } {
  const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
  const preset = v('preset');
  const every: Every = preset === 'custom' ? { n: Number(v('n')), unit: v('unit') as Unit } : { n: Number(preset.slice(0, -1)), unit: UNITS.find(([u]) => u[0] === preset.slice(-1))![0] };
  const pref = v('pref');
  const prefer: Prefer = pref === 'weekday' ? { weekday: Number(v('weekday')) } : pref === 'dom' ? { dom: Number(v('dom')) } : null;
  return { every, prefer, early: (f.elements.namedItem('early') as HTMLInputElement).checked };
}
function readChoreForm(f: HTMLFormElement): ChoreEdit | string {
  const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
  if (!v('name').trim()) return 'Give the chore a name.';
  const s = formSchedule(f);
  if (!(s.every.n >= 1)) return 'Pick how often.';
  const next = v('next');
  if (!isDay(next)) return 'Pick the day it is next due.';
  return { name: v('name'), cat: v('cat'), note: v('note'), ...s, remind: (f.elements.namedItem('remind') as HTMLInputElement).checked, repeat: v('repeat') ? { n: Number(v('repeat').slice(0, -1)), unit: UNITS.find(([u]) => u[0] === v('repeat').slice(-1))![0] } : null, rolling: v('mode') === 'rolling', pile: (f.elements.namedItem('pile') as HTMLInputElement).checked, lead: Number(v('lead')), next: parseDay(next) };
}
// Changing how often (or the preferred day) of a chore that was done before: the next due day is suggested from the last time
// it was done, so a chore moved from every 6 months to every 3 is due 3 months after it was done. The date can still be changed by hand.
function suggestNext(f: HTMLFormElement) {
  const last = Number(f.dataset.last);
  if (!f.dataset.id || !last || f.dataset.next === 'set') return;
  const s = formSchedule(f);
  if (!(s.every.n >= 1)) return;
  const n = nextFromLast(s, last);
  (f.elements.namedItem('next') as HTMLInputElement).value = dayKey(n);
  const hint = f.querySelector<HTMLElement>('#lb-next-hint')!;
  hint.textContent = `Counted from when it was last done (${dayText(last)}). Change the date if you like.`;
  hint.hidden = false;
}
function saveChoreForm(f: HTMLFormElement) {
  const e = readChoreForm(f);
  if (typeof e === 'string') { toast(e); return; }
  const d = litterData(), id = f.dataset.id;
  if (id) { closeLayer(); commit(editChore(d, id, e, today()), `Changed ${e.name.trim()}`); return; }
  const r = addChore(d, e);
  if (!r) { toast('You can have up to 500 chores.'); return; }
  closeLayer();
  commit(r.data, `Added ${e.name.trim()}`);
}

// ---- doing, snoozing, delaying, skipping ----
const nameOf = (id: string) => choreOf(litterData(), id)?.name ?? '';
function finish(id: string, next: LitterData, label: string) {
  const c = choreOf(next, id);
  closeLayer();
  commit(next, `${label} ${nameOf(id)}`, c ? `${label} ${c.name}. Next: ${whenText(dueOf(c), today())}, ${dayText(dueOf(c))}.` : label);
}
const done = (id: string, on?: number) => finish(id, markDone(litterData(), id, today(), on), 'Done:');

// ---- reminders: on or off, and the time of day ----
const timeText = (a: { hour: number; minute: number }) => `${two(a.hour)}:${two(a.minute)}`;
function openAlerts() {
  const a = litterData().alerts;
  openLayer(`${closeX()}<h3>Reminders</h3>
    <label class="check"><input type="checkbox" id="alerts-on" ${a.on ? 'checked' : ''}><span><b>Send me notifications</b><br><span class="muted">For the chores that have Remind me on: a heads-up, the day it is due, and again until it is done (each chore says how often).</span></span></label>
    <label class="field">Time of day <input type="time" id="alerts-time" value="${timeText(a)}" ${a.on ? '' : 'disabled'}></label>
    <p class="muted" id="alerts-status" aria-live="polite"></p>
    <div class="btns"><span class="grow"></span><button class="btn primary" type="button" data-action="layer-close">Done</button></div>`, 'Reminders');
  fillAlertStatus();
}
async function fillAlertStatus() {
  const el = document.getElementById('alerts-status');
  if (!el) return;
  const perm = await alertPermission(), d = litterData(), next = planAlerts(d, new Date())[0];
  el.textContent = perm === 'unsupported' ? "Notifications aren't available here."
    : d.alerts.on && perm !== 'granted' ? "Reminders are on, but notifications are blocked. Allow them for Itty Bitty Kitty in your phone's settings, then reopen the app."
    : d.alerts.on ? (next ? `On. Next reminder: ${next.at.toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} (your local time).` : 'On. Nothing is due in the next two weeks.') + (NATIVE ? '' : ' In a browser it only works while this page is open.')
    : 'Off.';
}
async function switchAlerts(on: boolean, box: HTMLInputElement) {
  if (on) {
    const perm = await askAlertPermission();
    if (perm !== 'granted') { box.checked = false; toast(perm === 'denied' ? 'Notifications are blocked. Allow them in your phone settings first.' : "Notifications aren't available here."); fillAlertStatus(); return; }
  }
  await change(setAlerts(litterData(), { on }));
  (document.getElementById('alerts-time') as HTMLInputElement | null)?.toggleAttribute('disabled', !on);
  toast(on ? `Reminders on, at ${timeText(litterData().alerts)}.` : 'Reminders off.');
  fillAlertStatus();
}

// ---- categories ----
function openCats() {
  const d = litterData();
  openLayer(`${closeX()}<h3>Categories</h3>
    <ul class="lb-cats">${d.cats.map((c) => `<li style="${tint(c.color)}"><button class="chore-main" type="button" data-action="cat-edit" data-id="${c.id}"><span class="lb-ico">${catIcon(c)}</span><span class="cname"><b>${esc(c.name)}</b>
      <span class="muted">${plural(d.chores.filter((x) => x.cat === c.id).length, 'chore')}</span></span></button></li>`).join('')}</ul>
    <div class="btns"><button class="btn" type="button" data-action="cat-new">+ Category</button><span class="grow"></span><button class="btn primary" type="button" data-action="layer-close">Done</button></div>`, 'Categories');
}
function openCat(id: string | null) {
  const d = litterData(), c = id ? catOf(d, id) : undefined;
  if (id && !c) return;
  const icon = c ? pickable(c.icon) : 'bag', color = c?.color ?? CAT_COLORS[d.cats.length % CAT_COLORS.length];
  openLayer(`${closeX()}<h3>${c ? `Change ${esc(c.name)}` : 'New category'}</h3>
    <form class="stack" id="cat-form" data-id="${c?.id ?? ''}">
      <label class="field">Name <input name="name" maxlength="60" value="${esc(c?.name ?? '')}" placeholder="Pets, Garden, Bike…" autocomplete="off" data-focus></label>
      <fieldset class="field"><legend>Colour</legend><div class="nswatches">${CAT_COLORS.map((k) =>
        `<label title="${COLOR[k][1]}"><input type="radio" name="color" value="${k}" ${k === color ? 'checked' : ''} aria-label="${COLOR[k][1]}"><span style="${tint(k)}"></span></label>`).join('')}</div></fieldset>
      <details class="pick-fold" id="cat-pick" style="${tint(color)}"><summary><span class="nart">${stickerSvg(icon, 1)}</span> Picture</summary>
        <div class="ndoodles picons">${groupedPicks((n) =>
          `<label title="${esc(PICKER_ICONS[n].label)}"><input type="radio" name="icon" value="${n}" ${n === icon ? 'checked' : ''} aria-label="${esc(PICKER_ICONS[n].label)}"><span>${stickerSvg(n, 1)}</span></label>`)}</div></details>
      <div class="btns">${c && c.id !== OTHER ? '<button class="btn danger" type="button" data-action="cat-delete">Delete</button>' : ''}<span class="grow"></span>
        <button class="btn" type="button" data-action="cats-open">Back</button><button class="btn primary" type="submit">Save</button></div></form>`, c ? c.name : 'New category');
}
function saveCatForm(f: HTMLFormElement) {
  const d = litterData(), id = f.dataset.id || null;
  const name = (f.elements.namedItem('name') as HTMLInputElement).value;
  if (!name.trim()) { toast('Give the category a name.'); return; }
  if (catNameTaken(d, name, id)) { toast(`There is already a ${name.trim()} category.`); return; }
  const pick = (n: string) => f.querySelector<HTMLInputElement>(`input[name="${n}"]:checked`)?.value ?? '';
  const r = saveCat(d, id, { name, icon: pick('icon') || catOf(d, id ?? '')?.icon || 'bag', color: pick('color') || 'lavender' });
  if (!r) { toast('You can have up to 30 categories.'); return; }
  change(r.data, id ? `Changed ${name.trim()}` : `Added ${name.trim()}`);
  openCats();
}

// =================== events ===================
onShown('litterbox', 'click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!btn || (btn as HTMLButtonElement).disabled) return;
  const d = litterData(), id = btn.dataset.id ?? '', t = today();
  switch (btn.dataset.action) {
    case 'undo': { const l = undo(); toast(l ? `Undone: ${l}.` : 'Nothing to undo.'); break; }
    case 'undo-hide': hiddenUndo = undoTop(); $('lb-toast').hidden = true; render(); break;
    case 'lb-arrange': how = btn.dataset.how as Arrange; setLocal(VIEW_KEY, how); render(); break;
    case 'lb-filter': filterOpen = !filterOpen; render(); break;
    case 'lb-filter-reset': filter = { ...noFilter }; render(); break;
    case 'chore-new': openChoreForm(null); break;
    case 'chore-open': openChore(id); break;
    case 'chore-done': done(id); break;
    case 'chore-done-today': done(id); break;
    case 'chore-snooze': {
      const days = Number(btn.dataset.days) || 1;
      closeLayer();
      commit(snooze(d, id, t + days), `Snoozed ${nameOf(id)}`, `Snoozed ${nameOf(id)} until ${dayText(t + days)}.`);
      break;
    }
    case 'chore-unsnooze': closeLayer(); commit(unsnooze(d, id), `Woke ${nameOf(id)}`); break;
    case 'chore-delay': {
      const c = choreOf(d, id);
      if (c) { closeLayer(); commit(delay(d, id, t), `Delayed ${c.name}`, `Delayed ${c.name} to ${dayText(delayTarget(c, t))}.`); }
      break;
    }
    case 'chore-skip': finish(id, skip(d, id, t), 'Skipped'); break;
    case 'chore-edit': openChoreForm(id); break;
    case 'chore-howoften': openChoreForm(id, true); break;
    case 'chore-delete': { const n = nameOf(id); closeLayer(); commit(removeChore(d, id), `Deleted ${n}`); break; }
    case 'cats-open': openCats(); break;
    case 'alerts-open': openAlerts(); break;
    case 'cat-new': openCat(null); break;
    case 'cat-edit': openCat(id); break;
    case 'cat-delete': {
      const cid = ($('lb-layer').querySelector('#cat-form') as HTMLFormElement | null)?.dataset.id ?? '', c = catOf(d, cid);
      if (!c) break;
      change(deleteCat(d, cid), `Deleted ${c.name}`);
      toast(`Deleted ${c.name}. Its chores are in Other now.`, true);
      openCats();
      break;
    }
  }
});

onShown('litterbox', 'submit', (ev) => {
  const f = ev.target as HTMLFormElement;
  ev.preventDefault();
  if (f.id === 'chore-form') saveChoreForm(f);
  else if (f.id === 'cat-form') saveCatForm(f);
  else if (f.id === 'chore-done-on') {
    const on = (f.elements.namedItem('on') as HTMLInputElement).value;
    if (!isDay(on)) { toast('Pick the day you did it.'); return; }
    done(f.dataset.id!, Math.min(parseDay(on), today()));
  }
});

onShown('litterbox', 'change', (ev) => {
  const t = ev.target as HTMLInputElement;
  const f = t.closest('form');
  if (t.id === 'alerts-on') { switchAlerts(t.checked, t); return; }
  if (t.id === 'alerts-time') {
    const [h, m] = t.value.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) { change(setAlerts(litterData(), { hour: h, minute: m })); fillAlertStatus(); }
    return;
  }
  if (t.dataset.filter) {
    if (t.dataset.filter === 'cat') filter = { ...filter, cat: t.value };
    else filter = { ...filter, status: t.value as StatusFilter };
    render();
    return;
  }
  if (f?.id === 'cat-form') {
    if (t.name === 'color') document.getElementById('cat-pick')?.setAttribute('style', tint(t.value as CatColor));
    if (t.name === 'icon') { const n = document.querySelector('#cat-pick > summary .nart'); if (n) n.innerHTML = stickerSvg(t.value, 1); }
    return;
  }
  if (f?.id !== 'chore-form') return;
  const q = <T extends HTMLElement>(sel: string) => f.querySelector<T>(sel)!;
  if (t.id === 'lb-preset' || t.name === 'n' || t.name === 'unit') {
    q('#lb-custom').hidden = q<HTMLSelectElement>('#lb-preset').value !== 'custom';
    // a new chore's heads-up follows how often it repeats, until it is set by hand
    if (!f.dataset.lead) {
      const p = q<HTMLSelectElement>('#lb-preset').value;
      const e: Every = p === 'custom' ? { n: Number(q<HTMLInputElement>('[name=n]').value) || 1, unit: q<HTMLSelectElement>('[name=unit]').value as Unit } : { n: Number(p.slice(0, -1)), unit: UNITS.find(([u]) => u[0] === p.slice(-1))![0] };
      q<HTMLSelectElement>('#lb-lead').value = String(defaultLead(e));
    }
    // and so does how it nags once it is due
    if (!f.dataset.rep) {
      const p = q<HTMLSelectElement>('#lb-preset').value;
      const e: Every = p === 'custom' ? { n: Number(q<HTMLInputElement>('[name=n]').value) || 1, unit: q<HTMLSelectElement>('[name=unit]').value as Unit } : { n: Number(p.slice(0, -1)), unit: UNITS.find(([u]) => u[0] === p.slice(-1))![0] };
      const r = q<HTMLSelectElement>('#lb-repeat');
      if ([...r.options].some((o) => o.value === repeatKey(defaultRepeat(e)))) r.value = repeatKey(defaultRepeat(e));
    }
  }
  if (t.id === 'lb-lead') f.dataset.lead = 'set';
  if (t.id === 'lb-pref') {
    q('#lb-weekday').hidden = t.value !== 'weekday';
    q('#lb-dom').hidden = t.value !== 'dom';
    q('#lb-early').hidden = !t.value;
  }
  if (t.name === 'mode') q('#lb-pile').hidden = t.value === 'rolling';
  if (t.name === 'remind') q('#lb-repeat-wrap').hidden = !t.checked;
  if (t.id === 'lb-repeat') f.dataset.rep = 'set';
  if (t.name === 'next') { f.dataset.next = 'set'; q('#lb-next-hint').hidden = true; return; }
  if (['preset', 'n', 'unit', 'pref', 'weekday', 'dom', 'early'].includes(t.name)) suggestNext(f);
});

// ---- start ----
// The list says "tomorrow" and "overdue" by the day, so it is drawn again when the day changes while the app stays open.
setInterval(() => { if (document.documentElement.dataset.app === 'litterbox' && litterReady() && todayNum() !== shownDay && !$('lb-layer-host').firstChild) render(); }, 60_000);
onLitter(render);
onAlertInfo(() => void fillAlertStatus());
onAppShown('litterbox', () => { renderTop(); render(); });
renderTop();
render();
litterInitialised.then(render);
initLitterbox();
