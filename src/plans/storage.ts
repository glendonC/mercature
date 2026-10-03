import type { ImprovementPlan, OpenablePlan, Outcome, PlanError, PlanErrorCode, PlanSummary, StorageLike, UnreadablePlan } from './contracts';
import { canExportPlan, parsePlan, PlanValidationError, serializePlan } from './domain';
import { contentHash } from '../spatial/validation';

export const PLAN_STORAGE_KEY = 'mercature.improvement-plans.v1';
export const MAX_SAVED_PLANS = 20;
const MAX_STORE_BYTES = 4_000_000;
/** A record as stored. Only its id is checked until the plan itself is opened. */
type StoredRecord = { id: string } & Record<string, unknown>;
function error(error: unknown): Outcome<never> {
  if (error instanceof PlanValidationError) return { ok: false, error: { code: error.code, message: error.message } };
  const name = error instanceof Error ? error.name : '';
  const code: PlanErrorCode = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ? 'quota' : 'unavailable';
  return { ok: false, error: { code, message: code === 'quota' ? 'Local storage is full. This plan was not saved.' : 'Local storage is unavailable. This plan was not changed.' } };
}
function problem(error: unknown): PlanError {
  const code = error instanceof PlanValidationError ? error.code : 'invalid';
  return { code, message: code === 'stale' ? 'Saved for an earlier version of this place. It no longer opens.' : 'This saved plan cannot be read.' };
}
const titleOf = (record: StoredRecord) => typeof record.title === 'string' && record.title.trim() && record.title.length <= 200 ? record.title : 'Saved plan';
/**
 * One atomic localStorage write; an index can never diverge from the saved records.
 * Each plan is parsed on its own, so a stale or invalid plan never blocks listing, opening or saving the others.
 */
export function createPlanStore(providedStorage?: StorageLike) {
  const storage = () => providedStorage ?? globalThis.localStorage;
  function readRecords(): StoredRecord[] {
    const text = storage().getItem(PLAN_STORAGE_KEY);
    if (text === null) return [];
    if (text.length > MAX_STORE_BYTES || new TextEncoder().encode(text).length > MAX_STORE_BYTES) throw new PlanValidationError('too-large', 'Saved plan collection exceeds the 4 MB limit');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new PlanValidationError('corrupt', 'Saved plan collection is corrupt; existing data was preserved'); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PlanValidationError('corrupt', 'Invalid saved plan collection');
    const record = raw as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || record.schemaVersion !== 'mercature-plan-store-v1' || !Array.isArray(record.plans) || record.plans.length > MAX_SAVED_PLANS) throw new PlanValidationError('corrupt', 'Unsupported or oversized saved plan collection');
    const plans = record.plans.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.id !== 'string') throw new PlanValidationError('corrupt', 'Saved plan has no record ID');
      return value as StoredRecord;
    });
    if (new Set(plans.map(plan => plan.id)).size !== plans.length) throw new PlanValidationError('corrupt', 'Duplicate saved plan IDs');
    return plans;
  }
  const open = (record: StoredRecord) => parsePlan(JSON.stringify(record));
  function write(plans: StoredRecord[]) {
    const text = JSON.stringify({ schemaVersion: 'mercature-plan-store-v1', plans });
    if (new TextEncoder().encode(text).length > MAX_STORE_BYTES) throw new PlanValidationError('too-large', 'Saved plan collection exceeds the 4 MB limit');
    storage().setItem(PLAN_STORAGE_KEY, text);
    // A device that drops the write without an error must not report a saved plan.
    if (storage().getItem(PLAN_STORAGE_KEY) !== text) throw new PlanValidationError('unavailable', 'This device did not keep the change. Nothing was saved.');
  }
  function attempt<T>(operation: () => T): Outcome<T> { try { return { ok: true, value: operation() }; } catch (e) { return error(e); } }
  return {
    /** Plans that open, newest first, then plans that no longer open, each with its problem. */
    list(): Outcome<PlanSummary[]> {
      return attempt(() => {
        const openable: OpenablePlan[] = [], unreadable: UnreadablePlan[] = [];
        for (const record of readRecords()) {
          let plan: ImprovementPlan;
          try { plan = open(record); } catch (e) { unreadable.push({ id: record.id, title: titleOf(record), problem: problem(e) }); continue; }
          openable.push({ id: plan.id, title: plan.title, createdAt: plan.createdAt, updatedAt: plan.updatedAt, decision: plan.decision,
            originKind: plan.origin.kind, language: plan.origin.kind === 'concern' ? plan.origin.language : null, exportable: canExportPlan(plan) });
        }
        return [...openable.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), ...unreadable];
      });
    },
    save(plan: ImprovementPlan): Outcome<ImprovementPlan> {
      return attempt(() => {
        // Round-trip rejects extra properties and detaches mutable caller-owned references.
        const validated = parsePlan(serializePlan(plan));
        // Other saved plans are written back exactly as stored, whether or not they still open.
        const plans = readRecords(); const index = plans.findIndex(p => p.id === validated.id);
        if (index < 0) {
          if (plans.length >= MAX_SAVED_PLANS) throw new PlanValidationError('too-large', `At most ${MAX_SAVED_PLANS} plans can be saved on this device.`);
          plans.push(validated);
        } else {
          let previous: ImprovementPlan;
          try { previous = open(plans[index]); } catch { throw new PlanValidationError('stale', 'The saved copy of this plan no longer opens, so it was not replaced.'); }
          if (previous.createdAt !== validated.createdAt || contentHash(previous.origin) !== contentHash(validated.origin) || contentHash(previous.project.scene) !== contentHash(validated.project.scene)) throw new PlanValidationError('stale', 'A saved plan keeps its original concern and baseline. Save changed evidence as a new plan.');
          if (validated.updatedAt < previous.updatedAt) throw new PlanValidationError('stale', 'A newer revision of this plan is already saved');
          plans[index] = validated;
        }
        write(plans); return validated;
      });
    },
    load(id: string): Outcome<ImprovementPlan> {
      return attempt(() => {
        const record = readRecords().find(p => p.id === id);
        if (!record) throw new PlanValidationError('not-found', 'Saved plan was not found');
        return open(record);
      });
    },
    delete(id: string): Outcome<void> {
      return attempt(() => {
        // Deletion works for plans that no longer open.
        const plans = readRecords();
        if (!plans.some(p => p.id === id)) throw new PlanValidationError('not-found', 'Saved plan was not found');
        write(plans.filter(p => p.id !== id));
      });
    },
  };
}
