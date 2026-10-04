import { verdictOf, type Review } from '../decisions/store';
import type { Marker, MarkerState } from './RouteMap';
import type { Spot, Walk } from './walk';

/** How a spot shows on any map: no photos, the decision kept on this device, or still open. */
export function spotState(spot: Spot, review: Review | null): MarkerState {
  return spot.kind === 'no-photos' ? 'no-photos' : (review && verdictOf(review, spot.stretches)) || 'open';
}

/** The walk's spots as map markers, for a map shown outside the route canvas. */
export function spotMarkers(walk: Walk, review: Review | null, label: (spot: Spot) => string = spot => spot.id): Marker[] {
  return walk.spots.map(spot => ({ id: spot.id, at: spot.at, state: spotState(spot, review), selected: false, label: label(spot) }));
}
