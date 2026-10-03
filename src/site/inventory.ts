import type { SiteFeature } from './contracts';

/**
 * Noor's coffee farm tasting terrace, an authored synthetic site.
 * These ids are fixed: the scene geometry, the language evaluation set and saved plans refer to them.
 * Aliases are everyday words for each feature; the Quechua ones are unreviewed suggestions.
 */
export const FARM_FEATURE_IDS = [
  'terrace', 'entrance-gate', 'welcome-sign', 'bench', 'viewpoint', 'shade-tree',
  'drying-beds', 'wheelbarrow', 'muddy-patch', 'steps-to-rows', 'tasting-hut', 'roasting-shed',
  'coffee-sacks', 'flower-pots', 'tasting-table', 'water-tank', 'restroom',
] as const;
export type FarmFeatureId = (typeof FARM_FEATURE_IDS)[number];

export const FARM_FEATURES: readonly SiteFeature[] = [
  { id: 'terrace', name: { en: 'Terrace', es: 'Terraza' }, description: 'The flat packed-earth terrace where tours gather between the gate and the tasting hut.', aliases: { en: ['terrace', 'patio', 'yard', 'open flat area', 'gathering area'], es: ['terraza', 'patio', 'explanada'], ko: ['테라스', '마당', '앞마당'], qu: ['pampa'] } },
  { id: 'entrance-gate', name: { en: 'Entrance gate', es: 'Portón de entrada' }, description: 'The wooden gate where visitors arrive from the road.', aliases: { en: ['gate', 'entrance', 'front gate', 'way in'], es: ['portón', 'entrada', 'puerta', 'tranquera'], ko: ['정문', '입구', '대문', '출입문'], qu: ['punku', 'yaykuna'] } },
  { id: 'welcome-sign', name: { en: 'Welcome sign', es: 'Letrero de bienvenida' }, description: 'A hand-painted welcome sign, written only in Spanish, beside the entrance gate.', aliases: { en: ['welcome sign', 'sign', 'signboard', 'painted board', 'notice'], es: ['letrero', 'cartel', 'aviso', 'rótulo'], ko: ['환영 표지판', '표지판', '안내판', '간판'], qu: ['qillqa', 'unanchay'] } },
  { id: 'bench', name: { en: 'Bench', es: 'Banca' }, description: 'A long wooden bench beside the path to the viewpoint.', aliases: { en: ['bench', 'seat', 'wooden bench', 'somewhere to sit'], es: ['banca', 'banco', 'asiento'], ko: ['벤치', '의자', '나무 의자', '앉을 곳'], qu: ['tiyana'] } },
  { id: 'viewpoint', name: { en: 'Viewpoint', es: 'Mirador' }, description: 'The lookout at the edge of the terrace over the coffee valley.', aliases: { en: ['viewpoint', 'lookout', 'view', 'overlook', 'scenic spot'], es: ['mirador', 'vista', 'balcón'], ko: ['전망대', '전망', '경치', '뷰포인트'], qu: ['qhawana'] } },
  { id: 'shade-tree', name: { en: 'Shade tree', es: 'Árbol de sombra' }, description: 'A large shade tree in the middle of the terrace.', aliases: { en: ['tree', 'big tree', 'shade', 'shade tree'], es: ['árbol', 'sombra', 'árbol grande'], ko: ['나무', '큰 나무', '그늘', '그늘나무'], qu: ["sach'a", 'mallki', 'llantu'] } },
  { id: 'drying-beds', name: { en: 'Drying beds', es: 'Camas de secado' }, description: 'Raised wooden beds where the coffee beans dry in the sun.', aliases: { en: ['drying beds', 'drying racks', 'raised beds', 'drying area'], es: ['camas de secado', 'secaderos', 'secadero', 'tendales'], ko: ['건조대', '커피 건조대', '말리는 곳'], qu: ["ch'akichina"] } },
  { id: 'wheelbarrow', name: { en: 'Wheelbarrow', es: 'Carretilla' }, description: 'A wheelbarrow parked beside the drying beds.', aliases: { en: ['wheelbarrow', 'barrow', 'cart', 'handcart'], es: ['carretilla', 'carreta'], ko: ['손수레', '외바퀴 수레', '수레'], qu: ['carretilla'] } },
  { id: 'muddy-patch', name: { en: 'Muddy patch', es: 'Zona de barro' }, description: 'Ground beside the drying beds that turns to mud after rain; not measured.', aliases: { en: ['mud', 'muddy ground', 'muddy patch', 'slippery ground', 'puddle'], es: ['barro', 'lodo', 'charco', 'barrial'], ko: ['진흙', '진창', '흙탕', '미끄러운 땅'], qu: ["t'uru"] } },
  { id: 'steps-to-rows', name: { en: 'Steps to the coffee rows', es: 'Escalones al cafetal' }, description: 'Stone steps down from the terrace to the coffee rows; not measured.', aliases: { en: ['steps', 'stairs', 'stone steps', 'staircase'], es: ['escalones', 'escaleras', 'gradas', 'escalera de piedra'], ko: ['계단', '돌계단', '커피밭 계단'], qu: ['siqana'] } },
  { id: 'tasting-hut', name: { en: 'Tasting hut', es: 'Cabaña de cata' }, description: 'The small building on the north side of the passage to the tasting table.', aliases: { en: ['hut', 'tasting hut', 'cabin', 'small building'], es: ['cabaña', 'choza', 'casita'], ko: ['오두막', '시음 오두막', '작은 집'], qu: ['wasicha'] } },
  { id: 'roasting-shed', name: { en: 'Roasting shed', es: 'Tostaduría' }, description: 'The shed where coffee is roasted, on the south side of the passage to the tasting table.', aliases: { en: ['roasting shed', 'roastery', 'shed', 'roaster'], es: ['tostaduría', 'tostadora', 'galpón', 'cobertizo'], ko: ['로스팅 창고', '로스팅실', '창고', '로스터리'] } },
  { id: 'coffee-sacks', name: { en: 'Coffee sacks', es: 'Sacos de café' }, description: 'Stacked sacks of dried coffee at the entrance of the passage to the tasting table.', aliases: { en: ['sacks', 'coffee sacks', 'bags of coffee', 'stacked bags'], es: ['sacos', 'costales', 'sacos de café'], ko: ['커피 자루', '자루', '포대', '커피 포대'], qu: ['kustal'] } },
  { id: 'flower-pots', name: { en: 'Flower pots', es: 'Macetas' }, description: 'Large clay flower pots at the entrance of the passage to the tasting table.', aliases: { en: ['flower pots', 'pots', 'planters', 'clay pots'], es: ['macetas', 'maceteros', 'masetas'], ko: ['화분', '꽃 화분', '토분'], qu: ["t'ika manka"] } },
  { id: 'tasting-table', name: { en: 'Tasting table', es: 'Mesa de cata' }, description: 'The table at the end of the passage where visitors taste the coffee.', aliases: { en: ['tasting table', 'table', 'coffee tasting', 'cupping table'], es: ['mesa de cata', 'mesa', 'cata'], ko: ['시음 테이블', '테이블', '시음대'], qu: ['misa'] } },
  { id: 'water-tank', name: { en: 'Water tank', es: 'Tanque de agua' }, description: 'A concrete rainwater tank near the restroom.', aliases: { en: ['water tank', 'tank', 'cistern', 'rainwater tank'], es: ['tanque de agua', 'tanque', 'cisterna', 'reservorio'], ko: ['물탱크', '물통', '저수조'], qu: ['unu', 'yaku'] } },
  { id: 'restroom', name: { en: 'Restroom', es: 'Baño' }, description: 'The visitor restroom behind the water tank.', aliases: { en: ['restroom', 'toilet', 'bathroom', 'loo', 'washroom'], es: ['baño', 'servicios higiénicos', 'sanitario', 'letrina'], ko: ['화장실', '변소'], qu: ['baño'] } },
];
