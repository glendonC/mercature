import type { Obstacle, Profile, Rect, Scene, UnknownRegion } from '../spatial/contracts';
import type { Site } from './contracts';
import { FARM_FEATURES, type FarmFeatureId } from './inventory';

const label = (id: FarmFeatureId) => FARM_FEATURES.find(feature => feature.id === id)!.name.en;
const box = (minX: number, minY: number, maxX: number, maxY: number): Rect => ({ minX, minY, maxX, maxY });
const metres = (value: number) => `${value.toFixed(2)} m`;

function obstacle(id: FarmFeatureId, bounds: Rect, top: number, movable: boolean, ...notes: string[]): Obstacle {
  const footprint = `${metres(bounds.maxX - bounds.minX)} × ${metres(bounds.maxY - bounds.minY)}`;
  return {
    id, label: label(id), bounds, bottom: 0, top, uncertainty: 0, reviewed: true, movable,
    evidence: [`Authored box: ${footprint} footprint, ${metres(top)} high. Every dimension is authored; nothing was measured.`, ...notes],
  };
}
function unknown(id: FarmFeatureId, bounds: Rect, reason: string): UnknownRegion {
  return { id, label: label(id), bounds, elevation: 0, reason };
}

/**
 * Metres, x east and y north. West to east: the gate and open terrace, then the tasting hut (north)
 * and roasting shed (south) spanning the terrace with one passage between them, then the tasting patio.
 */
const scene: Scene = {
  schemaVersion: 'spatial-v1', id: 'noor-farm', title: "Noor's farm tasting terrace", revision: 1,
  provenance: 'synthetic', units: 'm', bounds: box(0, 0, 15, 10),
  supports: [{
    id: 'terrace', label: label('terrace'), bounds: box(0, 0, 15, 10), elevation: 0, uncertainty: 0,
    evidence: ['Authored flat terrace, 15.00 m × 10.00 m at one level. Every dimension is authored; nothing was measured.'],
  }],
  obstacles: [
    obstacle('welcome-sign', box(0.3, 5.9, 0.45, 6.7), 1.6, true),
    obstacle('bench', box(2.8, 2.6, 4.4, 3.05), 0.45, true),
    obstacle('shade-tree', box(5.6, 4.6, 6.4, 5.4), 2.4, false, 'Trunk only. The canopy is assumed to be above the 1.8 m headroom and is not modelled.'),
    obstacle('drying-beds', box(1.4, 8.4, 5.8, 9.6), 0.9, false),
    obstacle('wheelbarrow', box(6.2, 8.3, 6.9, 9.7), 0.7, true),
    obstacle('tasting-hut', box(10.4, 6.4, 13, 10), 2.6, false),
    obstacle('roasting-shed', box(10.4, 0, 13, 4.8), 2.4, false, 'In the authored layout the passage between the shed and the tasting hut is 1.60 m wide.'),
    obstacle('coffee-sacks', box(10.5, 4.8, 11.5, 5.7), 1.1, true, 'In the authored layout the sacks leave 0.70 m to the tasting hut.'),
    obstacle('flower-pots', box(10.5, 6, 11.7, 6.4), 0.6, true, 'In the authored layout the pots leave 1.20 m to the roasting shed.'),
    obstacle('water-tank', box(7.4, 0, 8.8, 3), 1.6, false, 'In the authored layout the gap between the tank and the roasting shed is 1.60 m wide.'),
  ],
  unknown: [
    unknown('muddy-patch', box(2, 7.2, 5.2, 8.4), 'Authored as unknown: the ground turns to mud after rain and its firmness is not modelled.'),
    unknown('steps-to-rows', box(5.6, 0, 7, 1), 'Authored as unknown: stone steps lead down to the coffee rows and their rises are not modelled.'),
  ],
  start: { x: 1.5, y: 5, supportId: 'terrace' },
  destinations: [
    { id: 'entrance-gate', label: label('entrance-gate'), x: 0.7, y: 5, supportId: 'terrace' },
    { id: 'viewpoint', label: label('viewpoint'), x: 2.6, y: 0.8, supportId: 'terrace' },
    { id: 'tasting-table', label: label('tasting-table'), x: 14, y: 5.6, supportId: 'terrace' },
    { id: 'restroom', label: label('restroom'), x: 9.6, y: 1, supportId: 'terrace' },
  ],
  assumptions: [
    "Noor and her farm are fictional. Every dimension of this terrace is authored for the demonstration; nothing was measured.",
    'The terrace is one flat level. Obstacles are axis-aligned boxes; slopes, steps and surface firmness are not modelled.',
    'The 0.9 m square envelope is illustrative and is not a wheelchair standard.',
  ],
};

const profile: Profile = {
  id: 'noor-farm-square', label: 'Illustrative 0.9 m square envelope for the farm', width: 0.9, height: 1.8, maxStep: 0, cellSize: 0.1,
  requirements: { longitudinalSlope: false, crossSlope: false, turning: false, multilevel: false },
  source: "Authored demonstration values for Noor's farm; illustrative only, not a wheelchair standard or mobility prescription.",
};

/** Noor's coffee farm tasting terrace. Authored and synthetic; placements move an object's minimum corner. */
export const NOOR_FARM: Site = {
  id: 'noor-farm',
  name: { en: "Noor's farm", es: 'Finca de Noor' },
  place: 'La Convención, Cusco, Peru',
  provenance: 'synthetic',
  scene,
  profile,
  features: FARM_FEATURES,
  placements: [
    { featureId: 'coffee-sacks', to: { x: 9.2, y: 9.1 }, name: { en: 'Storage corner', es: 'Rincón de almacenaje' } },
    { featureId: 'coffee-sacks', to: { x: 8.8, y: 1.6 }, name: { en: 'Beside the water tank', es: 'Junto al tanque de agua' } },
    { featureId: 'flower-pots', to: { x: 0.3, y: 7 }, name: { en: 'Beside the welcome sign', es: 'Junto al letrero de bienvenida' } },
    { featureId: 'bench', to: { x: 3.6, y: 0.5 }, name: { en: 'Facing the valley', es: 'Frente al valle' } },
    { featureId: 'wheelbarrow', to: { x: 6.6, y: 4.3 }, name: { en: 'Beside the shade tree', es: 'Junto al árbol de sombra' } },
  ],
};
