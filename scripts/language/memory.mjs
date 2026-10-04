/**
 * Memory of the operator's confirmations (src/language/memory.ts): calibration and evaluation.
 *   node scripts/language/memory.mjs calibrate   farm training and dev families only
 *   node scripts/language/memory.mjs dev         dev families against training examples, a dry run of the evaluation
 *   node scripts/language/memory.mjs test        held-out farm messages, once, after the freeze
 *   node scripts/language/memory.mjs route       Qorikancha walk messages, once, after the freeze
 * A memory holds k confirmed examples per spot, drawn from messages disjoint from the scored ones,
 * either in Quechua only or in each of English, Spanish, Korean and Quechua. Every scored message
 * runs through the model; the memory changes only the spot order, with the app's own code.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MEMORY, overlap, recall, remembered, sketch } from '../../src/language/memory.ts';
import { buildIndex, decide, looksSupported, prepareHeads, queryText, score } from '../../src/language/policy.ts';
import { QORIKANCHA_PLACE } from '../../src/site/route.ts';
import { FARM_FEATURES, HEADS_PATH, asExpected, concernsPlace, confidentWrong, encoderInfo, hasPlaceLabel, loadMessages } from './data.mjs';

const MODES = ['calibrate', 'dev', 'test', 'route'];
const mode = process.argv.slice(2).find(arg => MODES.includes(arg)) ?? 'calibrate';

const steps = (from, to, step) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => Number((from + i * step).toFixed(3)));
/** Fixed before any held-out or route message was scored with a memory. */
const PROTOCOL = {
  examplesPerSpot: [0, 1, 2, 3],
  memories: { qu: ['qu'], all: ['en', 'es', 'ko', 'qu'] },
  draws: { calibrate: 10, dev: 20, test: 20, route: 20 },
  seed: { calibrate: 'calibrate', dev: 'dev', test: 'heldout', route: 'route' },
  calibration: {
    queries: 'every farm training and dev message (English, Spanish, Korean and Quechua), with examples from its own family left out',
    objective: 'right first spots gained minus 3 times right first spots lost, over both memories, k = 1 to 3 and all draws',
    groups: 'messages that pass the language check (English, Spanish, Korean), compared by embedding cosine, and those that do not, compared by spelling-sketch cosine; each pair chosen on its own messages',
    grid: {
      supported: { similarity: steps(0.8, 0.98, 0.005), lead: [0, 0.005, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05] },
      unsupported: { similarity: steps(0.05, 0.95, 0.025), lead: [0, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2] },
    },
    ties: 'the higher similarity, then the higher lead',
  },
  ship: [
    'With no examples, every decision equals the published run (88 of 88 held-out, 44 of 44 route).',
    'Quechua: on the held-out farm messages with a Quechua memory, the right spot comes first for at least 3 more of the 16 messages naming one at k = 3 (mean over draws), and top-3 does not fall.',
    'English, Spanish and Korean: for each language, place, memory and k, the mean over draws of top-1, top-3 and as-expected answers is not below k = 0, and confident wrong answers are not above it.',
  ],
};

const heads = JSON.parse(await readFile(HEADS_PATH, 'utf8'));
const memoryData = JSON.parse(await readFile(new URL('./memory-messages.json', import.meta.url), 'utf8'));
const farm = await loadMessages();
const route = JSON.parse(await readFile(new URL('./route-messages.json', import.meta.url), 'utf8'));
const farmExtra = memoryData.messages.filter(message => message.place === 'farm');
const routeExamples = memoryData.messages.filter(message => message.place === 'route');

const notTest = message => message.split !== 'test';
const sets = {
  calibrate: { features: FARM_FEATURES, queries: [...farm.messages.filter(notTest), ...farmExtra], pool: [...farm.messages.filter(notTest), ...farmExtra] },
  dev: { features: FARM_FEATURES, queries: [...farm.messages, ...farmExtra].filter(message => message.split === 'dev'), pool: [...farm.messages, ...farmExtra].filter(message => message.split === 'train') },
  test: { features: FARM_FEATURES, queries: farm.messages.filter(message => message.split === 'test'), pool: [...farm.messages.filter(notTest), ...farmExtra] },
  route: { features: QORIKANCHA_PLACE.features, queries: route.messages, pool: routeExamples },
}[mode];
const spots = sets.features.map(feature => feature.id);
const spotSet = new Set(spots);
/** Only messages about exactly one of the place's spots can be confirmed as an example of it. */
const pool = sets.pool.filter(message => message.places.length === 1 && hasPlaceLabel(message) && spotSet.has(message.places[0]));
const queryFamilies = new Set(sets.queries.map(message => message.family));
if (mode !== 'calibrate' && pool.some(message => queryFamilies.has(message.family))) throw new Error('Examples must come from families that are not scored.');

const encoder = await encoderInfo();
const vectors = new Map();
for (const message of [...sets.queries, ...pool]) if (!vectors.has(message.id)) vectors.set(message.id, await encoder.embed(queryText(message.text)));
const prepared = await prepareHeads(heads, encoder.embed);
const index = await buildIndex(sets.features, encoder.embed);

const grams = new Map([...sets.queries, ...pool].map(message => [message.id, sketch(message.text)]));
const queries = sets.queries.map(message => {
  const vector = vectors.get(message.id);
  const scores = score(vector, index, prepared);
  const supported = looksSupported(message.text);
  return { message, vector, grams: grams.get(message.id), scores, supported, base: decide(scores, heads, supported), ranked: scores.ranked.map(item => item.id) };
});
const asExample = message => ({ spot: message.places[0], vector: vectors.get(message.id), grams: grams.get(message.id) });

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = text => [...text].reduce((h, c) => Math.imul(h ^ c.codePointAt(0), 16777619), 2166136261) >>> 0;
function shuffled(list, seed) {
  const random = mulberry32(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** k examples per spot and language; within a draw, a smaller memory is part of a larger one. */
function drawMemory(languages, k, draw) {
  const examples = [];
  for (const spot of spots) {
    for (const lang of languages) {
      const options = pool.filter(message => message.places[0] === spot && message.lang === lang).sort((a, b) => a.id.localeCompare(b.id));
      examples.push(...shuffled(options, seedOf(`${PROTOCOL.seed[mode]}:${draw}:${spot}:${lang}`)).slice(0, k));
    }
  }
  return examples;
}

/** The memory's effect on one message, with the app's code. Ranking: the recalled spot first when applied. */
function withMemory(query, recalled) {
  const decision = remembered(query.base, query.scores, recalled, query.supported);
  const ranked = recalled && query.base.candidates.length ? [recalled.spot, ...query.ranked.filter(id => id !== recalled.spot)] : query.ranked;
  return { decision, ranked };
}

const placeRow = message => hasPlaceLabel(message) && concernsPlace(message);
const top = (message, ranked, n) => ranked.slice(0, n).some(id => message.places.includes(id));

/** Counts for one memory over a list of messages; outcomes[i] belongs to list[i]. */
function count(list, outcomes) {
  const totals = { messages: list.length, withPlace: 0, top1: 0, top3: 0, ready: 0, readyWrong: 0, expected: 0, remembered: 0, changed: 0, falseTriggers: 0, gained: 0, lost: 0 };
  list.forEach((query, i) => {
    const { message, base, ranked } = query;
    const { decision, ranked: after } = outcomes[i];
    if (placeRow(message)) {
      totals.withPlace++;
      if (top(message, after, 1)) totals.top1++;
      if (top(message, after, 3)) totals.top3++;
      if (top(message, after, 1) && !top(message, ranked, 1)) totals.gained++;
      if (!top(message, after, 1) && top(message, ranked, 1)) totals.lost++;
    }
    if (decision.status === 'ready') totals.ready++;
    if (confidentWrong(message, decision)) totals.readyWrong++;
    if (asExpected(message, decision)) totals.expected++;
    if (decision.reason === 'remembered') totals.remembered++;
    if (JSON.stringify(decision) !== JSON.stringify(base)) {
      totals.changed++;
      if (!message.places.includes(decision.candidates[0])) totals.falseTriggers++;
    }
  });
  return totals;
}

const languages = [...new Set(queries.map(query => query.message.lang))];
const byLanguage = (outcomes) => Object.fromEntries(languages.map(lang => {
  const picked = queries.map((query, i) => [query, outcomes[i]]).filter(([query]) => query.message.lang === lang);
  return [lang, count(picked.map(([query]) => query), picked.map(([, outcome]) => outcome))];
}));
const summary = runs => {
  const keys = Object.keys(runs[0]);
  return Object.fromEntries(keys.map(key => {
    const values = runs.map(run => run[key]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [key, values.every(value => value === values[0]) ? values[0] : { mean: Number(mean.toFixed(2)), min: Math.min(...values), max: Math.max(...values) }];
  }));
};
const mean = value => (typeof value === 'number' ? value : value.mean);

await mkdir(resolve('.local/language'), { recursive: true });
let output;
if (mode === 'calibrate') {
  // Per memory, k, draw and message: each spot's closest kept example, from the message's own family left out.
  const cases = [];
  for (const [name, memoryLanguages] of Object.entries(PROTOCOL.memories)) {
    for (const k of PROTOCOL.examplesPerSpot.filter(k => k > 0)) {
      for (let draw = 0; draw < PROTOCOL.draws.calibrate; draw++) {
        const examples = drawMemory(memoryLanguages, k, draw);
        for (const query of queries) {
          const best = new Map();
          for (const example of examples) {
            if (example.family === query.message.family) continue;
            let similarity = 0;
            if (query.supported) {
              const vector = vectors.get(example.id);
              for (let i = 0; i < vector.length; i++) similarity += query.vector[i] * vector[i];
            } else similarity = overlap(query.grams, grams.get(example.id));
            if (similarity > (best.get(example.places[0]) ?? -Infinity)) best.set(example.places[0], similarity);
          }
          const [first, second] = [...best].sort((a, b) => b[1] - a[1]);
          cases.push({ name, k, draw, query, first, second });
        }
      }
    }
  }
  const recalledFor = (item, limits) => {
    if (!item.first || item.first[1] < limits.similarity) return null;
    if (item.second && item.first[1] - item.second[1] < limits.lead) return null;
    return { spot: item.first[0], similarity: item.first[1] };
  };
  const grid = { supported: [], unsupported: [] };
  for (const group of ['supported', 'unsupported']) {
    for (const similarity of PROTOCOL.calibration.grid[group].similarity) {
      for (const lead of PROTOCOL.calibration.grid[group].lead) {
        let gained = 0, lost = 0;
        for (const item of cases) {
          if (!placeRow(item.query.message) || item.query.supported !== (group === 'supported')) continue;
          const { ranked } = withMemory(item.query, recalledFor(item, { similarity, lead }));
          const before = top(item.query.message, item.query.ranked, 1), after = top(item.query.message, ranked, 1);
          if (after && !before) gained++;
          if (before && !after) lost++;
        }
        grid[group].push({ similarity, lead, gained, lost, objective: gained - 3 * lost });
      }
    }
  }
  const best = list => [...list].sort((a, b) => b.objective - a.objective || b.similarity - a.similarity || b.lead - a.lead)[0];
  const chosen = { supported: best(grid.supported), unsupported: best(grid.unsupported) };
  const limits = Object.fromEntries(Object.entries(chosen).map(([group, item]) => [group, { similarity: item.similarity, lead: item.lead }]));
  const results = {};
  for (const name of Object.keys(PROTOCOL.memories)) {
    results[name] = {};
    for (const k of PROTOCOL.examplesPerSpot) {
      if (k === 0) { results[name][k] = byLanguage(queries.map(query => withMemory(query, null))); continue; }
      const runs = [];
      for (let draw = 0; draw < PROTOCOL.draws.calibrate; draw++) {
        const items = cases.filter(item => item.name === name && item.k === k && item.draw === draw);
        runs.push(byLanguage(items.map(item => withMemory(item.query, recalledFor(item, item.query.supported ? limits.supported : limits.unsupported)))));
      }
      results[name][k] = Object.fromEntries(languages.map(lang => [lang, summary(runs.map(run => run[lang]))]));
    }
  }
  // Why other languages are compared by spelling: how often each message's single closest example
  // in the same language (its own family left out) is about the right spot.
  const unit = vector => { const size = Math.hypot(...vector); return vector.map(value => value / size); };
  const nearest = (lang, similarity, prepare = () => vector => vector) => {
    const items = pool.filter(message => message.lang === lang);
    let right = 0;
    for (const query of items) {
      const others = items.filter(example => example.family !== query.family);
      const map = prepare(others);
      let best = null, top = -Infinity;
      for (const example of others) {
        const value = similarity(query, example, map);
        if (value > top) { top = value; best = example; }
      }
      if (best.places[0] === query.places[0]) right++;
    }
    return `${right}/${items.length}`;
  };
  const cosine = (a, b, map) => { const x = map(vectors.get(a.id)), y = map(vectors.get(b.id)); return x.reduce((sum, value, i) => sum + value * y[i], 0); };
  const centered = others => {
    const center = vectors.get(others[0].id).map((_, i) => others.reduce((sum, example) => sum + vectors.get(example.id)[i], 0) / others.length);
    return vector => unit(vector.map((value, i) => value - center[i]));
  };
  const nearestExample = Object.fromEntries(['en', 'es', 'ko', 'qu'].map(lang => [lang, {
    embedding: nearest(lang, cosine),
    embeddingCentered: nearest(lang, cosine, centered),
    spelling: nearest(lang, (a, b) => overlap(grams.get(a.id), grams.get(b.id))),
  }]));
  console.log(JSON.stringify({ nearestExample }));
  output = { mode, protocol: PROTOCOL, shipped: MEMORY, chosen: limits, matchesShipped: JSON.stringify(MEMORY) === JSON.stringify(limits), nearestExample, grid, results };
  console.log(JSON.stringify({ chosen, shipped: MEMORY, results: Object.fromEntries(Object.entries(results).map(([name, byK]) => [name, Object.fromEntries(Object.entries(byK).map(([k, byLang]) => [k, Object.fromEntries(Object.entries(byLang).map(([lang, t]) => [lang, `top1 ${mean(t.top1)}/${t.withPlace} top3 ${mean(t.top3)} lost ${mean(t.lost)} false ${mean(t.falseTriggers)}`]))]))])) }, null, 1));
} else {
  const publishedPath = { dev: resolve('.local/language/results-dev.json'), test: new URL('./results/heldout-with-language-check.json', import.meta.url), route: new URL('./results/route.json', import.meta.url) }[mode];
  const published = JSON.parse(await readFile(publishedPath, 'utf8'));
  const publishedById = new Map(published.rows.map(row => [row.id, JSON.stringify(row.decision)]));
  // Messages the published run did not score (the dev Quechua translations) have nothing to match.
  const empty = queries.filter(query => publishedById.has(query.message.id)).map(query => {
    const decision = remembered(query.base, query.scores, recall(query, [], spotSet, query.supported), query.supported);
    return JSON.stringify(decision) === publishedById.get(query.message.id);
  });
  const results = {};
  const browserCheck = {};
  /** Every message the memory changed, per memory and k: in how many draws, and which spot it put first. */
  const changes = {};
  /** For spelling recalls: does the message share a word, or a spot's name or alias, with its closest kept example? */
  const spelling = {};
  const wordsOf = text => new Set(text.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{M}']{4,}/gu) ?? []);
  const names = new Set(sets.features.flatMap(feature => [feature.name.en, feature.name.es, ...Object.values(feature.aliases).flat()]).flatMap(text => [...wordsOf(text)]));
  for (const [name, memoryLanguages] of Object.entries(PROTOCOL.memories)) {
    results[name] = {};
    changes[name] = {};
    spelling[name] = {};
    for (const k of PROTOCOL.examplesPerSpot) {
      changes[name][k] = {};
      spelling[name][k] = { recalls: 0, right: 0, sharedWord: 0, sharedName: 0, words: {} };
      const runs = [];
      for (let draw = 0; draw < (k ? PROTOCOL.draws[mode] : 1); draw++) {
        const examples = k ? drawMemory(memoryLanguages, k, draw) : [];
        const kept = examples.map(asExample);
        const outcomes = queries.map(query => {
          const recalled = kept.length ? recall(query, kept, spotSet, query.supported) : null;
          if (recalled && !query.supported && query.base.candidates.length) {
            const closest = examples.filter(example => example.places[0] === recalled.spot).sort((a, b) => overlap(query.grams, grams.get(b.id)) - overlap(query.grams, grams.get(a.id)))[0];
            const shared = [...wordsOf(query.message.text)].filter(word => wordsOf(closest.text).has(word));
            const tally = spelling[name][k];
            tally.recalls++;
            if (query.message.places.includes(recalled.spot)) tally.right++;
            if (shared.length) tally.sharedWord++;
            // Quechua adds suffixes to names (Loretoqa, Bañopi), so a name counts when it starts a shared word.
            if (shared.some(word => [...names].some(name => word.startsWith(name)))) tally.sharedName++;
            for (const word of shared) tally.words[word] = (tally.words[word] ?? 0) + 1;
          }
          return withMemory(query, recalled);
        });
        runs.push(byLanguage(outcomes));
        queries.forEach((query, i) => {
          const { decision } = outcomes[i];
          if (JSON.stringify(decision) === JSON.stringify(query.base)) return;
          const entry = (changes[name][k][query.message.id] ??= { lang: query.message.lang, places: query.message.places, before: query.base.candidates[0] ?? null, draws: 0, first: {} });
          entry.draws++;
          entry.first[decision.candidates[0]] = (entry.first[decision.candidates[0]] ?? 0) + 1;
        });
        if (name === 'all' && k === 1 && draw === 0) {
          browserCheck.examples = examples.map(example => ({ id: example.id, text: example.text, spot: example.places[0] }));
          browserCheck.decisions = Object.fromEntries(queries.map((query, i) => [query.message.id, outcomes[i].decision]));
        }
      }
      results[name][k] = Object.fromEntries(languages.map(lang => [lang, summary(runs.map(run => run[lang]))]));
    }
  }
  const checks = { identicalWithoutMemory: `${empty.filter(Boolean).length}/${empty.length}` };
  const atZero = (name, lang) => results[name][0][lang];
  const regressions = [];
  for (const name of Object.keys(PROTOCOL.memories)) {
    for (const k of PROTOCOL.examplesPerSpot.filter(k => k > 0)) {
      for (const lang of ['en', 'es', 'ko'].filter(lang => languages.includes(lang))) {
        const now = results[name][k][lang], zero = atZero(name, lang);
        for (const key of ['top1', 'top3', 'expected']) if (mean(now[key]) < zero[key]) regressions.push(`${name} k=${k} ${lang} ${key} ${mean(now[key])} < ${zero[key]}`);
        if (mean(now.readyWrong) > zero.readyWrong) regressions.push(`${name} k=${k} ${lang} readyWrong ${mean(now.readyWrong)} > ${zero.readyWrong}`);
      }
    }
  }
  checks.regressions = regressions;
  if (mode === 'test') {
    const zero = atZero('qu', 'qu'), three = results.qu[3].qu;
    checks.quechua = { top1AtZero: zero.top1, top1AtThree: mean(three.top1), top3AtZero: zero.top3, top3AtThree: mean(three.top3), withPlace: zero.withPlace };
    checks.quechua.improved = mean(three.top1) >= zero.top1 + 3 && mean(three.top3) >= zero.top3;
  }
  output = { mode, protocol: PROTOCOL, limits: MEMORY, pool: Object.fromEntries(spots.map(spot => [spot, Object.fromEntries(['en', 'es', 'ko', 'qu'].map(lang => [lang, pool.filter(m => m.places[0] === spot && m.lang === lang).length]))])), checks, results, changes, spelling, browserCheck };
  console.log(JSON.stringify({ checks, top1: Object.fromEntries(Object.entries(results).map(([name, byK]) => [name, Object.fromEntries(Object.entries(byK).map(([k, byLang]) => [k, Object.fromEntries(Object.entries(byLang).map(([lang, t]) => [lang, `${mean(t.top1)}/${t.withPlace} top3 ${mean(t.top3)} false ${mean(t.falseTriggers)} lost ${mean(t.lost)}`]))]))])) }, null, 1));
}
const out = resolve('.local/language', `memory-${mode}.json`);
await writeFile(out, JSON.stringify(output, null, 2));
console.log(`Written to ${out}`);
