import { useRef, useState } from 'react';
import Home, {type SavedEntry} from './home/Home';
import PlaceWorkspace from './places/PlaceWorkspace';
import Workspace from './workspace/Workspace';
import { createPlace, listPlaces, savePlace, type Place } from './places/store';
import { createPlanStore, parsePlan, type ImprovementPlan, type PlanSummary } from './plans';
import { parseProject } from './spatial/scenario';
import { solveScene } from './spatial/solver';
import type {Project} from './spatial/contracts';
const planStore=createPlanStore();
function initialSaved(){try{const plans=planStore.list();return {places:listPlaces(),plans:plans.ok?plans.value:[],error:plans.ok?'':plans.error.message};}catch(e){return {places:[],plans:[],error:(e as Error).message};}}
export default function App() {
  const [initial]=useState(initialSaved);
  const [active,setActive]=useState<'home'|'place'|'spatial'>('home');
  const [place,setPlace]=useState<Place|null>(null);const [places,setPlaces]=useState<Place[]>(initial.places);const [plans,setPlans]=useState<PlanSummary[]>(initial.plans);
  const [workspace,setWorkspace]=useState<{key:string;plan?:ImprovementPlan;project?:Project}|null>(null);
  const [error,setError]=useState(initial.error);const [loading,setLoading]=useState(false);const picker=useRef<HTMLInputElement>(null);
  function refresh(){setPlaces(listPlaces());const result=planStore.list();if(!result.ok)throw new Error(result.error.message);setPlans(result.value);}
  function open(name:string){try{const next=places.find(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase())??createPlace(name);savePlace(next);setPlaces(listPlaces());setPlace(next);setActive('place');setError('');}catch(e){setError((e as Error).message);}}
  function saved(entry:SavedEntry){try{if(entry.kind==='place'){const next=places.find(p=>p.id===entry.id);if(!next)throw new Error('This place could not be found.');setPlace(next);setActive('place');}else{const result=planStore.load(entry.id);if(!result.ok)throw new Error(result.error.message);setWorkspace({key:crypto.randomUUID(),plan:result.value});setActive('spatial');}setError('');}catch(e){setError((e as Error).message);}}
  async function importFile(file:File|undefined){if(!file)return;setLoading(true);setError('');try{if(file.size>2000000)throw new Error('Use a Mercature JSON plan or spatial project under 2 MB.');const text=await file.text();const value=JSON.parse(text);if(value.schemaVersion==='mercature-plan-v1'){const plan=parsePlan(text);setWorkspace({key:crypto.randomUUID(),plan});}else{const project=parseProject(text);solveScene(project.scene,project.profile);solveScene(project.scene,project.profile,project.scenario);setWorkspace({key:crypto.randomUUID(),project});}setActive('spatial');}catch(e){setError(`Could not open this file: ${(e as Error).message}`);}finally{setLoading(false);if(picker.current)picker.current.value='';}}
  const entries:SavedEntry[]=[...plans.map(p=>({id:p.id,title:p.title,kind:'plan' as const})),...places.map(p=>({id:p.id,title:p.name,kind:'place' as const}))];
  return <><div hidden={active!=='home'}>{active==='home'&&<Home onOpen={open} onExample={()=>{if(!workspace)setWorkspace({key:crypto.randomUUID()});setActive('spatial');}} onImport={()=>picker.current?.click()} saved={entries} onOpenSaved={saved}/>}</div>
    {place&&<div hidden={active!=='place'}><PlaceWorkspace key={place.id} initial={place} onHome={()=>setActive('home')} onSaved={()=>refresh()}/></div>}
    {workspace&&<div hidden={active!=='spatial'}><Workspace key={workspace.key} initialPlan={workspace.plan} initialProject={workspace.project} onHome={()=>setActive('home')} onSave={plan=>{const result=planStore.save(plan);if(!result.ok)throw new Error(result.error.message);refresh();}}/></div>}
    <input type="file" hidden ref={picker} accept=".json,application/json" onChange={e=>void importFile(e.target.files?.[0])}/>
    {loading&&<div className="loading-dialog" role="status"><span className="loading-ring"/>Verifying project and recomputing its comparison…</div>}
    {error&&<div className="app-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}</>;
}
