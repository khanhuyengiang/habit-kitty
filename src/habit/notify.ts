// Habit Kitty's feeding reminders as notifications: asking for permission, scheduling what ./reminders.ts plans (on the
// phone as local notifications; in a browser only while the page is open), and the Reminders part of Settings.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { $, esc } from '../shared/html.ts';
import { iconSvg } from '../shared/art.ts';
import { lookOf, notifyIconName, type Face } from '../shared/pixelcat.ts';
import { anyReminder, catAlarmsOn, defaultReminder, planReminders, type ReminderSettings } from './reminders.ts';
import type { AppState } from './rules.ts';

interface ReminderContext {
  save: () => { state: AppState; reminder?: ReminderSettings; offsetHours: number };   // the live save
  now: () => Date;               // game time (the playtest clock can move it)
  persist: () => void;
  storeQuietly: () => void;      // keep the save on this device without anything else a change does
  toast: (text: string) => void;
}
let ctx: ReminderContext;
export const initReminders = (c: ReminderContext) => { ctx = c; };

const NATIVE = Capacitor.isNativePlatform();
type Perm = 'granted' | 'denied' | 'prompt' | 'unsupported';
export const reminderSettings = (): ReminderSettings => ctx.save().reminder ?? defaultReminder();
let reminderInfo: { perm: Perm; next: Date | null; error?: boolean } = { perm: 'prompt', next: null };

async function notifPermission(ask: boolean): Promise<Perm> {
  try {
    if (NATIVE) {
      const r = await (ask ? LocalNotifications.requestPermissions() : LocalNotifications.checkPermissions());
      return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt';
    }
    if (typeof Notification === 'undefined') return 'unsupported';
    const p = ask && Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
  } catch { return 'unsupported'; }
}

// The notification shows the kitty it is about, in its own fur and in the mood the reminder describes.
function notifyLargeIcon(p: { catId?: string; face: Face }): { largeIcon?: string } {
  const c = ctx.save().state.cats.find((k) => k.id === p.catId);
  return c ? { largeIcon: notifyIconName(lookOf(c), p.face) } : {};
}

let webTimer = 0;
let planSig = '';   // what is currently scheduled; an unchanged plan needs no native calls
let syncing: Promise<void> = Promise.resolve();
let syncDebounce = 0;
export const queueReminderSync = () => {
  clearTimeout(syncDebounce);
  syncDebounce = window.setTimeout(() => { syncing = syncing.then(syncReminders); }, 400);
};

// Rebuilds every pending reminder from the current state. Each reminder has one id per date, so running
// this any number of times never leaves duplicates. Called after every change and every time the app opens.
async function syncReminders() {
  const r = reminderSettings();
  try {
    const perm = await notifPermission(false);
    const on = anyReminder(r) && perm === 'granted';
    const { plan, picks } = on ? planReminders(ctx.save().state, r, ctx.now()) : { plan: [], picks: {} as Record<string, string> };
    // The playtest clock shifts game time away from real time; notifications fire in real time.
    const real = plan.map((p) => ({ ...p, at: new Date(p.at.getTime() - ctx.save().offsetHours * 3_600_000) }));
    const sig = JSON.stringify(real.map((p) => [p.id, p.at.getTime(), p.body, p.catId, p.face, notifyLargeIcon(p).largeIcon]));
    reminderInfo = { perm, next: real[0]?.at ?? null };
    if (sig === planSig) { renderReminder(); return; }
    clearTimeout(webTimer);
    if (NATIVE) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    if (on) {
      if (JSON.stringify(picks) !== JSON.stringify(r.picks ?? {})) {
        ctx.save().reminder = { ...r, picks };
        ctx.storeQuietly();
      }
      if (NATIVE) {
        if (real.length) await LocalNotifications.schedule({ notifications: real.map((p) => ({
          id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true }, smallIcon: 'ic_stat_notify',
          ...notifyLargeIcon(p),
        })) });
      } else if (real[0]) {
        // The web page can only remind you while it is open.
        const first = real[0];
        webTimer = window.setTimeout(() => {
          if (ctx.save().reminder?.lastFired === first.id) return;   // already shown for this date
          try { new Notification(first.title, { body: first.body }); } catch { /* ignore */ }
          ctx.save().reminder = { ...reminderSettings(), lastFired: first.id };
          ctx.persist();
        }, Math.min(2_000_000_000, Math.max(0, first.at.getTime() - Date.now())));
      }
    }
    planSig = sig;
  } catch { planSig = ''; reminderInfo = { ...reminderInfo, error: true }; }
  renderReminder();
}

const hhmm = (a: { hour: number; minute: number }) => `${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')}`;

export function renderReminder() {
  const r = reminderSettings();
  ($('reminder-on') as HTMLInputElement).checked = r.enabled;
  ($('reminder-time') as HTMLInputElement).value = hhmm(r);
  ($('reminder-time') as HTMLInputElement).disabled = !r.enabled;
  ($('last-call') as HTMLSelectElement).value = r.lastCall ?? 'off';
  const home = ctx.save().state.cats.filter((c) => c.status === 'alive');
  const alarmsOn = catAlarmsOn(r);
  ($('cat-alarms-on') as HTMLInputElement).checked = alarmsOn;
  $('cat-alarms-fold').hidden = !alarmsOn;
  const set = home.filter((c) => r.catAlarms?.[c.id]).length;
  $('cat-alarms-sum').textContent = home.length ? `Kitty alarms (${set} of ${home.length} set)` : 'Kitty alarms';
  $('cat-alarms').innerHTML = home.length ? home.map((c) => {
    const a = r.catAlarms?.[c.id];
    return `<li><span class="nm">${esc(c.name)}</span><span class="when"><input type="time" data-cat-alarm="${c.id}" value="${a ? hhmm(a) : ''}" aria-label="Feeding alarm for ${esc(c.name)}">
      <button class="btn small" type="button" data-action="cat-alarm-clear" data-id="${c.id}" ${a ? '' : 'disabled'} aria-label="Remove alarm for ${esc(c.name)}">${iconSvg('x')}</button></span></li>`;
  }).join('') : '<li class="muted">No kitties at home.</li>';
  const { perm, next, error } = reminderInfo;
  const el = $('reminder-status');
  const on = anyReminder(r);
  let text = 'Off. Turn on the daily reminder, last-call alerts, or give a kitty its own alarm.';
  let bad = false;
  if (perm === 'unsupported') { text = "Notifications aren't available here."; bad = true; }
  else if (on && perm !== 'granted') {
    text = "Reminders are on, but notifications are blocked. Allow them for Habit Kitty in your phone's settings (Apps → Habit Kitty → Notifications), then reopen the app."; bad = true;
  } else if (error) { text = "Couldn't schedule reminders. Try again in a moment."; bad = true; }
  else if (on) {
    const when = next?.toLocaleString('en', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    text = (next ? `On. Next reminder: ${when} (your local time).` : 'On. Add a kitty and reminders start.') +
      (NATIVE ? '' : ' In a browser it only works while this page is open.');
  } else if (perm === 'denied') { text = "Off. Notifications are blocked for Habit Kitty, so you'll be asked to allow them in your phone's settings."; }
  el.textContent = text;
  el.classList.toggle('bad', bad);
}

// Asks for notification permission when something is being switched on. Says why when it can't have it.
export async function ensureNotifications(): Promise<boolean> {
  const perm = await notifPermission(true);
  reminderInfo = { ...reminderInfo, perm };
  if (perm === 'granted') return true;
  ctx.toast(perm === 'denied' ? 'Notifications are blocked. Allow them in your phone settings first.' : "Notifications aren't available here.");
  return false;
}

export function setReminders(next: Partial<ReminderSettings>) {
  ctx.save().reminder = { ...reminderSettings(), ...next };
  ctx.persist(); renderReminder();
}

export async function setReminderEnabled(on: boolean) {
  if (on && !await ensureNotifications()) { setReminders({ enabled: false }); return; }
  const r = reminderSettings();
  setReminders({ enabled: on });
  ctx.toast(on ? `Reminders on, every day at ${hhmm(r)}.` : 'Reminders off.');
}
