import { useEffect, useMemo, useRef, useState } from "react";
import SpatialView from "../spatial/SpatialView";
import Companion from "../components/Companion";
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
  const [view, setView] = useState<"map" | "3d" | "split">("3d");
  const [comparison, setComparison] = useState<"original" | "proposed">(
    "proposed",
  );
  const [selected, setSelected] = useState<string | null>(
    initialPlan?.confirmation.targets[0]?.id ??
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
  const cue =
    step === "start"
      ? "Let’s make the next visit easier."
      : step === "message"
        ? "Keep the visitor’s own words."
        : step === "confirm"
          ? "Choose the feature in the scene, then confirm."
          : placing
            ? "Tap a clear spot on the map."
            : step === "edit"
              ? "Try a change. You can always undo it."
              : step === "compare"
                ? "Here’s what the change would do."
                : "Your plan is saved for the next visit.";
  return (
    <main className="guided-workspace">
      <header className="guide-header">
        <button className="quiet-button" onClick={onHome} aria-label="Home">
          ←
        </button>
        <div className="guide-place">
          <h1>{scene.title}</h1>
          <span>Prepared example · synthetic</span>
        </div>
        <button
          className="quiet-button"
          onClick={() => details.current?.showModal()}
        >
          Details
        </button>
      </header>
      <div className="guide-tools">
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
            <div className="segmented" aria-label="Scenario comparison">
              <button
                aria-pressed={comparison === "original"}
                onClick={() => setComparison("original")}
              >
                Before
              </button>
              <button
                aria-pressed={comparison === "proposed"}
                onClick={() => setComparison("proposed")}
              >
                After
              </button>
            </div>
            <button className="quiet-button" onClick={undo}>
              ↶ Undo
            </button>
          </div>
        )}
      </div>
      <div className="guide-scene">
        <SpatialView
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
        />
      </div>
      <section className="guide-dock" aria-label="Next action">
        <Companion tone={step === "confirm" ? "evidence" : "guide"}>
          {cue}
        </Companion>
        <div className="guide-action" key={step} ref={actionCard} tabIndex={-1}>
          {step === "start" && (
            <>
              <h2>What could work better here?</h2>
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
                Choose it yourself for now. AI matching is unavailable.
              </p>
            </>
          )}
          {step === "confirm" && (
            <>
              <h2>{selectedFeature?.label ?? "Select a feature"}</h2>
              <div className="action-row">
                <button
                  className="primary"
                  disabled={!selectedFeature}
                  onClick={confirm}
                >
                  Yes, this feature <span>→</span>
                </button>
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
                </select>
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
              <div
                className="compact-comparison"
                aria-label="Before and after comparison"
              >
                <div>
                  <span>Before</span>
                  <strong
                    className={`result-${baseline.destinations[0]?.status}`}
                  >
                    {outcome(baseline.destinations[0]?.status ?? "unknown")}
                  </strong>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <span>After</span>
                  <strong
                    className={`result-${proposed.destinations[0]?.status}`}
                  >
                    {outcome(proposed.destinations[0]?.status ?? "unknown")}
                  </strong>
                </div>
              </div>
              <p className="subtle-line">
                {destination} · Modeled result, not a change made on site.
              </p>
              <div className="action-row">
                <button className="primary" onClick={save}>
                  Save improvement plan <span>→</span>
                </button>
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
                  Try another change
                </button>
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
                    Back to my places <span>→</span>
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
      </section>
      <dialog ref={details} className="guide-dialog" aria-label="Plan details">
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
    </main>
  );
}
