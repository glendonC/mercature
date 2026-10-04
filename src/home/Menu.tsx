import { useRef } from 'react';
import { DESTINATIONS } from '../destinations/data';
import { LANGS, LANG_NAMES, useLanguage, type Lang } from '../i18n';
import { List, Panel, PanelHead, Row, Section, Segmented, IconButton, TextButton } from '../ui';
import { CloseIcon, HomeIcon, MoreIcon } from '../ui/icons';
import { covers } from './Home';
import './menu.css';

/** The places any screen can reach from the menu. */
export type MenuPlace = 'cusco-qorikancha';
type Props = {
  /** Omitted on Home itself, where there is nowhere to go back to. */
  onHome?: () => void;
  onPlace: (place: MenuPlace) => void;
  /** The place this screen is showing, so the menu can mark it. */
  current?: MenuPlace;
  className?: string;
};

/**
 * One small button, one charcoal surface: where to go, which language, and where everything came from.
 * It opens as a modal dialog, so Escape closes it, focus stays inside while it is open and returns to the button.
 */
export default function Menu({ onHome, onPlace, current, className = '' }: Props) {
  const { t, lang, setLang } = useLanguage();
  const sheet = useRef<HTMLDialogElement>(null);
  const close = () => sheet.current?.close();
  const go = (run: () => void) => { close(); run(); };
  return <>
    <IconButton label={t('home.menu')} className={`menu-button ${className}`.trim()} onClick={() => sheet.current?.showModal()}><MoreIcon/></IconButton>
    <dialog ref={sheet} className="menu-dialog" aria-label={t('home.menu')} onClick={event => { if (event.target === sheet.current) close(); }}>
      <Panel size="card" phone="sheet" scroll className="menu-panel">
        <PanelHead title={t('home.menu')} actions={<IconButton label={t('home.closeMenu')} onClick={close}><CloseIcon/></IconButton>}/>
        <List>
          {onHome && <Row icon={<HomeIcon/>} label={t('common.home')} onClick={() => go(onHome)}/>}
          <Row label={DESTINATIONS['cusco-qorikancha'].name} detail={covers[0].area} selected={current === 'cusco-qorikancha'} onClick={() => go(() => onPlace('cusco-qorikancha'))}/>
        </List>
        <Section title={t('language.label')}>
          <Segmented label={t('language.label')} value={lang} onChange={(next: Lang) => setLang(next)}
            options={LANGS.map(item => ({ value: item, label: LANG_NAMES[item], lang: item }))}/>
        </Section>
        <Section title={t('home.sources')}>
          <p className="menu-source">{t('home.sourceMap')}</p>
          <p className="menu-source">{t('home.sourcePhotos')}</p>
          <p className="menu-source">{t('home.sourceModel')}</p>
          <p className="menu-source">{t('home.creditsNote')}</p>
          <ul className="menu-covers">{covers.map(item => <li key={item.name}>
            <a href={item.source} target="_blank" rel="noreferrer">{item.name}</a> · {item.author}, {item.year} · <a href={item.licenseUrl} target="_blank" rel="noreferrer">{item.license}</a>
          </li>)}</ul>
        </Section>
      </Panel>
    </dialog>
  </>;
}
