import { assetUrl, type Coordinate, type Destination, type Finding, type Photo, type View } from '../destinations/data';
import { BARRIER_KINDS, MARK_ORDER, markOf } from '../ui/kinds';

/** One outline the model drew on a photo, in view pixels. Nobody has checked it.
 * id: the finding id when the mark is one of the place's findings, else the scan mark id.
 * barrier: its kind can be a barrier (steps, kerb, broken pavement), drawn in the clay family.
 * flagged: one of the walk's possible barriers, drawn heavier and labelled first.
 * label: the record's words for this mark (a finding's own words when it is one); kindLabel: the words for its kind ('Steps', 'Handrail'), for a chip. */
export type PhotoMark = { id: string; concept: string; label: string; kindLabel?: string; outline: Coordinate[]; barrier: boolean; flagged: boolean; finding: string | null };
/** Everything one view needs: the view, its photo for the credit, the image URL and every mark on it. */
export type Shown = { view: View; photo: Photo; src: string; marks: PhotoMark[] };

const SURFACES: ReadonlySet<string> = new Set(['footway', 'cobblestones', 'road', 'crossing']);
const fromFinding = (data: Destination, f: Finding): PhotoMark => ({ id: f.id, concept: f.concept || f.label, label: f.label, kindLabel: data.scan?.kinds.find(k => k.concept === f.concept)?.label, outline: f.outline,
  barrier: BARRIER_KINDS.has(markOf(f.concept || f.label) ?? 'road'), flagged: f.barrier, finding: f.id });

/** Every outline on one view: the scan's marks, a mark that is a finding keeping the finding's id and words, and any finding the scan does not name. */
export function marksOn(data: Destination, viewId: string): PhotoMark[] {
  const findings = new Map(data.findings.map(f => [f.id, f])), used = new Set<string>(), result: PhotoMark[] = [];
  for (const m of data.marks) {
    if (m.viewId !== viewId || m.outline.length < 3) continue;
    const finding = m.finding && !used.has(m.finding) ? m.finding : null, id = finding ?? m.id;
    if (used.has(id)) continue;
    used.add(id);
    result.push({ id, concept: m.concept, label: (finding && findings.get(finding)?.label) || m.label, kindLabel: m.label, outline: m.outline, barrier: m.barrier, flagged: m.flagged, finding });
  }
  for (const f of data.findings) if (f.viewId === viewId && f.outline.length > 2 && !used.has(f.id)) { used.add(f.id); result.push(fromFinding(data, f)); }
  return result;
}

/** The view, photo, image and marks for a shipped view, or null when the package leaves the view out. */
export function photoOf(data: Destination, viewId: string | null | undefined): Shown | null {
  const view = viewId ? data.views.find(v => v.id === viewId) : undefined;
  const photo = view && data.photos.find(p => p.id === view.photoId);
  return view && photo ? { view, photo, src: assetUrl(data, view.file), marks: marksOn(data, view.id) } : null;
}

/** The shipped view a finding is drawn on, or null: an OpenStreetMap tag, or a view the package leaves out. */
export function viewOf(data: Destination, findingId: string): string | null {
  const shipped = (id: string | null | undefined) => !!id && data.views.some(v => v.id === id);
  const finding = data.findings.find(f => f.id === findingId);
  if (finding && shipped(finding.viewId) && finding.outline.length > 2) return finding.viewId;
  return data.marks.find(m => m.finding === findingId && m.outline.length > 2 && shipped(m.viewId))?.viewId ?? null;
}

const area = (outline: readonly Coordinate[]) => Math.abs(outline.reduce((sum, p, i) => { const q = outline[(i + 1) % outline.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const kindAt = (m: PhotoMark) => { const kind = markOf(m.concept); const at = kind ? MARK_ORDER.indexOf(kind) : -1; return at < 0 ? MARK_ORDER.length : at; };

/** Drawing layer: the ground first and quiet, other kinds above it, kinds that can be barriers above those, the walk's possible barriers on top. */
export const layerOf = (m: PhotoMark) => m.flagged ? 3 : m.barrier ? 2 : SURFACES.has(markOf(m.concept) ?? '') ? 0 : 1;

/** Marks in drawing order; a larger outline goes under a smaller one of the same layer. */
export function drawOrder(marks: readonly PhotoMark[]): PhotoMark[] {
  return [...marks].sort((a, b) => layerOf(a) - layerOf(b) || area(b.outline) - area(a.outline));
}

/** Marks by how much their label matters: possible barriers, kinds that can be barriers, then the first mark of each other kind, then repeats; a larger outline first within a rank. */
export function labelOrder(marks: readonly PhotoMark[]): PhotoMark[] {
  const ranked = [...marks].sort((a, b) => layerOf(b) - layerOf(a) || kindAt(a) - kindAt(b) || area(b.outline) - area(a.outline));
  const seen = new Set<string>(), first: PhotoMark[] = [], repeats: PhotoMark[] = [];
  for (const m of ranked) {
    const kind = markOf(m.concept) ?? m.concept;
    if (layerOf(m) >= 2 || !seen.has(kind)) { first.push(m); seen.add(kind); } else repeats.push(m);
  }
  return [...first, ...repeats];
}
