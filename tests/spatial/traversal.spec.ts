import { test, expect } from '@playwright/test';
import { solveScene } from '../../src/spatial/solver';
import { DEFAULT_PROFILE, SYNTHETIC_SCENE } from '../../src/spatial/fixtures';
import { appendOperation, applyScenario, createScenario, parseProject, serializeProject, undoScenario } from '../../src/spatial/scenario';
import { sampleTraversal, traversalIsCurrent } from '../../src/spatial/traversal';
import { contentHash, SOLVER_HASH } from '../../src/spatial/validation';
import type { Profile, Scene, Traversal } from '../../src/spatial/contracts';

function room(): Scene {
  const scene = structuredClone(SYNTHETIC_SCENE);
  scene.obstacles = []; scene.unknown = [];
  scene.start = { x: 1.017, y: 1.033, supportId: 'courtyard' };
  scene.destinations = [{ id: 'end', label: 'End', x: 10.013, y: 6.029, supportId: 'courtyard' }];
  return scene;
}

/** Independent rectangular swept-envelope oracle, not solver functions or cell statuses. */
function inspectSweeps(path: Traversal, scene: Scene, profile: Profile) {
  expect(path.points.length).toBeGreaterThan(0);
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i-1], b = path.points[i], r = profile.width/2;
    expect(a.x === b.x || a.y === b.y).toBe(true);
    expect(a.elevation).toBe(b.elevation);
    const sweep = { minX: Math.min(a.x,b.x)-r, maxX: Math.max(a.x,b.x)+r, minY: Math.min(a.y,b.y)-r, maxY: Math.max(a.y,b.y)+r };
    const intersects = (bounds: typeof sweep) => sweep.minX < bounds.maxX-1e-9 && sweep.maxX > bounds.minX+1e-9 && sweep.minY < bounds.maxY-1e-9 && sweep.maxY > bounds.minY+1e-9;
    expect(sweep.minX).toBeGreaterThanOrEqual(scene.bounds.minX);
    expect(sweep.maxX).toBeLessThanOrEqual(scene.bounds.maxX);
    expect(sweep.minY).toBeGreaterThanOrEqual(scene.bounds.minY);
    expect(sweep.maxY).toBeLessThanOrEqual(scene.bounds.maxY);
    for (const obstacle of scene.obstacles) {
      if (obstacle.bottom < a.elevation+profile.height && obstacle.top > a.elevation) expect(intersects(obstacle.bounds)).toBe(false);
    }
    for (const unknown of scene.unknown) if (unknown.elevation === a.elevation) expect(intersects(unknown.bounds)).toBe(false);
  }
}

test('complete traversal retains exact off-grid endpoints and only checked cardinal sweeps', () => {
  const scene = room(), profile = structuredClone(DEFAULT_PROFILE);
  // Forces a detour; a straight start-to-destination interpolation would intersect this box.
  scene.obstacles = [{ ...SYNTHETIC_SCENE.obstacles[0], id: 'middle', bounds: { minX: 4, minY: 0, maxX: 5, maxY: 5 } }];
  const result = solveScene(scene,profile), path = result.traversals[0];
  expect(path.kind).toBe('complete');
  expect(path.points[0]).toEqual({ x: scene.start.x, y: scene.start.y, elevation: 0 });
  expect(path.points.at(-1)).toEqual({ x: scene.destinations[0].x, y: scene.destinations[0].y, elevation: 0 });
  inspectSweeps(path,scene,profile);
  expect(solveScene(scene,profile).traversals).toEqual(result.traversals);
  expect(path.length).toBeGreaterThan(Math.hypot(scene.start.x-scene.destinations[0].x, scene.start.y-scene.destinations[0].y));
});

test('blocked and unknown destinations stop at certified approaches without crossing thin barriers or unknown support', () => {
  for (const mode of ['blocked','unknown'] as const) {
    const scene = room(), profile = structuredClone(DEFAULT_PROFILE);
    const bounds = { minX: 4.991, minY: 0, maxX: 4.992, maxY: 8 };
    if (mode === 'blocked') scene.obstacles = [{ ...SYNTHETIC_SCENE.obstacles[0], id: 'thin', bounds }];
    else scene.unknown = [{ id: 'unobserved', label: 'Unobserved', bounds, elevation: 0, reason: 'Missing floor' }];
    const path = solveScene(scene,profile).traversals[0];
    expect(path.status).toBe(mode); expect(path.kind).toBe('approach');
    expect(path.reason).toContain(`destination remains ${mode}`);
    expect(path.points.at(-1)!.x+profile.width/2).toBeLessThan(bounds.minX);
    inspectSweeps(path,scene,profile);
  }
});

test('diagonal corner contact cannot create a route and blocked exact start has no traversal', () => {
  const scene = room();
  scene.destinations[0].y = 6;
  scene.obstacles = [
    { ...SYNTHETIC_SCENE.obstacles[0], id: 'a', bounds: { minX: 4, minY: 0, maxX: 5, maxY: 4 } },
    { ...SYNTHETIC_SCENE.obstacles[0], id: 'b', bounds: { minX: 5, minY: 4, maxX: 6, maxY: 8 } },
  ];
  const path = solveScene(scene,DEFAULT_PROFILE).traversals[0];
  expect(path.status).toBe('blocked'); expect(path.kind).toBe('approach');
  inspectSweeps(path,scene,DEFAULT_PROFILE);
  scene.start.x = 4.5; scene.start.y = 2;
  const unavailable = solveScene(scene,DEFAULT_PROFILE).traversals[0];
  expect(unavailable.kind).toBe('unavailable'); expect(unavailable.points).toEqual([]);
  expect(sampleTraversal(unavailable,0)).toBeNull();
});

test('unsupported checks suppress even a locally clear approach and disconnected elevations never produce a climb', () => {
  for (const requirement of ['turning','longitudinalSlope','crossSlope','multilevel'] as const) {
    const profile = structuredClone(DEFAULT_PROFILE); profile.requirements[requirement] = true;
    const path = solveScene(room(),profile).traversals[0];
    expect(path.kind).toBe('unavailable'); expect(path.points).toEqual([]);
    expect(sampleTraversal(path,0)).toBeNull();
  }
  const step = { ...DEFAULT_PROFILE, maxStep: .1 };
  expect(solveScene(room(),step).traversals[0].kind).toBe('unavailable');
  const scene = room(); scene.supports.push({ ...scene.supports[0], id: 'upper', elevation: 3 });
  scene.destinations[0].supportId = 'upper';
  expect(solveScene(scene,DEFAULT_PROFILE).traversals[0].kind).toBe('unavailable');
});

test('exact destination at unknown scope edge is an approach, never an invented final connector', () => {
  const scene = room(); scene.destinations[0].x = .05;
  const path = solveScene(scene,DEFAULT_PROFILE).traversals[0];
  expect(path.status).toBe('unknown'); expect(path.kind).toBe('approach');
  expect(path.points.at(-1)!.x).toBeGreaterThan(DEFAULT_PROFILE.width/2);
  inspectSweeps(path,scene,DEFAULT_PROFILE);
});

test('sampling clamps distance, preserves corners, and rejects malformed diagonals and non-finite inputs', () => {
  const original = solveScene(room(),DEFAULT_PROFILE).traversals[0];
  const path: Traversal = { ...original, points: [{x:0,y:0,elevation:0},{x:2,y:0,elevation:0},{x:2,y:3,elevation:0}], length:5 };
  expect(sampleTraversal(path,-100)).toMatchObject({x:0,y:0,distance:0});
  expect(sampleTraversal(path,1)).toMatchObject({x:1,y:0});
  expect(sampleTraversal(path,2)).toMatchObject({x:2,y:0,heading:Math.PI/2});
  expect(sampleTraversal(path,3)).toMatchObject({x:2,y:1});
  expect(sampleTraversal(path,999)).toMatchObject({x:2,y:3,distance:5});
  expect(sampleTraversal(path,NaN)).toBeNull(); expect(sampleTraversal(path,Infinity)).toBeNull();
  expect(sampleTraversal({...path,length:6},2)).toBeNull();
  expect(sampleTraversal({...path,points:[path.points[0],path.points[2]]},2)).toBeNull();
});

test('scenario paths bind exact revisions, survive save and undo deterministically, and preserve unknowns', () => {
  const scene = structuredClone(SYNTHETIC_SCENE), profile = structuredClone(DEFAULT_PROFILE);
  const baseline = solveScene(scene,profile).traversals[0];
  const scenario = appendOperation(scene,profile,createScenario(scene,profile),{kind:'remove',objectId:'bench'});
  const path = solveScene(scene,profile,scenario).traversals[0];
  expect(baseline.kind).toBe('approach'); expect(path.kind).toBe('complete');
  inspectSweeps(path,applyScenario(scene,profile,scenario),profile);
  expect(traversalIsCurrent(path,scene,profile,scenario)).toBe(true);
  expect(traversalIsCurrent(path,scene,profile)).toBe(false);
  expect(traversalIsCurrent(path,scene,{...profile,width:.7},scenario)).toBe(false);
  expect(traversalIsCurrent(path,{...scene,revision:2},profile,scenario)).toBe(false);
  expect(traversalIsCurrent({...path,solverHash:'old'},scene,profile,scenario)).toBe(false);
  expect(traversalIsCurrent(baseline,scene,profile,{...createScenario(scene,profile),solverHash:'old'})).toBe(false);
  expect(solveScene(scene,profile,undoScenario(scenario)).traversals[0]).toEqual(baseline);
  const restored = parseProject(serializeProject(scene,profile,scenario));
  expect(solveScene(restored.scene,restored.profile,restored.scenario).traversals[0]).toEqual(path);
  const oldHash = contentHash({ version:'rect-envelope-v1.0.1', envelope:'fixed-axis-square', transitions:'coplanar-cardinal-continuous-sweep', cellMargin:'half-cell', uncertainty:'conservative-bounds', maximumCells:60000, maximumCellFeatureProduct:3000000, numericalToleranceMetres:1e-9 });
  expect(oldHash).toBe(SOLVER_HASH); // Traversal is derived presentation; unchanged access semantics preserve saved projects.
  const previousProject = parseProject(JSON.stringify({schemaVersion:'spatial-v1',scene,profile,scenario:{...scenario,solverHash:oldHash}}));
  expect(solveScene(previousProject.scene,previousProject.profile,previousProject.scenario).traversals[0]).toEqual(path);
  expect(traversalIsCurrent({...path,traversalVersion:'old'} as unknown as Traversal,scene,profile,scenario)).toBe(false);
});


test('approaches stop before missing support, uncertainty margins and low headroom', () => {
  for (const control of ['hole','uncertain-wall','low-overhang'] as const) {
    const scene = room(), profile = structuredClone(DEFAULT_PROFILE);
    if (control === 'hole') {
      scene.supports[0].bounds = {...scene.bounds,maxX:4.9};
      scene.supports.push({...scene.supports[0],id:'far',bounds:{...scene.bounds,minX:5.1}});
      scene.destinations[0].supportId = 'far';
    } else scene.obstacles = [{...SYNTHETIC_SCENE.obstacles[0],id:control,bounds:{minX:5,minY:0,maxX:5.1,maxY:8},
      uncertainty: control === 'uncertain-wall' ? .2 : 0, bottom: control === 'low-overhang' ? 1.7 : 0}];
    const path = solveScene(scene,profile).traversals[0];
    expect(path.kind).toBe('approach');
    const safeBoundary = control === 'hole' ? 4.9 : control === 'uncertain-wall' ? 4.8 : 5;
    for (const p of path.points) expect(p.x+profile.width/2).toBeLessThanOrEqual(safeBoundary);
    inspectSweeps(path,scene,profile);
  }
});
