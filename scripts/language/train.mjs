/**
 * Train the kind, issue-type and place heads and write src/language/heads.json.
 * Regularization and thresholds are chosen from out-of-fold predictions (5 folds by message family)
 * over the train and dev splits; the final heads are then fitted on all of them.
 * Held-out messages are never read.
 */
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { ISSUE_CATEGORIES, MESSAGE_KINDS } from '../../src/site/contracts.ts';
import { ENCODER } from '../../src/language/model.ts';
import { prototypeSimilarities, rankFeatures } from '../../src/language/policy.ts';
import { HEADS_PATH, categoryLabels, concernsPlace, embedAll, embedIndex, embedMessages, hasPlaceLabel, loadMessages } from './data.mjs';
import { CATEGORY_PROTOTYPES, KIND_PROTOTYPES } from './labels.mjs';

const WRONG_COST = 3; // A confident wrong answer costs three times what a "Not sure" saves.
const LAMBDAS = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3];
const FOLDS = 5;

const data = await loadMessages();
const pool = data.messages.filter(message => message.split === 'train' || message.split === 'dev');
const X = await embedMessages(pool);
const index = await embedIndex();
const embedGroups = async groups => { const out = []; for (const group of groups) out.push(await embedAll(group)); return out; };
const kindPrototypes = MESSAGE_KINDS.map(label => KIND_PROTOTYPES[label]);
const categoryPrototypes = ISSUE_CATEGORIES.map(label => CATEGORY_PROTOTYPES[label]);
const kindVectors = await embedGroups(kindPrototypes);
const categoryVectors = await embedGroups(categoryPrototypes);
/** Inputs per head: label-passage similarities for kind and issue type, the full embedding for place. */
const inputs = {
  kind: X.map(x => prototypeSimilarities(x, kindVectors)),
  category: X.map(x => prototypeSimilarities(x, categoryVectors)),
  place: X,
};

const families = [...new Set(pool.map(message => message.family))]
  .sort((a, b) => createHash('sha256').update(a).digest('hex').localeCompare(createHash('sha256').update(b).digest('hex')));
const foldOf = new Map(families.map((family, i) => [family, i % FOLDS]));
const folds = pool.map(message => foldOf.get(message.family));

function normalizer(rows) {
  const d = rows[0].length;
  const mean = Array.from({ length: d }, (_, i) => rows.reduce((sum, x) => sum + x[i], 0) / rows.length);
  const scale = mean.map((m, i) => Math.sqrt(rows.reduce((sum, x) => sum + (x[i] - m) ** 2, 0) / rows.length) || 1);
  return { mean, scale };
}
const apply = ({ mean, scale }, x) => x.map((value, i) => (value - mean[i]) / scale[i]);

/** Multinomial logistic regression, class-balanced, L2-regularized, full-batch Adam. */
function fit(rows, labels, classes, lambda) {
  const n = rows.length, d = rows[0].length;
  const counts = Array.from({ length: classes }, (_, k) => labels.filter(label => label === k).length);
  const weightOf = counts.map(count => (count ? n / (classes * count) : 0));
  const total = labels.reduce((sum, label) => sum + weightOf[label], 0);
  const W = Array.from({ length: classes }, () => new Float64Array(d));
  const b = new Float64Array(classes);
  const m = Array.from({ length: classes }, () => new Float64Array(d + 1));
  const v = Array.from({ length: classes }, () => new Float64Array(d + 1));
  const rate = 0.05, beta1 = 0.9, beta2 = 0.999;
  const logits = new Float64Array(classes);
  for (let step = 1; step <= 400; step++) {
    const gW = Array.from({ length: classes }, () => new Float64Array(d));
    const gb = new Float64Array(classes);
    for (let i = 0; i < n; i++) {
      const x = rows[i];
      let top = -Infinity;
      for (let k = 0; k < classes; k++) {
        let z = b[k];
        for (let j = 0; j < d; j++) z += W[k][j] * x[j];
        logits[k] = z;
        if (z > top) top = z;
      }
      let sum = 0;
      for (let k = 0; k < classes; k++) { logits[k] = Math.exp(logits[k] - top); sum += logits[k]; }
      for (let k = 0; k < classes; k++) {
        const g = (weightOf[labels[i]] / total) * (logits[k] / sum - (k === labels[i] ? 1 : 0));
        gb[k] += g;
        for (let j = 0; j < d; j++) gW[k][j] += g * x[j];
      }
    }
    for (let k = 0; k < classes; k++) {
      for (let j = 0; j <= d; j++) {
        const g = j < d ? gW[k][j] + lambda * W[k][j] : gb[k];
        m[k][j] = beta1 * m[k][j] + (1 - beta1) * g;
        v[k][j] = beta2 * v[k][j] + (1 - beta2) * g * g;
        const delta = (rate * m[k][j] / (1 - beta1 ** step)) / (Math.sqrt(v[k][j] / (1 - beta2 ** step)) + 1e-8);
        if (j < d) W[k][j] -= delta; else b[k] -= delta;
      }
    }
  }
  return { weights: W.map(row => Array.from(row)), bias: Array.from(b) };
}

function probabilities(layer, x) {
  const logits = layer.weights.map((row, k) => row.reduce((sum, w, j) => sum + w * x[j], layer.bias[k]));
  const top = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - top));
  const sum = exps.reduce((s, e) => s + e, 0);
  return exps.map(e => e / sum);
}

/** Out-of-fold probabilities for every labeled pool message, for one head and one lambda. */
function outOfFold(rows, label, classes, lambda) {
  const out = new Array(pool.length).fill(null);
  for (let fold = 0; fold < FOLDS; fold++) {
    const trainIdx = pool.map((message, i) => i).filter(i => folds[i] !== fold && label(pool[i]) !== null);
    const norm = normalizer(trainIdx.map(i => rows[i]));
    const layer = fit(trainIdx.map(i => apply(norm, rows[i])), trainIdx.map(i => label(pool[i])), classes, lambda);
    pool.forEach((message, i) => {
      if (folds[i] === fold && label(message) !== null) out[i] = probabilities(layer, apply(norm, rows[i]));
    });
  }
  return out;
}

function chooseLambda(name, rows, label, classes) {
  let best;
  for (const lambda of LAMBDAS) {
    const oof = outOfFold(rows, label, classes, lambda);
    const idx = pool.map((message, i) => i).filter(i => oof[i]);
    const counts = Array.from({ length: classes }, (_, k) => idx.filter(i => label(pool[i]) === k).length);
    let loss = 0, weight = 0, correct = 0;
    for (const i of idx) {
      const y = label(pool[i]);
      loss -= Math.log(Math.max(oof[i][y], 1e-12)) / counts[y];
      weight += 1 / counts[y];
      if (oof[i].indexOf(Math.max(...oof[i])) === y) correct++;
    }
    loss /= weight;
    console.log(`${name} lambda ${lambda}: out-of-fold balanced log loss ${loss.toFixed(3)}, accuracy ${correct}/${idx.length}`);
    if (!best || loss < best.loss - 1e-9) best = { lambda, loss, oof };
  }
  return best;
}

const kindLabel = message => MESSAGE_KINDS.indexOf(message.kind);
const categoryLabel = message => (message.kind === 'problem' && categoryLabels(message).length ? ISSUE_CATEGORIES.indexOf(categoryLabels(message)[0]) : null);
const placeLabel = message => (hasPlaceLabel(message) ? Number(concernsPlace(message)) : null);

const kind = chooseLambda('kind', inputs.kind, kindLabel, MESSAGE_KINDS.length);
const category = chooseLambda('category', inputs.category, categoryLabel, ISSUE_CATEGORIES.length);
const place = chooseLambda('place', inputs.place, placeLabel, 2);

// Thresholds from out-of-fold probabilities, so no message scores a head that saw it.
const grid = (from, to, stepSize) => Array.from({ length: Math.round((to - from) / stepSize) + 1 }, (_, i) => Number((from + i * stepSize).toFixed(4)));
function choose(name, values, utility, prefer) {
  let best;
  for (const value of values) {
    const u = utility(value);
    if (!best || u > best.u + 1e-12 || (Math.abs(u - best.u) <= 1e-12 && prefer(value, best.value))) best = { value, u };
  }
  console.log(`threshold ${name}: ${best.value} (out-of-fold utility ${Number(best.u.toFixed(4))})`);
  return best.value;
}
const argmax = p => p.indexOf(Math.max(...p));
const lower = (a, b) => a < b;
const closerToHalf = (a, b) => Math.abs(a - 0.5) < Math.abs(b - 0.5);
const thresholds = {};
thresholds.kind = choose('kind', grid(0.34, 0.95, 0.01), t => pool.reduce((u, message, i) => {
  const p = kind.oof[i];
  if (!p || p[argmax(p)] < t) return u;
  return u + (MESSAGE_KINDS[argmax(p)] === message.kind ? 1 : -WRONG_COST);
}, 0), lower);
thresholds.category = choose('category', grid(0.17, 0.95, 0.01), t => pool.reduce((u, message, i) => {
  const p = category.oof[i];
  if (!p || p[argmax(p)] < t) return u;
  return u + (categoryLabels(message).includes(ISSUE_CATEGORIES[argmax(p)]) ? 1 : -WRONG_COST);
}, 0), lower);
const placeProbability = i => place.oof[i]?.[1];
thresholds.place = choose('place', grid(0.05, 0.95, 0.01), t => {
  const rate = wanted => {
    const group = pool.map((message, i) => [message, i]).filter(([message, i]) => placeProbability(i) !== undefined && concernsPlace(message) === wanted);
    return group.filter(([, i]) => (placeProbability(i) >= t) === wanted).length / Math.max(group.length, 1);
  };
  return (rate(true) + rate(false)) / 2;
}, closerToHalf);
const margins = pool.map((message, i) => {
  const ranked = rankFeatures(X[i], index);
  return { top: ranked[0].id, margin: ranked[0].score - ranked[1].score };
});
thresholds.margin = choose('margin', grid(0, 0.06, 0.0025), t => pool.reduce((u, message, i) => {
  // Vague messages have no place label, so a confident place for one counts as wrong.
  const p = placeProbability(i) ?? (message.case === 'vague' ? 1 : undefined);
  if (p === undefined || p < thresholds.place || margins[i].margin < t) return u;
  return u + (message.places.includes(margins[i].top) ? 1 : -WRONG_COST);
}, 0), lower);

// Final heads on every train and dev message.
const final = (rows, label, classes, lambda) => {
  const idx = pool.map((message, i) => i).filter(i => label(pool[i]) !== null);
  const normalization = normalizer(idx.map(i => rows[i]));
  return { normalization, ...fit(idx.map(i => apply(normalization, rows[i])), idx.map(i => label(pool[i])), classes, lambda) };
};
const kindLayer = final(inputs.kind, kindLabel, MESSAGE_KINDS.length, kind.lambda);
const categoryLayer = final(inputs.category, categoryLabel, ISSUE_CATEGORIES.length, category.lambda);
const placeTwo = final(inputs.place, placeLabel, 2, place.lambda);
// Two-class softmax written as one logistic output: p(place) = sigmoid((w1 - w0) . x + b1 - b0).
const placeLayer = { normalization: placeTwo.normalization, weights: [placeTwo.weights[1].map((w, j) => w - placeTwo.weights[0][j])], bias: [placeTwo.bias[1] - placeTwo.bias[0]] };

const round = value => Number(value.toPrecision(6));
const layerJson = layer => ({
  normalization: { mean: layer.normalization.mean.map(round), scale: layer.normalization.scale.map(round) },
  weights: layer.weights.map(row => row.map(round)),
  bias: layer.bias.map(round),
});
const heads = {
  format: 'mercature-heads-v2',
  version: '',
  encoder: { id: ENCODER.id, revision: ENCODER.revision },
  kind: { labels: [...MESSAGE_KINDS], prototypes: kindPrototypes, ...layerJson(kindLayer) },
  category: { labels: [...ISSUE_CATEGORIES], prototypes: categoryPrototypes, ...layerJson(categoryLayer) },
  place: layerJson(placeLayer),
  thresholds,
  training: {
    messages: data.files,
    messagesSha256: data.sha256,
    trainingMessages: pool.length,
    folds: FOLDS,
    lambda: { kind: kind.lambda, category: category.lambda, place: place.lambda },
    thresholdRule: `Out-of-fold over train and dev families: each threshold maximizes correct answers minus ${WRONG_COST} times confident wrong answers; place maximizes balanced accuracy.`,
  },
};
const { version: _, ...content } = heads;
heads.version = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 12);
await writeFile(HEADS_PATH, `${JSON.stringify(heads)}\n`);
console.log(`Wrote ${HEADS_PATH.pathname} version ${heads.version} (${JSON.stringify(heads).length} bytes)`);
