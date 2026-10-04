import { useState } from 'react';
import { ownNote, type NoteLang, type OwnNote as Note } from '../../edits/store';
import { EDIT_WORDS, type EditWords } from '../../edits/words';
import { PrimaryAction, Section, TextButton } from '../../ui';
import { CheckIcon, CloseIcon, RemoveIcon } from '../../ui/icons';
import NoteField from './NoteField';
import './edit.css';

type Props = {
  /** What she has already written here, if anything. */
  value?: Note;
  onSave: (note: Note) => void;
  onCancel?: () => void;
  guess?: (text: string) => string;
  words?: EditWords;
};

const asLang = (value: string): NoteLang => value === 'es' || value === 'ko' || value === 'other' ? value : 'en';

/** Her own words about any spot, recorded or added. */
export default function OwnNote({ value, onSave, onCancel, guess, words = EDIT_WORDS }: Props) {
  const [text, setText] = useState(value?.text ?? '');
  const [chosen, setChosen] = useState<NoteLang | null>(value?.text ? value.language : null);
  const language = chosen ?? asLang(guess?.(text) ?? 'en');
  const had = !!value?.text;
  return <Section label={words.yourNote} className="edit-section">
    <NoteField id="spot-note" label={words.yourNote} value={text} language={language} onChange={setText} onLanguage={setChosen} words={words}/>
    <p className="edit-quiet">{words.noteKept}</p>
    <div className="edit-actions">
      {onCancel && <TextButton muted icon={<CloseIcon/>} onClick={onCancel}>{words.cancel}</TextButton>}
      {had && !text.trim() && <TextButton muted icon={<RemoveIcon/>} onClick={() => onSave(ownNote('', language))}>{words.remove}</TextButton>}
      <PrimaryAction icon={<CheckIcon/>} shortcut="mod+enter" disabled={!text.trim() && !had} onClick={() => onSave(ownNote(text, language))}>{words.save}</PrimaryAction>
    </div>
  </Section>;
}
