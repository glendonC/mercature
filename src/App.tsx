import { useEffect, useState } from "react";
import Home, { type SavedEntry } from "./home/Home";
import Workspace from "./workspace/Workspace";
import { createPlanStore, type ImprovementPlan, type PlanSummary } from "./plans";
import type { Project } from "./spatial/contracts";
import FarmReady, { type AuthoredViewState } from "./preparation/FarmReady";
import RecordedReveal from "./preparation/RecordedReveal";
import { isDestinationId, type DestinationId } from "./destinations/data";
import { useLanguage } from "./i18n";
const planStore = createPlanStore();
/** Nothing links here: ?place=farm opens the farm example getting ready. Read once, then dropped from the address. */
const farmAsked = (() => {
  const query = new URLSearchParams(location.search);
  if (query.get("place") !== "farm") return false;
  query.delete("place");
  const rest = query.toString();
  history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
  return true;
})();
/** The history entry a screen opened from Home adds, naming what it shows: Back returns Home, Forward opens it again. */
type Opened = { kind: "destination"; id: DestinationId } | { kind: "plan"; id: string };
const openedOf = (state: unknown): Opened | null => (state as { mercatureOpened?: Opened } | null)?.mercatureOpened ?? null;
/** One entry for whatever is open: the first screen from Home adds it, a move between screens replaces it, so Back is always one step to Home. */
function remember(opened: Opened) {
  const state = { mercatureOpened: opened };
  if (openedOf(history.state)) history.replaceState(state, "");
  else history.pushState(state, "");
}
function initialSaved() {
  const result = planStore.list();
  return { plans: result.ok ? result.value : [], error: result.ok ? "" : result.error.message };
}
export default function App() {
  const { t } = useLanguage();
  const [initial] = useState(initialSaved);
  const [active, setActive] = useState<"home" | "spatial" | "destination" | "farm">(farmAsked ? "farm" : "home");
  const [plans, setPlans] = useState<PlanSummary[]>(initial.plans);
  const [workspace, setWorkspace] = useState<{
    key: string;
    plan?: ImprovementPlan;
    project?: Project;
    initialViewState?: AuthoredViewState;
  } | null>(null);
  const [error, setError] = useState(initial.error);
  const [destination, setDestination] = useState<DestinationId | null>(null);
  function refresh() {
    const result = planStore.list();
    if (result.ok) setPlans(result.value);
    else setError(result.error.message);
  }
  function openPlan(entry: SavedEntry, from: "home" | "history" = "home") {
    const result = planStore.load(entry.id);
    if (!result.ok) return setError(result.error.message);
    if (from === "home") remember({ kind: "plan", id: entry.id });
    setWorkspace({ key: crypto.randomUUID(), plan: result.value });
    setActive("spatial");
    setError("");
  }
  const entries: SavedEntry[] = plans.map((p) => ({ id: p.id, title: p.title, kind: "plan" as const }));
  function openDestination(id: string, from: "home" | "history" = "home") {
    if (!isDestinationId(id)) return;
    if (from === "home") remember({ kind: "destination", id });
    setDestination(id);
    setActive("destination");
    setError("");
  }
  /** Home from any screen, the menu's included, steps back through the entry its screen added, as the browser's Back and Android's back gesture do. */
  function goHome() {
    if (openedOf(history.state)) history.back();
    else setActive("home");
  }
  useEffect(() => {
    const move = (event: PopStateEvent) => {
      const opened = openedOf(event.state);
      if (!opened) setActive("home");
      else if (opened.kind === "destination") openDestination(opened.id, "history");
      else openPlan({ id: opened.id, title: "", kind: "plan" }, "history");
    };
    addEventListener("popstate", move);
    return () => removeEventListener("popstate", move);
  }, []);
  return (
    <>
      <div hidden={active !== "home"}>
        {active === "home" && (
          <Home
            onDestination={openDestination}
            saved={entries}
            onOpenSaved={openPlan}
          />
        )}
      </div>
      {workspace && (
        <div hidden={active !== "spatial"}>
          <Workspace
            key={workspace.key}
            initialViewState={workspace.initialViewState}
            initialPlan={workspace.plan}
            initialProject={workspace.project}
            onHome={goHome}
            onSave={(plan) => {
              const result = planStore.save(plan);
              if (!result.ok) throw new Error(result.error.message);
              refresh();
            }}
          />
        </div>
      )}
      {active === "farm" && <FarmReady onHome={goHome} onReady={(project, initialViewState) => { setWorkspace({key: crypto.randomUUID(), project, initialViewState}); setActive("spatial"); }} />}
      {active === "destination" && destination && <RecordedReveal key={destination} id={destination} onHome={goHome} onOpen={openDestination} onPlace={openDestination} />}
      {error && (
        <div className="app-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label={t("app.dismissError")}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
