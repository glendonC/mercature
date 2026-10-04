import type { UiLanguage } from '../site/contracts';
import type { EditKind } from '../edits/store';
import type { MarkKind } from '../ui/kinds';

/**
 * Everything the guide says, in English and Spanish: fixed lines with typed slots, and the labels of the choices she can tap.
 * The engine in src/guide decides which step comes next and fills the slots from the place's records and her own; nothing here
 * is generated, and the guide never writes free text. "Model" means only the AI.
 * Slots arrive ready for prose: place names carry their article, numbers are whole, phrases are in the line's language.
 */

/** The conversation's steps on the route screen. */
export const STEPS = ['hello', 'select', 'check', 'checkEnd', 'message', 'reply', 'insights', 'missed', 'around', 'street', 'note'] as const;
export type StepId = (typeof STEPS)[number];

/** What a thing on the walk is, for the guide's question about it. Photo marks, OpenStreetMap tags and her own spots each map to one. */
export const ACCESS_KINDS = ['steps', 'kerb', 'uneven', 'steep', 'narrow', 'bollard', 'gate', 'noWheelchair', 'broken', 'works', 'obstacle', 'handrail', 'ramp', 'crossing', 'bench', 'toilets', 'lighting', 'unseen'] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];
/** One question per kind and the answers she can tap. 'unknown' is in every list: she does not know, so the note tells visitors to ask a person. */
export const QUESTIONS = {
  getPast: ['wayAround', 'handrail', 'help', 'noWay', 'notThere', 'unknown'],
  lowered: ['nearby', 'none', 'notThere', 'unknown'],
  smoother: ['nearby', 'none', 'unknown'],
  through: ['yes', 'no', 'unknown'],
  temporary: ['still', 'repaired', 'gone', 'unknown'],
  helpful: ['still', 'gone', 'unknown'],
  unseen: ['nothing', 'something', 'unknown'],
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
/** What a model outlined at a flagged spot, in the words a visitor knows. */
export type Subject = 'steps' | 'kerb' | 'path';

/** The walk, for the greeting, the overview and the reveal. */
export type WalkSlots = {
  /** The place's name, such as "Qorikancha". */
  place: string;
  /** Where the walk starts and ends, such as "the Plaza de Armas". */
  start: string;
  target: string;
  metres: number;
  /** Street photos along the walk. */
  photos: number;
  /** Everything a model outlined in those photos near the walk. */
  marks: number;
  /** Outlines that might be a barrier, and the spots they fall on. */
  barriers: number;
  spots: number;
  /** Visitor messages waiting. */
  messages: number;
  /** Things OpenStreetMap lists along a walk no street photo was read for. */
  osm: number;
};
/** One item of the walk check, or the spot she selected. */
export type ItemSlots = {
  /** Its place in the check, from 1. */
  n: number;
  total: number;
  /** What is there, from words.access, such as "steps". */
  what: string;
  /** Where on the walk, such as "on Calle Loreto". */
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
/** Another kind a model marked near the walk, counted, such as "45 kerbs" from words.marks. */
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
    /** The kinds she can give a spot, as chips. */
    kinds: Record<EditKind, string>;
    /** The same kinds inside a line, such as "a kerb". */
    added: Record<EditKind, string>;
    /** Message languages by code: en, es, ko, qu, other. */
    languages: Record<string, string>;
  };
  /** On Home, before a place is open. */
  home: { greet: string; search: string; open: (s: { place: string }) => string };
  /** While the walk's records replay: a greeting, then one line per beat. */
  reveal: { hello: (s: WalkSlots) => string; photos: (s: WalkSlots) => string; walk: (s: WalkSlots) => string; reading: (s: WalkSlots) => string; marks: (s: WalkSlots) => string };
  hello: {
    greet: (s: WalkSlots) => string;
    /** The walk in one or two lines: its length, its photos, what was found, how much might stop someone. */
    walk: (s: WalkSlots) => string;
    /** The same for a walk built from OpenStreetMap alone, before any street photo is read. */
    mapOnly: (s: WalkSlots) => string;
    altitude: (s: { metres: number }) => string;
    chips: { check: string; messages: string; missed: string; note: string };
  };
  /** Whatever she selects becomes the subject: the walk as a whole, a spot, an outline on a photo, a street. next says what she can do. */
  select: { overview: (s: WalkSlots) => string; spot: (s: ItemSlots) => string; outline: (s: ItemSlots) => string; street: (s: { street: string }) => string; next: string };
  check: {
    progress: (s: { n: number; total: number }) => string;
    /** A flagged spot: what a model outlined there when the walk was recorded. */
    saw: (s: ItemSlots) => string;
    sawWhen: (s: ItemSlots) => string;
    /** A stretch no photo shows. */
    noPhotos: (s: ItemSlots) => string;
    /** Another kind near the walk. */
    kind: (s: KindSlots) => string;
    /** On a walk with no street photos read: what OpenStreetMap records there. */
    osm: (s: ItemSlots) => string;
    /** What OpenStreetMap adds about a spot the photos show. */
    osmToo: (s: ItemSlots) => string;
    /** Where the photo would be, on such a walk. */
    noStreetPhotos: string;
    ask: Record<QuestionId, (s: ItemSlots) => string>;
    /** The answers as chips. */
    answers: { [Q in QuestionId]: Record<AnswerOf<Q>, string> };
    /** Each answer said back after her tap. */
    said: { [Q in QuestionId]: Record<AnswerOf<Q>, (s: ItemSlots) => string> };
    /** For an answer that needs a place on the map. */
    tapWhere: (s: ItemSlots) => string;
    chips: { next: string; skip: string };
    /** Her own words about the item, read by the model, offered back as a note on the spot it found. */
    words: (s: SpotSlots) => string;
    noted: (s: SpotSlots) => string;
    end: (s: TallySlots) => string;
  };
  /** The way around the mapped steps that OpenStreetMap's router suggests. metres: how much longer than the walk. */
  around: { offer: (s: { metres: number }) => string; show: string; ask: string; kept: string; dropped: string; unchecked: string; none: string; offline: string;
    chips: { show: string; works: string; notWorks: string; unknown: string; better: string; notNow: string } };
  /** Another street she adds: she taps its start and end, and it is routed on foot. */
  street: { offer: string; start: string; end: string; routing: string; found: (s: { metres: number; osm: number }) => string; kept: (s: { street: string }) => string; failed: string; offline: string;
    chips: { add: string; keep: string; again: string; cancel: string } };
  /** Asked once per walk; yes asks her to tap the place, then the 'through' question. */
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
    chips: { yes: string; another: string; noSpot: string; next: string; skip: string; paste: string };
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
  };
  missed: {
    ask: string;
    /** What she said, read by the model, offered back before it goes on her map. */
    propose: (s: ProposeSlots) => string;
    kindAsk: string;
    /** She tapped a spot on the map: what is there? The kind chips follow. */
    here: (s: SpotSlots) => string;
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
  notSaved: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cap = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

const en: Script = {
  words: {
    subjects: { steps: 'steps', kerb: 'a kerb with no ramp in view', path: 'something on the path' },
    access: {
      steps: 'steps', kerb: 'a kerb', uneven: 'uneven ground', steep: 'a steep part', narrow: 'a narrow part', bollard: 'a bollard', gate: 'a gate', noWheelchair: 'a place marked not for wheelchairs',
      broken: 'broken paving', works: 'works', obstacle: 'something in the way', handrail: 'a handrail', ramp: 'a ramp', crossing: 'a crossing', bench: 'a bench', toilets: 'toilets', lighting: 'street lighting', unseen: 'a stretch no photo shows',
    },
    affects: {
      steps: 'Wheelchairs, prams and anyone who cannot climb.', kerb: 'Wheelchairs and prams.', uneven: 'Wheelchairs, prams and unsteady walkers.', steep: 'Wheelchairs and anyone short of breath.',
      narrow: 'Wheelchairs and prams.', bollard: 'Wheelchairs, and people who cannot see it.', gate: 'Wheelchairs and prams.', noWheelchair: 'Wheelchairs.', broken: 'Wheelchairs, prams and unsteady walkers.',
      works: 'Everyone, for a while.', obstacle: 'Wheelchairs, prams, and people who cannot see it.', handrail: 'Anyone unsteady on steps.', ramp: 'Wheelchairs and prams.', crossing: 'Everyone crossing.',
      bench: 'Anyone who needs a rest.', toilets: 'Everyone.', lighting: 'Everyone after dark.', unseen: 'Nobody has seen it in a photo.',
    },
    marks: {
      steps: n => plural(n, 'set of steps', 'sets of steps'), kerb: n => plural(n, 'kerb', 'kerbs'), broken: n => plural(n, 'patch of broken paving', 'patches of broken paving'),
      crossing: n => plural(n, 'crossing', 'crossings'), bollard: n => plural(n, 'bollard', 'bollards'), footway: n => plural(n, 'stretch of pavement', 'stretches of pavement'),
      cobblestones: n => plural(n, 'stretch of cobblestones', 'stretches of cobblestones'), road: n => plural(n, 'stretch of road', 'stretches of road'),
    },
    kinds: { steps: 'Steps', kerb: 'Kerb', narrow: 'Narrow', other: 'Something else' },
    added: { steps: 'steps', kerb: 'a kerb', narrow: 'a narrow part', other: 'something' },
    languages: { en: 'English', es: 'Spanish', ko: 'Korean', qu: 'Quechua', other: 'another language' },
  },
  home: { greet: 'Hi. Pick a place, or search for one, and I will show you its walk.', search: 'Search for a place', open: s => `Open ${s.place}` },
  reveal: {
    hello: s => `Hi. Let me show you how the walk to ${s.target} was put together.`,
    photos: s => `First, ${s.photos} street photos people shared from along the way.`,
    walk: s => `Then the walk itself: ${s.metres} m from ${s.start} to ${s.target}.`,
    reading: s => `When it was recorded, a model outlined ${s.marks} things near the walk in those photos.`,
    marks: s => `${cap(plural(s.barriers, 'outline', 'outlines'))} might stop someone, at ${plural(s.spots, 'spot', 'spots')}. Nobody has checked them yet.`,
  },
  hello: {
    greet: () => 'Hi. I can help you check this walk and answer visitors.',
    walk: s => `It runs ${s.metres} m from ${s.start} to ${s.target}, in ${s.photos} street photos. ${cap(plural(s.barriers, 'thing', 'things'))} in them might stop someone, at ${plural(s.spots, 'spot', 'spots')}.`,
    mapOnly: s => `It runs ${s.metres} m from ${s.start} to ${s.target}. No street photos were read yet; OpenStreetMap lists ${plural(s.osm, 'thing', 'things')} to check.`,
    altitude: s => `Its ends are about ${s.metres} m apart in height.`,
    chips: { check: 'Check the walk', messages: 'Visitor messages', missed: 'Add what the photos missed', note: 'Route note' },
  },
  select: {
    overview: s => `This is the walk, ${s.metres} m. Tap a spot, a street or an outline on a photo, and I will tell you about it.`,
    spot: s => `${cap(s.what)} ${s.where}, ${s.metres} m along.`,
    outline: s => `A model outlined ${s.what} in this photo.`,
    street: s => `${cap(s.street)}.`,
    next: 'Tap another spot, or choose below.',
  },
  check: {
    progress: s => `${s.n} of ${s.total}`,
    saw: s => `When the walk was recorded, a model outlined ${s.what} here, ${s.where}.`,
    sawWhen: s => `In a photo from ${s.when}, a model outlined ${s.what} here, ${s.where}.`,
    noPhotos: s => `No street photo shows this stretch, ${s.where}.`,
    kind: s => `A model also marked ${s.what} near the walk.`,
    osm: s => `OpenStreetMap says there are ${s.what} here, ${s.where}.`,
    osmToo: s => `OpenStreetMap adds: ${s.osm}.`,
    noStreetPhotos: 'No street photos were read here yet.',
    ask: {
      getPast: s => `How can someone who cannot use ${s.what} get past?`,
      lowered: () => 'Is there a lowered kerb nearby?',
      smoother: () => 'Is there a smoother way nearby?',
      through: () => 'Can people get through here?',
      temporary: () => 'Is it still there?',
      helpful: () => 'Is it still there?',
      unseen: () => 'What is on this stretch?',
    },
    answers: {
      getPast: { wayAround: 'A step-free way nearby', handrail: 'There is a handrail', help: 'We help visitors', noWay: 'No way around', notThere: 'Not there', unknown: "I don't know" },
      lowered: { nearby: 'Lowered kerb nearby', none: 'No lowered kerb', notThere: 'Not there', unknown: "I don't know" },
      smoother: { nearby: 'Smoother way nearby', none: 'No smoother way', unknown: "I don't know" },
      through: { yes: 'People get through', no: 'Hard to get through', unknown: "I don't know" },
      temporary: { still: 'Still there', repaired: 'Repaired', gone: 'Gone', unknown: "I don't know" },
      helpful: { still: 'Still there', gone: 'Gone', unknown: "I don't know" },
      unseen: { nothing: 'Nothing in the way', something: 'Something is there', unknown: "I don't know" },
    },
    said: {
      getPast: { wayAround: () => 'Noted: a step-free way nearby.', handrail: () => 'Noted: there is a handrail.', help: () => 'Noted: you help visitors here.', noWay: () => 'Noted: no way around.', notThere: () => 'Taken off your map.', unknown: () => 'Noted. The route note asks visitors to check with you.' },
      lowered: { nearby: () => 'Noted: a lowered kerb nearby.', none: () => 'Noted: no lowered kerb.', notThere: () => 'Taken off your map.', unknown: () => 'Noted. The route note asks visitors to check with you.' },
      smoother: { nearby: () => 'Noted: a smoother way nearby.', none: () => 'Noted: no smoother way.', unknown: () => 'Noted. The route note asks visitors to check with you.' },
      through: { yes: () => 'Noted, in your words: people get through.', no: () => 'Noted, in your words: hard to get through.', unknown: () => 'Noted. The route note asks visitors to check with you.' },
      temporary: { still: () => 'Kept on your map.', repaired: () => 'Marked repaired. Replies and the route note will say so.', gone: () => 'Taken off your map.', unknown: () => 'Noted. The route note asks visitors to check with you.' },
      helpful: { still: () => 'Kept on your map.', gone: () => 'Taken off your map.', unknown: () => 'Noted.' },
      unseen: { nothing: () => 'Noted: nothing in the way, in your words.', something: () => 'What is there?', unknown: () => 'Noted. The route note asks visitors to check with you.' },
    },
    tapWhere: () => 'Tap where it is on the map.',
    chips: { next: 'Next', skip: 'Skip' },
    words: s => `Add your words to ${s.spot}?`,
    noted: s => `Your words are on ${s.spot}.`,
    end: s => `That's all ${s.total}: ${s.answered} answered, ${s.unknown} for a person to check, ${s.skipped} skipped.`,
  },
  around: {
    offer: s => `OpenStreetMap suggests a way around the steps, ${s.metres} m longer. Nobody has checked it.`,
    show: 'Here it is on the map.',
    ask: 'Does it work for someone who cannot use steps?',
    kept: 'Kept as a way around.',
    dropped: 'Taken off your map.',
    unchecked: 'Kept, marked as not checked.',
    none: 'OpenStreetMap has no way around here.',
    offline: 'Finding a way around needs a connection.',
    chips: { show: 'Show it', works: 'It works', notWorks: "It doesn't work", unknown: "I don't know", better: 'I know a better way', notNow: 'Not now' },
  },
  street: {
    offer: 'Do visitors use another street? You can add it.',
    start: 'Tap where it starts.',
    end: 'Now tap where it ends.',
    routing: 'Finding the way on foot…',
    found: s => `That is ${s.metres} m on foot. OpenStreetMap lists ${plural(s.osm, 'thing', 'things')} on it.`,
    kept: s => `Added ${s.street} to your map.`,
    failed: 'I could not find a way on foot between those.',
    offline: 'Adding a street needs a connection.',
    chips: { add: 'Add a street', keep: 'Keep it', again: 'Try again', cancel: 'Cancel' },
  },
  narrow: { ask: 'Are there narrow places on the walk?', chips: { yes: 'Yes', no: 'No', unknown: "I don't know" } },
  messages: {
    intro: s => s.total === 1 ? '1 visitor wrote about this walk.' : `${s.total} visitors wrote about this walk.`,
    none: 'No visitor messages yet. Paste one when it comes.',
    arrived: s => `A visitor wrote in ${s.language}:`,
    spot: s => `It seems to be about ${s.spot}. Is that right?`,
    remembered: s => `You filed a message like this on ${s.spot} before.`,
    earlier: s => `A message like this went to ${s.spot} before.`,
    unsure: 'Not sure which spot. Tap it on the map.',
    noSpot: 'It is not about one spot.',
    unplaced: 'Not sure. Tap the spot on the map, or ask the visitor.',
    tap: 'Tap the spot on the map.',
    filed: s => `Filed on ${s.spot}.`,
    learned: 'I will remember where messages like this go.',
    example: 'Example',
    translated: 'Machine-translated',
    paste: 'Paste what the visitor wrote',
    read: 'Read it',
    chips: { yes: 'Yes, that spot', another: 'Another spot', noSpot: 'Not about a spot', next: 'Next message', skip: 'Skip', paste: 'Paste a message' },
  },
  reply: {
    say: s => `Here is a reply in ${s.language}, from what your map says.`,
    fallback: s => `There is no reply in ${s.language} yet, so here it is in ${s.reply}.`,
    copy: 'Copy',
    copied: 'Copied',
  },
  insights: {
    intro: 'Here is what visitors keep raising.',
    problem: s => `${plural(s.count, 'message', 'messages')} about ${s.kind} at ${s.spot}.`,
    praise: s => `${s.count === 1 ? '1 visitor' : `${s.count} visitors`} praised ${s.spot}.`,
    question: s => `${plural(s.count, 'question', 'questions')} about ${s.spot}.`,
    none: 'Nothing comes up more than once yet.',
    chips: { open: 'Show me', next: 'Next' },
  },
  model: {
    download: s => `I read messages on this device. That needs one download of ${s.mb} MB, then it works offline.`,
    downloadChip: s => `Download ${s.mb} MB`,
    withoutChip: 'File it myself',
    downloading: s => `Downloading the model, ${s.done} of ${s.total} MB…`,
    reading: 'Reading…',
    notKept: 'This device could not keep the model. You can still file it yourself.',
    stopped: 'The download stopped. You can try again or file it yourself.',
    failed: 'The model could not load here. You can still file it yourself.',
    tryAgain: 'Try again',
  },
  missed: {
    ask: 'Did the photos miss anything? Tap its spot on the map, or tell me in your words.',
    propose: s => `Add ${s.kind} ${s.where} to your map?`,
    kindAsk: 'What is there?',
    here: s => `What is at ${s.spot}?`,
    notFound: 'I could not tell where. Tap the spot on the map.',
    added: s => `Added ${s.kind} ${s.where}.`,
    chips: { yes: 'Add it', no: 'Not quite', done: 'Nothing else' },
  },
  note: {
    say: 'Here is the route note for visitors. It changes as you check the walk.',
    empty: 'Nothing on the walk needs a note yet.',
    copy: 'Copy',
    copied: 'Copied',
  },
  input: { placeholder: 'In your words', send: 'Send' },
  restart: { chip: 'Start over', ask: 'Clear everything you did on this place?', yes: 'Clear', no: 'Keep' },
  back: 'Back',
  notSaved: 'This device did not keep the last change.',
};

const es: Script = {
  words: {
    subjects: { steps: 'escalones', kerb: 'un bordillo sin rampa visible', path: 'algo en el camino' },
    access: {
      steps: 'escalones', kerb: 'un bordillo', uneven: 'suelo irregular', steep: 'una parte empinada', narrow: 'una parte estrecha', bollard: 'un bolardo', gate: 'una puerta', noWheelchair: 'un lugar marcado como no apto para sillas de ruedas',
      broken: 'pavimento roto', works: 'obras', obstacle: 'algo que estorba', handrail: 'un pasamanos', ramp: 'una rampa', crossing: 'un cruce', bench: 'una banca', toilets: 'baños', lighting: 'alumbrado', unseen: 'un tramo que ninguna foto muestra',
    },
    affects: {
      steps: 'Sillas de ruedas, cochecitos y quien no puede subir.', kerb: 'Sillas de ruedas y cochecitos.', uneven: 'Sillas de ruedas, cochecitos y quien camina con inseguridad.', steep: 'Sillas de ruedas y quien se cansa al subir.',
      narrow: 'Sillas de ruedas y cochecitos.', bollard: 'Sillas de ruedas y quien no lo ve.', gate: 'Sillas de ruedas y cochecitos.', noWheelchair: 'Sillas de ruedas.', broken: 'Sillas de ruedas, cochecitos y quien camina con inseguridad.',
      works: 'Todos, por un tiempo.', obstacle: 'Sillas de ruedas, cochecitos y quien no lo ve.', handrail: 'Quien se siente inseguro en escalones.', ramp: 'Sillas de ruedas y cochecitos.', crossing: 'Todos al cruzar.',
      bench: 'Quien necesita descansar.', toilets: 'Todos.', lighting: 'Todos, de noche.', unseen: 'Nadie lo ha visto en una foto.',
    },
    marks: {
      steps: n => plural(n, 'tramo de escalones', 'tramos de escalones'), kerb: n => plural(n, 'bordillo', 'bordillos'), broken: n => plural(n, 'parte de pavimento roto', 'partes de pavimento roto'),
      crossing: n => plural(n, 'cruce', 'cruces'), bollard: n => plural(n, 'bolardo', 'bolardos'), footway: n => plural(n, 'tramo de acera', 'tramos de acera'),
      cobblestones: n => plural(n, 'tramo empedrado', 'tramos empedrados'), road: n => plural(n, 'tramo de calzada', 'tramos de calzada'),
    },
    kinds: { steps: 'Escalones', kerb: 'Bordillo', narrow: 'Estrecho', other: 'Otra cosa' },
    added: { steps: 'escalones', kerb: 'un bordillo', narrow: 'una parte estrecha', other: 'algo' },
    languages: { en: 'inglés', es: 'español', ko: 'coreano', qu: 'quechua', other: 'otro idioma' },
  },
  home: { greet: 'Hola. Elige un lugar o búscalo, y te muestro su recorrido.', search: 'Buscar un lugar', open: s => `Abrir ${s.place}` },
  reveal: {
    hello: s => `Hola. Te muestro cómo se armó el recorrido hasta ${s.target}.`,
    photos: s => `Primero, ${s.photos} fotos de la calle que la gente compartió en el camino.`,
    walk: s => `Luego el recorrido: ${s.metres} m desde ${s.start} hasta ${s.target}.`,
    reading: s => `Al registrarlo, un modelo marcó ${s.marks} cosas cerca del recorrido en esas fotos.`,
    marks: s => `${cap(plural(s.barriers, 'marca podría', 'marcas podrían'))} impedir el paso, en ${plural(s.spots, 'punto', 'puntos')}. Nadie las ha revisado aún.`,
  },
  hello: {
    greet: () => 'Hola. Puedo ayudarte a revisar este recorrido y responder a los visitantes.',
    walk: s => `Va de ${s.start} a ${s.target}, ${s.metres} m, en ${s.photos} fotos de la calle. ${cap(plural(s.barriers, 'cosa', 'cosas'))} en ellas podrían impedir el paso, en ${plural(s.spots, 'punto', 'puntos')}.`,
    mapOnly: s => `Va de ${s.start} a ${s.target}, ${s.metres} m. Aún no se leyeron fotos de la calle; OpenStreetMap registra ${plural(s.osm, 'cosa', 'cosas')} para revisar.`,
    altitude: s => `Sus extremos tienen unos ${s.metres} m de diferencia de altura.`,
    chips: { check: 'Revisar el recorrido', messages: 'Mensajes de visitantes', missed: 'Agregar lo que faltó en las fotos', note: 'Nota de la ruta' },
  },
  select: {
    overview: s => `Este es el recorrido, ${s.metres} m. Toca un punto, una calle o una marca en una foto y te cuento sobre eso.`,
    spot: s => `${cap(s.what)} ${s.where}, a ${s.metres} m del inicio.`,
    outline: s => `Un modelo marcó ${s.what} en esta foto.`,
    street: s => `${cap(s.street)}.`,
    next: 'Toca otro punto o elige abajo.',
  },
  check: {
    progress: s => `${s.n} de ${s.total}`,
    saw: s => `Al registrar el recorrido, un modelo marcó ${s.what} aquí, ${s.where}.`,
    sawWhen: s => `En una foto de ${s.when}, un modelo marcó ${s.what} aquí, ${s.where}.`,
    noPhotos: s => `Ninguna foto de la calle muestra este tramo, ${s.where}.`,
    kind: s => `Un modelo también marcó ${s.what} cerca del recorrido.`,
    osm: s => `OpenStreetMap dice que hay ${s.what} aquí, ${s.where}.`,
    osmToo: s => `OpenStreetMap agrega: ${s.osm}.`,
    noStreetPhotos: 'Aún no se leyeron fotos de la calle aquí.',
    ask: {
      getPast: s => `¿Cómo pasa alguien que no puede usar ${s.what}?`,
      lowered: () => '¿Hay un bordillo rebajado cerca?',
      smoother: () => '¿Hay un camino más liso cerca?',
      through: () => '¿Se puede pasar por aquí?',
      temporary: () => '¿Sigue ahí?',
      helpful: () => '¿Sigue ahí?',
      unseen: () => '¿Qué hay en este tramo?',
    },
    answers: {
      getPast: { wayAround: 'Un camino sin escalones cerca', handrail: 'Hay pasamanos', help: 'Ayudamos a los visitantes', noWay: 'No hay otro camino', notThere: 'No está ahí', unknown: 'No lo sé' },
      lowered: { nearby: 'Bordillo rebajado cerca', none: 'Sin bordillo rebajado', notThere: 'No está ahí', unknown: 'No lo sé' },
      smoother: { nearby: 'Camino más liso cerca', none: 'No hay camino más liso', unknown: 'No lo sé' },
      through: { yes: 'Se puede pasar', no: 'Cuesta pasar', unknown: 'No lo sé' },
      temporary: { still: 'Sigue ahí', repaired: 'Reparado', gone: 'Ya no está', unknown: 'No lo sé' },
      helpful: { still: 'Sigue ahí', gone: 'Ya no está', unknown: 'No lo sé' },
      unseen: { nothing: 'Nada que estorbe', something: 'Hay algo', unknown: 'No lo sé' },
    },
    said: {
      getPast: { wayAround: () => 'Anotado: un camino sin escalones cerca.', handrail: () => 'Anotado: hay pasamanos.', help: () => 'Anotado: ayudan a los visitantes aquí.', noWay: () => 'Anotado: no hay otro camino.', notThere: () => 'Quitado de tu mapa.', unknown: () => 'Anotado. La nota de la ruta pide a los visitantes consultarte.' },
      lowered: { nearby: () => 'Anotado: un bordillo rebajado cerca.', none: () => 'Anotado: sin bordillo rebajado.', notThere: () => 'Quitado de tu mapa.', unknown: () => 'Anotado. La nota de la ruta pide a los visitantes consultarte.' },
      smoother: { nearby: () => 'Anotado: un camino más liso cerca.', none: () => 'Anotado: no hay camino más liso.', unknown: () => 'Anotado. La nota de la ruta pide a los visitantes consultarte.' },
      through: { yes: () => 'Anotado, con tus palabras: se puede pasar.', no: () => 'Anotado, con tus palabras: cuesta pasar.', unknown: () => 'Anotado. La nota de la ruta pide a los visitantes consultarte.' },
      temporary: { still: () => 'Queda en tu mapa.', repaired: () => 'Marcado como reparado. Las respuestas y la nota de la ruta lo dirán.', gone: () => 'Quitado de tu mapa.', unknown: () => 'Anotado. La nota de la ruta pide a los visitantes consultarte.' },
      helpful: { still: () => 'Queda en tu mapa.', gone: () => 'Quitado de tu mapa.', unknown: () => 'Anotado.' },
      unseen: { nothing: () => 'Anotado: nada que estorbe, con tus palabras.', something: () => '¿Qué hay ahí?', unknown: () => 'Anotado. La nota de la ruta pide a los visitantes consultarte.' },
    },
    tapWhere: () => 'Toca dónde está en el mapa.',
    chips: { next: 'Siguiente', skip: 'Saltar' },
    words: s => `¿Agrego tus palabras a ${s.spot}?`,
    noted: s => `Tus palabras están en ${s.spot}.`,
    end: s => `Eso es todo, ${s.total}: ${s.answered} respondidos, ${s.unknown} para que lo revise una persona, ${s.skipped} saltados.`,
  },
  around: {
    offer: s => `OpenStreetMap sugiere un camino que evita los escalones, ${s.metres} m más largo. Nadie lo ha revisado.`,
    show: 'Aquí está en el mapa.',
    ask: '¿Sirve para alguien que no puede usar escalones?',
    kept: 'Guardado como camino alternativo.',
    dropped: 'Quitado de tu mapa.',
    unchecked: 'Guardado, marcado como no revisado.',
    none: 'OpenStreetMap no tiene un camino alternativo aquí.',
    offline: 'Buscar un camino alternativo necesita conexión.',
    chips: { show: 'Mostrarlo', works: 'Sirve', notWorks: 'No sirve', unknown: 'No lo sé', better: 'Conozco uno mejor', notNow: 'Ahora no' },
  },
  street: {
    offer: '¿Los visitantes usan otra calle? Puedes agregarla.',
    start: 'Toca dónde empieza.',
    end: 'Ahora toca dónde termina.',
    routing: 'Buscando el camino a pie…',
    found: s => `Son ${s.metres} m a pie. OpenStreetMap registra ${plural(s.osm, 'cosa', 'cosas')} en ella.`,
    kept: s => `Agregué ${s.street} a tu mapa.`,
    failed: 'No encontré un camino a pie entre esos puntos.',
    offline: 'Agregar una calle necesita conexión.',
    chips: { add: 'Agregar una calle', keep: 'Guardarla', again: 'Reintentar', cancel: 'Cancelar' },
  },
  narrow: { ask: '¿Hay lugares estrechos en el recorrido?', chips: { yes: 'Sí', no: 'No', unknown: 'No lo sé' } },
  messages: {
    intro: s => s.total === 1 ? '1 visitante escribió sobre este recorrido.' : `${s.total} visitantes escribieron sobre este recorrido.`,
    none: 'Aún no hay mensajes de visitantes. Pega uno cuando llegue.',
    arrived: s => `Un visitante escribió en ${s.language}:`,
    spot: s => `Parece tratar de ${s.spot}. ¿Es correcto?`,
    remembered: s => `Antes ubicaste un mensaje parecido en ${s.spot}.`,
    earlier: s => `Un mensaje parecido fue a ${s.spot} antes.`,
    unsure: 'Sin certeza del punto. Tócalo en el mapa.',
    noSpot: 'No trata de un punto concreto.',
    unplaced: 'Sin certeza. Toca el punto en el mapa o pregunta al visitante.',
    tap: 'Toca el punto en el mapa.',
    filed: s => `Ubicado en ${s.spot}.`,
    learned: 'Recordaré dónde van los mensajes como este.',
    example: 'Ejemplo',
    translated: 'Traducción automática',
    paste: 'Pega lo que escribió el visitante',
    read: 'Leerlo',
    chips: { yes: 'Sí, ese punto', another: 'Otro punto', noSpot: 'No es un punto', next: 'Siguiente mensaje', skip: 'Saltar', paste: 'Pegar un mensaje' },
  },
  reply: {
    say: s => `Esta es una respuesta en ${s.language}, según lo que dice tu mapa.`,
    fallback: s => `Aún no hay respuesta en ${s.language}; aquí está en ${s.reply}.`,
    copy: 'Copiar',
    copied: 'Copiado',
  },
  insights: {
    intro: 'Esto es lo que los visitantes mencionan una y otra vez.',
    problem: s => `${plural(s.count, 'mensaje', 'mensajes')} sobre ${s.kind} en ${s.spot}.`,
    praise: s => `${s.count === 1 ? '1 visitante elogió' : `${s.count} visitantes elogiaron`} ${s.spot}.`,
    question: s => `${plural(s.count, 'pregunta', 'preguntas')} sobre ${s.spot}.`,
    none: 'Todavía nada se repite.',
    chips: { open: 'Mostrar', next: 'Siguiente' },
  },
  model: {
    download: s => `Leo los mensajes en este dispositivo. Hace falta una descarga de ${s.mb} MB y luego funciona sin conexión.`,
    downloadChip: s => `Descargar ${s.mb} MB`,
    withoutChip: 'Ubicarlo yo',
    downloading: s => `Descargando el modelo, ${s.done} de ${s.total} MB…`,
    reading: 'Leyendo…',
    notKept: 'Este dispositivo no pudo guardar el modelo. Aún puedes ubicarlo tú.',
    stopped: 'La descarga se detuvo. Puedes reintentar o ubicarlo tú.',
    failed: 'No se pudo cargar el modelo aquí. Aún puedes ubicarlo tú.',
    tryAgain: 'Reintentar',
  },
  missed: {
    ask: '¿Faltó algo en las fotos? Toca su punto en el mapa o cuéntamelo con tus palabras.',
    propose: s => `¿Agrego ${s.kind} ${s.where} a tu mapa?`,
    kindAsk: '¿Qué hay ahí?',
    here: s => `¿Qué hay en ${s.spot}?`,
    notFound: 'No pude saber dónde. Toca el punto en el mapa.',
    added: s => `Agregué ${s.kind} ${s.where}.`,
    chips: { yes: 'Agregar', no: 'No exactamente', done: 'Nada más' },
  },
  note: {
    say: 'Esta es la nota de la ruta para visitantes. Cambia a medida que revisas el recorrido.',
    empty: 'Nada en el recorrido necesita una nota todavía.',
    copy: 'Copiar',
    copied: 'Copiado',
  },
  input: { placeholder: 'Con tus palabras', send: 'Enviar' },
  restart: { chip: 'Empezar de nuevo', ask: '¿Borrar todo lo que hiciste en este lugar?', yes: 'Borrar', no: 'Conservar' },
  back: 'Atrás',
  notSaved: 'Este dispositivo no guardó el último cambio.',
};

export const SCRIPT: Record<UiLanguage, Script> = { en, es };
