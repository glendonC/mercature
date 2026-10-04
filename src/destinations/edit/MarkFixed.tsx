import { useState } from 'react';
import { ownNote, type NoteLang, type OwnNote } from '../../edits/store';
import { EDIT_WORDS, recordDate, type EditWords } from '../../edits/words';
import { PrimaryAction, Section, TextButton } from '../../ui';
import { CloseIcon, FixedIcon } from '../../ui/icons';
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
  return <Section title={words.fixTitle} label={words.fixTitle} className="edit-section">
    <p className="edit-where">{spot}</p>
    <p className="edit-quiet">{words.fixOn(day)}</p>
    <NoteField id="fix-note" label={words.fixNoteLabel} value={text} language={language} onChange={setText} onLanguage={setChosen} words={words}/>
    <div className="edit-actions">
      <TextButton muted icon={<CloseIcon/>} onClick={onCancel}>{words.cancel}</TextButton>
      <PrimaryAction icon={<FixedIcon/>} shortcut="mod+enter" onClick={() => onFix(ownNote(text, language))}>{words.fix}</PrimaryAction>
    </div>
  </Section>;
}
