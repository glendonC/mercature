/** Search across the places prepared here, as she types: instant, offline, by name, city and the other names people use. */
export type Prepared = { id: string; name: string; area: string; aliases: string };

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Edits between two words, stopping once past the limit: a typo or two in a long name still finds it. */
function near(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...next) > limit) return false;
    row = next;
  }
  return row[b.length] <= limit;
}
/** A typed word finds a word that starts with it, or one within a typo or two once it is five letters long. */
const finds = (word: string, have: string) => have.startsWith(word) || (word.length >= 5 && near(word, have.slice(0, word.length + 1), word.length >= 8 ? 2 : 1)) || (word.length >= 5 && near(word, have, word.length >= 8 ? 2 : 1));

/** Places where every word typed finds a word of its name, city or aliases, best first: a name match before an alias match. */
export function matchPrepared(typed: string, places: readonly Prepared[]): Prepared[] {
  const asked = words(typed);
  if (!asked.length) return [];
  const score = (place: Prepared) => {
    const name = words(`${place.name} ${place.area}`), all = [...name, ...words(place.aliases)];
    if (!asked.every(word => all.some(have => finds(word, have)))) return -1;
    return asked.filter(word => name.some(have => finds(word, have))).length;
  };
  return places.map(place => ({ place, score: score(place) })).filter(item => item.score >= 0).sort((a, b) => b.score - a.score).map(item => item.place);
}
