/**
 * Evaluate the shipped heads and thresholds on one split with fresh inference for every message.
 * Usage: node scripts/language/evaluate.mjs [dev|test]. The held-out split ("test") is for the
 * single preregistered run; thresholds are never changed after it.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { resolve } from 'node:path';
import { aliasBaseline } from '../../src/language/index.ts';
import { RUNTIME_WASM } from '../../src/language/model.ts';
import { buildIndex, decide, prepareHeads, queryText, score } from '../../src/language/policy.ts';
import { FARM_FEATURES, HEADS_PATH, VARIANT, categoryLabels, concernsPlace, encoderInfo, hasPlaceLabel, loadMessages } from './data.mjs';

const split = process.argv.slice(2).find(arg => ['train', 'dev', 'test'].includes(arg)) ?? 'dev';
if (!['train', 'dev', 'test'].includes(split)) throw new Error('Split must be train, dev or test.');
const headsText = await readFile(HEADS_PATH, 'utf8');
const heads = JSON.parse(headsText);
const data = await loadMessages();
if (heads.training.messagesSha256 !== data.sha256) console.warn('Warning: messages.json changed since the heads were trained.');
const messages = data.messages.filter(message => message.split === split);

const encoder = await encoderInfo();
const indexStarted = performance.now();
const prepared = await prepareHeads(heads, encoder.embed);
const index = await buildIndex(FARM_FEATURES, encoder.embed);
const indexMs = performance.now() - indexStarted;
const inventory = FARM_FEATURES.map(feature => ({ id: feature.id, label: feature.name.en, description: feature.description, aliases: [...new Set(Object.values(feature.aliases).flat())] }));

const rows = [];
for (const message of messages) {
  const started = performance.now();
  const query = await encoder.embed(queryText(message.text));
  const scores = score(query, index, prepared);
  const decision = decide(scores, heads);
  const ms = performance.now() - started;
  const baseline = aliasBaseline(message.text, inventory).suggestions.map(item => item.id);
  rows.push({ message, scores, decision, ms, baseline });
}

const argmax = p => p.indexOf(Math.max(...p));
const pct = (n, d) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : 'n/a');
const ranked = row => row.scores.ranked.map(item => item.id);
const placeRows = list => list.filter(row => hasPlaceLabel(row.message) && concernsPlace(row.message));
const top1 = row => row.message.places.includes(ranked(row)[0]);
const top3 = row => ranked(row).slice(0, 3).some(id => row.message.places.includes(id));
const kindRight = row => heads.kind.labels[argmax(row.scores.kind)] === row.message.kind;
const categoryRows = list => list.filter(row => row.message.kind === 'problem' && categoryLabels(row.message).length);
const categoryRight = row => categoryLabels(row.message).includes(heads.category.labels[argmax(row.scores.category)]);
const placeRight = row => (row.scores.place >= heads.thresholds.place) === concernsPlace(row.message);

/** What a person should see for each case type: a right answer or "Not sure", never a confident wrong one. */
function expectation(row) {
  const { message, decision } = row;
  const kindOk = decision.kind === null || decision.kind === message.kind;
  switch (message.case) {
    case 'vague': return decision.status === 'unsure';
    case 'negation': case 'resolved': return decision.kind !== 'problem';
    case 'praise-general': case 'question-general': case 'off-topic': return decision.candidates.length === 0 && kindOk;
    default: return kindOk && !readyWrong(row);
  }
}
/** A confident answer: status ready. It is wrong when any answered field disagrees with the label. */
function readyWrong(row) {
  const { message, decision } = row;
  if (decision.status !== 'ready') return false;
  if (decision.kind !== message.kind) return true;
  if (message.kind === 'problem' && categoryLabels(message).length && !categoryLabels(message).includes(decision.category)) return true;
  if (!hasPlaceLabel(message) || !concernsPlace(message)) return true;
  return !message.places.includes(decision.candidates[0]);
}

function summarize(list) {
  const places = placeRows(list);
  const categories = categoryRows(list);
  const ready = list.filter(row => row.decision.status === 'ready');
  return {
    messages: list.length,
    top1: pct(places.filter(top1).length, places.length),
    top3: pct(places.filter(top3).length, places.length),
    kind: pct(list.filter(kindRight).length, list.length),
    category: pct(categories.filter(categoryRight).length, categories.length),
    placeOrNot: pct(list.filter(row => hasPlaceLabel(row.message)).filter(placeRight).length, list.filter(row => hasPlaceLabel(row.message)).length),
    ready: pct(ready.length, list.length),
    readyCorrect: pct(ready.filter(row => !readyWrong(row)).length, ready.length),
    expected: pct(list.filter(expectation).length, list.length),
    aliasHit: pct(places.filter(row => row.baseline.some(id => row.message.places.includes(id))).length, places.length),
    aliasExactlyRight: pct(places.filter(row => row.baseline.length === row.message.places.length && row.baseline.every(id => row.message.places.includes(id))).length, places.length),
  };
}

const languages = [...new Set(messages.map(row => row.lang))];
const cases = [...new Set(messages.map(row => row.case))];
const latencies = rows.map(row => row.ms).sort((a, b) => a - b);
const quantile = q => latencies[Math.min(latencies.length - 1, Math.ceil(q * latencies.length) - 1)];
const twoConcerns = rows.filter(row => row.message.case === 'two-concerns');
const noPlace = rows.filter(row => hasPlaceLabel(row.message) && !concernsPlace(row.message));
const report = {
  split,
  variant: VARIANT ?? 'quantized',
  heads: heads.version,
  thresholds: heads.thresholds,
  overall: summarize(rows),
  byLanguage: Object.fromEntries(languages.map(lang => [lang, summarize(rows.filter(row => row.message.lang === lang))])),
  byCase: Object.fromEntries(cases.map(name => [name, { messages: rows.filter(row => row.message.case === name).length, asExpected: pct(rows.filter(row => row.message.case === name).filter(expectation).length, rows.filter(row => row.message.case === name).length) }])),
  twoConcernsBothInTop3: pct(twoConcerns.filter(row => row.message.places.every(id => ranked(row).slice(0, 3).includes(id))).length, twoConcerns.length),
  noPlaceLeftEmpty: { model: pct(noPlace.filter(row => !row.decision.candidates.length).length, noPlace.length), alias: pct(noPlace.filter(row => !row.baseline.length).length, noPlace.length) },
  aliasSuggestsPlaceOnPraiseNegationResolved: pct(rows.filter(row => ['negation', 'resolved', 'praise-place'].includes(row.message.case) && row.baseline.length).length, rows.filter(row => ['negation', 'resolved', 'praise-place'].includes(row.message.case)).length),
  reasons: rows.reduce((counts, row) => ({ ...counts, [row.decision.reason ?? 'ready']: (counts[row.decision.reason ?? 'ready'] ?? 0) + 1 }), {}),
  speed: {
    readAndVerifyMs: Math.round(encoder.timing.readAndVerifyMs),
    sessionMs: Math.round(encoder.timing.sessionMs),
    siteIndexMs: Math.round(indexMs),
    perMessageP50Ms: Number(quantile(0.5).toFixed(1)),
    perMessageP95Ms: Number(quantile(0.95).toFixed(1)),
    perMessageMaxMs: Number(latencies.at(-1).toFixed(1)),
  },
  bytes: { modelFiles: encoder.bytes - RUNTIME_WASM.bytes, runtimeWasm: RUNTIME_WASM.bytes, heads: Buffer.byteLength(headsText) },
  host: { node: process.version, cpu: os.cpus()[0].model, threads: 1, runtime: `onnxruntime-web ${RUNTIME_WASM.version} wasm (CPU)` },
};
const failures = rows.filter(row => !expectation(row) || readyWrong(row) || (hasPlaceLabel(row.message) && concernsPlace(row.message) && !top1(row))).map(row => ({
  id: row.message.id, case: row.message.case, text: row.message.text,
  expected: { kind: row.message.kind, category: categoryLabels(row.message), places: row.message.places },
  got: row.decision, top3: ranked(row).slice(0, 3),
}));
await mkdir(resolve('.local/language'), { recursive: true });
const out = resolve('.local/language', `results-${split}${VARIANT ? `-${VARIANT}` : ''}.json`);
await writeFile(out, JSON.stringify({ report, failures, rows: rows.map(row => ({ id: row.message.id, decision: row.decision, ranked: ranked(row), kind: row.scores.kind, category: row.scores.category, place: row.scores.place, baseline: row.baseline, ms: row.ms })) }, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`${failures.length} messages with a wrong ranking or decision; details in ${out}`);
