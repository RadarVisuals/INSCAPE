import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = new URL('../output/nomad-export-study-2026-10-21/', import.meta.url);
export async function startNomadPreview() {
  const allowed = new Set(['compare.html', 'Sora.ttf', 'Plex.ttf', ...['full', 'half', 'quarter', 'vector', 'loop'].map(n => `NOMAD-${n}.svg`)]);
  const server = createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'compare.html';
    if (!allowed.has(name)) { response.writeHead(404); response.end('Not found'); return; }
    try {
      response.writeHead(200, { 'Content-Type': name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.ttf') ? 'font/ttf' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(await readFile(new URL(name, root)));
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: 'http://127.0.0.1:' + server.address().port + '/compare.html' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log((await startNomadPreview()).url);
