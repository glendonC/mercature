import { ACCESS_KINDS, type AccessFinding, type AccessKind } from './access.ts';

/**
 * One thing the guide asks her to check on a walk: every OpenStreetMap finding of one kind, where it lies and what
 * OpenStreetMap says there. barrier: one of its findings may be a barrier, as the walk marks them. says: each distinct
 * line OpenStreetMap gives, with its stretches, the most widespread first. Nobody has checked any of it on site.
 */
export type CheckItem = {
  readonly kind: AccessKind;
  readonly label: string;
  readonly barrier: boolean;
  readonly stretches: readonly number[];
  readonly says: readonly { readonly value: string; readonly label: string; readonly stretches: readonly number[] }[];
  readonly findings: readonly string[];
};
export type CheckFinding = Pick<AccessFinding, 'id' | 'kind' | 'value' | 'label' | 'barrier' | 'stretches'>;

/** The order she goes through them in: what may block the way first, then crossings and the ground, then what helps on the way. */
const ORDER: readonly AccessKind[] = ['steps', 'kerb', 'gate', 'bollard', 'crossing', 'tactile_paving', 'surface', 'smoothness', 'bench', 'toilets', 'lit', 'handrail', 'ramp', 'wheelchair'];
/** A slope or a width is never said on a walk; such a line is dropped even if a caller passes one in. */
const MEASURE = /\b(width|wide|incline|slope|gradient|steep)\b|\d\s?(cm|mm|%|°)/i;
const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

/** Groups a walk's OpenStreetMap findings into the guide's check items, barrier items first. */
export function checkItems(findings: readonly CheckFinding[]): CheckItem[] {
  const items: CheckItem[] = [];
  for (const kind of ORDER) {
    const all = findings.filter(finding => finding.kind === kind && finding.stretches.length && !MEASURE.test(finding.label));
    if (!all.length) continue;
    const lines = new Map<string, { value: string; label: string; stretches: number[] }>();
    for (const finding of all) {
      const line = lines.get(finding.label) ?? { value: finding.value, label: finding.label, stretches: [] };
      line.stretches = sorted([...line.stretches, ...finding.stretches]);
      lines.set(finding.label, line);
    }
    items.push({
      kind, label: ACCESS_KINDS.find(item => item.kind === kind)?.label ?? kind, barrier: all.some(finding => finding.barrier),
      stretches: sorted(all.flatMap(finding => finding.stretches)),
      says: [...lines.values()].sort((a, b) => b.stretches.length - a.stretches.length || a.stretches[0] - b.stretches[0]),
      findings: all.map(finding => finding.id),
    });
  }
  return [...items.filter(item => item.barrier), ...items.filter(item => !item.barrier)];
}
