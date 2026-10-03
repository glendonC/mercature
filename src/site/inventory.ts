import type { SiteFeature } from './contracts';

/**
 * Noor's coffee farm tasting terrace, an authored synthetic site.
 * These ids are fixed: the scene geometry, the language evaluation set and saved plans refer to them.
 */
export const FARM_FEATURE_IDS = [
  'terrace', 'entrance-gate', 'welcome-sign', 'bench', 'viewpoint', 'shade-tree',
  'drying-beds', 'wheelbarrow', 'muddy-patch', 'steps-to-rows', 'tasting-hut', 'roasting-shed',
  'coffee-sacks', 'flower-pots', 'tasting-table', 'water-tank', 'restroom',
] as const;
export type FarmFeatureId = (typeof FARM_FEATURE_IDS)[number];

export const FARM_FEATURES: readonly SiteFeature[] = [
  { id: 'terrace', name: { en: 'Terrace', es: 'Terraza' }, description: 'The flat packed-earth terrace where tours gather between the gate and the tasting hut.', aliases: {} },
  { id: 'entrance-gate', name: { en: 'Entrance gate', es: 'Portón de entrada' }, description: 'The wooden gate where visitors arrive from the road.', aliases: {} },
  { id: 'welcome-sign', name: { en: 'Welcome sign', es: 'Letrero de bienvenida' }, description: 'A hand-painted welcome sign, written only in Spanish, beside the entrance gate.', aliases: {} },
  { id: 'bench', name: { en: 'Bench', es: 'Banca' }, description: 'A long wooden bench beside the path to the viewpoint.', aliases: {} },
  { id: 'viewpoint', name: { en: 'Viewpoint', es: 'Mirador' }, description: 'The lookout at the edge of the terrace over the coffee valley.', aliases: {} },
  { id: 'shade-tree', name: { en: 'Shade tree', es: 'Árbol de sombra' }, description: 'A large shade tree in the middle of the terrace.', aliases: {} },
  { id: 'drying-beds', name: { en: 'Drying beds', es: 'Camas de secado' }, description: 'Raised wooden beds where the coffee beans dry in the sun.', aliases: {} },
  { id: 'wheelbarrow', name: { en: 'Wheelbarrow', es: 'Carretilla' }, description: 'A wheelbarrow parked beside the drying beds.', aliases: {} },
  { id: 'muddy-patch', name: { en: 'Muddy patch', es: 'Zona de barro' }, description: 'Ground beside the drying beds that turns to mud after rain; not measured.', aliases: {} },
  { id: 'steps-to-rows', name: { en: 'Steps to the coffee rows', es: 'Escalones al cafetal' }, description: 'Stone steps down from the terrace to the coffee rows; not measured.', aliases: {} },
  { id: 'tasting-hut', name: { en: 'Tasting hut', es: 'Cabaña de cata' }, description: 'The small building on the north side of the passage to the tasting table.', aliases: {} },
  { id: 'roasting-shed', name: { en: 'Roasting shed', es: 'Tostaduría' }, description: 'The shed where coffee is roasted, on the south side of the passage to the tasting table.', aliases: {} },
  { id: 'coffee-sacks', name: { en: 'Coffee sacks', es: 'Sacos de café' }, description: 'Stacked sacks of dried coffee at the entrance of the passage to the tasting table.', aliases: {} },
  { id: 'flower-pots', name: { en: 'Flower pots', es: 'Macetas' }, description: 'Large clay flower pots at the entrance of the passage to the tasting table.', aliases: {} },
  { id: 'tasting-table', name: { en: 'Tasting table', es: 'Mesa de cata' }, description: 'The table at the end of the passage where visitors taste the coffee.', aliases: {} },
  { id: 'water-tank', name: { en: 'Water tank', es: 'Tanque de agua' }, description: 'A concrete rainwater tank near the restroom.', aliases: {} },
  { id: 'restroom', name: { en: 'Restroom', es: 'Baño' }, description: 'The visitor restroom behind the water tank.', aliases: {} },
];
