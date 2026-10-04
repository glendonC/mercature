import { ROUTE_PLACES } from '../site/registry';
import type { Destination } from './data';
import RouteInbox from './RouteInbox';

/** Places whose walk has named spots, so visitors' messages can be read against them. */
export const hasRouteCanvas = (data: Destination) => !!ROUTE_PLACES[data.id] && data.stretches.length > 0;

/** The route screen: visitors' messages placed on the walk, on a map she can edit. */
export default RouteInbox;
