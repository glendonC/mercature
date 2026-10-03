import type { Project, Result } from '../spatial/contracts';

/** A report remains a report; source permissions are inherited by every saved derivative. */
export type Source = {
  id: string; revision: string; description: string;
  provenance: 'synthetic' | 'local'; permission: 'exportable' | 'local-only';
};
export type Origin = {
  kind: 'concern'; id: string; source: Source; originalText: string; language: string;
  supportingSpan: { start: number; end: number; quote: string };
} | {
  kind: 'proactive'; id: string; source: Source; expectation: string; method: string;
};
export type Confirmation = {
  method: 'human'; originHash: string; sceneHash: string; reviewer: string; confirmedAt: string;
  interpretation: string;
  targets: { id: string; featureHash: string; evidence: string[] }[];
};
export type Evaluation = {
  sceneHash: string; profileHash: string; scenarioHash: string; solverHash: string;
  baselineResultHash: string; proposedResultHash: string;
};
export type ImprovementPlan = {
  schemaVersion: 'mercature-plan-v1'; id: string; title: string; createdAt: string; updatedAt: string;
  origin: Origin; confirmation: Confirmation; project: Project; evaluation: Evaluation;
  decision: 'planned' | 'approved' | 'rejected'; notes: string;
};
export type PlanInput = {
  id: string; title: string; origin: Origin; confirmation: Confirmation; project: Project;
  decision?: ImprovementPlan['decision']; notes?: string; now?: string;
};
export type PlanEvaluation = { baseline: Result; proposed: Result };
export type PlanSummary = Pick<ImprovementPlan, 'id' | 'title' | 'createdAt' | 'updatedAt' | 'decision'> & {
  originKind: Origin['kind']; language: string | null; exportable: boolean;
};
export type PlanErrorCode = 'invalid' | 'stale' | 'too-large' | 'restricted-export' | 'not-found' | 'unavailable' | 'quota' | 'corrupt';
export type PlanError = { code: PlanErrorCode; message: string };
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: PlanError };
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
