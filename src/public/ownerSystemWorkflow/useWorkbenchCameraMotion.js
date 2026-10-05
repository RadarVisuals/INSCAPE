import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LATTICE_PRODUCTION_FOCUS_OPENING_MS, latticeProductionFocusOpeningProgress } from '../../lattice/rendering/latticeProductionFocusArtworkMotion.js';
import { interpolateWorkbenchCamera } from './workbenchNavigation.js';

// Animation owns only the current journey's lifetime. Destinations, Back history
// and the authoritative camera remain with their respective owners.
export default function useWorkbenchCameraMotion(getCamera, applyCamera) {
  const active = useRef(null);
  const [moving, setMoving] = useState(false);
  const preference = useMemo(() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'), []);
  const stop = useCallback(() => {
    const motion = active.current;
    if (!motion) return;
    active.current = null;
    cancelAnimationFrame(motion.frame);
    setMoving(false);
  }, []);
  const finish = useCallback(motion => {
    if (active.current !== motion) return;
    if (motion.isCurrent && !motion.isCurrent()) { stop(); return; }
    stop();
    applyCamera(motion.end);
    motion.onComplete?.();
  }, [applyCamera, stop]);
  const start = useCallback((end, { onComplete, isCurrent } = {}) => {
    stop();
    const motion = { start: getCamera(), end, onComplete, isCurrent, frame: null, started: null };
    active.current = motion;
    if (preference?.matches) { finish(motion); return; }
    setMoving(true);
    const tick = time => {
      if (active.current !== motion) return;
      if (isCurrent && !isCurrent()) { stop(); return; }
      if (preference?.matches) { finish(motion); return; }
      motion.started ??= time;
      const elapsed = Math.min(1, (time - motion.started) / LATTICE_PRODUCTION_FOCUS_OPENING_MS);
      if (elapsed === 1) { finish(motion); return; }
      applyCamera(interpolateWorkbenchCamera(motion.start, end, latticeProductionFocusOpeningProgress(elapsed)));
      motion.frame = requestAnimationFrame(tick);
    };
    motion.frame = requestAnimationFrame(tick);
  }, [getCamera, applyCamera, preference, stop, finish]);
  useLayoutEffect(() => {
    const change = () => { if (preference.matches && active.current) finish(active.current); };
    preference?.addEventListener('change', change);
    return () => {
      preference?.removeEventListener('change', change);
      if (active.current) cancelAnimationFrame(active.current.frame);
      active.current = null;
    };
  }, [preference, finish]);
  return { start, stop, moving };
}
