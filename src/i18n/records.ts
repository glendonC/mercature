import { translate, type Lang, type PlainKey } from '.';

/** Spanish for English text that the published place records carry. Any other text shows as recorded. */
const RECORDS: Readonly<Record<string, PlainKey>> = {
  'Kerb beside the route': 'record.kerbBeside',
  'Kerb to cross, no ramp found': 'record.kerbToCross',
  'Steps': 'record.steps',
  '5 steps, no handrail, no ramp': 'record.osmSteps',
  'Qorikancha ticket booth': 'record.ticketBooth',
  'Cusco, Peru': 'record.cusco',
  'Tbilisi, Georgia': 'record.tbilisi',
  'Kathmandu, Nepal': 'record.kathmandu',
};

export function fromRecord(text: string, lang: Lang): string {
  const key = RECORDS[text];
  return key ? translate(lang, key) : text;
}

/** A finding label said as a guess, written out per label so the grammar holds in each language. */
const POSSIBLE: Readonly<Record<string, PlainKey>> = {
  'Kerb beside the route': 'record.possible.kerbBeside',
  'Kerb to cross, no ramp found': 'record.possible.kerbToCross',
  'Steps': 'record.possible.steps',
  '5 steps, no handrail, no ramp': 'record.possible.osmSteps',
};

/** How a photo card names what the model outlined: always as a possibility, never as a fact. */
export function possibleFromRecord(text: string, lang: Lang): string {
  const key = POSSIBLE[text];
  return key ? translate(lang, key) : translate(lang, 'record.possible.other', { label: fromRecord(text, lang) });
}
