import type { ComponentProps } from 'react';
import { ROUTE_PLACES } from '../site/registry';
import type { Destination } from './data';
import RouteInbox from './RouteInbox';
import GuideScreen from '../guide/GuideScreen';

/** Places whose walk has named spots, so visitors' messages can be read against them. */
export const hasRouteCanvas = (data: Destination) => !!ROUTE_PLACES[data.id] && data.stretches.length > 0;

/** The screen built around the guide, while it is tried beside the inbox: open a place with ?ui=guide. */
const guideAsked = () => { try { return new URLSearchParams(location.search).get('ui') === 'guide'; } catch { return false; } };

/** The route screen: visitors' messages placed on the walk, on a map she can edit. */
export default function RouteCanvas(props: ComponentProps<typeof RouteInbox>) {
  return guideAsked() ? <GuideScreen {...props} /> : <RouteInbox {...props} />;
}
