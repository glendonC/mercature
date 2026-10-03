import { useEffect, useState, type RefObject } from 'react';
import Companion from './Companion';
import { useLanguage } from '../i18n';

/** Follows the rendered feature, including projection, rotation, resize and scroll. */
export default function ContextualGuide({stageRef, dockRef, selectedId, revision, tone}: {
  stageRef: RefObject<HTMLDivElement | null>;
  dockRef: RefObject<HTMLElement | null>;
  selectedId: string | null;
  revision: string;
  tone: 'guide' | 'evidence' | 'review';
}) {
  const { t } = useLanguage();
  const [anchor, setAnchor] = useState({left: 0, top: 0, contextual: false, ready: false, animate: false});
  useEffect(() => {
    const stage = stageRef.current, dock = dockRef.current;
    if (!stage || !dock) return;
    const update = () => {
      const parent = stage.parentElement!.getBoundingClientRect();
      const panel = dock.getBoundingClientRect();
      const feature = selectedId ? stage.querySelector(`[data-feature-id="${CSS.escape(selectedId)}"]`) : null;
      const bounds = feature?.getBoundingClientRect();
      const candidateLeft = bounds ? bounds.right + 8 : panel.left - 76;
      const candidateTop = bounds ? bounds.top - 65 : panel.top - 5;
      setAnchor(previous => ({
        left: Math.max(12, Math.min(parent.width - 80, candidateLeft - parent.left)),
        top: Math.max(12, Math.min(bounds ? panel.top - parent.top - 72 : parent.height - 76, candidateTop - parent.top)),
        contextual: !!bounds, ready: true, animate: previous.ready,
      }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage); observer.observe(dock);
    if (selectedId) {
      const feature = stage.querySelector(`[data-feature-id="${CSS.escape(selectedId)}"]`);
      if (feature) observer.observe(feature);
    }
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [stageRef, dockRef, selectedId, revision]);
  return <div className={`contextual-guide${anchor.contextual ? ' at-feature' : ''}`} data-role={tone}
    data-feature={anchor.contextual ? selectedId : undefined}
    style={{transition: anchor.animate ? undefined : 'none', left: anchor.left, top: anchor.top, visibility: anchor.ready ? 'visible' : 'hidden'}}>
    <Companion tone={tone}><span className="sr-only">{t(tone === 'evidence' ? 'guide.inspection' : tone === 'review' ? 'guide.review' : 'guide.place')}</span></Companion>
  </div>;
}
