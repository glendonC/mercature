import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Retained captures stay outside public/ and dist/ and are served only on loopback. */
export function localDestinations(): Plugin {
  const install: NonNullable<Plugin['configureServer']> = server => {
    server.middlewares.use('/routes', (request, response, next) => {
      const address = request.socket.remoteAddress;
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '')) {
        response.statusCode = 403;
        response.end('Prepared captures are available only on this device.');
        return;
      }
      const root = resolve('.local/routes');
      const pathname = (request.url ?? '').split('?')[0];
      if (request.method !== 'GET' || !/^\/(cusco-qorikancha|tbilisi-narikala|kathmandu-swayambhu)\/(?:[\w-]+\/)*[\w.-]+\.(json|jpg|bin)$/.test(pathname) || pathname.includes('..')) {
        response.statusCode = 404; response.end('Not found.'); return;
      }
      const candidate = resolve(root, `.${pathname}`);
      if (!existsSync(root) || !existsSync(candidate)) {
        response.statusCode = 404; response.end('Prepared files are not installed on this device.'); return;
      }
      const file = realpathSync(candidate);
      if (!file.startsWith(realpathSync(root) + sep)) { response.statusCode = 403; response.end(); return; }
      const stat = statSync(file);
      if (!stat.isFile()) { response.statusCode = 404; response.end(); return; }
      response.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Content-Length', stat.size);
      const stream = createReadStream(file);
      stream.on('error', error => { if (!response.headersSent) next(error); else response.destroy(error); });
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    });
  };
  return { name: 'mercature-local-destinations', configureServer: install, configurePreviewServer: install as Plugin['configurePreviewServer'] };
}
