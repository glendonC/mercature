import { useLanguage } from '../i18n';
/** UI boundary for the language session. Spot IDs must match selectable scene features. */
export type AIResult = {
  messageType: string;
  issueType: string;
  state: 'matched' | 'not-sure';
  spots: readonly {id: string; label: string}[];
};
export type AIResultLabels = {region: string; message: string; issue: string; notSure: string; suggested: string; none: string};
export default function AIResultCard({result, selectedId, onSpot, onNotSure, labels, numbered = false, hideEmpty = false}: {
  result: AIResult;
  selectedId: string | null;
  onSpot: (id: string) => void;
  onNotSure: () => void;
  labels?: AIResultLabels;
  /** Shows each spot's rank, matching the numbers on the map. */
  numbered?: boolean;
  /** Leaves out the spot choices when there are none to offer. */
  hideEmpty?: boolean;
}) {
  const { t } = useLanguage();
  const words = labels ?? {region: t('ai.label'), message: t('ai.message'), issue: t('ai.issue'), notSure: t('ai.notSure'), suggested: t('ai.suggested'), none: t('ai.none')};
  return <section className="ai-result-card" aria-label={words.region}>
    <dl><div><dt>{words.message}</dt><dd>{result.messageType}</dd></div>{result.issueType && <div><dt>{words.issue}</dt><dd>{result.issueType}</dd></div>}</dl>
    {result.state === 'not-sure' && <p role="status">{words.notSure}</p>}
    {!(hideEmpty && !result.spots.length) && <div className="ai-result-spots" aria-label={words.suggested}>
      {result.spots.slice(0, 3).map((spot, index) => <button key={spot.id} aria-pressed={selectedId === spot.id} onClick={() => onSpot(spot.id)}>{numbered && <span className="ai-rank" aria-hidden="true">{index + 1}</span>}{spot.label}</button>)}
      <button onClick={onNotSure}>{words.none}</button>
    </div>}
  </section>;
}
