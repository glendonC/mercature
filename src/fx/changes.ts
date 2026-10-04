import { useEffect, useState } from 'react';

/** What one of her edits just did to a marker: fixed or unfixed, a spot added, removed or restored. */
export type Change = 'fixed' | 'unfixed' | 'added' | 'removed' | 'restored';
/** A marker's change, the state it left, and when it happened, on the performance.now() clock the motion layer draws by. */
export type Changed = { change: Change; was: string | null; at: number };

/** States that mean a possible barrier, drawn in clay. */
const POSSIBLE = new Set(['open', 'barrier']);

/** The change an edit makes between a marker's last state and its state now; a marker first seen is a spot she added when it is a possible barrier. */
export function changeOf(before: string | undefined, now: string): Change | null {
  if (before === undefined) return now === 'barrier' ? 'added' : null;
  if (before === now) return null;
  if (now === 'fixed') return POSSIBLE.has(before) ? 'fixed' : null;
  if (now === 'not-barrier') return POSSIBLE.has(before) ? 'removed' : null;
  if (POSSIBLE.has(now)) return before === 'fixed' ? 'unfixed' : before === 'not-barrier' ? 'restored' : null;
  return null;
}

const NONE: ReadonlyMap<string, Changed> = new Map();

/**
 * The markers an edit has just changed, each kept until its motion has played. Nothing on the first render, so a map
 * that opens with fixed or removed spots shows them as they are. A change is found in the same render as the new
 * state, so the marker's motion starts with it and no transition of the old style runs first.
 */
export function useChanges(markers: readonly { id: string; state: string }[], hold = 900): ReadonlyMap<string, Changed> {
  const key = markers.map(marker => `${marker.id}\u0000${marker.state}`).join('\u0001');
  const [seen, setSeen] = useState<{ key: string; states: ReadonlyMap<string, string> } | null>(null);
  const [changes, setChanges] = useState(NONE);
  if (seen?.key !== key) {
    const states = new Map(markers.map(marker => [marker.id, marker.state] as const));
    setSeen({ key, states });
    if (seen) {
      const at = performance.now(), found = new Map<string, Changed>();
      for (const [id, state] of states) { const was = seen.states.get(id), change = changeOf(was, state); if (change) found.set(id, { change, was: was ?? null, at }); }
      if (found.size) setChanges(current => new Map([...current, ...found]));
    }
  }
  // Each change goes once its motion has played.
  useEffect(() => {
    if (!changes.size) return;
    const due = Math.min(...[...changes.values()].map(item => item.at)) + hold - performance.now();
    const timer = window.setTimeout(() => setChanges(current => {
      const now = performance.now(), kept = new Map([...current].filter(([, item]) => now - item.at < hold - 1));
      return kept.size ? kept : NONE;
    }), Math.max(0, due));
    return () => clearTimeout(timer);
  }, [changes, hold]);
  return changes;
}
