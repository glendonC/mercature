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
