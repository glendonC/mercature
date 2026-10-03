import { useMemo, type Dispatch, type ReactNode, type Ref, type SetStateAction } from 'react';
import { metres, type Coordinate, type Destination, type Photo } from './data';

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
  /** Extra layers drawn above the map in the same coordinates. */
  children?: ReactNode;
  /** Layers drawn between the streets and the route. */
  underlay?: ReactNode;
  /** A different framing of the same 800 by 500 map coordinates. */
  viewBox?: string;
};
export const MAP_VIEWBOX = [0, 0, 800, 500] as const;

export default function GeographicMap({ data, selected, onSelect, hidden, zoom, setZoom, shown, svgRef, className = '', children, underlay, viewBox = MAP_VIEWBOX.join(' ') }: Props) {
  const selectedView = data.views.find(v => v.id === selected), selectedPhoto = data.photos.find(p => p.id === selectedView?.photoId);
  const focus = zoom > 1 ? selectedPhoto?.position : undefined;
  const { project, scale } = useMemo(() => routeFrame(data, zoom, focus), [data, zoom, focus]);
  const line = (points: Coordinate[]) => points.map(p => project(p).join(',')).join(' ');
  const base = useMemo(() => <g className="map-base">
    {data.buildings.map(feature => <path key={feature.id} d={[feature.points, ...feature.holes].map(ring => `M${ring.map(p => project(p).join(',')).join(' ')}Z`).join(' ')} fillRule="evenodd" className="map-building"><title>{feature.name || 'OpenStreetMap building'}</title></path>)}
    {data.ways.map(feature => <polyline key={feature.id} points={feature.points.map(p => project(p).join(',')).join(' ')} className={feature.kind === 'steps' ? 'map-way map-steps' : feature.kind === 'residential' ? 'map-way map-street' : 'map-way'}><title>{feature.name || feature.kind}</title></polyline>)}
  </g>, [data, project]);
  const ordered = useMemo(() => captureOrder(data.photos), [data.photos]);
  const firstView = useMemo(() => new Map(data.views.map(view => [view.photoId, view.id] as const).reverse()), [data.views]);
  const visible = shown == null ? ordered : ordered.slice(0, shown);
  const selectedPosition = selectedPhoto && project(selectedPhoto.position), selectedHeading = selectedView?.heading ?? selectedPhoto?.heading;
  const scaleMetres = zoom > 1 ? 20 : 50;
  const target = project(data.target.position);
  return <section className={`destination-map ${className}`} hidden={hidden} aria-label="Geographic source map"><svg ref={svgRef} viewBox={viewBox} role="group" aria-label="Recorded geographic route and source cameras">
    <rect width="800" height="500" className="map-ground"/>
    {base}
    {underlay}
    <g className="map-route"><polyline points={line(data.line)} pathLength={1} className="map-route-halo"/><polyline points={line(data.line)} pathLength={1} className="map-route-line"/></g>
    <g className="map-cameras">{visible.map(photo => {
      const point = project(photo.position), viewId = firstView.get(photo.id);
      if (!viewId) return <circle key={photo.id} cx={point[0]} cy={point[1]} r="1.7" className="map-camera"/>;
      const chosen = selectedPhoto?.id === photo.id;
      return <g key={photo.id} role="button" tabIndex={0} aria-label={`Inspect source photograph by ${photo.creator} on ${photo.capturedAt?.slice(0, 10) ?? 'unknown date'}`} aria-pressed={chosen} onClick={() => onSelect(viewId)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(viewId); } }}><circle cx={point[0]} cy={point[1]} r="12" fill="transparent"/><circle cx={point[0]} cy={point[1]} r={chosen ? 6 : 3.2} className={chosen ? 'map-camera-view is-selected' : 'map-camera-view'}/></g>;
    })}</g>
    {selectedPosition && selectedHeading != null && <path d="M0 0L-14 -31L14 -31Z" transform={`translate(${selectedPosition.join(' ')}) rotate(${selectedHeading})`} className="map-heading" pointerEvents="none"/>}
    <g transform={`translate(${target.join(' ')})`} className="map-target"><path d="M0 -9 9 0 0 9 -9 0Z"/><circle r="2.2"/><title>{data.target.name}</title></g>
    {children}
    <g transform="translate(24 456)" className="map-scale"><path d={`M0 -4V0H${scaleMetres * scale}V-4`}/><text y="17">{scaleMetres} m</text></g><text x="766" y="28" className="map-north">N</text>
  </svg><div className="destination-map-controls"><button onClick={() => setZoom(z => Math.min(4, z * 1.5))} aria-label="Zoom map in">+</button><button onClick={() => setZoom(z => Math.max(1, z / 1.5))} aria-label="Zoom map out">−</button><button onClick={() => setZoom(1)}>Fit route</button></div><span className="destination-map-credit">© OpenStreetMap contributors</span></section>;
}
