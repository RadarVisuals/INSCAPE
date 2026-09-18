import { activeEffects } from './effectCatalog.js';
// CSS runs motion without per-frame React updates or draft writes.
export function placementMotionStyle(animation, cellSize, enabled) {
  if (!enabled || !animation) return {};
  const motions = activeEffects(animation).map(effect => effect.motion(animation[effect.id], cellSize));
  if (!motions.length) return {};
  return {
    ...Object.assign({}, ...motions.map(motion => motion.style)),
    animationName: motions.map(motion => motion.name).join(', '),
    animationDuration: motions.map(motion => motion.duration + 's').join(', '),
    animationIterationCount: 'infinite', animationTimingFunction: 'linear',
  };
}
