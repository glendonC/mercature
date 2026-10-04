/**
 * The place the model and the map see once the operator's own records are included.
 * An added spot is an ordinary RouteSpot, so understand() ranks it like an authored one and a
 * visitor's message can point at something only she knew about. Nothing here claims a width,
 * a slope or whether a person can pass.
 */
import { looksSupported } from '../language/policy';
import type { RoutePlace, RouteSpot } from '../site/route';
import type { AddedSpot, EditKind, Edits, OwnNote } from './store';
import { UPDATE, recordDate, type VisitorLang, type Where } from './words';

/** Where a stretch of the tour route is, from the record the canvas holds. */
export type Locate = (stretch: number) => { from: number; to: number; landmark: string };

/** How each kind is named and what visitors call it. The word lists give Korean a list to match. */
const SPOT: Readonly<Record<EditKind, { en: string; es: string; sentence: string; aliases: Readonly<Record<string, readonly string[]>> }>> = {
  steps: { en: 'Steps', es: 'Escalones', sentence: 'Steps', aliases: { en: ['steps', 'stairs', 'staircase'], es: ['escalones', 'gradas', 'escaleras'], ko: ['계단', '돌계단'] } },
  kerb: { en: 'Kerb', es: 'Bordillo', sentence: 'A kerb to cross', aliases: { en: ['kerb', 'curb', 'high curb', 'no ramp'], es: ['bordillo', 'sardinel', 'vereda alta', 'sin rampa'], ko: ['연석', '턱', '경사로 없음'] } },
  narrow: { en: 'Narrow part', es: 'Paso angosto', sentence: 'A narrow part of the way', aliases: { en: ['narrow', 'too narrow', 'tight passage', 'does not fit'], es: ['angosto', 'estrecho', 'no cabe', 'paso estrecho'], ko: ['좁음', '좁은 길', '통과 불가'] } },
  other: { en: 'Something in the way', es: 'Algo que estorba', sentence: 'Something in the way', aliases: { en: ['obstacle', 'blocked', 'in the way'], es: ['obstáculo', 'bloqueado', 'estorbo'], ko: ['장애물', '막힘'] } },
  bench: { en: 'Bench', es: 'Banca', sentence: 'A bench to rest on', aliases: { en: ['bench', 'seat', 'somewhere to sit', 'rest'], es: ['banca', 'banco', 'asiento', 'descansar'], ko: ['벤치', '의자', '쉬는 곳'] } },
  toilet: { en: 'Toilet', es: 'Baño', sentence: 'A toilet', aliases: { en: ['toilet', 'toilets', 'restroom', 'bathroom'], es: ['baño', 'baños', 'servicios higiénicos'], ko: ['화장실'] } },
  ramp: { en: 'Ramp', es: 'Rampa', sentence: 'A ramp', aliases: { en: ['ramp', 'step-free'], es: ['rampa', 'sin escalones'], ko: ['경사로'] } },
  handrail: { en: 'Handrail', es: 'Pasamanos', sentence: 'A handrail', aliases: { en: ['handrail', 'railing', 'rail'], es: ['pasamanos', 'baranda', 'barandilla'], ko: ['난간', '손잡이'] } },
};

const round = (value: number) => Math.round(value);
const cap = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
/**
 * Her words join the matching passage only when the model's own check recognises the language.
 * A note in a language it does not know, Quechua for example, would pull unrelated messages to
 * this spot, so it stays in the interface and out of the passage.
 */
export const noteForPassage = (note: OwnNote): string =>
  note.text && note.language !== 'other' && looksSupported(note.text) ? note.text : '';

/** One added spot as the model and the map see it. */
export function addedFeature(spot: AddedSpot, locate: Locate): RouteSpot {
  const { from, to, landmark } = locate(spot.stretch);
  const words = SPOT[spot.kind], a = round(from), b = round(to), near = landmark.trim();
  const aliases: Record<string, readonly string[]> = {};
  for (const [language, list] of Object.entries(words.aliases)) aliases[language] = near ? [...list, near] : [...list];
  const quoted = noteForPassage(spot.note);
  return {
    id: spot.id,
    stretches: [spot.stretch],
    landmark: near,
    // Named like every spot on the route, by where it is and its metres; her kind shows in its marker and the legend.
    name: {
      en: near ? `${cap(near)}, ${a} to ${b} m` : `${a} to ${b} m`,
      es: near ? `${cap(near)}, ${a} a ${b} m` : `${a} a ${b} m`,
    },
    description: `${words.sentence} between ${a} and ${b} m of the walk${near ? `, near ${near}` : ''}, recorded by the tour operator.${quoted ? ` The operator wrote: “${quoted}”.` : ''}`,
    aliases,
  };
}

/**
 * The place with her added spots after the authored ones. The order is stable, so the model
 * re-embeds only what her records changed.
 */
export function withEdits(place: RoutePlace, edits: Edits, locate: Locate): RoutePlace {
  if (!edits.added.length) return place;
  return { ...place, features: [...place.features, ...edits.added.map(spot => addedFeature(spot, locate))] };
}

/**
 * The visitor-facing line for a spot she has fixed, in the reader's language.
 * A recorded spot's subject maps onto a kind first: steps, kerb, and anything else is "other".
 */
export function fixedLine(kind: EditKind, where: Where, along: number, at: string, language: VisitorLang): string {
  return UPDATE.fixed[language](kind, where, round(along), recordDate(at, language));
}

/**
 * Her own words for the route note, verbatim in every language's note: they are her voice, nothing
 * translates them, and a visitor reading another language loses nothing by seeing them as she wrote them.
 */
export function ownNoteLines(note: OwnNote, _language?: VisitorLang): string[] {
  return note.text ? [note.text] : [];
}
