/**
 * Compare ways of embedding each feature, by top-1 and top-3 ranking on the train and dev splits.
 * Ranking has no trained parameters, so no held-out message is used.
 */
import { buildIndex, passageTexts, queryText, rankFeatures } from '../../src/language/policy.ts';
import { FARM_FEATURES, concernsPlace, embedAll, encoderInfo, hasPlaceLabel, loadMessages } from './data.mjs';

const { messages } = await loadMessages();
const pool = messages.filter(message => message.split !== 'test' && hasPlaceLabel(message) && concernsPlace(message));
const queries = await embedAll(pool.map(message => queryText(message.text)));
const names = feature => `${feature.name.en}, ${feature.name.es}`;
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

/** Each variant gives every feature a list of passages and a rule for combining their similarities. */
const variants = {
  'description only': feature => [`passage: ${feature.description}`],
  'names and description': feature => [`passage: ${names(feature)}. ${feature.description}`],
  'names, description and all aliases in one passage': feature => [passageTexts(feature).full],
  'best of description and per-language alias lists': feature => [`passage: ${names(feature)}. ${feature.description}`, ...passageTexts(feature).lists],
};
const report = (name, rankings) => {
  const top1 = rankings.filter((ranking, i) => pool[i].places.includes(ranking[0])).length;
  const top3 = rankings.filter((ranking, i) => ranking.slice(0, 3).some(id => pool[i].places.includes(id))).length;
  const byLanguage = Object.fromEntries(['en', 'es', 'ko'].map(lang => {
    const rows = pool.map((message, i) => [message, rankings[i]]).filter(([message]) => message.lang === lang);
    return [lang, `${rows.filter(([message, ranking]) => message.places.includes(ranking[0])).length}/${rows.length}`];
  }));
  console.log(`${name}: top-1 ${top1}/${pool.length}, top-3 ${top3}/${pool.length}, top-1 by language ${JSON.stringify(byLanguage)}`);
};
for (const [name, passagesOf] of Object.entries(variants)) {
  const vectors = [];
  for (const feature of FARM_FEATURES) vectors.push(await embedAll(passagesOf(feature)));
  report(name, queries.map(query => FARM_FEATURES
    .map((feature, j) => ({ id: feature.id, score: Math.max(...vectors[j].map(vector => dot(query, vector))) }))
    .sort((a, b) => b.score - a.score).map(item => item.id)));
}
const index = await buildIndex(FARM_FEATURES, (await encoderInfo()).embed);
report('shipped: average of the full passage and the best alias list', queries.map(query => rankFeatures(query, index).map(item => item.id)));
