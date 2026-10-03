import { createPortal } from 'react-dom';
import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { Rect, Result, Scene, Status } from './contracts';
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
type Point = { x: number; y: number };
const corners = (b: Rect) => [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }];
const colors: Record<Status, string> = { reachable: '#c7e2cc', blocked: '#e9c5b8', unknown: '#e4dcbf' };
const statusText: Record<Status, string> = { reachable: 'Connected', blocked: 'Blocked', unknown: 'Unresolved' };

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
  const selected = sourceScene.obstacles.find(item => item.id === selectedId) ?? sourceScene.supports.find(item => item.id === selectedId);
  const unknown = sourceScene.unknown.find(item => item.id === selectedId);
  const destination = sourceScene.destinations.find(item => item.id === selectedId);
  const removed = result.hypothetical && sourceScene.obstacles.some(item => item.id === selectedId) && !scene.obstacles.some(item => item.id === selectedId);
  const destinationResult = result.destinations.find(item => item.id === selectedId);
  const evidence = selected?.evidence ?? (unknown ? [unknown.reason] : destination ? ['Authored destination coordinate; no source photograph or site measurement.'] : []);
  const selectedBounds = selected?.bounds ?? unknown?.bounds;
  const pathNote = `${result.traversals[0]?.kind === 'complete' ? 'Checked cardinal path to the destination.' : result.traversals[0]?.kind === 'approach' ? 'Checked approach only. The line stops before unsupported continuation.' : 'No checked path is available under these requirements.'} A square-envelope illustration, not a prediction of individual passage.`;
  const evidenceContent = <div className="spatial-evidence" aria-live="polite">
      <div><span className="spatial-eyebrow">Linked evidence</span><h3>{selected?.label ?? unknown?.label ?? destination?.label ?? 'Select a feature to inspect'}</h3>
        {selectedBounds && <p className="spatial-dimensions">{evidenceScene ? 'Original footprint: ' : ''}{(selectedBounds.maxX - selectedBounds.minX).toFixed(2)} × {(selectedBounds.maxY - selectedBounds.minY).toFixed(2)} m{evidenceScene ? '' : ' footprint'}{'top' in (selected ?? {}) ? ` · ${((selected as Scene['obstacles'][number]).top - (selected as Scene['obstacles'][number]).bottom).toFixed(2)} m high` : ''}</p>}
        {destinationResult && <p className={`spatial-status spatial-status-${destinationResult.status}`}>{statusText[destinationResult.status]} · {destinationResult.reason}</p>}
      </div>
      <div>{evidence.length ? <ul>{evidence.map(text => <li key={text}>{text}</li>)}</ul> : <p>Choose the bench, dividing walls, destination or unresolved corner in either view. Every dimension in this example is authored.</p>}</div>
    </div>;
  const iconControls = compact && controlsTarget === undefined;
  const controls = <div className="spatial-tools">
      <span className="spatial-authored">{compact ? 'Synthetic example' : <><span aria-hidden="true">◇</span> Authored courtyard <small>· synthetic</small></>}</span>
      <div className="spatial-layer-controls">
        <button type="button" aria-label="Check overlay" title="Check overlay" aria-pressed={showAssessment} onClick={() => setShowAssessment(value => !value)}>{iconControls ? <span aria-hidden="true">◫</span> : 'Check overlay'}</button>
        <button type="button" aria-label="Checked path" title="Checked path" aria-pressed={showPath} onClick={() => setShowPath(value => !value)}>{iconControls ? <span aria-hidden="true">⌁</span> : 'Checked path'}</button>
        {view !== 'map' && <button type="button" onClick={() => { const next = (rotation + 1) % 4; if (onRotationChange) onRotationChange(next); else setLocalRotation(next); }} aria-label="Rotate 3D view" title="Rotate 3D view">{iconControls ? <span aria-hidden="true">↻</span> : '↻ Rotate'}</button>}
        {compact && <button type="button" ref={evidenceButton} className="spatial-evidence-trigger" onClick={() => evidenceDialog.current?.showModal()}>Evidence</button>}
      </div>
    </div>;
  return <section className={`spatial-view${compact ? ' spatial-view-compact' : ''}`} aria-label="Spatial model">
    {controlsTarget === undefined ? controls : controlsTarget ? createPortal(controls, controlsTarget) : null}
    <div className={`spatial-canvases ${view === 'split' ? 'spatial-split' : ''}`}>
      {(view === 'map' || view === 'split') && <Projection {...{ scene, result, selectedId, onSelect, showAssessment, showPath, compact, onPlace, rotation: 0 }} mode="map" />}
      {(view === '3d' || view === 'split') && <Projection {...{ scene, result, selectedId, onSelect, showAssessment, showPath, compact, onPlace, rotation }} mode="3d" />}
    </div>
    {!compact && <div className="spatial-legend" aria-label="Assessment legend">
      {(['reachable', 'blocked', 'unknown'] as const).map(status => <span key={status}><i style={{ background: colors[status] }} />{statusText[status]}</span>)}
      <span className="spatial-legend-note">Under the selected requirements</span>
    </div>}
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
        <p>Original authored records · synthetic example.</p>
        {showAssessment && <div className="spatial-legend" aria-label="Assessment legend">{(['reachable', 'blocked', 'unknown'] as const).map(status => <span key={status}><i style={{ background: colors[status] }} />{statusText[status]}</span>)}</div>}
        {showPath && <p>{pathNote}</p>}
      </div>
    </dialog> : evidenceContent}
  </section>;
}

type ProjectionProps = Omit<SpatialViewProps, 'view'> & { mode: 'map' | '3d'; rotation: number; showAssessment: boolean; showPath: boolean };

function Projection({ scene, result, selectedId, onSelect, mode, rotation, showAssessment, showPath, compact, onPlace }: ProjectionProps) {
  const id = useId().replaceAll(':', '');
  const project = (point: Point, z = 0): Point => {
    const x = point.x - (scene.bounds.minX + scene.bounds.maxX) / 2;
    const y = point.y - (scene.bounds.minY + scene.bounds.maxY) / 2;
    if (mode === 'map') return { x: x * 40, y: -y * 40 };
    const angle = rotation * Math.PI / 2;
    const rx = x * Math.cos(angle) - y * Math.sin(angle), ry = x * Math.sin(angle) + y * Math.cos(angle);
    return { x: (rx - ry) * 31, y: (rx + ry) * 15 - z * 34 };
  };
  const points = (values: Point[], z = 0) => values.map(point => { const p = project(point, z); return `${p.x},${p.y}`; }).join(' ');
  const polygon = (bounds: Rect, z = 0) => points(corners(bounds), z);
  const extent = corners(scene.bounds).flatMap(point => [project(point), project(point, Math.max(0, ...scene.obstacles.map(o => o.top)))]);
  const minX = Math.min(...extent.map(p => p.x)) - 55, minY = Math.min(...extent.map(p => p.y)) - 36;
  const width = Math.max(...extent.map(p => p.x)) - minX + 55, height = Math.max(...extent.map(p => p.y)) - minY + 54;
  const cellPaths = useMemo(() => {
    const paths: Record<Status, string[]> = { reachable: [], blocked: [], unknown: [] };
    for (const cell of result.cells) {
      const half = result.cellSize / 2;
      const b = { minX: Math.max(scene.bounds.minX, cell.x - half), minY: Math.max(scene.bounds.minY, cell.y - half), maxX: Math.min(scene.bounds.maxX, cell.x + half), maxY: Math.min(scene.bounds.maxY, cell.y + half) };
      paths[cell.status].push(`M${polygon(b, cell.elevation)}Z`);
    }
    return Object.fromEntries(Object.entries(paths).map(([key, values]) => [key, values.join(' ')])) as Record<Status, string>;
  }, [result, scene.bounds, mode, rotation]);
  function placeAt(event: MouseEvent<SVGSVGElement>) {
    if (mode !== 'map' || !onPlace) return;
    // Capture handles floor, feature and marker clicks consistently during placement.
    event.stopPropagation();
    const svg = event.currentTarget, matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const x = local.x / 40 + (scene.bounds.minX + scene.bounds.maxX) / 2;
    const y = -local.y / 40 + (scene.bounds.minY + scene.bounds.maxY) / 2;
    if (Number.isFinite(x) && Number.isFinite(y)) onPlace({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  const activate = (event: KeyboardEvent<SVGGElement>, featureId: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(featureId); }
  };
  const interaction = (featureId: string, label: string) => ({ role: 'button', 'data-feature-id': featureId, tabIndex: 0, 'aria-label': `Inspect ${label}`, 'aria-pressed': selectedId === featureId, onClick: () => onSelect(featureId), onKeyDown: (event: KeyboardEvent<SVGGElement>) => activate(event, featureId), className: `spatial-feature ${selectedId === featureId ? 'is-selected' : ''}` });
  const obstacles = [...scene.obstacles].sort((a, b) => project({ x: (a.bounds.minX + a.bounds.maxX) / 2, y: (a.bounds.minY + a.bounds.maxY) / 2 }).y - project({ x: (b.bounds.minX + b.bounds.maxX) / 2, y: (b.bounds.minY + b.bounds.maxY) / 2 }).y);
  const start = project(scene.start, .08);
  return <figure className={`spatial-projection spatial-projection-${mode}`}>
    <figcaption><span>{compact ? (mode === 'map' ? 'Map' : '3D') : (mode === 'map' ? 'Plan view' : 'Spatial view')}</span>{!compact && <small>{mode === 'map' ? 'Metric geometry · metres' : 'Projected geometry · rotate to inspect'}</small>}</figcaption>
    <svg viewBox={`${minX} ${minY} ${width} ${height}`} onClickCapture={placeAt} className={mode === 'map' && onPlace ? 'spatial-placing' : undefined} aria-description={mode === 'map' && onPlace ? 'Choose a placement point. Coordinates snap to 0.1 metres; the proposed placement will be validated.' : undefined} aria-label={`${mode === 'map' ? 'Map' : '3D'} of synthetic courtyard`} role="group">
      <defs><pattern id={`${id}-unknown`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="9" height="9" fill="#f5edda"/><line x1="0" y1="0" x2="0" y2="9" stroke="#baad89" strokeWidth="2"/></pattern></defs>
      <polygon points={polygon(scene.bounds, -.14)} fill="#dedbd0" transform="translate(0 6)" />
      {scene.supports.map(support => <g key={support.id} {...interaction(support.id, support.label)}><polygon points={polygon(support.bounds, support.elevation)} fill="#f5f0e5" stroke="#c4c5b5" strokeWidth="1.5"/><title>{support.evidence.join(' ')}</title></g>)}
      <g pointerEvents="none" opacity={showAssessment ? .86 : 0}>{(['reachable', 'blocked', 'unknown'] as const).map(status => <path key={status} d={cellPaths[status]} fill={colors[status]} />)}</g>
      {scene.unknown.map(region => <g key={region.id} {...interaction(region.id, region.label)}><polygon points={polygon(region.bounds, region.elevation + .01)} fill={`url(#${id}-unknown)`} stroke="#a59975" strokeWidth="1" strokeDasharray="4 3"/><title>{region.reason}</title><text x={project({ x: (region.bounds.minX + region.bounds.maxX) / 2, y: (region.bounds.minY + region.bounds.maxY) / 2 }).x} y={project({ x: (region.bounds.minX + region.bounds.maxX) / 2, y: (region.bounds.minY + region.bounds.maxY) / 2 }).y} className="spatial-question">?</text></g>)}
      {showPath && result.traversals.map(path => path.points.length > 1 && <polyline key={path.destinationId} points={points(path.points)} fill="none" stroke="#467768" strokeWidth="3" strokeDasharray="6 5" strokeLinejoin="round" pointerEvents="none" />)}
      {obstacles.map(obstacle => {
        const c = corners(obstacle.bounds), top = obstacle.top, bottom = obstacle.bottom;
        const topColor = obstacle.movable ? '#d7b298' : '#e6d9d0';
        return <g key={obstacle.id} {...interaction(obstacle.id, obstacle.label)}>
          {mode === '3d' && c.map((point, index) => { const next = c[(index + 1) % 4]; const middle = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }; const center = { x: (obstacle.bounds.minX + obstacle.bounds.maxX) / 2, y: (obstacle.bounds.minY + obstacle.bounds.maxY) / 2 }; if (project(middle).y <= project(center).y) return null; return <polygon key={index} points={[project(point, bottom), project(next, bottom), project(next, top), project(point, top)].map(p => `${p.x},${p.y}`).join(' ')} fill={index % 2 ? (obstacle.movable ? '#a47d66' : '#c0b0a7') : (obstacle.movable ? '#bd957a' : '#d2c4bb')} stroke="#a7978c" strokeWidth=".6" />; })}
          <polygon points={polygon(obstacle.bounds, mode === '3d' ? top : 0)} fill={topColor} stroke={selectedId === obstacle.id ? '#4d6451' : '#9f8e82'} strokeWidth={selectedId === obstacle.id ? 3 : 1}/>
          <title>{obstacle.label}: {obstacle.evidence.join(' ')}</title>
          {obstacle.movable && <g pointerEvents="none"><circle cx={project({ x: (obstacle.bounds.minX + obstacle.bounds.maxX) / 2, y: (obstacle.bounds.minY + obstacle.bounds.maxY) / 2 }, mode === '3d' ? top : 0).x} cy={project({ x: (obstacle.bounds.minX + obstacle.bounds.maxX) / 2, y: (obstacle.bounds.minY + obstacle.bounds.maxY) / 2 }, mode === '3d' ? top : 0).y} r="9" fill="#fff9ef"/><text x={project({ x: (obstacle.bounds.minX + obstacle.bounds.maxX) / 2, y: (obstacle.bounds.minY + obstacle.bounds.maxY) / 2 }, mode === '3d' ? top : 0).x} y={project({ x: (obstacle.bounds.minX + obstacle.bounds.maxX) / 2, y: (obstacle.bounds.minY + obstacle.bounds.maxY) / 2 }, mode === '3d' ? top : 0).y + 3.5} className="spatial-marker-letter">B</text></g>}
        </g>;
      })}
      <g pointerEvents="none"><circle cx={start.x} cy={start.y} r="7" fill="#fffaf0" stroke="#537a69" strokeWidth="2"/><circle cx={start.x} cy={start.y} r="2.5" fill="#537a69"/><text x={start.x} y={start.y + 22} className="spatial-pin-label">Start</text></g>
      {scene.destinations.map(destination => { const point = project(destination, .08); const status = result.destinations.find(item => item.id === destination.id)?.status ?? 'unknown'; return <g key={destination.id} {...interaction(destination.id, destination.label)}><circle cx={point.x} cy={point.y} r="13" fill="#fffaf0" stroke={status === 'reachable' ? '#537a69' : '#a3735e'} strokeWidth="2"/><text x={point.x} y={point.y + 4} className="spatial-marker-letter">{status === 'reachable' ? '✓' : '↗'}</text><text x={point.x} y={point.y + 28} className="spatial-pin-label">{destination.label}</text></g>; })}
    </svg>
    {!compact && <div className="spatial-projection-foot"><span>{result.hypothetical ? 'Proposed geometry' : 'Original geometry'}</span><span>{(scene.bounds.maxX - scene.bounds.minX).toFixed(0)} × {(scene.bounds.maxY - scene.bounds.minY).toFixed(0)} m boundary</span></div>}
  </figure>;
}
