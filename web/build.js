// Bundles src/web/app.ts (with the shared rules) into the page, in two flavours:
//   dist/habit-kitty.html  page body only, for publishing as a Claude artifact (it adds the skeleton)
//   app-www/index.html     full offline document with bundled fonts, for the Android app (Capacitor)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';

async function bundle(isApp) {
  const { outputFiles } = await build({
    entryPoints: ['src/web/app.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    write: false,
    define: { __APP__: String(isApp) },
  });
  return outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

const template = readFileSync('web/page.html', 'utf8');

// ---- website ----
const siteJs = await bundle(false);
const site = template.replace('/*__APP__*/', () => siteJs);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/habit-kitty.html', site);

// ---- Android app ----
const FONTS = [
  ['Pixelify Sans', 500, 'pixelify-sans/files/pixelify-sans-latin-500-normal.woff2'],
  ['Pixelify Sans', 700, 'pixelify-sans/files/pixelify-sans-latin-700-normal.woff2'],
  ['Nunito', 400, 'nunito/files/nunito-latin-400-normal.woff2'],
  ['Nunito', 600, 'nunito/files/nunito-latin-600-normal.woff2'],
  ['Nunito', 800, 'nunito/files/nunito-latin-800-normal.woff2'],
  ['DM Mono', 400, 'dm-mono/files/dm-mono-latin-400-normal.woff2'],
  ['DM Mono', 500, 'dm-mono/files/dm-mono-latin-500-normal.woff2'],
];
rmSync('app-www', { recursive: true, force: true });
mkdirSync('app-www/fonts', { recursive: true });
const faces = FONTS.map(([family, weight, src]) => {
  const file = src.split('/').pop();
  copyFileSync(`node_modules/@fontsource/${src}`, `app-www/fonts/${file}`);
  return `@font-face{font-family:"${family}";font-weight:${weight};font-display:swap;src:url(fonts/${file}) format("woff2")}`;
}).join('\n');

const appJs = await bundle(true);
const appBody = template
  .replace(/<link [^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '')
  .replace('<style>', `<style>\n${faces}\n`)
  .replace('/*__APP__*/', () => appJs);
writeFileSync('app-www/index.html',
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>[hidden]{display:none!important}html,body{margin:0}:root{padding-top:env(safe-area-inset-top,0px)}</style>' +
  '</head><body>' + appBody + '</body></html>');

console.log(`dist/habit-kitty.html ${(site.length / 1024).toFixed(1)} KB · app-www/index.html ${(appBody.length / 1024).toFixed(1)} KB`);
