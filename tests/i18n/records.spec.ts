import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';
import { esDe, esPlace } from '../../src/i18n/names';
import { fromRecord } from '../../src/i18n/records';

test('Spanish has every English key and no other', () => {
  expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
});

/** A new place's labels need Spanish in src/i18n/records.ts before it ships. */
test('every label in the published places reads in Spanish', () => {
  const labels = new Set<string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) key === 'label' && typeof inner === 'string' ? labels.add(inner) : collect(inner);
  };
  for (const folder of readdirSync('public/places')) {
    const file = `public/places/${folder}/place.json`;
    if (existsSync(file)) collect(JSON.parse(readFileSync(file, 'utf8')));
  }
  expect(labels.size).toBeGreaterThan(0);
  expect([...labels].filter(label => fromRecord(label, 'es') === label)).toEqual([]);
});

test('a place name takes its Spanish article, and de el contracts', () => {
  expect(esPlace('Plaza de Armas')).toBe('la Plaza de Armas');
  expect(esPlace('Boletería del Qorikancha')).toBe('la boletería del Qorikancha');
  expect(esPlace('Estación superior del teleférico de Narikala')).toBe('la estación superior del teleférico de Narikala');
  expect(esPlace('Jirón Ucayali')).toBe('el jirón Ucayali');
  expect(esPlace('Qorikancha')).toBe('Qorikancha');
  expect(esDe(esPlace('Portal de Carrizos'))).toBe('del Portal de Carrizos');
  expect(esDe(esPlace('Calle Loreto'))).toBe('de la calle Loreto');
});
