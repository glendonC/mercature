/**
 * The words the editable layer needs. Interface text is English here and moves to the shared
 * dictionary when Spanish converts it; the visitor lines are pre-written in every visitor language,
 * because the model never writes free text.
 */
import type { EditKind } from './store';

/** A place phrase in each visitor language, as the route canvas already builds for a spot. */
export type Where = { en: string; es: string; ko: string };
export type VisitorLang = 'en' | 'es' | 'ko';

/** The kind of thing she recorded, in the words each language uses for it. */
export const KIND_WORDS: Readonly<Record<EditKind, { en: string; es: string; ko: string; plural: boolean }>> = {
  steps: { en: 'steps', es: 'escalones', ko: '계단', plural: true },
  kerb: { en: 'a kerb', es: 'un bordillo', ko: '연석', plural: false },
  narrow: { en: 'a narrow part', es: 'un paso angosto', ko: '좁은 구간', plural: false },
  other: { en: 'something in the way', es: 'algo que estorba', ko: '장애물', plural: false },
};

/** Interface words for the editing controls. One line per idea, no slogans. */
export const EDIT_WORDS = {
  addTitle: 'Add a spot you know about',
  addWhere: (where: string, from: number, to: number) => `${where}, ${from} to ${to} m`,
  kinds: { steps: 'Steps', kerb: 'Kerb', narrow: 'Narrow', other: 'Something else' } as Record<EditKind, string>,
  noteLabel: 'Your note',
  notePlaceholder: 'What a visitor should know',
  noteKept: 'Kept on this phone. Visitors see it in the route note.',
  takenAs: (language: string) => `Taken as ${language}`,
  languages: { en: 'English', es: 'Spanish', ko: 'Korean', other: 'Another language' } as Record<string, string>,
  changeLanguage: 'Language of your note',
  add: 'Add spot',
  cancel: 'Cancel',
  remove: 'Remove',
  fixTitle: 'Mark this fixed',
  fixOn: (date: string) => `Your record, ${date}`,
  fixNoteLabel: 'What changed',
  fix: 'Mark fixed',
  undoFix: 'Not fixed',
  addedBy: 'Added by you',
  fixedOn: (date: string) => `Fixed ${date}`,
  yourNote: 'Your note',
  save: 'Save',
  notSaved: 'This device did not keep the last change.',
  unreadable: 'What you recorded on this device could not be read. It was set aside.',
};
export type EditWords = typeof EDIT_WORDS;

const LOCALES: Readonly<Record<VisitorLang, string>> = { en: 'en', es: 'es-419', ko: 'ko' };
/** The day she recorded something, in the reader's language. */
export function recordDate(at: string, language: VisitorLang): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALES[language], { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

/**
 * How a fixed spot is named in a visitor's language, with the agreement each one needs.
 * Spanish puts the participle before the noun, so the record and its status stay together, and each
 * kind carries its own article and agreement. Korean takes an object particle chosen by the final consonant.
 */
const FIXED_SUBJECT: Readonly<Record<EditKind, { en: string; es: string; esDone: string; ko: string }>> = {
  steps: { en: 'the steps', es: 'los escalones', esDone: 'arreglados', ko: '계단' },
  kerb: { en: 'the kerb', es: 'el bordillo', esDone: 'arreglado', ko: '연석' },
  narrow: { en: 'the narrow part', es: 'el paso angosto', esDone: 'arreglado', ko: '좁은 구간' },
  other: { en: 'what was in the way', es: 'el obstáculo', esDone: 'arreglado', ko: '장애물' },
};

/** 을 after a syllable that ends in a consonant, 를 after one that ends in a vowel. */
export function objectParticle(noun: string): string {
  const last = noun.trim().at(-1) ?? '';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '을';
  return (code - 0xac00) % 28 ? '을' : '를';
}

/**
 * The visitor-facing line for a spot she has marked fixed. It reports that she recorded it,
 * with the date, and never says the way is clear, passable or safe.
 */
export const UPDATE = {
  fixed: {
    en: (kind: EditKind, where: Where, metres: number, date: string) =>
      `Update, ${date}: we recorded ${FIXED_SUBJECT[kind].en} ${where.en}, about ${metres} m along the walk, as fixed.`,
    es: (kind: EditKind, where: Where, metres: number, date: string) =>
      `Actualización, ${date}: anotamos como ${FIXED_SUBJECT[kind].esDone} ${FIXED_SUBJECT[kind].es} ${where.es}, a unos ${metres} m del inicio.`,
    ko: (kind: EditKind, where: Where, metres: number, date: string) =>
      `업데이트 (${date}): 출발점에서 약 ${metres}m, ${where.ko} 근처 ${FIXED_SUBJECT[kind].ko}${objectParticle(FIXED_SUBJECT[kind].ko)} 수리 완료로 기록했습니다.`,
  },
};
