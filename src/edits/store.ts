/**
 * What the operator herself records about a walk: spots she knows about that no photo showed,
 * barriers she has since fixed, and her own words about any spot.
 * Kept on this device only, beside the review and never mixed with it. Nothing here states a
 * width, a slope or whether a person can pass; these are her records, not measurements.
 */
export const EDIT_KINDS = ['steps', 'kerb', 'narrow', 'other'] as const;
export type EditKind = (typeof EDIT_KINDS)[number];
/** The language her own words were taken as, so the right visitor note carries them. */
export const NOTE_LANGS = ['en', 'es', 'ko', 'other'] as const;
export type NoteLang = (typeof NOTE_LANGS)[number];
/** Her own words, with the language they were taken as. */
export type OwnNote = { readonly text: string; readonly language: NoteLang };
/** A spot she added, on one 10 m stretch of the walk. */
export type AddedSpot = {
  readonly id: string;
  readonly stretch: number;
  readonly kind: EditKind;
  /** Her own words, or empty text. */
  readonly note: OwnNote;
  readonly at: string;
};
/** Her record that a barrier is fixed, kept by stretch as decisions are. */
export type FixRecord = { readonly stretches: readonly number[]; readonly at: string; readonly note: OwnNote };
export type Edits = {
  readonly schema: 'mercature-route-edits/1';
  readonly place: string;
  readonly added: readonly AddedSpot[];
  /** Keyed by the first stretch of the fixed spot. */
  readonly fixed: Readonly<Record<string, FixRecord>>;
  /** Her own words about a spot, keyed by spot id. */
  readonly notes: Readonly<Record<string, OwnNote>>;
  /** How many spots she has ever added here. It only grows, so a removed id is never given again. */
  readonly seq: number;
};

export const NOTE_LIMIT = 200;
const key = (place: string) => `mercature.route-edits.v1.${place}`;
const empty = (place: string): Edits => ({ schema: 'mercature-route-edits/1', place, added: [], fixed: {}, notes: {}, seq: 0 });
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isTime = (value: unknown): value is string => isText(value, 40) && !Number.isNaN(Date.parse(value));
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isStretch = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9999;
/** Her text is kept as she typed it, bounded and with control characters removed. */
export const trimNote = (text: string): string => text.replace(/[\u0000-\u001f\u007f]/gu, ' ').trim().slice(0, NOTE_LIMIT);
export const ownNote = (text: string, language: NoteLang): OwnNote => ({ text: trimNote(text), language });
export const NO_NOTE: OwnNote = { text: '', language: 'en' };

function parseNote(value: unknown): OwnNote {
  if (!isRecord(value) || typeof value.text !== 'string' || value.text.length > NOTE_LIMIT || !NOTE_LANGS.includes(value.language as NoteLang)) throw new Error('note');
  return { text: value.text, language: value.language as NoteLang };
}

export function parseEdits(raw: string, place: string): Edits {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.schema !== 'mercature-route-edits/1' || value.place !== place || !Array.isArray(value.added) || !isRecord(value.fixed) || !isRecord(value.notes)) throw new Error('shape');
  const added = value.added.slice(0, 200).map(item => {
    if (!isRecord(item) || !isText(item.id, 80) || !isStretch(item.stretch) || !EDIT_KINDS.includes(item.kind as EditKind) || !isTime(item.at)) throw new Error('added');
    return { id: item.id, stretch: item.stretch, kind: item.kind as EditKind, note: parseNote(item.note), at: item.at };
  });
  if (new Set(added.map(item => item.id)).size !== added.length) throw new Error('added ids');
  const fixed: Record<string, FixRecord> = {};
  for (const [stretch, record] of Object.entries(value.fixed)) {
    if (!/^\d{1,4}$/.test(stretch) || !isRecord(record) || !Array.isArray(record.stretches) || !record.stretches.length || !record.stretches.every(isStretch) || !isTime(record.at)) throw new Error('fixed');
    fixed[stretch] = { stretches: record.stretches as number[], at: record.at, note: parseNote(record.note) };
  }
  const notes: Record<string, OwnNote> = {};
  for (const [spot, note] of Object.entries(value.notes)) {
    if (!isText(spot, 80)) throw new Error('note spot');
    const kept = parseNote(note);
    if (kept.text) notes[spot] = kept;
  }
  const highest = Math.max(0, ...added.map(spot => Number(/^added-(\d+)$/.exec(spot.id)?.[1] ?? 0)));
  const seq = typeof value.seq === 'number' && Number.isInteger(value.seq) && value.seq >= highest && value.seq <= 100000 ? value.seq : highest;
  return { schema: 'mercature-route-edits/1', place, added, fixed, notes, seq };
}

/** Reads this place's edits. An unreadable record is set aside, never silently overwritten. */
export function loadEdits(place: string): { edits: Edits; error: string } {
  try {
    const raw = localStorage.getItem(key(place));
    if (raw === null) return { edits: empty(place), error: '' };
    try {
      return { edits: parseEdits(raw, place), error: '' };
    } catch {
      localStorage.setItem(`${key(place)}.unreadable`, raw);
      localStorage.removeItem(key(place));
      return { edits: empty(place), error: 'unreadable' };
    }
  } catch {
    return { edits: empty(place), error: 'storage' };
  }
}

/** Returns false when the device refused to keep it, so the caller can say so. */
export function saveEdits(edits: Edits): boolean {
  try {
    localStorage.setItem(key(edits.place), JSON.stringify(edits));
    return true;
  } catch {
    return false;
  }
}

export function addSpot(edits: Edits, stretch: number, kind: EditKind, note: OwnNote = NO_NOTE, at = new Date().toISOString()): Edits {
  if (!isStretch(stretch)) return edits;
  const seq = edits.seq + 1;
  return { ...edits, seq, added: [...edits.added, { id: `added-${seq}`, stretch, kind, note: ownNote(note.text, note.language), at }] };
}

export function removeSpot(edits: Edits, id: string): Edits {
  const notes = { ...edits.notes };
  delete notes[id];
  return { ...edits, added: edits.added.filter(spot => spot.id !== id), notes };
}

/** Her record that this spot is fixed, with the date she recorded it. */
export function markFixed(edits: Edits, stretches: readonly number[], note: OwnNote = NO_NOTE, at = new Date().toISOString()): Edits {
  if (!stretches.length) return edits;
  return { ...edits, fixed: { ...edits.fixed, [String(stretches[0])]: { stretches: [...stretches], at, note: ownNote(note.text, note.language) } } };
}

export function clearFixed(edits: Edits, stretches: readonly number[]): Edits {
  if (!stretches.length) return edits;
  const fixed = { ...edits.fixed };
  delete fixed[String(stretches[0])];
  return { ...edits, fixed };
}

/** Her own words about a spot. Empty text clears them. */
export function setNote(edits: Edits, spot: string, note: OwnNote): Edits {
  const notes = { ...edits.notes }, kept = ownNote(note.text, note.language);
  if (kept.text) notes[spot] = kept;
  else delete notes[spot];
  return { ...edits, notes };
}

export const isFixed = (edits: Edits, stretches: readonly number[]): FixRecord | null =>
  stretches.length ? edits.fixed[String(stretches[0])] ?? null : null;
export const addedIds = (edits: Edits): readonly string[] => edits.added.map(spot => spot.id);
export const addedSpot = (edits: Edits, id: string): AddedSpot | null => edits.added.find(spot => spot.id === id) ?? null;
export const noteOf = (edits: Edits, spot: string): OwnNote | null => edits.notes[spot] ?? null;
/** Forgets what she recorded about this place. Her decisions and the model are untouched. */
export const clearEdits = (edits: Edits): Edits => empty(edits.place);
