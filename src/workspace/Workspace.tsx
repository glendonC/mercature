import { useEffect, useId, useMemo, useRef, useState } from "react";
import SpatialView from "../spatial/SpatialView";
import SceneFrame from "../components/SceneFrame";
import SceneProgress from "../components/SceneProgress";
import AIResultCard, { type AIResult } from "../components/AIResultCard";
import ContextualGuide from "../components/ContextualGuide";
import {
  DEFAULT_PROFILE,
  SYNTHETIC_SCENE,
  BENCH_CLEAR_POSITION,
} from "../spatial/fixtures";
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
import "./workspace.css";
export type WorkspaceProps = {
  initialPlan?: ImprovementPlan;
  analysisResult?: AIResult;
  initialViewState?: {selectedId: string | null; rotation: number};
  initialProject?: Project;
  onHome: () => void;
  onSave: (plan: ImprovementPlan) => void;
};
type Step = "start" | "message" | "confirm" | "edit" | "compare" | "done";
const outcome = (status: string) =>
  status === "reachable"
    ? "Connected"
    : status === "blocked"
      ? "Blocked"
      : "Not yet known";
export default function Workspace({
  initialPlan,
  analysisResult,
  initialViewState,
  initialProject,
  onHome,
  onSave,
}: WorkspaceProps) {
  const initial = initialPlan?.project ?? initialProject;
  const [scene] = useState(() =>
    structuredClone(initial?.scene ?? SYNTHETIC_SCENE),
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
    structuredClone(initial?.profile ?? DEFAULT_PROFILE),
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
      initialViewState?.selectedId ??
      scene.obstacles.find((o) => o.movable)?.id ??
      inventory[0]?.id ??
      null,
  );
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
    initialPlan?.title ?? "Review the visitor approach",
  );
  const [decision, setDecision] = useState<ImprovementPlan["decision"]>(
    initialPlan?.decision ?? "planned",
  );
  const [notes, setNotes] = useState(initialPlan?.notes ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [plan, setPlan] = useState<ImprovementPlan | null>(initialPlan ?? null);
  const [placing, setPlacing] = useState(false);
  const [move, setMove] = useState({
    x: BENCH_CLEAR_POSITION.x.toString(),
    y: BENCH_CLEAR_POSITION.y.toString(),
  });
  const optionsId = useId();
  const options = useRef<HTMLDivElement>(null);
  const optionsButton = useRef<HTMLButtonElement>(null);
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const actionCard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    actionCard.current?.focus({ preventScroll: true });
  }, [step]);
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
  const target = confirmation?.targets[0]?.id ?? selected;
  const feature = scene.obstacles.find((o) => o.id === target);
  const selectedFeature = inventory.find((o) => o.id === selected);
  const editable = !!confirmation && !!feature?.movable && !!feature.reviewed;
  const actionName =
    feature?.label.replace(/^Reviewed movable /, "") ?? "object";
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
      if (!selectedFeature) throw new Error("Select a feature in the scene.");
      if (mode === "concern" && !message.trim())
        throw new Error("Add the visitor message first.");
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
      setScenario(createScenario(scene, profile));
      setTitle(`Review ${selectedFeature.label.toLocaleLowerCase()}`);
      setStep("edit");
      setError("");
      materialDirty();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function edit(operation: Operation) {
    try {
      if (!editable) throw new Error("Confirm a movable feature first.");
      setScenario(appendOperation(scene, profile, scenario, operation));
      setComparison("proposed");
      setTitle(
        `${operation.kind === "move" ? "Move" : "Remove"} ${feature!.label.toLocaleLowerCase()}`,
      );
      if (placing) setView(viewBeforePlacement.current);
      setPlacing(false);
      setStep("compare");
      setError("");
      materialDirty();
      placementDialog.current?.close();
    } catch (e) {
      setError((e as Error).message);
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
      if (!origin || !confirmation) throw new Error("Confirm a feature first.");
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
      setNotice("Saved on this device.");
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
      setNotice("Local backup downloaded.");
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
  const afterStatus = proposed.destinations[0]?.status ?? "unknown";
  const connected = afterStatus === "reachable";
  const cue = step === "start" ? "Let’s see what’s getting in the way."
    : step === "message" ? "Keep the visitor’s own words. We’ll connect them to a spot."
    : step === "confirm" ? "Select the object you want to work on."
    : placing ? "Tap a clear spot to preview the move."
    : step === "edit" ? editable ? `Try moving the ${actionName} out of the passage.` : "This feature needs a closer review."
    : step === "compare" ? connected ? `This proposal opens a route to ${destination.toLocaleLowerCase()}.`
      : afterStatus === "blocked" ? "The passage is still blocked. Try another position."
      : "There isn’t enough information to confirm this route."
    : plan ? "Your plan is saved on this device." : "Save your changes when you’re ready.";
  const progressIndex = step === "start" || step === "message" || step === "confirm" ? 0 : step === "edit" ? 1 : 2;
  const selectedRecord = selectedFeature && 'evidence' in selectedFeature ? selectedFeature.evidence : [];
  const selectedBounds = selectedFeature && 'bounds' in selectedFeature ? selectedFeature.bounds : null;
  function retryChange() {
    setScenario(createScenario(scene, profile));
    setStep("edit"); setPlacing(false); setSelected(target); setComparison("proposed"); materialDirty();
  }
  return (
    <SceneFrame className="guided-workspace" step={step} label="Visitor courtyard editing demo"
      sceneRef={stageRef} dialogueRef={dockRef}
      progress={<SceneProgress title="Open the passage" items={[
        {id:'identify',label:'Choose a feature',state:progressIndex === 0 ? 'current' : 'complete'},
        {id:'try',label:'Preview a change',state:progressIndex === 1 ? 'current' : progressIndex > 1 && scenario.operations.length > 0 ? 'complete' : 'upcoming'},
        {id:'save',label:'Review and save',state:plan ? 'complete' : progressIndex === 2 ? 'current' : 'upcoming'},
      ]}>
        {(step === "compare" || step === "done") && <section className="result-panel" aria-label="Passage result">
          <h2>{destination}</h2>
          <div className="compact-comparison" aria-label="Before and after comparison">
            <div><span>Before</span><strong className={`result-${baseline.destinations[0]?.status}`}>{outcome(baseline.destinations[0]?.status ?? "unknown")}</strong></div>
            <div><span>After</span><strong className={`result-${afterStatus}`}>{outcome(afterStatus)}</strong></div>
          </div>
          <p>Modelled proposal</p>
          <div className="result-switch" aria-label="Compare scene">
            <button aria-pressed={comparison === 'original'} onClick={() => setComparison('original')}>Before</button>
            <button aria-pressed={comparison === 'proposed'} onClick={() => setComparison('proposed')}>After</button>
          </div>
        </section>}
      </SceneProgress>}
      scene={<SpatialView
          controlsTarget={controlsTarget}
          returnFocus={() => optionsButton.current?.focus()}
          rotation={rotation}
          onRotationChange={setRotation}
          scene={comparison === "original" ? scene : applied}
          result={comparison === "original" ? baseline : proposed}
          selectedId={selected}
          onSelect={setSelected}
          view={view}
          compact
          evidenceScene={scene}
          onPlace={
            placing
              ? (point) => edit({ kind: "move", objectId: target!, to: point })
              : undefined
          }
        />}
      context={<>
        <div className="context-panel-head"><span className="scene-caption">{step === "start" ? "Get started" : step === "message" ? "Visitor message" : step === "confirm" ? "Selected feature" : step === "edit" ? "Preview" : step === "compare" ? "Next step" : "Your plan"}</span>
          <button ref={optionsButton} className="dialogue-options" popoverTarget={optionsId} aria-label="Scene options" title="Scene options">•••</button>
        </div>
        {(step === "message" || step === "confirm") && analysisResult && <AIResultCard
          result={{...analysisResult, spots: analysisResult.spots.filter(spot => inventory.some(item => item.id === spot.id))}}
          selectedId={selected}
          onSpot={id => { setSelected(id); setStep("confirm"); }}
          onNotSure={() => { setSelected(null); setStep("confirm"); }} />}
        <div className="guide-action" key={step} ref={actionCard} tabIndex={-1}>
          {step === "start" && (
            <>
              <h2>What needs attention?</h2>
              <div className="action-row">
                <button className="primary" onClick={() => begin("proactive")}>
                  Check the passage <span>→</span>
                </button>
                <button
                  className="quiet-button"
                  onClick={() => begin("concern")}
                >
                  Add a visitor message
                </button>
              </div>
            </>
          )}
          {step === "message" && (
            <>
              <h2>What did the visitor say?</h2>
              <label className="sr-only" htmlFor="visitor-message">
                Original visitor message
              </label>
              <textarea
                id="visitor-message"
                value={message}
                maxLength={4000}
                rows={2}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Paste or type their message…"
              />
              <div className="action-row">
                <label className="sr-only" htmlFor="message-language">
                  Message language
                </label>
                <select
                  id="message-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ko">한국어</option>
                  <option value="other">Other / unsure</option>
                </select>
                <button
                  className="primary"
                  disabled={!message.trim()}
                  onClick={() => setStep("confirm")}
                >
                  Find the feature <span>→</span>
                </button>
                <button
                  className="quiet-button"
                  onClick={() => setStep("start")}
                >
                  Back
                </button>
              </div>
              <p className="subtle-line">
                Select the feature in the scene next.
              </p>
            </>
          )}
          {step === "confirm" && (
            <>
              <h2>{selectedFeature?.label ?? "Select a feature"}</h2>
              {selectedFeature && <details className="feature-facts"><summary>Feature details</summary>
                {selectedBounds && <p>{(selectedBounds.maxX-selectedBounds.minX).toFixed(2)} × {(selectedBounds.maxY-selectedBounds.minY).toFixed(2)} m footprint</p>}
                {selectedRecord.map((text, index) => <p key={index}>{text}</p>)}
                {selectedRecord.length === 0 && <p>{'reason' in selectedFeature ? selectedFeature.reason : 'Authored feature in the example scene.'}</p>}
              </details>}
              <div className="action-row">
                <button
                  className="primary"
                  disabled={!selectedFeature}
                  onClick={confirm}
                >
                  Yes, this feature <span>→</span>
                </button>
                <details className="feature-picker"><summary>Choose another feature</summary>
                <label className="sr-only" htmlFor="feature-choice">
                  Affected feature
                </label>
                <select
                  id="feature-choice"
                  value={selected ?? ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select></details>
                <button
                  className="quiet-button"
                  onClick={() => setStep("start")}
                >
                  Back
                </button>
              </div>
            </>
          )}
          {step === "edit" && (
            <>
              <h2>
                {placing
                  ? "Where should it go?"
                  : editable
                    ? "Give the passage more room."
                    : "Keep this issue for review."}
              </h2>
              <div className="action-row">
                {editable && !placing ? (
                  <>
                    <button
                      className="primary"
                      onClick={() => {
                        setSelected(target);
                        viewBeforePlacement.current = view;
                        setPlacing(true);
                        setView("map");
                        setComparison("proposed");
                      }}
                    >
                      Move {actionName} <span>→</span>
                    </button>
                    <button
                      onClick={() =>
                        edit({ kind: "remove", objectId: target! })
                      }
                    >
                      Remove {actionName}
                    </button>
                  </>
                ) : placing ? (
                  <>
                    <button
                      className="quiet-button"
                      onClick={() => placementDialog.current?.showModal()}
                    >
                      Enter a position
                    </button>
                    {scene.id === SYNTHETIC_SCENE.id &&
                      contentHash(scene) === contentHash(SYNTHETIC_SCENE) && (
                        <button
                          className="primary"
                          onClick={() =>
                            edit({
                              kind: "move",
                              objectId: target!,
                              to: BENCH_CLEAR_POSITION,
                            })
                          }
                        >
                          Try the open corner <span>→</span>
                        </button>
                      )}
                    <button
                      className="quiet-button"
                      onClick={() => setPlacing(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="primary"
                    onClick={() => setStep("compare")}
                  >
                    Review the plan <span>→</span>
                  </button>
                )}
                <button
                  className="quiet-button"
                  onClick={() => {
                    setPlacing(false);
                    setConfirmation(null);
                    setStep("confirm");
                  }}
                >
                  Change feature
                </button>
              </div>
            </>
          )}
          {step === "compare" && (
            <>
              <h2>{connected ? "Keep this proposal?" : afterStatus === "blocked" ? "The route is still blocked." : "The route is unresolved."}</h2>
              <p className="context-description">{connected ? "Save it for review before making a change on site." : "Try a different placement, or keep this proposal for review."}</p>
              <div className="action-row">
                {connected ? <><button className="primary" onClick={save}>Save improvement plan</button><button onClick={retryChange}>Try another change</button></>
                  : <><button className="primary" onClick={retryChange}>Try another change</button><button onClick={save}>Save for review</button></>}
              </div>
            </>
          )}
          {step === "done" && (
            <>
              <h2>{plan ? "Plan saved." : "Save your updated plan."}</h2>
              <p className="subtle-line">{title}</p>
              <div className="action-row">
                {!plan ? (
                  <button className="primary" onClick={save}>
                    Save improvement plan
                  </button>
                ) : (
                  <button className="primary" onClick={onHome}>
                    Back to home <span>→</span>
                  </button>
                )}
                <button
                  className="quiet-button"
                  onClick={() => {
                    setScenario(createScenario(scene, profile));
                    setStep("edit");
                    setPlacing(false);
                    setSelected(target);
                    materialDirty();
                  }}
                >
                  Keep exploring
                </button>
                {plan && (
                  <button className="quiet-button" onClick={backup}>
                    Download backup
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {error && (
          <p className="guide-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="guide-notice" role="status">
            {notice}
          </p>
        )}
      </>}
      dialogue={<p role="status">{cue}</p>}>
      <ContextualGuide stageRef={stageRef} dockRef={dockRef}
        selectedId={step === "confirm" || step === "edit" ? selected : null}
        revision={`${step}:${view}:${rotation}:${scenario.operations.length}:${comparison}:${placing}`}
        tone={step === "confirm" ? "evidence" : step === "compare" || step === "done" ? "review" : "guide"} />
      <div popover="auto" id={optionsId} ref={options} className="scene-options" onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) options.current?.hidePopover();
      }}>
        <p>Courtyard demo <span>Authored geometry</span></p>
        <div className="segmented" aria-label="Workspace view">
          {(["map", "3d", "split"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => {
                setView(v);
                if (v !== "map") setPlacing(false);
              }}
            >
              {v === "map" ? "Map" : v === "3d" ? "3D" : "Split"}
            </button>
          ))}
        </div>
        {scenario.operations.length > 0 && (
          <div className="scenario-tools">
            <button className="quiet-button" onClick={undo}>
              ↶ Undo
            </button>
          </div>
        )}

        <div ref={setControlsTarget} />
        <div className="scene-options-links"><button onClick={() => details.current?.showModal()}>Details</button><button onClick={onHome} aria-label="Home">Return home</button></div>
      </div>
      <dialog onClose={() => optionsButton.current?.focus()} ref={details} className="guide-dialog" aria-label="Plan details">
        <header>
          <h2>Plan details</h2>
          <button
            onClick={() => details.current?.close()}
            aria-label="Close details"
          >
            ×
          </button>
        </header>
        <p className="subtle-line">
          All geometry in this example is authored. No real site has been
          measured.
        </p>
        <label>
          Plan title
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
          Decision
          <select
            aria-label="Decision"
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value as ImprovementPlan["decision"]);
              dirty();
            }}
          >
            <option value="planned">Proposed</option>
            <option value="approved">Approved for action</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>
          Next actions and unresolved questions
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
            <summary>Original visitor message</summary>
            <p>{origin.originalText}</p>
            <p>Private report · kept on this device.</p>
          </details>
        )}
        <details>
          <summary>Movement requirements</summary>
          <p>
            Illustrative square envelope; not a wheelchair prescription or
            regulatory standard.
          </p>
          <div className="field-row">
            <label>
              Width (m)
              <input
                aria-label="Square width in metres"
                type="number"
                step="0.1"
                value={profile.width}
                onChange={(e) =>
                  changeProfile({ ...profile, width: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Headroom (m)
              <input
                aria-label="Headroom in metres"
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
              {
                {
                  turning: "Turning",
                  longitudinalSlope: "Slope",
                  crossSlope: "Cross-slope",
                  multilevel: "Movement between levels",
                }[k]
              }{" "}
              required (unsupported)
            </label>
          ))}
        </details>
        <details>
          <summary>What this check includes</summary>
          <p>
            {baseline.reachableArea.toFixed(2)} m² connected originally;{" "}
            {proposed.reachableArea.toFixed(2)} m² proposed. These are
            envelope-centre assessment areas, not usable floor area. Unknown:{" "}
            {proposed.unknownArea.toFixed(2)} m².
          </p>
          <ul>
            {[...proposed.unsupported, ...proposed.assumptions].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            Approving a plan does not mean physical work has been completed.
          </p>
        </details>
        {confirmation && (
          <button
            className="primary"
            onClick={() => {
              save();
              details.current?.close();
            }}
          >
            Save improvement plan
          </button>
        )}
      </dialog>
      <dialog
        ref={placementDialog}
        className="guide-dialog"
        aria-label="Exact placement"
      >
        <header>
          <h2>Place the object</h2>
          <button
            onClick={() => placementDialog.current?.close()}
            aria-label="Close placement"
          >
            ×
          </button>
        </header>
        <p>
          Minimum X/Y corner in metres. The position must fit known support.
        </p>
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
              setError("Enter both coordinates.");
              return;
            }
            edit({
              kind: "move",
              objectId: target!,
              to: { x: Number(move.x), y: Number(move.y) },
            });
          }}
        >
          Preview move
        </button>
      </dialog>
    </SceneFrame>
  );
}
