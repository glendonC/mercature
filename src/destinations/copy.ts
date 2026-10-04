import type { MessageKind, UiLanguage } from '../site/contracts';
import type { EditKind } from '../edits/store';
import { KIND_WORDS } from '../edits/words';

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

/** A place name as English prose needs it: "the" before a square, a church or a common noun such as a ticket booth; a bare proper name stays bare. */
export function enPlace(name: string): string {
  if (!(/^(Plaza|Iglesia|Catedral|Capilla|Portal|Monasterio|Convento|Palacio|Templo)\b/.test(name) || /\b(ticket booth|entrance|gate|station|square)$/i.test(name))) return name;
  // A name that starts with a common word is a description, so it reads in lower case after "the".
  return /^(Cable|Upper|Lower|Top|Bottom|Old|New|Main|North|South|East|West)\b/.test(name) ? `the ${name.charAt(0).toLocaleLowerCase()}${name.slice(1)}` : `the ${name}`;
}

/** A place name as Spanish prose needs it after "desde" or "hasta": with its article, and a common noun in lower case. */
export function esPlace(name: string): string {
  const first = name.split(' ')[0];
  if (/^(Boletería|Calle|Entrada|Puerta|Estación|Cresta|Subida)$/.test(first)) return `la ${first.toLocaleLowerCase()}${name.slice(first.length)}`;
  if (/^(Paseo|Templo)$/.test(first)) return `el ${first.toLocaleLowerCase()}${name.slice(first.length)}`;
  if (/^(Plaza|Iglesia|Catedral|Capilla|Municipalidad|Casa)$/.test(first)) return `la ${name}`;
  if (/^(Portal|Monasterio|Convento|Palacio|Museo|Mirador|Mercado|Puente)$/.test(first)) return `el ${name}`;
  return name;
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
