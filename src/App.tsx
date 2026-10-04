import { useState } from "react";
import Home, { type SavedEntry } from "./home/Home";
import Workspace from "./workspace/Workspace";
import { createPlanStore, type ImprovementPlan, type PlanSummary } from "./plans";
import type { Project } from "./spatial/contracts";
import DestinationWorkspace from "./destinations/DestinationWorkspace";
import type { AuthoredViewState } from "./preparation/Preparation";
import FarmReady from "./preparation/FarmReady";
import RecordedReveal from "./preparation/RecordedReveal";
import { isDestinationId } from "./destinations/data";
import { useLanguage } from "./i18n";
const planStore = createPlanStore();
/** Nothing links here: ?place=farm opens the farm example getting ready, as Home's farm card once did. Read once, then dropped from the address. */
const farmAsked = (() => {
  const query = new URLSearchParams(location.search);
  if (query.get("place") !== "farm") return false;
  query.delete("place");
  const rest = query.toString();
  history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
  return true;
})();
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
    site?: string;
    initialViewState?: AuthoredViewState;
  } | null>(null);
  const [error, setError] = useState(initial.error);
  const [destination, setDestination] = useState<string | null>(null);
  function refresh() {
    const result = planStore.list();
    if (result.ok) setPlans(result.value);
    else setError(result.error.message);
  }
  function openPlan(entry: SavedEntry) {
    const result = planStore.load(entry.id);
    if (!result.ok) return setError(result.error.message);
    setWorkspace({ key: crypto.randomUUID(), plan: result.value });
    setActive("spatial");
    setError("");
  }
  const entries: SavedEntry[] = plans.map((p) => ({ id: p.id, title: p.title, kind: "plan" as const }));
  function openFarm() {
    setActive(workspace?.site === "noor-farm" ? "spatial" : "farm");
    setError("");
  }
  function openDestination(id: string) {
    setDestination(id);
    setActive("destination");
    setError("");
  }
  return (
    <>
      <div hidden={active !== "home"}>
        {active === "home" && (
          <Home
            onFarm={openFarm}
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
            onHome={() => setActive("home")}
            onSave={(plan) => {
              const result = planStore.save(plan);
              if (!result.ok) throw new Error(result.error.message);
              refresh();
            }}
          />
        </div>
      )}
      {active === "farm" && <FarmReady onHome={() => setActive("home")} onReady={(project, initialViewState) => { setWorkspace({key: crypto.randomUUID(), project, site: "noor-farm", initialViewState}); setActive("spatial"); }} />}
      {active === "destination" && destination && (isDestinationId(destination) ? <RecordedReveal key={destination} id={destination} onHome={() => setActive("home")} onOpen={setDestination} onPlace={openDestination} /> : <DestinationWorkspace key={destination} id={destination} onHome={() => setActive("home")} onPlace={openDestination} />)}
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
