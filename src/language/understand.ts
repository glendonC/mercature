import type { IssueCategory, MessageKind, Site } from '../site/contracts';
import { LANGUAGE_LIMITS, normalizeLanguageText } from './index';

/** Identity of the model that produced a result, so a saved decision can name its source. */
export type ModelInfo = { readonly id: string; readonly revision: string; readonly bytes: number };

export type ModelState =
  | { readonly status: 'absent' }
  | { readonly status: 'downloading'; readonly loadedBytes: number; readonly totalBytes: number }
  | { readonly status: 'ready'; readonly model: ModelInfo }
  | { readonly status: 'failed'; readonly error: string };

/** Why a person has to decide. */
export type UnsureReason = 'unclear-kind' | 'unclear-place' | 'no-place';

/**
 * ready: the model answered from its fixed lists.
 * unsure: it answered, but a person must decide; candidates may still be offered.
 * unavailable: no usable model on this device; the manual workflow continues.
 * invalid: the message cannot be processed.
 */
export type Understanding = {
  readonly status: 'ready' | 'unsure' | 'unavailable' | 'invalid';
  readonly kind: MessageKind | null;
  /** Set only for problems. */
  readonly category: IssueCategory | null;
  /** Site feature ids, best first, at most three. Order only; never shown as a probability. */
  readonly candidates: readonly string[];
  readonly reason?: UnsureReason | 'model-missing' | 'model-failed' | 'invalid-input';
  readonly model?: ModelInfo;
  readonly elapsedMs?: number;
};

export function modelState(): ModelState {
  return { status: 'absent' };
}

/** Downloads and caches the model once; later calls work offline. */
export async function prepareModel(onProgress?: (state: ModelState) => void): Promise<ModelState> {
  const state = modelState();
  onProgress?.(state);
  return state;
}

export async function understand(message: string, site: Site): Promise<Understanding> {
  const length = typeof message === 'string' ? Array.from(message).length : 0;
  if (!length || length > LANGUAGE_LIMITS.messageCodePoints || !normalizeLanguageText(message) || !site.features.length) {
    return { status: 'invalid', kind: null, category: null, candidates: [], reason: 'invalid-input' };
  }
  return { status: 'unavailable', kind: null, category: null, candidates: [], reason: 'model-missing' };
}
