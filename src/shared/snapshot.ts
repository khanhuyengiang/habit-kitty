// A picture of something on the page (a note's big window, an achievement's big card), shared as a PNG: through the
// share sheet on the phone, the browser's share where it can take files, else downloaded. The picture is drawn by
// html-to-image, which copies the page's styles, fonts and pictures into it.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toCanvas } from 'html-to-image';
import { bytesToBase64 } from './backupfolder.ts';

const MARGIN = 16;   // CSS pixels of background around the picture

// A file name from a title: "Trip to Kyoto" → "trip-to-kyoto.png".
export const pictureName = (title: string) => `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'kitty'}.png`;

// The element is drawn as it is (only kept still: an unlock's glow would be caught halfway), then put on a canvas with
// a margin in the page's background colour (--bg, light or dark).
async function pictureOf(el: HTMLElement): Promise<Blob> {
  const ratio = Math.max(2, window.devicePixelRatio || 1);
  const art = await toCanvas(el, { pixelRatio: ratio, style: { margin: '0', animation: 'none', transform: 'none' } });
  const pad = Math.round(MARGIN * ratio);
  const out = document.createElement('canvas');
  out.width = art.width + 2 * pad; out.height = art.height + 2 * pad;
  const g = out.getContext('2d');
  if (!g) throw new Error('no canvas');
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || getComputedStyle(document.body).backgroundColor;
  g.fillRect(0, 0, out.width, out.height);
  g.drawImage(art, pad, pad);
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
  if (!blob) throw new Error('no picture');
  return blob;
}

const isCancel = (e: unknown) => /cancel|abort/i.test(String((e as Error)?.message ?? e)) || (e as Error)?.name === 'AbortError';

// Resolves to what happened, so the caller can say so. Throws when the picture could not be made or shared.
export async function sharePicture(el: HTMLElement, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const blob = await pictureOf(el);
  const name = pictureName(title);
  try {
    if (Capacitor.isNativePlatform()) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await Filesystem.writeFile({ path: name, data: bytesToBase64(bytes), directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
      await Share.share({ title, files: [uri], dialogTitle: `Share ${title}` });
      return 'shared';
    }
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ title, files: [file] }); return 'shared'; }
  } catch (e) {
    if (isCancel(e)) return 'cancelled';
    throw e;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'saved';
}
