// Live sprite sheet for editing the pixel cats: `npm run preview`.
// Bundles src/web/preview.ts in watch mode and serves it; esbuild pushes a change
// event on every rebuild and the page reloads itself (see the end of preview.ts).
import { context } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

const OUT = '.preview';
mkdirSync(OUT, { recursive: true });
copyFileSync('web/preview.html', `${OUT}/index.html`);

const ctx = await context({
  entryPoints: ['src/web/preview.ts'],
  outfile: `${OUT}/preview.js`,
  bundle: true,
  format: 'iife',
  target: 'es2020',
  define: { __APP__: 'false' },
});

await ctx.watch();
const { hosts, port } = await ctx.serve({ servedir: OUT, host: '127.0.0.1' });
console.log(`pixel cat preview: http://${hosts[0]}:${port}  (edits to src/pixelcat.ts reload the page)`);
