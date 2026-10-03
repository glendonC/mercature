import type { Scene } from './contracts';

/** The authored example records a gap between these two facing rectangles.
 * This is a fixture dimension, not a general minimum-width or route measurement.
 * Derive it from the current baseline coordinates, and refuse unrelated layouts.
 */
export function authoredCourtyardGap(scene: Scene, objectId: string): number | undefined {
  if (scene.id !== 'synthetic-courtyard' || objectId !== 'bench') return;
  const bench = scene.obstacles.find(item => item.id === objectId);
  const wall = scene.obstacles.find(item => item.id === 'wall-north');
  if (!bench || !wall || bench.bottom !== wall.bottom || bench.top <= wall.bottom || wall.top <= bench.bottom) return;
  if (Math.min(bench.bounds.maxX, wall.bounds.maxX) <= Math.max(bench.bounds.minX, wall.bounds.minX)) return;
  const gap = wall.bounds.minY - bench.bounds.maxY;
  if (gap <= 0) return;
  return gap;
}
