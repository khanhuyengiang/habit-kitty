// Habit Kitty and Kitty Achievement share one page: both are in it, and the shell (web/shell.ts) shows one at a time.
// <html data-app> says which one is showing. Each app's own styles are switched off while it is hidden, and its
// listeners on the document ignore events while it is hidden, so the two never act on each other's buttons.
import { monoSvg } from './pixelart.ts';
import { miniSvg } from './pixelcat.ts';

// The home page, the diary and the notes (the Journal's two tabs), Kitty Mart, Kitty Gallery and the two apps: <html data-app> says which one is showing. (Habit Kitty's styles also serve the home page, the diary and the notes.)
export type AppName = 'home' | 'habit' | 'diary' | 'notes' | 'achievement' | 'shopping' | 'pixel';
export const APP_TITLE: Record<AppName, string> = { home: 'Kitty Home', habit: 'Habit Kitty', diary: 'Kitty Journal', notes: 'Kitty Journal', achievement: 'Kitty Achievement', shopping: 'Kitty Mart', pixel: 'Kitty Gallery' };

export const shownApp = (): AppName => {
  const a = document.documentElement.dataset.app;
  return a === 'achievement' || a === 'home' || a === 'diary' || a === 'notes' || a === 'shopping' || a === 'pixel' ? a : 'habit';
};

// The app opened last (the Journal's two tabs count as one), kept on this device: the home page marks its key. Habit Kitty
// until another app has been opened.
const LAST_KEY = 'hk-last-app';
export const rememberApp = (app: AppName) => {
  if (app === 'home') return;
  try { localStorage.setItem(LAST_KEY, app === 'notes' ? 'diary' : app); } catch { /* not remembered: Habit Kitty stays marked */ }
};
export const lastApp = (): AppName => {
  let a: string | null = null;
  try { a = localStorage.getItem(LAST_KEY); } catch { /* storage blocked */ }
  return a === 'diary' || a === 'achievement' || a === 'shopping' || a === 'pixel' ? a : 'habit';
};

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
export const habitKittySvg = () => miniSvg('happy', { fur: '#ffb3d0', pattern: 'plain' });

// The trophy: Kitty Achievement's icon on the home page and in the room.
const TROPHY = ['ooooooooo', 'o.ooooo.o', 'o.ooooo.o', '.ooooooo.', '..ooooo..', '...ooo...', '....o....', '...ooo...', '.ooooooo.'];
export const trophyIcon = () => monoSvg(TROPHY);

// The Journal: the diary and the notes are its two tabs. Each is its own screen, so the tabs are buttons that go to the other one.
export const journalTabs = (on: 'diary' | 'notes') =>
  `<nav class="nav" aria-label="Journal"><div class="seg" role="tablist">${([['diary', 'Diary'], ['notes', 'Notes']] as const).map(([to, label]) =>
    `<button type="button" role="tab" ${to === on ? '' : `data-action="go" data-to="${to}" `}aria-selected="${to === on}">${label}</button>`).join('')}</div></nav>`;

// Ask the shell to show a screen (it listens for this and for clicks on [data-action="go"]).
export const GO_EVENT = 'kitty-go';
export const goTo = (to: AppName, tab?: string) => document.dispatchEvent(new CustomEvent(GO_EVENT, { detail: { to, tab } }));
// The shell tells an app which tab to open when it was asked for one.
export const TAB_EVENT = 'kitty-tab';
