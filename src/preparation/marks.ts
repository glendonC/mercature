import type { Coordinate, Destination } from '../destinations/data';

/** A recorded finding as a mark on the tour route. */
export type Mark = { at: Coordinate; barrier: boolean };

/** Every finding the place records, its photo published or not, as a mark on its route. A tag without a position sits mid-stretch. */
export function walkMarks(data: Destination): Mark[] {
  return data.walkFindings.flatMap(finding => {
    const line = data.stretches.find(stretch => stretch.index === finding.stretches[0])?.line;
    const at = finding.position ?? (line?.length ? line[Math.floor(line.length / 2)] : null);
    return at ? [{ at, barrier: finding.barrier }] : [];
  });
}
