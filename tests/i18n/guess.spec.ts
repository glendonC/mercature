import { expect, test } from '@playwright/test';
import { guessLanguage } from '../../src/destinations/copy';
import { EXAMPLES } from '../../src/destinations/examples';

/** The tour route's Spanish place names never make a message Spanish; other languages never pass as Spanish. */
const CASES: [string, string][] = [
  ['The stone steps on Calle Loreto were too steep for my father, there was no handrail.', 'en'],
  ['Merci, la visite était très belle.', 'other'],
  ['Los escalones de la Calle Loreto son muy altos y no hay pasamanos.', 'es'],
  ['The steps at the Plaza de Armas were fine, thanks.', 'en'],
  ['Muy difícil.', 'es'],
  ['Gracias', 'es'],
  ['¿Hay rampa?', 'es'],
  ['Great tour!', 'en'],
];

test('guesses the language of a pasted message without mistaking place names for Spanish', () => {
  for (const [text, language] of CASES) expect(guessLanguage(text), text).toBe(language);
});

test('guesses each example message as the language it is labelled with', () => {
  for (const example of EXAMPLES['cusco-qorikancha']) expect(guessLanguage(example.text), example.text).toBe(example.language);
});
