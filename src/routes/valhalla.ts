/**
 * The two OpenStreetMap services the lines ask, each once per request and never while she types:
 * Valhalla on the FOSSGIS server for the way on foot and the kind of each edge it takes, and Overpass for what
 * OpenStreetMap says along a line. Browser and Node alike; the answers come back raw so a prepared walk can keep them.
 */
import type { LineTrouble } from './shape.ts';

export const VALHALLA = 'https://valhalla1.openstreetmap.de';
export const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** Written without parameter properties, so Node can load this file by stripping its types. */
export class RouteTrouble extends Error {
  readonly kind: LineTrouble;
  readonly status: number;
  constructor(kind: LineTrouble, status = 0) { super(kind); this.kind = kind; this.status = status; }
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
/** Overpass answers 406 to a request that does not name its client. A browser names itself; Node, as when a walk is prepared, does not. */
const client: Record<string, string> = typeof window === 'undefined' ? { 'User-Agent': 'mercature-routes' } : {};

async function askJson(url: string, init: RequestInit, signal: AbortSignal | undefined, seconds: number): Promise<unknown> {
  if (offline()) throw new RouteTrouble('offline');
  const timeout = AbortSignal.timeout(seconds * 1000), both = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { ...client, ...init.headers as Record<string, string> }, signal: both, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new RouteTrouble(timeout.aborted ? 'busy' : offline() ? 'offline' : 'failed');
  }
  if (response.status === 429 || response.status === 503 || response.status === 504) throw new RouteTrouble('busy', response.status);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new RouteTrouble('failed', response.status);
  return body;
}

/** One Valhalla action (route or trace_attributes) with a JSON request. Valhalla answers 400 when it finds no way, which is 'no-walk'. */
export async function valhalla(action: 'route' | 'trace_attributes', request: unknown, signal?: AbortSignal): Promise<unknown> {
  try {
    return await askJson(`${VALHALLA}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }, signal, 30);
  } catch (error) {
    if (error instanceof RouteTrouble && error.status === 400) throw new RouteTrouble('no-walk', 400);
    throw error;
  }
}

/** One Overpass query. The public server allows a few at a time per address, so a busy answer says to wait. */
export async function overpass(query: string, signal?: AbortSignal): Promise<unknown> {
  const body = await askJson(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: query }) }, signal, 60);
  if (!body || typeof body !== 'object' || !Array.isArray((body as { elements?: unknown }).elements)) throw new RouteTrouble('busy');
  return body;
}

/** How the lines reach the services; a prepared walk swaps in recorded answers, a test a fake. */
export type Ask = { valhalla: typeof valhalla; overpass: typeof overpass };
export const LIVE: Ask = { valhalla, overpass };
