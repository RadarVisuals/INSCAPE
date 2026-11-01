import { keeperFlightViewport, keeperViewport } from './keeperMotion.js';
import { LATTICE_PRODUCTION_FOCUS_OPENING_MS, latticeProductionFocusOpeningProgress } from '../lattice/rendering/latticeProductionFocusArtworkMotion.js';

export const EXPLORATION_ROOM = { width: 2800, height: 1800, home: { x: 1050, y: 1100 } };
export const EXPLORATION_PIECES = [{ x: 180, y: 650, size: 600 }, { x: 1650, y: 400, size: 600 }];
// Only straight metal beams: the organic illustration is intentionally passable.
export const EXPLORATION_WALLS = EXPLORATION_PIECES.flatMap(({ x, y, size }) => [
  { left: x + size * .06, right: x + size * .95, top: y + size * .06, bottom: y + size * .11 },
  { left: x + size * .90, right: x + size * .95, top: y + size * .11, bottom: y + size * .95 },
]);

export function createExplorationSpace({ getRectangle, paintScene, reducedMotion = false, animateZoom = false }) {
  const camera = { x: 0, y: 0 };
  let zoom = 1, targetZoom = 1, active = false, journey = null, lastPoint = EXPLORATION_ROOM.home;
  const listeners = new Set();
  const rectangle = () => getRectangle() || { left: 0, top: 0, width: 1, height: 1 };
  const project = point => { const box = rectangle(); return { ...point, x: box.left + (point.x - camera.x) * zoom, y: box.top + (point.y - camera.y) * zoom }; };
  const unproject = point => { const box = rectangle(); return { ...point, x: (point.x - box.left) / zoom + camera.x, y: (point.y - box.top) / zoom + camera.y }; };
  function update(point, dt = 0) {
    const box = rectangle();
    if (journey) {
      journey.elapsed += Math.max(0, Math.min(.05, dt));
      const progress = Math.min(1, journey.elapsed * 1000 / LATTICE_PRODUCTION_FOCUS_OPENING_MS);
      zoom = journey.from + (targetZoom - journey.from) * latticeProductionFocusOpeningProgress(progress);
      if (progress === 1) journey = null;
    }
    lastPoint = { x: point.x, y: point.y };
    // The physical room bounds constrain Keeper, not the lens. Let the camera
    // see empty space beyond the room so focus stays fixed even at 50% beside
    // the first wall, rather than shifting the actor when the lens hits an edge.
    const target = { x: point.x - box.width / zoom / 2, y: point.y - box.height / zoom / 2 };
    // Keeper motion is already damped. A second positional spring makes the
    // focus lag and changes held steering as the camera catches up at walls.
    camera.x = target.x; camera.y = target.y;
    paintScene?.({ ...camera, zoom });
  }
  return {
    project, unproject, update, home: () => ({ ...EXPLORATION_ROOM.home }), walls: EXPLORATION_WALLS,
    getZoom: () => zoom,
    getTargetZoom: () => targetZoom,
    setActive(value) {
      active = value;
      if (!active && journey) {
        journey = null; zoom = targetZoom; update(lastPoint);
        listeners.forEach(listener => listener());
      }
    },
    setZoom(value) {
      if (![.5, 1].includes(value) || value === targetZoom) return;
      targetZoom = value;
      journey = animateZoom && !reducedMotion && active ? { from: zoom, elapsed: 0 } : null;
      if (!journey) { zoom = value; update(lastPoint); }
      listeners.forEach(listener => listener());
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { active = false; journey = null; listeners.clear(); },
    collisionRadius: size => size * .08,
    viewport(size) {
      const box = rectangle(), rendered = keeperFlightViewport(size, box, box.width, box.height).size;
      return { size: rendered, bounds: keeperViewport(rendered, EXPLORATION_ROOM.width, EXPLORATION_ROOM.height).bounds };
    },
    reset() { update(EXPLORATION_ROOM.home); },
  };
}
