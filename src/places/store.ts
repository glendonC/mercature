export type Boundary = {
  west: number;
  south: number;
  east: number;
  north: number;
};
export type Evidence = {
  id: string;
  name: string;
  type: string;
  bytes: number;
  sha256: string;
  addedAt: string;
  localOnly: true;
};
export type Place = {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  boundary: Boundary | null;
  notes: string;
  evidence: Evidence[];
};
const key = "mercature:places:v1";
export function validateBoundary(boundary: Boundary) {
  if (
    !boundary ||
    ![boundary.west, boundary.south, boundary.east, boundary.north].every(
      Number.isFinite,
    ) ||
    boundary.west < -180 ||
    boundary.east > 180 ||
    boundary.south < -90 ||
    boundary.north > 90 ||
    boundary.west >= boundary.east ||
    boundary.south >= boundary.north
  )
    throw new Error(
      "Enter a valid boundary: west before east, south before north.",
    );
}
function validatePlace(value: unknown): asserts value is Place {
  if (!value || typeof value !== "object")
    throw new Error("Saved place is invalid.");
  const p = value as Place;
  if (
    p.version !== 1 ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 120 ||
    typeof p.createdAt !== "string" ||
    typeof p.notes !== "string" ||
    p.notes.length > 20000 ||
    !Array.isArray(p.evidence) ||
    p.evidence.length > 100
  )
    throw new Error("Saved place is invalid.");
  if (p.boundary !== null) validateBoundary(p.boundary);
  for (const e of p.evidence)
    if (
      !e ||
      typeof e.id !== "string" ||
      typeof e.name !== "string" ||
      typeof e.type !== "string" ||
      !Number.isFinite(e.bytes) ||
      e.bytes < 0 ||
      typeof e.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(e.sha256) ||
      e.localOnly !== true ||
      typeof e.addedAt !== "string"
    )
      throw new Error("Saved evidence is invalid.");
}
export function listPlaces(): Place[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  if (raw.length > 2000000)
    throw new Error("Saved places exceed the supported size.");
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > 100)
    throw new Error("Saved places are invalid.");
  values.forEach(validatePlace);
  return values;
}
export function savePlace(place: Place) {
  validatePlace(place);
  const places = listPlaces();
  const i = places.findIndex((p) => p.id === place.id);
  if (i < 0) {
    if (places.length >= 100)
      throw new Error("This browser has reached the 100-place limit.");
    places.unshift(place);
  } else places[i] = place;
  const raw = JSON.stringify(places);
  if (raw.length > 2000000)
    throw new Error("Saved places exceed the supported size.");
  localStorage.setItem(key, raw);
}
export function createPlace(name: string): Place {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    boundary: null,
    notes: "",
    evidence: [],
  };
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("mercature-evidence", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error("Local evidence storage is unavailable."));
  });
}
export async function putEvidence(file: File): Promise<Evidence> {
  if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime))$/.test(file.type))
    throw new Error("Use JPEG, PNG, WebP, MP4, MOV or WebM files.");
  if (file.size > 20 * 1024 * 1024 || !file.size)
    throw new Error("Each evidence file must be between 1 byte and 20 MB.");
  const data = await file.arrayBuffer();
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const evidence: Evidence = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    bytes: file.size,
    sha256,
    addedAt: new Date().toISOString(),
    localOnly: true,
  };
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, evidence.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("Evidence could not be saved. Storage may be full."));
    tx.onabort = () => reject(new Error("Evidence save was interrupted."));
  }).finally(() => db.close());
  return evidence;
}
export async function readEvidence(id: string): Promise<Blob | null> {
  const db = await database();
  return new Promise<Blob | null>((resolve, reject) => {
    const req = db.transaction("files").objectStore("files").get(id);
    req.onsuccess = () =>
      resolve(req.result instanceof Blob ? req.result : null);
    req.onerror = () => reject(new Error("Could not read this evidence file."));
  }).finally(() => db.close());
}
