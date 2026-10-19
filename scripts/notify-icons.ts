// Draws the notification icons: each base fur in each face, as a small PNG, into the Android resources.
// Run with `npm run icons` after changing the pixel cats. Uses no dependencies (writes PNG with zlib).
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { FURS, NOTIFY_FACES, faceSvg } from '../src/pixelcat.ts';

const OUT = 'android/app/src/main/res/drawable-nodpi';
const SIZE = 96, SCALE = 4, BG = [255, 243, 230];

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}
function png(rgb: number[][][]): Buffer {
  const h = rgb.length, w = rgb[0].length;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  rgb.forEach((row, y) => row.forEach((px, x) => { raw[y * (w * 3 + 1) + 1 + x * 3] = px[0]; raw[y * (w * 3 + 1) + 2 + x * 3] = px[1]; raw[y * (w * 3 + 1) + 3 + x * 3] = px[2]; }));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
FURS.forEach((fur, fi) => {
  for (const face of NOTIFY_FACES) {
    const svg = faceSvg(face, { fur, pattern: 'plain' });
    const view = /viewBox="(\d+) 0 (\d+) (\d+)"/.exec(svg)!.slice(1).map(Number);   // x offset, width, height
    const [vx, vw, vh] = view;
    const img = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => BG.slice()));
    const ox = Math.floor((SIZE - vw * SCALE) / 2), oy = Math.floor((SIZE - vh * SCALE) / 2);
    for (const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)"[^>]*fill="#([0-9a-f]{6})"/g)) {
      const [x, y] = [Number(m[1]) - vx, Number(m[2])];
      const c = [0, 2, 4].map((i) => parseInt(m[3].slice(i, i + 2), 16));
      for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
        const px = ox + x * SCALE + dx, py = oy + y * SCALE + dy;
        if (img[py]?.[px]) img[py][px] = c;
      }
    }
    writeFileSync(`${OUT}/notif_${fi}_${face}.png`, png(img));
  }
});
console.log(`wrote ${FURS.length * NOTIFY_FACES.length} icons to ${OUT}`);
