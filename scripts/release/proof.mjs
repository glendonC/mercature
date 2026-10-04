/**
 * Phone-width proof of a deployed build, local or live:
 *   1. Home, the Qorikancha reveal and the route from its published package, at 390 px.
 *   2. The model downloads from the app's own origin, never from the Hub, and its MIT license is served beside it.
 *   3. The service worker controls the app's path only.
 *   4. After a cold restart with no network, the route opens and the model answers the Korean Example
 *      message afresh: Start over clears the first answer, never the model.
 *   node scripts/release/proof.mjs [url] [--serve dist] [--out dir] [--browser chromium|webkit]
 * With --serve, the build is served like GitHub Pages under the URL's path and the server is
 * stopped before the offline restart. The offline restart also sends every request, the service
 * worker's own included, to a proxy that drops it. Screenshots and report.json go to the out directory.
 */
import { chromium, webkit } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { TRIMMED_ENCODER } from '../../src/language/model.ts';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const serve = option('--serve');
const outOption = option('--out');
const browserName = option('--browser') ?? 'chromium';
const engine = { chromium, webkit }[browserName] ?? (() => { throw new Error(`Unknown browser ${browserName}.`); })();
const base = new URL(args[0] ?? 'http://127.0.0.1:4186/mercature/');
const out = resolve(outOption ?? `.local/release/proof-${base.host.replace(/[^a-z0-9.-]/gi, '-')}${browserName === 'chromium' ? '' : `-${browserName}`}`);
// The Korean demo message, the inbox's Korean Example: steps by the church were too steep for the writer's mother.
const ROW = 'example-ko-steps';
const MESSAGE = '코리칸차 가는 길에 성당 옆 잉카 돌담 골목에 있는 돌계단이 너무 가팔라서 어머니가 내려가시기 힘들었어요.';
// The measured answer: a problem, but not sure; spots steps-340-350, steps-130-140 and qorikancha-ticket-booth, as the inbox names them.
const EXPECTED = { kind: 'Problem?', spots: ['Calle Loreto, 340 to 350 m', 'Calle Loreto, 130 to 140 m', 'Qorikancha ticket booth'] };
const REVIEW = 'mercature.route-review.v1.cusco-qorikancha';

const report = { url: base.href, browser: browserName, started: new Date().toISOString(), checks: [], downloads: [], offsite: [], answers: {}, transfer: {}, errors: [] };
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
// Chromium needs <-loopback> to send 127.0.0.1 through the proxy too.
const proxy = { server: `http://127.0.0.1:${sink.address().port}`, ...(browserName === 'chromium' ? { bypass: '<-loopback>' } : {}) };

let profile = null;
let context;
async function launch(offline) {
  await context?.close();
  context = await engine.launchPersistentContext(profile, {
    headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'allow',
    ...(offline ? { proxy } : {}),
  });
  await context.setOffline(offline);
  const phase = offline ? 'offline' : 'online';
  const transfer = report.transfer[phase] = { requests: 0, bytes: 0 };
  context.on('weberror', error => report.errors.push({ phase, kind: 'page error', text: String(error.error()).slice(0, 300) }));
  context.on('console', message => { if (message.type() === 'error') report.errors.push({ phase, kind: 'console', text: message.text().slice(0, 300) }); });
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
  await page.locator(`.ri-row[data-row="${ROW}"]`).waitFor();
}

/** The open message once its answer shows: the kind from the meta line, the ranked spots under About. */
async function answerOf(page, started) {
  await page.locator('.ri-about').waitFor({ timeout: 15 * 60_000 });
  const answer = await page.evaluate(() => ({
    quote: document.querySelector('.ri-quote')?.textContent ?? null,
    kind: (document.querySelector('p.ri-row-meta')?.textContent ?? '').split(' · ')[1] ?? null,
    spots: [...document.querySelectorAll('.ri-about .ri-row')].map(row => ({
      rank: row.querySelector('.ri-rank')?.textContent ?? '', label: row.querySelector('.ri-row-main')?.textContent ?? '', pressed: row.getAttribute('aria-pressed') === 'true',
    })),
  }));
  return { ...answer, seconds: (Date.now() - started) / 1000 };
}
const logged = page => page.evaluate(([key, id]) => JSON.parse(localStorage.getItem(key) ?? 'null')?.messages?.find(message => message.id === id) ?? null, [REVIEW, ROW]);
const describe = answer => `${answer.kind}; ${answer.spots.map(spot => `${spot.rank} ${spot.label}${spot.pressed ? ' (filed)' : ''}`).join(', ')}; ${answer.seconds} s`;
const matches = answer => answer.quote === MESSAGE && answer.kind === EXPECTED.kind && JSON.stringify(answer.spots.map(spot => spot.label)) === JSON.stringify(EXPECTED.spots) && answer.spots.every(spot => !spot.pressed);

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

  // On a fresh profile the Korean Example offers the download, and the answer follows it.
  await page.locator(`.ri-row[data-row="${ROW}"]`).click();
  const download = page.getByRole('button', { name: /^Download \d+ MB$/ });
  await download.waitFor({ timeout: 30_000 });
  report.offer = await download.textContent();
  await page.screenshot({ path: resolve(out, 'message-before-download-390.png') });
  const downloadStarted = Date.now();
  await download.click();
  const online = await answerOf(page, downloadStarted);
  report.downloadSeconds = online.seconds;
  report.answers.online = online;
  await page.screenshot({ path: resolve(out, 'answer-online-390.png') });
  check('Korean demo message answered online', matches(online), `download and answer: ${describe(online)}`);

  const fetched = report.downloads.filter(item => item.phase === 'online');
  const hub = fetched.filter(item => !item.path.startsWith(base.pathname) || /huggingface|hf\.co/.test(item.path));
  check('model files come from the app origin', fetched.some(item => item.path.startsWith(`${base.pathname}models/`)) && hub.length === 0 && !report.offsite.some(item => /huggingface|hf\.co/.test(item.url)),
    fetched.map(item => `${item.status} ${item.path}`).join(', '));
  const licensePath = `${TRIMMED_ENCODER.directory}LICENSE.txt`;
  const license = await fetch(new URL(licensePath, base)).then(async response => ({ status: response.status, text: await response.text() }), () => ({ status: 'failed', text: '' }));
  check('model license is served beside the weights', license.status === 200 && license.text === await readFile('licenses/multilingual-e5-small-MIT.txt', 'utf8'), `${license.status} ${licensePath}`);
  check('no request left the app origin', report.offsite.length === 0, report.offsite.map(item => item.url).join(', '));
  report.stored = await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('mercature-model-'));
    const cache = await caches.open(name);
    return { name, keys: (await cache.keys()).map(request => new URL(request.url).pathname) };
  });
  // Start over clears the first answer, so the offline one has to come from the model again.
  await page.getByRole('button', { name: 'All messages' }).click();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  report.clearedBeforeOffline = (await logged(page)) === null;

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
  const unread = await page.locator(`.ri-row[data-row="${ROW}"]`).textContent();
  // Let the inbox find the stored model before the tap, as a person would.
  await page.waitForTimeout(1500);
  const offlineStarted = Date.now();
  await page.locator(`.ri-row[data-row="${ROW}"]`).click();
  const again = await answerOf(page, offlineStarted);
  report.answers.offline = again;
  const fresh = await logged(page);
  await page.screenshot({ path: resolve(out, 'answer-offline-390.png') });
  check('Korean demo message answered offline after a cold restart', report.clearedBeforeOffline && /Not read yet/.test(unread ?? '') && !!fresh?.answer?.model && matches(again),
    `${describe(again)}; read afresh by ${fresh?.answer?.model ?? 'nothing'}`);
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
for (const item of report.errors) console.log(`${item.phase} ${item.kind}: ${item.text}`);
console.log(`Report and screenshots in ${out}`);
if (report.checks.some(item => !item.pass)) process.exit(1);
