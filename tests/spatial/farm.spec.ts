import { test, expect } from '@playwright/test';
import { NOOR_FARM } from '../../src/site/farm';
import { FARM_FEATURES } from '../../src/site/inventory';
import type { Placement } from '../../src/site/contracts';
import { solveScene } from '../../src/spatial/solver';
import { appendOperation, applyScenario, createScenario } from '../../src/spatial/scenario';
import { overlaps } from '../../src/spatial/validation';
import type { Operation, Rect } from '../../src/spatial/contracts';

const { scene, profile } = NOOR_FARM;
const move = (placement: Placement): Operation => ({ kind: 'move', objectId: placement.featureId, to: placement.to });
const place = (name: string) => move(NOOR_FARM.placements.find(placement => placement.name.en === name)!);
const bounds = (id: string) => scene.obstacles.find(obstacle => obstacle.id === id)!.bounds;
function solve(...operations: Operation[]) {
  const scenario = operations.reduce((current, operation) => appendOperation(scene, profile, current, operation), createScenario(scene, profile));
  const result = solveScene(scene, profile, scenario);
  return { scenario, result, status: Object.fromEntries(result.destinations.map(destination => [destination.id, destination.status])) };
}

test('the coffee sacks block only the tasting table, and the flower pots are not the cause', () => {
  const baseline = solve();
  expect(baseline.status).toEqual({ 'entrance-gate': 'reachable', viewpoint: 'reachable', 'tasting-table': 'blocked', restroom: 'reachable' });
  // The closest certified approach stops at the passage entrance, in front of the sacks.
  const end = baseline.result.traversals.find(path => path.destinationId === 'tasting-table')!.points.at(-1)!;
  expect(end.x).toBeGreaterThan(bounds('tasting-hut').minX - 1);
  expect(end.x).toBeLessThan(bounds('coffee-sacks').minX);
  expect(end.y).toBeGreaterThan(bounds('roasting-shed').maxY);
  expect(end.y).toBeLessThan(bounds('tasting-hut').minY);
  expect(solve({ kind: 'remove', objectId: 'flower-pots' }).status['tasting-table']).toBe('blocked');
  expect(solve(place('Beside the welcome sign')).status['tasting-table']).toBe('blocked');
});

test('moving the sacks to the storage corner reaches the tasting table without blocking anything else', () => {
  expect(solve(place('Storage corner')).status).toEqual({ 'entrance-gate': 'reachable', viewpoint: 'reachable', 'tasting-table': 'reachable', restroom: 'reachable' });
});

test('moving the sacks beside the water tank clears the passage but blocks the restroom', () => {
  expect(solve(place('Beside the water tank')).status).toEqual({ 'entrance-gate': 'reachable', viewpoint: 'reachable', 'tasting-table': 'reachable', restroom: 'blocked' });
});

test('the model names each inventory feature once, stays phone sized and never routes through unknown ground', () => {
  const features = [...scene.supports, ...scene.obstacles, ...scene.unknown, ...scene.destinations];
  expect(features.map(feature => [feature.id, feature.label]).sort()).toEqual(FARM_FEATURES.map(feature => [feature.id, feature.name.en]).sort());
  const r = profile.width / 2;
  const envelope = (a: { x: number; y: number }, b = a): Rect => ({ minX: Math.min(a.x, b.x) - r, minY: Math.min(a.y, b.y) - r, maxX: Math.max(a.x, b.x) + r, maxY: Math.max(a.y, b.y) + r });
  for (const operations of [[], ...NOOR_FARM.placements.map(placement => [move(placement)])]) {
    const { scenario, result } = solve(...operations);
    expect(result.cells.length).toBeLessThanOrEqual(15000);
    expect(applyScenario(scene, profile, scenario).unknown).toEqual(scene.unknown);
    for (const region of scene.unknown) {
      expect(result.cells.some(cell => cell.status === 'reachable' && overlaps(envelope(cell), region.bounds))).toBe(false);
      for (const path of result.traversals) path.points.slice(1).forEach((point, i) => expect(overlaps(envelope(path.points[i], point), region.bounds)).toBe(false));
    }
  }
});
