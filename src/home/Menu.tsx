import { useRef } from 'react';
import { DESTINATIONS } from '../destinations/data';
import { NOOR_FARM } from '../site/farm';
import { LANGS, LANG_NAMES, useLanguage } from '../i18n';
import { covers } from './Home';
import './menu.css';

/** The places any screen can reach from the menu. */
export type MenuPlace = 'cusco-qorikancha' | 'noor-farm';
type Props = {
  /** Omitted on Home itself, where there is nowhere to go back to. */
  onHome?: () => void;
  onPlace: (place: MenuPlace) => void;
  /** The place this screen is showing, so the menu can mark it. */
  current?: MenuPlace;
  className?: string;
};

const MenuIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>;

/**
 * One small button, one full-screen sheet: where to go, which language, and where everything came from.
 * The sheet is a modal dialog, so Escape closes it, focus stays inside while it is open and returns to the button.
 */
export default function Menu({ onHome, onPlace, current, className = '' }: Props) {
  const { t, lang, setLang } = useLanguage();
  const sheet = useRef<HTMLDialogElement>(null);
  const close = () => sheet.current?.close();
  const go = (run: () => void) => { close(); run(); };
  const cover = covers[0];
  return <>
    <button type="button" className={`menu-button ${className}`.trim()} aria-label={t('home.menu')} onClick={() => sheet.current?.showModal()}><MenuIcon/></button>
    <dialog ref={sheet} className="menu-sheet" aria-label={t('home.menu')} onClick={event => { if (event.target === sheet.current) close(); }}>
      <div className="menu-inner">
        <header className="menu-top">
          <span className="menu-brand">mercature</span>
          <button type="button" className="menu-text" onClick={close}>{t('home.closeMenu')}</button>
        </header>

        {onHome && <nav className="menu-group"><button type="button" className="menu-row" onClick={() => go(onHome)}>{t('common.home')}</button></nav>}

        <section className="menu-group" aria-labelledby="menu-places">
          <h2 className="menu-label" id="menu-places">{t('home.onPhone')}</h2>
          <button type="button" className="menu-row" aria-current={current === 'cusco-qorikancha' || undefined} onClick={() => go(() => onPlace('cusco-qorikancha'))}>
            <span>{DESTINATIONS['cusco-qorikancha'].name}</span><small>{cover.area}</small>
          </button>
          <button type="button" className="menu-row" aria-current={current === 'noor-farm' || undefined} onClick={() => go(() => onPlace('noor-farm'))}>
            <span>{NOOR_FARM.name[lang]}</span><small>{t('common.example')}</small>
          </button>
        </section>

        <section className="menu-group" aria-labelledby="menu-language">
          <h2 className="menu-label" id="menu-language">{t('language.label')}</h2>
          <div className="menu-languages" role="group" aria-labelledby="menu-language">
            {LANGS.map(item => <button key={item} type="button" className="menu-chip" lang={item} aria-pressed={lang === item} onClick={() => setLang(item)}>{LANG_NAMES[item]}</button>)}
          </div>
        </section>

        <section className="menu-group" aria-labelledby="menu-sources">
          <h2 className="menu-label" id="menu-sources">{t('home.sources')}</h2>
          <p className="menu-source">{t('home.sourceMap')}</p>
          <p className="menu-source">{t('home.sourcePhotos')}</p>
          <p className="menu-source">{t('home.sourceModel')}</p>
          <p className="menu-source">{t('home.creditsNote')}</p>
          <ul className="menu-covers">{covers.map(item => <li key={item.name}>
            <a href={item.source} target="_blank" rel="noreferrer">{item.name}</a> · {item.author}, {item.year} · <a href={item.licenseUrl} target="_blank" rel="noreferrer">{item.license}</a>
          </li>)}</ul>
        </section>
      </div>
    </dialog>
  </>;
}
