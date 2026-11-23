// What every app that sends notifications needs: whether this is the phone app, and asking for permission.
// On the phone they are local notifications; in a browser they can only show while the page is open.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const NATIVE = Capacitor.isNativePlatform();
export type Perm = 'granted' | 'denied' | 'prompt' | 'unsupported';

// Habit Kitty's notifications have ids below this, Kitty Litterbox's from it up, so each app can replace its own
// pending notifications without cancelling the other's.
export const LITTERBOX_ID_BASE = 1_000_000_000;

export async function notifPermission(ask: boolean): Promise<Perm> {
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
