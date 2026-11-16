// Kitty Gallery's icons, used everywhere: puts your drawings and your changes over the official icons in the app's icon
// lists (stickers, some of them cat food, card friends, button icons, the diary's weather) and the scenes (the cosy room and the garden), so every app draws and offers them as if they had always been in the code.
// It starts from the official icons each time, so an icon you delete is gone again (a changed official one is back as it
// was), and an official sticker or weather you deleted is taken out; anything still holding a deleted sticker's name is
// drawn as a heart (see pickable in achievement/pixelart.ts), and a deleted weather is no longer drawn.
import { CARD_FRIENDS, OFFICIAL_CARD_FRIENDS, OFFICIAL_PICKER_ICONS, OFFICIAL_UI_ICONS, PICKER_ICONS, UI_ICONS, refreshPickerOrder } from '../achievement/pixelart.ts';
import { DECOS, ICONS, OFFICIAL_DECOS, OFFICIAL_ICONS, OFFICIAL_WEATHER, WEATHER } from '../pixelart.ts';
import { useScene, type SceneId } from '../scene.ts';
import { DEFAULT_GROUP, SCENES, iconsOf, sceneColors, type PixelData } from './model.ts';

const reset = <T>(live: Record<string, T>, official: Readonly<Record<string, T>>) => {
  for (const k of Object.keys(live)) delete live[k];
  Object.assign(live, official);
};
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function applyIcons(data: PixelData) {
  reset(PICKER_ICONS, OFFICIAL_PICKER_ICONS);
  for (const i of iconsOf(data, 'sticker')) if (i.status === 'deleted') delete PICKER_ICONS[i.id]; else if (i.status !== 'official')
    PICKER_ICONS[i.id] = { label: i.name, art: i.art, ...(i.group !== DEFAULT_GROUP && { group: i.group }), ...(i.food && { food: true }) };
  refreshPickerOrder();

  reset(CARD_FRIENDS, OFFICIAL_CARD_FRIENDS);
  for (const i of iconsOf(data, 'friend')) if (i.status !== 'official') CARD_FRIENDS[i.id] = { label: i.name, art: i.art };

  reset(WEATHER, OFFICIAL_WEATHER);
  for (const i of iconsOf(data, 'weather')) if (i.status === 'deleted') delete WEATHER[i.id]; else if (i.status !== 'official') WEATHER[i.id] = { label: i.name, art: i.art };

  reset(DECOS, OFFICIAL_DECOS);
  for (const i of iconsOf(data, 'deco')) if (i.status !== 'official') DECOS[i.id] = { label: i.name, art: i.art };

  // A button icon can be in Habit Kitty's list, Kitty Achievement's or both: a change goes to each list it is in, a new one
  // to Habit Kitty's (a new one in Kitty Achievement's would be taken for a sticker of that name).
  reset(ICONS, OFFICIAL_ICONS);
  reset(UI_ICONS, OFFICIAL_UI_ICONS);
  for (const i of iconsOf(data, 'button')) {
    if (i.status === 'official') continue;
    if (has(OFFICIAL_UI_ICONS, i.id)) UI_ICONS[i.id] = i.art;
    if (has(OFFICIAL_ICONS, i.id) || !has(OFFICIAL_UI_ICONS, i.id)) ICONS[i.id] = i.art;
  }

  // The cosy room and the garden: a changed one is drawn from your picture, with your kitty spots.
  const scenes = iconsOf(data, 'scene');
  for (const [id] of SCENES) {
    const i = scenes.find((s) => s.id === id);
    if (!i || i.status === 'official') { useScene(id, null); continue; }
    const colors = sceneColors();
    useScene(id as SceneId, { art: i.art, colors, href: scenePng(i.art, colors), spots: i.spots ?? [], props: i.props });
  }
}

// A scene as a PNG data URL, one pixel per letter (none outside a browser: it is then drawn as rectangles).
const pngs = new Map<string, string>();
export function scenePng(art: string[], colors: Record<string, string>): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const key = art.join('');
  const done = pngs.get(key);
  if (done) return done;
  const canvas = document.createElement('canvas');
  canvas.width = art[0]?.length ?? 0; canvas.height = art.length;
  const g = canvas.getContext('2d');
  if (!g) return undefined;
  const img = g.createImageData(canvas.width, canvas.height);
  const rgb = new Map(Object.entries(colors).map(([ch, hex]) => [ch, [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16))]));
  art.forEach((row, y) => { for (let x = 0; x < row.length; x++) {
    const c = rgb.get(row[x]);
    if (!c) continue;
    const o = (y * canvas.width + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  } });
  g.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  pngs.set(key, url);
  if (pngs.size > 4) pngs.delete(pngs.keys().next().value!);   // keep only the latest few: each is a whole scene
  return url;
}
