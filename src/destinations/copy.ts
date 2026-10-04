import type { MessageKind, UiLanguage } from '../site/contracts';
import type { EditKind } from '../edits/store';
import { KIND_WORDS } from '../edits/words';
import { esPlace } from '../i18n/names';

export { esPlace };

export type UiLang = UiLanguage;
export type VisitorLang = 'en' | 'es' | 'ko';

/** The route screen's strings. The Spanish is unreviewed by a native speaker. */
export const COPY = {
  en: {
    workspace: 'Route workspace', walk: (from: string, m: number) => `From ${enPlace(from)}, ${m} m on foot`,
    range: (from: number, to: number) => `${from} to ${to} m`, noPhotos: 'No photos here', mapRecord: 'OpenStreetMap record, unverified',
    map: { zoomIn: 'Zoom map in', zoomOut: 'Zoom map out', fit: 'Whole route', credit: '© OpenStreetMap contributors' },
    pageOf: (n: number, total: number) => `${n} of ${total}`, previous: 'Previous', next: 'Next', whole: 'Show the whole photo', closer: 'Show the marked part',
    message: 'Visitor message', messagePlaceholder: 'Paste or type what the visitor wrote', language: 'Message language',
    withoutAi: 'Use without AI', noModel: 'The model could not load here. You can still file it yourself.', notKept: 'This device could not keep the model. You can still file it yourself.', stopped: 'The download stopped. You can try again or file it yourself.', tryAgain: 'Try again', download: (mb: number) => `Download ${mb} MB`, downloadProgress: (done: number, total: number) => `${done} of ${total} MB`, downloading: 'Downloading the model…',
    kinds: { problem: 'Problem', praise: 'Praise', question: 'Question' } as Record<MessageKind, string>, maybe: (kind: string) => `${kind}?`,
    copyFailed: 'Copy the text above. The clipboard is not available.', notSaved: 'This device did not keep the last change.',
    inbox: {
      messages: 'Messages', add: 'Add a message', example: 'Example', translated: 'Machine-translated', unread: 'Not read yet', notFiled: 'Not filed', back: 'All messages', readEarlier: 'Read earlier',
      guide: 'Tap a marker for its photo, or open a message.', guideMapOnly: 'Tap a marker, or open a message.', start: 'Start',
      found: 'Found along the walk', kinds: { steps: 'Steps', kerb: 'Kerb', path: 'On the path', noPhotos: 'No photos' } as Record<Subject | 'noPhotos', string>,
      raised: 'Visitors raise', scanned: 'Model marks near the walk', scannedKinds: (n: number) => n === 1 ? '1 kind' : `${n} kinds`, flaggedSpots: 'Flagged spots', note: 'Route note for visitors', copy: 'Copy', copied: 'Copied',
      paste: 'Paste what a visitor wrote.', read: 'Read message', cancel: 'Cancel',
      about: 'About', reply: 'Reply', copyReply: 'Copy reply', filed: (spot: string) => `Filed on ${spot}`, placed: 'Filed',
      line: { reading: 'Reading the message…', ready: 'Filed on the closest match. Tap another spot to move it.', unsure: 'Not sure which spot. Tap it on the map.', none: 'Not sure. Ask the visitor, or tap the spot on the map.', noSpot: 'This message is not about one spot.', manual: 'Tap the spot on the map.', remembered: 'The first spot is where you linked a similar message before.', linked: 'Filed. The reply below uses what your map says.', unreadable: 'This language cannot be read here yet. Tap the spot on the map, or ask the visitor.' },
      visitors: (n: number) => n ? `${n} ${n === 1 ? 'message' : 'messages'} from visitors` : 'No visitor messages here yet',
      suggestion: 'Model suggestion', remove: 'Remove', restore: 'Put back', removed: 'Removed from your map',
      addHere: 'Add a spot here', clearHere: 'Nothing flagged on this stretch',
      startOver: 'Start over', startOverAsk: 'Clear every message and edit for this place?', clear: 'Clear', keep: 'Keep',
      languages: { en: 'English', es: 'Spanish', ko: 'Korean', qu: 'Quechua', other: 'Other' } as Record<string, string>,
    },
  },
  es: {
    workspace: 'Espacio de la ruta', walk: (from: string, m: number) => `Desde ${esPlace(from)}, ${m} m a pie`,
    range: (from: number, to: number) => `${from} a ${to} m`, noPhotos: 'No hay fotos aquí', mapRecord: 'Registro de OpenStreetMap, sin verificar',
    map: { zoomIn: 'Acercar el mapa', zoomOut: 'Alejar el mapa', fit: 'Toda la ruta', credit: '© colaboradores de OpenStreetMap' },
    pageOf: (n: number, total: number) => `${n} de ${total}`, previous: 'Anterior', next: 'Siguiente', whole: 'Ver la foto entera', closer: 'Ver la parte marcada',
    message: 'Mensaje del visitante', messagePlaceholder: 'Pega o escribe lo que escribió el visitante', language: 'Idioma del mensaje',
    withoutAi: 'Usar sin IA', noModel: 'No se pudo cargar el modelo aquí. Aún puedes ubicarlo tú.', notKept: 'Este dispositivo no pudo guardar el modelo. Aún puedes ubicarlo tú.', stopped: 'La descarga se detuvo. Puedes reintentar o ubicarlo tú.', tryAgain: 'Reintentar', download: (mb: number) => `Descargar ${mb} MB`, downloadProgress: (done: number, total: number) => `${done} de ${total} MB`, downloading: 'Descargando el modelo…',
    kinds: { problem: 'Problema', praise: 'Elogio', question: 'Pregunta' } as Record<MessageKind, string>, maybe: (kind: string) => `¿${kind}?`,
    copyFailed: 'Copia el texto de arriba. El portapapeles no está disponible.', notSaved: 'Este dispositivo no guardó el último cambio.',
    inbox: {
      messages: 'Mensajes', add: 'Agregar un mensaje', example: 'Ejemplo', translated: 'Traducción automática', unread: 'Sin leer', notFiled: 'Sin ubicar', back: 'Todos los mensajes', readEarlier: 'Leído antes',
      guide: 'Toca un marcador para ver su foto o abre un mensaje.', guideMapOnly: 'Toca un marcador o abre un mensaje.', start: 'Salida',
      found: 'Hallazgos en el recorrido', kinds: { steps: 'Escalones', kerb: 'Bordillo', path: 'En el camino', noPhotos: 'Sin fotos' } as Record<Subject | 'noPhotos', string>,
      raised: 'Los visitantes mencionan', scanned: 'Marcas del modelo cerca del recorrido', scannedKinds: (n: number) => n === 1 ? '1 tipo' : `${n} tipos`, flaggedSpots: 'Puntos señalados', note: 'Nota de la ruta para visitantes', copy: 'Copiar', copied: 'Copiado',
      paste: 'Pega lo que escribió un visitante.', read: 'Leer mensaje', cancel: 'Cancelar',
      about: 'Se refiere a', reply: 'Respuesta', copyReply: 'Copiar respuesta', filed: (spot: string) => `Ubicado en ${spot}`, placed: 'Ubicado',
      line: { reading: 'Leyendo el mensaje…', ready: 'Ubicado en el punto más probable. Toca otro punto para moverlo.', unsure: 'Sin certeza del punto. Tócalo en el mapa.', none: 'Sin certeza. Pregunta al visitante o toca el punto en el mapa.', noSpot: 'Este mensaje no trata de un punto concreto.', manual: 'Toca el punto en el mapa.', remembered: 'El primer punto es donde antes enlazaste un mensaje parecido.', linked: 'Ubicado. La respuesta de abajo usa lo que dice tu mapa.', unreadable: 'Este idioma aún no se puede leer aquí. Toca el punto en el mapa o pregunta al visitante.' },
      visitors: (n: number) => n ? `${n} ${n === 1 ? 'mensaje' : 'mensajes'} de visitantes` : 'Aún no hay mensajes de visitantes aquí',
      suggestion: 'Sugerencia del modelo', remove: 'Quitar', restore: 'Restaurar', removed: 'Quitado de tu mapa',
      addHere: 'Agregar un punto aquí', clearHere: 'Nada señalado en este tramo',
      startOver: 'Empezar de nuevo', startOverAsk: '¿Borrar todos los mensajes y cambios de este lugar?', clear: 'Borrar', keep: 'Conservar',
      languages: { en: 'Inglés', es: 'Español', ko: 'Coreano', qu: 'Quechua', other: 'Otro' } as Record<string, string>,
    },
  },
} as const;
export type Copy = (typeof COPY)[UiLang];

/** What a decided spot is about, in words a visitor knows. */
export type Subject = 'steps' | 'kerb' | 'path';
export type Where = { en: string; es: string; ko: string };

/**
 * Fixed visitor-facing templates. Nothing is generated: each decision picks one sentence.
 * The Spanish and Korean wording is unreviewed by native speakers.
 */
/** What the photos show at a flagged spot. "No ramp" is what is in view, never a fact about the place. */
export const SUBJECTS: Record<Subject, Where> = {
  steps: { en: 'steps', es: 'escalones', ko: '계단' },
  kerb: { en: 'a kerb with no ramp in view', es: 'un bordillo sin rampa visible', ko: '경사로가 보이지 않는 연석' },
  path: { en: 'something on the path', es: 'algo en el camino', ko: '길 위의 장애물' },
};
/** What OpenStreetMap records at a flagged spot. */
const MAPPED: Record<Subject, Where> = { steps: SUBJECTS.steps, kerb: { en: 'a raised kerb', es: 'un bordillo alto', ko: '높은 연석' }, path: SUBJECTS.path };
export const NOTE = {
  title: { en: (from: string, to: string, m: number) => `${cap(enPlace(from))} to ${enPlace(to)}, about ${m} m on foot.`, es: (from: string, to: string, m: number) => `Desde ${esPlace(from)} hasta ${esPlace(to)}, unos ${m} m a pie.`, ko: (from: string, to: string, m: number) => `${from}에서 ${to}까지 걸어서 약 ${m}m입니다.` },
  /** A spot the model flagged: what street photos show there, which nobody has checked. Under 10 m along, it is at the start of the walk, never "about 0 m". */
  barrier: {
    en: (s: Subject, w: Where, m: number) => m < 10 ? `Street photos show ${SUBJECTS[s].en} ${w.en}, at the start of the walk.` : `Street photos show ${SUBJECTS[s].en} ${w.en}, about ${m} m along the walk.`,
    es: (s: Subject, w: Where, m: number) => m < 10 ? `Las fotos de la calle muestran ${SUBJECTS[s].es} ${w.es}, al inicio del recorrido.` : `Las fotos de la calle muestran ${SUBJECTS[s].es} ${w.es}, a unos ${m} m del inicio.`,
    ko: (s: Subject, w: Where, m: number) => m < 10 ? `거리 사진에 출발점, ${w.ko} 근처 ${SUBJECTS[s].ko}이 보입니다.` : `거리 사진에 출발점에서 약 ${m}m, ${w.ko} 근처 ${SUBJECTS[s].ko}이 보입니다.`,
  },
  /** A spot flagged only by OpenStreetMap tags: what the map records there, which nobody has checked. */
  mapped: {
    en: (s: Subject, w: Where, m: number) => m < 10 ? `OpenStreetMap records ${MAPPED[s].en} ${w.en}, at the start of the walk.` : `OpenStreetMap records ${MAPPED[s].en} ${w.en}, about ${m} m along the walk.`,
    es: (s: Subject, w: Where, m: number) => m < 10 ? `OpenStreetMap registra ${MAPPED[s].es} ${w.es}, al inicio del recorrido.` : `OpenStreetMap registra ${MAPPED[s].es} ${w.es}, a unos ${m} m del inicio.`,
    ko: (s: Subject, w: Where, m: number) => m < 10 ? `OpenStreetMap에 출발점, ${w.ko} 근처 ${MAPPED[s].ko}이 기록되어 있습니다.` : `OpenStreetMap에 출발점에서 약 ${m}m, ${w.ko} 근처 ${MAPPED[s].ko}이 기록되어 있습니다.`,
  },
  /** A spot she added: her own record, in plain words. */
  added: {
    en: (kind: EditKind, w: Where, m: number) => m < 10 ? `${cap(KIND_WORDS[kind].en)} ${w.en}, at the start of the walk.` : `${cap(KIND_WORDS[kind].en)} ${w.en}, about ${m} m along the walk.`,
    es: (kind: EditKind, w: Where, m: number) => m < 10 ? `${cap(KIND_WORDS[kind].es)} ${w.es}, al inicio del recorrido.` : `${cap(KIND_WORDS[kind].es)} ${w.es}, a unos ${m} m del inicio.`,
    ko: (kind: EditKind, w: Where, m: number) => m < 10 ? `출발점, ${w.ko} 근처에 ${KIND_WORDS[kind].ko}이 있습니다.` : `출발점에서 약 ${m}m, ${w.ko} 근처에 ${KIND_WORDS[kind].ko}이 있습니다.`,
  },
  steps: { en: 'Ask us if steps are hard for you.', es: 'Pregúntenos si los escalones le resultan difíciles.', ko: '계단이 힘드시면 미리 문의해 주세요.' },
  basis: { en: 'From street photos, not measurements.', es: 'Según fotos de la calle, no mediciones.', ko: '측정이 아닌 거리 사진을 바탕으로 합니다.' },
  basisMapped: { en: 'From OpenStreetMap, not measurements or street photos.', es: 'Según OpenStreetMap, no mediciones ni fotos de la calle.', ko: '측정이나 거리 사진이 아닌 OpenStreetMap을 바탕으로 합니다.' },
};
export const REPLY = {
  /** thing: what the photos show (SUBJECTS) at a flagged spot, or her own words (KIND_WORDS) at a spot she added. */
  barrier: {
    en: (thing: string, w: Where) => `Thank you. We've added a note about ${thing} ${w.en} so future visitors know before they go. Ask us if steps are hard for you.`,
    es: (thing: string, w: Where) => `Gracias. Agregamos una nota sobre ${thing} ${w.es} para que los próximos visitantes lo sepan antes de ir. Pregúntenos si los escalones le resultan difíciles.`,
    ko: (thing: string, w: Where) => `감사합니다. 다음 방문객이 미리 알 수 있도록 ${w.ko} 근처 ${thing}에 대한 안내를 추가했습니다. 계단이 힘드시면 미리 문의해 주세요.`,
  },
  'not-barrier': {
    en: () => 'Thank you for telling us. We checked the photos of that spot and saw no barrier.',
    es: () => 'Gracias por avisarnos. Revisamos las fotos de ese lugar y no vimos ninguna barrera.',
    ko: () => '알려 주셔서 감사합니다. 그 장소의 사진을 확인했지만 장애물은 보이지 않았습니다.',
  },
  'not-barrier-mapped': {
    en: () => 'Thank you for telling us. We checked that spot and saw no barrier.',
    es: () => 'Gracias por avisarnos. Revisamos ese lugar y no vimos ninguna barrera.',
    ko: () => '알려 주셔서 감사합니다. 그 장소를 확인했지만 장애물은 보이지 않았습니다.',
  },
  check: {
    en: () => "Thank you. We'll check that spot on our next walk.",
    es: () => 'Gracias. Revisaremos ese lugar en nuestro próximo recorrido.',
    ko: () => '감사합니다. 다음 답사 때 그 장소를 확인하겠습니다.',
  },
  open: {
    en: () => 'Thank you for your message. We will look into it and write back.',
    es: () => 'Gracias por su mensaje. Lo revisaremos y le responderemos.',
    ko: () => '메시지 감사합니다. 확인한 뒤 다시 연락드리겠습니다.',
  },
  question: {
    en: () => 'Thank you for your question. We will answer you personally soon.',
    es: () => 'Gracias por su pregunta. Le responderemos personalmente pronto.',
    ko: () => '문의해 주셔서 감사합니다. 곧 직접 답변드리겠습니다.',
  },
  praise: {
    en: () => 'Thank you for your kind words. We hope to see you again.',
    es: () => 'Gracias por sus amables palabras. Esperamos verle de nuevo.',
    ko: () => '따뜻한 말씀 감사합니다. 다시 뵙기를 바랍니다.',
  },
};
function cap(text: string) { return text.charAt(0).toLocaleUpperCase() + text.slice(1); }

/**
 * Route-note and reply lines for her answers to the guide (Experience's words). Visitor-facing: usted in Spanish, polite form in
 * Korean. Her answers are hers ("from what we know"), never a measurement. The Spanish and Korean are unreviewed by native speakers.
 */
type AnswerLines = { en: (w: Where, m: number) => string; es: (w: Where, m: number) => string; ko: (w: Where, m: number) => string };

const AT = {
  en: (m: number) => m < 10 ? 'at the start of the walk' : `about ${m} m along the walk`,
  es: (m: number) => m < 10 ? 'al inicio del recorrido' : `a unos ${m} m del inicio`,
  ko: (m: number) => m < 10 ? '출발점' : `출발점에서 약 ${m}m`,
};
/** 이 after a syllable that ends in a consonant, 가 after a vowel. */
const ga = (noun: string) => { const c = noun.trim().at(-1)?.charCodeAt(0) ?? 0; return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 0 ? '가' : '이'; };
const ASK_EN = 'We haven’t checked it yet; ask us before you go.';
const ASK_ES = 'Aún no lo revisamos; pregúntenos antes de ir.';
const ASK_KO = '아직 확인하지 못했으니 가시기 전에 문의해 주세요.';

/** What a thing is, in each visitor language, for the per-kind lines. */
export const THING: Record<string, { en: string; es: string; ko: string }> = {
  narrow: { en: 'a narrow place', es: 'un paso angosto', ko: '좁은 구간' },
  bollard: { en: 'a post or bollard', es: 'un poste o bolardo', ko: '기둥' },
  gate: { en: 'a gate', es: 'un portón', ko: '문' },
  noWheelchair: { en: 'a part OpenStreetMap marks as not for wheelchairs', es: 'una parte que OpenStreetMap marca sin acceso en silla de ruedas', ko: 'OpenStreetMap에 휠체어 이용 불가로 표시된 구간' },
  broken: { en: 'broken paving', es: 'acera rota', ko: '깨진 보도' },
  works: { en: 'roadworks', es: 'obras', ko: '공사 구간' },
  obstacle: { en: 'something in the way', es: 'algo que estorba', ko: '장애물' },
  handrail: { en: 'a handrail', es: 'un pasamanos', ko: '난간' },
  ramp: { en: 'a ramp', es: 'una rampa', ko: '경사로' },
  crossing: { en: 'a crossing', es: 'un cruce peatonal', ko: '횡단보도' },
  bench: { en: 'a bench', es: 'una banca', ko: '벤치' },
  toilets: { en: 'toilets', es: 'baños', ko: '화장실' },
  lighting: { en: 'street lights', es: 'alumbrado', ko: '가로등' },
};

/** Her answer about a flagged spot of steps or a kerb, or a stretch with no photos. null: nothing goes in the note. */
export const ANSWER_NOTE: Record<string, Record<string, AnswerLines | null>> = {
  getPast: {
    wayAround: { en: (w, m) => `Steps ${w.en}, ${AT.en(m)}. There’s a way around them; ask us.`, es: (w, m) => `Escalones ${w.es}, ${AT.es(m)}. Hay otro camino para evitarlos; pregúntenos.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 계단이 있습니다. 계단을 피해 가는 길이 있으니 문의해 주세요.` },
    handrail: { en: (w, m) => `Steps with a handrail ${w.en}, ${AT.en(m)}.`, es: (w, m) => `Escalones con pasamanos ${w.es}, ${AT.es(m)}.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 난간이 있는 계단이 있습니다.` },
    help: { en: (w, m) => `Steps ${w.en}, ${AT.en(m)}. We help visitors there.`, es: (w, m) => `Escalones ${w.es}, ${AT.es(m)}. Ahí ayudamos a los visitantes.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 계단이 있습니다. 그곳에서는 저희가 도와드립니다.` },
    noWay: { en: (w, m) => `Steps ${w.en}, ${AT.en(m)}, with no way around.`, es: (w, m) => `Escalones ${w.es}, ${AT.es(m)}, sin otro camino.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 계단이 있으며 돌아갈 길이 없습니다.` },
    notThere: null,
    unknown: { en: (w, m) => `There may be steps ${w.en}, ${AT.en(m)}. ${ASK_EN}`, es: (w, m) => `Puede haber escalones ${w.es}, ${AT.es(m)}. ${ASK_ES}`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 계단이 있을 수 있습니다. ${ASK_KO}` },
  },
  lowered: {
    nearby: { en: (w, m) => `A kerb ${w.en}, ${AT.en(m)}, with a lowered kerb or ramp nearby.`, es: (w, m) => `Un bordillo ${w.es}, ${AT.es(m)}, con un bordillo rebajado o una rampa cerca.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 연석이 있으며, 가까이에 낮은 연석이나 경사로가 있습니다.` },
    none: { en: (w, m) => `A kerb ${w.en}, ${AT.en(m)}, with no ramp nearby.`, es: (w, m) => `Un bordillo ${w.es}, ${AT.es(m)}, sin rampa cerca.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 연석이 있으며, 가까이에 경사로가 없습니다.` },
    notThere: null,
    unknown: { en: (w, m) => `There may be a kerb ${w.en}, ${AT.en(m)}. ${ASK_EN}`, es: (w, m) => `Puede haber un bordillo ${w.es}, ${AT.es(m)}. ${ASK_ES}`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처에 연석이 있을 수 있습니다. ${ASK_KO}` },
  },
  smoother: {
    nearby: { en: (w, m) => `Uneven ground ${w.en}, ${AT.en(m)}. There’s a smoother way nearby; ask us.`, es: (w, m) => `Suelo disparejo ${w.es}, ${AT.es(m)}. Hay un camino más parejo cerca; pregúntenos.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처는 바닥이 고르지 않습니다. 가까이에 더 평탄한 길이 있으니 문의해 주세요.` },
    none: { en: (w, m) => `Uneven ground ${w.en}, ${AT.en(m)}, with no smoother way nearby.`, es: (w, m) => `Suelo disparejo ${w.es}, ${AT.es(m)}, sin un camino más parejo cerca.`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처는 바닥이 고르지 않으며, 가까이에 더 평탄한 길이 없습니다.` },
    unknown: { en: (w, m) => `The ground may be uneven ${w.en}, ${AT.en(m)}. ${ASK_EN}`, es: (w, m) => `Puede que el suelo sea disparejo ${w.es}, ${AT.es(m)}. ${ASK_ES}`, ko: (w, m) => `${AT.ko(m)}, ${w.ko} 근처는 바닥이 고르지 않을 수 있습니다. ${ASK_KO}` },
  },
  unseen: {
    nothing: { en: w => `No photos of the part ${w.en}, but from what we know nothing is in the way.`, es: w => `No hay fotos de la parte ${w.es}, pero por lo que sabemos nada estorba.`, ko: w => `${w.ko} 구간은 사진이 없지만, 저희가 아는 바로는 장애물이 없습니다.` },
    something: null,
    unknown: { en: w => `We haven’t seen the part ${w.en} yet; ask us before you go.`, es: w => `Todavía no conocemos la parte ${w.es}; pregúntenos antes de ir.`, ko: w => `${w.ko} 구간은 아직 확인하지 못했으니 가시기 전에 문의해 주세요.` },
  },
};

/** Her answer about a narrow place, a post, a gate or a part marked not for wheelchairs: always hers. */
export const THROUGH_NOTE = {
  yes: { en: (k: string, w: Where, m: number) => `${cap(THING[k].en)} ${w.en}, ${AT.en(m)}. From what we know, a wheelchair or stroller gets through.`, es: (k: string, w: Where, m: number) => `${cap(THING[k].es)} ${w.es}, ${AT.es(m)}. Por lo que sabemos, pasa una silla de ruedas o un coche de bebé.`, ko: (k: string, w: Where, m: number) => `${AT.ko(m)}, ${w.ko} 근처에 ${THING[k].ko}${ga(THING[k].ko)} 있습니다. 저희가 아는 바로는 휠체어나 유모차가 지나갈 수 있습니다.` },
  no: { en: (k: string, w: Where, m: number) => `${cap(THING[k].en)} ${w.en}, ${AT.en(m)}. From what we know, a wheelchair or stroller can’t get through.`, es: (k: string, w: Where, m: number) => `${cap(THING[k].es)} ${w.es}, ${AT.es(m)}. Por lo que sabemos, no pasa una silla de ruedas ni un coche de bebé.`, ko: (k: string, w: Where, m: number) => `${AT.ko(m)}, ${w.ko} 근처에 ${THING[k].ko}${ga(THING[k].ko)} 있습니다. 저희가 아는 바로는 휠체어나 유모차가 지나갈 수 없습니다.` },
  unknown: { en: (k: string, w: Where, m: number) => `${cap(THING[k].en)} ${w.en}, ${AT.en(m)}. ${ASK_EN}`, es: (k: string, w: Where, m: number) => `${cap(THING[k].es)} ${w.es}, ${AT.es(m)}. ${ASK_ES}`, ko: (k: string, w: Where, m: number) => `${AT.ko(m)}, ${w.ko} 근처에 ${THING[k].ko}${ga(THING[k].ko)} 있습니다. ${ASK_KO}` },
};

/** Something still there (a temporary barrier she kept, or a help such as a bench): what and where. Gone: use UPDATE.fixed's pattern with the date, or leave it out for a help. */
export const STILL_NOTE = {
  en: (k: string, w: Where, m: number) => `${cap(THING[k].en)} ${w.en}, ${AT.en(m)}.`,
  es: (k: string, w: Where, m: number) => `${cap(THING[k].es)} ${w.es}, ${AT.es(m)}.`,
  ko: (k: string, w: Where, m: number) => `${AT.ko(m)}, ${w.ko} 근처에 ${THING[k].ko}${ga(THING[k].ko)} 있습니다.`,
};
export const GONE_NOTE = {
  en: (k: string, w: Where, date: string) => `Update, ${date}: ${THING[k].en} ${w.en} is gone.`,
  es: (k: string, w: Where, date: string) => `Actualización, ${date}: ya no hay ${THING[k].es} ${w.es}.`,
  ko: (k: string, w: Where, date: string) => `업데이트 (${date}): ${w.ko} 근처의 ${THING[k].ko}${ga(THING[k].ko)} 없어졌습니다.`,
};

/** A photo kind she chose to mention ("Mention this in your route note?"). */
export const KIND_NOTE = {
  cobblestones: { en: 'Cobblestones on parts of the walk.', es: 'Empedrado en partes del recorrido.', ko: '경로 일부 구간이 돌길입니다.' },
  crossing: { en: 'The walk crosses roads in places.', es: 'El recorrido cruza calles en algunos puntos.', ko: '경로 중간에 차도를 건너는 곳이 있습니다.' },
  kerb: { en: 'Kerbs along parts of the walk.', es: 'Bordillos en partes del recorrido.', ko: '경로 일부 구간에 연석이 있습니다.' },
};

/** The way around the mapped steps, once she says it works. extra: metres longer than the walk, rounded. */
export const AROUND_NOTE = {
  en: (w: Where, extra: number) => `There’s a way around the steps ${w.en}, about ${extra} m longer. We’ve checked it.`,
  es: (w: Where, extra: number) => `Hay un camino que evita los escalones ${w.es}, unos ${extra} m más largo. Lo revisamos.`,
  ko: (w: Where, extra: number) => `${w.ko} 근처 계단을 피해 가는 길이 있습니다. 약 ${extra}m 더 길며, 저희가 확인했습니다.`,
};

/** Altitude, for a walk above about 2,500 m. metres: the walk's height above sea level, never a difference between its ends. */
export const ALTITUDE_NOTE = {
  en: (metres: number) => `The walk is at about ${metres.toLocaleString('en')} m above sea level; take it slowly.`,
  es: (metres: number) => `El recorrido está a unos ${metres.toLocaleString('es')} m de altura; vaya con calma.`,
  ko: (metres: number) => `이 경로는 해발 약 ${metres.toLocaleString('ko')}m에 있으니 천천히 걸으세요.`,
};

/** Replies. askWhere: the fail-safe when the model can't place a message. The answer clauses replace REPLY.barrier's last sentence ("Ask us if steps are hard for you.") once she has answered. */
export const REPLY_MORE = {
  askWhere: {
    en: 'Thank you for writing. Could you tell us where on the walk this was?',
    es: 'Gracias por escribirnos. ¿Podría decirnos en qué parte del recorrido fue?',
    ko: '연락 주셔서 감사합니다. 경로의 어느 부분이었는지 알려 주시겠어요?',
  },
  answer: {
    wayAround: { en: 'There’s a way around those steps; ask us and we’ll show you.', es: 'Hay un camino que evita esos escalones; pregúntenos y se lo mostramos.', ko: '그 계단을 피해 가는 길이 있습니다. 문의해 주시면 안내해 드리겠습니다.' },
    handrail: { en: 'There’s a handrail there.', es: 'Ahí hay pasamanos.', ko: '그곳에는 난간이 있습니다.' },
    help: { en: 'We help visitors at those steps; just ask.', es: 'En esos escalones ayudamos a los visitantes; solo pregúntenos.', ko: '그 계단에서는 저희가 도와드리니 편하게 말씀해 주세요.' },
    noWay: { en: 'There’s no way around them, so ask us before you go.', es: 'No hay otro camino, así que pregúntenos antes de ir.', ko: '돌아갈 길이 없으니 가시기 전에 문의해 주세요.' },
    unknown: { en: 'We haven’t checked that spot yet; ask us before you go.', es: 'Aún no revisamos ese lugar; pregúntenos antes de ir.', ko: '아직 그 장소를 확인하지 못했으니 가시기 전에 문의해 주세요.' },
  },
};


/** A place name as English prose needs it: "the" before a square, a church or a common noun such as a ticket booth; a bare proper name stays bare. */
export function enPlace(name: string): string {
  if (!(/^(Plaza|Iglesia|Catedral|Capilla|Portal|Monasterio|Convento|Palacio|Templo)\b/.test(name) || /\b(ticket booth|entrance|gate|station|square)$/i.test(name))) return name;
  // A name that starts with a common word is a description, so it reads in lower case after "the".
  return /^(Cable|Upper|Lower|Top|Bottom|Old|New|Main|North|South|East|West)\b/.test(name) ? `the ${name.charAt(0).toLocaleLowerCase()}${name.slice(1)}` : `the ${name}`;
}

/** Where a spot is, phrased per language from its landmark. */
export function where(landmark: { name: string; kind: 'start' | 'target' | 'building' | 'street' } | null, names: { start: string; target: string }): Where {
  if (!landmark) return { en: 'on the walk', es: 'en el recorrido', ko: '경로' };
  const { name, kind } = landmark;
  if (kind === 'start') return { en: `at the ${name}`, es: `en la ${name}`, ko: name === 'Plaza de Armas' ? '아르마스 광장' : name };
  if (kind === 'target') return { en: `near the ${name}`, es: `cerca de ${name === names.target && /ticket booth/i.test(name) ? 'la boletería del Qorikancha' : name}`, ko: /ticket booth/i.test(name) ? '코리칸차 매표소' : name };
  if (kind === 'street') {
    const street = /^calle /i.test(name) ? name : `Calle ${name}`;
    return { en: `on ${street}`, es: `en la ${street.replace(/^Calle/, 'calle')}`, ko: street };
  }
  const article = /^(Iglesia|Catedral|Capilla|Municipalidad)/.test(name) ? 'la ' : /^(Portal|Monasterio|Convento|Palacio)/.test(name) ? 'el ' : '';
  return { en: `near ${article ? 'the ' : ''}${name}`, es: `cerca de ${article === 'el ' ? 'l ' : article}${name}`.replace('de l ', 'del '), ko: name };
}

/**
 * A best guess at the language of a pasted message, for the reply default only; the person can change it.
 * The walk's place names are Spanish, so they are set aside first and never count as Spanish.
 * Spanish needs two cues, English wins ties, Quechua and other languages say so instead of passing as Spanish.
 */
export function guessLanguage(text: string): string {
  if (/[가-힯]/.test(text)) return 'ko';
  const PLACE = /(^|[^\p{L}])(?:[Cc]alle|[Pp]laza|[Pp]ortal|[Ii]glesia|[Cc]atedral|[Mm]onasterio|[Cc]onvento|[Tt]emplo|[Cc]apilla|[Pp]ampa|[Aa]venida|Santa|Santo|San)(?:\s+(?:(?:de|del|la|las|los|el|y)\s+){0,2}[A-ZÁÉÍÓÚÑ][\p{L}']*)+/gu;
  const NAMES = /(?:Qorikancha|Coricancha|Qoricancha|Korikancha|Cusco|Cuzco|Loreto|Maruri|Hauqaypata|Huacaypata|Compañía|Armas)[\p{L}']*/gu;
  const rest = text.replace(PLACE, '$1 ').replace(NAMES, ' ');
  const words = rest.toLocaleLowerCase().replace(/[’`´]/g, "'").match(/[\p{L}']+/gu) ?? [];
  const set = (list: string) => new Set(list.split(' '));
  const EN = set('the was were my and there is are it its to of an we our us too for with but very not this that these those had have has would could can you your thank thanks steep steps step stairs wheelchair ramp handrail father mother mom dad grandmother grandfather husband wife question quick just buy tickets ticket booth only online day great nice good amazing beautiful lovely loved love hard difficult easy really so all some any here what how when where which who they them he she his her at on in from by or if be been get got went walk walking street');
  const ES = set('el la los las del de que y en un una unos unas por para con es pero fue era eran hay mi mis nos nuestro nuestra al se lo le les sin más como cuando donde dónde mucho mucha muchos muchas bien bastante todo toda todos ya tan tanto tanta hasta desde sobre entre subir bajar subida bajada gradas silla ruedas rampa verdad problema nada algunas algunos partes piedras guía visita recorrido tiene tenía excelente recomiendo hermoso hermosa bonito bonita lindo linda increíble genial');
  const ES_STRONG = set('gracias muy también está están estaba estaban había fueron escalones escaleras pasamanos baranda difícil abuela abuelo mamá papá años ningún ninguna pasó señora señor ayuda');
  const FR = set('le les des une est avec pour nous vous il elle je mais pas du au aux sur dans qui belle beau visite magnifique été avons cette ce ces notre');
  const FR_STRONG = set("merci très était c'est j'ai bonjour");
  const QU = set('mana manam kanchu kan rumi ñan wasi allin sumaq chay kay hina ari imaynalla añay sulpayki');
  const count = (list: Set<string>) => words.filter(word => list.has(word)).length;
  const french = /[èêëàâçîïôûœ]/.test(rest);
  const qu = words.filter(word => QU.has(word) || /q(?!u)|kuna|[ptkq]'[aeiou]|ch'[aeiou]/.test(word)).length;
  const es = count(ES) + 2 * count(ES_STRONG) + (/[¿¡]/.test(rest) ? 2 : 0) + (!french && /[áéíóúñü]/.test(rest) ? 1 : 0);
  const en = count(EN);
  const fr = count(FR) + 2 * count(FR_STRONG) + (french ? 2 : 0);
  if (qu >= 2 && qu >= es && qu > en) return 'qu';
  if (es >= 2 && es > en && es > fr) return 'es';
  if (en >= 1 && en >= es && en >= fr) return 'en';
  if (fr >= 2 || /[^\x00-\x7F¿¡]/.test(rest)) return 'other';
  return 'en';
}
