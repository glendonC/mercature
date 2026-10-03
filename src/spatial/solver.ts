import { SCHEMA_VERSION, type Cell, type Location, type Profile, type Rect, type Result, type Scenario, type Scene } from './contracts';
import { certifiedTraversal } from './traversal';
import { applyScenario } from './scenario';
import { SOLVER_HASH, contains, contentHash, covered, expand, overlaps, validRect, validateProfile, validateScene } from './validation';

type Check = { kind: 'clear' | 'blocked' | 'unknown'; reason: string; ids: string[] };
const clear: Check = { kind: 'clear', reason: 'Continuous known support and sufficient box clearance.', ids: [] };
const square = (x: number, y: number, r: number): Rect => ({ minX: x-r, minY: y-r, maxX: x+r, maxY: y+r });
const sweep = (a: Rect, b: Rect): Rect => ({ minX: Math.min(a.minX,b.minX), minY: Math.min(a.minY,b.minY), maxX: Math.max(a.maxX,b.maxX), maxY: Math.max(a.maxY,b.maxY) });

/** Fixed-axis square envelope, cardinal translations only. Cells represent certified whole tiles. */
export function solveScene(base: Scene, profile: Profile, scenario?: Scenario): Result {
  validateScene(base); validateProfile(profile);
  const scene = scenario ? applyScenario(base, profile, scenario) : base;
  const step = profile.cellSize, radius = profile.width / 2;
  const levels = [...new Set(scene.supports.map(s => s.elevation))].sort((a,b) => a-b);
  const nx = Math.ceil((scene.bounds.maxX-scene.bounds.minX)/step), ny = Math.ceil((scene.bounds.maxY-scene.bounds.minY)/step);
  if (nx * ny * levels.length * (scene.supports.length + scene.obstacles.length + scene.unknown.length) > 3_000_000) throw new Error('Calculation exceeds the synthetic geometry work budget');
  if (nx * ny * levels.length > 60000) throw new Error('Calculation exceeds 60,000 cells; increase cell size or reduce scene bounds');
  const unsupported = [
    ...(profile.maxStep > 0 ? ['Positive step allowance: vertical transitions are not implemented.'] : []),
    ...Object.entries(profile.requirements).filter(([,needed]) => needed).map(([name]) => `${name}: not implemented by this horizontal square-envelope solver.`),
  ];
  const floorAt = (x: number, y: number, z: number) => scene.supports.find(s => s.elevation === z && x >= s.bounds.minX && x <= s.bounds.maxX && y >= s.bounds.minY && y <= s.bounds.maxY);
  const supports = new Map(levels.map(z => [z, scene.supports.filter(s => s.elevation === z)]));
  function check(nominal: Rect, conservative: Rect, z: number): Check {
    // Assessment extent is a scope limit, not an invented physical wall.
    // Check authored obstacles before returning unknown at the scope boundary.
    let uncertain: Check | undefined;
    const floorUncertainty = Math.max(0, ...supports.get(z)!.filter(s => overlaps(conservative, s.bounds)).map(s => s.uncertainty));
    for (const obstacle of scene.obstacles) {
      const expanded = expand(obstacle.bounds, obstacle.uncertainty);
      if (obstacle.top + obstacle.uncertainty <= z - floorUncertainty || obstacle.bottom - obstacle.uncertainty >= z + profile.height + floorUncertainty || !overlaps(conservative, expanded)) continue;
      const shrunk = expand(obstacle.bounds, -obstacle.uncertainty);
      if (validRect(shrunk) && obstacle.top - obstacle.uncertainty > z + floorUncertainty && obstacle.bottom + obstacle.uncertainty < z + profile.height - floorUncertainty && overlaps(nominal, shrunk)) return { kind: 'blocked', reason: obstacle.bottom > z ? 'Insufficient overhead clearance.' : 'Obstacle intersects the required square envelope.', ids: [obstacle.id] };
      uncertain = { kind: 'unknown', reason: 'Clearance is within geometry uncertainty or the conservative cell margin.', ids: [obstacle.id] };
    }
    for (const upper of scene.supports) {
      if (upper.elevation <= z || upper.elevation - upper.uncertainty >= z + profile.height + floorUncertainty || !overlaps(conservative, expand(upper.bounds, upper.uncertainty))) continue;
      if (upper.elevation + upper.uncertainty < z + profile.height - floorUncertainty && validRect(expand(upper.bounds, -upper.uncertainty)) && overlaps(nominal, expand(upper.bounds, -upper.uncertainty))) return { kind: 'blocked', reason: 'Overlying support leaves insufficient headroom.', ids: [upper.id] };
      uncertain = { kind: 'unknown', reason: 'Overhead support lies within the headroom uncertainty margin.', ids: [upper.id] };
    }
    const unknown = scene.unknown.filter(u => u.elevation === z && overlaps(conservative, u.bounds));
    if (unknown.length) return { kind: 'unknown', reason: 'The envelope intersects explicitly unknown support.', ids: unknown.map(u => u.id) };
    if (!contains(scene.bounds, conservative)) return { kind: 'unknown', reason: 'Conservative cell envelope reaches the assessment boundary.', ids: [] };
    const floor = supports.get(z)!;
    if (!covered(conservative, floor.map(s => expand(s.bounds, -s.uncertainty)))) return { kind: 'unknown', reason: 'Continuous support for the whole envelope is missing or uncertain.', ids: floor.filter(s => overlaps(conservative,s.bounds)).map(s=>s.id) };
    return uncertain ?? clear;
  }
  const cells: Cell[] = [], local: Check[] = [];
  const index = (layer: number, ix: number, iy: number) => layer*nx*ny + iy*nx + ix;
  for (let layer=0; layer<levels.length; layer++) for (let iy=0; iy<ny; iy++) for (let ix=0; ix<nx; ix++) {
    const x=scene.bounds.minX+(ix+.5)*step, y=scene.bounds.minY+(iy+.5)*step, elevation=levels[layer];
    // Shrinking by half a tile proves collision only if every centre in this tile collides.
    // Negative reduced extents still express the universal axis inequalities.
    const own = check(square(x,y,radius-step/2),square(x,y,radius+step/2),elevation);
    cells.push({ id: `${layer}:${ix}:${iy}`, x,y,elevation,supportId:floorAt(x,y,elevation)?.id ?? `unknown:${layer}`, status:'unknown',reason:own.reason,featureIds:own.ids }); local.push(own);
  }
  function locate(p: Location) {
    const support=scene.supports.find(s=>s.id===p.supportId)!;
    const layer=levels.indexOf(support.elevation), ix=Math.min(nx-1,Math.floor((p.x-scene.bounds.minX)/step)), iy=Math.min(ny-1,Math.floor((p.y-scene.bounds.minY)/step));
    return index(layer,ix,iy);
  }
  const start=locate(scene.start);
  const edgeChecks=new Map<string,Check>();
  function connection(a: number,b: number) {
    const key=a<b?`${a}:${b}`:`${b}:${a}`;
    let result=edgeChecks.get(key);
    if (!result) { const ca=cells[a],cb=cells[b]; result=check(sweep(square(ca.x,ca.y,radius),square(cb.x,cb.y,radius)),sweep(square(ca.x,ca.y,radius+step/2),square(cb.x,cb.y,radius+step/2)),ca.elevation);edgeChecks.set(key,result); }
    return result;
  }
  // Certify actual start-to-cell translation, not just the nearest sampled centre.
  const sc=cells[start];
  const exactStart=check(square(scene.start.x,scene.start.y,radius),square(scene.start.x,scene.start.y,radius),sc.elevation);
  const startCheck=check(sweep(square(scene.start.x,scene.start.y,radius),square(sc.x,sc.y,radius)),sweep(square(scene.start.x,scene.start.y,radius),square(sc.x,sc.y,radius+step/2)),sc.elevation);
  const parents = new Map<number, number>();
  function flood(optimistic: boolean) {
    const found=new Set<number>();
    if (exactStart.kind==='blocked' || (!optimistic && startCheck.kind!=='clear')) return found;
    if(local[start].kind==='blocked' || (!optimistic && local[start].kind!=='clear')) return found;
    const queue=[start];found.add(start);
    for(let head=0;head<queue.length;head++) {
      const current=queue[head], offset=current%(nx*ny), ix=offset%nx,iy=Math.floor(offset/nx);
      const neighbors=[...(ix>0?[current-1]:[]),...(ix<nx-1?[current+1]:[]),...(iy>0?[current-nx]:[]),...(iy<ny-1?[current+nx]:[])];
      if (optimistic) for (const dx of [-1,1]) for(const dy of [-1,1]) if(ix+dx>=0 && ix+dx<nx && iy+dy>=0 && iy+dy<ny) neighbors.push(current+dy*nx+dx);
      for(const next of neighbors) {
        if(found.has(next)||local[next].kind==='blocked'||(!optimistic&&local[next].kind!=='clear')) continue;
        // This graph deliberately overestimates connectivity: a failed sampled sweep
        // cannot prove that every continuous path inside these tiles is blocked.
        const edge=optimistic?clear:connection(current,next);
        if(edge.kind==='blocked'||(!optimistic&&edge.kind!=='clear')) continue;
        if (!optimistic) parents.set(next, current);
        found.add(next);queue.push(next);
      }
    }
    return found;
  }
  const reached=flood(false), possible=flood(true);
  cells.forEach((cell,i)=> {
    if(local[i].kind==='blocked') cell.status='blocked';
    else if(unsupported.length) { cell.status='unknown';cell.reason='Selected movement requirements include unsupported checks.'; }
    else if(reached.has(i)) { cell.status='reachable';cell.reason=clear.reason; }
    else if(possible.has(i)||local[i].kind==='unknown') { cell.status='unknown'; if(local[i].kind==='clear')cell.reason='Connection from the start depends on unresolved support or clearance.'; }
    else {cell.status='blocked';cell.reason='No connection from the start under the evaluated square envelope.';}
  });
  const destinations=scene.destinations.map(destination=> {
    const i=locate(destination), cell=cells[i];
    const exact=check(sweep(square(destination.x,destination.y,radius),square(cell.x,cell.y,radius)),sweep(square(destination.x,destination.y,radius),square(cell.x,cell.y,radius+step/2)),cell.elevation);
    const atPoint=check(square(destination.x,destination.y,radius),square(destination.x,destination.y,radius),cell.elevation);
    const status=atPoint.kind==='blocked'?'blocked':cell.status==='reachable'&&exact.kind!=='clear'?'unknown':cell.status;
    return {id:destination.id,label:destination.label,status,reason:exact.kind!=='clear'?exact.reason:cell.reason};
  });
  const bindings = { sceneHash: contentHash(base), profileHash: contentHash(profile), scenarioHash: contentHash(scenario?.operations.length ? scenario : null), solverHash: SOLVER_HASH };
  const traversals = destinations.map((destination, index) => certifiedTraversal({
    ...bindings, destinationId: destination.id, status: destination.status, reason: destination.reason,
    unsupported: unsupported.length > 0, start: { ...scene.start, elevation: sc.elevation },
    destination: { ...scene.destinations[index], elevation: cells[locate(scene.destinations[index])].elevation },
    startIndex: start, destinationIndex: locate(scene.destinations[index]), cells, reached, parents,
  }));
  const area=(status: Cell['status'])=> Number((cells.filter(c=>c.status===status).reduce((sum,c)=>sum+Math.max(0,Math.min(c.x+step/2,scene.bounds.maxX)-Math.max(c.x-step/2,scene.bounds.minX))*Math.max(0,Math.min(c.y+step/2,scene.bounds.maxY)-Math.max(c.y-step/2,scene.bounds.minY)),0)).toFixed(8));
  return {
    schemaVersion: SCHEMA_VERSION, sceneHash: contentHash(base), profileHash: contentHash(profile),
    scenarioHash: contentHash(scenario?.operations.length ? scenario : null), solverHash: SOLVER_HASH,
    traversals, cells, destinations,
    reachableArea: area('reachable'), blockedArea: area('blocked'), unknownArea: area('unknown'), cellSize: step,
    unsupported, hypothetical: Boolean(scenario?.operations.length),
    assumptions: [
      ...scene.assumptions,
      'Only fixed-axis square translations on coplanar horizontal support are evaluated; no rotations, vertical transitions or biomechanical claims.',
      'Each reachable cell certifies its full tile using an extra half-cell envelope margin; four-neighbour paths use continuous swept rectangles.',
      'Areas count clipped assessed tiles per elevation, not visitor capacity or total physical floor area. Unknown includes discretization and measurement margins.',
      'A grid-row alignment penalty adds up to another half-cell on each side; a straight passage may need width plus twice the cell size for a guaranteed grid certificate. Geometry comparisons use a 1e-9 m numerical tolerance.'
    ]
  };
}
