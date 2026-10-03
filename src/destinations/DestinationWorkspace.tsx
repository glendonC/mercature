import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction, PointerEvent } from 'react';
import Companion from '../components/Companion';
import { Preparation } from '../preparation/Preparation';
import { DESTINATIONS, decodeCloud, fetchLocal, isDestinationId, loadDestination, localAsset, type Cloud, type Destination, type DestinationId, type View } from './data';
import GeographicMap from './GeographicMap';
import './destinations.css';
/** initial: records already read and replayed, so the inspection opens directly on the same map. */
export type DestinationWorkspaceProps = { id: string; onHome: () => void; initial?: Destination };
export default function DestinationWorkspace({id,onHome,initial}: DestinationWorkspaceProps) { return isDestinationId(id) ? <Session key={id} id={id} onHome={onHome} initial={initial?.id === id ? initial : undefined}/> : <main className="destination-loading"><p>This prepared destination is not in the local catalogue.</p><button onClick={onHome}>Home</button></main>; }
function Session({ id, onHome, initial }: {id:DestinationId;onHome:()=>void;initial?:Destination}) {
  const [mapZoom, setMapZoom] = useState(1), [camera, setCamera] = useState({yaw:.55,pitch:.45,zoom:1});
  const [preparing, setPreparing] = useState(!initial), [preparationStage, setPreparationStage] = useState<'views' | 'scene'>('views'), [rendered, setRendered] = useState(false);
  const [data, setData] = useState<Destination | null>(initial ?? null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(initial?.views[0]?.id ?? ''), [view, setView] = useState<'map' | '3d' | 'split'>('map');
  const [pieceId, setPieceId] = useState(() => initial ? initial.pieces.find(p => p.views.includes(initial.views[0]?.id))?.id ?? initial.pieces[0]?.id ?? '' : ''), [cloud, setCloud] = useState<Cloud | null>(null), [cloudError, setCloudError] = useState(''), [cloudBusy, setCloudBusy] = useState(false);
  const [imageError, setImageError] = useState(false), [showOutlines, setShowOutlines] = useState(false);
  const evidence = useRef<HTMLDialogElement>(null), credits = useRef<HTMLDialogElement>(null), evidenceTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (initial && retry === 0) return; const controller = new AbortController(); setError(''); setData(null); loadDestination(id, controller.signal).then(next => { setData(next); setSelected(next.views[0]?.id ?? ''); setPieceId(next.pieces.find(p => p.views.includes(next.views[0]?.id))?.id ?? next.pieces[0]?.id ?? ''); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'This destination could not be opened.'); }); return () => controller.abort(); }, [id, retry]);
  const source = data?.views.find(v => v.id === selected), photo = data?.photos.find(p => p.id === source?.photoId);
  const piece = data?.pieces.find(p => p.id === pieceId);
  useEffect(() => { setRendered(false); }, [pieceId]);
  useEffect(() => { setImageError(false); }, [selected]);
  useEffect(() => {
    if (!piece || view === 'map') { setCloudBusy(false); return; }
    if (cloud?.spot === piece.id) return;
    const controller = new AbortController(); setCloud(null); setCloudError(''); setCloudBusy(true);
    fetchLocal(id, piece.file, 12000000, controller.signal).then(bytes => decodeCloud(bytes, piece)).then(next => { if (!controller.signal.aborted) { setCloud(next); setCloudBusy(false); } }).catch(e => { if (!controller.signal.aborted) { setCloudError(e instanceof Error ? e.message : 'Reconstruction could not be read.'); setCloudBusy(false); } });
    return () => controller.abort();
  }, [id, piece, view]);
  function select(viewId: string) { setSelected(viewId); const matching = data?.pieces.find(p => p.views.includes(viewId)); if (matching) setPieceId(matching.id); }
  const findings = data?.findings.filter(f => f.viewId === selected) ?? [];
  const hasGeometry = !!data?.pieces.length;
  const cameraCount = new Set(data?.views.map(v => v.photoId)).size;
  const previewViews = data?.views.slice(0, 6) ?? [];
  if (source && !previewViews.some(view => view.id === source.id)) previewViews.splice(5, 1, source);
  if (preparing) {
    const atScene = preparationStage === 'scene';
    const failed = error || cloudError;
    const busy = !failed && (!data || (atScene && hasGeometry && (cloudBusy || !cloud || !rendered)));
    const ready = !!data && (!hasGeometry || (!!cloud && rendered));
    return <Preparation title={DESTINATIONS[id].name} provenance="Recorded preparation" stage={preparationStage} busy={busy}
      message={failed ? 'This view needs attention.' : !data ? 'Opening the source records…' : !atScene ? 'The recorded views are here.' : !hasGeometry ? 'Explore the photographs.' : busy ? 'Opening the retained scene…' : 'Your scene is ready.'}
      detail={!data ? undefined : !atScene ? 'Choose a camera or view, then open the scene.' : !hasGeometry ? 'This capture has no usable 3D reconstruction.' : !busy ? 'Partial reconstruction from the recorded capture.' : undefined}
      error={failed} onHome={onHome} onSkip={() => { setPreparing(false); if (!cloud) setView('map'); }}
      action={error ? 'Try again' : cloudError ? 'Explore photos' : !data ? undefined : !atScene ? (hasGeometry ? 'Load scene' : 'Continue') : ready ? 'Enter scene' : undefined}
      onAction={() => { if (error) setRetry(r => r + 1); else if (cloudError) { setPreparing(false); setView('map'); } else if (!atScene) { setPreparationStage('scene'); if (hasGeometry) setView('3d'); } else setPreparing(false); }}>
      {data ? atScene && hasGeometry ? cloud && !cloudError ? <PointCloud orbit={camera} setOrbit={setCamera} cloud={cloud} selectedView={selected} onReady={() => setRendered(true)} onFailure={setCloudError}/> : <div className="preparation-empty"><p>{cloudError || 'Reading the retained points…'}</p></div> : <>
        <GeographicMap zoom={mapZoom} setZoom={setMapZoom} data={data} selected={selected} onSelect={select} hidden={false}/>
        <span className="preparation-source-count">{data.views.length} view{data.views.length === 1 ? '' : 's'} · {cameraCount} camera{cameraCount === 1 ? '' : 's'}</span>
        <div className="preparation-capture-strip" aria-label="Preview source views">{previewViews.map((item) => <SourcePreview key={item.id} id={id} view={item} index={data.views.indexOf(item)} selected={selected === item.id} onSelect={() => select(item.id)}/>)}</div>
      </> : <div className="preparation-empty"><svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="m8 16 16-6 16 8 16-6v38l-16 6-16-8-16 6zM24 10v38m16-30v38" stroke="currentColor" strokeWidth="1.3"/></svg></div>}
    </Preparation>;
  }
  return <main className="destination-workspace">
    <header className="destination-header"><button onClick={onHome} aria-label="Home">←</button><div><h1>{DESTINATIONS[id].name}</h1><span>{DESTINATIONS[id].place} · Local prepared capture</span></div><button onClick={() => credits.current?.showModal()}>Sources</button></header>
    {!data ? <section className="destination-loading" aria-live="polite"><Companion working={!error}>{error || 'Reading the prepared route and its source records…'}</Companion>{error && <button onClick={() => setRetry(r => r + 1)}>Try again</button>}</section> : <>
      <div className="destination-tools"><div className="segmented" aria-label="Destination view">{(['map', '3d', 'split'] as const).map(mode => <button key={mode} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'map' ? 'Map' : mode === '3d' ? '3D' : 'Split'}</button>)}</div><span className="destination-scope">{view === 'map' ? 'Recorded route and cameras' : hasGeometry ? 'Partial reconstruction' : 'Photos only · no reconstruction'}</span><button ref={evidenceTrigger} onClick={() => evidence.current?.showModal()} disabled={!source}>Photo evidence</button></div>
      <div className={`destination-scene ${view === 'split' ? 'destination-split' : ''}`}>
        <GeographicMap zoom={mapZoom} setZoom={setMapZoom} data={data} selected={selected} onSelect={select} hidden={view === '3d'}/>
        <section className="destination-cloud" hidden={view === 'map'} aria-label="Prepared 3D reconstruction">
          {!hasGeometry ? <div className="destination-empty"><span aria-hidden="true">◇</span><h2>No retained 3D at this destination</h2><p>The map and retained source views remain available. Photos do not establish measured access geometry.</p><button onClick={() => setView('map')}>Return to map</button></div> : <>
            <label className="destination-piece-choice"><span className="destination-sr-only">Reconstruction area</span><select value={pieceId} onChange={e => setPieceId(e.target.value)}>{data.pieces.map((p, index) => <option key={p.id} value={p.id}>Capture area {index + 1}</option>)}</select></label>
            {cloudBusy ? <div className="destination-empty" role="status"><Companion working>Reading the retained 3D points…</Companion></div> : cloudError ? <div className="destination-empty" role="alert"><p>{cloudError}</p><button onClick={() => {setCloudError(''); setCloud(null); setView('map');}}>Use map and photographs</button></div> : cloud && piece && <PointCloud orbit={camera} setOrbit={setCamera} cloud={cloud} selectedView={selected}/>}
          </>}
        </section>
      </div>
      <section className="destination-evidence-rail" aria-label="Source photographs">{data.views.length ? data.views.map((item, index) => <button key={item.id} className={selected === item.id ? 'is-selected' : ''} aria-pressed={selected === item.id} aria-label={`Select photograph ${index + 1}`} onClick={() => select(item.id)}><img loading="lazy" src={localAsset(id, item.file)} alt="" onError={e => {e.currentTarget.style.visibility = 'hidden';}}/><span>{index + 1}</span></button>) : <p>No retained source images are available.</p>}</section>
      <div className="destination-selected"><button disabled={!source} onClick={() => evidence.current?.showModal()}>{photo ? `Photo ${data.views.findIndex(v => v.id === selected) + 1} · ${photo.creator}` : 'Select a source photograph'} <span aria-hidden="true">↗</span></button><span>{photo?.capturedAt?.slice(0, 10)}{photo ? ` · ${photo.licence}` : ''}</span></div>
      <div className="destination-guide"><Companion tone="evidence">{view === 'map' ? 'Choose a camera or photograph to inspect its evidence.' : cloudBusy ? 'The retained reconstruction is loading from this device.' : hasGeometry ? 'These partial points help inspect the capture. They are not an accepted access model.' : 'This place has photographs and a recorded map. Its 3D geometry is unavailable.'}</Companion></div>
    </>}
    <dialog ref={evidence} className="destination-dialog destination-photo-dialog" aria-label="Photo evidence" onClose={() => evidenceTrigger.current?.focus()}><header><h2>Photo evidence</h2><button autoFocus aria-label="Close photo evidence" onClick={() => evidence.current?.close()}>×</button></header>{source && photo && <>
      <div className="destination-photo" style={{aspectRatio:`${source.width}/${source.height}`}}>{imageError ? <p role="alert">This source image is unavailable on this device.</p> : <img key={source.id} src={localAsset(id, source.file)} alt={`Recorded view of ${DESTINATIONS[id].name} by ${photo.creator}`} onError={() => setImageError(true)}/>}{showOutlines && !imageError && <svg viewBox={`0 0 ${source.width} ${source.height}`} aria-label="Recorded unverified detection outlines">{findings.filter(f => f.outline.length > 2).map(f => <polygon key={f.id} points={f.outline.map(p => p.join(',')).join(' ')} fill="#e2c07425" stroke="#f5cf76" strokeWidth="3"><title>{f.label} · {f.verified ? 'Recorded as reviewed' : 'Unverified model suggestion'}</title></polygon>)}</svg>}</div>
      <div className="destination-photo-notes"><p>{photo.creator} · {photo.capturedAt?.slice(0, 10) ?? 'Capture date unknown'} · {photo.licence}{photo.link && <> · <a href={photo.link} target="_blank" rel="noreferrer">Original source</a></>}</p>{findings.length > 0 && <><button aria-pressed={showOutlines} onClick={() => setShowOutlines(v => !v)}>Recorded observations</button>{showOutlines && <ul>{findings.map(f => <li key={f.id}>{f.label} · {f.verified ? 'Recorded as reviewed' : 'Unverified suggestion'}</li>)}</ul>}</>}<p>Local-only source. Stored observations and reconstruction are not fresh inference, independent measurements or a passage verdict.</p></div>
    </>}</dialog>
    <dialog ref={credits} className="destination-dialog" aria-label="Prepared source credits"><header><h2>Prepared sources</h2><button autoFocus aria-label="Close source credits" onClick={() => credits.current?.close()}>×</button></header><p>These retained route files and photographs stay on this Mac. This viewer makes no external data requests.</p>{data?.sources.map(source => <p key={source.name}><strong>{source.name}</strong><br/>{source.credit} · {source.licence}{source.link && <> · <a href={source.link} target="_blank" rel="noreferrer">Source</a></>}</p>)}{cloud && <p>The current area contains {cloud.points.toLocaleString()} retained points. A deterministic sample of {Math.ceil(cloud.points / Math.max(1, Math.ceil(cloud.points / 45000))).toLocaleString()} points is displayed to bound device work; the original coordinates and colours are preserved.</p>}<p>Reconstruction covers selected capture areas only. No measured-site access model has been accepted.</p></dialog>
  </main>;
}

function PointCloud({cloud, selectedView, onReady, onFailure, orbit, setOrbit}: {cloud: Cloud; selectedView: string; onReady?: () => void; onFailure?: (error: string) => void; orbit: {yaw:number;pitch:number;zoom:number}; setOrbit: Dispatch<SetStateAction<{yaw:number;pitch:number;zoom:number}>>}) {
  const readyCallback = useRef(onReady), failureCallback = useRef(onFailure); readyCallback.current = onReady; failureCallback.current = onFailure;
  const canvas = useRef<HTMLCanvasElement>(null), drag = useRef<{x:number;y:number}|null>(null);
  const [canvasError,setCanvasError] = useState('');
  const sample = useMemo(() => {const stride = Math.max(1, Math.ceil(cloud.points / 45000)), points: {x:number;y:number;z:number;r:number;g:number;b:number;view:number}[]=[]; for(let i=0;i<cloud.points;i+=stride) points.push({x:cloud.positions[i*3],y:cloud.positions[i*3+1],z:cloud.positions[i*3+2],r:cloud.colours[i*3],g:cloud.colours[i*3+1],b:cloud.colours[i*3+2],view:cloud.view[i]});return points;},[cloud]);
  const bounds = useMemo(() => { const axis=(key:'x'|'y'|'z')=>{const values=sample.map(p=>p[key]).sort((a,b)=>a-b);return [values[0],values.at(-1)!];};return {x:axis('x'),y:axis('y'),z:axis('z')}; },[sample]);
  const selectedIndex=cloud.views.indexOf(selectedView), linked=sample.some(p=>p.view===selectedIndex);
  useEffect(() => {
    const element=canvas.current;if(!element)return;const ctx=element.getContext('2d');if(!ctx){const message = 'This browser cannot display the point view. The map and photographs remain available.'; setCanvasError(message); failureCallback.current?.(message); return;}
    function draw(){
      if(!element||!ctx)return;const rect=element.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);element.width=Math.max(1,Math.round(rect.width*ratio));element.height=Math.max(1,Math.round(rect.height*ratio));ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#eef0e8';ctx.fillRect(0,0,rect.width,rect.height);
      const extent=Math.max(bounds.x[1]-bounds.x[0],bounds.y[1]-bounds.y[0],bounds.z[1]-bounds.z[0],1), scale=Math.min(rect.width,rect.height)*.82/extent*orbit.zoom;
      const cx=(bounds.x[0]+bounds.x[1])/2,cy=(bounds.y[0]+bounds.y[1])/2,cz=(bounds.z[0]+bounds.z[1])/2;
      const projected=sample.map(p=>{const x=p.x-cx,y=p.y-cy,z=p.z-cz,rx=x*Math.cos(orbit.yaw)-y*Math.sin(orbit.yaw),depth=x*Math.sin(orbit.yaw)+y*Math.cos(orbit.yaw);return {x:rect.width/2+rx*scale,y:rect.height/2-(z*Math.cos(orbit.pitch)-depth*Math.sin(orbit.pitch))*scale,depth:z*Math.sin(orbit.pitch)+depth*Math.cos(orbit.pitch),p};}).sort((a,b)=>a.depth-b.depth);
      for(const point of projected){if(point.x<0||point.y<0||point.x>rect.width||point.y>rect.height)continue;ctx.globalAlpha=linked && point.p.view !== selectedIndex ? .7 : 1;ctx.fillStyle=`rgb(${point.p.r},${point.p.g},${point.p.b})`;ctx.fillRect(point.x,point.y,1.8,1.8);}ctx.globalAlpha=1; readyCallback.current?.();
    }
    draw();const observer=new ResizeObserver(draw);observer.observe(element);return()=>observer.disconnect();
  },[sample,bounds,orbit,linked,selectedIndex]);
  function pointer(event:PointerEvent<HTMLCanvasElement>){if(!drag.current)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;drag.current={x:event.clientX,y:event.clientY};setOrbit(o=>({...o,yaw:o.yaw+dx*.009,pitch:Math.max(-1.25,Math.min(1.25,o.pitch+dy*.007))}));}
  return <div className="destination-points">{canvasError?<p role="alert">{canvasError}</p>:<canvas ref={canvas} tabIndex={0} aria-label="Partial reconstructed point cloud. Drag to orbit; use arrow keys to rotate." onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={pointer} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setOrbit(o=>({...o,yaw:o.yaw+(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0),pitch:Math.max(-1.25,Math.min(1.25,o.pitch+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)))}));}}}/>}<div className="destination-point-controls"><button onClick={()=>setOrbit(o=>({...o,zoom:Math.min(5,o.zoom*1.25)}))} aria-label="Zoom reconstruction in">+</button><button onClick={()=>setOrbit(o=>({...o,zoom:Math.max(.4,o.zoom/1.25)}))} aria-label="Zoom reconstruction out">−</button><button onClick={()=>setOrbit({yaw:.55,pitch:.45,zoom:1})}>Reset view</button></div><p className="destination-point-status">{linked?'Selected photo linked':'Photo outside this capture area'}</p></div>;
}

function SourcePreview({id, view, index, selected, onSelect}: {id: DestinationId; view: View; index: number; selected: boolean; onSelect: () => void}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return <button aria-label={`Preview source view ${index + 1}`} aria-pressed={selected} onClick={onSelect}>
    <img src={localAsset(id, view.file)} alt="" onLoad={() => setState('ready')} onError={() => setState('error')} hidden={state === 'error'}/>
    {state !== 'ready' && <span>{state === 'error' ? 'Missing' : 'Opening…'}</span>}
  </button>;
}
