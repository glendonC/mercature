import { useId, useMemo, type Dispatch, type ReactNode, type Ref, type SetStateAction } from 'react';
import { metres, type Coordinate, type Destination, type Photo } from './data';
import { HAZE, type Lens } from './lens';
import type { Point } from './walk';
import { useLanguage } from '../i18n';
import './map.css';

/** Photos in the order they were captured; undated photos come last. */
export function captureOrder(photos: readonly Photo[]): Photo[] {
  return [...photos].sort((a, b) => (a.capturedAt ?? '￿').localeCompare(b.capturedAt ?? '￿'));
}

/** The route framing shared by the reveal and the inspection map: metres projected into an 800 by 500 view. */
export function routeFrame(data: Destination, zoom = 1, focus?: Coordinate) {
  const origin: Coordinate = [data.origin[0], data.origin[1]];
  const withViews = data.photos.filter(photo => data.views.some(view => view.photoId === photo.id));
  const extent = [...data.line, data.target.position, ...withViews.map(p => p.position)].map(p => metres(p, origin));
  const minX = Math.min(...extent.map(p => p[0])), maxX = Math.max(...extent.map(p => p[0])), minY = Math.min(...extent.map(p => p[1])), maxY = Math.max(...extent.map(p => p[1]));
  const w = Math.max(maxX - minX, 40), h = Math.max(maxY - minY, 40), scale = Math.min(700 / w, 420 / h) * zoom;
  const centre = focus && zoom > 1 ? metres(focus, origin) : [(minX + maxX) / 2, (minY + maxY) / 2];
  /** East and north metres in the route frame, as retained reconstruction points use. */
  const fromMetres = (east: number, north: number): Coordinate => [400 + (east - centre[0]) * scale, 250 - (north - centre[1]) * scale];
  const project = (point: Coordinate): Coordinate => { const p = metres(point, origin); return fromMetres(p[0], p[1]); };
  return { project, fromMetres, scale, origin };
}

const area = (ring: Point[]) => ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const turned = (polygon: Point[]) => area(polygon) < 0 ? [...polygon].reverse() : polygon;
const open = (ring: Point[]) => ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
/** A line of some width as polygons with one winding: a band along every segment and a disc at every vertex. */
function band(line: Point[], half: number): Point[][] {
  const parts: Point[][] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!length) continue;
    const nx = -(b[1] - a[1]) / length * half, ny = (b[0] - a[0]) / length * half;
    parts.push([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
  }
  // Round ends, and round joins where the line turns; a straight run needs none.
  line.forEach((p, i) => {
    const a = line[i - 1], b = line[i + 1];
    if (a && b && Math.abs(Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0])) < 0.15) return;
    parts.push(Array.from({ length: 12 }, (_, j): Point => [p[0] + Math.cos(j * Math.PI / 6) * half, p[1] + Math.sin(j * Math.PI / 6) * half]));
  });
  return parts.map(turned);
}
/** How much taller than an ordinary block a named building is drawn: churches, then convents and palaces. Illustrative only. */
const STATURE: [RegExp, number][] = [[/\b(catedral|cathedral|iglesia|church|capilla|chapel|templo|bas[ií]lica)\b/i, 2.5], [/\b(convento|monasterio|convent|monastery|palacio|palace|municipalidad)\b/i, 1.5]];
const inside = (p: Point, ring: Point[]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > p[1]) !== (ring[j][1] > p[1]) && p[0] < (ring[j][0] - ring[i][0]) * (p[1] - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) hit = !hit;
  return hit;
};
/** The map's own geometry in route-frame units, kept for drawing through a lens. */
function planOf(data: Destination, project: (point: Coordinate) => Coordinate) {
  const buildings = data.buildings.map(feature => {
    const stature = STATURE.find(([pattern]) => pattern.test(feature.name))?.[1] ?? 1;
    return { id: feature.id, name: feature.name, stature, rings: [feature.points, ...feature.holes].map((ring, i) => {
      const points = open(ring.map(project));
      return { points, hole: i > 0, turn: Math.sign(area(points)), buried: [] as boolean[] };
    }) };
  });
  // A wall against a neighbour at least as tall is inside the block; it is never seen, so it is never drawn.
  for (const building of buildings) for (const ring of building.rings) {
    const outward = ring.turn * (ring.hole ? -1 : 1);
    ring.buried = ring.points.map((a, i) => {
      const b = ring.points[(i + 1) % ring.points.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const probe: Point = [(a[0] + b[0]) / 2 + (b[1] - a[1]) / length * outward * 0.6, (a[1] + b[1]) / 2 - (b[0] - a[0]) / length * outward * 0.6];
      return buildings.some(other => other !== building && other.stature >= building.stature && inside(probe, other.rings[0].points) && !other.rings.slice(1).some(hole => inside(probe, hole.points)));
    });
  }
  const streets: Point[][] = [], paths: Point[][] = [], steps: Point[][] = [];
  for (const way of data.ways) {
    const line = way.points.map(project);
    if (way.kind === 'steps') steps.push(line);
    else if (way.kind === 'residential') streets.push(...band(line, 4.5));
    else paths.push(...band(line, 2));
  }
  return { buildings, streets, paths, steps };
}
type Plan = ReturnType<typeof planOf>;
const xy = (p: Point) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const shape = (points: Point[]) => `M${points.map(xy).join('L')}Z`;

/** The ground drawn through a lens: streets, then each block from the farthest to the nearest, walls before its roof. */
function Ground({ plan, lens, rise, label }: { plan: Plan; lens: Lens; rise: number; label: (name: string) => string }) {
  const blocks = plan.buildings.flatMap(building => {
    const up = rise * building.stature, walls = { lit: '', front: '', shade: '' };
    // A block wholly off screen is not drawn; one just below the edge may still rise into view.
    const outline = building.rings[0].points.map(p => lens.at(p)), margin = 60;
    if (outline.every(p => p[0] < -margin) || outline.every(p => p[0] > lens.width + margin) || outline.every(p => p[1] < -margin) || outline.every(p => p[1] > lens.height + margin * 2.5)) return [];
    for (const ring of building.rings) {
      const base = ring.points.map(p => lens.at(p)), top = ring.points.map(p => lens.at(p, up)), outward = ring.turn * (ring.hole ? -1 : 1);
      for (let i = 0; i < base.length; i++) {
        const j = (i + 1) % base.length, wall = [base[i], base[j], top[j], top[i]], facing = area(wall);
        // A wall turned away from the viewer sits under its own roof.
        if (ring.buried[i] || facing * outward <= 0) continue;
        // Light from the upper left: walls facing left are lit, walls facing the viewer are mid, walls facing right are in shade.
        const across = (base[j][1] - base[i][1]) * outward / Math.max(1e-6, Math.hypot(base[j][0] - base[i][0], base[j][1] - base[i][1]));
        walls[across < -0.4 ? 'lit' : across > 0.4 ? 'shade' : 'front'] += shape(facing > 0 ? wall : wall.reverse());
      }
    }
    const centre = building.rings[0].points.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1]], [0, 0]).map(v => v / building.rings[0].points.length) as Point;
    return [{ building, walls, depth: lens.at(centre)[1], roof: building.rings.map(ring => shape(ring.points.map(p => lens.at(p, up)))).join('') }];
  }).sort((a, b) => a.depth - b.depth);
  // Blocks of one height can share paths, walls before roofs; a taller one keeps its own place in the depth order.
  const runs: { key: string; landmark: boolean; walls: typeof blocks[number]['walls']; roofs: { id: string; name: string; d: string }[] }[] = [];
  for (const { building, walls, roof } of blocks) {
    const last = runs.at(-1), landmark = building.stature > 1;
    if (last && !landmark && !last.landmark) { last.walls.lit += walls.lit; last.walls.front += walls.front; last.walls.shade += walls.shade; last.roofs.push({ id: building.id, name: building.name, d: roof }); }
    else runs.push({ key: building.id, landmark, walls: { ...walls }, roofs: [{ id: building.id, name: building.name, d: roof }] });
  }
  const fill = (polygons: Point[][]) => polygons.map(polygon => shape(polygon.map(p => lens.at(p)))).join('');
  const streets = fill(plan.streets) + fill(plan.paths);
  const steps = plan.steps.map((line, i) => { const width = 4 * lens.scale(line[Math.floor(line.length / 2)]); return <polyline key={i} points={line.map(p => lens.at(p).join(',')).join(' ')} className="map-way map-steps" style={{ strokeWidth: width, strokeDasharray: `${width / 2} ${width / 2}` }}/>; });
  return <g className="map-base">
    <path d={streets} className="map-way-area"/>
    {steps}
    {runs.map(({ key, landmark, walls, roofs }) => <g key={key} className={landmark ? 'map-block is-landmark' : 'map-block'}>
      <path d={walls.lit} className="map-walls is-lit"/>
      <path d={walls.front} className="map-walls"/>
      <path d={walls.shade} className="map-walls is-shaded"/>
      {roofs.map(roof => <path key={roof.id} d={roof.d} fillRule="evenodd" className="map-building"><title>{label(roof.name)}</title></path>)}
    </g>)}
    {/* The flat map draws its streets over the buildings; that copy fades as the blocks rise. */}
    {lens.view.lean < 0.25 && <g opacity={1 - lens.view.lean * 4}><path d={streets} className="map-way-area"/>{steps}</g>}
  </g>;
}

type Props = {
  data: Destination;
  selected: string;
  onSelect: (id: string) => void;
  hidden: boolean;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  /** How many photos to show, in capture order. Every photo shows when omitted. */
  shown?: number;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
  /** Extra layers drawn above the map in the same coordinates, or in screen pixels when a lens is given. */
  children?: ReactNode;
  /** Layers drawn between the streets and the route. */
  underlay?: ReactNode;
  /** A different framing of the same 800 by 500 map coordinates. */
  viewBox?: string;
  /** The map's own words; the interface language's by default. */
  words?: MapWords;
  /** Draws the map leaning away through this lens, in screen pixels, instead of through the view box. */
  lens?: Lens;
  /** Height of the blocks drawn for buildings through a lens, in map units. */
  rise?: number;
  /** A backdrop: no zoom buttons, scale bar or north arrow. The credit stays. */
  still?: boolean;
};
export type MapWords = { zoomIn: string; zoomOut: string; fit: string; credit: string };
export const MAP_VIEWBOX = [0, 0, 800, 500] as const;

export default function GeographicMap({ data, selected, onSelect, hidden, zoom, setZoom, shown, svgRef, className = '', children, underlay, viewBox = MAP_VIEWBOX.join(' '), words: given, lens, rise = 0, still = false }: Props) {
  const { t } = useLanguage();
  const fog = useId();
  const words = given ?? { zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), fit: t('map.fit'), credit: t('map.credit') };
  const selectedView = data.views.find(v => v.id === selected), selectedPhoto = data.photos.find(p => p.id === selectedView?.photoId);
  const focus = zoom > 1 ? selectedPhoto?.position : undefined;
  const { project: frame, scale } = useMemo(() => routeFrame(data, zoom, focus), [data, zoom, focus]);
  const tilted = !!lens;
  const plan = useMemo(() => tilted ? planOf(data, frame) : null, [tilted, data, frame]);
  const project = lens ? (point: Coordinate): Coordinate => lens.at(frame(point)) : frame;
  /** Map units to pixels at a point: the view box scales the flat map, a lens scales each point. */
  const size = (point: Coordinate) => lens ? lens.scale(frame(point)) : 1;
  const line = (points: Coordinate[]) => points.map(p => project(p).join(',')).join(' ');
  const base = useMemo(() => tilted ? null : <g className="map-base">
    {data.buildings.map(feature => <path key={feature.id} d={[feature.points, ...feature.holes].map(ring => `M${ring.map(p => frame(p).join(',')).join(' ')}Z`).join(' ')} fillRule="evenodd" className="map-building"><title>{feature.name || t('map.building')}</title></path>)}
    {data.ways.map(feature => <polyline key={feature.id} points={feature.points.map(p => frame(p).join(',')).join(' ')} className={feature.kind === 'steps' ? 'map-way map-steps' : feature.kind === 'residential' ? 'map-way map-street' : 'map-way'}><title>{feature.name || feature.kind}</title></polyline>)}
  </g>, [tilted, data, frame, t]);
  const ordered = useMemo(() => captureOrder(data.photos), [data.photos]);
  const firstView = useMemo(() => new Map(data.views.map(view => [view.photoId, view.id] as const).reverse()), [data.views]);
  const visible = shown == null ? ordered : ordered.slice(0, shown);
  const selectedHeading = selectedView?.heading ?? selectedPhoto?.heading;
  const scaleMetres = zoom > 1 ? 20 : 50;
  const target = project(data.target.position);
  /** The camera's field of view on the ground, from the selected photo's position along its heading. */
  const wedge = selectedPhoto && selectedHeading != null ? (() => {
    const [x, y] = frame(selectedPhoto.position), turn = selectedHeading * Math.PI / 180, c = Math.cos(turn), s = Math.sin(turn);
    return ([[0, 0], [-14, -31], [14, -31]] as Point[]).map(([u, v]): Point => [x + u * c - v * s, y + u * s + v * c]);
  })() : null;
  return <section className={`destination-map ${className}`} hidden={hidden} aria-label={t('map.label')}><svg ref={svgRef} viewBox={lens ? `0 0 ${lens.width} ${lens.height}` : viewBox} role="group" aria-label={t('map.svg')}>
    {!lens && <rect width="800" height="500" className="map-ground"/>}
    {plan && lens ? <Ground plan={plan} lens={lens} rise={rise} label={name => name || t('map.building')}/> : base}
    {lens && <>
      <defs><linearGradient id={fog} x1="0" y1="0" x2="0" y2="1"><stop offset={HAZE.solid / HAZE.clear} className="map-fog-far"/><stop offset="1" className="map-fog-clear"/></linearGradient></defs>
      <rect width={lens.width} height={lens.height * HAZE.clear} fill={`url(#${fog})`} opacity={lens.view.lean} pointerEvents="none"/>
    </>}
    {underlay}
    <g className="map-route"><polyline points={line(data.line)} pathLength={1} className="map-route-halo"/><polyline points={line(data.line)} pathLength={1} className="map-route-line"/></g>
    <g className="map-cameras">{visible.map(photo => {
      const point = project(photo.position), viewId = firstView.get(photo.id), grow = size(photo.position);
      if (!viewId) return <circle key={photo.id} cx={point[0]} cy={point[1]} r={1.7 * grow} className="map-camera"/>;
      const chosen = selectedPhoto?.id === photo.id;
      return <g key={photo.id} role="button" tabIndex={0} aria-label={t('map.inspect', { creator: photo.creator, date: photo.capturedAt?.slice(0, 10) ?? t('map.unknownDate') })} aria-pressed={chosen} onClick={() => onSelect(viewId)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(viewId); } }}><circle cx={point[0]} cy={point[1]} r={12 * grow} fill="transparent"/><circle cx={point[0]} cy={point[1]} r={(chosen ? 6 : 3.2) * grow} className={chosen ? 'map-camera-view is-selected' : 'map-camera-view'}/></g>;
    })}</g>
    {wedge && <path d={shape(lens ? wedge.map(p => lens.at(p)) : wedge)} className="map-heading" pointerEvents="none"/>}
    <g transform={`translate(${target.join(' ')})${lens ? ` scale(${Math.min(1.3, size(data.target.position))})` : ''}`} className="map-target"><path d="M0 -9 9 0 0 9 -9 0Z"/><circle r="2.2"/><title>{data.target.name}</title></g>
    {children}
    {!lens && !still && <><g transform="translate(24 456)" className="map-scale"><path d={`M0 -4V0H${scaleMetres * scale}V-4`}/><text y="17">{scaleMetres} m</text></g><text x="766" y="28" className="map-north">N</text></>}
  </svg>{!still && <div className="destination-map-controls"><button onClick={() => setZoom(z => Math.min(4, z * 1.5))} aria-label={words.zoomIn}>+</button><button onClick={() => setZoom(z => Math.max(1, z / 1.5))} aria-label={words.zoomOut}>−</button><button onClick={() => setZoom(1)}>{words.fit}</button></div>}<span className="destination-map-credit">{words.credit}</span></section>;
}
