import type { Coordinate, Destination } from '../destinations/data';

/** A recorded finding as a mark on the walk. */
export type Mark = { at: Coordinate; barrier: boolean };

const point = (value: unknown): Coordinate | null =>
  Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number' && Number.isFinite(value[0]) && Number.isFinite(value[1]) ? [value[0], value[1]] : null;

/**
 * Every finding a place records, as marks on its walk. The place data keeps only the findings whose photos are published,
 * so until it carries every mark this reads them from the same package or local record. A tag without a position sits mid-stretch.
 */
export async function loadMarks(data: Destination, signal?: AbortSignal): Promise<Mark[]> {
  const kept = data.findings.flatMap(finding => {
    const photo = data.photos.find(item => item.id === finding.photoId);
    return photo ? [{ at: photo.position, barrier: finding.barrier }] : [];
  });
  try {
    const response = await fetch(`${data.assets}${data.localOnly ? 'route.json' : 'place.json'}`, { signal });
    const raw: unknown = response.ok ? await response.json() : null;
    const findings = raw && typeof raw === 'object' && Array.isArray((raw as { findings?: unknown }).findings) ? (raw as { findings: unknown[] }).findings : [];
    const marks = findings.flatMap(item => {
      if (!item || typeof item !== 'object') return [];
      const finding = item as { position?: unknown; stretches?: unknown; barrier?: unknown };
      const index = Array.isArray(finding.stretches) && typeof finding.stretches[0] === 'number' ? finding.stretches[0] : -1;
      const line = data.stretches.find(stretch => stretch.index === index)?.line;
      const at = point(finding.position) ?? (line?.length ? line[Math.floor(line.length / 2)] : null);
      return at ? [{ at, barrier: finding.barrier === true }] : [];
    });
    return marks.length ? marks : kept;
  } catch (error) {
    if (signal?.aborted) throw error;
    return kept;
  }
}
