// Pixel editor for the kitty art: `npm run editor`, then open http://127.0.0.1:8001.
// The page also works on its own (open web/pixel-editor.html); this server adds "Load from" / "Save to"
// src/pixelcat.ts for the art arrays (a style's sitting cat and two tail frames, the napping cat, the mini face),
// and reads/writes the per-coat layers in src/coats.ts.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.env.KITTY_SRC ?? 'src/pixelcat.ts';   // (the env var is for testing against a copy)
const PORT = Number(process.env.PORT ?? 8001);
const block = (name) => new RegExp(`((?:export )?const ${name} = \\[\\n)[\\s\\S]*?(\\n\\];\\n)`);
const COATS_SRC = process.env.KITTY_COATS ?? 'src/coats.ts';
const COAT_PARTS = { sit: 'COAT_SIT', nap: 'COAT_NAP', mini: 'COAT_MINI' };
const ORDER = ['stripes', 'mask', 'patch', 'calico', 'point', 'plain'];
const coatBlock = (name) => new RegExp(`(export const ${name}: [^=]*= \\{\\n)([\\s\\S]*?)(\\};\\n)`);
const readEntries = (bodyText) => Object.fromEntries([...bodyText.matchAll(/^ {2}(\w+): \[\n([\s\S]*?)\n {2}\],$/gm)].map((m) => [m[1], [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1])]));
const writeEntries = (e) => ORDER.filter((k) => e[k]).map((k) => `  ${k}: [\n${e[k].map((r) => `    '${r}',`).join('\n')}\n  ],`).join('\n');

createServer((req, res) => {
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const url = new URL(req.url, 'http://x');
  const body = (fn) => { let data = ''; req.on('data', (c) => (data += c)); req.on('end', () => { try { fn(JSON.parse(data || '{}')); } catch (e) { send(400, 'text/plain', String(e.message)); } }); };

  // coat layers live in src/coats.ts (COAT_SIT, COAT_NAP, COAT_MINI): one array of rows per coat pattern
  if (url.pathname === '/api/coat') {
    const part = url.searchParams.get('part'), pattern = url.searchParams.get('pattern');
    if (!COAT_PARTS[part] || !ORDER.includes(pattern)) return send(400, 'text/plain', 'bad part or pattern');
    const file = COATS_SRC, re = coatBlock(COAT_PARTS[part]);
    const text = readFileSync(file, 'utf8'), m = re.exec(text);
    if (!m) return send(404, 'text/plain', `${COAT_PARTS[part]} not found`);
    const entries = readEntries(m[2]);
    if (req.method === 'GET') return entries[pattern] ? send(200, 'application/json', { rows: entries[pattern] }) : send(404, 'text/plain', 'no layer');
    if (req.method === 'POST') {
      return body(({ rows }) => {
        if (!Array.isArray(rows) || !rows.length || !rows.every((r) => typeof r === 'string' && /^[A-Za-z.]+$/.test(r))) throw new Error('bad rows');
        if (rows.every((r) => /^\.*$/.test(r))) delete entries[pattern]; else entries[pattern] = rows;   // an empty layer means "no layer"
        writeFileSync(file, text.replace(re, (_, head, __, tail) => head + (Object.keys(entries).length ? writeEntries(entries) + '\n' : '') + tail));
        send(200, 'text/plain', 'ok');
      });
    }
  }
  if (url.pathname === '/api/art') {
    const name = url.searchParams.get('name') ?? '';
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return send(400, 'text/plain', 'bad name');
    if (req.method === 'GET') {
      const m = block(name).exec(readFileSync(SRC, 'utf8'));
      return m ? send(200, 'text/plain', m[0]) : send(404, 'text/plain', `${name} array not found`);
    }
    if (req.method === 'POST') {
      return body(({ rows }) => {
        if (!Array.isArray(rows) || !rows.length || !rows.every((r) => typeof r === 'string' && /^[A-Za-z.]+$/.test(r))) throw new Error('bad rows');
        const text = readFileSync(SRC, 'utf8');
        const re = block(name);
        if (!re.test(text)) throw new Error(`${name} array not found`);
        writeFileSync(SRC, text.replace(re, (_, head, tail) => head + rows.map((r) => `  '${r}',`).join('\n') + tail));
        send(200, 'text/plain', 'ok');
      });
    }
  }
  send(200, 'text/html', readFileSync('web/pixel-editor.html'));
}).listen(PORT, '127.0.0.1', () => console.log(`pixel editor: http://127.0.0.1:${PORT}`));
