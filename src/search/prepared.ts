/** Search across the places prepared here, as she types: instant, offline, by name, city and the other names people use. */
export type Prepared = { id: string; name: string; area: string; aliases: string };

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Places where every word typed starts a word of its name, city or aliases, best first: a name match before an alias match. */
export function matchPrepared(typed: string, places: readonly Prepared[]): Prepared[] {
  const asked = words(typed);
  if (!asked.length) return [];
  const score = (place: Prepared) => {
    const name = words(`${place.name} ${place.area}`), all = [...name, ...words(place.aliases)];
    if (!asked.every(word => all.some(have => have.startsWith(word)))) return -1;
    return asked.filter(word => name.some(have => have.startsWith(word))).length;
  };
  return places.map(place => ({ place, score: score(place) })).filter(item => item.score >= 0).sort((a, b) => b.score - a.score).map(item => item.place);
}
