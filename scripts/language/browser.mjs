/**
 * Browser measurement and offline proof, on a production build of a one-page harness that uses the
 * app's own Vite config and service worker.
 *   node scripts/language/browser.mjs [split] [--hub]
 * 1. Online: provision the model (from Hugging Face with --hub, otherwise from the local model files
 *    through a redirect that mirrors the Hub's CDN redirect), then understand every message in the split.
 * 2. Cold restart of the same browser profile with networking disabled: understand a new message.
 * Requires a build first: npx vite build --config scripts/language/harness/vite.config.ts
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createReadStream, statSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { resolve, sep } from 'node:path';
import { MODEL_DIR } from './encoder.mjs';
import { loadMessages } from './data.mjs';

const split = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'dev';
const fromHub = process.argv.includes('--hub');
const port = process.env.MERCATURE_PORT ?? '4181';
const origin = `http://127.0.0.1:${port}`;

const preview = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--config', 'scripts/language/harness/vite.config.ts', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: 'ignore' });
const files = http.createServer((request, response) => {
  const file = resolve(MODEL_DIR, `.${decodeURIComponent(new URL(request.url, 'http://local').pathname)}`);
  const headers = { 'access-control-allow-origin': '*' };
  if (!file.startsWith(MODEL_DIR + sep)) return response.writeHead(403, headers).end();
  let size;
  try { size = statSync(file).size; } catch { return response.writeHead(404, headers).end(); }
  response.writeHead(200, { ...headers, 'content-length': size, 'content-type': 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise(done => files.listen(0, '127.0.0.1', done));
for (let i = 0; i < 100; i++) {
  if (await fetch(origin).then(r => r.ok, () => false)) break;
  await new Promise(done => setTimeout(done, 100));
}

const profile = await mkdtemp(resolve('.local/language/browser-profile-'));
const requests = [];
let context;
async function open(offline) {
  context = await chromium.launchPersistentContext(profile, { headless: true });
  await context.setOffline(offline);
  context.on('request', request => requests.push({ phase: offline ? 'offline' : 'online', url: request.url() }));
  if (!fromHub) {
    await context.route('https://huggingface.co/**', route => {
      const path = new URL(route.request().url()).pathname.split('/resolve/')[1].split('/').slice(1).join('/');
      return route.fulfill({ status: 302, headers: { location: `http://127.0.0.1:${files.address().port}/${path}`, 'access-control-allow-origin': '*' } });
    });
  }
  const page = context.pages()[0] ?? await context.newPage();
  return page;
}

const { messages } = await loadMessages();
const chosen = messages.filter(message => message.split === split);
const result = { split, source: fromHub ? 'huggingface.co' : 'local files via redirect', userAgent: '' };
try {
  let page = await open(false);
  await page.goto(origin);
  await page.waitForFunction(() => 'languageCheck' in window);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(done => navigator.serviceWorker.addEventListener('controllerchange', () => done(), { once: true }));
  });
  result.userAgent = await page.evaluate(() => navigator.userAgent);
  const prepared = await page.evaluate(async () => {
    const states = [];
    const started = performance.now();
    const check = window.languageCheck;
    const final = await check.prepare();
    const log = document.querySelector('#log').textContent.trim().split('\n').slice(1).map(line => JSON.parse(line));
    states.push(...log);
    return { final, ms: performance.now() - started, progressEvents: states.length, first: states[0], last: states.at(-1) };
  });
  result.provision = prepared;
  const answers = [];
  for (const message of chosen) {
    answers.push({ id: message.id, ...(await page.evaluate(text => window.languageCheck.understand(text), message.text)) });
  }
  result.answers = answers;
  const elapsed = answers.map(answer => answer.elapsedMs).sort((a, b) => a - b);
  result.firstUnderstandMs = answers[0]?.elapsedMs;
  result.laterUnderstandMedianMs = elapsed[Math.floor(elapsed.length / 2)];
  await context.close();

  page = await open(true);
  const response = await page.goto(origin);
  await page.waitForFunction(() => 'languageCheck' in window);
  const text = `The cart was blocking the path by the drying beds again (${crypto.randomUUID().slice(0, 8)}).`;
  result.offline = {
    pageFromServiceWorker: response.fromServiceWorker(),
    stateBefore: await page.evaluate(() => window.languageCheck.modelState()),
    storedBefore: await page.evaluate(() => window.languageCheck.modelStored()),
    message: text,
    answer: await page.evaluate(message => window.languageCheck.understand(message), text),
    stateAfter: await page.evaluate(() => window.languageCheck.modelState()),
  };
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
  files.close();
  preview.kill();
}
result.requests = {
  online: requests.filter(item => item.phase === 'online').map(item => item.url).filter(url => !url.startsWith(origin)),
  offline: requests.filter(item => item.phase === 'offline').map(item => item.url),
};
const nodeResults = JSON.parse(await readFile(resolve(`.local/language/results-${split}.json`), 'utf8').catch(() => 'null'));
if (nodeResults) {
  const byId = new Map(nodeResults.rows.map(row => [row.id, row.decision]));
  const same = result.answers.filter(answer => {
    const node = byId.get(answer.id);
    return node && node.status === answer.status && node.kind === answer.kind && node.category === answer.category && JSON.stringify(node.candidates) === JSON.stringify(answer.candidates);
  }).length;
  result.matchesNode = `${same}/${result.answers.length}`;
}
await writeFile(resolve(`.local/language/browser-${split}.json`), JSON.stringify(result, null, 2));
const { answers, ...summary } = result;
console.log(JSON.stringify(summary, null, 2));
