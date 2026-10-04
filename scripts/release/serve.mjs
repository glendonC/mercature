/**
 * Serve a build the way GitHub Pages serves a project site: under /<repository>/, a redirect for the
 * path without its slash, index.html for directories, 404 for everything else, gzip for text.
 *   node scripts/release/serve.mjs [dist] [--port 4186] [--base /mercature/]
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createGzip } from 'node:zlib';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : fallback; };
const port = Number(option('--port', process.env.MERCATURE_PORT ?? '4186'));
const base = option('--base', '/mercature/');
const root = resolve(args[0] ?? 'dist');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.onnx': 'application/octet-stream',
};
const compressible = /^(text\/|application\/(javascript|json|manifest\+json)|image\/svg)/;

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === base.slice(0, -1)) {
    response.writeHead(301, { location: base + url.search }).end();
    return;
  }
  let file = null;
  if (url.pathname.startsWith(base)) {
    const relative = normalize(decodeURIComponent(url.pathname.slice(base.length)));
    const candidate = join(root, relative);
    if (candidate === root || candidate.startsWith(root + sep)) {
      const info = await stat(candidate).catch(() => null);
      if (info?.isDirectory()) file = await stat(join(candidate, 'index.html')).then(() => join(candidate, 'index.html'), () => null);
      else if (info?.isFile()) file = candidate;
    }
  }
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 File not found');
    return;
  }
  const type = types[extname(file)] ?? 'application/octet-stream';
  const headers = { 'content-type': type, 'cache-control': 'max-age=600', 'access-control-allow-origin': '*' };
  if (compressible.test(type) && /\bgzip\b/.test(String(request.headers['accept-encoding']))) {
    response.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' });
    if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(createGzip()).pipe(response);
    return;
  }
  response.writeHead(200, { ...headers, 'content-length': (await stat(file)).size });
  if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}${base}`));
