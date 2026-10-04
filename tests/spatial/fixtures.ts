import type { Profile, Scene } from '../../src/spatial/contracts';

/**
 * A small authored room for the path check and plan tests: two dividing walls leave a 2.00 m opening,
 * a movable bench narrows it, and one corner has unknown floor. Test-only; the app uses Noor's farm.
 */
export const BENCH_CLEAR_POSITION = { x: 2, y: 1 };
export const TEST_PROFILE: Profile = {
  id: 'explicit-square', label: 'Illustrative square envelope', width: .9, height: 1.8, maxStep: 0, cellSize: .1,
  requirements: { longitudinalSlope: false, crossSlope: false, turning: false, multilevel: false },
  source: 'Authored demonstration values; not a mobility prescription or regulatory standard.',
};
export const TEST_SCENE: Scene = {
  schemaVersion: 'spatial-v1', id: 'test-room', title: 'Test room', revision: 1,
  provenance: 'synthetic', units: 'm', bounds: { minX: 0, minY: 0, maxX: 12, maxY: 8 },
  supports: [{ id: 'floor', label: 'Authored floor', bounds: { minX: 0, minY: 0, maxX: 12, maxY: 8 }, elevation: 0, uncertainty: 0, evidence: ['Synthetic dimensional control: 12 × 8 m horizontal support; authored coordinates, no capture.'] }],
  obstacles: [
    { id: 'wall-south', label: 'South dividing wall', bounds: { minX: 5.5, minY: 0, maxX: 6, maxY: 3 }, bottom: 0, top: 3, uncertainty: 0, reviewed: true, movable: false, evidence: ['Authored wall box; 0.5 m thick, 3 m high.'] },
    { id: 'wall-north', label: 'North dividing wall', bounds: { minX: 5.5, minY: 5, maxX: 6, maxY: 8 }, bottom: 0, top: 3, uncertainty: 0, reviewed: true, movable: false, evidence: ['Authored wall box; north/south walls leave a 2.00 m opening.'] },
    { id: 'bench', label: 'Reviewed movable bench', bounds: { minX: 5.4, minY: 3, maxX: 6.1, maxY: 4.2 }, bottom: 0, top: .8, uncertainty: 0, reviewed: true, movable: true, evidence: ['Synthetic reviewed obstacle box: 0.70 × 1.20 × 0.80 m.', 'Original authored layout gap to north wall: 5.00 − 4.20 = 0.80 m. Proposed placements do not alter this source record.', 'Support beneath the bench is independently authored; removing it reveals no new measurement.'] },
  ],
  unknown: [{ id: 'occluded-corner', label: 'Unresolved corner', bounds: { minX: 9, minY: 5, maxX: 11, maxY: 7 }, elevation: 0, reason: 'Synthetic missing-support control; floor coverage is explicitly unknown here.' }],
  start: { x: 2, y: 4, supportId: 'floor' },
  destinations: [{ id: 'garden', label: 'Garden entrance', x: 9, y: 4, supportId: 'floor' }],
  assumptions: ['All geometry is synthetic and dimensioned in metres; no real site has been measured.', 'Geometry uses horizontal rectangular support and axis-aligned obstacle boxes.', 'The illustrated square envelope is not a wheelchair model.'],
};
