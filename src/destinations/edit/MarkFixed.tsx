import { useState } from 'react';
import { ownNote, type NoteLang, type OwnNote } from '../../edits/store';
import { EDIT_WORDS, recordDate, type EditWords } from '../../edits/words';
import NoteField from './NoteField';
import './edit.css';

type Props = {
  /** The spot in the canvas's own words, so this panel names no spot of its own. */
  spot: string;
  /** The day she is recording, already in the reader's language. */
  date?: string;
  onFix: (note: OwnNote) => void;
  onCancel: () => void;
  guess?: (text: string) => string;
  words?: EditWords;
};

const asLang = (value: string): NoteLang => value === 'es' || value === 'ko' || value === 'other' ? value : 'en';

/** Her record that a barrier is fixed, with the date. It says what she recorded, not that we checked. */
export default function MarkFixed({ spot, date, onFix, onCancel, guess, words = EDIT_WORDS }: Props) {
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<NoteLang | null>(null);
  const language = chosen ?? asLang(guess?.(text) ?? 'en');
  const day = date ?? recordDate(new Date().toISOString(), 'en');
  return <section className="edit-panel" aria-label={words.fixTitle}>
    <h2 className="edit-title">{words.fixTitle}</h2>
    <p className="edit-where">{spot}</p>
    <p className="edit-quiet">{words.fixOn(day)}</p>
    <NoteField id="fix-note" label={words.fixNoteLabel} value={text} language={language} onChange={setText} onLanguage={setChosen} words={words}/>
    <div className="edit-actions">
      <button type="button" className="edit-text-button" onClick={onCancel}>{words.cancel}</button>
      <button type="button" className="edit-go" onClick={() => onFix(ownNote(text, language))}>{words.fix}</button>
    </div>
  </section>;
}
