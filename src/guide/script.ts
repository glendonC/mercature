import type { UiLanguage } from '../site/contracts';
import type { EditKind } from '../edits/store';
import type { MarkKind } from '../ui/kinds';
import type { OsmLine } from '../destinations/copy';

/**
 * Everything the guide says, in English and Spanish: fixed lines with typed slots, and the labels of the choices she can tap.
 * The engine in src/guide decides which step comes next and fills the slots from the place's records and her own; nothing here
 * is generated, and the guide never writes free text. "Model" means only the AI.
 * Slots arrive ready for prose: place names carry their article, numbers are whole, phrases are in the line's language.
 */

/** The conversation's steps on the route screen. */
export const STEPS = ['hello', 'select', 'check', 'checkEnd', 'message', 'reply', 'insights', 'missed', 'around', 'street', 'note'] as const;
export type StepId = (typeof STEPS)[number];

/** What a thing on the tour route is, for the guide's question about it. Photo marks, OpenStreetMap tags and her own spots each map to one. */
export const ACCESS_KINDS = ['steps', 'kerb', 'uneven', 'steep', 'narrow', 'bollard', 'gate', 'noWheelchair', 'broken', 'works', 'obstacle', 'handrail', 'ramp', 'crossing', 'bench', 'toilets', 'lighting', 'unseen'] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];
/**
 * One question per kind and the answers stored under it. 'unknown' is in every list: she does not know, so the note tells visitors
 * to ask a person. 'unsure' is the follow-up's "I'm not sure" once she has said the thing is still there.
 */
export const QUESTIONS = {
  getPast: ['wayAround', 'handrail', 'help', 'noWay', 'notThere', 'unknown'],
  lowered: ['nearby', 'none', 'unsure', 'notThere', 'unknown'],
  smoother: ['nearby', 'none', 'unsure', 'unknown'],
  through: ['yes', 'no', 'unknown'],
  temporary: ['still', 'repaired', 'gone', 'unknown'],
  helpful: ['still', 'gone', 'unknown'],
  unseen: ['nothing', 'something', 'unknown'],
  /** A kind the photos show along much of the route, such as crossings: whether her route note mentions it. */
  mention: ['yes', 'no', 'unknown'],
} as const;
export type QuestionId = keyof typeof QUESTIONS;
export type AnswerOf<Q extends QuestionId> = (typeof QUESTIONS)[Q][number];
export type Answer = AnswerOf<QuestionId>;
export const QUESTION_OF: Record<AccessKind, QuestionId> = {
  steps: 'getPast', kerb: 'lowered', uneven: 'smoother', steep: 'smoother', narrow: 'through', bollard: 'through', gate: 'through', noWheelchair: 'through',
  broken: 'temporary', works: 'temporary', obstacle: 'temporary', handrail: 'helpful', ramp: 'helpful', crossing: 'helpful', bench: 'helpful', toilets: 'helpful', lighting: 'helpful', unseen: 'unseen',
};
/** Answers that need her tap on the map: where the step-free way, the lowered kerb or ramp, or the smoother street is. */
export const TAP_ANSWERS: ReadonlySet<string> = new Set(['wayAround', 'nearby']);
/**
 * A spot is asked about in at most two turns of three or four choices: the core question first (is it still there, or still like
 * this), then a follow-up only when the answer needs one. Every answer is stored under the kind's question in QUESTION_OF.
 */
export const GROUPS = ['presence', 'condition', 'temporary', 'helpful', 'unseen'] as const;
export type Group = (typeof GROUPS)[number];
export const GROUP_OF: Record<AccessKind, Group> = {
  steps: 'presence', kerb: 'presence', bollard: 'presence', gate: 'presence',
  uneven: 'condition', steep: 'condition', narrow: 'condition', noWheelchair: 'condition',
  broken: 'temporary', works: 'temporary', obstacle: 'temporary',
  handrail: 'helpful', ramp: 'helpful', crossing: 'helpful', bench: 'helpful', toilets: 'helpful', lighting: 'helpful',
  unseen: 'unseen',
};
/** The core question's answers, three per group. */
export const CORE = {
  presence: ['still', 'gone', 'unknown'],
  condition: ['still', 'gone', 'unknown'],
  temporary: ['still', 'repaired', 'unknown'],
  helpful: ['still', 'gone', 'unknown'],
  unseen: ['nothing', 'something', 'unknown'],
} as const;
export type CoreAnswer = (typeof CORE)[Group][number];
/** The follow-up after "Still there" for the kinds that need one, and its answers; the other kinds end with their core answer. */
export const FOLLOW_OF = { steps: 'getPast', kerb: 'lowered', uneven: 'smoother', steep: 'smoother', narrow: 'through', bollard: 'through', gate: 'through' } as const satisfies Partial<Record<AccessKind, QuestionId>>;
export type FollowKind = keyof typeof FOLLOW_OF;
export const FOLLOWS = {
  getPast: ['wayAround', 'handrail', 'help', 'noWay'],
  lowered: ['nearby', 'none', 'unsure'],
  smoother: ['nearby', 'none', 'unsure'],
  through: ['yes', 'no', 'unknown'],
} as const satisfies { [Q in (typeof FOLLOW_OF)[FollowKind]]: readonly AnswerOf<Q>[] };
/** What she can say something is, in two groups of four: something in the way, or something that helps. */
export const KIND_GROUPS = { blocks: ['steps', 'kerb', 'narrow', 'other'], helps: ['bench', 'toilet', 'ramp', 'handrail'] } as const satisfies Record<string, readonly EditKind[]>;
export type KindGroup = keyof typeof KIND_GROUPS;
/** What a model outlined at a flagged spot, in the words a visitor knows. */
export type Subject = 'steps' | 'kerb' | 'path';

/** The route, for the greeting, the overview and the reveal. */
export type WalkSlots = {
  /** The place's name, such as "Qorikancha". */
  place: string;
  /** Where the route starts and ends, such as "the Plaza de Armas". */
  start: string;
  target: string;
  metres: number;
  /** Street photos along the route. */
  photos: number;
  /** Everything a model outlined in those photos near the route. */
  marks: number;
  /** Outlines that might be a barrier, and the spots they fall on. */
  barriers: number;
  spots: number;
  /** Visitor messages waiting. */
  messages: number;
  /** Things OpenStreetMap lists along a route for which no street photo was read. */
  osm: number;
};
/** One item of the route check, or the spot she selected. */
export type ItemSlots = {
  /** Its place in the check, from 1. */
  n: number;
  total: number;
  /** What is there, from words.access, such as "steps". */
  what: string;
  /** Where on the route, such as "on Calle Loreto". */
  where: string;
  /** Metres from the start. */
  metres: number;
  /** Photos that show it. */
  photos: number;
  /** Month and year of the newest photo of it, "" when none. */
  when: string;
  /** What OpenStreetMap records there, ready as a phrase such as "5 steps, no handrail, no ramp", "" when nothing. */
  osm: string;
};
/** Another kind a model marked near the route, counted, such as "45 kerbs" from words.marks. */
export type KindSlots = { n: number; total: number; what: string; count: number };
/** What visitors keep raising at one spot, from the model's reading of their messages: the spot, how many, and what is there, such as "steps". */
export type InsightSlots = { spot: string; count: number; kind: string };
/** Her answers once the check is through: answered, "I don't know", and passed over. */
export type TallySlots = { total: number; answered: number; unknown: number; skipped: number };
/** A visitor message. language is a name from words.languages. */
export type MessageSlots = { n: number; total: number; language: string };
/** A spot as words, such as "the steps on Calle Loreto" or "Calle Loreto, 340 to 350 m". */
export type SpotSlots = { spot: string };
/** Something she says the photos missed: a kind from words.added and where, such as "a kerb" and "near the Iglesia de Santo Domingo". */
export type ProposeSlots = { kind: string; where: string };

export type Script = {
  /** Words the slots are made of. */
  words: {
    subjects: Record<Subject, string>;
    /** What a thing is inside a line, for ItemSlots.what, such as "steps", "a kerb", "uneven ground". */
    access: Record<AccessKind, string>;
    /** Who it affects, one short line under the main line. */
    affects: Record<AccessKind, string>;
    /** A count of one kind of mark, such as (45) => "45 kerbs". */
    marks: Record<MarkKind, (count: number) => string>;
    /** What OpenStreetMap shows along a route from the map alone, by kind and value, inside check.osmKind, such as "steps with no handrail". */
    osm: Record<OsmLine, string>;
    /** Who parts with no street lights affect, and who lowered kerbs help. */
    affectsDark: string; affectsLowered: string;
    /** The kinds she can give a spot, as chips. */
    kinds: Record<EditKind, string>;
    /** The same kinds inside a line, such as "a kerb". */
    added: Record<EditKind, string>;
    /** The two groups of kinds, as chips before the kinds themselves: something in the way, something that helps. */
    groups: Record<KindGroup, string>;
    /** Message languages by code: en, es, ko, qu, other. */
    languages: Record<string, string>;
  };
  /** On Home, before a place is open. */
  home: { greet: string; search: string; open: (s: { place: string }) => string };
  /** While the route's records replay: a greeting, then one line per beat. */
  reveal: { hello: (s: WalkSlots) => string; photos: (s: WalkSlots) => string; areas: (s: WalkSlots) => string; walk: (s: WalkSlots) => string; reading: (s: WalkSlots) => string; marks: (s: WalkSlots) => string };
  hello: {
    greet: (s: WalkSlots) => string;
    /** The route in one or two lines: its length, its photos, what was found, how much might stop someone. */
    walk: (s: WalkSlots) => string;
    /** The same for a route built from OpenStreetMap alone, before any street photo is read. */
    mapOnly: (s: WalkSlots) => string;
    altitude: (s: { metres: number }) => string;
    /** The route once she has answered for some spots: how many are still to check. total is the number of spots. */
    checked: (s: { metres: number; left: number; total: number }) => string;
    chips: { check: string; messages: string; missed: string; note: string };
  };
  /** Whatever she selects becomes the subject: the route as a whole, a spot, an outline on a photo, a street. next says what she can do. */
  select: {
    /** A spot she answered before, opened again: her answer, as the chip she tapped. */
    answered: (s: { answer: string }) => string;
    overview: (s: WalkSlots) => string; spot: (s: ItemSlots) => string; outline: (s: ItemSlots) => string; street: (s: { street: string }) => string; next: string };
  check: {
    progress: (s: { n: number; total: number }) => string;
    /** Which photo of a spot shows, when more than one does. */
    photo: (s: { n: number; total: number }) => string;
    /** A flagged spot: what a model outlined there when the route was recorded. */
    saw: (s: ItemSlots) => string;
    sawWhen: (s: ItemSlots) => string;
    /** A stretch no photo shows. */
    noPhotos: (s: ItemSlots) => string;
    /** Another kind near the route. */
    kind: (s: KindSlots) => string;
    /** On a route with no street photos read: what OpenStreetMap records there. */
    osm: (s: ItemSlots) => string;
    /** On such a route, one kind OpenStreetMap shows along it, from words.osm, and in how many places. */
    osmKind: (s: { what: string; places: number }) => string;
    /** What OpenStreetMap adds about a spot the photos show. */
    osmToo: (s: ItemSlots) => string;
    /** Where the photo would be, on such a route. */
    noStreetPhotos: string;
    /** The core question about a spot, by its kind: is it still there, or still like this. */
    core: Record<AccessKind, string>;
    /** The core answers as chips. Spanish agrees with the kind, such as "Siguen ahí" for steps. */
    coreAnswers: { [G in Group]: (kind: AccessKind) => Record<(typeof CORE)[G][number], string> };
    /** Said after a core answer that ends the item. */
    coreSaid: { gone: string; notAnymore: string; repaired: string; stillPresence: string; stillHelpful: string; goneHelpful: string; nothing: string; unknown: string };
    /** The follow-up after "Still there", by kind; for a part with no photos, after "There's something", what it is. Said lines are said[question]. */
    follow: Record<FollowKind | 'unseen', string>;
    ask: Record<QuestionId, (s: ItemSlots) => string>;
    /** The answers as chips. */
    answers: { [Q in QuestionId]: Record<AnswerOf<Q>, string> };
    /** Each answer said back after her tap. */
    said: { [Q in QuestionId]: Record<AnswerOf<Q>, (s: ItemSlots) => string> };
    /** For an answer that needs a place on the map. */
    tapWhere: (s: ItemSlots) => string;
    chips: { next: string; skip: string };
    /** Said alone once every spot is checked, before the parts with no photos and the kinds along the route, which have no counter. */
    extras: string;
    /** Her own words about the item, read by the model, offered back as a note on the spot it found. */
    words: (s: SpotSlots) => string;
    noted: (s: SpotSlots) => string;
    end: (s: TallySlots) => string;
  };
  /** The way around the mapped steps that OpenStreetMap's router suggests. metres: how much longer than the route. */
  around: { offer: (s: { metres: number }) => string; show: string; ask: string; kept: string; dropped: string; unchecked: string; none: string; offline: string;
    /** OpenStreetMap shows no steps on the route, so there is nothing to go around. */
    same: string;
    chips: { show: string; works: string; notWorks: string; unknown: string; better: string; notNow: string };
    /** After "There's a way around" at steps OpenStreetMap has one for, shown on the map: is hers the same? */
    isThisIt: string; isThisItChips: { yes: string; no: string };
    /** After "No way around" or "I'm not sure" there: offer, then these. */
    offerChips: { show: string; notNow: string };
    /** The map control that shows or hides the way around; not an answer. */
    mapToggle: string;
    /** After "No way around" or "I'm not sure" at steps whose only way around is too long to offer. */
    long: string };
  /** Another street she adds: she taps its start and end, and it is routed on foot. */
  street: { offer: string; start: string; end: string; routing: string; found: (s: { metres: number; osm: number }) => string; kept: (s: { street: string }) => string; failed: string; offline: string;
    busy: string; tooFar: string; tooLong: string; removed: (s: { street: string }) => string;
    chips: { add: string; keep: string; again: string; cancel: string; remove: string } };
  /** Asked once per route; yes asks her to tap the place, then the 'through' question. */
  narrow: { ask: string; chips: { yes: string; no: string; unknown: string } };
  messages: {
    /** How many visitors wrote; none says there is nothing to answer. */
    intro: (s: { total: number }) => string;
    none: string;
    /** A message arrives; its words show below the line. */
    arrived: (s: MessageSlots) => string;
    /** The model's spot, before she confirms it. */
    spot: (s: SpotSlots) => string;
    remembered: (s: SpotSlots) => string;
    earlier: (s: SpotSlots) => string;
    unsure: string;
    noSpot: string;
    unplaced: string;
    /** A message in a script the model cannot read, such as Georgian or Russian: no spot is offered. */
    unreadable: string;
    tap: string;
    filed: (s: SpotSlots) => string;
    /** Said once her tap has taught the model where messages like this go. */
    learned: string;
    /** Tags on a message that is not a real visitor's, or not in its writer's words. */
    example: string;
    translated: string;
    /** Pasting a message that just came in. */
    paste: string;
    read: string;
    chips: { yes: string; another: string; noSpot: string; next: string; skip: string; paste: string;
      /** Nobody could place the message: the reply asks the visitor where it was. */
      askWhere: string };
  };
  reply: {
    say: (s: MessageSlots) => string;
    /** No reply in the visitor's language: which one is shown instead. */
    fallback: (s: { language: string; reply: string }) => string;
    copy: string;
    copied: string;
  };
  /** After the messages: what visitors keep returning to, wish had been different, or praise, spot by spot. */
  insights: {
    intro: string;
    problem: (s: InsightSlots) => string;
    praise: (s: InsightSlots) => string;
    question: (s: InsightSlots) => string;
    none: string;
    chips: { open: string; next: string };
  };
  /** Under a photo: whether she has checked what it shows. date is the day of her answer, such as "4 October". */
  photo: { unchecked: string; checked: (s: { date: string }) => string; removed: string };
  model: {
    /** The model is not on this device yet: one download, then it works offline. */
    download: (s: { mb: number }) => string;
    downloadChip: (s: { mb: number }) => string;
    withoutChip: string;
    downloading: (s: { done: number; total: number }) => string;
    reading: string;
    notKept: string;
    stopped: string;
    failed: string;
    tryAgain: string;
    /** The app was updated while open, so the model's code is gone until it opens again; her changes stay on the device. */
    outdated: string;
    reload: string;
  };
  missed: {
    ask: string;
    /** What she said, read by the model, offered back before it goes on her map. */
    propose: (s: ProposeSlots) => string;
    kindAsk: string;
    /** She tapped a spot on the map: what is there? The kind chips follow. */
    here: (s: SpotSlots) => string;
    /** The model found where her words are about, but they name no kind: what is it? where carries its preposition, such as "near the Santa Catalina monastery". */
    found: (s: { where: string }) => string;
    notFound: string;
    added: (s: ProposeSlots) => string;
    chips: { yes: string; no: string; done: string };
  };
  note: {
    say: string;
    empty: string;
    copy: string;
    copied: string;
  };
  input: { placeholder: string; send: string };
  /** Clearing everything she did on this place, after she confirms. */
  restart: { chip: string; ask: string; yes: string; no: string };
  back: string;
  /** Her map before her changes and now, side by side in time; the said lines come when she turns between them. */
  compare: { label: string; before: string; now: string; saidBefore: string; saidNow: string };
  /** One tap away on every step: what she wants to change on her map, while the step she was on waits for her. */
  edit: { chip: string;
    /** The pill while she edits; a tap ends the mode, and closed is said on the way back. */
    done: string; closed: string;
    /** Said on entering, before ask: why her changes matter. */
    intro: string; ask: string;
    /** Adding a spot, in two lines: what the photos (or, with none, the map) may have missed, then where. */
    addSpot: string; addSpotMapped: string; addSpotTap: string; changeSpot: string; note: string; noteSaved: string;
    /** What each change does to what visitors read: the note line it made, a line it took out, or nothing new. */
    result: (s: { line: string }) => string; removed: string; unchanged: string;
    chips: { addSpot: string; changeSpot: string; addStreet: string; note: string; back: string; changes: string } };
  /** Every change she made, one row each, with Undo. A row about a spot starts with its marker's label, such as "Steps · 340 m". */
  changes: { intro: string; none: string; undo: string; undone: string; note: string; added: (s: { kind: string; at: string }) => string; street: (s: { street: string }) => string;
    takenOff: (s: { tag: string }) => string; around: { works: string; notWorks: string } };
  /** The screen reader's name for the mark that turns to the next page of a line. */
  more: string;
  notSaved: string;
};

const cap = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
/** Rounded the way the guide and the route note say a distance: 594 m becomes 600. */
export const about = (m: number) => m < 100 ? Math.max(10, Math.round(m / 10) * 10) : m < 1000 ? Math.round(m / 50) * 50 : Math.round(m / 100) * 100;
/** A distance as a person says it: metres under 1 km ("600 m"), then kilometres to one decimal ("2.4 km", "1 km"). */
const dist_en = (m: number) => m < 950 ? `${about(m)} m` : `${(Math.round(m / 100) / 10).toLocaleString('en')} km`;
const dist_es = (m: number) => m < 950 ? `${about(m)} m` : `${(Math.round(m / 100) / 10).toLocaleString('es')} km`;
/** The year of a photo's month and year, such as "December 2015". */
const yearOf = (when: string) => Number(when.slice(-4)) || 0;
/** A photo older than this may show a street that has changed since. */
const isOld = (when: string) => yearOf(when) > 0 && yearOf(when) < 2020;
const ONES_EN = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** Small numbers in words, bigger ones in digits, as people write them. */
const n_en = (n: number) => n <= 10 ? ONES_EN[n] : String(n);
const count_en = (n: number, one: string, many: string) => `${n_en(n)} ${n === 1 ? one : many}`;
/** How often the photos show something, without reading out a count. */
const places_en = (n: number) => n === 1 ? 'in one place' : n <= 4 ? 'in a few places' : n <= 15 ? 'in quite a few places' : 'in lots of places';
const ONES_ES = ['ningún', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const ONES_ES_F = ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const count_es = (n: number, one: string, many: string, feminine = false) => `${n <= 10 ? (feminine ? ONES_ES_F : ONES_ES)[n] : n} ${n === 1 ? one : many}`;
const places_es = (n: number) => n === 1 ? 'en un lugar' : n <= 4 ? 'en algunos lugares' : n <= 15 ? 'en varios lugares' : 'en muchos lugares';
/** "de" before a slot that starts with "el" contracts to "del": habla del bordillo, never de el bordillo. */
const de = (x: string) => /^el /.test(x) ? `del ${x.slice(3)}` : `de ${x}`;
const ASK_EN = 'That’s fine. Your note asks visitors to check with you.';
const ASK_ES = 'No pasa nada. Tu nota les pide a los visitantes que te consulten.';
/** Kinds whose Spanish words are plural, so the answers agree: "Siguen ahí" for escalones. */
const PLURAL_ES: ReadonlySet<AccessKind> = new Set(['steps', 'works', 'toilets', 'lighting']);

const en: Script = {
  words: {
    subjects: { steps: 'steps', kerb: 'a kerb with no ramp in view', path: 'something on the path' },
    access: {
      steps: 'steps', kerb: 'a kerb', uneven: 'uneven ground', steep: 'a steep part', narrow: 'a narrow place', bollard: 'a post or bollard', gate: 'a gate', noWheelchair: 'a place with no wheelchair access',
      broken: 'broken paving', works: 'roadworks', obstacle: 'something in the way', handrail: 'a handrail', ramp: 'a ramp', crossing: 'a crossing', bench: 'a bench', toilets: 'toilets', lighting: 'street lights', unseen: 'a part with no photos',
    },
    affects: {
      steps: 'If there are steps here, they can be hard for wheelchair users, strollers and walkers.',
      kerb: 'If there’s a kerb here, it can be hard for wheelchair users and strollers.',
      uneven: 'If the ground is uneven here, it’s tough on wheels, canes and walkers.',
      steep: 'If it’s steep here, it’s hard for wheelchairs, strollers and anyone out of breath.',
      narrow: 'If it’s narrow here, a wheelchair or a stroller may not get through.',
      bollard: 'If there’s a post here, it can block a wheelchair or trip someone who can’t see well.',
      gate: 'If there’s a gate here and it’s closed, it can stop a wheelchair or a stroller.',
      noWheelchair: 'If that’s right, it matters most to wheelchair users.',
      broken: 'If the paving is broken here, it’s easy to trip on with a cane or poor eyesight.',
      works: 'If there are works here, they can block the way for a while.',
      obstacle: 'If something’s in the way here, it can block a wheelchair or trip someone.',
      handrail: 'If there’s a handrail here, it helps older visitors and anyone unsteady on steps.',
      ramp: 'If there’s a ramp here, it helps wheelchair users and strollers.',
      crossing: 'If visitors cross traffic here, it’s harder for slow walkers and people who can’t see well.',
      bench: 'If there’s a bench here, it gives older or tired visitors a rest.',
      toilets: 'If there are toilets here, families and older visitors plan around them.',
      lighting: 'If there are lights here, they help people who can’t see well after dark.',
      unseen: 'Nobody knows yet what visitors will find here.',
    },
    marks: {
      steps: n => `steps ${places_en(n)}`, kerb: n => `kerbs ${places_en(n)}`, broken: n => `broken paving ${places_en(n)}`,
      crossing: n => `crossings ${places_en(n)}`, bollard: n => `posts or bollards ${places_en(n)}`, footway: n => `pavement ${places_en(n)}`,
      cobblestones: n => `cobblestones ${places_en(n)}`, road: n => `the road ${places_en(n)}`,
    },
    osm: {
      bench: 'benches', toilets: 'toilets', crossing: 'road crossings', handrail: 'steps with a handrail', noHandrail: 'steps with no handrail', ramp: 'ramps', noRamp: 'steps with no ramp',
      lit: 'street lights', unlit: 'parts with no street lights', wheelchairNo: 'places marked not for wheelchairs', wheelchairLimited: 'places marked limited for wheelchairs',
      cobbles: 'cobblestones', loose: 'loose or unpaved ground', kerbLowered: 'lowered kerbs', kerbRaised: 'high kerbs',
    },
    affectsDark: 'Harder for people who can’t see well after dark.', affectsLowered: 'If there are lowered kerbs here, they help wheelchair users and strollers cross.',
    kinds: { steps: 'Steps', kerb: 'Kerb', narrow: 'Narrow place', other: 'Something else', bench: 'Bench', toilet: 'Toilet', ramp: 'Ramp', handrail: 'Handrail' },
    added: { steps: 'steps', kerb: 'a kerb', narrow: 'a narrow place', other: 'something in the way', bench: 'a bench', toilet: 'a toilet', ramp: 'a ramp', handrail: 'a handrail' },
    groups: { blocks: 'Something in the way', helps: 'Something that helps' },
    languages: { en: 'English', es: 'Spanish', ko: 'Korean', qu: 'Quechua', other: 'another language' },
  },
  home: {
    greet: 'Here you see what on a tour route might stop a visitor, such as steps. You can check it and answer visitors’ messages about it. Open a route below or type a place.',
    search: 'A square, a landmark or a street',
    open: s => `Open ${s.place}`,
  },
  reveal: {
    hello: s => `Hi. This is the tour route to ${s.target}.`,
    photos: s => s.photos ? 'First, the street photos people shared along it.' : 'This route comes from the map.',
    walk: s => `This is the route, about ${dist_en(s.metres)} on foot.`,
    reading: () => 'And this is what the photos show.',
    areas: () => 'And here’s the street around it, in 3D.',
    marks: s => s.spots === 0 ? 'Nothing in the photos looks like a problem.' : `${cap(count_en(s.spots, 'spot', 'spots'))} might be a problem for some visitors.`,
  },
  hello: {
    greet: () => 'Let’s go through this tour route together.',
    walk: s => s.spots === 0 ? `It’s about ${dist_en(s.metres)}, and nothing looks like a problem.` : `It’s about ${dist_en(s.metres)}, with ${count_en(s.spots, 'spot', 'spots')} that might give visitors trouble.`,
    mapOnly: s => s.osm ? `It’s about ${dist_en(s.metres)} on foot. OpenStreetMap shows ${count_en(s.osm, 'thing', 'things')} to check.` : `It’s about ${dist_en(s.metres)} on foot. Tell me what visitors meet on the way.`,
    altitude: s => `It’s about ${s.metres.toLocaleString('en')} m up here, so walking tires visitors faster.`,
    checked: s => s.left === 0 ? `It’s about ${dist_en(s.metres)}, and you’ve checked every spot.` : s.left === 1 ? `It’s about ${dist_en(s.metres)}. One spot still to check.` : `It’s about ${dist_en(s.metres)}. ${cap(count_en(s.left, 'spot', 'spots'))} still to check.`,
    chips: { check: 'Go through the route', messages: 'Read messages', missed: 'Add something I know', note: 'See the route note' },
  },
  select: {
    answered: s => `You said: ${s.answer}. Change it?`,
    overview: () => 'The whole route. Tap any spot or street to look closer.',
    spot: s => `${cap(s.what)} ${s.where}, ${s.metres < 10 ? 'right at the start' : `about ${dist_en(s.metres)} in`}.`,
    outline: s => `That looks like ${s.what}${yearOf(s.when) ? `, in a ${yearOf(s.when)} photo` : ''}.`,
    street: s => `${s.street} isn’t on this route yet. Add it?`,
    next: 'Tap a spot or a street to look closer.',
  },
  check: {
    progress: s => `${s.n} of ${s.total}`,
    photo: s => `Photo ${s.n} of ${s.total}`,
    saw: s => `There might be ${s.what} here, ${s.where}.`,
    sawWhen: s => isOld(s.when) ? `There might be ${s.what} ${s.where}, but the photo’s from ${yearOf(s.when)}.` : `There might be ${s.what} here, ${s.where}.`,
    noPhotos: s => `There are no photos of this part, ${s.where}.`,
    kind: s => `The photos also show ${s.what}.`,
    osm: s => `OpenStreetMap shows ${s.what} here, ${s.where}.`,
    osmKind: s => `OpenStreetMap shows ${s.what} ${places_en(s.places)} along the route.`,
    osmToo: s => `OpenStreetMap adds: ${s.osm}.`,
    noStreetPhotos: 'From the map',
    core: {
      steps: 'Are these steps still there?', kerb: 'Is this kerb still there?', bollard: 'Is the post still there?', gate: 'Is the gate still there?',
      uneven: 'Is the ground still uneven here?', steep: 'Is it still steep here?', narrow: 'Is it still narrow here?', noWheelchair: 'Is that still right?',
      broken: 'Is the paving still broken?', works: 'Are the works still there?', obstacle: 'Is it still in the way?',
      handrail: 'Is the handrail still there?', ramp: 'Is the ramp still there?', crossing: 'Is the crossing still there?', bench: 'Is the bench still there?', toilets: 'Are the toilets still there?', lighting: 'Are the lights still there?',
      unseen: 'Do you know what’s here?',
    },
    coreAnswers: {
      presence: () => ({ still: 'Still there', gone: 'Not there now', unknown: 'I’m not sure' }),
      condition: () => ({ still: 'Yes, still', gone: 'Not anymore', unknown: 'I’m not sure' }),
      temporary: () => ({ still: 'Still there', repaired: 'Fixed now', unknown: 'I’m not sure' }),
      helpful: () => ({ still: 'Still there', gone: 'Gone', unknown: 'I’m not sure' }),
      unseen: () => ({ nothing: 'Nothing in the way', something: 'There’s something', unknown: 'I’m not sure' }),
    },
    coreSaid: {
      gone: 'Thanks. I’ve taken it off your map.', notAnymore: 'Good. I’ve taken it off your map.', repaired: 'Good news. I’ve marked it fixed today.',
      stillPresence: 'Okay, it stays on your map.', stillHelpful: 'Good. It’s in your note.', goneHelpful: 'Okay, I’ve taken it out of your note.',
      nothing: 'Got it. Your note says nothing’s in the way, from what you know.', unknown: ASK_EN,
    },
    follow: {
      steps: 'How do visitors get past them?', kerb: 'Is there a lowered kerb or a ramp nearby?', uneven: 'Is there a smoother way nearby?', steep: 'Is there an easier way nearby?',
      narrow: 'Can a wheelchair or a stroller get through?', bollard: 'Can a wheelchair or a stroller get past it?', gate: 'Can a wheelchair or a stroller get through it?',
      unseen: 'What is it?',
    },
    ask: {
      getPast: () => 'How do your visitors get past these steps?',
      lowered: () => 'Is there a lowered kerb or a ramp nearby?',
      smoother: () => 'Is there a smoother way nearby?',
      through: () => 'Can a wheelchair or a stroller get through?',
      temporary: () => 'Is it still there?',
      helpful: () => 'Is it still there?',
      unseen: () => 'Do you know what’s here?',
      mention: () => 'Mention this in your route note?',
    },
    answers: {
      getPast: { wayAround: 'There’s a way around', handrail: 'There’s a handrail', help: 'We help them', noWay: 'No way around', notThere: 'There are no steps', unknown: 'I’m not sure' },
      lowered: { nearby: 'Yes, nearby', none: 'No', unsure: 'I’m not sure', notThere: 'There’s no kerb', unknown: 'I’m not sure' },
      smoother: { nearby: 'Yes, nearby', none: 'No', unsure: 'I’m not sure', unknown: 'I’m not sure' },
      through: { yes: 'Yes, it gets through', no: 'No, it can’t', unknown: 'I’m not sure' },
      temporary: { still: 'Still there', repaired: 'It’s been fixed', gone: 'It’s gone', unknown: 'I’m not sure' },
      helpful: { still: 'Still there', gone: 'It’s gone', unknown: 'I’m not sure' },
      unseen: { nothing: 'Nothing in the way', something: 'There’s something here', unknown: 'I’m not sure' },
      mention: { yes: 'Yes, mention it', no: 'Leave it out', unknown: 'I’m not sure' },
    },
    said: {
      getPast: {
        wayAround: () => 'Got it. Your note now mentions the way around.',
        handrail: () => 'Got it. Your note now mentions the handrail.',
        help: () => 'Got it. Your note says you help visitors here.',
        noWay: () => 'Okay. Your note says there’s no way around.',
        notThere: () => 'Thanks. I’ve taken it off your map.',
        unknown: () => ASK_EN,
      },
      lowered: {
        nearby: () => 'Got it. I’ve marked where it is.',
        none: () => 'Okay. Your note says there’s no ramp nearby.',
        unsure: () => ASK_EN,
        notThere: () => 'Thanks. I’ve taken it off your map.',
        unknown: () => ASK_EN,
      },
      smoother: {
        nearby: () => 'Got it. I’ve marked the smoother way.',
        none: () => 'Okay. Your note says there’s no smoother way.',
        unsure: () => ASK_EN,
        unknown: () => ASK_EN,
      },
      through: {
        yes: () => 'Got it. Your note says it gets through, from what you know.',
        no: () => 'Got it. Your note says it can’t get through, from what you know.',
        unknown: () => ASK_EN,
      },
      temporary: {
        still: () => 'Okay, it stays on your map.',
        repaired: () => 'Good news. I’ve marked it fixed today.',
        gone: () => 'Good. I’ve marked it gone today.',
        unknown: () => ASK_EN,
      },
      helpful: {
        still: () => 'Good. It’s in your note.',
        gone: () => 'Okay, I’ve taken it out of your note.',
        unknown: () => 'That’s fine. I’ll leave it out for now.',
      },
      mention: { yes: () => 'Done. Your note mentions it.', no: () => 'Okay, I’ve left it out.', unknown: () => 'That’s fine. I’ll leave it out for now.' },
      unseen: {
        nothing: () => 'Got it. Your note says nothing’s in the way, from what you know.',
        something: () => 'What’s there?',
        unknown: () => ASK_EN,
      },
    },
    tapWhere: () => 'Show me where on the map.',
    chips: { next: 'Next', skip: 'Skip for now' },
    extras: 'That’s every spot. Now a few things along the route.',
    words: s => `Add that as your note on ${s.spot}?`,
    noted: () => 'Done. Visitors will see your note, in your words.',
    end: s => s.skipped ? 'That’s the route. You can come back to the ones you skipped.' : 'That’s the whole route. Thanks for going through it.',
  },
  around: {
    offer: s => `OpenStreetMap suggests a way around, about ${dist_en(s.metres)} longer.`,
    show: 'Here it is. Nobody has checked it yet.',
    ask: 'Would it work for visitors who can’t manage steps?',
    kept: 'Good. Replies and your note can offer it now.',
    dropped: 'Okay, I won’t suggest it.',
    unchecked: 'Okay. I won’t suggest it until you’ve checked it.',
    none: 'OpenStreetMap doesn’t know a way around these steps.',
    offline: 'I need internet to look for a way around.',
    same: 'OpenStreetMap doesn’t show any steps on this route, so there’s nothing to go around.',
    chips: { show: 'Show the way around', works: 'It works', notWorks: 'It doesn’t work', unknown: 'I’m not sure', better: 'I know a better way', notNow: 'Not now' },
    isThisIt: 'Is it this one, the way OpenStreetMap suggests?', isThisItChips: { yes: 'Yes, that one', no: 'No, another way' },
    offerChips: { show: 'Show me', notNow: 'Not now' },
    mapToggle: 'Way around',
    long: 'OpenStreetMap doesn’t show a short way around these steps.',
  },
  street: {
    offer: 'Do visitors use other streets too? You can add one.',
    start: 'Tap where the street starts.',
    end: 'Now tap where it ends.',
    routing: 'Finding the way on foot…',
    found: s => `About ${dist_en(s.metres)} on foot, from the map. Keep it?`,
    kept: s => `Added ${s.street} to your map.`,
    failed: 'I couldn’t find a way on foot there. Try other points.',
    offline: 'I need internet to add a street.',
    busy: 'The map service is busy right now. Try again in a minute.',
    tooFar: 'That’s a bit far from the route. Tap closer to it.',
    tooLong: 'That’s a long way. Try a shorter street.',
    removed: s => `Took ${s.street} off your map.`,
    chips: { add: 'Add a street', keep: 'Keep this street', again: 'Try again', cancel: 'Cancel', remove: 'Remove this street' },
  },
  narrow: { ask: 'Is there a narrow place anywhere on this route?', chips: { yes: 'Yes, I’ll show you', no: 'No narrow places', unknown: 'I’m not sure' } },
  messages: {
    intro: s => s.total === 1 ? 'A visitor wrote to you about this route.' : `${cap(n_en(s.total))} visitors wrote to you about this route.`,
    none: 'No messages yet. Paste one when it comes in.',
    arrived: s => `This one’s in ${s.language}.`,
    spot: s => `I think it’s about ${s.spot}. Right?`,
    remembered: s => `You put one like this on ${s.spot} before.`,
    earlier: s => `Earlier, I thought this was about ${s.spot}.`,
    unsure: 'I’m not sure which spot they mean. Is it one of these?',
    noSpot: 'This one isn’t about one spot on the route.',
    unplaced: 'I can’t tell where this is. Ask the visitor, or tap it.',
    unreadable: 'I can’t read this language yet. Tap the spot on the map, or ask the visitor.',
    tap: 'Tap the spot on the map.',
    filed: s => `Done. It’s on ${s.spot}.`,
    learned: 'Next time, I’ll suggest that spot for messages like it.',
    example: 'Example',
    translated: 'Machine-translated',
    paste: 'Paste what the visitor wrote',
    read: 'Read it',
    chips: { yes: 'Yes, that spot', another: 'No, another spot', noSpot: 'Not about a spot', next: 'Next message', skip: 'Later', paste: 'Paste a message', askWhere: 'Ask them where' },
  },
  reply: {
    say: s => `Here’s a reply in ${s.language}. Copy it when you’re ready.`,
    fallback: s => `No ${s.language} replies yet, so here it is in ${s.reply}.`,
    copy: 'Copy',
    copied: 'Copied',
  },
  insights: {
    intro: 'Here’s what visitors keep bringing up.',
    problem: s => `${s.count === 1 ? 'One visitor' : `${cap(n_en(s.count))} visitors`} had a problem at ${s.spot}.`,
    praise: s => `${s.count === 1 ? 'One visitor' : `${cap(n_en(s.count))} visitors`} liked ${s.spot}.`,
    question: s => `${s.count === 1 ? 'One visitor' : `${cap(n_en(s.count))} visitors`} asked about ${s.spot}.`,
    none: 'Nothing’s come up more than once yet.',
    chips: { open: 'Show me', next: 'Next' },
  },
  photo: { unchecked: 'Not checked yet', checked: s => `You checked this on ${s.date}`, removed: 'You took this off your map' },
  model: {
    download: s => `I need a one-time ${s.mb} MB download to read messages offline.`,
    downloadChip: s => `Download ${s.mb} MB`,
    withoutChip: 'I’ll place it myself',
    downloading: s => `Downloading… ${s.done} of ${s.total} MB`,
    reading: 'Reading it…',
    notKept: 'This device couldn’t keep the download. Place it yourself.',
    stopped: 'The download stopped. Try again, or place it yourself.',
    failed: 'Something went wrong here. You can place it yourself.',
    tryAgain: 'Try again',
    outdated: 'The app was updated. Open it again to read messages; your changes are kept.',
    reload: 'Open again',
  },
  missed: {
    ask: 'Did the photos miss anything? Tell me, or tap the spot.',
    propose: s => `So, ${s.kind} ${s.where}. Add it?`,
    kindAsk: 'What’s there?',
    here: s => `What’s at ${s.spot}?`,
    found: s => `Got it, ${s.where}. What is it?`,
    notFound: 'I couldn’t tell where. Can you tap it on the map?',
    added: s => `Added ${s.kind} ${s.where}.`,
    chips: { yes: 'Add it', no: 'Not quite', done: 'That’s all' },
  },
  note: {
    say: 'Here’s your route note for visitors.',
    empty: 'Nothing to tell visitors yet.',
    copy: 'Copy',
    copied: 'Copied',
  },
  input: { placeholder: 'Type in your own words', send: 'Send' },
  restart: { chip: 'Start over', ask: 'Clear everything you’ve done on this route?', yes: 'Clear it', no: 'Keep it' },
  back: 'Back',
  compare: { label: 'Your map', before: 'Before', now: 'Now', saidBefore: 'This is the route before your changes.', saidNow: 'This is the route with your changes.' },
  edit: {
    chip: 'Edit', done: 'Done', closed: 'Done. Your route note is up to date.', intro: 'Edits here change what visitors read in your route note and your replies.', ask: 'What would you like to change?',
    addSpot: 'Did the photos miss something new or temporary, like a broken step, a bench or roadworks?', addSpotMapped: 'Is there something the map misses, new or temporary, like a broken step, a bench or roadworks?', addSpotTap: 'Tap where it is on the map, or tell me in your own words.', changeSpot: 'Tap the spot you want to change.',
    result: s => `Visitors will now read: “${s.line}”`, removed: 'Visitors won’t read about this spot anymore.', unchanged: 'Your route note stays the same.',
    note: 'What should your note say? Write it in your own words.', noteSaved: 'Saved. Visitors will see it in your words.',
    chips: { addSpot: 'Add a spot', changeSpot: 'Change a spot', addStreet: 'Add a street', note: 'Change my note', back: 'Back to where I was', changes: 'Your changes' },
  },
  changes: {
    intro: 'Here’s what you changed. Tap one to see it.', none: 'You haven’t changed anything yet.', undo: 'Undo', undone: 'Undone. Your map is back as it was.', note: 'Your note',
    added: s => `Added ${s.kind} · ${s.at}`, street: s => `Added street · ${s.street}`, takenOff: s => `${s.tag}: taken off your map`, around: { works: 'Way around: works', notWorks: 'Way around: doesn’t work' },
  },
  more: 'More',
  notSaved: 'That change didn’t save on this device.',
};

const es: Script = {
  words: {
    subjects: { steps: 'escalones', kerb: 'un bordillo sin rampa visible', path: 'algo en el camino' },
    access: {
      steps: 'escalones', kerb: 'un bordillo', uneven: 'suelo disparejo', steep: 'una subida empinada', narrow: 'un paso angosto', bollard: 'un poste o bolardo', gate: 'un portón', noWheelchair: 'un lugar sin acceso en silla de ruedas',
      broken: 'acera rota', works: 'obras', obstacle: 'algo que estorba', handrail: 'un pasamanos', ramp: 'una rampa', crossing: 'un cruce peatonal', bench: 'una banca', toilets: 'baños', lighting: 'alumbrado', unseen: 'una parte sin fotos',
    },
    affects: {
      steps: 'Si hay escalones aquí, pueden ser difíciles en silla de ruedas, con coche de bebé o andador.',
      kerb: 'Si hay un bordillo aquí, puede ser difícil en silla de ruedas o con coche de bebé.',
      uneven: 'Si el suelo está disparejo aquí, cuesta con ruedas, bastón o andador.',
      steep: 'Si aquí es empinado, cuesta en silla de ruedas, con coche de bebé o a quien se agita.',
      narrow: 'Si aquí es angosto, puede que no pase una silla de ruedas o un coche de bebé.',
      bollard: 'Si hay un poste aquí, puede frenar una silla de ruedas o hacer tropezar a quien ve poco.',
      gate: 'Si hay un portón aquí y está cerrado, puede frenar una silla de ruedas o un coche de bebé.',
      noWheelchair: 'Si es así, importa sobre todo a quien usa silla de ruedas.',
      broken: 'Si la acera está rota aquí, es fácil tropezar con bastón o con poca vista.',
      works: 'Si hay obras aquí, pueden cerrar el paso por un tiempo.',
      obstacle: 'Si algo estorba aquí, puede frenar una silla de ruedas o hacer tropezar a alguien.',
      handrail: 'Si hay un pasamanos aquí, ayuda a personas mayores y a quien no pisa seguro.',
      ramp: 'Si hay una rampa aquí, ayuda en silla de ruedas y con coche de bebé.',
      crossing: 'Si aquí se cruza el tráfico, cuesta más a quien camina despacio o ve poco.',
      bench: 'Si hay una banca aquí, da un descanso a personas mayores o cansadas.',
      toilets: 'Si hay baños aquí, las familias y las personas mayores planean el paseo según eso.',
      lighting: 'Si hay luz aquí, ayuda de noche a quien ve poco.',
      unseen: 'Nadie sabe aún qué encontrarán aquí los visitantes.',
    },
    marks: {
      steps: n => `escalones ${places_es(n)}`, kerb: n => `bordillos ${places_es(n)}`, broken: n => `acera rota ${places_es(n)}`,
      crossing: n => `cruces peatonales ${places_es(n)}`, bollard: n => `postes o bolardos ${places_es(n)}`, footway: n => `acera ${places_es(n)}`,
      cobblestones: n => `empedrado ${places_es(n)}`, road: n => `calzada ${places_es(n)}`,
    },
    osm: {
      bench: 'bancas', toilets: 'baños', crossing: 'cruces peatonales', handrail: 'escalones con pasamanos', noHandrail: 'escalones sin pasamanos', ramp: 'rampas', noRamp: 'escalones sin rampa',
      lit: 'alumbrado', unlit: 'partes sin alumbrado', wheelchairNo: 'lugares marcados como no accesibles en silla de ruedas', wheelchairLimited: 'lugares marcados con acceso limitado en silla de ruedas',
      cobbles: 'empedrado', loose: 'suelo suelto o sin pavimentar', kerbLowered: 'bordillos rebajados', kerbRaised: 'bordillos altos',
    },
    affectsDark: 'Cuesta más de noche a quien ve poco.', affectsLowered: 'Si hay bordillos rebajados aquí, ayudan a cruzar en silla de ruedas o con coche de bebé.',
    kinds: { steps: 'Escalones', kerb: 'Bordillo', narrow: 'Paso angosto', other: 'Otra cosa', bench: 'Banca', toilet: 'Baño', ramp: 'Rampa', handrail: 'Pasamanos' },
    added: { steps: 'escalones', kerb: 'un bordillo', narrow: 'un paso angosto', other: 'algo que estorba', bench: 'una banca', toilet: 'un baño', ramp: 'una rampa', handrail: 'un pasamanos' },
    groups: { blocks: 'Algo que estorba', helps: 'Algo que ayuda' },
    languages: { en: 'inglés', es: 'español', ko: 'coreano', qu: 'quechua', other: 'otro idioma' },
  },
  home: {
    greet: 'Aquí ves qué podría detener a un visitante en un recorrido, como unos escalones. Puedes revisarlo y responder a los mensajes de los visitantes sobre eso. Abre un recorrido de abajo o escribe un lugar.',
    search: 'Una plaza, un monumento o una calle',
    open: s => `Abrir ${s.place}`,
  },
  reveal: {
    hello: s => `¡Hola! Este es el recorrido hasta ${s.target}.`,
    photos: s => s.photos ? 'Primero, las fotos que compartió la gente.' : 'Este recorrido viene del mapa.',
    walk: s => `Este es tu camino, unos ${dist_es(s.metres)}.`,
    reading: () => 'Y esto se ve en las fotos.',
    areas: () => 'Y aquí está la calle a su alrededor, en 3D.',
    marks: s => s.spots === 0 ? 'Nada en las fotos parece un problema.' : `${cap(count_es(s.spots, 'punto podría', 'puntos podrían'))} ser un problema para algunos visitantes.`,
  },
  hello: {
    greet: () => 'Revisemos juntos este recorrido.',
    walk: s => s.spots === 0 ? `Son unos ${dist_es(s.metres)} y nada parece un problema.` : `Son unos ${dist_es(s.metres)}, con ${count_es(s.spots, 'punto', 'puntos')} que podrían complicar a los visitantes.`,
    mapOnly: s => s.osm ? `Son unos ${dist_es(s.metres)} a pie. Según OpenStreetMap, hay ${count_es(s.osm, 'cosa', 'cosas', true)} por revisar.` : `Son unos ${dist_es(s.metres)} a pie. Cuéntame qué encuentran los visitantes en el camino.`,
    altitude: s => `Aquí estamos a unos ${s.metres.toLocaleString('es')} m de altura, así que caminar cansa más.`,
    checked: s => s.left === 0 ? `Son unos ${dist_es(s.metres)} y ya revisaste todos los puntos.` : s.left === 1 ? `Son unos ${dist_es(s.metres)}. Queda un punto por revisar.` : `Son unos ${dist_es(s.metres)}. Quedan ${count_es(s.left, 'punto', 'puntos')} por revisar.`,
    chips: { check: 'Revisar el recorrido', messages: 'Leer mensajes', missed: 'Agregar algo que sé', note: 'Ver la nota de la ruta' },
  },
  select: {
    answered: s => `Dijiste: ${s.answer}. ¿Lo cambias?`,
    overview: () => 'Todo el recorrido. Toca un punto o una calle para verlo de cerca.',
    spot: s => `${cap(s.what)} ${s.where}, ${s.metres < 10 ? 'justo al inicio' : `a unos ${dist_es(s.metres)} de la salida`}.`,
    outline: s => yearOf(s.when) ? `En esta foto de ${yearOf(s.when)}, parece que hay ${s.what}.` : `Parece que hay ${s.what}.`,
    street: s => `${cap(s.street)} aún no está en este recorrido. ¿La agrego?`,
    next: 'Toca un punto o una calle para verlo de cerca.',
  },
  check: {
    progress: s => `${s.n} de ${s.total}`,
    photo: s => `Foto ${s.n} de ${s.total}`,
    saw: s => `Puede que haya ${s.what} aquí, ${s.where}.`,
    sawWhen: s => isOld(s.when) ? `Puede que haya ${s.what} ${s.where}, pero la foto es de ${yearOf(s.when)}.` : `Puede que haya ${s.what} aquí, ${s.where}.`,
    noPhotos: s => `No hay fotos de esta parte, ${s.where}.`,
    kind: s => `Las fotos también muestran ${s.what}.`,
    osm: s => `Según OpenStreetMap, aquí hay ${s.what}, ${s.where}.`,
    osmKind: s => `Según OpenStreetMap, hay ${s.what} ${places_es(s.places)} del recorrido.`,
    osmToo: s => `Además, según OpenStreetMap: ${s.osm}.`,
    noStreetPhotos: 'Del mapa',
    core: {
      steps: '¿Siguen ahí estos escalones?', kerb: '¿Sigue ahí este bordillo?', bollard: '¿Sigue ahí el poste?', gate: '¿Sigue ahí el portón?',
      uneven: '¿Sigue disparejo el suelo aquí?', steep: '¿Sigue empinado aquí?', narrow: '¿Sigue angosto aquí?', noWheelchair: '¿Sigue siendo así?',
      broken: '¿Sigue rota la acera?', works: '¿Siguen ahí las obras?', obstacle: '¿Sigue estorbando?',
      handrail: '¿Sigue ahí el pasamanos?', ramp: '¿Sigue ahí la rampa?', crossing: '¿Sigue ahí el cruce?', bench: '¿Sigue ahí la banca?', toilets: '¿Siguen ahí los baños?', lighting: '¿Siguen ahí las luces?',
      unseen: '¿Sabes qué hay aquí?',
    },
    coreAnswers: {
      presence: kind => PLURAL_ES.has(kind) ? { still: 'Siguen ahí', gone: 'Ya no están', unknown: 'No sé' } : { still: 'Sigue ahí', gone: 'Ya no está', unknown: 'No sé' },
      condition: () => ({ still: 'Sí, sigue así', gone: 'Ya no', unknown: 'No sé' }),
      temporary: kind => PLURAL_ES.has(kind) ? { still: 'Siguen ahí', repaired: 'Ya las arreglaron', unknown: 'No sé' } : { still: 'Sigue ahí', repaired: 'Ya lo arreglaron', unknown: 'No sé' },
      helpful: kind => PLURAL_ES.has(kind) ? { still: 'Siguen ahí', gone: 'Ya no están', unknown: 'No sé' } : { still: 'Sigue ahí', gone: 'Ya no está', unknown: 'No sé' },
      unseen: () => ({ nothing: 'Nada que estorbe', something: 'Hay algo', unknown: 'No sé' }),
    },
    coreSaid: {
      gone: 'Gracias. Ya lo quité de tu mapa.', notAnymore: 'Bien. Ya lo quité de tu mapa.', repaired: 'Buena noticia. Lo marqué como arreglado hoy.',
      stillPresence: 'De acuerdo, sigue en tu mapa.', stillHelpful: 'Bien. Está en tu nota.', goneHelpful: 'De acuerdo, ya lo saqué de tu nota.',
      nothing: 'Entendido. Tu nota dice que, por lo que sabes, nada estorba.', unknown: ASK_ES,
    },
    follow: {
      steps: '¿Cómo pasan los visitantes?', kerb: '¿Hay un bordillo rebajado o una rampa cerca?', uneven: '¿Hay un camino más parejo cerca?', steep: '¿Hay un camino más fácil cerca?',
      narrow: '¿Pasa una silla de ruedas o un coche de bebé?', bollard: '¿Pasa una silla de ruedas o un coche de bebé junto al poste?', gate: '¿Pasa una silla de ruedas o un coche de bebé por el portón?',
      unseen: '¿Qué es?',
    },
    ask: {
      getPast: () => '¿Cómo pasa por aquí quien no puede subir escalones?',
      lowered: () => '¿Hay un bordillo rebajado o una rampa cerca?',
      smoother: () => '¿Hay una acera o una calle más pareja cerca?',
      through: () => '¿Pasa una silla de ruedas o un coche de bebé?',
      temporary: () => '¿Sigue ahí?',
      helpful: () => '¿Sigue ahí?',
      unseen: () => '¿Sabes qué hay aquí?',
      mention: () => '¿Lo menciono en tu nota de la ruta?',
    },
    answers: {
      getPast: { wayAround: 'Hay otro camino', handrail: 'Hay pasamanos', help: 'Los ayudamos', noWay: 'No hay otro camino', notThere: 'No hay escalones ahí', unknown: 'No sé' },
      lowered: { nearby: 'Sí, cerca', none: 'No', unsure: 'No sé', notThere: 'No hay bordillo ahí', unknown: 'No sé' },
      smoother: { nearby: 'Sí, cerca', none: 'No', unsure: 'No sé', unknown: 'No sé' },
      through: { yes: 'Sí, pasa', no: 'No, no pasa', unknown: 'No sé' },
      temporary: { still: 'Sigue ahí', repaired: 'Ya lo arreglaron', gone: 'Ya no está', unknown: 'No sé' },
      helpful: { still: 'Sigue ahí', gone: 'Ya no está', unknown: 'No sé' },
      unseen: { nothing: 'Nada que estorbe', something: 'Aquí hay algo', unknown: 'No sé' },
      mention: { yes: 'Sí, menciónalo', no: 'Déjalo fuera', unknown: 'No sé' },
    },
    said: {
      getPast: {
        wayAround: () => 'Entendido. Tu nota ya menciona el otro camino.',
        handrail: () => 'Entendido. Tu nota ya menciona el pasamanos.',
        help: () => 'Entendido. Tu nota dice que aquí ayudan a los visitantes.',
        noWay: () => 'De acuerdo. Tu nota dice que no hay otro camino.',
        notThere: () => 'Gracias. Ya lo quité de tu mapa.',
        unknown: () => ASK_ES,
      },
      lowered: {
        nearby: () => 'Entendido. Ya marqué dónde está.',
        none: () => 'De acuerdo. Tu nota dice que no hay rampa cerca.',
        unsure: () => ASK_ES,
        notThere: () => 'Gracias. Ya lo quité de tu mapa.',
        unknown: () => ASK_ES,
      },
      smoother: {
        nearby: () => 'Entendido. Ya marqué dónde está.',
        none: () => 'De acuerdo. Tu nota dice que no hay una más pareja cerca.',
        unsure: () => ASK_ES,
        unknown: () => ASK_ES,
      },
      through: {
        yes: () => 'Entendido. Tu nota dice que, por lo que sabes, sí pasa.',
        no: () => 'Entendido. Tu nota dice que, por lo que sabes, no pasa.',
        unknown: () => ASK_ES,
      },
      temporary: {
        still: () => 'De acuerdo, sigue en tu mapa.',
        repaired: () => 'Buena noticia. Lo marqué como arreglado hoy.',
        gone: () => 'Bien. Anoté que desde hoy ya no está.',
        unknown: () => ASK_ES,
      },
      helpful: {
        still: () => 'Bien. Está en tu nota.',
        gone: () => 'De acuerdo, ya lo saqué de tu nota.',
        unknown: () => 'No pasa nada. Por ahora lo dejo fuera.',
      },
      mention: { yes: () => 'Listo. Tu nota lo menciona.', no: () => 'De acuerdo, lo dejé fuera.', unknown: () => 'No pasa nada. Por ahora lo dejo fuera.' },
      unseen: {
        nothing: () => 'Entendido. Tu nota dice que, por lo que sabes, nada estorba.',
        something: () => '¿Qué hay?',
        unknown: () => ASK_ES,
      },
    },
    tapWhere: () => 'Muéstrame dónde, en el mapa.',
    chips: { next: 'Siguiente', skip: 'Omitir por ahora' },
    extras: 'Esos son todos los puntos. Ahora, unas cosas del recorrido.',
    words: s => `¿Lo guardo como tu nota en ${s.spot}?`,
    noted: () => 'Listo. Los visitantes verán tu nota con tus palabras.',
    end: s => s.skipped ? 'Ese es el recorrido. Puedes volver a los puntos que omitiste.' : 'Ese es todo el recorrido. Gracias por revisarlo.',
  },
  around: {
    offer: s => `OpenStreetMap sugiere otro camino, unos ${dist_es(s.metres)} más largo.`,
    show: 'Aquí está. Nadie lo ha revisado todavía.',
    ask: '¿Les serviría a los visitantes que no pueden con escalones?',
    kept: 'Bien. Las respuestas y tu nota lo mencionarán como revisado por ti.',
    dropped: 'De acuerdo, no lo voy a sugerir.',
    unchecked: 'De acuerdo. No lo sugeriré hasta que lo revises.',
    none: 'Según OpenStreetMap, no hay otro camino que evite estos escalones.',
    offline: 'Necesito internet para buscar otro camino.',
    same: 'OpenStreetMap no muestra escalones en este recorrido, así que no hay nada que evitar.',
    chips: { show: 'Ver el otro camino', works: 'Sí sirve', notWorks: 'No sirve', unknown: 'No sé', better: 'Conozco uno mejor', notNow: 'Ahora no' },
    isThisIt: '¿Es este, el que sugiere OpenStreetMap?', isThisItChips: { yes: 'Sí, ese', no: 'No, otro camino' },
    offerChips: { show: 'Muéstramelo', notNow: 'Ahora no' },
    mapToggle: 'Otro camino',
    long: 'OpenStreetMap no muestra un camino corto que evite estos escalones.',
  },
  street: {
    offer: '¿Tus visitantes usan otras calles? Puedes agregar una.',
    start: 'Toca dónde empieza la calle.',
    end: 'Ahora toca dónde termina.',
    routing: 'Buscando el camino a pie…',
    found: s => `Unos ${dist_es(s.metres)} a pie, del mapa. ¿La guardo?`,
    kept: s => `Listo, agregué ${s.street} a tu mapa.`,
    failed: 'No encontré un camino a pie ahí. Prueba con otros puntos.',
    offline: 'Necesito internet para agregar una calle.',
    busy: 'El servicio de mapas está ocupado. Inténtalo en un minuto.',
    tooFar: 'Eso queda un poco lejos del recorrido. Toca más cerca.',
    tooLong: 'Es un camino muy largo. Prueba con una calle más corta.',
    removed: s => `Quité ${s.street} de tu mapa.`,
    chips: { add: 'Agregar una calle', keep: 'Guardar esta calle', again: 'Intentar de nuevo', cancel: 'Cancelar', remove: 'Quitar esta calle' },
  },
  narrow: { ask: '¿Hay algún paso angosto en el recorrido?', chips: { yes: 'Sí, te lo muestro', no: 'No hay pasos angostos', unknown: 'No sé' } },
  messages: {
    intro: s => s.total === 1 ? 'Un visitante te escribió sobre este recorrido.' : `${cap(count_es(s.total, 'visitante te escribió', 'visitantes te escribieron'))} sobre este recorrido.`,
    none: 'Aún no hay mensajes. Pega uno cuando llegue.',
    arrived: s => `Este está en ${s.language}.`,
    spot: s => `Creo que habla ${de(s.spot)}. ¿Es así?`,
    remembered: s => `Antes pusiste uno parecido en ${s.spot}.`,
    earlier: s => `Antes creí que hablaba ${de(s.spot)}.`,
    unsure: 'No sé bien de qué punto habla. ¿Es alguno de estos?',
    noSpot: 'Este no habla de un punto del recorrido.',
    unplaced: 'No sé dónde es. Pregúntale al visitante o tócalo tú.',
    unreadable: 'Todavía no puedo leer este idioma. Toca el punto en el mapa o pregúntale al visitante.',
    tap: 'Toca el punto en el mapa.',
    filed: s => `Listo, quedó en ${s.spot}.`,
    learned: 'La próxima vez te sugeriré ese punto para mensajes así.',
    example: 'Ejemplo',
    translated: 'Traducción automática',
    paste: 'Pega lo que escribió el visitante',
    read: 'Leer',
    chips: { yes: 'Sí, ese punto', another: 'No, otro punto', noSpot: 'No es de un punto', next: 'Siguiente mensaje', skip: 'Después', paste: 'Pegar un mensaje', askWhere: 'Preguntarle dónde' },
  },
  reply: {
    say: s => `Aquí tienes una respuesta en ${s.language}. Cópiala cuando quieras.`,
    fallback: s => `Aún no hay respuestas en ${s.language}; aquí va en ${s.reply}.`,
    copy: 'Copiar',
    copied: 'Copiado',
  },
  insights: {
    intro: 'Esto es lo que más mencionan los visitantes.',
    problem: s => `${cap(count_es(s.count, 'visitante tuvo', 'visitantes tuvieron'))} un problema en ${s.spot}.`,
    praise: s => `${cap(count_es(s.count, 'visitante elogió', 'visitantes elogiaron'))} ${s.spot}.`,
    question: s => `${cap(count_es(s.count, 'visitante preguntó', 'visitantes preguntaron'))} por ${s.spot}.`,
    none: 'Todavía nada se repite.',
    chips: { open: 'Muéstrame', next: 'Siguiente' },
  },
  photo: { unchecked: 'Sin revisar todavía', checked: s => `Lo revisaste el ${s.date}`, removed: 'Lo quitaste de tu mapa' },
  model: {
    download: s => `Necesito una descarga única de ${s.mb} MB para leer mensajes sin internet.`,
    downloadChip: s => `Descargar ${s.mb} MB`,
    withoutChip: 'Lo ubico yo',
    downloading: s => `Descargando… ${s.done} de ${s.total} MB`,
    reading: 'Leyéndolo…',
    notKept: 'Este dispositivo no pudo guardar la descarga. Ubícalo tú.',
    stopped: 'La descarga se detuvo. Reintenta o ubícalo tú.',
    failed: 'Algo falló aquí. Igual puedes ubicarlo tú.',
    tryAgain: 'Reintentar',
    outdated: 'La app se actualizó. Ábrela de nuevo para leer mensajes; tus cambios se guardan.',
    reload: 'Abrir de nuevo',
  },
  missed: {
    ask: '¿Faltó algo en las fotos? Cuéntamelo o toca el punto.',
    propose: s => `Entonces, ${s.kind} ${s.where}. ¿Agrego eso a tu mapa?`,
    kindAsk: '¿Qué hay ahí?',
    here: s => `¿Qué hay en ${s.spot}?`,
    found: s => `Entendido, ${s.where}. ¿Qué es?`,
    notFound: 'No supe decir dónde es. ¿Lo tocas en el mapa?',
    added: s => `Listo: ${s.kind} ${s.where}.`,
    chips: { yes: 'Agrégalo', no: 'No del todo', done: 'Eso es todo' },
  },
  note: {
    say: 'Esta es tu nota de la ruta para los visitantes.',
    empty: 'Aún no hay nada que contarles a los visitantes.',
    copy: 'Copiar',
    copied: 'Copiado',
  },
  input: { placeholder: 'Escribe con tus palabras', send: 'Enviar' },
  restart: { chip: 'Empezar de nuevo', ask: '¿Borro todo lo que hiciste en este recorrido?', yes: 'Sí, borrar', no: 'No, conservar' },
  back: 'Volver',
  compare: { label: 'Tu mapa', before: 'Antes', now: 'Ahora', saidBefore: 'Así era el recorrido antes de tus cambios.', saidNow: 'Así queda el recorrido con tus cambios.' },
  edit: {
    chip: 'Editar', done: 'Listo', closed: 'Listo. Tu nota de la ruta está al día.', intro: 'Lo que cambies aquí cambia lo que leen los visitantes en tu nota y tus respuestas.', ask: '¿Qué quieres cambiar?',
    addSpot: '¿Las fotos no muestran algo nuevo o pasajero, como un escalón roto, una banca u obras?', addSpotMapped: '¿Hay algo que el mapa no muestra, nuevo o pasajero, como un escalón roto, una banca u obras?', addSpotTap: 'Toca dónde está en el mapa o cuéntamelo con tus palabras.', changeSpot: 'Toca el punto que quieres cambiar.',
    result: s => `Ahora los visitantes leerán: “${s.line}”`, removed: 'Los visitantes ya no leerán sobre este punto.', unchanged: 'Tu nota de la ruta queda igual.',
    note: '¿Qué debería decir tu nota? Escríbela con tus palabras.', noteSaved: 'Guardado. Los visitantes la verán con tus palabras.',
    chips: { addSpot: 'Agregar un punto', changeSpot: 'Cambiar un punto', addStreet: 'Agregar una calle', note: 'Cambiar mi nota', back: 'Volver a donde estaba', changes: 'Tus cambios' },
  },
  changes: {
    intro: 'Esto es lo que cambiaste. Toca uno para verlo.', none: 'Aún no has cambiado nada.', undo: 'Deshacer', undone: 'Deshecho. Tu mapa quedó como antes.', note: 'Tu nota',
    added: s => `Agregaste ${s.kind} · ${s.at}`, street: s => `Calle agregada · ${s.street}`, takenOff: s => `${s.tag}: quitado de tu mapa`, around: { works: 'Otro camino: sirve', notWorks: 'Otro camino: no sirve' },
  },
  more: 'Más',
  notSaved: 'Ese cambio no se guardó en este dispositivo.',
};

export const SCRIPT: Record<UiLanguage, Script> = { en, es };
