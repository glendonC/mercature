import type { ImprovementPlan, Outcome, PlanErrorCode, PlanSummary, StorageLike } from './contracts';
import { canExportPlan, parsePlan, PlanValidationError, serializePlan } from './domain';
import { contentHash } from '../spatial/validation';

export const PLAN_STORAGE_KEY = 'mercature.improvement-plans.v1';
export const MAX_SAVED_PLANS = 20;
const MAX_STORE_BYTES = 4_000_000;
function error(error: unknown): Outcome<never> {
  if (error instanceof PlanValidationError) return { ok: false, error: { code: error.code, message: error.message } };
  const name = error instanceof Error ? error.name : '';
  const code: PlanErrorCode = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ? 'quota' : 'unavailable';
  return { ok: false, error: { code, message: code === 'quota' ? 'Local storage is full. This plan was not saved.' : 'Local storage is unavailable. This plan was not changed.' } };
}
/** One atomic localStorage write; an index can never diverge from the saved records. */
export function createPlanStore(providedStorage?: StorageLike) {
  const storage = () => providedStorage ?? globalThis.localStorage;
  function readRecords(): unknown[] {
    const text = storage().getItem(PLAN_STORAGE_KEY);
    if (text === null) return [];
    if (text.length > MAX_STORE_BYTES || new TextEncoder().encode(text).length > MAX_STORE_BYTES) throw new PlanValidationError('too-large', 'Saved plan collection exceeds the 4 MB limit');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new PlanValidationError('corrupt', 'Saved plan collection is corrupt; existing data was preserved'); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PlanValidationError('corrupt', 'Invalid saved plan collection');
    const record = raw as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || record.schemaVersion !== 'mercature-plan-store-v1' || !Array.isArray(record.plans) || record.plans.length > MAX_SAVED_PLANS) throw new PlanValidationError('corrupt', 'Unsupported or oversized saved plan collection');
    const ids = record.plans.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.id !== 'string') throw new PlanValidationError('corrupt', 'Saved plan has no record ID');
      return value.id;
    });
    if (new Set(ids).size !== ids.length) throw new PlanValidationError('corrupt', 'Duplicate saved plan IDs');
    return record.plans;
  }
  function read(): ImprovementPlan[] { return readRecords().map(value => parsePlan(JSON.stringify(value))); }
  function write(plans: unknown[]) {
    const text = JSON.stringify({ schemaVersion: 'mercature-plan-store-v1', plans });
    if (new TextEncoder().encode(text).length > MAX_STORE_BYTES) throw new PlanValidationError('too-large', 'Saved plan collection exceeds the 4 MB limit');
    storage().setItem(PLAN_STORAGE_KEY, text);
  }
  function attempt<T>(operation: () => T): Outcome<T> { try { return { ok: true, value: operation() }; } catch (e) { return error(e); } }
  return {
    list(): Outcome<PlanSummary[]> {
      return attempt(() => read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(plan => ({
        id: plan.id, title: plan.title, createdAt: plan.createdAt, updatedAt: plan.updatedAt, decision: plan.decision,
        originKind: plan.origin.kind, language: plan.origin.kind === 'concern' ? plan.origin.language : null, exportable: canExportPlan(plan),
      })));
    },
    save(plan: ImprovementPlan): Outcome<ImprovementPlan> {
      return attempt(() => {
        // Round-trip rejects extra properties and detaches mutable caller-owned references.
        const validated = parsePlan(serializePlan(plan));
        const plans = read(); const index = plans.findIndex(p => p.id === validated.id);
        if (index < 0) {
          if (plans.length >= MAX_SAVED_PLANS) throw new PlanValidationError('too-large', `At most ${MAX_SAVED_PLANS} plans can be saved locally`);
          plans.push(validated);
        } else {
          const previous = plans[index];
          if (previous.createdAt !== validated.createdAt || contentHash(previous.origin) !== contentHash(validated.origin) || contentHash(previous.project.scene) !== contentHash(validated.project.scene)) throw new PlanValidationError('stale', 'A saved plan keeps its original concern and baseline. Save changed evidence as a new plan.');
          if (validated.updatedAt < previous.updatedAt) throw new PlanValidationError('stale', 'A newer revision of this plan is already saved');
          plans[index] = validated;
        }
        write(plans); return validated;
      });
    },
    load(id: string): Outcome<ImprovementPlan> {
      return attempt(() => {
        const plan = read().find(p => p.id === id);
        if (!plan) throw new PlanValidationError('not-found', 'Saved plan was not found');
        return plan;
      });
    },
    delete(id: string): Outcome<void> {
      return attempt(() => {
        // Deletion is also available for stale or invalid individual records.
        const plans = readRecords() as { id: string }[];
        if (!plans.some(p => p.id === id)) throw new PlanValidationError('not-found', 'Saved plan was not found');
        write(plans.filter(p => p.id !== id));
      });
    },
  };
}
