import { expect, test } from '@playwright/test';
import { appendOperation, createScenario } from '../../src/spatial/scenario';
import { BENCH_CLEAR_POSITION, DEFAULT_PROFILE, SYNTHETIC_SCENE } from '../../src/spatial/fixtures';
import { contentHash } from '../../src/spatial/validation';
import { canExportPlan, confirmTargets, createPlan, createPlanStore, evaluatePlan, exportPlan, importPlan, MAX_PLAN_BYTES, parsePlan, PLAN_STORAGE_KEY, reviseDecision, serializePlan, type ImprovementPlan, type Origin, type StorageLike } from '../../src/plans';

const now = '2026-10-03T16:00:00.000Z';
const later = '2026-10-03T17:00:00.000Z';
function origin(local = false): Origin {
  const originalText = '벤치 옆 통로가 좁아요. 정원으로 가기 어려워요.';
  return { kind: 'concern', id: 'concern-1', source: { id: 'source-1', revision: '1', description: 'Authored Korean trial statement', provenance: local ? 'local' : 'synthetic', permission: local ? 'local-only' : 'exportable' }, originalText, language: 'ko', supportingSpan: { start: 0, end: originalText.length, quote: originalText } };
}
function plan(local = false, operations = true): ImprovementPlan {
  const scene = structuredClone(SYNTHETIC_SCENE), profile = { ...structuredClone(DEFAULT_PROFILE), cellSize: .5 };
  const issue = origin(local);
  const scenario = operations ? appendOperation(scene, profile, createScenario(scene, profile), { kind: 'move', objectId: 'bench', to: BENCH_CLEAR_POSITION }) : createScenario(scene, profile);
  return createPlan({ id: 'plan-1', title: 'Review the courtyard passage', origin: issue, confirmation: confirmTargets({ origin: issue, scene, targetIds: ['bench'], reviewer: 'Operator', interpretation: 'Reported difficulty beside the bench; no field measurements supplied.', now }), project: { schemaVersion: 'spatial-v1', scene, profile, scenario }, now });
}
function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
function changed(mutate: (p: ImprovementPlan) => void) { const p = plan(); mutate(p); return JSON.stringify(p); }

test('Korean concern, original evidence, operations and same-profile calculations survive reopen', () => {
  const p = plan(); const before = evaluatePlan(p); const restored = parsePlan(serializePlan(p));
  expect(restored).toEqual(p);
  expect(restored.origin).toEqual(origin());
  expect(evaluatePlan(restored)).toEqual(before);
  expect(before.baseline.profileHash).toBe(before.proposed.profileHash);
  expect(before.proposed.reachableArea).toBeGreaterThan(before.baseline.reachableArea);
  expect(restored.decision).toBe('planned'); expect(before.proposed.hypothetical).toBe(true);
});

test('empty scenario records a reviewed issue without inventing a proposal', () => {
  const p = plan(false, false); const results = evaluatePlan(p);
  expect(p.project.scenario.operations).toEqual([]);
  expect(results.baseline.reachableArea).toBe(results.proposed.reachableArea);
});

test('proactive checks preserve explicit expectation and method without becoming complaints', () => {
  const p = plan(); const proactive: Origin = { kind: 'proactive', id: 'check-1', source: p.origin.source, expectation: 'Review the selected square-envelope passage', method: 'Operator-initiated geometry check' };
  const confirmation = confirmTargets({ origin: proactive, scene: p.project.scene, targetIds: ['bench'], reviewer: 'Operator', interpretation: 'Test a bench move under the selected requirements.', now });
  const result = parsePlan(serializePlan(createPlan({ ...p, origin: proactive, confirmation, now })));
  expect(result.origin).toEqual(proactive);
  expect(result.origin).not.toHaveProperty('originalText');
});

test('approval and rejection never become implementation', () => {
  const p = reviseDecision(plan(), 'approved', 'Awaiting operator action', later);
  expect(parsePlan(serializePlan(p)).decision).toBe('approved');
  expect(reviseDecision(p, 'rejected', 'Do not proceed', later).decision).toBe('rejected');
  expect(() => parsePlan(changed(p => { (p as unknown as Record<string, unknown>).decision = 'implemented'; }))).toThrow(/physical implementation/);
  expect(() => parsePlan(changed(p => { (p as unknown as Record<string, unknown>).implementationEvidence = 'done'; }))).toThrow(/Unexpected/);
});

test('changed source text, language, permissions or inventory invalidate manual confirmation', () => {
  for (const mutate of [
    (p: ImprovementPlan) => { if (p.origin.kind === 'concern') p.origin.language = 'en'; },
    (p: ImprovementPlan) => { p.origin.source.revision = '2'; },
    (p: ImprovementPlan) => { p.origin.source.permission = 'local-only'; },
    (p: ImprovementPlan) => { p.project.scene.obstacles[2].evidence[0] = 'Different observation'; },
  ]) expect(() => parsePlan(changed(mutate))).toThrow(/stale/i);
});

test('supporting span must preserve the exact report, including negation', () => {
  expect(() => parsePlan(changed(p => { if (p.origin.kind === 'concern') p.origin.supportingSpan.quote = 'There is no problem'; }))).toThrow(/exactly match/);
  expect(() => parsePlan(changed(p => { if (p.origin.kind === 'concern') p.origin.supportingSpan.end = 100000; }))).toThrow(/exactly match/);
});

test('unknown, absent and duplicate targets cannot be confirmed', () => {
  const p = plan();
  for (const targetIds of [[], ['invented-bench'], ['bench', 'bench']]) expect(() => confirmTargets({ origin: p.origin, scene: p.project.scene, targetIds, reviewer: 'Operator', interpretation: 'Review the target', now })).toThrow();
  expect(() => confirmTargets({ origin: p.origin, scene: p.project.scene, targetIds: ['bench'], reviewer: '', interpretation: 'Review the target', now })).toThrow(/reviewer/);
});

test('confirmation cannot change target snapshots or invent target evidence', () => {
  expect(() => parsePlan(changed(p => { p.confirmation.targets[0].evidence.push('Measured clearance passes'); }))).toThrow(/evidence changed/);
  expect(() => parsePlan(changed(p => { p.confirmation.targets[0].id = 'wall-south'; }))).toThrow(/target or evidence changed/);
});

test('scenario operations must belong to confirmed targets', () => {
  const p = plan();
  const confirmation = confirmTargets({ origin: p.origin, scene: p.project.scene, targetIds: ['courtyard'], reviewer: 'Operator', interpretation: 'Review courtyard only', now });
  expect(() => createPlan({ ...p, confirmation, now })).toThrow(/human-confirmed/);
});

test('saved profile, solver, scenarios and result hashes cannot silently go stale', () => {
  for (const mutate of [
    (p: ImprovementPlan) => { p.project.profile.width = 1.2; },
    (p: ImprovementPlan) => { p.project.scenario.solverHash = contentHash('old solver'); },
    (p: ImprovementPlan) => { p.project.scenario.operations = []; },
    (p: ImprovementPlan) => { p.evaluation.proposedResultHash = contentHash('canned success'); },
  ]) expect(() => parsePlan(changed(mutate))).toThrow(/stale/i);
});

test('invalid placements and non-synthetic geometry are rejected', () => {
  expect(() => parsePlan(changed(p => { p.project.scenario.operations = [{ kind: 'move', objectId: 'bench', to: { x: 100, y: 100 } }]; }))).toThrow(/outside/);
  expect(() => parsePlan(changed(p => { (p.project.scene as unknown as Record<string, unknown>).provenance = 'measured'; }))).toThrow(/synthetic/);
});

test('synthetic export round trips, local evidence never exports or imports', () => {
  const p = plan(); expect(importPlan(exportPlan(p))).toEqual(p); expect(canExportPlan(p)).toBe(true);
  const local = plan(true); expect(canExportPlan(local)).toBe(false);
  expect(parsePlan(serializePlan(local))).toEqual(local);
  expect(() => exportPlan(local)).toThrow(/cannot be exported/);
  expect(() => importPlan(serializePlan(local))).toThrow(/exportable synthetic/);
  expect(() => parsePlan(changed(p => { p.origin.source.provenance = 'local'; }))).toThrow(/remain local-only/);
});

test('extra source, project and feature fields cannot leak through an export', () => {
  for (const mutate of [
    (p: ImprovementPlan) => { (p.origin.source as unknown as Record<string, unknown>).privateMessage = 'secret'; },
    (p: ImprovementPlan) => { (p.project as unknown as Record<string, unknown>).localPhoto = 'secret'; },
    (p: ImprovementPlan) => { (p.project.scene.obstacles[0] as unknown as Record<string, unknown>).localPhoto = 'secret'; },
  ]) expect(() => parsePlan(changed(mutate))).toThrow(/Unexpected/);
});

test('malformed, oversized, nonfinite and unsupported records are rejected before reopening', () => {
  for (const value of ['{', 'null', '[]', '{}']) expect(() => parsePlan(value)).toThrow();
  expect(() => parsePlan(' '.repeat(MAX_PLAN_BYTES + 1))).toThrow(/1 MB/);
  expect(() => parsePlan('가'.repeat(MAX_PLAN_BYTES / 2))).toThrow(/1 MB/);
  expect(() => parsePlan(changed(p => { p.project.profile.width = Infinity; }))).toThrow(/width/);
  expect(() => parsePlan(changed(p => { (p as unknown as Record<string, unknown>).schemaVersion = 'future-v9'; }))).toThrow(/version/);
});

test('list, save, load and delete preserve detached records across store instances', () => {
  const backend = memory(), store = createPlanStore(backend); const p = plan(true);
  expect(store.list()).toEqual({ ok: true, value: [] }); expect(store.save(p).ok).toBe(true);
  const reopened = createPlanStore(backend).load(p.id); expect(reopened).toEqual({ ok: true, value: p });
  p.title = 'Unsaved change'; expect(store.load(p.id)).toEqual(reopened);
  expect(store.list()).toMatchObject({ ok: true, value: [{ title: 'Review the courtyard passage', language: 'ko', exportable: false }] });
  expect(store.delete(p.id)).toEqual({ ok: true, value: undefined });
  expect(store.load(p.id)).toMatchObject({ ok: false, error: { code: 'not-found' } });
  expect(store.list()).toEqual({ ok: true, value: [] });
});

test('storage failures are structured and a failed atomic write preserves the saved version', () => {
  const backend = memory(), store = createPlanStore(backend), p = plan(); expect(store.save(p).ok).toBe(true);
  const saved = backend.data.get(PLAN_STORAGE_KEY);
  backend.setItem = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  expect(store.save(reviseDecision(p, 'approved', '', later))).toMatchObject({ ok: false, error: { code: 'quota' } });
  expect(backend.data.get(PLAN_STORAGE_KEY)).toBe(saved);
  const denied = createPlanStore({ ...backend, getItem: () => { throw new Error('denied'); } });
  expect(denied.list()).toMatchObject({ ok: false, error: { code: 'unavailable' } });
});

test('corrupt stored data is preserved without silently resetting or overwriting it', () => {
  const backend = memory(); backend.data.set(PLAN_STORAGE_KEY, '{broken'); const store = createPlanStore(backend);
  expect(store.list()).toMatchObject({ ok: false, error: { code: 'corrupt' } });
  expect(store.save(plan())).toMatchObject({ ok: false, error: { code: 'corrupt' } });
  expect(store.delete('plan-1')).toMatchObject({ ok: false, error: { code: 'corrupt' } });
  expect(backend.data.get(PLAN_STORAGE_KEY)).toBe('{broken');
});

test('saved original concern and baseline cannot be overwritten by a different plan under the same ID', () => {
  const backend = memory(), store = createPlanStore(backend), p = plan(); store.save(p);
  const replacement = plan(true);
  expect(store.save(replacement)).toMatchObject({ ok: false, error: { code: 'stale' } });
  expect(store.load(p.id)).toEqual({ ok: true, value: p });
  expect(store.save(reviseDecision(p, 'approved', '', later)).ok).toBe(true);
  expect(store.save(p)).toMatchObject({ ok: false, error: { code: 'stale' } });
});

test('destination confirmation binds its position and supporting evidence without enabling a geometry edit', () => {
  const p = plan(false, false);
  const confirmation = confirmTargets({ origin: p.origin, scene: p.project.scene, targetIds: ['garden'], reviewer: 'Operator', interpretation: 'Review the reported garden approach', now });
  expect(confirmation.targets[0].evidence[0]).toContain('Authored destination on courtyard');
  expect(() => createPlan({ ...p, confirmation, now })).not.toThrow();
  const ambiguous = structuredClone(p.project.scene); ambiguous.destinations[0].id = 'bench';
  expect(() => confirmTargets({ origin: p.origin, scene: ambiguous, targetIds: ['bench'], reviewer: 'Operator', interpretation: 'Ambiguous ID', now })).toThrow(/unique/);
});

test('a stale record is listed as unreadable, never blocks the other plans and can still be deleted', () => {
  const backend = memory(), store = createPlanStore(backend), p = plan(); store.save(p);
  const other = { ...plan(), id: 'plan-2', title: 'Second plan' }; expect(store.save(other).ok).toBe(true);
  const saved = JSON.parse(backend.data.get(PLAN_STORAGE_KEY)!);
  saved.plans[0].evaluation.proposedResultHash = contentHash('outdated result');
  const stale = JSON.stringify(saved.plans[0]);
  backend.data.set(PLAN_STORAGE_KEY, JSON.stringify(saved));
  expect(store.load(p.id)).toMatchObject({ ok: false, error: { code: 'stale' } });
  expect(store.list()).toMatchObject({ ok: true, value: [{ id: 'plan-2', title: 'Second plan' }, { id: p.id, title: p.title, problem: { code: 'stale' } }] });
  expect(store.load('plan-2')).toEqual({ ok: true, value: other });
  expect(store.save({ ...plan(), id: 'plan-3' }).ok).toBe(true);
  expect(JSON.stringify(JSON.parse(backend.data.get(PLAN_STORAGE_KEY)!).plans[0])).toBe(stale);
  expect(store.save(p)).toMatchObject({ ok: false, error: { code: 'stale' } });
  expect(store.delete(p.id).ok).toBe(true);
  expect(store.list()).toMatchObject({ ok: true, value: [{ id: 'plan-2' }, { id: 'plan-3' }] });
});

test('a write the device does not keep is reported instead of saved', () => {
  const backend = memory(), store = createPlanStore({ ...backend, setItem: () => {} });
  expect(store.save(plan())).toMatchObject({ ok: false, error: { code: 'unavailable' } });
});

test('invalid geometry returns a structured invalid error from local storage', () => {
  const backend = memory(), store = createPlanStore(backend), p = plan(); store.save(p);
  const saved = JSON.parse(backend.data.get(PLAN_STORAGE_KEY)!); saved.plans[0].project.profile.width = null;
  backend.data.set(PLAN_STORAGE_KEY, JSON.stringify(saved));
  expect(store.load(p.id)).toMatchObject({ ok: false, error: { code: 'invalid' } });
});
