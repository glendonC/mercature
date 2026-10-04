import type { UiLanguage } from '../site/contracts';
import type { EditKind } from '../edits/store';
import type { MarkKind } from '../ui/kinds';

/**
 * Everything the guide says on the route screen, in English and Spanish: fixed lines with typed slots, and the labels of the
 * choices she can tap. The engine in src/guide decides which step comes next and fills the slots from the place's records and
 * her own; nothing here is generated, and the guide never writes free text. "Model" means only the AI.
 * Slots arrive ready for prose: place names carry their article, numbers are whole, phrases are in the line's language.
 */

/** The conversation's steps, in the order a first visit meets them. */
export const STEPS = ['hello', 'check', 'checkEnd', 'messages', 'message', 'reply', 'missed', 'note'] as const;
export type StepId = (typeof STEPS)[number];

/** Her answers about one item of the walk check. The labels are here; what each does to her map is the engine's. */
export const CHECK_CHOICES = ['still', 'fixed', 'notBarrier', 'other'] as const;
export type CheckChoice = (typeof CHECK_CHOICES)[number];
/** What the model outlined at a flagged spot, in the words a visitor knows. */
export type Subject = 'steps' | 'kerb' | 'path';

/** The walk, for the greeting. */
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
};
/** One item of the walk check: a flagged spot, or a stretch with no photos. */
export type ItemSlots = {
  /** Its place in the check, from 1. */
  n: number;
  total: number;
  /** What was outlined, from words.subjects, such as "steps". */
  what: string;
  /** Where on the walk, such as "on Calle Loreto". */
  where: string;
  /** Metres from the start. */
  metres: number;
  /** Photos that show it. */
  photos: number;
};
/** Another kind a model marked near the walk, counted, such as "45 kerbs" from words.marks. */
export type KindSlots = { n: number; total: number; what: string; count: number };
/** Her answers once the check is through. */
export type TallySlots = { total: number; still: number; fixed: number; removed: number; skipped: number };
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
    /** A count of one kind of mark, such as (45) => "45 kerbs". */
    marks: Record<MarkKind, (count: number) => string>;
    /** The kinds she can give a spot, as chips. */
    kinds: Record<EditKind, string>;
    /** The same kinds inside a line, such as "a kerb". */
    added: Record<EditKind, string>;
    /** Message languages by code: en, es, ko, qu, other. */
    languages: Record<string, string>;
  };
  hello: {
    greet: (s: WalkSlots) => string;
    /** The walk in one or two lines: its length, its photos, what was found, how much might stop someone. */
    walk: (s: WalkSlots) => string;
    chips: { check: string; messages: string; missed: string; note: string };
  };
  check: {
    progress: (s: { n: number; total: number }) => string;
    /** A flagged spot: what the model outlined there when the walk was recorded. */
    saw: (s: ItemSlots) => string;
    /** A stretch no photo shows. */
    noPhotos: (s: ItemSlots) => string;
    /** Another kind near the walk. */
    kind: (s: KindSlots) => string;
    ask: (s: ItemSlots) => string;
    chips: Record<CheckChoice, string> & { next: string; skip: string };
    /** Her answer said back once her map shows it. other asks what it is; the kind chips follow. */
    done: Record<CheckChoice, (s: ItemSlots) => string>;
    end: (s: TallySlots) => string;
  };
  messages: {
    /** How many visitors wrote; none says there is nothing to answer. */
    intro: (s: { total: number }) => string;
    none: string;
    /** A message arrives; its words show below the line. */
    arrived: (s: MessageSlots) => string;
    /** The model's spot, before she confirms it. */
    spot: (s: SpotSlots) => string;
    remembered: (s: SpotSlots) => string;
    unsure: string;
    noSpot: string;
    unplaced: string;
    tap: string;
    filed: (s: SpotSlots) => string;
    chips: { yes: string; another: string; noSpot: string; next: string; skip: string };
  };
  reply: {
    say: (s: MessageSlots) => string;
    copy: string;
    copied: string;
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
  back: string;
  notSaved: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cap = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

const en: Script = {
  words: {
    subjects: { steps: 'steps', kerb: 'a kerb with no ramp in view', path: 'something on the path' },
    marks: {
      steps: n => plural(n, 'set of steps', 'sets of steps'), kerb: n => plural(n, 'kerb', 'kerbs'), broken: n => plural(n, 'patch of broken paving', 'patches of broken paving'),
      crossing: n => plural(n, 'crossing', 'crossings'), bollard: n => plural(n, 'bollard', 'bollards'), footway: n => plural(n, 'stretch of pavement', 'stretches of pavement'),
      cobblestones: n => plural(n, 'stretch of cobblestones', 'stretches of cobblestones'), road: n => plural(n, 'stretch of road', 'stretches of road'),
    },
    kinds: { steps: 'Steps', kerb: 'Kerb', narrow: 'Narrow', other: 'Something else' },
    added: { steps: 'steps', kerb: 'a kerb', narrow: 'a narrow part', other: 'something' },
    languages: { en: 'English', es: 'Spanish', ko: 'Korean', qu: 'Quechua', other: 'another language' },
  },
  hello: {
    greet: () => 'Hi. I can help you check this walk and answer visitors.',
    walk: s => `It runs ${s.metres} m from ${s.start} to ${s.target}, in ${s.photos} street photos. ${cap(plural(s.barriers, 'thing', 'things'))} in them might stop someone, at ${plural(s.spots, 'spot', 'spots')}.`,
    chips: { check: 'Check the walk', messages: 'Visitor messages', missed: 'Add what the photos missed', note: 'Route note' },
  },
  check: {
    progress: s => `${s.n} of ${s.total}`,
    saw: s => `When the walk was recorded, a model outlined ${s.what} here, ${s.where}.`,
    noPhotos: s => `No street photo shows this stretch, ${s.where}.`,
    kind: s => `A model also marked ${s.what} near the walk.`,
    ask: () => 'What is there now?',
    chips: { still: 'Still there', fixed: 'Fixed', notBarrier: 'Not a barrier', other: 'Something else', next: 'Next', skip: 'Skip' },
    done: {
      still: () => 'Kept on your map as a possible barrier.',
      fixed: () => 'Marked fixed. Replies and the route note will say so.',
      notBarrier: () => 'Taken off your map.',
      other: () => 'What is it?',
    },
    end: s => `That's all ${s.total}: ${s.still} kept, ${s.fixed} fixed, ${s.removed} taken off.`,
  },
  messages: {
    intro: s => s.total === 1 ? '1 visitor wrote about this walk.' : `${s.total} visitors wrote about this walk.`,
    none: 'No visitor messages yet. Paste one when it comes.',
    arrived: s => `A visitor wrote in ${s.language}:`,
    spot: s => `It seems to be about ${s.spot}. Is that right?`,
    remembered: s => `You filed a message like this on ${s.spot} before.`,
    unsure: 'Not sure which spot. Tap it on the map.',
    noSpot: 'It is not about one spot.',
    unplaced: 'Not sure. Tap the spot on the map, or ask the visitor.',
    tap: 'Tap the spot on the map.',
    filed: s => `Filed on ${s.spot}.`,
    chips: { yes: 'Yes, that spot', another: 'Another spot', noSpot: 'Not about a spot', next: 'Next message', skip: 'Skip' },
  },
  reply: {
    say: s => `Here is a reply in ${s.language}, from what your map says.`,
    copy: 'Copy',
    copied: 'Copied',
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
  back: 'Back',
  notSaved: 'This device did not keep the last change.',
};

const es: Script = {
  words: {
    subjects: { steps: 'escalones', kerb: 'un bordillo sin rampa visible', path: 'algo en el camino' },
    marks: {
      steps: n => plural(n, 'tramo de escalones', 'tramos de escalones'), kerb: n => plural(n, 'bordillo', 'bordillos'), broken: n => plural(n, 'parte de pavimento roto', 'partes de pavimento roto'),
      crossing: n => plural(n, 'cruce', 'cruces'), bollard: n => plural(n, 'bolardo', 'bolardos'), footway: n => plural(n, 'tramo de acera', 'tramos de acera'),
      cobblestones: n => plural(n, 'tramo empedrado', 'tramos empedrados'), road: n => plural(n, 'tramo de calzada', 'tramos de calzada'),
    },
    kinds: { steps: 'Escalones', kerb: 'Bordillo', narrow: 'Estrecho', other: 'Otra cosa' },
    added: { steps: 'escalones', kerb: 'un bordillo', narrow: 'una parte estrecha', other: 'algo' },
    languages: { en: 'inglés', es: 'español', ko: 'coreano', qu: 'quechua', other: 'otro idioma' },
  },
  hello: {
    greet: () => 'Hola. Puedo ayudarte a revisar este recorrido y responder a los visitantes.',
    walk: s => `Va de ${s.start} a ${s.target}, ${s.metres} m, en ${s.photos} fotos de la calle. ${cap(plural(s.barriers, 'cosa', 'cosas'))} en ellas podrían impedir el paso, en ${plural(s.spots, 'punto', 'puntos')}.`,
    chips: { check: 'Revisar el recorrido', messages: 'Mensajes de visitantes', missed: 'Agregar lo que faltó en las fotos', note: 'Nota de la ruta' },
  },
  check: {
    progress: s => `${s.n} de ${s.total}`,
    saw: s => `Al registrar el recorrido, un modelo marcó ${s.what} aquí, ${s.where}.`,
    noPhotos: s => `Ninguna foto de la calle muestra este tramo, ${s.where}.`,
    kind: s => `Un modelo también marcó ${s.what} cerca del recorrido.`,
    ask: () => '¿Qué hay ahora?',
    chips: { still: 'Sigue ahí', fixed: 'Arreglado', notBarrier: 'No es una barrera', other: 'Otra cosa', next: 'Siguiente', skip: 'Saltar' },
    done: {
      still: () => 'Queda en tu mapa como posible barrera.',
      fixed: () => 'Marcado como arreglado. Las respuestas y la nota de la ruta lo dirán.',
      notBarrier: () => 'Quitado de tu mapa.',
      other: () => '¿Qué es?',
    },
    end: s => `Eso es todo, ${s.total}: ${s.still} se quedan, ${s.fixed} arreglados, ${s.removed} quitados.`,
  },
  messages: {
    intro: s => s.total === 1 ? '1 visitante escribió sobre este recorrido.' : `${s.total} visitantes escribieron sobre este recorrido.`,
    none: 'Aún no hay mensajes de visitantes. Pega uno cuando llegue.',
    arrived: s => `Un visitante escribió en ${s.language}:`,
    spot: s => `Parece tratar de ${s.spot}. ¿Es correcto?`,
    remembered: s => `Antes ubicaste un mensaje parecido en ${s.spot}.`,
    unsure: 'Sin certeza del punto. Tócalo en el mapa.',
    noSpot: 'No trata de un punto concreto.',
    unplaced: 'Sin certeza. Toca el punto en el mapa o pregunta al visitante.',
    tap: 'Toca el punto en el mapa.',
    filed: s => `Ubicado en ${s.spot}.`,
    chips: { yes: 'Sí, ese punto', another: 'Otro punto', noSpot: 'No es un punto', next: 'Siguiente mensaje', skip: 'Saltar' },
  },
  reply: {
    say: s => `Esta es una respuesta en ${s.language}, según lo que dice tu mapa.`,
    copy: 'Copiar',
    copied: 'Copiado',
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
  back: 'Atrás',
  notSaved: 'Este dispositivo no guardó el último cambio.',
};

export const SCRIPT: Record<UiLanguage, Script> = { en, es };
