import type { MessageKind, UiLanguage } from '../site/contracts';

export type UiLang = UiLanguage;
export type VisitorLang = 'en' | 'es' | 'ko';

/** The route screen's strings. The Spanish is unreviewed by a native speaker. */
export const COPY = {
  en: {
    workspace: 'Route workspace', walk: (from: string, m: number) => `From ${from}, ${m} m on foot`,
    range: (from: number, to: number) => `${from} to ${to} m`, noPhotos: 'No photos here', mapRecord: 'OpenStreetMap record, unverified',
    map: { zoomIn: 'Zoom map in', zoomOut: 'Zoom map out', fit: 'Whole route', credit: '© OpenStreetMap contributors' },
    photoOf: (n: number, total: number) => `Photo ${n} of ${total}`, previous: 'Previous photo', next: 'Next photo', whole: 'Show the whole photo', closer: 'Show the marked part',
    message: 'Visitor message', messagePlaceholder: 'Paste or type what the visitor wrote', language: 'Message language',
    withoutAi: 'Use without AI', download: (mb: number) => `Download ${mb} MB`, downloadProgress: (done: number, total: number) => `${done} of ${total} MB`, downloading: 'Downloading the model…',
    kinds: { problem: 'Problem', praise: 'Praise', question: 'Question' } as Record<MessageKind, string>,
    copyFailed: 'Copy the text above. The clipboard is not available.', notSaved: 'This device did not keep the last change.',
    inbox: {
      messages: 'Messages', add: 'Add a message', example: 'Example', unread: 'Not read yet', notFiled: 'Not filed', back: 'All messages', readEarlier: 'Read earlier',
      guide: 'Tap a marker for its photo, or open a message.', start: 'Start',
      found: 'Found along the walk', kinds: { steps: 'Steps', kerb: 'Kerb', path: 'On the path', noPhotos: 'No photos' } as Record<Subject | 'noPhotos', string>,
      raised: 'Visitors raise', note: 'Route note for visitors', copy: 'Copy', copied: 'Copied',
      paste: 'Paste what a visitor wrote.', read: 'Read message', cancel: 'Cancel',
      about: 'About', reply: 'Reply', copyReply: 'Copy reply', filed: (spot: string) => `Filed on ${spot}`, placed: 'Filed',
      line: { reading: 'Reading the message…', ready: 'Filed on the closest match. Tap another spot to move it.', unsure: 'Not sure which spot. Tap it on the map.', none: 'Not sure. Ask the visitor, or tap the spot on the map.', noSpot: 'This message is not about one spot.', manual: 'Tap the spot on the map.', remembered: 'The first spot is where you linked a similar message before.', linked: 'Filed. The reply below uses what your map says.' },
      visitors: (n: number) => n ? `${n} ${n === 1 ? 'message' : 'messages'} from visitors` : 'No visitor messages here yet',
      suggestion: 'Model suggestion', remove: 'Remove', restore: 'Put back', removed: 'Removed from your map',
      addHere: 'Add a spot here', clearHere: 'Nothing flagged in the photos here',
      startOver: 'Start over', startOverAsk: 'Clear every message and edit for this place?', clear: 'Clear', keep: 'Keep',
      languages: { en: 'English', es: 'Spanish', ko: 'Korean', qu: 'Quechua', other: 'Other' } as Record<string, string>,
    },
  },
  es: {
    workspace: 'Espacio de la ruta', walk: (from: string, m: number) => `Desde ${from === 'Plaza de Armas' ? 'la Plaza de Armas' : from}, ${m} m a pie`,
    range: (from: number, to: number) => `${from} a ${to} m`, noPhotos: 'No hay fotos aquí', mapRecord: 'Registro de OpenStreetMap, sin verificar',
    map: { zoomIn: 'Acercar el mapa', zoomOut: 'Alejar el mapa', fit: 'Toda la ruta', credit: '© colaboradores de OpenStreetMap' },
    photoOf: (n: number, total: number) => `Foto ${n} de ${total}`, previous: 'Foto anterior', next: 'Foto siguiente', whole: 'Ver la foto entera', closer: 'Ver la parte marcada',
    message: 'Mensaje del visitante', messagePlaceholder: 'Pega o escribe lo que escribió el visitante', language: 'Idioma del mensaje',
    withoutAi: 'Usar sin IA', download: (mb: number) => `Descargar ${mb} MB`, downloadProgress: (done: number, total: number) => `${done} de ${total} MB`, downloading: 'Descargando el modelo…',
    kinds: { problem: 'Problema', praise: 'Elogio', question: 'Pregunta' } as Record<MessageKind, string>,
    copyFailed: 'Copia el texto de arriba. El portapapeles no está disponible.', notSaved: 'Este dispositivo no guardó el último cambio.',
    inbox: {
      messages: 'Mensajes', add: 'Agregar un mensaje', example: 'Ejemplo', unread: 'Sin leer', notFiled: 'Sin ubicar', back: 'Todos los mensajes', readEarlier: 'Leído antes',
      guide: 'Toca un marcador para ver su foto o abre un mensaje.', start: 'Salida',
      found: 'Hallazgos en el recorrido', kinds: { steps: 'Escalones', kerb: 'Bordillo', path: 'En el camino', noPhotos: 'Sin fotos' } as Record<Subject | 'noPhotos', string>,
      raised: 'Los visitantes mencionan', note: 'Nota de la ruta para visitantes', copy: 'Copiar', copied: 'Copiado',
      paste: 'Pega lo que escribió un visitante.', read: 'Leer mensaje', cancel: 'Cancelar',
      about: 'Se refiere a', reply: 'Respuesta', copyReply: 'Copiar respuesta', filed: (spot: string) => `Ubicado en ${spot}`, placed: 'Ubicado',
      line: { reading: 'Leyendo el mensaje…', ready: 'Ubicado en el punto más probable. Toca otro punto para moverlo.', unsure: 'Sin certeza del punto. Tócalo en el mapa.', none: 'Sin certeza. Pregunta al visitante o toca el punto en el mapa.', noSpot: 'Este mensaje no trata de un punto concreto.', manual: 'Toca el punto en el mapa.', remembered: 'El primer punto es donde antes enlazaste un mensaje parecido.', linked: 'Ubicado. La respuesta de abajo usa lo que dice tu mapa.' },
      visitors: (n: number) => n ? `${n} ${n === 1 ? 'mensaje' : 'mensajes'} de visitantes` : 'Aún no hay mensajes de visitantes aquí',
      suggestion: 'Sugerencia del modelo', remove: 'Quitar', restore: 'Restaurar', removed: 'Quitado de tu mapa',
      addHere: 'Agregar un punto aquí', clearHere: 'Nada señalado en las fotos de aquí',
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
const SUBJECTS: Record<Subject, Where> = {
  steps: { en: 'steps', es: 'escalones', ko: '계단' },
  kerb: { en: 'a kerb with no ramp', es: 'un bordillo sin rampa', ko: '경사로 없는 연석' },
  path: { en: 'the path', es: 'el camino', ko: '길' },
};
export const NOTE = {
  title: { en: (from: string, to: string, m: number) => `${from} to ${to}, about ${m} m on foot.`, es: (from: string, to: string, m: number) => `Desde ${from} hasta ${to}, unos ${m} m a pie.`, ko: (from: string, to: string, m: number) => `${from}에서 ${to}까지 걸어서 약 ${m}m입니다.` },
  /** Under 10 m along, a spot is at the start of the walk, never "about 0 m". */
  barrier: {
    en: (s: Subject, w: Where, m: number) => m < 10 ? `${cap(SUBJECTS[s].en)} ${w.en}, at the start of the walk.` : `${cap(SUBJECTS[s].en)} ${w.en}, about ${m} m along the walk.`,
    es: (s: Subject, w: Where, m: number) => m < 10 ? `${cap(SUBJECTS[s].es)} ${w.es}, al inicio del recorrido.` : `${cap(SUBJECTS[s].es)} ${w.es}, a unos ${m} m del inicio.`,
    ko: (s: Subject, w: Where, m: number) => m < 10 ? `출발점, ${w.ko} 근처에 ${SUBJECTS[s].ko}이 있습니다.` : `출발점에서 약 ${m}m, ${w.ko} 근처에 ${SUBJECTS[s].ko}이 있습니다.`,
  },
  check: {
    en: (_s: Subject, w: Where) => `We have not checked the path ${w.en} yet.`,
    es: (_s: Subject, w: Where) => `Aún no hemos revisado el camino ${w.es}.`,
    ko: (_s: Subject, w: Where) => `${w.ko} 근처 길은 아직 확인하지 못했습니다.`,
  },
  steps: { en: 'Ask us if steps are hard for you.', es: 'Pregúntenos si los escalones le resultan difíciles.', ko: '계단이 힘드시면 미리 문의해 주세요.' },
  basis: { en: 'From street photos, not measurements.', es: 'Según fotos de la calle, no mediciones.', ko: '측정이 아닌 거리 사진을 바탕으로 합니다.' },
};
export const REPLY = {
  barrier: {
    en: (s: Subject, w: Where) => `Thank you. We've added a note about ${SUBJECTS[s].en} ${w.en} so future visitors know before they go. Ask us if steps are hard for you.`,
    es: (s: Subject, w: Where) => `Gracias. Añadimos una nota sobre ${SUBJECTS[s].es} ${w.es} para que los próximos visitantes lo sepan antes de ir. Pregúntenos si los escalones le resultan difíciles.`,
    ko: (s: Subject, w: Where) => `감사합니다. 다음 방문객이 미리 알 수 있도록 ${w.ko} 근처 ${SUBJECTS[s].ko}에 대한 안내를 추가했습니다. 계단이 힘드시면 미리 문의해 주세요.`,
  },
  'not-barrier': {
    en: () => 'Thank you for telling us. We checked the photos of that spot and saw no barrier.',
    es: () => 'Gracias por avisarnos. Revisamos las fotos de ese lugar y no vimos ninguna barrera.',
    ko: () => '알려 주셔서 감사합니다. 그 장소의 사진을 확인했지만 장애물은 보이지 않았습니다.',
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

/** A best guess at the language of a pasted message, for the reply default only; the person can change it. */
export function guessLanguage(text: string): string {
  if (/[가-힯]/.test(text)) return 'ko';
  if (/[ñ¿¡áéíóú]/i.test(text) || /\b(el|la|los|las|hay|muy|para|calle|gracias|escaleras|escalones|silla)\b/i.test(text)) return 'es';
  return 'en';
}
