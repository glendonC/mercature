import { useState } from 'react';
import { EDIT_KINDS, ownNote, type EditKind, type NoteLang, type OwnNote } from '../../edits/store';
import { EDIT_WORDS, type EditWords } from '../../edits/words';
import NoteField from './NoteField';
import './edit.css';

type Props = {
  /** Where on the walk this spot would be, in the canvas's own words. */
  where: string;
  range: { from: number; to: number };
  onAdd: (kind: EditKind, note: OwnNote) => void;
  onCancel: () => void;
  /** The canvas's language guess for her note; English when it is not given. */
  guess?: (text: string) => string;
  words?: EditWords;
};

const asLang = (value: string): NoteLang => value === 'es' || value === 'ko' || value === 'other' ? value : 'en';

/** A spot she knows about that no photo showed. Her record, never a measurement. */
export default function AddSpot({ where, range, onAdd, onCancel, guess, words = EDIT_WORDS }: Props) {
  const [kind, setKind] = useState<EditKind | null>(null);
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<NoteLang | null>(null);
  const language = chosen ?? asLang(guess?.(text) ?? 'en');
  return <section className="edit-panel" aria-label={words.addTitle}>
    <h2 className="edit-title">{words.addTitle}</h2>
    <p className="edit-where">{words.addWhere(where, Math.round(range.from), Math.round(range.to))}</p>
    <div className="edit-kinds" role="group" aria-label={words.addTitle}>
      {EDIT_KINDS.map(item => <button key={item} type="button" className="edit-chip" aria-pressed={kind === item} onClick={() => setKind(item)}>{words.kinds[item]}</button>)}
    </div>
    <NoteField id="add-note" label={words.noteLabel} value={text} language={language} onChange={setText} onLanguage={setChosen} words={words}/>
    <p className="edit-quiet">{words.noteKept}</p>
    <div className="edit-actions">
      <button type="button" className="edit-text-button" onClick={onCancel}>{words.cancel}</button>
      <button type="button" className="edit-go" disabled={!kind} onClick={() => kind && onAdd(kind, ownNote(text, language))}>{words.add}</button>
    </div>
  </section>;
}
