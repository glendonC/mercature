import { useRef, useState } from "react";
import Home, { type SavedEntry } from "./home/Home";
import PlaceWorkspace from "./places/PlaceWorkspace";
import Workspace from "./workspace/Workspace";
import Companion from "./components/Companion";
import { createPlace, listPlaces, savePlace, putEvidence, type Place } from "./places/store";
import {
  createPlanStore,
  parsePlan,
  type ImprovementPlan,
  type PlanSummary,
} from "./plans";
import { parseProject } from "./spatial/scenario";
import { solveScene } from "./spatial/solver";
import type { Project } from "./spatial/contracts";
import DestinationWorkspace from "./destinations/DestinationWorkspace";
import AuthoredPreparation, { type AuthoredViewState } from "./preparation/Preparation";
import FarmReady from "./preparation/FarmReady";
import RecordedReveal from "./preparation/RecordedReveal";
import { isDestinationId } from "./destinations/data";
import { getLang, translate, useLanguage } from "./i18n";
const planStore = createPlanStore();
function initialSaved() {
  const result = planStore.list();
  const errors = result.ok ? [] : [result.error.message];
  let places: Place[] = [];
  try {
    places = listPlaces();
  } catch (e) {
    errors.push(translate(getLang(), "error.placesUnreadable", { reason: (e as Error).message }));
  }
  return {
    places,
    plans: result.ok ? result.value : [],
    error: errors.join(" "),
  };
}
export default function App() {
  const { t } = useLanguage();
  const [initial] = useState(initialSaved);
  const [active, setActive] = useState<"home" | "place" | "spatial" | "destination" | "prepare" | "farm">("home");
  const [place, setPlace] = useState<Place | null>(null);
  const [places, setPlaces] = useState<Place[]>(initial.places);
  const [plans, setPlans] = useState<PlanSummary[]>(initial.plans);
  const [workspace, setWorkspace] = useState<{
    key: string;
    plan?: ImprovementPlan;
    project?: Project;
    example?: boolean;
    site?: string;
    initialViewState?: AuthoredViewState;
  } | null>(null);
  const [error, setError] = useState(initial.error);
  const [loading, setLoading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const photoPicker = useRef<HTMLInputElement>(null);
  const uploadName = useRef("");
  const [destination, setDestination] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(() => t("app.opening"));
  function refresh() {
    const errors: string[] = [];
    try {
      setPlaces(listPlaces());
    } catch (e) {
      errors.push(t("error.placesUnreadable", { reason: (e as Error).message }));
    }
    const result = planStore.list();
    if (result.ok) setPlans(result.value);
    else errors.push(result.error.message);
    if (errors.length) setError(errors.join(" "));
  }
  function open(name: string) {
    try {
      const next =
        places.find(
          (p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        ) ?? createPlace(name);
      savePlace(next);
      setPlaces(listPlaces());
      setPlace(next);
      setActive("place");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saved(entry: SavedEntry) {
    try {
      if (entry.kind === "place") {
        const next = places.find((p) => p.id === entry.id);
        if (!next) throw new Error(t("error.placeMissing"));
        setPlace(next);
        setActive("place");
      } else {
        const result = planStore.load(entry.id);
        if (!result.ok) throw new Error(result.error.message);
        setWorkspace({ key: crypto.randomUUID(), plan: result.value });
        setActive("spatial");
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    setLoadingMessage(t("app.opening"));
    setLoading(true);
    setError("");
    try {
      if (file.size > 2000000)
        throw new Error(t("error.fileTooLarge"));
      const text = await file.text();
      const value = JSON.parse(text);
      if (value.schemaVersion === "mercature-plan-v1") {
        const plan = parsePlan(text);
        const restored = planStore.save(plan);
        if (!restored.ok) throw new Error(restored.error.message);
        refresh();
        setWorkspace({ key: crypto.randomUUID(), plan });
      } else {
        const project = parseProject(text);
        solveScene(project.scene, project.profile);
        solveScene(project.scene, project.profile, project.scenario);
        setWorkspace({ key: crypto.randomUUID(), project });
      }
      setActive("spatial");
    } catch (e) {
      setError(t("error.fileOpen", { reason: (e as Error).message }));
    } finally {
      setLoading(false);
      if (picker.current) picker.current.value = "";
    }
  }
  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setLoading(true);
    setError("");
    let next = createPlace(uploadName.current || t("app.untitled"));
    try {
      if (files.length > 100) throw new Error(t("error.tooManyFiles"));
      for (const [index, file] of Array.from(files).entries()) {
        setLoadingMessage(t("app.savingFile", { n: index + 1, total: files.length }));
        const evidence = await putEvidence(file);
        const updated = { ...next, evidence: [...next.evidence, evidence] };
        savePlace(updated);
        next = updated;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (next.evidence.length) {
        setPlace(next);
        setActive("place");
        refresh();
      }
      setLoading(false);
      if (photoPicker.current) photoPicker.current.value = "";
    }
  }
  const entries: SavedEntry[] = [
    ...plans.map((p) => ({ id: p.id, title: p.title, kind: "plan" as const })),
    ...places.map((p) => ({ id: p.id, title: p.name, kind: "place" as const })),
  ];
  return (
    <>
      <div hidden={active !== "home"}>
        {active === "home" && (
          <Home
            onOpen={open}
            onExample={() => {
              setActive(workspace?.example ? "spatial" : "prepare");
            }}
            onFarm={() => {
              setActive(workspace?.site === "noor-farm" ? "spatial" : "farm");
              setError("");
            }}
            onDestination={(id) => { setDestination(id); setActive("destination"); setError(""); }}
            onImport={() => picker.current?.click()}
            onUpload={(name) => { uploadName.current = name; photoPicker.current?.click(); }}
            saved={entries}
            onOpenSaved={saved}
          />
        )}
      </div>
      {place && (
        <div hidden={active !== "place"}>
          <PlaceWorkspace
            key={place.id}
            initial={place}
            onHome={() => setActive("home")}
            onSaved={() => refresh()}
          />
        </div>
      )}
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
      {active === "prepare" && <AuthoredPreparation onHome={() => setActive("home")} onReady={(initialViewState) => { setWorkspace({key: crypto.randomUUID(), example: true, initialViewState}); setActive("spatial"); }} />}
      {active === "farm" && <FarmReady onHome={() => setActive("home")} onReady={(project, initialViewState) => { setWorkspace({key: crypto.randomUUID(), project, site: "noor-farm", initialViewState}); setActive("spatial"); }} />}
      {active === "destination" && destination && (isDestinationId(destination) ? <RecordedReveal key={destination} id={destination} onHome={() => setActive("home")} onOpen={setDestination} /> : <DestinationWorkspace key={destination} id={destination} onHome={() => setActive("home")} />)}
      <input type="file" hidden multiple ref={photoPicker} accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" aria-label={t("app.uploadInput")} onChange={event => void uploadPhotos(event.target.files)} />
      <input
        type="file"
        hidden
        ref={picker}
        accept=".json,application/json"
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      {loading && (
        <div className="loading-dialog" role="status">
          <Companion working>{loadingMessage}</Companion>
        </div>
      )}
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
