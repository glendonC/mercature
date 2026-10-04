import type { IssueCategory, MessageKind, UiLanguage } from '../site/contracts';
import type { Verdict } from '../decisions/store';

export type UiLang = UiLanguage;
export type VisitorLang = 'en' | 'es' | 'ko';

/** Core canvas strings. The Spanish is unreviewed by a native speaker. */
export const COPY = {
  en: {
    home: 'Home', views: { place: 'Place', messages: 'Messages', changes: 'Changes' }, workspace: 'Route workspace',
    recorded: 'Recorded street photos. Model marks are unverified.', walk: (from: string, m: number) => `From ${from}, ${m} m on foot`,
    suggestion: 'Model suggestion, unverified', mapRecord: 'OpenStreetMap record, unverified',
    confirm: 'Confirm', notBarrier: 'Not a barrier', check: 'Check on site', undo: 'Undo', close: 'Close',
    verdicts: { barrier: 'Barrier confirmed', 'not-barrier': 'Not a barrier', check: 'Check on site' } as Record<Verdict, string>,
    unreviewed: 'Not reviewed', noBarrier: 'No barrier seen in photos', noPhotos: 'No photos here', noPhoto: 'No photo for this spot',
    range: (from: number, to: number) => `${from} to ${to} m`, photoOf: (n: number, total: number) => `Photo ${n} of ${total}`,
    previous: 'Previous photo', next: 'Next photo', whole: 'Show the whole photo', closer: 'Show the marked part',
    task: (left: number) => left ? `${left} ${left === 1 ? 'spot' : 'spots'} to check` : 'All spots checked',
    reviewed: (done: number, total: number) => `${done} of ${total} checked`,
    map: { zoomIn: 'Zoom map in', zoomOut: 'Zoom map out', fit: 'Whole route', credit: '© OpenStreetMap contributors' }, credits: 'Photos: Mapillary contributors, CC BY-SA 4.0.', creditsShort: '© OpenStreetMap. Photos: Mapillary, CC BY-SA 4.0',
    guide: {
      place: (left: number) => left ? 'Tap a marker to see what the model found.' : 'Every marked spot has a decision.',
      spot: 'Is there a barrier in this photo?', decided: (verdict: Verdict) => verdict === 'barrier' ? 'Confirmed. It will go in the route note.' : verdict === 'check' ? 'Saved for your next walk.' : 'Marked as not a barrier.',
      clear: 'Nothing was flagged in the photos here.', empty: 'This part of the walk has no photos.',
      write: 'Paste what the visitor wrote.', reading: 'Reading the message…', ready: 'Check the photo, then link the message.',
      unsure: 'The model is not sure. You decide.', manual: 'Pick the spot on the map.',
      linked: 'Linked. The reply is ready in Changes.', downloading: 'Downloading the model…', warming: 'Getting the model ready…',
      compare: 'These spots match best. Open one to check its photo.', noSpot: 'This message is not about one spot.',
      changes: 'Copy the note or a reply for the visitor.', nothing: 'Decisions and messages will appear here.',
    },
    message: 'Visitor message', messagePlaceholder: 'Paste or type what the visitor wrote', language: 'Message language',
    find: 'Find the spot', withoutAi: 'Use without AI', noModel: 'Read without the model.', download: (mb: number) => `Download ${mb} MB`,
    downloadProgress: (done: number, total: number) => `${done} of ${total} MB`, modelFailed: 'The model could not be prepared. Pick the spot on the map.',
    kind: 'Message', issue: 'Issue', suggested: 'Suggested spots', none: 'None of these', notSure: 'Not sure',
    notSureSpots: 'These spots are suggestions only.', notSureNone: 'Ask the visitor, or pick the spot on the map.',
    yes: 'Yes, this spot', linkedTo: (spot: string) => `Linked to ${spot}`, notLinked: 'Not linked yet', newMessage: 'New message',
    kinds: { problem: 'Problem', praise: 'Praise', question: 'Question' } as Record<MessageKind, string>,
    categories: { 'path-blocked': 'Blocked path', 'steps-or-slope': 'Steps or slope', 'seating-or-shade': 'Seating or shade', 'signs-or-language': 'Signs or language', facilities: 'Facilities', other: 'Other' } as Record<IssueCategory, string>,
    spots: 'Spots', messages: 'Messages', note: 'Route note for visitors', reply: 'Reply', copyNote: 'Copy note', copyReply: 'Copy reply',
    copied: 'Copied.', copyFailed: 'Copy the text above. The clipboard is not available.', noNote: 'Confirm a barrier or mark a spot to check, and the note writes itself.',
    unreadable: 'Saved decisions on this device could not be read. They were set aside.', notSaved: 'This device did not keep the last change.',
  },
  es: {
    home: 'Inicio', views: { place: 'Lugar', messages: 'Mensajes', changes: 'Cambios' }, workspace: 'Espacio de la ruta',
    recorded: 'Fotos de calle registradas. Las marcas del modelo no están verificadas.', walk: (from: string, m: number) => `Desde ${from === 'Plaza de Armas' ? 'la Plaza de Armas' : from}, ${m} m a pie`,
    suggestion: 'Sugerencia del modelo, sin verificar', mapRecord: 'Registro de OpenStreetMap, sin verificar',
    confirm: 'Confirmar', notBarrier: 'No es una barrera', check: 'Revisar en el lugar', undo: 'Deshacer', close: 'Cerrar',
    verdicts: { barrier: 'Barrera confirmada', 'not-barrier': 'No es una barrera', check: 'Revisar en el lugar' } as Record<Verdict, string>,
    unreviewed: 'Sin revisar', noBarrier: 'No se ve ninguna barrera en las fotos', noPhotos: 'No hay fotos aquí', noPhoto: 'No hay foto de este punto',
    range: (from: number, to: number) => `${from} a ${to} m`, photoOf: (n: number, total: number) => `Foto ${n} de ${total}`,
    previous: 'Foto anterior', next: 'Foto siguiente', whole: 'Ver la foto entera', closer: 'Ver la parte marcada',
    task: (left: number) => left ? `${left} ${left === 1 ? 'punto' : 'puntos'} por revisar` : 'Todos los puntos revisados',
    reviewed: (done: number, total: number) => `${done} de ${total} revisados`,
    map: { zoomIn: 'Acercar el mapa', zoomOut: 'Alejar el mapa', fit: 'Toda la ruta', credit: '© colaboradores de OpenStreetMap' }, credits: 'Fotos: colaboradores de Mapillary, CC BY-SA 4.0.', creditsShort: '© OpenStreetMap. Fotos: Mapillary, CC BY-SA 4.0',
    guide: {
      place: (left: number) => left ? 'Toca una marca para ver lo que encontró el modelo.' : 'Cada punto marcado tiene una decisión.',
      spot: '¿Hay una barrera en esta foto?', decided: (verdict: Verdict) => verdict === 'barrier' ? 'Confirmado. Irá en la nota de la ruta.' : verdict === 'check' ? 'Guardado para tu próximo recorrido.' : 'Marcado como sin barrera.',
      clear: 'Las fotos de aquí no muestran nada marcado.', empty: 'Esta parte del recorrido no tiene fotos.',
      write: 'Pega lo que escribió el visitante.', reading: 'Leyendo el mensaje…', ready: 'Mira la foto y enlaza el mensaje.',
      unsure: 'El modelo no está seguro. Tú decides.', manual: 'Elige el punto en el mapa.',
      linked: 'Enlazado. La respuesta está lista en Cambios.', downloading: 'Descargando el modelo…', warming: 'Preparando el modelo…',
      compare: 'Estos puntos coinciden mejor. Abre uno para ver su foto.', noSpot: 'Este mensaje no trata de un punto concreto.',
      changes: 'Copia la nota o una respuesta para el visitante.', nothing: 'Aquí aparecerán las decisiones y los mensajes.',
    },
    message: 'Mensaje del visitante', messagePlaceholder: 'Pega o escribe lo que escribió el visitante', language: 'Idioma del mensaje',
    find: 'Buscar el punto', withoutAi: 'Usar sin IA', noModel: 'Leído sin el modelo.', download: (mb: number) => `Descargar ${mb} MB`,
    downloadProgress: (done: number, total: number) => `${done} de ${total} MB`, modelFailed: 'No se pudo preparar el modelo. Elige el punto en el mapa.',
    kind: 'Mensaje', issue: 'Tema', suggested: 'Puntos sugeridos', none: 'Ninguno', notSure: 'No estoy seguro',
    notSureSpots: 'Estos puntos son solo sugerencias.', notSureNone: 'Pregunta al visitante o elige el punto en el mapa.',
    yes: 'Sí, este punto', linkedTo: (spot: string) => `Enlazado a ${spot}`, notLinked: 'Sin enlazar', newMessage: 'Nuevo mensaje',
    kinds: { problem: 'Problema', praise: 'Elogio', question: 'Pregunta' } as Record<MessageKind, string>,
    categories: { 'path-blocked': 'Camino bloqueado', 'steps-or-slope': 'Escalones o pendiente', 'seating-or-shade': 'Asientos o sombra', 'signs-or-language': 'Letreros o idioma', facilities: 'Servicios', other: 'Otro' } as Record<IssueCategory, string>,
    spots: 'Puntos', messages: 'Mensajes', note: 'Nota de la ruta para visitantes', reply: 'Respuesta', copyNote: 'Copiar nota', copyReply: 'Copiar respuesta',
    copied: 'Copiado.', copyFailed: 'Copia el texto de arriba. El portapapeles no está disponible.', noNote: 'Confirma una barrera o marca un punto por revisar, y la nota se escribe sola.',
    unreadable: 'No se pudieron leer las decisiones guardadas en este dispositivo. Se apartaron.', notSaved: 'Este dispositivo no guardó el último cambio.',
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
  barrier: {
    en: (s: Subject, w: Where, m: number) => `${cap(SUBJECTS[s].en)} ${w.en}, about ${m} m along the walk.`,
    es: (s: Subject, w: Where, m: number) => `${cap(SUBJECTS[s].es)} ${w.es}, a unos ${m} m del inicio.`,
    ko: (s: Subject, w: Where, m: number) => `출발점에서 약 ${m}m, ${w.ko} 근처에 ${SUBJECTS[s].ko}이 있습니다.`,
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
