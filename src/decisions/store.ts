import { ISSUE_CATEGORIES, MESSAGE_KINDS, type IssueCategory, type MessageKind } from '../site/contracts';

/**
 * What a person decided about recorded places on a walk, and the visitor messages they linked.
 * Kept on this device only. It records judgements about photos, never measurements, and the
 * synthetic plan schema is not used because nothing here is geometry.
 */
export const VERDICTS = ['barrier', 'not-barrier', 'check'] as const;
export type Verdict = (typeof VERDICTS)[number];
export type Decision = { readonly verdict: Verdict; readonly at: string };
export type ModelAnswer = {
  readonly status: 'ready' | 'unsure' | 'unavailable';
  readonly kind: MessageKind | null;
  readonly category: IssueCategory | null;
  /** Spot ids as the model ranked them, best first. */
  readonly candidates: readonly string[];
  readonly model: string | null;
};
export type LoggedMessage = {
  readonly id: string;
  /** Exactly what the visitor wrote. */
  readonly text: string;
  readonly language: string;
  readonly at: string;
  /** Null when the person chose without the model. */
  readonly answer: ModelAnswer | null;
  /** The spot the person confirmed, or null while unlinked. */
  readonly spot: string | null;
};
export type Review = {
  readonly schema: 'mercature-route-review/1';
  readonly place: string;
  /** Keyed by the record's stretch index. */
  readonly decisions: Readonly<Record<string, Decision>>;
  /** Newest first. */
  readonly messages: readonly LoggedMessage[];
};

const key = (place: string) => `mercature.route-review.v1.${place}`;
const empty = (place: string): Review => ({ schema: 'mercature-route-review/1', place, decisions: {}, messages: [] });
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isTime = (value: unknown): value is string => isText(value, 40) && !Number.isNaN(Date.parse(value));
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function parseAnswer(value: unknown): ModelAnswer | null {
  if (value === null) return null;
  if (!isRecord(value) || !['ready', 'unsure', 'unavailable'].includes(String(value.status))) throw new Error('answer');
  if (value.kind !== null && !MESSAGE_KINDS.includes(value.kind as MessageKind)) throw new Error('kind');
  if (value.category !== null && !ISSUE_CATEGORIES.includes(value.category as IssueCategory)) throw new Error('category');
  if (!Array.isArray(value.candidates) || value.candidates.length > 3 || !value.candidates.every(id => isText(id, 80))) throw new Error('candidates');
  if (value.model !== null && !isText(value.model, 200)) throw new Error('model');
  return { status: value.status as ModelAnswer['status'], kind: value.kind as MessageKind | null, category: value.category as IssueCategory | null, candidates: value.candidates as string[], model: value.model as string | null };
}

export function parseReview(raw: string, place: string): Review {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.schema !== 'mercature-route-review/1' || value.place !== place || !isRecord(value.decisions) || !Array.isArray(value.messages)) throw new Error('shape');
  const decisions: Record<string, Decision> = {};
  for (const [stretch, decision] of Object.entries(value.decisions)) {
    if (!/^\d{1,4}$/.test(stretch) || !isRecord(decision) || !VERDICTS.includes(decision.verdict as Verdict) || !isTime(decision.at)) throw new Error('decision');
    decisions[stretch] = { verdict: decision.verdict as Verdict, at: decision.at };
  }
  const messages = value.messages.slice(0, 200).map(item => {
    if (!isRecord(item) || !isText(item.id, 80) || !isText(item.text, 4000) || !isText(item.language, 20) || !isTime(item.at) || (item.spot !== null && !isText(item.spot, 80))) throw new Error('message');
    return { id: item.id, text: item.text, language: item.language, at: item.at, answer: parseAnswer(item.answer), spot: item.spot as string | null };
  });
  return { schema: 'mercature-route-review/1', place, decisions, messages };
}

/** Reads this place's review. An unreadable record is set aside, never silently overwritten. */
export function loadReview(place: string): { review: Review; error: string } {
  try {
    const raw = localStorage.getItem(key(place));
    if (raw === null) return { review: empty(place), error: '' };
    try {
      return { review: parseReview(raw, place), error: '' };
    } catch {
      localStorage.setItem(`${key(place)}.unreadable`, raw);
      localStorage.removeItem(key(place));
      return { review: empty(place), error: 'unreadable' };
    }
  } catch {
    return { review: empty(place), error: 'storage' };
  }
}

/** Returns false when the device refused to keep it, so the caller can say so. */
export function saveReview(review: Review): boolean {
  try {
    localStorage.setItem(key(review.place), JSON.stringify(review));
    return true;
  } catch {
    return false;
  }
}

export function decide(review: Review, stretches: readonly number[], verdict: Verdict | null, at = new Date().toISOString()): Review {
  const decisions = { ...review.decisions };
  for (const stretch of stretches) {
    if (verdict) decisions[String(stretch)] = { verdict, at };
    else delete decisions[String(stretch)];
  }
  return { ...review, decisions };
}

export const verdictOf = (review: Review, stretches: readonly number[]): Verdict | null =>
  stretches.length ? review.decisions[String(stretches[0])]?.verdict ?? null : null;

export function logMessage(review: Review, message: Omit<LoggedMessage, 'id' | 'at'>, id = crypto.randomUUID(), at = new Date().toISOString()): Review {
  return { ...review, messages: [{ ...message, id, at }, ...review.messages] };
}

export function updateMessage(review: Review, id: string, change: Partial<Pick<LoggedMessage, 'spot' | 'answer' | 'language'>>): Review {
  return { ...review, messages: review.messages.map(message => message.id === id ? { ...message, ...change } : message) };
}
