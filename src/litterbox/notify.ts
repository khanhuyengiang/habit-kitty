// Kitty Litterbox's notifications: scheduling what ./reminders.ts plans (on the phone as local notifications; in a browser
// only while the page is open). Habit Kitty starts this (startAlerts), like its own reminders, so they keep coming whichever
// screen is showing. Habit Kitty's notifications have ids below LITTERBOX_ID_BASE and these from it up, and each side only
// ever cancels its own.
import { LocalNotifications } from '@capacitor/local-notifications';
import { getLocal, setLocal } from '../shared/local.ts';
import { LITTERBOX_ID_BASE, NATIVE, notifPermission, type Perm } from '../shared/notifications.ts';
import { litterData, litterReady, onLitter } from './data.ts';
import { planAlerts } from './reminders.ts';

export type { Perm };
export interface AlertInfo { perm: Perm; next: Date | null; error?: boolean }
let info: AlertInfo = { perm: 'prompt', next: null };
export const alertInfo = (): AlertInfo => info;
export const alertPermission = () => notifPermission(false);

let webTimer = 0;
let planSig = '';   // what is currently scheduled; an unchanged plan needs no native calls
let syncing: Promise<void> = Promise.resolve();
let debounce = 0;
const FIRED_KEY = 'hk-litterbox-fired';
const listeners = new Set<() => void>();
export const onAlertInfo = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export const queueAlertSync = () => {
  clearTimeout(debounce);
  debounce = window.setTimeout(() => { syncing = syncing.then(syncAlerts); }, 400);
};

// Rebuilds every pending notification from the current data. Each has one id per moment, so running this any number of
// times never leaves duplicates. Called after every change and every time the app opens.
async function syncAlerts() {
  if (!litterReady()) return;
  try {
    const d = litterData();
    const perm = await notifPermission(false);
    const plan = d.alerts.on && perm === 'granted' ? planAlerts(d, new Date()) : [];
    const sig = JSON.stringify(plan.map((p) => [p.id, p.at.getTime(), p.body]));
    info = { perm, next: plan[0]?.at ?? null };
    if (sig === planSig) { tell(); return; }
    clearTimeout(webTimer);
    if (NATIVE) {
      const pending = (await LocalNotifications.getPending()).notifications.filter((n) => n.id >= LITTERBOX_ID_BASE);
      if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
      if (plan.length) await LocalNotifications.schedule({ notifications: plan.map((p) => ({
        id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true }, smallIcon: 'ic_stat_notify',
      })) });
    } else if (plan[0]) {
      // The web page can only remind you while it is open.
      const first = plan[0];
      webTimer = window.setTimeout(() => {
        if (getLocal(FIRED_KEY) === String(first.id)) return;   // already shown for this moment
        try { new Notification(first.title, { body: first.body }); } catch { /* ignore */ }
        setLocal(FIRED_KEY, String(first.id));
        queueAlertSync();
      }, Math.min(2_000_000_000, Math.max(0, first.at.getTime() - Date.now())));
    }
    planSig = sig;
  } catch { planSig = ''; info = { ...info, error: true }; }
  tell();
}
const tell = () => { for (const l of listeners) l(); };

// Asks for permission when notifications are being switched on.
export async function askAlertPermission(): Promise<Perm> {
  const perm = await notifPermission(true);
  info = { ...info, perm };
  tell();
  return perm;
}

let started = false;
export function startAlerts() {
  if (started) return;
  started = true;
  onLitter(queueAlertSync);
  setInterval(queueAlertSync, 3_600_000);   // the plan reaches two weeks ahead and drifts as days go by
  queueAlertSync();
}
