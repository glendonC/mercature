import { SCHEMA_VERSION, type Operation, type Profile, type Project, type Scenario, type Scene } from './contracts';
import { SOLVER_HASH, contains, contentHash, covered, expand, overlaps, validateProfile, validateScenario, validateScene } from './validation';

export function createScenario(scene: Scene, profile: Profile): Scenario {
  validateScene(scene); validateProfile(profile);
  return { schemaVersion: SCHEMA_VERSION, hypothetical: true, baseSceneHash: contentHash(scene), profileHash: contentHash(profile), solverHash: SOLVER_HASH, operations: [] };
}
export function applyScenario(scene: Scene, profile: Profile, scenario: Scenario): Scene {
  validateScene(scene); validateProfile(profile); validateScenario(scenario);
  if (scenario.baseSceneHash !== contentHash(scene) || scenario.profileHash !== contentHash(profile) || scenario.solverHash !== SOLVER_HASH) throw new Error('Stale scenario: scene, profile or solver revision changed');
  const derived = structuredClone(scene);
  for (const operation of scenario.operations) {
    const obstacle = derived.obstacles.find(o => o.id === operation.objectId);
    if (!obstacle || !obstacle.reviewed || !obstacle.movable) throw new Error('Edit requires an existing reviewed movable obstruction');
    if (operation.kind === 'remove') {
      derived.obstacles = derived.obstacles.filter(o => o.id !== operation.objectId);
      continue;
    }
    const { x, y } = operation.to;
    const bounds = { minX: x, minY: y, maxX: x + obstacle.bounds.maxX - obstacle.bounds.minX, maxY: y + obstacle.bounds.maxY - obstacle.bounds.minY };
    const envelope = expand(bounds, obstacle.uncertainty);
    if (!contains(scene.bounds, envelope)) throw new Error('Placement lies outside the site');
    const supports = scene.supports.filter(s => Math.abs(s.elevation - obstacle.bottom) < 1e-9).map(s => expand(s.bounds, -s.uncertainty));
    if (!covered(envelope, supports) || scene.unknown.some(u => Math.abs(u.elevation - obstacle.bottom) < 1e-9 && overlaps(envelope, u.bounds))) throw new Error('Placement requires independently known support beneath the whole object');
    if (derived.obstacles.some(o => o.id !== obstacle.id && o.bottom - o.uncertainty < obstacle.top + obstacle.uncertainty && o.top + o.uncertainty > obstacle.bottom - obstacle.uncertainty && overlaps(envelope, expand(o.bounds, o.uncertainty)))) throw new Error('Placement collides with another obstruction');
    if (scene.supports.some(s => s.elevation > obstacle.bottom + 1e-9 && s.elevation - s.uncertainty < obstacle.top + obstacle.uncertainty && overlaps(envelope, expand(s.bounds, s.uncertainty)))) throw new Error('Placement intersects overhead support');
    obstacle.bounds = bounds;
  }
  return derived;
}
export function appendOperation(scene: Scene, profile: Profile, scenario: Scenario, operation: Operation): Scenario {
  const next = { ...structuredClone(scenario), operations: [...structuredClone(scenario.operations), structuredClone(operation)] };
  applyScenario(scene, profile, next);
  return next;
}
export function undoScenario(scenario: Scenario): Scenario {
  validateScenario(scenario);
  return { ...structuredClone(scenario), operations: structuredClone(scenario.operations.slice(0, -1)) };
}
export function serializeProject(scene: Scene, profile: Profile, scenario: Scenario): string {
  applyScenario(scene, profile, scenario);
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, scene, profile, scenario } satisfies Project, null, 2);
}
export function parseProject(text: string): Project {
  if (text.length > 2_000_000) throw new Error('Project exceeds the 2 MB synthetic-project limit');
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid project');
  const p = raw as Record<string, unknown>;
  if (p.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported project schema version');
  validateScene(p.scene); validateProfile(p.profile); validateScenario(p.scenario);
  applyScenario(p.scene, p.profile, p.scenario);
  return { schemaVersion: SCHEMA_VERSION, scene: p.scene, profile: p.profile, scenario: p.scenario };
}
