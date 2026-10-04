import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import SceneFrame from '../components/SceneFrame';
import SceneProgress from '../components/SceneProgress';
import Companion from '../components/Companion';
import { useLanguage } from '../i18n';
import './preparation.css';

type PreparationProps = {
  optionsContent?: ReactNode;
  title: string;
  provenance: string;
  sourceLabel?: string;
  stage: 'views' | 'scene';
  busy: boolean;
  message: string;
  detail?: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  onHome: () => void;
  onSkip: () => void;
  error?: string;
};
/** A presentation of real preparation state. Stage changes never stand in for processing. */
export function Preparation({optionsContent, title, provenance, sourceLabel, stage, busy, message, detail, children, action, onAction, onHome, onSkip, error}: PreparationProps) {
  const { t } = useLanguage();
  const optionsId = useId();
  const optionsRef = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, [stage]);
  return <SceneFrame className="preparation" label={t('prep.label', { title })} step={stage}
    progress={<SceneProgress title={t('prep.progress')} items={[
      {id:'views',label:sourceLabel ?? t('prep.views'),state:stage === 'views' ? 'current' : 'complete'},
      {id:'scene',label:t('prep.openScene'),state:stage === 'scene' ? 'current' : 'upcoming'},
    ]}/>}
    scene={<section className="preparation-stage" aria-label={t('prep.preview')}>{children}</section>}
    context={<>
      <div className="context-panel-head"><span className="scene-caption">{provenance}</span><button className="dialogue-options" popoverTarget={optionsId} aria-label={t('prep.options')}>•••</button></div>
      <div className="preparation-task"><h1>{title}</h1>{detail && <p className="context-description">{detail}</p>}
      {error && <p role="alert" className="preparation-error">{error}</p>}
      {action && <button className="primary" disabled={busy} onClick={onAction}>{action}</button>}
      </div>
    </>}
    dialogue={<><span className="preparation-announcement" role="status">{message}</span>
      <div className="preparation-speaker">{busy ? <ThinkingOrb state="connecting" size={64} theme="light" /> : <Companion tone={stage === 'views' ? 'evidence' : 'guide'}><span className="sr-only">{t('prep.guide')}</span></Companion>}</div>
      <h2 className={busy ? "is-processing" : undefined} ref={heading} tabIndex={-1}>{message}</h2>
    </>}>
    <div popover="auto" id={optionsId} ref={optionsRef} className="scene-options" onClick={event => {
      if ((event.target as HTMLElement).closest('button')) optionsRef.current?.hidePopover();
    }}><p>{title}<span>{provenance}</span></p>{optionsContent}<div className="scene-options-links"><button onClick={onHome} aria-label={t('common.home')}>{t('common.returnHome')}</button><button onClick={onSkip}>{t('prep.skip')}</button></div></div>
  </SceneFrame>;
}

/** Where the spatial workspace opens: the selected feature and the view's rotation. */
export type AuthoredViewState = {selectedId: string | null; rotation: number};
