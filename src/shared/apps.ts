// Habit Kitty and Achievement Kitty share one page: both are in it, and the shell (web/shell.ts) shows one at a time.
// <html data-app> says which one is showing. Each app's own styles are switched off while it is hidden, and its
// listeners on the document ignore events while it is hidden, so the two never act on each other's buttons.
import { monoSvg } from './pixelart.ts';
import { miniSvg } from './pixelcat.ts';

// The home page, the diary, the notes and the two apps: <html data-app> says which one is showing. (Habit Kitty's styles also serve the home page, the diary and the notes.)
export type AppName = 'home' | 'habit' | 'diary' | 'notes' | 'achievement';
export const APP_TITLE: Record<AppName, string> = { home: 'Kitty Home', habit: 'Habit Kitty', diary: 'Kitty Diary', notes: 'Kitty Notes', achievement: 'Achievement Kitty' };

export const shownApp = (): AppName => {
  const a = document.documentElement.dataset.app;
  return a === 'achievement' || a === 'home' || a === 'diary' || a === 'notes' ? a : 'habit';
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
export const habitKittySvg = () => miniSvg('happy', { fur: '#ffb3cf', pattern: 'plain' });

// One-colour icons for the home page and the buttons that lead there.
const TROPHY = ['ooooooooo', 'o.ooooo.o', 'o.ooooo.o', '.ooooooo.', '..ooooo..', '...ooo...', '....o....', '...ooo...', '.ooooooo.'];
const HOUSE = ['....o....', '...ooo...', '..ooooo..', '.ooooooo.', '..ooooo..', '..oo.oo..', '..oo.oo..'];
export const trophyIcon = () => monoSvg(TROPHY);

// The button in each app's top bar that goes back to the home page, drawn like the light/dark button.
export const homeButton = () =>
  `<button class="gear" type="button" data-action="go" data-to="home" aria-label="Home">${monoSvg(HOUSE)}</button>`;

// Ask the shell to show a screen (it listens for this and for clicks on [data-action="go"]).
export const GO_EVENT = 'kitty-go';
export const goTo = (to: AppName, tab?: string) => document.dispatchEvent(new CustomEvent(GO_EVENT, { detail: { to, tab } }));
// The shell tells an app which tab to open when it was asked for one.
export const TAB_EVENT = 'kitty-tab';
