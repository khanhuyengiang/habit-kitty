// Live sprite sheet for editing the pixel cats: `npm run preview`.
// Bundles src/web/preview.ts in watch mode and serves it; esbuild pushes a change
// event on every rebuild and the page reloads itself (see the end of preview.ts).
import { context } from 'esbuild';
import { copyFileSync, mkdirSync, watch } from 'node:fs';

const OUT = '.preview';
mkdirSync(OUT, { recursive: true });
const copyHtml = () => copyFileSync('web/preview.html', `${OUT}/index.html`);
copyHtml();
watch('web/preview.html', () => { try { copyHtml(); } catch { /* mid-save */ } });   // CSS edits in the page show up too (reload the tab)

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
