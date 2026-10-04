// Imports keep their .ts extension so the package generator can load this file in Node directly.
import { NARIKALA_PLACE } from './narikala.ts';
import { QORIKANCHA_PLACE, type RoutePlace } from './route.ts';

/**
 * Every recorded tour route with spots, keyed by its record id in .local/routes.
 * The package generator reads it, and a test checks each place's published package against its spots.
 */
export const ROUTE_PLACES: Readonly<Record<string, RoutePlace>> = {
  [QORIKANCHA_PLACE.id]: QORIKANCHA_PLACE,
  [NARIKALA_PLACE.id]: NARIKALA_PLACE,
};
