// The Android home-screen widget: the room as three pictures, one per time of day. The native widget (RoomWidgetProvider)
// picks the file that matches the clock. The screen draws the pictures (the room's cats sit where they are now); this
// turns them into PNG files, pushes them when the app goes to the background, and opens the Room tab when it is tapped.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { goTo } from '../shared/apps.ts';

export type WidgetPhase = 'day' | 'dusk' | 'night';
const RoomWidget = registerPlugin<{ refresh(): Promise<void>; pendingTab(): Promise<{ tab: string }> }>('RoomWidget');
const PHASES: readonly WidgetPhase[] = ['day', 'dusk', 'night'];

let draw: (phase: WidgetPhase) => { svg: string; w: number; h: number; px: number } = () => ({ svg: '', w: 0, h: 0, px: 1 });
let widgetSig = '', widgetTimer = 0;

async function pictureData(p: { svg: string; w: number; h: number; px: number }): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(p.svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = p.w * p.px; canvas.height = p.h * p.px;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png').split(',')[1];
}

// After a change: the home screen only shows the picture while the app is in the background, and going there pushes it.
export function queueWidget() {
  if (!Capacitor.isNativePlatform() || !document.hidden) return;
  clearTimeout(widgetTimer);
  widgetTimer = window.setTimeout(pushWidget, 3000);
}
async function pushWidget() {
  clearTimeout(widgetTimer);
  const pics = PHASES.map((ph) => draw(ph));
  const sig = pics.map((p) => p.svg).join('');
  if (sig === widgetSig) return;
  widgetSig = sig;
  try {
    for (const [i, ph] of PHASES.entries()) {
      await Filesystem.writeFile({ path: `room-widget-${ph}.png`, directory: Directory.Data, data: await pictureData(pics[i]) });
    }
    await RoomWidget.refresh();
  } catch { widgetSig = ''; /* try again next time */ }
}

// Tapping the widget asks for the Room tab.
export async function openWidgetTab() {
  if (!Capacitor.isNativePlatform()) return;
  try { if ((await RoomWidget.pendingTab()).tab === 'room') goTo('habit', 'room'); } catch { /* no widget plugin */ }
}

// `drawRoom` draws one time of day: an SVG `w` × `h` room units, saved at `px` pixels per unit.
export function initWidget(drawRoom: typeof draw) {
  draw = drawRoom;
  document.addEventListener('visibilitychange', () => { if (document.hidden) pushWidget(); else openWidgetTab(); });
}
