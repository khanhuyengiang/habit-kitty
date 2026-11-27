// Habit Kitty and Pawchievement share one page: both are in it, and the shell (web/shell.ts) shows one at a time.
// <html data-app> says which one is showing. Each app's own styles are switched off while it is hidden, and its
// listeners on the document ignore events while it is hidden, so the two never act on each other's buttons.
import { monoSvg } from './pixelart.ts';
import { miniSvg } from './pixelcat.ts';
import { getLocal, readJson, setLocal, writeJson } from './local.ts';

// The home page, the diary (Kitty Journal), the notes (Kitty Library), Kitty Mart, Kitty Gallery, Kitty Litterbox and the two apps: <html data-app> says which one is showing. (Habit Kitty's styles also serve the home page, the diary and the notes.)
export type AppName = 'home' | 'habit' | 'diary' | 'notes' | 'achievement' | 'shopping' | 'pixel' | 'litterbox' | 'wardrobe';
export const APP_TITLE: Record<AppName, string> = { home: 'Itty Bitty Kitty', habit: 'Habit Kitty', diary: 'Journal', notes: 'Library', achievement: 'Pawchievement', shopping: 'Mart', pixel: 'Gallery', litterbox: 'Litterbox', wardrobe: 'Wardrobe' };

// Kitty Wardrobe is Kitty Gallery's editor opened on the kitty (its sprites, animations and skins): it shares the page and the
// saved icons, so while it shows <html data-app> is 'pixel' and <html data-mode> is 'wardrobe'. It is hidden from the home page until it is switched on
// (Settings → Apps to show), on this device.
export const inWardrobe = () => document.documentElement.dataset.mode === 'wardrobe';
const WARDROBE_KEY = 'hk-wardrobe';   // before the list below, Wardrobe had its own switch: '1' still counts as on
// Settings → Apps to show: which apps have a key on the home page, kept on this device. All of them, except Wardrobe, until chosen otherwise.
const SHOWN_KEY = 'hk-apps-shown';
export const appShown = (app: string): boolean => {
  const own = readJson<Record<string, boolean>>(SHOWN_KEY)?.[app];
  return typeof own === 'boolean' ? own : app === 'wardrobe' ? getLocal(WARDROBE_KEY) === '1' : true;
};
export const setAppShown = (app: string, on: boolean) => { writeJson(SHOWN_KEY, { ...readJson<Record<string, boolean>>(SHOWN_KEY), [app]: on }); };
export const wardrobeOn = () => appShown('wardrobe');

export const shownApp = (): AppName => {
  const a = document.documentElement.dataset.app;
  return a === 'achievement' || a === 'home' || a === 'diary' || a === 'notes' || a === 'shopping' || a === 'pixel' || a === 'litterbox' ? a : 'habit';
};

// The app opened last, kept on this device: the home page marks its key. Habit Kitty
// until another app has been opened.
const LAST_KEY = 'hk-last-app';
export const rememberApp = (app: AppName) => {
  if (app === 'home') return;
  setLocal(LAST_KEY, app);   // not remembered: Habit Kitty stays marked
};
export const lastApp = (): AppName => {
  const a = getLocal(LAST_KEY);
  return a === 'diary' || a === 'notes' || a === 'achievement' || a === 'shopping' || a === 'pixel' || a === 'litterbox' || (a === 'wardrobe' && wardrobeOn()) ? a : 'habit';
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

// The trophy: Pawchievement's icon on the home page and in the room.
const TROPHY = ['ooooooooo', 'o.ooooo.o', 'o.ooooo.o', '.ooooooo.', '..ooooo..', '...ooo...', '....o....', '...ooo...', '.ooooooo.'];
export const trophyIcon = () => monoSvg(TROPHY);

// Ask the shell to show a screen (it listens for this and for clicks on [data-action="go"]).
export const GO_EVENT = 'kitty-go';
export const goTo = (to: AppName, tab?: string) => document.dispatchEvent(new CustomEvent(GO_EVENT, { detail: { to, tab } }));
// The shell tells an app which tab to open when it was asked for one.
export const TAB_EVENT = 'kitty-tab';
