// Photos in both apps (on the phone and in a backup) are scaled to fit under this, so saves and backups stay small.
export const PHOTO_MAX_BYTES = 60_000;
export const PHOTO_MAX_SIDE = 900;

// Scale down and re-encode as JPEG until it fits under PHOTO_MAX_BYTES. `square` crops the middle square first (avatars).
// The full-size photo is decoded and drawn only once; every retry re-encodes from the small copy.
export async function compressPhoto(file: Blob, { maxSide = PHOTO_MAX_SIDE, square = false } = {}): Promise<Blob> {
  const img = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  // Draws all of `src` (or the `from` part of it: x, y, w, h) at w x h on a white background.
  const draw = (src: HTMLCanvasElement | ImageBitmap, w: number, h: number, from = [0, 0, src.width, src.height]) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const g = canvas.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(src, from[0], from[1], from[2], from[3], 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  const k0 = Math.min(1, maxSide / Math.max(sw, sh));
  let canvas = draw(img, sw * k0, sh * k0, [sx, sy, sw, sh]);
  img.close();
  const encode = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q));
  let quality = 0.7;
  for (let i = 0; ; i++) {
    const blob = await encode(canvas, quality);
    if (!blob) throw new Error('encode failed');
    if (blob.size <= PHOTO_MAX_BYTES || i >= 14 || Math.max(canvas.width, canvas.height) < 200) return blob;
    if (quality > 0.45) quality -= 0.1; else canvas = draw(canvas, canvas.width * 0.85, canvas.height * 0.85);
  }
}
