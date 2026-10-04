import type { Lang } from '../i18n';
import type { MarkKind } from '../ui/kinds';

/** The photo's own words. A chip names the kind; its accessible name keeps the record's full words. */
export const PHOTO_WORDS = {
  en: {
    kinds: { steps: 'Steps', kerb: 'Kerb', broken: 'Broken pavement', crossing: 'Crossing', bollard: 'Bollard', footway: 'Pavement', cobblestones: 'Cobblestones', road: 'Road' } satisfies Record<MarkKind, string>,
    note: 'Model marks, not checked',
    mark: (label: string) => `${label}. Model mark, not checked`,
    alt: (kinds: string) => kinds ? `Street photo with the model's marks: ${kinds}` : 'Street photo',
    more: (n: number) => `${n} more ${n === 1 ? 'mark' : 'marks'}`,
    marks: 'Marks on this photo',
    whole: 'Whole photo',
    missing: 'Photo unavailable',
  },
  es: {
    kinds: { steps: 'Escalones', kerb: 'Bordillo', broken: 'Acera rota', crossing: 'Cruce peatonal', bollard: 'Bolardo', footway: 'Acera', cobblestones: 'Empedrado', road: 'Calzada' } satisfies Record<MarkKind, string>,
    note: 'Marcas del modelo, sin verificar',
    mark: (label: string) => `${label}. Marca del modelo, sin verificar`,
    alt: (kinds: string) => kinds ? `Foto de la calle con las marcas del modelo: ${kinds}` : 'Foto de la calle',
    more: (n: number) => n === 1 ? '1 marca más' : `${n} marcas más`,
    marks: 'Marcas en esta foto',
    whole: 'Ver la foto entera',
    missing: 'Foto no disponible',
  },
} as const satisfies Record<Lang, unknown>;
