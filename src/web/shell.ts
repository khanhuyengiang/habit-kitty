// The page's entry: a small router. The home page, the diary and the two apps (Habit Kitty, Achievement Kitty) are all in one page and
// one shows at a time (see shared/apps.ts). The page opens on the home page. Habit Kitty always starts, since its reminders,
// widget and music run in the background whichever screen is showing; the others start the first time they are shown.
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { APP_TITLE, GO_EVENT, SHOWN_EVENT, TAB_EVENT, shownApp, type AppName } from '../shared/apps.ts';
import { paintBackdrop } from '../shared/backdrop.ts';

const started = new Set<AppName>();

function start(app: AppName) {
  if (started.has(app)) return;
  started.add(app);
  if (app === 'habit') import('./app.ts');
  else if (app === 'achievement') import('../achievement/web/app.ts');
  else if (app === 'diary') import('../diary/app.ts');
  else if (app === 'notes') import('../notes/app.ts');
  else import('../home/app.ts');
}

// Habit Kitty's stylesheet draws the home page too; Achievement Kitty has its own.
const styleOf = (app: AppName) => (app === 'achievement' ? 'achievement' : 'habit');

function show(app: AppName, tab?: string) {
  const from = shownApp();
  document.documentElement.dataset.app = app;
  for (const s of document.querySelectorAll<HTMLStyleElement>('style[data-app]')) s.media = s.dataset.app === styleOf(app) ? 'all' : 'not all';
  for (const el of document.querySelectorAll<HTMLElement>('[data-app-root]')) el.hidden = el.dataset.appRoot !== app;
  document.title = APP_TITLE[app];
  paintBackdrop();
  if (started.has(app)) document.dispatchEvent(new CustomEvent(SHOWN_EVENT, { detail: app }));
  else start(app);
  if (tab) document.dispatchEvent(new CustomEvent(TAB_EVENT, { detail: { app, tab, from } }));
  window.scrollTo(0, 0);
}

const asApp = (s: string | undefined): AppName => (s === 'achievement' || s === 'habit' || s === 'diary' || s === 'notes' ? s : 'home');

// Capture, so a "go" is handled here and never reaches the screen that is being hidden.
document.addEventListener('click', (ev) => {
  const b = (ev.target as Element).closest?.<HTMLElement>('[data-action="go"]');
  if (!b || b.hasAttribute('disabled')) return;
  ev.stopPropagation();
  show(asApp(b.dataset.to), b.dataset.tab);
}, true);

// Screens can also ask (the widget opens Habit Kitty's room).
document.addEventListener(GO_EVENT, (ev) => {
  const { to, tab } = (ev as CustomEvent<{ to: string; tab?: string }>).detail;
  show(asApp(to), tab);
});

// Android's back button. Achievement Kitty keeps its pages in the page's history, so there it steps back a page; anywhere
// else in an app it goes to the home page; on the home page it leaves the app as Android does by default.
if (Capacitor.isNativePlatform()) App.addListener('backButton', ({ canGoBack }) => {
  const app = shownApp();
  if (app === 'achievement' && canGoBack) history.back();
  else if (app === 'home') App.minimizeApp();
  else show('home');
});

start('habit');
show('home');
