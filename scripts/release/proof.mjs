/**
 * Phone-width proof of a deployed build, local or live:
 *   1. Home, the Qorikancha reveal and the route from its published package, at 390 px.
 *   2. The model downloads from the app's own origin, never from the Hub.
 *   3. The service worker controls the app's path only.
 *   4. After a cold restart with no network, the route opens and the model answers a Korean message.
 *   node scripts/release/proof.mjs [url] [--serve dist] [--out dir]
 * With --serve, the build is served like GitHub Pages under the URL's path and the server is
 * stopped before the offline restart. The offline restart also sends every request, the service
 * worker's own included, to a proxy that drops it. Screenshots and report.json go to the out directory.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const serve = option('--serve');
const outOption = option('--out');
const base = new URL(args[0] ?? 'http://127.0.0.1:4186/mercature/');
const out = resolve(outOption ?? `.local/release/proof-${base.host.replace(/[^a-z0-9.-]/gi, '-')}`);
// The Korean demo message: steps by the church on the way were too steep for the writer's mother.
const MESSAGE = '코리칸차 가는 길에 성당 옆 잉카 돌담 골목에 있는 돌계단이 너무 가팔라서 어머니가 내려가시기 힘들었어요.';
// The measured answer: spots steps-340-350, steps-130-140 and qorikancha-ticket-booth, as the card names them.
const EXPECTED = { kind: 'Problem', spots: ['Calle Loreto, 340 to 350 m', 'Calle Loreto, 130 to 140 m', 'Qorikancha ticket booth'] };

const report = { url: base.href, started: new Date().toISOString(), checks: [], downloads: [], offsite: [], answers: {}, transfer: {} };
const check = (name, pass, detail = '') => {
  report.checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
};
await mkdir(out, { recursive: true });

let server = null;
async function startServer() {
  server = spawn(process.execPath, ['scripts/release/serve.mjs', serve, '--port', base.port || '80', '--base', base.pathname], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (await fetch(base).then(response => response.ok, () => false)) return;
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error(`Nothing is serving ${base.href}.`);
}

// setOffline does not stop the service worker's own fetches; this proxy refuses them, and counts them.
let dropped = 0;
const sink = createServer(socket => { dropped++; socket.destroy(); });
await new Promise(done => sink.listen(0, '127.0.0.1', done));
const proxy = { server: `http://127.0.0.1:${sink.address().port}`, bypass: '<-loopback>' };

let profile = null;
let context;
async function launch(offline) {
  await context?.close();
  context = await chromium.launchPersistentContext(profile, {
    headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'allow',
    ...(offline ? { proxy } : {}),
  });
  await context.setOffline(offline);
  const phase = offline ? 'offline' : 'online';
  const transfer = report.transfer[phase] = { requests: 0, bytes: 0 };
  context.on('requestfinished', async request => {
    const url = new URL(request.url());
    const response = await request.response();
    // A response the service worker answered can still be reported here, with no body from the network.
    const received = response && !response.fromServiceWorker() ? (await request.sizes().catch(() => null))?.responseBodySize ?? -1 : -1;
    if (received >= 0) {
      transfer.requests++;
      transfer.bytes += received;
    }
    if (url.origin !== base.origin && !url.protocol.startsWith('data') && !url.protocol.startsWith('blob')) report.offsite.push({ phase, url: url.href, status: response?.status() ?? null });
    if (/\/models\/|huggingface|hf\.co|\.wasm$/.test(url.href) && response && !response.fromServiceWorker()) {
      const sizes = await request.sizes().catch(() => null);
      report.downloads.push({ phase, path: url.pathname, status: response.status(), transferBytes: sizes?.responseBodySize ?? null, encoding: response.headers()['content-encoding'] ?? 'none', length: response.headers()['content-length'] ?? null });
    }
  });
  context.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.origin !== base.origin) report.offsite.push({ phase, url: url.href, status: 'failed' });
  });
  return context.pages()[0] ?? context.newPage();
}

async function openRoute(page, name) {
  await page.getByRole('button', { name: 'Explore Qorikancha · Cusco', exact: true }).click();
  // The reveal is the screen that offers Skip.
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  await skip.waitFor();
  if (name) {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: resolve(out, `${name}.png`) });
  }
  if (await skip.isVisible()) await skip.click();
  await page.getByRole('tab', { name: 'Place', exact: true }).waitFor();
}

async function ask(page) {
  await page.getByRole('tab', { name: 'Messages', exact: true }).click();
  const find = page.getByRole('button', { name: 'Find the spot', exact: true });
  await page.getByRole('textbox', { name: 'Visitor message' }).fill(MESSAGE);
  await find.waitFor({ timeout: 120_000 });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Find the spot' && !button.disabled), null, { timeout: 120_000 });
  const started = Date.now();
  await find.click();
  const card = page.locator('.ai-result-card');
  await card.waitFor({ timeout: 120_000 });
  const answer = await card.evaluate(element => ({
    kind: element.querySelector('dd')?.textContent ?? null,
    spots: [...element.querySelectorAll('.ai-result-spots button')].slice(0, -1).map(button => ({
      label: [...button.childNodes].filter(node => !(node instanceof Element && node.classList.contains('ai-rank'))).map(node => node.textContent).join('').trim(),
      pressed: button.getAttribute('aria-pressed') === 'true',
    })),
  }));
  return { ...answer, seconds: (Date.now() - started) / 1000 };
}

const matches = answer => answer.kind === EXPECTED.kind && JSON.stringify(answer.spots.map(spot => spot.label)) === JSON.stringify(EXPECTED.spots) && answer.spots.every(spot => !spot.pressed);

try {
  if (serve) await startServer();
  profile = await mkdtemp(join(tmpdir(), 'mercature-proof-'));
  // Online, first visit on a fresh profile.
  let page = await launch(false);
  const first = await page.goto(base.href);
  check('app loads', first?.status() === 200, `${first?.status()} ${base.href}`);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  check('service worker scope is the app path', scope === base.href, scope);
  await page.waitForFunction(async () => (await caches.keys()).some(key => key.startsWith('mercature-app-')));
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const data = await (await fetch(link.href)).json();
    const at = path => new URL(path, link.href).href;
    const icons = await Promise.all(data.icons.map(async icon => ({ src: at(icon.src), sizes: icon.sizes, purpose: icon.purpose, status: (await fetch(at(icon.src))).status })));
    const touch = document.querySelector('link[rel="apple-touch-icon"]');
    return { start: at(data.start_url), scope: at(data.scope), id: at(data.id), display: data.display, icons, appleTouchIcon: touch && (await fetch(touch.href)).status };
  });
  report.manifest = manifest;
  check('manifest start and scope are the app path', manifest.start === base.href && manifest.scope === base.href, `${manifest.start} ${manifest.scope} ${manifest.display}`);
  check('manifest icons are served', manifest.icons.every(icon => icon.status === 200) && ['192x192', '512x512'].every(size => manifest.icons.some(icon => icon.sizes === size)) && manifest.appleTouchIcon === 200,
    manifest.icons.map(icon => `${icon.sizes} ${icon.purpose} ${icon.status}`).join(', '));
  await page.screenshot({ path: resolve(out, 'home-390.png') });

  const placeRequests = [];
  page.on('response', response => { if (/\/places\/|\/routes\//.test(response.url())) placeRequests.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await openRoute(page, 'reveal-390');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(out, 'route-390.png') });
  const fromPackage = placeRequests.some(line => line.startsWith('200 ') && line.endsWith(`${base.pathname}places/qorikancha/place.json`));
  check('route opens from the published package', fromPackage && !placeRequests.some(line => line.startsWith('200 ') && line.includes('/routes/')), placeRequests.filter(line => line.includes('place.json') || line.includes('/routes/')).join(', '));

  await page.getByRole('tab', { name: 'Messages', exact: true }).click();
  const download = page.getByRole('button', { name: /^Download \d+ MB$/ });
  await download.waitFor({ timeout: 30_000 });
  report.offer = await download.textContent();
  await page.screenshot({ path: resolve(out, 'messages-before-download-390.png') });
  const downloadStarted = Date.now();
  await download.click();
  await page.getByRole('button', { name: 'Find the spot', exact: true }).waitFor({ timeout: 15 * 60_000 });
  report.downloadSeconds = (Date.now() - downloadStarted) / 1000;
  const online = await ask(page);
  report.answers.online = online;
  await page.screenshot({ path: resolve(out, 'answer-online-390.png') });
  check('Korean demo message answered online', matches(online), `${online.kind}; ${online.spots.map(spot => spot.label + (spot.pressed ? ' (selected)' : '')).join(', ')}; ${online.seconds} s`);

  const fetched = report.downloads.filter(item => item.phase === 'online');
  const hub = fetched.filter(item => !item.path.startsWith(base.pathname) || /huggingface|hf\.co/.test(item.path));
  check('model files come from the app origin', fetched.some(item => item.path.startsWith(`${base.pathname}models/`)) && hub.length === 0 && !report.offsite.some(item => /huggingface|hf\.co/.test(item.url)),
    fetched.map(item => `${item.status} ${item.path}`).join(', '));
  check('no request left the app origin', report.offsite.length === 0, report.offsite.map(item => item.url).join(', '));
  report.stored = await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('mercature-model-'));
    const cache = await caches.open(name);
    return { name, keys: (await cache.keys()).map(request => new URL(request.url).pathname) };
  });

  // Cold restart with no network: the server is gone too when this script started it.
  if (server) { server.kill(); server = null; }
  page = await launch(true);
  const offline = await page.goto(base.href);
  // The server is out of reach: the worker's own update check goes to the proxy and is refused.
  const refused = dropped;
  const update = await page.evaluate(() => navigator.serviceWorker.getRegistration().then(registration => registration?.update()).then(() => 'reached', () => 'refused'));
  check('offline start is served by the service worker', !!offline?.fromServiceWorker() && update === 'refused' && dropped > refused,
    `${offline?.status()} from service worker: ${offline?.fromServiceWorker()}; worker update check ${update} by the proxy`);
  await openRoute(page);
  await page.screenshot({ path: resolve(out, 'route-offline-390.png') });
  const again = await ask(page);
  report.answers.offline = again;
  await page.screenshot({ path: resolve(out, 'answer-offline-390.png') });
  check('Korean demo message answered offline after a cold restart', matches(again), `${again.kind}; ${again.spots.map(spot => spot.label + (spot.pressed ? ' (selected)' : '')).join(', ')}; ${again.seconds} s`);
  check('nothing downloaded offline', !report.downloads.some(item => item.phase === 'offline'), report.downloads.filter(item => item.phase === 'offline').map(item => item.path).join(', '));
} catch (error) {
  check('proof ran to the end', false, error instanceof Error ? error.message.split('\n')[0] : String(error));
  await context?.pages()[0]?.screenshot({ path: resolve(out, 'failure.png') }).catch(() => undefined);
} finally {
  await context?.close();
  server?.kill();
  sink.close();
  if (profile) await rm(profile, { recursive: true, force: true });
}

report.finished = new Date().toISOString();
await writeFile(resolve(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const item of report.downloads) console.log(`download ${item.phase} ${item.status} ${item.path}: ${item.transferBytes} bytes on the wire, encoding ${item.encoding}`);
for (const [phase, item] of Object.entries(report.transfer)) console.log(`${phase}: ${item.requests} network responses, ${item.bytes} bytes on the wire`);
console.log(`Report and screenshots in ${out}`);
if (report.checks.some(item => !item.pass)) process.exit(1);
