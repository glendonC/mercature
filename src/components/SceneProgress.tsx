import { useLanguage } from '../i18n';
export type SceneProgressItem = {id: string; label: string; state: 'upcoming' | 'current' | 'complete'};
/** Stable orientation, separate from the changing inspection and action surfaces. */
export default function SceneProgress({title, items, children}: {
  title: string;
  items: readonly SceneProgressItem[];
  children?: import('react').ReactNode;
}) {
  const { t } = useLanguage();
  return <aside className="scene-progress" aria-label={t('canvas.progress')}>
    <p className="scene-caption">{title}</p>
    <ol>{items.map(item => <li key={item.id} data-state={item.state} aria-current={item.state === 'current' ? 'step' : undefined}>
      <span className="progress-mark" aria-hidden="true">{item.state === 'complete' ? '✓' : ''}</span>
      <span>{item.label}</span><span className="sr-only">{item.state === 'complete' ? t('canvas.complete') : ''}</span>
    </li>)}</ol>
    {children}
  </aside>;
}
