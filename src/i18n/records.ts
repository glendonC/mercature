import { translate, type Lang, type PlainKey } from '.';

/** Spanish for English text that the published place records carry. Any other text shows as recorded. */
const RECORDS: Readonly<Record<string, PlainKey>> = {
  'Kerb beside the route': 'record.kerbBeside',
  'Kerb to cross, no ramp found': 'record.kerbToCross',
  'Steps': 'record.steps',
  'Pavement': 'record.pavement',
  'Cobblestones': 'record.cobblestones',
  'Kerb': 'record.kerb',
  'Road': 'record.road',
  'Pedestrian crossing': 'record.crossing',
  'Broken pavement': 'record.brokenPavement',
  'Bollard or post': 'record.bollard',
  'Pothole': 'record.pothole',
  'Handrail': 'record.handrail',
  'Ramp': 'record.ramp',
  'Gate': 'record.gate',
  'Mapped as not wheelchair accessible': 'record.mappedNotWheelchair',
  'From the map, no photos': 'record.fromMap',
  'OpenStreetMap suggests; nobody has checked it': 'record.wayAround',
  'Surface': 'record.surface',
  'Smoothness': 'record.smoothness',
  'Crossing': 'record.crossing',
  'Tactile paving': 'record.tactilePaving',
  'Bollard': 'record.bollardOnly',
  'Bench': 'record.bench',
  'Toilets': 'record.toilets',
  'Lighting': 'record.lighting',
  'Wheelchair tag': 'record.wheelchair',
  'Qorikancha ticket booth': 'record.ticketBooth',
  'Cusco, Peru': 'record.cusco',
  'Tbilisi, Georgia': 'record.tbilisi',
  'Kathmandu, Nepal': 'record.kathmandu',
  'Tbilisi': 'record.tbilisiCity',
  'Kathmandu': 'record.kathmanduCity',
};

/** A steps label, with or without its count: "Steps, no handrail", "23 steps with a handrail, no ramp". */
const STEPS = /^(?:Steps|(\d+) steps?)( with a handrail|, no handrail)?(, no ramp)?$/;

function stepsFromRecord(text: string, lang: Lang): string | null {
  const match = STEPS.exec(text);
  if (!match) return null;
  const [, count, rail, ramp] = match;
  const steps = !count ? translate(lang, 'record.steps') : count === '1' ? translate(lang, 'record.oneStep') : translate(lang, 'record.stepCount', { n: count });
  const key = rail === ' with a handrail' ? ramp ? 'record.withHandrailNoRamp' : 'record.withHandrail'
    : rail ? ramp ? 'record.noHandrailNoRamp' : 'record.noHandrail'
    : ramp ? 'record.noRamp' : null;
  return key ? translate(lang, key, { steps }) : steps;
}

/** What OpenStreetMap says along a tour route, as its findings write it: "OpenStreetMap says: no handrail". */
const OSM_SAYS = 'OpenStreetMap says: ';
const OSM: Readonly<Record<string, PlainKey>> = {
  'steps': 'osm.steps',
  'handrail': 'osm.handrail',
  'no handrail': 'osm.noHandrail',
  'ramp': 'osm.ramp',
  'no ramp': 'osm.noRamp',
  'stone setts': 'osm.setts',
  'cobblestones': 'osm.cobblestones',
  'rough cobblestones': 'osm.roughCobblestones',
  'pebbles': 'osm.pebbles',
  'gravel': 'osm.gravel',
  'fine gravel': 'osm.fineGravel',
  'bare ground': 'osm.ground',
  'dirt': 'osm.dirt',
  'grass': 'osm.grass',
  'sand': 'osm.sand',
  'mud': 'osm.mud',
  'rock': 'osm.rock',
  'wood chips': 'osm.woodChips',
  'smooth surface': 'osm.smooth',
  'rough surface': 'osm.rough',
  'very rough surface': 'osm.veryRough',
  'raised kerb': 'osm.raisedKerb',
  'lowered kerb': 'osm.loweredKerb',
  'flush kerb': 'osm.flushKerb',
  'rolled kerb': 'osm.rolledKerb',
  'no kerb': 'osm.noKerb',
  'tactile paving': 'osm.tactilePaving',
  'no tactile paving': 'osm.noTactilePaving',
  'pedestrian crossing with signals': 'osm.signalCrossing',
  'pedestrian crossing': 'osm.crossing',
  'gate': 'osm.gate',
  'bollard': 'osm.bollard',
  'bench with a backrest': 'osm.backrestBench',
  'bench': 'osm.bench',
  'toilets': 'osm.toilets',
  'lit at night': 'osm.lit',
  'not lit at night': 'osm.notLit',
  'not wheelchair accessible': 'osm.notWheelchair',
  'limited wheelchair access': 'osm.limitedWheelchair',
  'wheelchair accessible': 'osm.wheelchair',
};

function osmFromRecord(text: string, lang: Lang): string | null {
  if (!text.startsWith(OSM_SAYS)) return null;
  const said = text.slice(OSM_SAYS.length), key = OSM[said];
  const label = key ? translate(lang, key) : stepsFromRecord(said, lang);
  return label ? translate(lang, 'osm.says', { label }) : null;
}

export function fromRecord(text: string, lang: Lang): string {
  if (lang === 'en') return text;
  const key = RECORDS[text];
  return key ? translate(lang, key) : stepsFromRecord(text, lang) ?? osmFromRecord(text, lang) ?? text;
}

/** A finding label said as a guess, written out per label so the grammar holds in each language. */
const POSSIBLE: Readonly<Record<string, PlainKey>> = {
  'Kerb beside the route': 'record.possible.kerbBeside',
  'Kerb to cross, no ramp found': 'record.possible.kerbToCross',
  'Steps': 'record.possible.steps',
  '5 steps, no handrail, no ramp': 'record.possible.osmSteps',
  'Handrail': 'record.possible.handrail',
  'Ramp': 'record.possible.ramp',
};

/** How a photo card names what the model outlined: always as a possibility, never as a fact. */
export function possibleFromRecord(text: string, lang: Lang): string {
  const key = POSSIBLE[text];
  return key ? translate(lang, key) : translate(lang, 'record.possible.other', { label: fromRecord(text, lang) });
}
