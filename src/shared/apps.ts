// Habit Kitty and Achievement Kitty share one page: both are in it, and the shell (web/shell.ts) shows one at a time.
// <html data-app> says which one is showing. Each app's own styles are switched off while it is hidden, and its
// listeners on the document ignore events while it is hidden, so the two never act on each other's buttons.
import { monoSvg } from './pixelart.ts';
import { miniSvg } from './pixelcat.ts';

export type AppName = 'habit' | 'achievement';
export const APP_TITLE: Record<AppName, string> = { habit: 'Habit Kitty', achievement: 'Achievement Kitty' };

export const shownApp = (): AppName => (document.documentElement.dataset.app === 'achievement' ? 'achievement' : 'habit');

// document.addEventListener, but only while `app` is showing.
export function onShown<K extends keyof DocumentEventMap>(app: AppName, type: K, fn: (ev: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions | boolean): void;
export function onShown(app: AppName, type: string, fn: (ev: Event) => void, opts?: AddEventListenerOptions | boolean): void;
export function onShown(app: AppName, type: string, fn: (ev: Event) => void, opts?: AddEventListenerOptions | boolean) {
  document.addEventListener(type, (ev) => { if (shownApp() === app) fn(ev); }, opts);
}

// The shell tells an app it is showing again (it was hidden, so it may have missed a resize or a theme change).
export const SHOWN_EVENT = 'kitty-app-shown';
export const onAppShown = (app: AppName, fn: () => void) =>
  document.addEventListener(SHOWN_EVENT, (ev) => { if ((ev as CustomEvent<AppName>).detail === app) fn(); });

// Habit Kitty's own little cat: the pink face on its Today tab, and on the button that goes back to it.
export const habitKittySvg = () => miniSvg('happy', { fur: '#ffb3cf', pattern: 'plain' });

// The button in each app's top bar that goes to the other app, drawn like the light/dark button: it shows where it goes.
const TROPHY = ['ooooooooo', 'o.ooooo.o', 'o.ooooo.o', '.ooooooo.', '..ooooo..', '...ooo...', '....o....', '...ooo...', '.ooooooo.'];
// Habit Kitty's face as a one-colour icon like the others: solid in the text colour, the eyes cut out so the button shows
// through (dark kitty with light eyes in light mode, the other way round in dark mode).
const KITTY = ['o.......o', 'oo.....oo', 'ooooooooo', 'ooooooooo', 'oo.ooo.oo', 'ooooooooo', 'ooooooooo', '.ooooooo.'];
export function switchButton(from: AppName): string {
  const to: AppName = from === 'habit' ? 'achievement' : 'habit';
  return `<button class="gear" type="button" data-action="switch-app" data-to="${to}" aria-label="Switch to ${APP_TITLE[to]}">${monoSvg(to === 'achievement' ? TROPHY : KITTY)}</button>`;
}
