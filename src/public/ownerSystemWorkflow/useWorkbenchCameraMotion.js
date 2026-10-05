import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LATTICE_PRODUCTION_FOCUS_OPENING_MS, latticeProductionFocusOpeningProgress } from '../../lattice/rendering/latticeProductionFocusArtworkMotion.js';
import { interpolateWorkbenchCamera } from './workbenchNavigation.js';
import { flushSync } from 'react-dom';
import { createWorkbenchCameraSurfaceMotion } from './workbenchCameraSurfaceMotion.js';

// Animation owns only the current journey's lifetime. Destinations, Back history
// and the authoritative camera remain with their respective owners.
export default function useWorkbenchCameraMotion(camera, hostRef, entries) {
  const { getCamera, updateCamera: applyCamera, prepareCamera, projectCamera, previewCamera } = camera;
  const active = useRef(null);
  const [moving, setMoving] = useState(false);
  const preference = useMemo(() => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'), []);
  const stop = useCallback((synchronous = false) => {
    const motion = active.current;
    if (!motion) return;
    active.current = null;
    cancelAnimationFrame(motion.frame);
    const settle = () => { applyCamera(getCamera()); setMoving(false); };
    if (synchronous) flushSync(settle); else settle();
  }, [getCamera, applyCamera]);
  const finish = useCallback(motion => {
    if (active.current !== motion) return;
    if (motion.isCurrent && !motion.isCurrent()) { stop(); return; }
    active.current = null;
    cancelAnimationFrame(motion.frame);
    setMoving(false);
    applyCamera(motion.end);
    motion.onComplete?.();
  }, [applyCamera, stop]);
  const start = useCallback((end, { onComplete, isCurrent } = {}) => {
    stop(true);
    const motion = { start: getCamera(), end, onComplete, isCurrent, frame: null, started: null };
    active.current = motion;
    if (preference?.matches) { finish(motion); return; }
    const raster = { scale: Math.max(motion.start.scale, end.scale), offset: motion.start.offset };
    // Prepare actual DOM/image resolution before shrinking to the starting
    // view, so enlargement never stretches a low-resolution starting surface.
    flushSync(() => { setMoving(true); prepareCamera(raster); });
    const surface = createWorkbenchCameraSurfaceMotion(hostRef.current, entries, raster);
    projectCamera(surface);
    previewCamera(motion.start);
    const tick = time => {
      if (active.current !== motion) return;
      if (!surface.isCurrent() || isCurrent && !isCurrent()) { stop(); return; }
      if (preference?.matches) { finish(motion); return; }
      motion.started ??= time;
      const elapsed = Math.min(1, (time - motion.started) / LATTICE_PRODUCTION_FOCUS_OPENING_MS);
      if (elapsed === 1) { finish(motion); return; }
      previewCamera(interpolateWorkbenchCamera(motion.start, end, latticeProductionFocusOpeningProgress(elapsed)));
      motion.frame = requestAnimationFrame(tick);
    };
    motion.frame = requestAnimationFrame(tick);
  }, [getCamera, prepareCamera, projectCamera, previewCamera, hostRef, entries, preference, stop, finish]);
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
