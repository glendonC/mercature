// Guide lines for search and the one-tap build, in English and Spanish. One line each at 390 px.
// place: the searched name as OpenStreetMap gives it ("Narikala", "Machu Picchu"); Spanish uses its article when it has one.
// count: things OpenStreetMap lists along the tour route so far (steps, kerbs, crossings, benches), updated while it reads.

import { esPlace } from '../i18n/names';
// esPlace gives a place name its Spanish article; cap capitalises the first letter.

const n_en = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
const n_es = (n: number) => ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][n] ?? String(n);
const cap = (t: string) => t.charAt(0).toLocaleUpperCase() + t.slice(1);
const about = (m: number) => m < 100 ? Math.max(10, Math.round(m / 10) * 10) : m < 1000 ? Math.round(m / 50) * 50 : Math.round(m / 100) * 100;

export const SEARCH_EN = {
  searching: 'Looking for it on OpenStreetMap…',
  several: 'A few places have that name. Which one is yours?',
  tooBig: (s: { place: string }) => `${s.place} is a big area. Try a landmark or a street in it.`,
  none: 'OpenStreetMap doesn’t know that name. Try another spelling.',
  offline: 'Search needs internet. Your prepared walks still open.',
  routing: (s: { place: string }) => `Finding the way on foot to ${s.place}…`,
  reading: (s: { count: number }) => s.count === 0 ? 'Checking OpenStreetMap along the way…' : `Checking OpenStreetMap along the way… ${s.count === 1 ? 'one thing' : `${n_en(s.count)} things`} so far.`,
  ready: (s: { metres: number; count: number }) => s.count === 0 ? `Ready. About ${about(s.metres)} m, and OpenStreetMap lists nothing on it yet.` : `Ready. About ${about(s.metres)} m, with ${s.count === 1 ? 'one thing' : `${n_en(s.count)} things`} worth checking.`,
  noWalk: 'I couldn’t find a way on foot there. Try a landmark nearby.',
  busy: 'The map service is busy. Try again in a minute.',
  failed: 'Something went wrong building the walk. Try again.',
  retry: 'Try again',
  prepared: 'Open a prepared walk',
};

export const SEARCH_ES = {
  searching: 'Buscándolo en OpenStreetMap…',
  several: 'Hay varios lugares con ese nombre. ¿Cuál es el tuyo?',
  tooBig: (s: { place: string }) => `${cap(esPlace(s.place))} es una zona grande. Prueba con un lugar o una calle concreta.`,
  none: 'OpenStreetMap no conoce ese nombre. Intenta escribirlo de otra forma.',
  offline: 'Para buscar necesitas internet. Los recorridos preparados se abren igual.',
  routing: (s: { place: string }) => `Buscando el camino a pie hasta ${esPlace(s.place)}…`,
  reading: (s: { count: number }) => s.count === 0 ? 'Revisando OpenStreetMap a lo largo del camino…' : `Revisando OpenStreetMap a lo largo del camino… ${s.count === 1 ? 'una cosa' : `${n_es(s.count)} cosas`} hasta ahora.`,
  ready: (s: { metres: number; count: number }) => s.count === 0 ? `Listo. Unos ${about(s.metres)} m, y OpenStreetMap todavía no registra nada.` : `Listo. Unos ${about(s.metres)} m, con ${s.count === 1 ? 'una cosa' : `${n_es(s.count)} cosas`} por revisar.`,
  noWalk: 'No encontré un camino a pie ahí. Prueba con un lugar cercano.',
  busy: 'El servicio de mapas está ocupado. Inténtalo de nuevo en un minuto.',
  failed: 'Algo falló al armar el recorrido. Inténtalo de nuevo.',
  retry: 'Reintentar',
  prepared: 'Abrir un recorrido preparado',
};

export const SEARCH_LINES = { en: SEARCH_EN, es: SEARCH_ES } as const;
