// The page's entry: Habit Kitty and Achievement Kitty in one page, one showing at a time (see shared/apps.ts).
// Habit Kitty always starts, since its reminders, widget and music run in the background whichever app is showing.
// Achievement Kitty starts the first time it is shown.
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { APP_TITLE, SHOWN_EVENT, shownApp, type AppName } from '../shared/apps.ts';
import { paintBackdrop } from '../shared/backdrop.ts';

const KEY = 'kitty-app';   // the app that was showing last, so the page opens on it again
const started = new Set<AppName>();

function start(app: AppName) {
  if (started.has(app)) return;
  started.add(app);
  if (app === 'habit') import('./app.ts');
  else import('../achievement/web/app.ts');
}

function show(app: AppName) {
  document.documentElement.dataset.app = app;
  for (const s of document.querySelectorAll<HTMLStyleElement>('style[data-app]')) s.media = s.dataset.app === app ? 'all' : 'not all';
  for (const el of document.querySelectorAll<HTMLElement>('[data-app-root]')) el.hidden = el.dataset.appRoot !== app;
  document.title = APP_TITLE[app];
  try { localStorage.setItem(KEY, app); } catch { /* storage blocked: the page opens on Habit Kitty */ }
  paintBackdrop();
  if (started.has(app)) document.dispatchEvent(new CustomEvent(SHOWN_EVENT, { detail: app }));
  else start(app);
}

// Capture, so the switch is handled here and never reaches the app that is being hidden.
document.addEventListener('click', (ev) => {
  const b = (ev.target as Element).closest?.<HTMLElement>('[data-action="switch-app"]');
  if (!b) return;
  ev.stopPropagation();
  show(b.dataset.to === 'achievement' ? 'achievement' : 'habit');
  window.scrollTo(0, 0);
}, true);

// Android's back button. Achievement Kitty keeps its pages in the page's history, so there it steps back a page, as it
// did on its own; Habit Kitty has none, so there (and on Achievement Kitty's first page) it leaves the app as Android
// does by default. Without this, back in Habit Kitty would first step silently through Achievement Kitty's pages.
if (Capacitor.isNativePlatform()) App.addListener('backButton', ({ canGoBack }) => {
  if (shownApp() === 'achievement' && canGoBack) history.back();
  else App.minimizeApp();
});

function firstApp(): AppName {
  try { return localStorage.getItem(KEY) === 'achievement' ? 'achievement' : 'habit'; } catch { return 'habit'; }
}

start('habit');
show(firstApp());
