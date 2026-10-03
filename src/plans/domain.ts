import type { Project, Scene } from '../spatial/contracts';
import { applyScenario } from '../spatial/scenario';
import { solveScene } from '../spatial/solver';
import { contentHash, validateProfile, validateScenario, validateScene } from '../spatial/validation';
import type { Confirmation, Evaluation, ImprovementPlan, Origin, PlanErrorCode, PlanEvaluation, PlanInput, Source } from './contracts';

export const MAX_PLAN_BYTES = 1_000_000;
export class PlanValidationError extends Error {
  constructor(public code: PlanErrorCode, message: string) { super(message); this.name = 'PlanValidationError'; }
}
const fail = (message: string, code: PlanErrorCode = 'invalid'): never => { throw new PlanValidationError(code, message); };
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a record');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(record, key))) fail('Unexpected or missing record fields');
  return record;
}
function string(value: unknown, label: string, max = 4000, empty = false): asserts value is string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) fail(`Invalid ${label}`);
}
function id(value: unknown) { string(value, 'record ID', 100); if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(value)) fail('Invalid record ID'); }
function list(value: unknown, label: string, max = 200): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(`Invalid ${label}`);
}
function strings(value: unknown) { list(value, 'evidence'); value.forEach(item => string(item, 'evidence')); }
function time(value: unknown) { string(value, 'timestamp', 24); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Invalid timestamp'); }
function hash(value: unknown) { string(value, 'dependency hash', 71); if (!/^sha256:[a-f0-9]{64}$/.test(value)) fail('Invalid dependency hash'); }
export function validateSource(value: unknown): asserts value is Source {
  const s = object(value, ['id', 'revision', 'description', 'provenance', 'permission']);
  id(s.id); string(s.revision, 'source revision', 100); string(s.description, 'source description');
  if (s.provenance !== 'synthetic' && s.provenance !== 'local') fail('Unsupported source provenance');
  if (s.permission !== 'exportable' && s.permission !== 'local-only') fail('Source permission must be explicit');
  if (s.provenance === 'local' && s.permission !== 'local-only') fail('Local evidence must remain local-only');
}
export function validateOrigin(value: unknown): asserts value is Origin {
  if (!value || typeof value !== 'object') fail('Missing concern or proactive origin');
  const kind = (value as Record<string, unknown>).kind;
  const o = object(value, kind === 'concern'
    ? ['kind', 'id', 'source', 'originalText', 'language', 'supportingSpan']
    : ['kind', 'id', 'source', 'expectation', 'method']);
  id(o.id); validateSource(o.source);
  if (kind === 'concern') {
    string(o.originalText, 'original concern', 12000); string(o.language, 'original language', 80);
    const span = object(o.supportingSpan, ['start', 'end', 'quote']);
    string(span.quote, 'supporting quotation', 12000);
    if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || (span.start as number) < 0 || (span.end as number) <= (span.start as number) || (span.end as number) > o.originalText.length || o.originalText.slice(span.start as number, span.end as number) !== span.quote) fail('Supporting span must exactly match the original concern');
  } else if (kind === 'proactive') { string(o.expectation, 'proactive expectation'); string(o.method, 'proactive method'); }
  else fail('Unsupported issue origin');
}
/** Closed records prevent unreviewed extra metadata leaking through a synthetic export. */
function validateProject(value: unknown): asserts value is Project {
  const p = object(value, ['schemaVersion', 'scene', 'profile', 'scenario']);
  if (p.schemaVersion !== 'spatial-v1') fail('Unsupported project version');
  validateScene(p.scene); validateProfile(p.profile); validateScenario(p.scenario);
  const s = object(p.scene, ['schemaVersion', 'id', 'title', 'revision', 'provenance', 'units', 'bounds', 'supports', 'obstacles', 'unknown', 'start', 'destinations', 'assumptions']);
  const rect = (value: unknown) => object(value, ['minX', 'minY', 'maxX', 'maxY']);
  rect(s.bounds);
  for (const group of ['supports', 'obstacles', 'unknown'] as const) for (const feature of p.scene[group]) {
    const f = object(feature, group === 'obstacles'
      ? ['id', 'label', 'bounds', 'bottom', 'top', 'uncertainty', 'reviewed', 'movable', 'evidence']
      : group === 'supports' ? ['id', 'label', 'bounds', 'elevation', 'uncertainty', 'evidence'] : ['id', 'label', 'bounds', 'elevation', 'reason']);
    rect(f.bounds);
  }
  object(s.start, ['x', 'y', 'supportId']);
  p.scene.destinations.forEach(d => object(d, ['id', 'label', 'x', 'y', 'supportId']));
  object(p.profile, ['id', 'label', 'width', 'height', 'maxStep', 'cellSize', 'requirements', 'source']);
  object(p.profile.requirements, ['longitudinalSlope', 'crossSlope', 'turning', 'multilevel']);
  object(p.scenario, ['schemaVersion', 'hypothetical', 'baseSceneHash', 'profileHash', 'solverHash', 'operations']);
  p.scenario.operations.forEach(op => { object(op, op.kind === 'move' ? ['kind', 'objectId', 'to'] : ['kind', 'objectId']); if (op.kind === 'move') object(op.to, ['x', 'y']); });
  try { applyScenario(p.scene, p.profile, p.scenario); } catch (error) {
    fail(error instanceof Error ? error.message : 'Invalid scenario', error instanceof Error && error.message.startsWith('Stale scenario') ? 'stale' : 'invalid');
  }
}
function targets(scene: Scene) {
  const all = [...scene.supports, ...scene.obstacles, ...scene.unknown, ...scene.destinations];
  if (new Set(all.map(feature => feature.id)).size !== all.length) fail('Inventory and destination IDs must be globally unique');
  return all;
}
function featureEvidence(feature: ReturnType<typeof targets>[number], scene: Scene): string[] {
  if ('evidence' in feature) return feature.evidence;
  if ('reason' in feature) return [feature.reason];
  const support = scene.supports.find(s => s.id === feature.supportId);
  return support?.evidence.map(note => `Authored destination on ${support.id}: ${note}`) ?? [];
}
export function confirmTargets(input: { origin: Origin; scene: Scene; targetIds: string[]; reviewer: string; interpretation: string; now?: string }): Confirmation {
  validateOrigin(input.origin); validateScene(input.scene);
  const confirmation: Confirmation = {
    method: 'human', originHash: contentHash(input.origin), sceneHash: contentHash(input.scene),
    reviewer: input.reviewer, confirmedAt: input.now ?? new Date().toISOString(), interpretation: input.interpretation,
    targets: input.targetIds.map(id => {
      const feature = targets(input.scene).find(feature => feature.id === id);
      if (!feature) return fail('Confirmation requires a known inventory target');
      return { id, featureHash: contentHash(feature), evidence: [...featureEvidence(feature, input.scene)] };
    }),
  };
  validateConfirmation(confirmation, input.origin, input.scene);
  return confirmation;
}
function validateConfirmation(value: unknown, origin: Origin, scene: Scene): asserts value is Confirmation {
  const c = object(value, ['method', 'originHash', 'sceneHash', 'reviewer', 'confirmedAt', 'interpretation', 'targets']);
  if (c.method !== 'human') fail('A human must confirm issue targets');
  hash(c.originHash); hash(c.sceneHash); string(c.reviewer, 'reviewer', 200); time(c.confirmedAt); string(c.interpretation, 'reviewed interpretation');
  if (c.originHash !== contentHash(origin) || c.sceneHash !== contentHash(scene)) fail('Confirmation is stale: source or inventory changed', 'stale');
  list(c.targets, 'confirmed targets', 50);
  if (!c.targets.length) fail('An unresolved issue cannot become a confirmed plan');
  const used = new Set();
  for (const raw of c.targets) {
    const t = object(raw, ['id', 'featureHash', 'evidence']); string(t.id, 'target ID'); hash(t.featureHash); strings(t.evidence);
    const feature = targets(scene).find(feature => feature.id === t.id);
    if (used.has(t.id)) fail('Duplicate confirmation target'); used.add(t.id);
    if (!feature || t.featureHash !== contentHash(feature) || contentHash(t.evidence) !== contentHash(featureEvidence(feature, scene))) fail('Confirmed target or evidence changed', 'stale');
    if (!(t.evidence as string[]).length) fail('Target confirmation requires available evidence');
  }
}
function calculate(project: Project): PlanEvaluation {
  return { baseline: solveScene(project.scene, project.profile), proposed: solveScene(project.scene, project.profile, project.scenario) };
}
function bindings(results: PlanEvaluation): Evaluation {
  return { sceneHash: results.proposed.sceneHash, profileHash: results.proposed.profileHash, scenarioHash: results.proposed.scenarioHash,
    solverHash: results.proposed.solverHash, baselineResultHash: contentHash(results.baseline), proposedResultHash: contentHash(results.proposed) };
}
/** Validates all persisted records and recomputes both results with the same saved profile. */
function validateAndEvaluate(value: unknown): PlanEvaluation {
  const p = object(value, ['schemaVersion', 'id', 'title', 'createdAt', 'updatedAt', 'origin', 'confirmation', 'project', 'evaluation', 'decision', 'notes']);
  if (p.schemaVersion !== 'mercature-plan-v1') fail('Unsupported improvement-plan version');
  id(p.id); string(p.title, 'plan title', 200); time(p.createdAt); time(p.updatedAt);
  if ((p.updatedAt as string) < (p.createdAt as string)) fail('Plan update precedes creation');
  string(p.notes, 'plan notes', 12000, true);
  if (!['planned', 'approved', 'rejected'].includes(p.decision as string)) fail('Plans cannot imply physical implementation or verified outcomes');
  validateOrigin(p.origin); validateProject(p.project); validateConfirmation(p.confirmation, p.origin, p.project.scene);
  if (p.confirmation.confirmedAt > (p.updatedAt as string)) fail('Confirmation is newer than the saved plan');
  const confirmed = new Set(p.confirmation.targets.map(t => t.id));
  if (p.project.scenario.operations.some(op => !confirmed.has(op.objectId))) fail('Every operation must target a human-confirmed feature');
  const e = object(p.evaluation, ['sceneHash', 'profileHash', 'scenarioHash', 'solverHash', 'baselineResultHash', 'proposedResultHash']);
  Object.values(e).forEach(hash);
  const results = calculate(p.project);
  if (contentHash(e) !== contentHash(bindings(results))) fail('Saved evaluation is stale or altered; review and test this proposal again', 'stale');
  return results;
}
export function evaluatePlan(value: unknown): PlanEvaluation {
  try { return validateAndEvaluate(value); } catch (error) {
    if (error instanceof PlanValidationError) throw error;
    throw new PlanValidationError('invalid', error instanceof Error ? error.message : 'Invalid improvement plan');
  }
}
export function createPlan(input: PlanInput): ImprovementPlan {
  validateOrigin(input.origin); validateProject(input.project); validateConfirmation(input.confirmation, input.origin, input.project.scene);
  const now = input.now ?? new Date().toISOString();
  const plan: ImprovementPlan = structuredClone({ schemaVersion: 'mercature-plan-v1', id: input.id, title: input.title,
    createdAt: now, updatedAt: now, origin: input.origin, confirmation: input.confirmation, project: input.project,
    evaluation: bindings(calculate(input.project)), decision: input.decision ?? 'planned', notes: input.notes ?? '' });
  evaluatePlan(plan);
  return plan;
}
export function reviseDecision(plan: ImprovementPlan, decision: ImprovementPlan['decision'], notes = plan.notes, now = new Date().toISOString()): ImprovementPlan {
  const next = structuredClone({ ...plan, decision, notes, updatedAt: now }); evaluatePlan(next); return next;
}
function bounded(text: string) {
  if (typeof text !== 'string') fail('Expected JSON text');
  // Character check avoids allocating an oversized UTF-8 buffer.
  if (text.length > MAX_PLAN_BYTES || new TextEncoder().encode(text).length > MAX_PLAN_BYTES) fail('Plan exceeds the 1 MB limit', 'too-large');
}
export function serializePlan(plan: ImprovementPlan): string { evaluatePlan(plan); const text = JSON.stringify(plan); bounded(text); return text; }
export function parsePlan(text: string): ImprovementPlan {
  bounded(text); let raw: unknown;
  try { raw = JSON.parse(text); } catch { fail('Plan JSON is corrupt', 'corrupt'); }
  evaluatePlan(raw); return raw as ImprovementPlan;
}
export function canExportPlan(plan: ImprovementPlan): boolean { return plan.origin.source.provenance === 'synthetic' && plan.origin.source.permission === 'exportable'; }
export function exportPlan(plan: ImprovementPlan): string {
  if (!canExportPlan(plan)) fail('Local or restricted evidence cannot be exported. Create a separate authored synthetic example.', 'restricted-export');
  return serializePlan(plan);
}
export function importPlan(text: string): ImprovementPlan {
  const plan = parsePlan(text);
  if (!canExportPlan(plan)) fail('Only explicitly exportable synthetic plans can be imported', 'restricted-export');
  return plan;
}
