import type { ComponentProps } from 'react';
import { ROUTE_PLACES } from '../site/registry';
import type { Destination } from './data';
import RouteInbox from './RouteInbox';
import GuideScreen from '../guide/GuideScreen';

/** Places whose tour route has named spots, so visitors' messages can be read against them. */
export const hasRouteCanvas = (data: Destination) => !!ROUTE_PLACES[data.id] && data.stretches.length > 0;

/** The route screen is the guide. Open a place with ?ui=inbox for the message inbox (RouteInbox). */
const inboxAsked = () => { try { return new URLSearchParams(location.search).get('ui') === 'inbox'; } catch { return false; } };

/** The route screen: a conversation with the guide about the route, on a map she can edit. */
export default function RouteCanvas(props: ComponentProps<typeof RouteInbox>) {
  return inboxAsked() ? <RouteInbox {...props} /> : <GuideScreen {...props} />;
}
