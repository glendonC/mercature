import { createPortal } from 'react-dom';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { Obstacle, Rect, Result, Scene, Status } from './contracts';
import { centre, corners, drawnHeight, hull, obstacleArt, points, unknownArt, type Point, type Project } from './sceneArt';
import './SpatialView.css';

export type SpatialViewProps = {
  scene: Scene;
  evidenceScene?: Scene;
  result: Result;
  selectedId: string | null;
  onSelect: (id: string) => void;
  view: 'map' | '3d' | 'split';
  compact?: boolean;
  /** Undefined keeps inline controls; null hides them until a contextual host mounts. */
  controlsTarget?: HTMLElement | null;
  returnFocus?: () => void;
  rotation?: number;
  onRotationChange?: (rotation: number) => void;
  onPlace?: (point: { x: number; y: number }) => void;
};
const STATUSES = ['reachable', 'blocked', 'unknown'] as const;
const statusText: Record<Status, string> = { reachable: 'Connected', blocked: 'Blocked', unknown: 'Unknown' };
/** Paths on a 24px grid, drawn with a 1.5px stroke. */
const ICONS = {
  overlay: 'M12 4.5 20 8.5l-8 4-8-4 8-4ZM4 12.5l8 4 8-4M4 16.5l8 4 8-4',
  path: 'M5 19h6.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7H19',
  rotate: 'M20.5 12a8.5 8.5 0 1 1-8.5-8.5c2.3 0 4.5.9 6.1 2.5l2.4 2.4M20.5 3.5v4.9h-4.9',
  authored: 'M12 3.5 20.5 12 12 20.5 3.5 12Z',
  reachable: 'M7 12.5l3.2 3.2L17 9',
  blocked: 'M8.5 8.5l7 7m0-7-7 7',
  unknown: 'M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.9v.1',
};
const Icon = ({ name }: { name: keyof typeof ICONS }) => <svg className="spatial-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ICONS[name]} /></svg>;
const Legend = ({ note }: { note?: boolean }) => <div className="spatial-legend" aria-label="Path check legend">
  {STATUSES.map(status => <span key={status}><i className={`spatial-swatch is-${status}`} />{statusText[status]}</span>)}
  {note && <span className="spatial-legend-note">Under the selected requirements</span>}
</div>;

/** Both projections use the same scene coordinates and shared feature selection. */
export default function SpatialView({ scene, result, selectedId, onSelect, view, compact = false, controlsTarget, returnFocus, onPlace, evidenceScene, rotation: controlledRotation, onRotationChange }: SpatialViewProps) {
  const [showAssessment, setShowAssessment] = useState(true);
  const [showPath, setShowPath] = useState(false);
  const [localRotation, setLocalRotation] = useState(0);
  const rotation = controlledRotation ?? localRotation;
  const evidenceDialog = useRef<HTMLDialogElement>(null);
  const evidenceButton = useRef<HTMLButtonElement>(null);
  const evidenceTitleId = useId();
  const sourceScene = evidenceScene ?? scene;
  const camera = useMemo(() => preferredQuarter(sourceScene), [sourceScene]);
  const selected = sourceScene.obstacles.find(item => item.id === selectedId) ?? sourceScene.supports.find(item => item.id === selectedId);
  const unknown = sourceScene.unknown.find(item => item.id === selectedId);
  const destination = sourceScene.destinations.find(item => item.id === selectedId);
  const removed = result.hypothetical && sourceScene.obstacles.some(item => item.id === selectedId) && !scene.obstacles.some(item => item.id === selectedId);
  const destinationResult = result.destinations.find(item => item.id === selectedId);
  const evidence = selected?.evidence ?? (unknown ? [unknown.reason] : destination ? ['Example position; no photo or measurement.'] : []);
  const selectedBounds = selected?.bounds ?? unknown?.bounds;
  const traversal = result.traversals.find(path => path.destinationId === selectedId);
  const pathNote = `${!traversal ? 'Solid lines reach connected destinations; dashed lines stop at the last checked position.' : traversal.kind === 'complete' ? 'Checked cardinal path to the destination.' : traversal.kind === 'approach' ? 'Checked approach only. The line stops before unsupported continuation.' : 'No checked path is available under these requirements.'} A square-envelope illustration, not a prediction of individual passage.`;
  const evidenceContent = <div className="spatial-evidence" aria-live="polite">
      <div><span className="spatial-eyebrow">Linked evidence</span><h3>{selected?.label ?? unknown?.label ?? destination?.label ?? 'Select a spot'}</h3>
        {selectedBounds && <p className="spatial-dimensions">{evidenceScene ? 'Original footprint: ' : ''}{(selectedBounds.maxX - selectedBounds.minX).toFixed(2)} × {(selectedBounds.maxY - selectedBounds.minY).toFixed(2)} m{evidenceScene ? '' : ' footprint'}{'top' in (selected ?? {}) ? ` · ${((selected as Obstacle).top - (selected as Obstacle).bottom).toFixed(2)} m high` : ''}</p>}
        {destinationResult && <p className={`spatial-status spatial-status-${destinationResult.status}`}>{statusText[destinationResult.status]} · {destinationResult.reason}</p>}
      </div>
      <div>{evidence.length ? <ul>{evidence.map(text => <li key={text}>{text}</li>)}</ul> : <p>Choose a spot in either view. Nothing in this example was measured.</p>}</div>
    </div>;
  const iconControls = compact && controlsTarget === undefined;
  const controls = <div className="spatial-tools">
      <span className="spatial-authored">{compact ? 'Example' : <><Icon name="authored" />{scene.title} <small>· Example</small></>}</span>
      <div className="spatial-layer-controls">
        <button type="button" aria-label="Check overlay" title="Check overlay" aria-pressed={showAssessment} onClick={() => setShowAssessment(value => !value)}><Icon name="overlay" />{!iconControls && <span>Check overlay</span>}</button>
        <button type="button" aria-label="Checked path" title="Checked path" aria-pressed={showPath} onClick={() => setShowPath(value => !value)}><Icon name="path" />{!iconControls && <span>Checked path</span>}</button>
        {view !== 'map' && <button type="button" onClick={() => { const next = (rotation + 1) % 4; if (onRotationChange) onRotationChange(next); else setLocalRotation(next); }} aria-label="Rotate 3D view" title="Rotate 3D view"><Icon name="rotate" />{!iconControls && <span>Rotate</span>}</button>}
        {compact && <button type="button" ref={evidenceButton} className="spatial-evidence-trigger" onClick={() => evidenceDialog.current?.showModal()}>Evidence</button>}
      </div>
    </div>;
  const shared = { scene, evidenceScene, result, selectedId, onSelect, showAssessment, showPath, compact, onPlace };
  return <section className={`spatial-view${compact ? ' spatial-view-compact' : ''}`} aria-label="Path check">
    {controlsTarget === undefined ? controls : controlsTarget ? createPortal(controls, controlsTarget) : null}
    <div className={`spatial-canvases ${view === 'split' ? 'spatial-split' : ''}`}>
      {(view === 'map' || view === 'split') && <Projection {...shared} mode="map" quarter={0} />}
      {(view === '3d' || view === 'split') && <Projection {...shared} mode="3d" quarter={camera + rotation} />}
    </div>
    {!compact && <Legend note />}
    {!compact && showPath && <p className="spatial-path-note">{pathNote}</p>}
    {compact ? <dialog ref={evidenceDialog} className="spatial-evidence-dialog" aria-labelledby={evidenceTitleId} onClose={() => {
      if (returnFocus) return returnFocus();
      const popover = controlsTarget?.closest('[popover]');
      if (popover?.id) document.querySelector<HTMLButtonElement>(`[popovertarget="${CSS.escape(popover.id)}"]`)?.focus();
      else evidenceButton.current?.focus();
    }}>
      <header><h2 id={evidenceTitleId}>Evidence</h2><button type="button" aria-label="Close evidence" autoFocus onClick={() => evidenceDialog.current?.close()}>×</button></header>
      {removed && <p className="spatial-path-note">Removed in this proposal.</p>}
      {evidenceContent}
      <div className="spatial-dialog-context">
        <p>Example. Nothing here was measured.</p>
        {showAssessment && <Legend />}
        {showPath && <p>{pathNote}</p>}
      </div>
    </dialog> : evidenceContent}
  </section>;
}

const MAP_SCALE = 40;
/** Oblique projection: metres along each rotated axis, and metres of height, in drawing units. */
const OBLIQUE = { x: 31, y: 18, z: 32 };
const QUARTERS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
/** Screen pixels kept clear around the drawing, and the type and marker sizes they must fit. */
const MARGIN = { side: 14, top: 14, bottom: 36 };
const FONT = 13, MARKER = 11;

function projector(scene: Scene, mode: 'map' | '3d', quarter: number): Project {
  const cx = (scene.bounds.minX + scene.bounds.maxX) / 2, cy = (scene.bounds.minY + scene.bounds.maxY) / 2;
  const [cos, sin] = QUARTERS[((quarter % 4) + 4) % 4];
  return (point, z = 0) => {
    const x = point.x - cx, y = point.y - cy;
    if (mode === 'map') return { x: x * MAP_SCALE, y: -y * MAP_SCALE };
    const rx = x * cos - y * sin, ry = x * sin + y * cos;
    return { x: (rx - ry) * OBLIQUE.x, y: (rx + ry) * OBLIQUE.y - z * OBLIQUE.z };
  };
}

/** The default 3D camera is the quarter from which movable obstructions are least hidden behind taller features. */
function preferredQuarter(scene: Scene): number {
  const rise = Math.SQRT2 * OBLIQUE.y / OBLIQUE.z;
  const hidden = (quarter: number) => {
    const [cos, sin] = QUARTERS[quarter], toward = { x: (cos + sin) / Math.SQRT2, y: (cos - sin) / Math.SQRT2 };
    let count = 0;
    for (const item of scene.obstacles.filter(o => o.movable)) {
      const b = item.bounds, d = Math.min(b.maxX - b.minX, b.maxY - b.minY) * .2;
      for (const p of [centre(b), ...corners({ minX: b.minX + d, minY: b.minY + d, maxX: b.maxX - d, maxY: b.maxY - d })])
        if (scene.obstacles.some(o => o !== item && o.top > item.top && sightBlocked(p, item.top, toward, rise, o.bounds, o.top))) count++;
    }
    return count;
  };
  let best = 0, fewest = hidden(0);
  for (const quarter of [3, 1, 2]) { const count = hidden(quarter); if (count < fewest) { best = quarter; fewest = count; } }
  return best;
}
function sightBlocked(p: Point, height: number, toward: Point, rise: number, b: Rect, top: number) {
  let enter = 0, exit = Infinity;
  for (const [at, step, min, max] of [[p.x, toward.x, b.minX, b.maxX], [p.y, toward.y, b.minY, b.maxY]] as const) {
    if (Math.abs(step) < 1e-12) { if (at <= min || at >= max) return false; continue; }
    const t1 = (min - at) / step, t2 = (max - at) / step;
    enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
  }
  return enter < exit && height + rise * enter < top;
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Label = { x: number; y: number; anchor: 'middle' | 'start' | 'end'; lines: string[] };
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
/** Greedy placement below, above, right or left of each marker, avoiding markers, earlier labels and the frame. */
function placeLabels(items: { at: Point; radius: number; lines: string[] }[], frame: Box, unit: number): Label[] {
  const font = FONT * unit, gap = 4 * unit;
  const taken: Box[] = items.map(({ at, radius }) => ({ minX: at.x - radius, minY: at.y - radius, maxX: at.x + radius, maxY: at.y + radius }));
  return items.map(({ at, radius, lines }) => {
    const width = Math.max(...lines.map(line => line.length)) * font * .56, height = lines.length * font * 1.2;
    const options: (Label & { box: Box })[] = [
      { anchor: 'middle', x: at.x, y: at.y + radius + gap, box: { minX: at.x - width / 2, maxX: at.x + width / 2, minY: at.y + radius + gap, maxY: at.y + radius + gap + height } },
      { anchor: 'middle', x: at.x, y: at.y - radius - gap - height, box: { minX: at.x - width / 2, maxX: at.x + width / 2, minY: at.y - radius - gap - height, maxY: at.y - radius - gap } },
      { anchor: 'start', x: at.x + radius + gap, y: at.y - height / 2, box: { minX: at.x + radius + gap, maxX: at.x + radius + gap + width, minY: at.y - height / 2, maxY: at.y + height / 2 } },
      { anchor: 'end', x: at.x - radius - gap, y: at.y - height / 2, box: { minX: at.x - radius - gap - width, maxX: at.x - radius - gap, minY: at.y - height / 2, maxY: at.y + height / 2 } },
    ].map(option => ({ ...option, anchor: option.anchor as Label['anchor'], lines }));
    const cost = (box: Box) => taken.reduce((sum, other) => sum + overlap(box, other), 0) + (box.minX < frame.minX || box.maxX > frame.maxX || box.minY < frame.minY || box.maxY > frame.maxY ? width * height : 0);
    const chosen = options.reduce((best, option) => cost(option.box) < cost(best.box) - 1e-9 ? option : best);
    taken.push(chosen.box);
    return { x: chosen.x, y: chosen.y + font * .92, anchor: chosen.anchor, lines };
  });
}
const tenth = (value: number) => Math.round(value * 10) / 10;

type ProjectionProps = Pick<SpatialViewProps, 'scene' | 'evidenceScene' | 'result' | 'selectedId' | 'onSelect' | 'onPlace'> & { compact: boolean; mode: 'map' | '3d'; quarter: number; showAssessment: boolean; showPath: boolean };

function Projection({ scene, evidenceScene, result, selectedId, onSelect, mode, quarter, showAssessment, showPath, compact, onPlace }: ProjectionProps) {
  const id = useId().replaceAll(':', '');
  const svgRef = useRef<SVGSVGElement>(null);
  const ghostRef = useRef<SVGPolygonElement>(null);
  const [size, setSize] = useState({ width: 720, height: 460 });
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const style = getComputedStyle(svg);
      const width = svg.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = svg.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width > 0 && height > 0) setSize(current => Math.abs(current.width - width) < .5 && Math.abs(current.height - height) < .5 ? current : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const project = useMemo(() => projector(scene, mode, quarter), [scene, mode, quarter]);
  const source = evidenceScene ?? scene;
  // Fit the drawing to the measured canvas so type and markers keep their pixel size at any width.
  const extent = corners(scene.bounds).flatMap(point => [project(point), project(point, mode === '3d' ? drawnHeight(source) : 0)]);
  const ex = { minX: Math.min(...extent.map(p => p.x)), minY: Math.min(...extent.map(p => p.y)), maxX: Math.max(...extent.map(p => p.x)), maxY: Math.max(...extent.map(p => p.y)) };
  const scale = Math.max(1e-3, Math.min((size.width - 2 * MARGIN.side) / (ex.maxX - ex.minX), (size.height - MARGIN.top - MARGIN.bottom) / (ex.maxY - ex.minY)));
  const unit = 1 / scale;
  const frame = { minX: ex.minX - MARGIN.side * unit, minY: ex.minY - MARGIN.top * unit, maxX: ex.maxX + MARGIN.side * unit, maxY: ex.maxY + MARGIN.bottom * unit };
  const cellPaths = useMemo(() => {
    const paths: Record<Status, string[]> = { reachable: [], blocked: [], unknown: [] };
    const half = result.cellSize / 2, b = scene.bounds;
    // Consecutive cells in a row with the same status draw as one strip.
    let run: { status: Status; minX: number; maxX: number; y: number; z: number } | undefined;
    const flush = () => { if (run) paths[run.status].push(`M${points(corners({ minX: run.minX, maxX: run.maxX, minY: Math.max(b.minY, run.y - half), maxY: Math.min(b.maxY, run.y + half) }).map(p => project(p, run!.z)))}Z`); };
    for (const cell of result.cells) {
      const minX = Math.max(b.minX, cell.x - half), maxX = Math.min(b.maxX, cell.x + half);
      if (run && run.status === cell.status && run.y === cell.y && run.z === cell.elevation && Math.abs(run.maxX - minX) < 1e-9) run.maxX = maxX;
      else { flush(); run = { status: cell.status, minX, maxX, y: cell.y, z: cell.elevation }; }
    }
    flush();
    return Object.fromEntries(Object.entries(paths).map(([key, values]) => [key, values.join(' ')])) as Record<Status, string>;
  }, [result, scene.bounds, project]);
  const status = (destinationId: string) => result.destinations.find(item => item.id === destinationId)?.status ?? 'unknown';
  const markers = scene.destinations.map(destination => ({ destination, at: project(destination, .08), status: status(destination.id) }));
  const start = project(scene.start, .08);
  // A destination right beside the start already names the spot.
  const startLabel = !scene.destinations.some(d => Math.hypot(d.x - scene.start.x, d.y - scene.start.y) < 1.5);
  const labels = placeLabels([
    ...markers.map(({ destination, at, status }) => ({ at, radius: (MARKER + 2) * unit, lines: status === 'reachable' ? [destination.label] : [destination.label, statusText[status]] })),
    ...(startLabel ? [{ at: start, radius: 9 * unit, lines: ['Start'] }] : []),
  ], frame, unit);
  const obstacles = [...scene.obstacles].sort((a, b) => project(centre(a.bounds)).y - project(centre(b.bounds)).y);
  const was = result.hypothetical && evidenceScene ? evidenceScene.obstacles.filter(original => {
    const now = scene.obstacles.find(item => item.id === original.id);
    return !now || corners(now.bounds).some((p, i) => p.x !== corners(original.bounds)[i].x || p.y !== corners(original.bounds)[i].y);
  }) : [];
  const placing = mode === 'map' && !!onPlace;
  const moving = (scene.obstacles.find(item => item.id === selectedId) ?? source.obstacles.find(item => item.id === selectedId))?.bounds;
  const half = moving ? { x: (moving.maxX - moving.minX) / 2, y: (moving.maxY - moving.minY) / 2 } : { x: 0, y: 0 };
  function metres(event: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) {
    const svg = event.currentTarget, matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const x = local.x / MAP_SCALE + (scene.bounds.minX + scene.bounds.maxX) / 2, y = -local.y / MAP_SCALE + (scene.bounds.minY + scene.bounds.maxY) / 2;
    // The tap names the object's centre; a scenario move names its minimum corner.
    return Number.isFinite(x) && Number.isFinite(y) ? { x: tenth(x - half.x), y: tenth(y - half.y) } : undefined;
  }
  function placeAt(event: MouseEvent<SVGSVGElement>) {
    if (!placing) return;
    // Capture handles floor, feature and marker clicks consistently during placement.
    event.stopPropagation();
    const corner = metres(event);
    if (corner) onPlace!(corner);
  }
  function preview(event: PointerEvent<SVGSVGElement>) {
    const corner = placing && moving ? metres(event) : undefined, ghost = ghostRef.current;
    if (!ghost) return;
    if (!corner) { ghost.style.display = 'none'; return; }
    ghost.setAttribute('points', points(corners({ minX: corner.x, minY: corner.y, maxX: corner.x + 2 * half.x, maxY: corner.y + 2 * half.y }).map(p => project(p))));
    ghost.style.display = '';
  }
  const activate = (event: KeyboardEvent<SVGGElement>, featureId: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(featureId); }
  };
  const interaction = (featureId: string, label: string, kind = '') => ({ role: 'button', 'data-feature-id': featureId, tabIndex: 0, 'aria-label': `Inspect ${label}`, 'aria-pressed': selectedId === featureId, onClick: () => onSelect(featureId), onKeyDown: (event: KeyboardEvent<SVGGElement>) => activate(event, featureId), className: `spatial-feature${kind}${selectedId === featureId ? ' is-selected' : ''}` });
  const outline = (shape: Point[]) => <g className="spatial-outline" aria-hidden="true"><polygon className="spatial-halo" points={points(shape)} /><polygon className="spatial-ink" points={points(shape)} /></g>;
  const flat = (bounds: Rect, z = 0) => points(corners(bounds).map(p => project(p, z)));
  return <figure className={`spatial-projection spatial-projection-${mode}`}>
    <figcaption><span>{compact ? (mode === 'map' ? 'Map' : '3D') : (mode === 'map' ? 'Plan view' : 'Spatial view')}</span>{!compact && <small>{mode === 'map' ? 'Metric geometry · metres' : 'Projected geometry · rotate to inspect'}</small>}</figcaption>
    <svg ref={svgRef} viewBox={`${frame.minX} ${frame.minY} ${frame.maxX - frame.minX} ${frame.maxY - frame.minY}`} onClickCapture={placeAt} onPointerMove={placing ? preview : undefined} onPointerLeave={placing ? preview : undefined}
      className={placing ? 'spatial-placing' : undefined} aria-description={placing ? 'Choose where the centre of the object goes. Coordinates snap to 0.1 metres; the proposed placement will be validated.' : undefined}
      aria-label={`${mode === 'map' ? 'Map' : '3D'} of ${scene.title}`} role="group">
      <polygon className="spatial-base" points={flat(scene.bounds, -.14)} transform={`translate(0 ${6 * unit})`} />
      <defs><pattern id={`${id}-unknown`} width={7 * unit} height={7 * unit} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect className="spatial-hatch-ground" width={7 * unit} height={7 * unit} /><line className="spatial-hatch-line" x1="0" y1="0" x2="0" y2={7 * unit} strokeWidth={1.4 * unit} /></pattern></defs>
      {scene.supports.map(support => <g key={support.id} {...interaction(support.id, support.label)}><polygon className="spatial-ground" points={flat(support.bounds, support.elevation)} /><title>{support.evidence.join(' ')}</title>{outline(corners(support.bounds).map(p => project(p, support.elevation)))}</g>)}
      <g className="spatial-assessment" opacity={showAssessment ? 1 : 0} pointerEvents="none">{STATUSES.map(key => <path key={key} className={`spatial-cells is-${key}`} d={cellPaths[key]} fill={key === 'unknown' ? `url(#${id}-unknown)` : undefined} />)}</g>
      {scene.unknown.map(region => <g key={region.id} {...interaction(region.id, region.label)}>{unknownArt(region, project, `${id}-unknown`, unit)}<title>{region.reason}</title>{outline(corners(region.bounds).map(p => project(p, region.elevation)))}</g>)}
      {was.map(item => <polygon key={item.id} className="spatial-was" points={flat(item.bounds)} />)}
      {showPath && result.traversals.map(path => path.points.length > 1 && <polyline key={path.destinationId} className={`spatial-route is-${path.kind}`} points={points(path.points.map(p => project(p, p.elevation)))} />)}
      {obstacles.map(obstacle => <g key={obstacle.id} {...interaction(obstacle.id, obstacle.label)}>
        <g className="spatial-art">{obstacleArt(obstacle, project, mode === '3d')}</g>
        <title>{obstacle.label}: {obstacle.evidence.join(' ')}</title>
        {outline(hull(corners(obstacle.bounds).flatMap(p => mode === '3d' ? [project(p, obstacle.bottom), project(p, obstacle.top)] : [project(p)])))}
      </g>)}
      <g className="spatial-start" pointerEvents="none"><circle cx={start.x} cy={start.y} r={7 * unit} /><circle className="spatial-start-dot" cx={start.x} cy={start.y} r={2.6 * unit} /></g>
      {startLabel && <text className="spatial-pin-label" x={labels[labels.length - 1].x} y={labels[labels.length - 1].y} textAnchor={labels[labels.length - 1].anchor} fontSize={FONT * unit} strokeWidth={3 * unit} pointerEvents="none">Start</text>}
      {markers.map(({ destination, at, status }, index) => <g key={destination.id} {...interaction(destination.id, destination.label, ` spatial-destination is-${status}`)}>
        <circle className="spatial-hit" cx={at.x} cy={at.y} r={22 * unit} />
        <circle className="spatial-marker" cx={at.x} cy={at.y} r={MARKER * unit} />
        <path className="spatial-marker-icon" d={ICONS[status]} transform={`translate(${at.x} ${at.y}) scale(${unit * 17 / 24}) translate(-12 -12)`} />
        <g className="spatial-outline" aria-hidden="true"><circle className="spatial-halo" cx={at.x} cy={at.y} r={(MARKER + 4) * unit} /><circle className="spatial-ink" cx={at.x} cy={at.y} r={(MARKER + 4) * unit} /></g>
        <text className="spatial-pin-label" x={labels[index].x} y={labels[index].y} textAnchor={labels[index].anchor} fontSize={FONT * unit} strokeWidth={3 * unit}>
          {labels[index].lines.map((line, i) => <tspan key={i} x={labels[index].x} dy={i ? FONT * 1.2 * unit : 0} className={i ? 'spatial-pin-status' : undefined}>{line}</tspan>)}
        </text>
      </g>)}
      {placing && <polygon ref={ghostRef} className="spatial-ghost" style={{ display: 'none' }} />}
    </svg>
    {!compact && <div className="spatial-projection-foot"><span>{result.hypothetical ? 'Proposed geometry' : 'Original geometry'}</span><span>{(scene.bounds.maxX - scene.bounds.minX).toFixed(0)} × {(scene.bounds.maxY - scene.bounds.minY).toFixed(0)} m boundary</span></div>}
  </figure>;
}
