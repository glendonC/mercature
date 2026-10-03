import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { solveScene } from '../../src/spatial/solver';
import { appendOperation, applyScenario, createScenario, parseProject, serializeProject, undoScenario } from '../../src/spatial/scenario';
import { DEFAULT_PROFILE, SYNTHETIC_SCENE, BENCH_CLEAR_POSITION } from '../../src/spatial/fixtures';
import { contentHash, covered, validateProfile, validateScene } from '../../src/spatial/validation';
import type { Profile, Scene } from '../../src/spatial/contracts';

const profile = (changes: Partial<Profile> = {}): Profile => ({ ...structuredClone(DEFAULT_PROFILE), ...changes });
const status = (scene: Scene, p = profile()) => solveScene(scene, p).destinations[0].status;
/** Independent analytic control: straight known floor, width w, axis square requires w >= .9. */
function corridor(width: number, uncertainty = 0): Scene {
  const scene = structuredClone(SYNTHETIC_SCENE);
  scene.bounds = { minX: 0, minY: -1, maxX: 6, maxY: width+1 };
  scene.supports = [{ ...scene.supports[0], bounds: { ...scene.bounds }, uncertainty }];
  scene.obstacles=[
    {...structuredClone(SYNTHETIC_SCENE.obstacles[0]),id:'wall-below',bounds:{minX:0,minY:-1,maxX:6,maxY:0},uncertainty},
    {...structuredClone(SYNTHETIC_SCENE.obstacles[0]),id:'wall-above',bounds:{minX:0,minY:width,maxX:6,maxY:width+1},uncertainty},
  ];scene.unknown=[];
  scene.start={x:1,y:width/2,supportId:'courtyard'};
  scene.destinations=[{id:'end',label:'Far end',x:5,y:width/2,supportId:'courtyard'}];
  return scene;
}
function openRoom(): Scene {
  const scene=corridor(4);scene.bounds={minX:0,minY:0,maxX:6,maxY:4};scene.supports[0].bounds={...scene.bounds};scene.obstacles=[];return scene;
}

test('canonical SHA-256 matches independent platform oracle including Unicode', () => {
  for(const value of [null, 'café 🦽', {b:2,a:['floor',.9]}, Array.from({length:300},(_,i)=>i)]) {
    const sorted= value && typeof value==='object' && !Array.isArray(value)?{a:['floor',.9],b:2}:value;
    expect(contentHash(value)).toBe(`sha256:${createHash('sha256').update(JSON.stringify(sorted)).digest('hex')}`);
  }
  expect(contentHash({b:2,a:1})).toBe(contentHash({a:1,b:2}));
});

for (const cellSize of [.05,.1,.2]) {
  test(`analytic passage controls at ${cellSize} m resolution`, () => {
    expect(status(corridor(.8),profile({cellSize}))).toBe('blocked');
    // At .2 m cells this corridor falls between grid rows: retain conservative unknown.
    expect(status(corridor(1.2),profile({cellSize}))).toBe(cellSize === .2 ? 'unknown' : 'reachable');
    if(cellSize === .2) expect(status(corridor(1.4),profile({cellSize}))).toBe('reachable');
    expect(status(corridor(.9),profile({cellSize}))).not.toBe('reachable');
    expect(status(corridor(.9-1e-5),profile({cellSize}))).not.toBe('reachable');
    expect(status(corridor(.9+1e-5),profile({cellSize}))).not.toBe('reachable');
    expect(status(corridor(1,.1),profile({cellSize}))).toBe('unknown');
  });
}

test('analytic fixture clearance changes via geometry and baseline remains byte-identical', () => {
  const scene=structuredClone(SYNTHETIC_SCENE), p=profile(); const bytes=JSON.stringify(scene);
  expect(5-4.2).toBeCloseTo(.8);
  expect(status(scene,p)).toBe('blocked');
  const scenario=appendOperation(scene,p,createScenario(scene,p),{kind:'move',objectId:'bench',to:BENCH_CLEAR_POSITION});
  const result=solveScene(scene,p,scenario);
  expect(result.destinations[0].status).toBe('reachable');
  expect(result.reachableArea).toBeGreaterThan(solveScene(scene,p).reachableArea);
  expect(JSON.stringify(scene)).toBe(bytes);
  expect(solveScene(scene,p,scenario)).toEqual(result);
  expect(solveScene(scene,profile({width:.5})).destinations[0].status).toBe('reachable');
});

test('a move can reduce reachability and irrelevant movement leaves the destination unchanged', () => {
  const scene=structuredClone(SYNTHETIC_SCENE),p=profile();
  scene.obstacles.find(o=>o.id==='bench')!.bounds={minX:2,minY:1,maxX:2.7,maxY:2.2};
  expect(status(scene,p)).toBe('reachable');
  const bad=appendOperation(scene,p,createScenario(scene,p),{kind:'move',objectId:'bench',to:{x:5.4,y:3}});
  expect(solveScene(scene,p,bad).destinations[0].status).toBe('blocked');
  const irrelevant=appendOperation(scene,p,createScenario(scene,p),{kind:'move',objectId:'bench',to:{x:3,y:1}});
  expect(solveScene(scene,p,irrelevant).destinations[0].status).toBe('reachable');
});

test('unknown floor survives removal and uncertainty propagates to downstream destination', () => {
  const scene=structuredClone(SYNTHETIC_SCENE),p=profile();
  // Full aperture floor is unknown, not the visible bench occupancy.
  scene.unknown.push({id:'under-bench',label:'Unobserved threshold',bounds:{minX:5.3,minY:3,maxX:6.2,maxY:5},elevation:0,reason:'Occluded floor'});
  const scenario=appendOperation(scene,p,createScenario(scene,p),{kind:'remove',objectId:'bench'});
  expect(solveScene(scene,p,scenario).destinations[0].status).toBe('unknown');
  expect(applyScenario(scene,p,scenario).unknown).toEqual(scene.unknown);
});

test('unsupported gap and disconnected island never become reachable', () => {
  const scene=openRoom();
  scene.supports[0].bounds.maxX=2;
  scene.supports.push({...structuredClone(scene.supports[0]),id:'island',bounds:{minX:4,minY:0,maxX:6,maxY:4}});
  scene.destinations[0].supportId='island';
  expect(status(scene)).toBe('unknown');
  // A narrow gap between centres cannot be bridged by floor-centre sampling.
  scene.supports[0].bounds.maxX=2.999;
  scene.supports[1].bounds.minX=3.001;
  expect(status(scene)).toBe('unknown');
});

test('continuous sweeps preserve arbitrarily thin barriers and no diagonal corner cutting', () => {
  const scene=openRoom();
  scene.obstacles=[{...structuredClone(SYNTHETIC_SCENE.obstacles[0]),id:'thin',bounds:{minX:2.991,minY:0,maxX:2.992,maxY:4}}];
  for(const cellSize of [.05,.1,.2]) expect(status(scene,profile({cellSize}))).toBe('blocked');
  scene.obstacles=[
    {...scene.obstacles[0],id:'diagonal-a',bounds:{minX:2,minY:0,maxX:3,maxY:2}},
    {...scene.obstacles[0],id:'diagonal-b',bounds:{minX:3,minY:2,maxX:4,maxY:4}},
  ];
  expect(status(scene)).toBe('blocked');
});

test('a supported centre is insufficient if its footprint crosses missing ground', () => {
  const scene=corridor(2);
  scene.unknown=[{id:'strip',label:'Unknown strip',bounds:{minX:2.9,minY:1.1,maxX:3.1,maxY:2},elevation:0,reason:'Missing coverage'}];
  scene.supports[0].bounds.minY=.9;
  scene.start.y=1;scene.destinations[0].y=1;
  expect(status(scene)).toBe('unknown');
});

test('stacked levels never invent a vertical connection; zero-step never climbs', () => {
  const scene=openRoom();
  scene.supports.push({...structuredClone(scene.supports[0]),id:'upper',elevation:3});
  scene.destinations[0].supportId='upper';
  expect(status(scene)).toBe('blocked');
  scene.supports[0].bounds.maxX=3;
  scene.supports[1].bounds.minX=3;scene.supports[1].elevation=.02;
  expect(status(scene)).not.toBe('reachable');
  const result=solveScene(scene,profile({maxStep:.05}));
  expect(result.unsupported.join(' ')).toContain('Positive step');
  expect(result.destinations[0].status).toBe('unknown');
});

test('headroom threshold is analytic, including uncertainty and stacked ceiling', () => {
  const scene=openRoom();
  scene.obstacles=[{...structuredClone(SYNTHETIC_SCENE.obstacles[0]),id:'overhang',bounds:{minX:2,minY:0,maxX:4,maxY:4},bottom:1.79,top:2.2}];
  expect(status(scene)).toBe('blocked');
  scene.obstacles[0].bottom=1.8;
  expect(status(scene)).toBe('reachable');
  scene.obstacles[0].bottom=1.81;
  expect(status(scene)).toBe('reachable');
  scene.obstacles[0].uncertainty=.02;
  expect(status(scene)).toBe('unknown');
  scene.obstacles=[];scene.supports.push({...structuredClone(scene.supports[0]),id:'ceiling',elevation:1.7});
  expect(status(scene)).toBe('blocked');
});

test('every requested unsupported requirement prevents an unqualified positive result', () => {
  for(const requirement of ['turning','longitudinalSlope','crossSlope','multilevel'] as const) {
    const p=profile();p.requirements[requirement]=true;
    const result=solveScene(openRoom(),p);
    expect(result.unsupported.join(' ')).toContain(requirement);
    expect(result.destinations[0].status).toBe('unknown');
    expect(result.reachableArea).toBe(0);
  }
});

test('translation of authored geometry preserves classification', () => {
  const scene=corridor(1.2), shifted=structuredClone(scene),dx=13.137,dy=-27.219;
  shifted.bounds={minX:scene.bounds.minX+dx,maxX:scene.bounds.maxX+dx,minY:scene.bounds.minY+dy,maxY:scene.bounds.maxY+dy};
  shifted.supports[0].bounds={...shifted.bounds};shifted.start.x+=dx;shifted.start.y+=dy;
  shifted.obstacles.forEach(o=>{o.bounds={minX:o.bounds.minX+dx,minY:o.bounds.minY+dy,maxX:o.bounds.maxX+dx,maxY:o.bounds.maxY+dy};});
  shifted.destinations.forEach(d=>{d.x+=dx;d.y+=dy;});
  expect(status(shifted)).toBe(status(scene));
});

test('invalid and unreviewed placements are rejected', () => {
  const scene=structuredClone(SYNTHETIC_SCENE),p=profile(),scenario=createScenario(scene,p);
  for(const to of [{x:-1,y:0},{x:5.5,y:1},{x:9,y:5}]) expect(()=>appendOperation(scene,p,scenario,{kind:'move',objectId:'bench',to})).toThrow();
  expect(()=>appendOperation(scene,p,scenario,{kind:'remove',objectId:'wall-south'})).toThrow(/reviewed movable/);
  scene.obstacles.find(o=>o.id==='bench')!.reviewed=false;
  expect(()=>appendOperation(scene,p,createScenario(scene,p),{kind:'remove',objectId:'bench'})).toThrow(/reviewed movable/);
});

test('undo, reopen, revision bindings and corrupted projects preserve invariants', () => {
  const scene=structuredClone(SYNTHETIC_SCENE),p=profile(),initial=createScenario(scene,p);
  const edited=appendOperation(scene,p,initial,{kind:'remove',objectId:'bench'});
  expect(applyScenario(scene,p,undoScenario(edited))).toEqual(scene);
  expect(solveScene(scene,p,undoScenario(edited))).toEqual(solveScene(scene,p));
  const loaded=parseProject(serializeProject(scene,p,edited));
  expect(loaded.scenario.hypothetical).toBe(true);
  expect(solveScene(loaded.scene,loaded.profile,loaded.scenario)).toEqual(solveScene(scene,p,edited));
  expect(()=>applyScenario({...scene,revision:2},p,edited)).toThrow(/Stale/);
  expect(()=>applyScenario(scene,{...p,width:1},edited)).toThrow(/Stale/);
  expect(()=>applyScenario(scene,p,{...edited,solverHash:'other'})).toThrow(/Stale/);
  const tampered=JSON.parse(serializeProject(scene,p,edited));tampered.scene.obstacles[0].bounds.maxX+=.01;
  expect(()=>parseProject(JSON.stringify(tampered))).toThrow(/Stale/);
  tampered.schemaVersion='spatial-v2';expect(()=>parseProject(JSON.stringify(tampered))).toThrow(/schema/);
});

test('input validation rejects malformed geometry and bounds computational cost', () => {
  const scene=structuredClone(SYNTHETIC_SCENE);
  expect(()=>validateProfile(profile({width:NaN}))).toThrow();
  expect(()=>validateProfile(profile({cellSize:0}))).toThrow();
  scene.supports.push({...scene.supports[0]});expect(()=>validateScene(scene)).toThrow(/unique/);
  const huge=structuredClone(SYNTHETIC_SCENE);huge.bounds.maxX=1000;huge.bounds.maxY=1000;
  expect(()=>solveScene(huge,profile())).toThrow(/budget|cells/);
  const malformed=JSON.parse(serializeProject(SYNTHETIC_SCENE,profile(),createScenario(SYNTHETIC_SCENE,profile())));
  malformed.profile.requirements.turning='false';expect(()=>parseProject(JSON.stringify(malformed))).toThrow(/explicit/);
});

test('rectangle union oracle catches seams and thin holes independently of grid', () => {
  const rect={minX:0,minY:0,maxX:2,maxY:2};
  expect(covered(rect,[{...rect,maxX:1},{...rect,minX:1}])).toBe(true);
  expect(covered(rect,[{...rect,maxX:.999},{...rect,minX:1}])).toBe(false);
});


test('off-grid viable aperture remains unresolved rather than falsely blocked', () => {
  const scene=openRoom();scene.bounds={minX:0,minY:0,maxX:10,maxY:6};scene.supports[0].bounds={...scene.bounds};
  scene.start={x:2,y:2.575,supportId:'courtyard'};scene.destinations[0]={...scene.destinations[0],x:8,y:2.575};
  scene.obstacles=[{...structuredClone(SYNTHETIC_SCENE.obstacles[0]),id:'lower',bounds:{minX:4,minY:0,maxX:4.5,maxY:2.1}}, {...structuredClone(SYNTHETIC_SCENE.obstacles[0]),id:'upper',bounds:{minX:4,minY:3.05,maxX:4.5,maxY:6}}];
  expect(3.05-2.1).toBeCloseTo(.95); // straight y=2.575 is analytically feasible for .9 square
  expect(status(scene,profile({cellSize:.2}))).toBe('unknown');
  scene.start.x=4.2;expect(status(scene,profile({cellSize:.2}))).toBe('unknown');
});

test('area denominator clips fractional boundary tiles', () => {
  const scene=corridor(6.01);scene.bounds={minX:0,minY:0,maxX:10.01,maxY:6.01};scene.supports[0].bounds={...scene.bounds};scene.obstacles=[];
  const result=solveScene(scene,profile());
  expect(result.reachableArea+result.blockedArea+result.unknownArea).toBeCloseTo(10.01*6.01,7);
});

test('placement accounts for uncertain overhead footprint', () => {
  const scene=structuredClone(SYNTHETIC_SCENE),p=profile();
  scene.supports.push({...structuredClone(scene.supports[0]),id:'roof',bounds:{minX:2.8,minY:1,maxX:3.8,maxY:2.2},elevation:.5,uncertainty:.2});
  expect(()=>appendOperation(scene,p,createScenario(scene,p),{kind:'move',objectId:'bench',to:{x:2,y:1}})).toThrow(/overhead/);
});


test('assessment boundary is unknown rather than an invented physical wall', () => {
  const scene=openRoom();scene.obstacles=[];scene.destinations[0].x=.1;
  expect(status(scene)).toBe('unknown');
});


test('destination identities cannot alias selected scene features or other destinations', () => {
  for (const id of ['bench', 'courtyard', 'occluded-corner']) {
    const scene = structuredClone(SYNTHETIC_SCENE);
    scene.destinations[0].id = id;
    expect(() => validateScene(scene)).toThrow(/IDs must be unique/);
  }
  const scene = structuredClone(SYNTHETIC_SCENE);
  scene.destinations.push({ ...scene.destinations[0] });
  expect(() => validateScene(scene)).toThrow(/IDs must be unique/);
});
