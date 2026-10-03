/** UI boundary for the language session. Spot IDs must match selectable scene features. */
export type AIResult = {
  messageType: string;
  issueType: string;
  state: 'matched' | 'not-sure';
  spots: readonly {id: string; label: string}[];
};
export default function AIResultCard({result, selectedId, onSpot, onNotSure}: {
  result: AIResult;
  selectedId: string | null;
  onSpot: (id: string) => void;
  onNotSure: () => void;
}) {
  return <section className="ai-result-card" aria-label="Message interpretation">
    <dl><div><dt>Message</dt><dd>{result.messageType}</dd></div>{result.issueType && <div><dt>Issue</dt><dd>{result.issueType}</dd></div>}</dl>
    {result.state === 'not-sure' && <p role="status">Not sure. Choose a spot in the scene.</p>}
    <div className="ai-result-spots" aria-label="Suggested spots">
      {result.spots.slice(0, 3).map(spot => <button key={spot.id} aria-pressed={selectedId === spot.id} onClick={() => onSpot(spot.id)}>{spot.label}</button>)}
      <button onClick={onNotSure}>None of these</button>
    </div>
  </section>;
}
