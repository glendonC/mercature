import { useEffect, useId, useMemo, useRef, useState } from "react";
import SpatialView from "../spatial/SpatialView";
import PlaceCanvas, {type PlaceView} from "../components/PlaceCanvas";
import ScenePins from "../components/ScenePins";
import {NOOR_FARM} from "../site/farm";
import type {Site} from "../site/contracts";
import {understand, prepareModel, modelState, modelStored, modelDownloadBytes, remember, type Understanding, type ModelState} from "../language/understand";
import AIResultCard, { type AIResult } from "../components/AIResultCard";
import ContextualGuide from "../components/ContextualGuide";
import {
  appendOperation,
  applyScenario,
  createScenario,
  undoScenario,
} from "../spatial/scenario";
import { solveScene } from "../spatial/solver";
import { contentHash } from "../spatial/validation";
import type { Operation, Profile, Project } from "../spatial/contracts";
import {
  confirmTargets,
  createPlan,
  serializePlan,
  type Confirmation,
  type ImprovementPlan,
  type Origin,
} from "../plans";
import { useLanguage } from "../i18n";
import "./workspace.css";
export type WorkspaceProps = {
  initialPlan?: ImprovementPlan;
  initialViewState?: {selectedId: string | null; rotation: number};
  initialProject?: Project;
  onHome: () => void;
  onSave: (plan: ImprovementPlan) => void;
};
type Step = "start" | "message" | "confirm" | "edit" | "compare" | "done";
export default function Workspace({
  initialPlan,
  initialViewState,
  initialProject,
  onHome,
  onSave,
}: WorkspaceProps) {
  const { t, lang } = useLanguage();
  const outcome = (status: string) => t(status === "reachable" ? "common.connected" : status === "blocked" ? "common.blocked" : "common.unknown");
  const initial = initialPlan?.project ?? initialProject;
  const [scene] = useState(() =>
    structuredClone(initial?.scene ?? NOOR_FARM.scene),
  );
  const inventory = useMemo(
    () => [
      ...scene.obstacles,
      ...scene.supports,
      ...scene.unknown,
      ...scene.destinations,
    ],
    [scene],
  );
  const [profile, setProfile] = useState(() =>
    structuredClone(initial?.profile ?? NOOR_FARM.profile),
  );
  const [scenario, setScenario] = useState(() =>
    structuredClone(initial?.scenario ?? createScenario(scene, profile)),
  );
  const [rotation, setRotation] = useState(initialViewState?.rotation ?? 0);
  const [view, setView] = useState<"map" | "3d" | "split">("3d");
  const viewBeforePlacement = useRef<"map" | "3d" | "split">("3d");
  const [comparison, setComparison] = useState<"original" | "proposed">(
    "proposed",
  );
  const [selected, setSelected] = useState<string | null>(
    initialPlan?.confirmation.targets[0]?.id ??
      (initialViewState?.selectedId && inventory.some(item => item.id === initialViewState.selectedId) ? initialViewState.selectedId : null) ??
      null,
  );
  const [section, setSection] = useState<PlaceView>(initialPlan ? "changes" : "place");
  const [understanding, setUnderstanding] = useState<Understanding | null>(null);
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState<ModelState>(() => modelState());
  const [preparingModel, setPreparingModel] = useState(false);
  /** What a download would really cost here; nothing is offered when it is stored or cannot be told. */
  const [downloadBytes, setDownloadBytes] = useState<number | null>(null);
  useEffect(() => {
    if (model.status === 'ready') return;
    let alive = true;
    void modelDownloadBytes().then(bytes => { if (alive) setDownloadBytes(bytes); });
    return () => { alive = false; };
  }, [model.status]);
  /** A model kept on this device answers without a connection, so the farm offers to find the spot. */
  const [stored, setStored] = useState(false);
  useEffect(() => {
    let alive = true;
    void modelStored().then(value => { if (alive) setStored(value); });
    return () => { alive = false; };
  }, []);
  const ai = model.status === 'ready' || stored;
  const request = useRef(0);
  useEffect(() => () => {request.current++;}, []);
  const [step, setStep] = useState<Step>(initialPlan ? "done" : "start");
  const [mode, setMode] = useState<"concern" | "proactive">(
    initialPlan?.origin.kind ?? "proactive",
  );
  const [message, setMessage] = useState(
    initialPlan?.origin.kind === "concern"
      ? initialPlan.origin.originalText
      : "",
  );
  const [language, setLanguage] = useState(
    initialPlan?.origin.kind === "concern" ? initialPlan.origin.language : "en",
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(
    initialPlan?.confirmation ?? null,
  );
  const [origin, setOrigin] = useState<Origin | null>(
    initialPlan?.origin ?? null,
  );
  const [savedIdentity, setSavedIdentity] = useState(
    initialPlan
      ? {
          id: initialPlan.id,
          createdAt: initialPlan.createdAt,
          originHash: contentHash(initialPlan.origin),
        }
      : null,
  );
  const [title, setTitle] = useState(
    initialPlan?.title ?? t("ws.defaultTitle"),
  );
  const [decision, setDecision] = useState<ImprovementPlan["decision"]>(
    initialPlan?.decision ?? "planned",
  );
  const [notes, setNotes] = useState(initialPlan?.notes ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [plan, setPlan] = useState<ImprovementPlan | null>(initialPlan ?? null);
  const [placing, setPlacing] = useState(false);
  const [move, setMove] = useState({ x: "", y: "" });
  const optionsId = useId();
  const options = useRef<HTMLDivElement>(null);
  const optionsButton = useRef<HTMLButtonElement>(null);
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);

  const details = useRef<HTMLDialogElement>(null);
  const placementDialog = useRef<HTMLDialogElement>(null);
  const baseline = useMemo(() => solveScene(scene, profile), [scene, profile]);
  const proposed = useMemo(
    () => solveScene(scene, profile, scenario),
    [scene, profile, scenario],
  );
  const applied = useMemo(
    () => applyScenario(scene, profile, scenario),
    [scene, profile, scenario],
  );
  const site: Site = useMemo(() => scene.id === NOOR_FARM.id ? {...NOOR_FARM, scene, profile} : {
    id: scene.id, name: {en: scene.title, es: scene.title}, place: '', provenance: 'synthetic', scene, profile,
    features: inventory.map(item => ({id: item.id, name: {en: item.label, es: item.label}, description: '', aliases: {}})), placements: [],
  }, [scene, profile, inventory]);
  const nameOf = (id: string) => site.features.find(item => item.id === id)?.name[lang] ?? inventory.find(item => item.id === id)?.label ?? id;
  const target = confirmation?.targets[0]?.id ?? selected;
  const feature = scene.obstacles.find((o) => o.id === target);
  const selectedFeature = inventory.find((o) => o.id === selected);
  const editable = !!confirmation && !!feature?.movable && !!feature.reviewed;
  const destination = scene.destinations[0]?.label ?? "Destination";
  const dirty = () => {
    setPlan(null);
    setNotice("");
  };
  const materialDirty = () => {
    setDecision("planned");
    dirty();
  };
  function begin(kind: "concern" | "proactive") {
    setSection(kind === "concern" ? "messages" : "changes");
    setMode(kind);
    setConfirmation(null);
    setOrigin(null);
    setScenario(createScenario(scene, profile));
    setStep(kind === "concern" ? "message" : "confirm");
    setPlacing(false);
    setError("");
    materialDirty();
  }
  function confirm() {
    try {
      if (!selectedFeature) throw new Error(t("ws.error.selectFeature"));
      if (mode === "concern" && !message.trim())
        throw new Error(t("ws.error.messageFirst"));
      const id = crypto.randomUUID();
      const next: Origin =
        mode === "concern"
          ? {
              kind: "concern",
              id,
              source: {
                id: `report-${id}`,
                revision: "1",
                description:
                  "Operator-entered visitor report; retained only on this device.",
                provenance: "local",
                permission: "local-only",
              },
              originalText: message,
              language,
              supportingSpan: { start: 0, end: message.length, quote: message },
            }
          : {
              kind: "proactive",
              id,
              source: {
                id: "authored-site-check",
                revision: String(scene.revision),
                description: "Operator check of the authored synthetic scene.",
                provenance: "synthetic",
                permission: "exportable",
              },
              expectation: `Review modeled access from the start to ${destination} under explicit movement requirements.`,
              method:
                "Deterministic horizontal square-envelope check; operator reviews linked evidence.",
            };
      const checked = confirmTargets({
        origin: next,
        scene,
        targetIds: [selectedFeature.id],
        reviewer: "Local operator",
        interpretation:
          mode === "concern"
            ? `Operator associated the original report with ${selectedFeature.label}; no measurement inferred from the report.`
            : `Operator selected ${selectedFeature.label} for review of the modeled passage.`,
      });
      setOrigin(next);
      setConfirmation(checked);
      // The person's own link teaches the model this place; a plan without a visitor message teaches nothing.
      if (mode === "concern") void remember(message, site, selectedFeature.id);
      setScenario(createScenario(scene, profile));
      setTitle(t("ws.title.review", { feature: nameOf(selectedFeature.id).toLocaleLowerCase() }));
      setStep("edit");
      setSection("changes");
      setError("");
      materialDirty();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function edit(operation: Operation) {
    try {
      if (!editable) throw new Error(t("ws.error.confirmMovable"));
      setScenario(appendOperation(scene, profile, scenario, operation));
      setComparison("proposed");
      setTitle(t(operation.kind === "move" ? "ws.title.move" : "ws.title.remove", { feature: nameOf(feature!.id).toLocaleLowerCase() }));
      if (placing) setView(viewBeforePlacement.current);
      setPlacing(false);
      setStep("compare");
      setError("");
      materialDirty();
      placementDialog.current?.close();
    } catch (e) {
      const raw = (e as Error).message;
      setError(t(/support|ground|unknown/i.test(raw) ? "ws.error.unmapped" : /intersect|collision|overlap/i.test(raw) ? "ws.error.occupied" : /bounds|outside|edge/i.test(raw) ? "ws.error.edge" : "ws.error.position"));
    }
  }
  function changeProfile(next: Profile) {
    try {
      solveScene(scene, next);
      setProfile(next);
      setScenario(createScenario(scene, next));
      setStep(confirmation ? "edit" : "start");
      setComparison("proposed");
      setError("");
      materialDirty();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function save() {
    try {
      if (!origin || !confirmation) throw new Error(t("ws.error.confirmFirst"));
      const same = savedIdentity?.originHash === contentHash(origin);
      const next = createPlan({
        id: same ? savedIdentity!.id : crypto.randomUUID(),
        title: title.trim(),
        origin,
        confirmation,
        project: { schemaVersion: "spatial-v1", scene, profile, scenario },
        decision,
        notes,
      });
      if (same) next.createdAt = savedIdentity!.createdAt;
      onSave(next);
      setSavedIdentity({
        id: next.id,
        createdAt: next.createdAt,
        originHash: contentHash(origin),
      });
      setPlan(next);
      setStep("done");
      setError("");
      setNotice(t("ws.saved"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function backup() {
    if (!plan) return;
    try {
      const url = URL.createObjectURL(
        new Blob([serializePlan(plan)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `mercature-plan-${plan.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(t("ws.backupDone"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function undo() {
    setScenario(undoScenario(scenario));
    setStep("edit");
    setPlacing(false);
    materialDirty();
  }
  const pathChanges = proposed.destinations.map(after => ({after, before: baseline.destinations.find(item => item.id === after.id)!})).sort((a,b) => Number(b.before.status !== b.after.status) - Number(a.before.status !== a.after.status));
  const newProblems = pathChanges.filter(({before, after}) => before.status === "reachable" && after.status !== "reachable");
  const improved = pathChanges.filter(({before, after}) => before.status !== "reachable" && after.status === "reachable");
  const reviewed = step === "compare" || step === "done";
  const selectedRecord = selectedFeature && 'evidence' in selectedFeature ? selectedFeature.evidence : [];
  const selectedBounds = selectedFeature && 'bounds' in selectedFeature ? selectedFeature.bounds : null;
  const candidateSpots = useMemo(() => (understanding?.candidates ?? [])
    .filter(id => inventory.some(item => item.id === id)).slice(0, 3).map(id => ({id, label: site.features.find(item => item.id === id)?.name[lang] ?? id})), [understanding, inventory, site, lang]);
  const resultCard: AIResult | undefined = understanding && (understanding.status === 'ready' || understanding.status === 'unsure') ? {
    messageType: understanding.kind ? t(`kind.${understanding.kind}`) : t('common.notSure'),
    issueType: understanding.category ? t(`issue.${understanding.category}`) : '',
    state: understanding.status === 'ready' ? 'matched' : 'not-sure', spots: candidateSpots,
  } : undefined;
  const pins = useMemo(() => section === 'messages' ? candidateSpots : confirmation ? confirmation.targets.map(item => ({id: item.id, label: site.features.find(spot => spot.id === item.id)?.name[lang] ?? item.id})) : [], [section, candidateSpots, confirmation, site, lang]);
  const cue = t(thinking ? "ws.cue.reading"
    : section === 'place' ? selected ? "ws.cue.linkable" : "ws.cue.select"
    : section === 'messages' ? step === 'confirm' ? !understanding || understanding.status === 'unavailable' ? "ws.cue.yourself" : "ws.cue.checkSuggested" : "ws.cue.ownWords"
    : placing ? "ws.cue.tap"
    : plan ? "ws.cue.saved"
    : reviewed ? newProblems.length ? "ws.cue.newBlocked" : improved.length ? "ws.cue.improved" : "ws.cue.unchanged"
    : confirmation ? "ws.cue.preview" : "ws.cue.choose");
  async function readMessage() {
    const ticket = ++request.current;
    setThinking(true); setError(''); setUnderstanding(null); setSelected(null);
    try {
      const result = await understand(message, site);
      if (ticket !== request.current) return;
      if (result.status === 'invalid') {setError(t('ws.error.shorter')); return;}
      setUnderstanding(result); setMode('concern'); setConfirmation(null); setOrigin(null);
      setScenario(createScenario(scene, profile)); setComparison('proposed'); materialDirty();
      setSelected(result.status === 'ready' && result.candidates[0] && inventory.some(item => item.id === result.candidates[0]) ? result.candidates[0] : null);
      setStep('confirm');
    } catch { if (ticket === request.current) {setConfirmation(null); setOrigin(null); setScenario(createScenario(scene, profile)); materialDirty(); setUnderstanding({status:'unavailable',kind:null,category:null,candidates:[],reason:'model-failed'}); setStep('confirm'); setMode('concern');} }
    finally { if (ticket === request.current) setThinking(false); }
  }
  /** Without the model the person picks the spot; the message is kept exactly as written. */
  function readWithoutAi() {
    request.current++;
    setThinking(false); setError(''); setUnderstanding(null); setSelected(null);
    setMode('concern'); setConfirmation(null); setOrigin(null);
    setScenario(createScenario(scene, profile)); setComparison('proposed'); materialDirty();
    setStep('confirm');
  }
  async function loadModel() {
    setPreparingModel(true); setError('');
    try {
      const next = await prepareModel(setModel);
      setModel(next);
      if (next.status === 'ready') setStored(true); else setError(t('ws.error.aiPrepare'));
    } catch {setError(t('ws.error.aiPrepare'));}
    finally {setPreparingModel(false);}
  }
  function switchSection(next: PlaceView) {setSection(next); setPlacing(false); setError('');}
  function selectSpot(id: string) {setSelected(id); setError('');}
  function retryChange() {
    setScenario(createScenario(scene, profile)); setStep("edit"); setPlacing(false); setSelected(target); setComparison("proposed"); materialDirty();
  }
  const spotPicker = <><label className="canvas-label" htmlFor="feature-choice">{t('ws.chooseSpot')}</label><select id="feature-choice" value={selected ?? ''} onChange={event => selectSpot(event.target.value)}><option value="" disabled>{t('ws.selectHere')}</option>{inventory.map(item => <option key={item.id} value={item.id}>{nameOf(item.id)}</option>)}</select></>;
  const selectedDetails = selectedFeature && <details className="feature-facts"><summary>{t('ws.spotDetails')}</summary>
    {selectedBounds && <p>{t('ws.footprint', { width: (selectedBounds.maxX-selectedBounds.minX).toFixed(1), depth: (selectedBounds.maxY-selectedBounds.minY).toFixed(1) })}</p>}
    {selectedRecord.map((text,index) => <p key={index}>{text}</p>)}
    {'reason' in selectedFeature && <p>{selectedFeature.reason}</p>}
  </details>;
  const messagesOverview = <>
    <span className="place-kicker">{t('ws.kicker.message')}</span><h1>{t('ws.messageTitle')}</h1>
    <label className="sr-only" htmlFor="visitor-message">{t('ws.originalMessage')}</label>
    <textarea id="visitor-message" value={message} maxLength={4000} placeholder={t('ws.messagePlaceholder')} onChange={event => {
      request.current++; setThinking(false); setMessage(event.target.value); setUnderstanding(null); setStep('message');
      if (/[\uac00-\ud7af]/.test(event.target.value)) setLanguage('ko');
    }} />
    <label className="canvas-label" htmlFor="message-language">{t('ws.messageLanguage')}</label>
    <select id="message-language" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="ko">한국어</option><option value="qu">Runasimi</option><option value="other">{t('common.otherLanguage')}</option></select>
    <div className="canvas-actions">
      {ai ? <button className="primary" disabled={!message.trim() || thinking} onClick={() => void readMessage()}>{t(thinking ? 'ws.readingMessage' : 'ws.find')}</button>
        : <button className="primary" disabled={!message.trim()} onClick={readWithoutAi}>{t('farm.useWithoutAi')}</button>}
      {!ai && (preparingModel || !!downloadBytes) && <button disabled={preparingModel} onClick={() => void loadModel()}>{preparingModel ? model.status === 'downloading' ? t('ws.progress', { loaded: Math.round(model.loadedBytes / 1_000_000), total: Math.round(model.totalBytes / 1_000_000) }) : t('ws.preparingAi') : t('ws.downloadAi', { mb: Math.max(1, Math.round((downloadBytes ?? 0) / 1e6)) })}</button>}
    </div>
    <p className="canvas-note">{t('ws.kept')}</p>
  </>;
  const placeOverview = <>
    <span className="place-kicker">{t('ws.kicker.look')}</span><h1>{site.name[lang]}</h1>
    <p className="place-copy">{site.id === NOOR_FARM.id ? t('farm.place') : site.place || t('ws.editableExample')}</p>
    <ul className="spot-list" aria-label={t('ws.paths')}>{proposed.destinations.map(item => <li key={item.id}><button aria-pressed={selected === item.id} onClick={() => selectSpot(item.id)}><span className="spot-symbol" aria-hidden="true">◇</span><span>{nameOf(item.id)}</span><span className={`spot-state result-${item.status}`}>{outcome(item.status)}</span></button></li>)}</ul>
    <div className="canvas-actions"><button className="primary" onClick={() => {setSection('messages'); if (step === 'start') setStep('message');}}>{t('ws.addMessage')}</button></div>
    {spotPicker}<p className="canvas-note">{t('ws.pathCheckNote')}</p>
  </>;
  const changesOverview = <>
    <span className="place-kicker">{t('ws.kicker.plan')}</span><h1>{confirmation ? nameOf(target!) : t('ws.noFixes')}</h1>
    {!confirmation ? <><p className="place-copy">{t('ws.startWith')}</p><div className="canvas-actions"><button className="primary" onClick={() => switchSection('place')}>{t('ws.explore')}</button></div></> : <>
      {origin?.kind === 'concern' && <blockquote>{origin.originalText}</blockquote>}
      {scenario.operations.length > 0 && <p className="place-copy">{t(scenario.operations.at(-1)?.kind === 'remove' ? 'ws.removeHere' : 'ws.moveNew')}</p>}
      <table className="canvas-comparison" aria-label={t('ws.allResults')}><thead><tr><th>{t('ws.pathTo')}</th><th>{t('ws.before')}</th><th>{t('ws.after')}</th></tr></thead><tbody>{pathChanges.map(({before, after}) => <tr key={after.id} className={before.status === 'reachable' && after.status !== 'reachable' ? 'new-problem' : ''}><td>{nameOf(after.id)}</td><td className={`result-${before.status}`}>{outcome(before.status)}</td><td className={`result-${after.status}`}>{outcome(after.status)}</td></tr>)}</tbody></table>
      {newProblems.length > 0 && <p className="guide-error" role="status">{t('ws.newProblem', { spots: newProblems.map(({after}) => nameOf(after.id)).join(', ') })}</p>}
      <div className="canvas-comparison-switch" aria-label={t('ws.compare')}><button aria-pressed={comparison === 'original'} onClick={() => setComparison('original')}>{t('ws.before')}</button><button aria-pressed={comparison === 'proposed'} onClick={() => setComparison('proposed')}>{t('ws.after')}</button></div>
      <p className="canvas-note">{t('ws.layoutOnly')}</p>
    </>}
  </>;
  const inspector = section === 'place' ? selectedFeature && <>
    <div className="place-inspector-head"><span className="place-kicker">{t('canvas.selected')}</span><button className="place-dismiss" onClick={() => setSelected(null)} aria-label={t('ws.closeSpot')}>×</button></div>
    <h2>{nameOf(selectedFeature.id)}</h2><p className="place-copy">{site.features.find(item => item.id === selected)?.description}</p>
    <div className="canvas-actions"><button className="primary" onClick={() => {setMode('proactive'); begin('proactive');}}>{t('ws.planFix')}</button><button onClick={() => {setSection('messages'); setStep('message');}}>{t('ws.linkMessage')}</button></div>{selectedDetails}
  </> : section === 'messages' ? (step === 'confirm' || thinking) && <>
    <span className="place-kicker">{t(thinking ? 'ws.kicker.reading' : 'ws.kicker.check')}</span><h2>{t(thinking ? 'ws.finding' : 'ws.which')}</h2>
    {resultCard && !thinking && <AIResultCard numbered result={resultCard} selectedId={selected} onSpot={selectSpot} onNotSure={() => setSelected(null)} />}
    {!thinking && understanding?.reason === 'remembered' && <p className="canvas-note">{t('ws.remembered')}</p>}
    {!thinking && <>{understanding?.status === 'unavailable' && <p className="place-copy">{t('ws.aiUnavailable')}</p>}{spotPicker}<div className="canvas-actions"><button className="primary" disabled={!selectedFeature} onClick={confirm}>{t('ws.yesThis')}</button></div>{selectedDetails}</>}
  </> : confirmation || step === 'confirm' ? <>
    <span className="place-kicker">{t(plan ? 'ws.kicker.saved' : reviewed ? 'ws.kicker.review' : 'ws.kicker.try')}</span>
    {step === 'confirm' ? <><h2>{selected ? nameOf(selected) : t('ws.chooseSpot')}</h2>{spotPicker}<div className="canvas-actions"><button className="primary" disabled={!selectedFeature} onClick={confirm}>{t('ws.planThis')}</button></div></>
    : plan ? <><h2>{t('ws.planSaved')}</h2><p className="place-copy">{title}</p><label className="canvas-label" htmlFor="visitor-reply">{t('ws.replyTo')}</label><select id="visitor-reply" value={language} onChange={event => setLanguage(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="ko">한국어</option><option value="qu">Runasimi</option><option value="other">{t('common.otherLanguage')}</option></select><blockquote>{language === 'ko' ? '알려 주셔서 감사합니다. 말씀하신 장소를 확인하고 개선 계획을 세웠습니다.' : language === 'es' ? 'Gracias por avisarnos. Revisamos el lugar y preparamos un plan para mejorarlo.' : 'Thank you for letting us know. We reviewed the spot and made a plan to improve it.'}</blockquote><p className="canvas-note">{t('ws.prewritten')}{language === 'ko' ? t('ws.koReview') : language !== 'en' && language !== 'es' ? t('ws.fallback') : ''}</p><div className="canvas-actions"><button className="primary" onClick={() => void navigator.clipboard.writeText(language === 'ko' ? '알려 주셔서 감사합니다. 말씀하신 장소를 확인하고 개선 계획을 세웠습니다.' : language === 'es' ? 'Gracias por avisarnos. Revisamos el lugar y preparamos un plan para mejorarlo.' : 'Thank you for letting us know. We reviewed the spot and made a plan to improve it.').then(() => setNotice(t('ws.copied'))).catch(() => setError(t('ws.error.clipboard')))}>{t('ws.copyReply')}</button><button onClick={retryChange}>{t('ws.tryFix')}</button><button onClick={backup}>{t('ws.downloadBackup')}</button></div></>
    : reviewed ? <><h2>{t(newProblems.length ? 'ws.result.blocked' : improved.length ? 'ws.result.improved' : 'ws.result.unchanged')}</h2><div className="canvas-actions"><button className={newProblems.length ? '' : 'primary'} onClick={save}>{t('ws.savePlan')}</button><button className={newProblems.length ? 'primary' : ''} onClick={retryChange}>{t('ws.tryPosition')}</button></div><label className="canvas-label" htmlFor="plan-notes">{t('ws.planNote')}</label><textarea id="plan-notes" value={notes} onChange={event => {setNotes(event.target.value); dirty();}} maxLength={4000} placeholder={t('ws.planNotePlaceholder')} /></>
    : <><h2>{placing ? t('ws.choosePosition') : editable ? t('ws.title.move', { feature: nameOf(target!).toLocaleLowerCase() }) : t('ws.keep')}</h2><div className="canvas-actions">
      {editable ? <>{!placing && site.placements.filter(item => item.featureId === target).map((item,index) => <button key={index} className={index === 0 ? 'primary' : ''} onClick={() => edit({kind:'move',objectId:target!,to:item.to})}>{item.name[lang]}</button>)}
        <button onClick={() => {setSelected(target); viewBeforePlacement.current = view; setPlacing(true); setView('map'); setComparison('proposed');}}>{t('ws.chooseOnMap')}</button>
        {placing && <><button onClick={() => {if (feature) setMove({x: String(feature.bounds.minX), y: String(feature.bounds.minY)}); placementDialog.current?.showModal();}}>{t('ws.enterPosition')}</button><button onClick={() => {setPlacing(false); setView(viewBeforePlacement.current);}}>{t('ws.cancelMove')}</button></>}
        <button onClick={() => edit({kind:'remove',objectId:target!})}>{t('ws.removeHere')}</button>
      </> : <button className="primary" onClick={() => setStep('compare')}>{t('ws.reviewPlan')}</button>}
    </div></>}
  </> : null;
  return (
    <PlaceCanvas title={site.name[lang]} view={section} onView={switchSection} onHome={onHome} sceneRef={stageRef} dialogueRef={dockRef}
      tools={<><button className="view-mode" aria-pressed={view === 'map'} onClick={() => setView(view === 'map' ? '3d' : 'map')}>{t(view === 'map' ? 'common.map' : 'common.3d')}</button><button ref={optionsButton} popoverTarget={optionsId} aria-label={t('ws.sceneOptions')}>{t('common.options')}</button></>}
      scene={<><SpatialView controlsTarget={controlsTarget} returnFocus={() => optionsButton.current?.focus()} rotation={rotation} onRotationChange={setRotation}
        scene={comparison === 'original' ? scene : applied} result={comparison === 'original' ? baseline : proposed} selectedId={selected} onSelect={selectSpot} view={view} compact evidenceScene={scene}
        onPlace={placing ? point => edit({kind:'move',objectId:target!,to:point}) : undefined} />
        <ScenePins stageRef={stageRef} spots={pins} selectedId={selected} onSelect={selectSpot} revision={`${view}:${rotation}:${comparison}:${scenario.operations.length}`} /></>}
      overview={section === 'place' ? placeOverview : section === 'messages' ? messagesOverview : changesOverview}
      inspector={inspector && <>{inspector}{error && <p className="guide-error" role="alert">{error}</p>}{notice && <p className="guide-notice" role="status">{notice}</p>}</>}
      dialogue={<p role="status">{cue}</p>}>
      {!inspector && error && <p className="canvas-toast guide-error" role="alert">{error}</p>}
      <ContextualGuide stageRef={stageRef} dockRef={dockRef} selectedId={section === 'messages' && step === 'confirm' ? selected : null}
        revision={`${section}:${step}:${view}:${rotation}:${scenario.operations.length}:${comparison}:${placing}`} tone={section === 'messages' ? 'evidence' : section === 'changes' ? 'review' : 'guide'} />
      <div popover="auto" id={optionsId} ref={options} className="scene-options" onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) options.current?.hidePopover();
      }}>
        <p>{site.name[lang]} <span>{t('common.example')}</span></p>
        <div className="segmented" aria-label={t('ws.viewMode')}>
          {(["map", "3d", "split"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => {
                setView(v);
                if (v !== "map") setPlacing(false);
              }}
            >
              {t(v === "map" ? "common.map" : v === "3d" ? "common.3d" : "common.split")}
            </button>
          ))}
        </div>
        {scenario.operations.length > 0 && (
          <div className="scenario-tools">
            <button className="quiet-button" onClick={undo}>
              {t("ws.undo")}
            </button>
          </div>
        )}

        <div ref={setControlsTarget} />
        <div className="scene-options-links"><button onClick={() => details.current?.showModal()}>{t('common.details')}</button><button onClick={onHome} aria-label={t('common.home')}>{t('common.returnHome')}</button></div>
      </div>
      <dialog onClose={() => optionsButton.current?.focus()} ref={details} className="guide-dialog" aria-label={t("ws.planDetails")}>
        <header>
          <h2>{t("ws.planDetails")}</h2>
          <button
            onClick={() => details.current?.close()}
            aria-label={t("ws.closeDetails")}
          >
            ×
          </button>
        </header>
        <p className="subtle-line">{t("ws.authored")}</p>
        <label>
          {t("ws.planTitle")}
          <input
            value={title}
            maxLength={160}
            onChange={(e) => {
              setTitle(e.target.value);
              dirty();
            }}
          />
        </label>
        <label>
          {t("ws.decision")}
          <select
            aria-label={t("ws.decision")}
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value as ImprovementPlan["decision"]);
              dirty();
            }}
          >
            <option value="planned">{t("ws.decision.planned")}</option>
            <option value="approved">{t("ws.decision.approved")}</option>
            <option value="rejected">{t("ws.decision.rejected")}</option>
          </select>
        </label>
        <label>
          {t("ws.nextActions")}
          <textarea
            rows={3}
            value={notes}
            maxLength={4000}
            onChange={(e) => {
              setNotes(e.target.value);
              dirty();
            }}
          />
        </label>
        {origin?.kind === "concern" && (
          <details>
            <summary>{t("ws.originalMessage")}</summary>
            <p>{origin.originalText}</p>
            <p>{t("ws.private")}</p>
          </details>
        )}
        <details>
          <summary>{t("ws.movement")}</summary>
          <p>{t("ws.envelope")}</p>
          <div className="field-row">
            <label>
              {t("ws.width")}
              <input
                aria-label={t("ws.widthLabel")}
                type="number"
                step="0.1"
                value={profile.width}
                onChange={(e) =>
                  changeProfile({ ...profile, width: Number(e.target.value) })
                }
              />
            </label>
            <label>
              {t("ws.headroom")}
              <input
                aria-label={t("ws.headroomLabel")}
                type="number"
                step="0.1"
                value={profile.height}
                onChange={(e) =>
                  changeProfile({ ...profile, height: Number(e.target.value) })
                }
              />
            </label>
          </div>
          {(
            [
              "turning",
              "longitudinalSlope",
              "crossSlope",
              "multilevel",
            ] as const
          ).map((k) => (
            <label className="check-row" key={k}>
              <input
                type="checkbox"
                checked={profile.requirements[k]}
                onChange={(e) =>
                  changeProfile({
                    ...profile,
                    requirements: {
                      ...profile.requirements,
                      [k]: e.target.checked,
                    },
                  })
                }
              />
              {t("ws.required", { requirement: t(`ws.req.${k}`) })}
            </label>
          ))}
        </details>
        <details>
          <summary>{t("ws.includes")}</summary>
          <p>{t("ws.areas", { before: baseline.reachableArea.toFixed(2), after: proposed.reachableArea.toFixed(2), unknown: proposed.unknownArea.toFixed(2) })}</p>
          <ul>
            {[...proposed.unsupported, ...proposed.assumptions].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>{t("ws.notCompleted")}</p>
        </details>
        {confirmation && (
          <button
            className="primary"
            onClick={() => {
              save();
              details.current?.close();
            }}
          >
            {t("ws.savePlan")}
          </button>
        )}
      </dialog>
      <dialog
        ref={placementDialog}
        className="guide-dialog"
        aria-label={t("ws.placement")}
      >
        <header>
          <h2>{t("ws.placeObject")}</h2>
          <button
            onClick={() => placementDialog.current?.close()}
            aria-label={t("ws.closePlacement")}
          >
            ×
          </button>
        </header>
        <p>{t("ws.corner")}</p>
        <div className="field-row">
          <label>
            X (m)
            <input
              type="number"
              step="0.1"
              value={move.x}
              onChange={(e) => setMove({ ...move, x: e.target.value })}
            />
          </label>
          <label>
            Y (m)
            <input
              type="number"
              step="0.1"
              value={move.y}
              onChange={(e) => setMove({ ...move, y: e.target.value })}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="guide-error">
            {error}
          </p>
        )}
        <button
          className="primary"
          onClick={() => {
            if (!move.x.trim() || !move.y.trim()) {
              setError(t("ws.error.coordinates"));
              return;
            }
            edit({
              kind: "move",
              objectId: target!,
              to: { x: Number(move.x), y: Number(move.y) },
            });
          }}
        >
          {t("ws.previewMove")}
        </button>
      </dialog>
    </PlaceCanvas>
  );
}
