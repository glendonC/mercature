import { NOTE_LANGS, NOTE_LIMIT, type NoteLang } from '../../edits/store';
import { EDIT_WORDS, type EditWords } from '../../edits/words';
import './edit.css';

type Props = {
  value: string;
  language: NoteLang;
  onChange: (text: string) => void;
  onLanguage: (language: NoteLang) => void;
  label: string;
  id: string;
  words?: EditWords;
};

/**
 * Her own words, with the language they were taken as and a way to correct it.
 * The language decides which visitor note carries them, so she can always see and change it.
 */
export default function NoteField({ value, language, onChange, onLanguage, label, id, words = EDIT_WORDS }: Props) {
  return <div className="edit-note">
    <label className="edit-label" htmlFor={id}>{label}</label>
    <textarea id={id} className="edit-field" rows={2} maxLength={NOTE_LIMIT} placeholder={words.notePlaceholder} value={value} onChange={event => onChange(event.target.value)}/>
    {value.trim() && <div className="edit-taken">
      <label className="edit-quiet" htmlFor={`${id}-language`}>{words.changeLanguage}</label>
      <select id={`${id}-language`} className="edit-select" aria-label={words.changeLanguage} value={language} onChange={event => onLanguage(event.target.value as NoteLang)}>
        {NOTE_LANGS.map(item => <option key={item} value={item}>{words.languages[item]}</option>)}
      </select>
    </div>}
  </div>;
}
