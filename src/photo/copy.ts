import type { Lang } from '../i18n';
import type { MarkKind } from '../ui/kinds';

/** The photo's own words. A chip names the kind; its accessible name keeps the record's full words. */
export const PHOTO_WORDS = {
  en: {
    kinds: { steps: 'Steps', kerb: 'Kerb', broken: 'Broken pavement', crossing: 'Crossing', bollard: 'Bollard', footway: 'Pavement', cobblestones: 'Cobblestones', road: 'Road' } satisfies Record<MarkKind, string>,
    mark: (label: string) => `${label}. Model mark`,
    possible: (label: string) => `${label}, a possible barrier. Model mark`,
    alt: (kinds: string) => kinds ? `Street photo with the model's marks: ${kinds}` : 'Street photo',
    more: (n: number) => `${n} more ${n === 1 ? 'mark' : 'marks'}`,
    marks: 'Marks on this photo',
    answers: { fixed: 'You marked it gone or fixed', 'not-barrier': 'You said it is not a barrier', 'still-there': 'You said it is still there' },
    whole: 'Whole photo',
    missing: 'Photo unavailable',
  },
  es: {
    kinds: { steps: 'Escalones', kerb: 'Bordillo', broken: 'Acera rota', crossing: 'Cruce peatonal', bollard: 'Bolardo', footway: 'Acera', cobblestones: 'Empedrado', road: 'Calzada' } satisfies Record<MarkKind, string>,
    mark: (label: string) => `${label}. Marca del modelo`,
    possible: (label: string) => `${label}, posible barrera. Marca del modelo`,
    alt: (kinds: string) => kinds ? `Foto de la calle con las marcas del modelo: ${kinds}` : 'Foto de la calle',
    more: (n: number) => n === 1 ? '1 marca más' : `${n} marcas más`,
    marks: 'Marcas en esta foto',
    answers: { fixed: 'Marcaste que ya no está o se arregló', 'not-barrier': 'Dijiste que no es una barrera', 'still-there': 'Dijiste que sigue ahí' },
    whole: 'Ver la foto entera',
    missing: 'Foto no disponible',
  },
} as const satisfies Record<Lang, unknown>;

/** Where her own check of this spot stands; the guide resolves it. */
export type Review = { state: 'unchecked' } | { state: 'checked'; at: string } | { state: 'removed' };

/** The line under the photo. These words move to the guide's script (SCRIPT[lang].photo) once it has them. */
export function reviewLine(review: Review | undefined, lang: Lang): string {
  const es = lang === 'es';
  if (review?.state === 'checked') {
    // A bare day is read as that day here, not as midnight in UTC.
    const at = new Date(/^\d{4}-\d{2}-\d{2}$/.test(review.at) ? `${review.at}T12:00` : review.at), date = Number.isNaN(at.getTime()) ? '' : new Intl.DateTimeFormat(es ? 'es-419' : 'en-GB', { day: 'numeric', month: 'long' }).format(at);
    if (!date) return es ? 'Lo revisaste' : 'You checked this';
    return es ? `Lo revisaste el ${date}` : `You checked this on ${date}`;
  }
  if (review?.state === 'removed') return es ? 'Lo quitaste de tu mapa' : 'You took this off your map';
  return es ? 'Sin revisar todavía' : 'Not checked yet';
}
