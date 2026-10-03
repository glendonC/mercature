import type { IssueCategory, MessageKind, SiteFeature } from '../site/contracts';

/**
 * Decision policy shared by the app and the evaluation scripts, so both run the same code.
 * Inputs are normalized sentence embeddings; outputs come only from fixed lists.
 */

type Layer = {
  readonly normalization: { readonly mean: readonly number[]; readonly scale: readonly number[] };
  readonly weights: readonly (readonly number[])[];
  readonly bias: readonly number[];
};

/**
 * A head over label descriptions: the message's similarity to each label's example passages
 * (written in English, Spanish and Korean) feeds a small logistic regression.
 */
type PrototypeHead<Label> = Layer & {
  readonly labels: readonly Label[];
  /** Passages describing each label, aligned with labels. */
  readonly prototypes: readonly (readonly string[])[];
};

/** Small logistic-regression heads trained on labeled example messages. */
export type Heads = {
  readonly format: 'mercature-heads-v2';
  /** Short hash of the trained weights, prototypes and thresholds. */
  readonly version: string;
  readonly encoder: { readonly id: string; readonly revision: string };
  readonly kind: PrototypeHead<MessageKind>;
  readonly category: PrototypeHead<IssueCategory>;
  /** On the full embedding, one output: the message concerns a part of the site, not price, booking or taste. */
  readonly place: Layer;
  readonly thresholds: {
    /** Minimum probability of the most likely message kind. */
    readonly kind: number;
    /** Minimum probability of the most likely issue type, for problems. */
    readonly category: number;
    /** Minimum probability that the message concerns a place. */
    readonly place: number;
    /** Minimum score gap between the first and second ranked features. */
    readonly margin: number;
  };
};

/** Heads with their label passages embedded once by the loaded encoder. */
export type PreparedHeads = Heads & {
  readonly kindVectors: readonly (readonly ArrayLike<number>[])[];
  readonly categoryVectors: readonly (readonly ArrayLike<number>[])[];
};

export type Scores = {
  readonly kind: readonly number[];
  readonly category: readonly number[];
  readonly place: number;
  /** All features, best first. Similarity orders them; the values are never shown. */
  readonly ranked: readonly { readonly id: string; readonly score: number }[];
};

export type Decision = {
  readonly status: 'ready' | 'unsure';
  readonly kind: MessageKind | null;
  readonly category: IssueCategory | null;
  readonly candidates: readonly string[];
  readonly reason?: 'unclear-kind' | 'unclear-place' | 'no-place';
};

type Embed = (text: string) => Promise<ArrayLike<number>>;

/** e5 models expect these prefixes; the original message is kept elsewhere unchanged. */
export function queryText(message: string): string {
  return `query: ${message.normalize('NFKC').replace(/\s+/gu, ' ').trim()}`;
}

/** A feature is embedded as one full passage and one short word list per alias language. */
export function passageTexts(feature: SiteFeature): { readonly full: string; readonly lists: readonly string[] } {
  const aliases = [...new Set(Object.values(feature.aliases).flat())];
  const names = [...new Set([feature.name.en, feature.name.es])].join(', ');
  return {
    full: `passage: ${names}. ${feature.description}${aliases.length ? ` Also called: ${aliases.join(', ')}.` : ''}`,
    lists: Object.values(feature.aliases).filter(list => list.length).map(list => `passage: ${list.join(', ')}`),
  };
}

export type FeatureIndex = readonly {
  readonly id: string;
  readonly full: ArrayLike<number>;
  readonly lists: readonly ArrayLike<number>[];
}[];

/** Embeds a site's features once; the index is reused for every message about that site. */
export async function buildIndex(features: readonly SiteFeature[], embed: Embed): Promise<FeatureIndex> {
  const index = [];
  for (const feature of features) {
    const texts = passageTexts(feature);
    const full = await embed(texts.full);
    const lists = [];
    for (const text of texts.lists) lists.push(await embed(text));
    index.push({ id: feature.id, full, lists });
  }
  return index;
}

async function embedGroups(groups: readonly (readonly string[])[], embed: Embed) {
  const vectors = [];
  for (const group of groups) {
    const list = [];
    for (const text of group) list.push(await embed(text));
    vectors.push(list);
  }
  return vectors;
}

/** Embeds the label passages once per loaded encoder. */
export async function prepareHeads(heads: Heads, embed: Embed): Promise<PreparedHeads> {
  return {
    ...heads,
    kindVectors: await embedGroups(heads.kind.prototypes, embed),
    categoryVectors: await embedGroups(heads.category.prototypes, embed),
  };
}

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

/** Mean cosine between the message and each label's passages. */
export function prototypeSimilarities(query: ArrayLike<number>, vectors: readonly (readonly ArrayLike<number>[])[]): number[] {
  return vectors.map(group => group.reduce((sum, vector) => sum + dot(query, vector), 0) / group.length);
}

export function softmax(values: readonly number[]): number[] {
  const top = Math.max(...values);
  const exps = values.map(value => Math.exp(value - top));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map(value => value / total);
}

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

function logits(layer: Layer, input: ArrayLike<number>): number[] {
  const { mean, scale } = layer.normalization;
  const x = Array.from(input, (value, i) => (value - mean[i]) / scale[i]);
  return layer.weights.map((row, i) => dot(row, x) + layer.bias[i]);
}

/**
 * A feature's score averages its full passage's cosine with its best word list's cosine.
 * Only the resulting order is used.
 */
export function rankFeatures(query: ArrayLike<number>, index: FeatureIndex) {
  return index.map(feature => {
    const full = dot(query, feature.full);
    const lists = feature.lists.map(vector => dot(query, vector));
    return { id: feature.id, score: lists.length ? (full + Math.max(...lists)) / 2 : full };
  }).sort((a, b) => b.score - a.score);
}

export function score(query: ArrayLike<number>, index: FeatureIndex, heads: PreparedHeads): Scores {
  return {
    kind: softmax(logits(heads.kind, prototypeSimilarities(query, heads.kindVectors))),
    category: softmax(logits(heads.category, prototypeSimilarities(query, heads.categoryVectors))),
    place: sigmoid(logits(heads.place, query)[0]),
    ranked: rankFeatures(query, index),
  };
}

const argmax = (values: readonly number[]) => values.reduce((best, value, i) => (value > values[best] ? i : best), 0);

/** Kind is decided first, then whether a place is meant, then which place. */
export function decide(scores: Scores, heads: Heads): Decision {
  const { thresholds } = heads;
  const top = scores.ranked.slice(0, 3).map(item => item.id);
  const concernsPlace = scores.place >= thresholds.place;
  const candidates = concernsPlace ? top : [];
  const k = argmax(scores.kind);
  if (scores.kind[k] < thresholds.kind) {
    return { status: 'unsure', kind: null, category: null, candidates, reason: 'unclear-kind' };
  }
  const kind = heads.kind.labels[k];
  let category: IssueCategory | null = null;
  if (kind === 'problem') {
    const c = argmax(scores.category);
    if (scores.category[c] < thresholds.category) {
      return { status: 'unsure', kind, category: null, candidates, reason: 'unclear-kind' };
    }
    category = heads.category.labels[c];
  }
  if (!concernsPlace) return { status: 'unsure', kind, category, candidates: [], reason: 'no-place' };
  const margin = scores.ranked.length > 1 ? scores.ranked[0].score - scores.ranked[1].score : Infinity;
  if (margin < thresholds.margin) return { status: 'unsure', kind, category, candidates, reason: 'unclear-place' };
  return { status: 'ready', kind, category, candidates };
}
