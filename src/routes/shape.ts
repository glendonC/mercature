/**
 * The lines a place has besides its recorded walk: the way around the walk's mapped steps that OpenStreetMap's router
 * suggests, and the streets the operator adds herself. Neither has street photos and nobody has checked either, so
 * nothing here states a width, a height, a slope or whether a person can get through.
 */
import type { AccessFinding, AccessKind, LonLat } from '../osm/access.ts';

export type { LonLat };
export const AROUND_LABEL = 'OpenStreetMap suggests; nobody has checked it';
export const STREET_LABEL = 'Map only, no street photos';
export const STRETCH_METRES = 10;

/** A 10 m piece of a line that is not the walk, in metres along that line. No photos, so it has no status. */
export type LineStretch = { readonly index: number; readonly from: number; readonly to: number; readonly line: readonly LonLat[] };
/** How many OpenStreetMap findings of one kind lie along a line, and on how many of its stretches. */
export type KindCount = { readonly kind: AccessKind; readonly label: string; readonly count: number; readonly stretches: number };
/** Which router answered, with what, and how old the map was. */
export type Routed = {
  readonly provider: 'valhalla';
  readonly server: string;
  readonly costing: 'pedestrian';
  /** The costing options sent, e.g. { step_penalty: 3600 } for the way around and {} for her street. */
  readonly options: Readonly<Record<string, number>>;
  readonly fetchedAt: string;
  /** When OpenStreetMap was last read for the kinds along the line (Overpass), or null. */
  readonly osmAsOf: string | null;
};
/** One mapped flight of steps on the walk: the OpenStreetMap way, its street, the walk's stretches it sits on, and the place's words for it ("Steps" when it has none). */
export type MappedSteps = { readonly way: number; readonly name: string | null; readonly stretches: readonly number[]; readonly label: string };

/**
 * The way between the walk's two ends that avoids its mapped steps.
 * found: the router has a way that leaves the walk and has no mapped steps on it.
 * none: the walk has mapped steps and the router has no way between its ends without them.
 * same: the walk has no mapped steps, so there is nothing to go around.
 * Only a found way has a line, stretches and kinds.
 */
export type WayAround = {
  readonly schema: 'mercature-way-around/1';
  readonly status: 'found' | 'none' | 'same';
  readonly label: typeof AROUND_LABEL;
  /** The mapped steps on the walk, which a found way goes around. */
  readonly avoids: readonly MappedSteps[];
  readonly walkMetres: number;
  /** The whole way, from the walk's start to its end, [lon, lat]. */
  readonly line: readonly LonLat[];
  readonly lengthMetres: number | null;
  /**
   * Where it runs apart from the walk: metres along the walk where it leaves and rejoins, metres along the way for the
   * same part, and that part's line. It covers every stretch with mapped steps, even where the way keeps beside the walk.
   */
  readonly apart: { readonly leaves: number; readonly rejoins: number; readonly from: number; readonly to: number; readonly line: readonly LonLat[] } | null;
  readonly stretches: readonly LineStretch[];
  /** What OpenStreetMap says along the way, on its stretches (src/osm/access.ts). */
  readonly findings: readonly AccessFinding[];
  readonly kinds: readonly KindCount[];
  /** The named streets along the way, in order, from the router's directions. */
  readonly streets: readonly string[];
  readonly routed: Routed;
};

/** A street she added near the walk: the way on foot between two points she tapped. */
export type OwnStreet = {
  readonly id: string;
  readonly label: typeof STREET_LABEL;
  /** The first named street along it, or null. */
  readonly name: string | null;
  readonly streets: readonly string[];
  readonly from: LonLat;
  readonly to: LonLat;
  readonly line: readonly LonLat[];
  readonly lengthMetres: number;
  readonly stretches: readonly LineStretch[];
  readonly findings: readonly AccessFinding[];
  readonly kinds: readonly KindCount[];
  readonly routed: Routed;
  readonly at: string;
};

/** Her answer once the guide asks her to check the way around. Her record, not a measurement. */
export type AroundCheck = { readonly works: boolean; readonly at: string };

/** What a place keeps on this device: her streets, her check of the way around, and a way around asked here for a walk with no package. */
export type RouteLines = {
  readonly schema: 'mercature-route-lines/1';
  readonly place: string;
  readonly streets: readonly OwnStreet[];
  readonly check: AroundCheck | null;
  readonly around: WayAround | null;
  /** How many streets she has ever added here. It only grows, so a removed id is never given again. */
  readonly seq: number;
};

/** A plain reason a line could not be had, for one line of text. */
export type LineTrouble = 'offline' | 'busy' | 'too-far' | 'too-long' | 'no-walk' | 'failed';
