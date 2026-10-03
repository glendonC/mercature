import { LANGS, LANG_NAMES, useLanguage } from '.';
import './language-switch.css';

/** The one interface language switch. Every screen that shows it shares the same choice. */
export default function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  return <div className={`language-switch ${className}`.trim()} role="group" aria-label={t('language.label')}>
    {LANGS.map(item => <button key={item} type="button" lang={item} aria-label={LANG_NAMES[item]} title={LANG_NAMES[item]} aria-pressed={lang === item} onClick={() => setLang(item)}>{item.toUpperCase()}</button>)}
  </div>;
}
