/**
 * Browser measurement and offline proof, on a production build of a one-page harness that uses the
 * app's own Vite config and service worker.
 *   node scripts/language/browser.mjs [split] [--hub]
 * 1. Online: provision the model (from Hugging Face with --hub, otherwise from the local model files
 *    through a redirect that mirrors the Hub's CDN redirect), then understand every message in the split.
 * 2. With the memory example set written by memory.mjs for the split (if present): remember those
 *    examples, understand every message again and compare with Node.
 * 3. Cold restart of the same browser profile with networking disabled: understand a new message,
 *    check the kept examples survived, forget them and check every answer is back to the first run.
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
/** --restricted compares with memory.mjs --restricted, as the app applies the memory. */
const restricted = process.argv.includes('--restricted') ? '-restricted' : '';
/** --throttle 6 slows the page's CPU sixfold, a rough stand-in for a mid-range phone; it is not a phone. */
const throttleArg = process.argv.indexOf('--throttle');
const throttle = throttleArg > 0 ? Number(process.argv[throttleArg + 1]) : 1;
const port = process.env.MERCATURE_PORT ?? '4181';
/** --base /mercature/ checks a build made with the same --base, as on a sub-path deploy. */
const baseArg = process.argv.indexOf('--base');
const base = baseArg > 0 ? process.argv[baseArg + 1] : '/';
const origin = `http://127.0.0.1:${port}${base}`;

const preview = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--config', 'scripts/language/harness/vite.config.ts', '--host', '127.0.0.1', '--port', port, '--strictPort', '--base', base], { stdio: 'ignore' });
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
  if (throttle > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  return page;
}

const placeName = split === 'route' ? 'route' : 'farm';
/** Every decision field, the reason included; timing and model identity are not decisions. */
const sameDecision = (a, b) => !!a && !!b && a.status === b.status && a.kind === b.kind && a.category === b.category &&
  JSON.stringify(a.candidates) === JSON.stringify(b.candidates) && (a.reason ?? null) === (b.reason ?? null);
const { messages } = split === 'route'
  ? JSON.parse(await readFile(new URL('./route-messages.json', import.meta.url), 'utf8'))
  : await loadMessages();
const chosen = messages.filter(message => message.split === split);
const result = { split, throttle, source: '', userAgent: '' };
try {
  let page = await open(false);
  await page.goto(origin);
  await page.waitForFunction(() => 'languageCheck' in window);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(done => navigator.serviceWorker.addEventListener('controllerchange', () => done(), { once: true }));
  });
  result.userAgent = await page.evaluate(() => navigator.userAgent);
  result.downloadBytesBefore = await page.evaluate(() => window.languageCheck.modelDownloadBytes());
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
  result.source = prepared.final.model?.revision.includes('+latin-hangul') ? 'trimmed files served by this origin'
    : fromHub ? 'pinned files from huggingface.co' : 'pinned files, Hub URLs redirected to local copies';
  result.downloadBytesAfter = await page.evaluate(() => window.languageCheck.modelDownloadBytes());
  result.prepareSite = [
    await page.evaluate(place => window.languageCheck.prepareSite(place), placeName),
    await page.evaluate(place => window.languageCheck.prepareSite(place), placeName),
  ];
  // One spot added to the walk: only that spot should be embedded.
  if (placeName === 'route') {
    result.addedSpot = [
      await page.evaluate(() => window.languageCheck.prepareSite('route-plus')),
      await page.evaluate(() => window.languageCheck.prepareSite('route-plus')),
    ];
  }
  const answers = [];
  for (const message of chosen) {
    answers.push({ id: message.id, ...(await page.evaluate(([text, place]) => window.languageCheck.understand(text, place), [message.text, placeName])) });
  }
  result.answers = answers;
  const memory = JSON.parse(await readFile(resolve(`.local/language/memory-${split}${restricted}.json`), 'utf8').catch(() => 'null'))?.browserCheck;
  if (memory) {
    const kept = [];
    for (const example of memory.examples) kept.push(await page.evaluate(([text, place, spot]) => window.languageCheck.remember(text, place, spot), [example.text, placeName, example.spot]));
    const withMemory = [];
    for (const message of chosen) {
      withMemory.push({ id: message.id, ...(await page.evaluate(([text, place]) => window.languageCheck.understand(text, place), [message.text, placeName])) });
    }
    result.memory = {
      examples: memory.examples.length,
      kept: kept.filter(Boolean).length,
      count: await page.evaluate(place => window.languageCheck.rememberedCount(place), placeName),
      remembered: withMemory.filter(answer => answer.reason === 'remembered').length,
      matchesNode: `${withMemory.filter(answer => sameDecision(memory.decisions[answer.id], answer)).length}/${withMemory.length}`,
    };
  }
  const elapsed = answers.map(answer => answer.elapsedMs).sort((a, b) => a - b);
  result.firstUnderstandMs = answers[0]?.elapsedMs;
  result.laterUnderstandMedianMs = elapsed[Math.floor(elapsed.length / 2)];
  await context.close();

  page = await open(true);
  const response = await page.goto(origin);
  await page.waitForFunction(() => 'languageCheck' in window);
  const text = placeName === 'route'
    ? `The stone steps on Loreto near Maruri still have no handrail (${crypto.randomUUID().slice(0, 8)}).`
    : `The cart was blocking the path by the drying beds again (${crypto.randomUUID().slice(0, 8)}).`;
  result.offline = {
    pageFromServiceWorker: response.fromServiceWorker(),
    stateBefore: await page.evaluate(() => window.languageCheck.modelState()),
    storedBefore: await page.evaluate(() => window.languageCheck.modelStored()),
    message: text,
    answer: await page.evaluate(([message, place]) => window.languageCheck.understand(message, place), [text, placeName]),
    stateAfter: await page.evaluate(() => window.languageCheck.modelState()),
  };
  if (memory) {
    result.offline.rememberedAfterRestart = await page.evaluate(place => window.languageCheck.rememberedCount(place), placeName);
    await page.evaluate(place => window.languageCheck.forgetPlace(place), placeName);
    result.offline.rememberedAfterForget = await page.evaluate(place => window.languageCheck.rememberedCount(place), placeName);
    const again = [];
    for (const message of chosen) again.push({ id: message.id, ...(await page.evaluate(([text, place]) => window.languageCheck.understand(text, place), [message.text, placeName])) });
    const first = new Map(result.answers.map(answer => [answer.id, answer]));
    result.offline.afterForgetMatchesFirstRun = `${again.filter(answer => sameDecision(first.get(answer.id), answer)).length}/${again.length}`;
  }
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
  result.matchesNode = `${result.answers.filter(answer => sameDecision(byId.get(answer.id), answer)).length}/${result.answers.length}`;
}
await writeFile(resolve(`.local/language/browser-${split}${restricted}${throttle > 1 ? `-throttle${throttle}` : ''}.json`), JSON.stringify(result, null, 2));
const { answers, ...summary } = result;
console.log(JSON.stringify(summary, null, 2));
