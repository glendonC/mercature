import {useLayoutEffect, useState, type RefObject} from 'react';
import { useLanguage } from '../i18n';

/** Anchors message annotations to the renderer's actual projected spots. */
export default function ScenePins({stageRef, spots, selectedId, onSelect, revision}: {
  stageRef: RefObject<HTMLDivElement | null>; spots: readonly {id: string; label: string}[];
  selectedId: string | null; onSelect: (id: string) => void; revision: string;
}) {
  const { t } = useLanguage();
  const [positions, setPositions] = useState<{id: string; label: string; x: number; y: number}[]>([]);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function update() {
      const parent = stage!.getBoundingClientRect();
      setPositions(spots.flatMap(spot => {
        const element = stage!.querySelector(`[data-feature-id="${CSS.escape(spot.id)}"]`);
        if (!element) return [];
        const rect = element.getBoundingClientRect();
        return [{...spot, x: rect.left + rect.width / 2 - parent.left, y: rect.top - parent.top}];
      }));
    }
    update();
    const observer = new ResizeObserver(update); observer.observe(stage);
    window.addEventListener('resize', update);
    return () => {observer.disconnect(); window.removeEventListener('resize', update);};
  }, [stageRef, spots, revision]);
  return <div className="scene-pins" role="group" aria-label={t('pins.label')}>{positions.map((spot, index) => <button className="scene-pin" key={spot.id} style={{left: spot.x, top: spot.y}} onClick={() => onSelect(spot.id)} aria-label={t('pins.pin', {n: index + 1, label: spot.label})} aria-pressed={selectedId === spot.id}>{index + 1}</button>)}</div>;
}
