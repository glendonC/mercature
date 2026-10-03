/** Authored synthetic geometry only. Independent v1 contract, never a legacy route adapter. */
export const SCHEMA_VERSION = 'spatial-v1' as const;
export type Vec2 = { x: number; y: number };
export type Rect = { minX: number; minY: number; maxX: number; maxY: number };
export type Support = { id: string; label: string; bounds: Rect; elevation: number; uncertainty: number; evidence: string[] };
export type Obstacle = { id: string; label: string; bounds: Rect; bottom: number; top: number; uncertainty: number; reviewed: boolean; movable: boolean; evidence: string[] };
export type UnknownRegion = { id: string; label: string; bounds: Rect; elevation: number; reason: string };
export type Location = Vec2 & { supportId: string };
export type Destination = Location & { id: string; label: string };
export type Scene = {
  schemaVersion: typeof SCHEMA_VERSION; id: string; title: string; revision: number;
  provenance: 'synthetic'; units: 'm'; bounds: Rect; supports: Support[];
  obstacles: Obstacle[]; unknown: UnknownRegion[]; start: Location;
  destinations: Destination[]; assumptions: string[];
};
export type Profile = {
  id: string; label: string; width: number; height: number; maxStep: number; cellSize: number;
  requirements: { longitudinalSlope: boolean; crossSlope: boolean; turning: boolean; multilevel: boolean };
  source: string;
};
export type Operation = { kind: 'remove'; objectId: string } | { kind: 'move'; objectId: string; to: Vec2 };
export type Scenario = {
  schemaVersion: typeof SCHEMA_VERSION; hypothetical: true; baseSceneHash: string; profileHash: string;
  solverHash: string; operations: Operation[];
};
export type Status = 'reachable' | 'blocked' | 'unknown';
export type Cell = {
  id: string; x: number; y: number; elevation: number; supportId: string;
  status: Status; reason: string; featureIds: string[];
};
export type TraversalPoint = Vec2 & { elevation: number };
/** A certified square-envelope route; an approach never claims arrival at the destination. */
export type Traversal = {
  traversalVersion: 'certified-cardinal-v1';
  destinationId: string; status: Status; kind: 'complete' | 'approach' | 'unavailable';
  points: TraversalPoint[]; length: number; reason: string;
  sceneHash: string; profileHash: string; scenarioHash: string; solverHash: string;
};
export type Result = {
  schemaVersion: typeof SCHEMA_VERSION; sceneHash: string; profileHash: string; scenarioHash: string;
  solverHash: string; traversals: Traversal[]; cells: Cell[]; destinations: { id: string; label: string; status: Status; reason: string }[];
  reachableArea: number; blockedArea: number; unknownArea: number; cellSize: number;
  unsupported: string[]; assumptions: string[]; hypothetical: boolean;
};
export type Project = { schemaVersion: typeof SCHEMA_VERSION; scene: Scene; profile: Profile; scenario: Scenario };
