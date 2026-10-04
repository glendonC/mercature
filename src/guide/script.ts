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

const cap = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
/** A distance the way a person says it: 594 m is "about 600 m". */
const about = (m: number) => m < 100 ? Math.max(10, Math.round(m / 10) * 10) : m < 1000 ? Math.round(m / 50) * 50 : Math.round(m / 100) * 100;
/** A photo older than this may show a street that has changed since. */
const isOld = (when: string) => Number(when.slice(-4)) > 0 && Number(when.slice(-4)) < 2020;
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
const ASK_EN = `That's fine. Your route note will ask visitors to check with you first.`;
const ASK_ES = 'No pasa nada. Tu nota de la ruta les pedirá a los visitantes que te consulten antes.';

const en: Script = {
  words: {
    subjects: { steps: 'steps', kerb: 'a kerb with no ramp in view', path: 'something on the path' },
    access: {
      steps: 'steps', kerb: 'a kerb', uneven: 'uneven ground', steep: 'a steep part', narrow: 'a narrow place', bollard: 'a post or bollard', gate: 'a gate', noWheelchair: 'a place with no wheelchair access',
      broken: 'broken paving', works: 'roadworks', obstacle: 'something in the way', handrail: 'a handrail', ramp: 'a ramp', crossing: 'a crossing', bench: 'a bench', toilets: 'toilets', lighting: 'street lights', unseen: 'a part nobody has photographed',
    },
    affects: {
      steps: 'That can be hard for wheelchair users, strollers and walkers.',
      kerb: 'That can be hard for wheelchair users and strollers.',
      uneven: 'Uneven ground is tough on wheels, canes and walkers.',
      steep: 'Steep parts are hard on wheelchairs, strollers and anyone short of breath.',
      narrow: 'A narrow place can stop a wheelchair or a stroller.',
      bollard: 'Posts can block a wheelchair and trip someone who can’t see well.',
      gate: 'A closed gate can stop a wheelchair or a stroller.',
      noWheelchair: 'That matters most to wheelchair users.',
      broken: 'Broken paving is easy to trip on with a cane or poor eyesight.',
      works: 'Roadworks can block the way for anyone for a while.',
      obstacle: 'Things in the way can block a wheelchair or trip someone.',
      handrail: 'A handrail helps older visitors and anyone unsteady on steps.',
      ramp: 'A ramp helps wheelchair users and strollers.',
      crossing: 'Crossing traffic is harder for slow walkers and people who can’t see well.',
      bench: 'A bench gives older or tired visitors a rest.',
      toilets: 'Families and older visitors plan around toilets.',
      lighting: 'Lights help people who can’t see well after dark.',
      unseen: 'Nobody knows yet what visitors will find here.',
    },
    marks: {
      steps: n => `steps ${places_en(n)}`, kerb: n => `kerbs ${places_en(n)}`, broken: n => `broken paving ${places_en(n)}`,
      crossing: n => `crossings ${places_en(n)}`, bollard: n => `posts or bollards ${places_en(n)}`, footway: n => `pavement ${places_en(n)}`,
      cobblestones: n => `cobblestones ${places_en(n)}`, road: n => `the road ${places_en(n)}`,
    },
    kinds: { steps: 'Steps', kerb: 'Kerb', narrow: 'Narrow place', other: 'Something else' },
    added: { steps: 'steps', kerb: 'a kerb', narrow: 'a narrow place', other: 'something in the way' },
    languages: { en: 'English', es: 'Spanish', ko: 'Korean', qu: 'Quechua', other: 'another language' },
  },
  home: {
    greet: 'Hi. Search for where your walk goes, or open one of the walks below.',
    search: 'Where does your walk go?',
    open: s => `Open ${s.place}`,
  },
  reveal: {
    hello: s => `Hi. Here’s your walk to ${s.target}.`,
    photos: s => s.photos ? 'First, the street photos people have shared along the way.' : 'Nobody has shared street photos of it yet.',
    walk: s => `This is the way you walk, about ${about(s.metres)} m.`,
    reading: () => 'And this is what the photos show along it.',
    marks: s => s.barriers === 0 ? 'Nothing in the photos looks like a problem. We can still go through it.' : `${cap(count_en(s.spots, 'spot', 'spots'))} might be a problem for some visitors. Let’s look at them together.`,
  },
  hello: {
    greet: () => 'Let’s go through your walk together.',
    walk: s => `It’s about ${about(s.metres)} m from ${s.start} to ${s.target}. ${s.spots === 0 ? 'The street photos don’t show anything that looks like a problem.' : `The street photos show ${count_en(s.spots, 'spot', 'spots')} where some visitors might have trouble.`}`,
    mapOnly: s => `It’s about ${about(s.metres)} m from ${s.start} to ${s.target}. There are no street photos of it yet, but OpenStreetMap knows ${s.osm === 1 ? 'one thing' : s.osm <= 4 ? 'a few things' : 'quite a few things'} worth checking.`,
    altitude: s => `It’s high up here, about ${s.metres.toLocaleString('en')} m, so walking tires visitors faster.`,
    chips: { check: 'Go through the walk', messages: 'Read messages', missed: 'Add something I know', note: 'See the route note' },
  },
  select: {
    overview: () => 'This is your whole walk. Tap any spot or street to look closer.',
    spot: s => `${cap(s.what)} ${s.where}, ${s.metres < 10 ? 'right at the start' : `about ${about(s.metres)} m in`}.`,
    outline: s => `That looks like ${s.what}${s.when ? `, in a photo from ${s.when}` : ''}.`,
    street: s => `${s.street} isn’t part of your walk yet. Want to add it?`,
    next: 'Tap a spot or a street to look closer, or pick something below.',
  },
  check: {
    progress: s => `${s.n} of ${s.total}`,
    saw: s => `There might be ${s.what} here, ${s.where}.`,
    sawWhen: s => `There might be ${s.what} here, ${s.where}. ${s.photos === 1 ? 'This photo’s' : 'The newest photo’s'} from ${s.when}${isOld(s.when) ? ', so it may have changed' : ''}.`,
    noPhotos: s => `Nobody has taken a street photo of this part, ${s.where}, so we don’t know what’s there.`,
    kind: s => `The photos also show ${s.what}.`,
    osm: s => `OpenStreetMap shows ${s.what} here, ${s.where}.`,
    osmToo: s => `OpenStreetMap adds: ${s.osm}.`,
    noStreetPhotos: 'No street photo here yet.',
    ask: {
      getPast: () => 'How do your visitors get past these steps?',
      lowered: () => 'Is there a lowered kerb or a ramp nearby?',
      smoother: () => 'Is there a smoother side or street nearby?',
      through: () => 'Can a wheelchair or a stroller get through here?',
      temporary: () => 'Is it still there?',
      helpful: () => 'Is it still there?',
      unseen: () => 'Do you know what’s on this part?',
    },
    answers: {
      getPast: { wayAround: 'There’s a way around', handrail: 'There’s a handrail', help: 'We help them', noWay: 'No way around', notThere: 'There are no steps', unknown: 'I’m not sure' },
      lowered: { nearby: 'Yes, one nearby', none: 'No', notThere: 'There’s no kerb', unknown: 'I’m not sure' },
      smoother: { nearby: 'Yes, one nearby', none: 'No', unknown: 'I’m not sure' },
      through: { yes: 'Yes, they get through', no: 'No, they can’t', unknown: 'I’m not sure' },
      temporary: { still: 'It’s still there', repaired: 'It’s been fixed', gone: 'It’s gone', unknown: 'I’m not sure' },
      helpful: { still: 'It’s still there', gone: 'It’s gone', unknown: 'I’m not sure' },
      unseen: { nothing: 'Nothing in the way', something: 'There’s something', unknown: 'I’m not sure' },
    },
    said: {
      getPast: {
        wayAround: () => 'Got it. Your route note says there’s a way around, and to ask you.',
        handrail: () => 'Got it, there’s a handrail. That’s in your route note now.',
        help: () => 'Got it. Your route note says you help visitors here.',
        noWay: () => 'Okay. Your route note says there’s no way around these steps.',
        notThere: () => 'Thanks. I’ve taken it off your map.',
        unknown: () => ASK_EN,
      },
      lowered: {
        nearby: () => 'Got it. I’ve marked where it is.',
        none: () => 'Okay. Your route note says there’s no lowered kerb or ramp nearby.',
        notThere: () => 'Thanks. I’ve taken it off your map.',
        unknown: () => ASK_EN,
      },
      smoother: {
        nearby: () => 'Got it. I’ve marked the smoother way.',
        none: () => 'Okay. Your route note says there’s no smoother way nearby.',
        unknown: () => ASK_EN,
      },
      through: {
        yes: () => 'Got it. Your route note says a wheelchair or stroller gets through, going by what you know.',
        no: () => 'Got it. Your route note says a wheelchair or stroller can’t get through, going by what you know.',
        unknown: () => ASK_EN,
      },
      temporary: {
        still: () => 'Okay, it stays on your map.',
        repaired: () => 'Good news. I’ve marked it fixed as of today.',
        gone: () => 'Good. I’ve marked it gone as of today.',
        unknown: () => ASK_EN,
      },
      helpful: {
        still: () => 'Good. Your route note mentions it.',
        gone: () => 'Okay, I’ve taken it out of your route note.',
        unknown: () => 'That’s fine. I’ll leave it out of your route note for now.',
      },
      unseen: {
        nothing: () => 'Got it. Your route note says nothing’s in the way, going by what you know.',
        something: () => 'What’s there?',
        unknown: () => ASK_EN,
      },
    },
    tapWhere: () => 'Show me where on the map.',
    chips: { next: 'Next', skip: 'Skip for now' },
    words: s => `Should I add that as your note on ${s.spot}?`,
    noted: s => `Done. Visitors will see your note on ${s.spot}, in your words.`,
    end: s => `That’s the whole walk. Thanks for going through it.${s.skipped ? ' You can come back to the ones you skipped anytime.' : ''}`,
  },
  around: {
    offer: s => `OpenStreetMap suggests a way around these steps. It’s about ${about(s.metres)} m longer, and nobody has checked it yet.`,
    show: 'Here it is. It’s only a suggestion until someone walks it.',
    ask: 'You know these streets. Would it work for visitors who can’t manage steps?',
    kept: 'Good. Replies and your route note will mention it, as checked by you.',
    dropped: 'Okay, I won’t suggest it.',
    unchecked: 'Okay. I’ll keep it, but I won’t suggest it to visitors until you’ve checked it.',
    none: 'OpenStreetMap doesn’t know another way around these steps.',
    offline: 'I need internet to look for another way. Try again when you’re online.',
    chips: { show: 'Show me', works: 'Yes, it works', notWorks: 'No, it doesn’t', unknown: 'I’m not sure', better: 'I know a better way', notNow: 'Not now' },
  },
  street: {
    offer: 'Do your visitors use other streets too? You can add one.',
    start: 'Tap where it starts.',
    end: 'Now tap where it ends.',
    routing: 'Finding the way on foot…',
    found: s => `That’s about ${about(s.metres)} m on foot. There are no street photos of it yet. Keep it?`,
    kept: s => `Added ${s.street} to your map. We’ll go over it when you check the walk.`,
    failed: 'I couldn’t find a way on foot between those two points. Try tapping somewhere else.',
    offline: 'I need internet to add a street. Try again when you’re online.',
    chips: { add: 'Add a street', keep: 'Keep it', again: 'Try again', cancel: 'Cancel' },
  },
  narrow: { ask: 'Is there a narrow place anywhere on this walk?', chips: { yes: 'Yes, I’ll show you', no: 'No', unknown: 'I’m not sure' } },
  messages: {
    intro: s => s.total === 1 ? 'A visitor wrote to you about this walk.' : `${cap(n_en(s.total))} visitors wrote to you about this walk.`,
    none: 'No messages from visitors yet. When one comes in, paste it here.',
    arrived: s => `This one’s in ${s.language}:`,
    spot: s => `I think it’s about ${s.spot}. Is that right?`,
    remembered: s => `Last time, you put a message like this on ${s.spot}. Same place?`,
    earlier: s => `I read this one before and thought it was about ${s.spot}.`,
    unsure: 'I’m not sure which spot they mean. Can you tap it on the map?',
    noSpot: 'This one isn’t about a particular spot.',
    unplaced: 'I can’t tell where this is. You could ask the visitor, or tap the spot yourself.',
    tap: 'Tap the spot on the map.',
    filed: s => `Done. It’s on ${s.spot}.`,
    learned: 'Next time a message like this comes in, I’ll suggest that spot.',
    example: 'Example',
    translated: 'Machine-translated',
    paste: 'Paste what the visitor wrote',
    read: 'Read it',
    chips: { yes: 'Yes, that one', another: 'No, another spot', noSpot: 'It’s not about a spot', next: 'Next message', skip: 'Later', paste: 'Paste a message' },
  },
  reply: {
    say: s => `Here’s a reply in ${s.language}, based on your map. Copy it and send it when you’re ready.`,
    fallback: s => `I don’t have replies in ${s.language} yet, so here it is in ${s.reply}.`,
    copy: 'Copy',
    copied: 'Copied',
  },
  insights: {
    intro: 'Here’s what visitors keep bringing up.',
    problem: s => `${s.count === 1 ? 'One visitor' : `${cap(n_en(s.count))} visitors`} mentioned a problem at ${s.spot}.`,
    praise: s => `${s.count === 1 ? 'One visitor' : `${cap(n_en(s.count))} visitors`} liked ${s.spot}.`,
    question: s => `${s.count === 1 ? 'One visitor' : `${cap(n_en(s.count))} visitors`} asked about ${s.spot}.`,
    none: 'Nothing’s come up more than once yet.',
    chips: { open: 'Show me', next: 'Next' },
  },
  model: {
    download: s => `To read visitor messages, I need a one-time download of ${s.mb} MB. After that, I work here even without internet.`,
    downloadChip: s => `Download ${s.mb} MB`,
    withoutChip: 'I’ll place it myself',
    downloading: s => `Downloading… ${s.done} of ${s.total} MB`,
    reading: 'Reading it…',
    notKept: 'This device couldn’t keep the download. You can still place messages yourself.',
    stopped: 'The download stopped. Try again, or place it yourself.',
    failed: 'I couldn’t load here. You can still place it yourself.',
    tryAgain: 'Try again',
  },
  missed: {
    ask: 'Is there anything the photos missed? Tell me in your own words, or tap the spot on the map.',
    propose: s => `So, ${s.kind} ${s.where}. Should I add it to your map?`,
    kindAsk: 'What’s there?',
    here: s => `What’s at ${s.spot}?`,
    notFound: 'I couldn’t tell where that is. Can you tap it on the map?',
    added: s => `Added ${s.kind} ${s.where}. It’ll show in your route note too.`,
    chips: { yes: 'Yes, add it', no: 'Not quite', done: 'That’s all' },
  },
  note: {
    say: 'Here’s your route note for visitors. It updates as you check the walk.',
    empty: 'Nothing to tell visitors yet.',
    copy: 'Copy',
    copied: 'Copied',
  },
  input: { placeholder: 'Type in your own words', send: 'Send' },
  restart: { chip: 'Start over', ask: 'Clear everything you’ve done on this walk?', yes: 'Clear it', no: 'Keep it' },
  back: 'Back',
  notSaved: 'That last change didn’t save on this device.',
};

const es: Script = {
  words: {
    subjects: { steps: 'escalones', kerb: 'un bordillo sin rampa visible', path: 'algo en el camino' },
    access: {
      steps: 'escalones', kerb: 'un bordillo', uneven: 'suelo disparejo', steep: 'una subida empinada', narrow: 'un paso angosto', bollard: 'un poste o bolardo', gate: 'un portón', noWheelchair: 'un lugar sin acceso en silla de ruedas',
      broken: 'acera rota', works: 'obras', obstacle: 'algo que estorba', handrail: 'un pasamanos', ramp: 'una rampa', crossing: 'un cruce peatonal', bench: 'una banca', toilets: 'baños', lighting: 'alumbrado', unseen: 'una parte sin fotos',
    },
    affects: {
      steps: 'Puede ser difícil en silla de ruedas, con coche de bebé o con andador.',
      kerb: 'Puede ser difícil en silla de ruedas o con coche de bebé.',
      uneven: 'El suelo disparejo cuesta con ruedas, bastón o andador.',
      steep: 'Las subidas cuestan en silla de ruedas, con coche de bebé y a quien se agita al subir.',
      narrow: 'Un paso angosto puede frenar una silla de ruedas o un coche de bebé.',
      bollard: 'Un poste puede cerrar el paso a una silla de ruedas y hacer tropezar a quien ve poco.',
      gate: 'Un portón cerrado puede frenar una silla de ruedas o un coche de bebé.',
      noWheelchair: 'Eso importa sobre todo a quien usa silla de ruedas.',
      broken: 'Con bastón o con poca vista, es fácil tropezar en una acera rota.',
      works: 'Las obras pueden cerrar el paso a cualquiera por un tiempo.',
      obstacle: 'Algo en el camino puede frenar una silla de ruedas o hacer tropezar a alguien.',
      handrail: 'Un pasamanos ayuda a las personas mayores y a quien no pisa seguro en los escalones.',
      ramp: 'Una rampa ayuda en silla de ruedas y con coche de bebé.',
      crossing: 'Cruzar el tráfico cuesta más a quien camina despacio o ve poco.',
      bench: 'Una banca da un descanso a las personas mayores o cansadas.',
      toilets: 'Las familias y las personas mayores planean el paseo según los baños.',
      lighting: 'La luz ayuda de noche a quien ve poco.',
      unseen: 'Todavía nadie sabe qué van a encontrar aquí los visitantes.',
    },
    marks: {
      steps: n => `escalones ${places_es(n)}`, kerb: n => `bordillos ${places_es(n)}`, broken: n => `acera rota ${places_es(n)}`,
      crossing: n => `cruces peatonales ${places_es(n)}`, bollard: n => `postes o bolardos ${places_es(n)}`, footway: n => `acera ${places_es(n)}`,
      cobblestones: n => `empedrado ${places_es(n)}`, road: n => `calzada ${places_es(n)}`,
    },
    kinds: { steps: 'Escalones', kerb: 'Bordillo', narrow: 'Paso angosto', other: 'Otra cosa' },
    added: { steps: 'escalones', kerb: 'un bordillo', narrow: 'un paso angosto', other: 'algo que estorba' },
    languages: { en: 'inglés', es: 'español', ko: 'coreano', qu: 'quechua', other: 'otro idioma' },
  },
  home: {
    greet: '¡Hola! Busca adónde va tu recorrido o abre uno de los de abajo.',
    search: '¿Adónde va tu recorrido?',
    open: s => `Abrir ${s.place}`,
  },
  reveal: {
    hello: s => `¡Hola! Este es tu recorrido hasta ${s.target}.`,
    photos: s => s.photos ? 'Primero, las fotos de la calle que la gente compartió en el camino.' : 'Todavía nadie compartió fotos de la calle de este camino.',
    walk: s => `Este es el camino que haces, unos ${about(s.metres)} m.`,
    reading: () => 'Y esto es lo que muestran las fotos en el camino.',
    marks: s => s.barriers === 0 ? 'Nada en las fotos parece un problema. Igual podemos revisarlo.' : `${cap(count_es(s.spots, 'punto podría', 'puntos podrían'))} ser un problema para algunos visitantes. Veámoslos juntos.`,
  },
  hello: {
    greet: () => 'Revisemos juntos tu recorrido.',
    walk: s => `Son unos ${about(s.metres)} m desde ${s.start} hasta ${s.target}. ${s.spots === 0 ? 'En las fotos de la calle no se ve nada que parezca un problema.' : `En las fotos de la calle hay ${count_es(s.spots, 'punto', 'puntos')} donde algunos visitantes podrían tener problemas.`}`,
    mapOnly: s => `Son unos ${about(s.metres)} m desde ${s.start} hasta ${s.target}. Todavía no hay fotos de la calle, pero OpenStreetMap conoce ${s.osm === 1 ? 'una cosa' : s.osm <= 4 ? 'algunas cosas' : 'varias cosas'} que vale la pena revisar.`,
    altitude: s => `Aquí estamos a unos ${s.metres.toLocaleString('es')} m de altura, así que caminar cansa más.`,
    chips: { check: 'Revisar el recorrido', messages: 'Leer mensajes', missed: 'Agregar algo que sé', note: 'Ver la nota de la ruta' },
  },
  select: {
    overview: () => 'Este es todo tu recorrido. Toca un punto o una calle para verlo de cerca.',
    spot: s => `${cap(s.what)} ${s.where}, ${s.metres < 10 ? 'justo al inicio' : `a unos ${about(s.metres)} m de la salida`}.`,
    outline: s => `Parece que hay ${s.what}${s.when ? `, en una foto de ${s.when}` : ''}.`,
    street: s => `${cap(s.street)} todavía no es parte de tu recorrido. ¿La agregamos?`,
    next: 'Toca un punto o una calle para verlo de cerca, o elige algo abajo.',
  },
  check: {
    progress: s => `${s.n} de ${s.total}`,
    saw: s => `Puede que haya ${s.what} aquí, ${s.where}.`,
    sawWhen: s => `Puede que haya ${s.what} aquí, ${s.where}. ${s.photos === 1 ? 'Esta foto es' : 'La foto más reciente es'} de ${s.when}${isOld(s.when) ? ', así que puede haber cambiado' : ''}.`,
    noPhotos: s => `Nadie ha tomado una foto de la calle en esta parte, ${s.where}, así que no sabemos qué hay.`,
    kind: s => `Las fotos también muestran ${s.what}.`,
    osm: s => `Según OpenStreetMap, aquí hay ${s.what}, ${s.where}.`,
    osmToo: s => `Además, según OpenStreetMap: ${s.osm}.`,
    noStreetPhotos: 'Todavía no hay fotos de la calle aquí.',
    ask: {
      getPast: () => '¿Cómo pasan tus visitantes estos escalones?',
      lowered: () => '¿Hay un bordillo rebajado o una rampa cerca?',
      smoother: () => '¿Hay un lado o una calle más pareja cerca?',
      through: () => '¿Pasa por aquí una silla de ruedas o un coche de bebé?',
      temporary: () => '¿Sigue ahí?',
      helpful: () => '¿Sigue ahí?',
      unseen: () => '¿Sabes qué hay en esta parte?',
    },
    answers: {
      getPast: { wayAround: 'Hay otro camino', handrail: 'Hay pasamanos', help: 'Los ayudamos', noWay: 'No hay otro camino', notThere: 'No hay escalones ahí', unknown: 'No sé' },
      lowered: { nearby: 'Sí, hay uno cerca', none: 'No', notThere: 'No hay bordillo ahí', unknown: 'No sé' },
      smoother: { nearby: 'Sí, hay uno cerca', none: 'No', unknown: 'No sé' },
      through: { yes: 'Sí, pasan', no: 'No, no pasan', unknown: 'No sé' },
      temporary: { still: 'Sigue ahí', repaired: 'Ya lo arreglaron', gone: 'Ya no está', unknown: 'No sé' },
      helpful: { still: 'Sigue ahí', gone: 'Ya no está', unknown: 'No sé' },
      unseen: { nothing: 'Nada que estorbe', something: 'Hay algo', unknown: 'No sé' },
    },
    said: {
      getPast: {
        wayAround: () => 'Entendido. Tu nota de la ruta dice que hay otro camino y que te pregunten.',
        handrail: () => 'Entendido, hay pasamanos. Ya está en tu nota de la ruta.',
        help: () => 'Entendido. Tu nota de la ruta dice que ayudas a los visitantes aquí.',
        noWay: () => 'De acuerdo. Tu nota de la ruta dice que no hay otro camino.',
        notThere: () => 'Gracias. Ya lo quité de tu mapa.',
        unknown: () => ASK_ES,
      },
      lowered: {
        nearby: () => 'Entendido. Ya marqué dónde está.',
        none: () => 'De acuerdo. Tu nota de la ruta dice que no hay bordillo rebajado ni rampa cerca.',
        notThere: () => 'Gracias. Ya lo quité de tu mapa.',
        unknown: () => ASK_ES,
      },
      smoother: {
        nearby: () => 'Entendido. Ya marqué el camino más parejo.',
        none: () => 'De acuerdo. Tu nota de la ruta dice que no hay un camino más parejo cerca.',
        unknown: () => ASK_ES,
      },
      through: {
        yes: () => 'Entendido. Tu nota de la ruta dice que pasa una silla de ruedas o un coche de bebé, según lo que tú sabes.',
        no: () => 'Entendido. Tu nota de la ruta dice que no pasa una silla de ruedas ni un coche de bebé, según lo que tú sabes.',
        unknown: () => ASK_ES,
      },
      temporary: {
        still: () => 'De acuerdo, sigue en tu mapa.',
        repaired: () => 'Buena noticia. Lo marqué como arreglado desde hoy.',
        gone: () => 'Bien. Lo marqué como que ya no está, desde hoy.',
        unknown: () => ASK_ES,
      },
      helpful: {
        still: () => 'Bien. Tu nota de la ruta lo menciona.',
        gone: () => 'De acuerdo, ya lo saqué de tu nota de la ruta.',
        unknown: () => 'No pasa nada. Por ahora lo dejo fuera de tu nota de la ruta.',
      },
      unseen: {
        nothing: () => 'Entendido. Tu nota de la ruta dice que no hay nada que estorbe, según lo que tú sabes.',
        something: () => '¿Qué hay?',
        unknown: () => ASK_ES,
      },
    },
    tapWhere: () => 'Muéstrame dónde, en el mapa.',
    chips: { next: 'Siguiente', skip: 'Omitir por ahora' },
    words: s => `¿Lo guardo como tu nota en ${s.spot}?`,
    noted: s => `Listo. Los visitantes verán tu nota en ${s.spot}, con tus palabras.`,
    end: s => `Ese es todo el recorrido. Gracias por revisarlo.${s.skipped ? ' Puedes volver cuando quieras a los que omitiste.' : ''}`,
  },
  around: {
    offer: s => `OpenStreetMap sugiere otro camino que evita estos escalones. Son unos ${about(s.metres)} m más y nadie lo ha revisado todavía.`,
    show: 'Aquí está. Es solo una sugerencia hasta que alguien lo camine.',
    ask: 'Tú conoces estas calles. ¿Les serviría a los visitantes que no pueden con escalones?',
    kept: 'Bien. Las respuestas y tu nota de la ruta lo mencionarán, revisado por ti.',
    dropped: 'De acuerdo, no lo voy a sugerir.',
    unchecked: 'De acuerdo. Lo guardo, pero no se lo sugeriré a los visitantes hasta que lo revises.',
    none: 'OpenStreetMap no conoce otro camino que evite estos escalones.',
    offline: 'Necesito internet para buscar otro camino. Inténtalo cuando tengas conexión.',
    chips: { show: 'Muéstramelo', works: 'Sí, sirve', notWorks: 'No, no sirve', unknown: 'No sé', better: 'Conozco uno mejor', notNow: 'Ahora no' },
  },
  street: {
    offer: '¿Tus visitantes también usan otras calles? Puedes agregar una.',
    start: 'Toca dónde empieza.',
    end: 'Ahora toca dónde termina.',
    routing: 'Buscando el camino a pie…',
    found: s => `Son unos ${about(s.metres)} m a pie. Todavía no hay fotos de la calle. ¿La guardo?`,
    kept: s => `Listo, agregué ${s.street} a tu mapa. La veremos cuando revises el recorrido.`,
    failed: 'No encontré un camino a pie entre esos dos puntos. Prueba tocando en otro lugar.',
    offline: 'Necesito internet para agregar una calle. Inténtalo cuando tengas conexión.',
    chips: { add: 'Agregar una calle', keep: 'Guardarla', again: 'Intentar de nuevo', cancel: 'Cancelar' },
  },
  narrow: { ask: '¿Hay algún paso angosto en el recorrido?', chips: { yes: 'Sí, te muestro', no: 'No', unknown: 'No sé' } },
  messages: {
    intro: s => s.total === 1 ? 'Un visitante te escribió sobre este recorrido.' : `${cap(count_es(s.total, 'visitante te escribió', 'visitantes te escribieron'))} sobre este recorrido.`,
    none: 'Todavía no hay mensajes de visitantes. Cuando llegue uno, pégalo aquí.',
    arrived: s => `Este está en ${s.language}:`,
    spot: s => `Creo que habla ${de(s.spot)}. ¿Es así?`,
    remembered: s => `La última vez pusiste un mensaje parecido en ${s.spot}. ¿Es el mismo lugar?`,
    earlier: s => `Ya lo leí antes y creí que hablaba ${de(s.spot)}.`,
    unsure: 'No sé bien de qué punto habla. ¿Lo tocas en el mapa?',
    noSpot: 'Este no habla de un punto en particular.',
    unplaced: 'No sé bien dónde es. Puedes preguntarle al visitante o tocar el punto tú.',
    tap: 'Toca el punto en el mapa.',
    filed: s => `Listo, quedó en ${s.spot}.`,
    learned: 'La próxima vez que llegue un mensaje parecido, te sugeriré ese punto.',
    example: 'Ejemplo',
    translated: 'Traducción automática',
    paste: 'Pega lo que escribió el visitante',
    read: 'Leer',
    chips: { yes: 'Sí, ese', another: 'No, otro punto', noSpot: 'No es de un punto', next: 'Siguiente mensaje', skip: 'Después', paste: 'Pegar un mensaje' },
  },
  reply: {
    say: s => `Aquí tienes una respuesta en ${s.language}, según tu mapa. Cópiala y envíala cuando quieras.`,
    fallback: s => `Todavía no tengo respuestas en ${s.language}, así que aquí está en ${s.reply}.`,
    copy: 'Copiar',
    copied: 'Copiado',
  },
  insights: {
    intro: 'Esto es lo que más mencionan los visitantes.',
    problem: s => `${cap(count_es(s.count, 'visitante mencionó', 'visitantes mencionaron'))} un problema en ${s.spot}.`,
    praise: s => `${cap(count_es(s.count, 'visitante elogió', 'visitantes elogiaron'))} ${s.spot}.`,
    question: s => `${cap(count_es(s.count, 'visitante preguntó', 'visitantes preguntaron'))} por ${s.spot}.`,
    none: 'Todavía nada se repite.',
    chips: { open: 'Muéstrame', next: 'Siguiente' },
  },
  model: {
    download: s => `Para leer los mensajes de los visitantes necesito una descarga única de ${s.mb} MB. Después funciono aquí, incluso sin internet.`,
    downloadChip: s => `Descargar ${s.mb} MB`,
    withoutChip: 'Lo ubico yo',
    downloading: s => `Descargando… ${s.done} de ${s.total} MB`,
    reading: 'Leyéndolo…',
    notKept: 'Este dispositivo no pudo guardar la descarga. Igual puedes ubicar los mensajes tú.',
    stopped: 'La descarga se detuvo. Inténtalo de nuevo o ubícalo tú.',
    failed: 'No pude cargar aquí. Igual puedes ubicarlo tú.',
    tryAgain: 'Reintentar',
  },
  missed: {
    ask: '¿Hay algo que no sale en las fotos? Cuéntamelo con tus palabras o toca el punto en el mapa.',
    propose: s => `Entonces, ${s.kind} ${s.where}. ¿Lo agrego a tu mapa?`,
    kindAsk: '¿Qué hay ahí?',
    here: s => `¿Qué hay en ${s.spot}?`,
    notFound: 'No supe decir dónde es. ¿Lo tocas en el mapa?',
    added: s => `Listo, agregué ${s.kind} ${s.where}. También saldrá en tu nota de la ruta.`,
    chips: { yes: 'Sí, agrégalo', no: 'No del todo', done: 'Eso es todo' },
  },
  note: {
    say: 'Esta es tu nota de la ruta para los visitantes. Se actualiza a medida que revisas el recorrido.',
    empty: 'Todavía no hay nada que contarles a los visitantes.',
    copy: 'Copiar',
    copied: 'Copiado',
  },
  input: { placeholder: 'Escribe con tus palabras', send: 'Enviar' },
  restart: { chip: 'Empezar de nuevo', ask: '¿Borro todo lo que hiciste en este recorrido?', yes: 'Sí, borrar', no: 'No, conservar' },
  back: 'Volver',
  notSaved: 'Ese último cambio no se guardó en este dispositivo.',
};

export const SCRIPT: Record<UiLanguage, Script> = { en, es };
