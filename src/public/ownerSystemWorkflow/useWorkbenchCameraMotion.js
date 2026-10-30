import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { LATTICE_PRODUCTION_FOCUS_OPENING_MS, latticeProductionFocusOpeningProgress } from '../../lattice/rendering/latticeProductionFocusArtworkMotion.js';
import { interpolateWorkbenchCamera } from './workbenchNavigation.js';
import { createWorkbenchCameraSurfaceMotion } from './workbenchCameraSurfaceMotion.js';
import { workbenchPanCoast } from './workbenchInertia.js';

// One projection lifetime serves destination travel, pointer pan and release
// inertia. Destinations and Back history remain with the navigation controller.
export default function useWorkbenchCameraMotion(camera, hostRef, entries) {
  const { getCamera, getCameraPlanes, updateCamera: applyCamera, prepareCamera, projectCamera, previewCamera } = camera;
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
    return motion.kind;
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
  const prepare = useCallback(motion => {
    active.current = motion;
    const raster = { scale: Math.max(motion.start.scale, motion.end?.scale || motion.start.scale), offset: motion.start.offset };
    // Prepare native media resolution once. Pointer samples and animation frames
    // then paint live DOM transforms without rendering module editors each time.
    projectCamera(null);
    flushSync(() => { setMoving(true); prepareCamera(raster); });
    motion.surface = createWorkbenchCameraSurfaceMotion(hostRef.current, entries, raster, motion, getCameraPlanes());
    projectCamera(motion.surface);
    previewCamera(motion.start, 0);
  }, [prepareCamera, projectCamera, previewCamera, hostRef, entries, getCameraPlanes]);
  const run = useCallback(motion => {
    if (motion.surface) active.current = motion;
    else prepare(motion);
    const tick = time => {
      if (active.current !== motion) return;
      if (motion.isCurrent && !motion.isCurrent()) { stop(); return; }
      if (!motion.surface.isCurrent()) {
        // Late modules join the same camera journey and clock. A valid saved
        // destination must not stop halfway merely because artwork loaded.
        // Group morphs retain their geometry-specific cancellation boundary.
        if (motion.origins || motion.destinations) { stop(); return; }
        prepare(motion);
        if (active.current !== motion) return;
      }
      if (preference?.matches) { if (motion.kind === 'coast') stop(); else finish(motion); return; }
      // A frame timestamp can precede the expensive preparation that just ran.
      // Start at the actual ready time, so the next paint does not skip the
      // beginning of the easing curve to catch up with that stale timestamp.
      motion.started ??= performance.now();
      const elapsed = Math.max(0, Math.min(motion.duration, time - motion.started));
      if (elapsed === motion.duration) { finish(motion); return; }
      const progress = latticeProductionFocusOpeningProgress(elapsed / motion.duration);
      previewCamera(motion.at ? motion.at(elapsed) : interpolateWorkbenchCamera(motion.start, motion.end, progress), progress);
      motion.frame = requestAnimationFrame(tick);
    };
    motion.frame = requestAnimationFrame(tick);
  }, [prepare, preference, stop, finish, previewCamera]);
  const start = useCallback((end, { onComplete, isCurrent, origins, destinations } = {}) => {
    stop(true);
    const motion = { kind: 'travel', start: getCamera(), end, onComplete, isCurrent, origins, destinations,
      duration: LATTICE_PRODUCTION_FOCUS_OPENING_MS, frame: null, started: null };
    if (preference?.matches) { active.current = motion; finish(motion); return; }
    run(motion);
  }, [getCamera, preference, stop, finish, run]);
  const beginPan = useCallback(() => {
    const previous = active.current;
    if (previous?.kind === 'coast' && previous.surface.isCurrent()) {
      cancelAnimationFrame(previous.frame);
      active.current = { kind: 'pan', start: getCamera(), surface: previous.surface, frame: null };
      return;
    }
    stop(true);
    prepare({ kind: 'pan', start: getCamera(), frame: null });
  }, [getCamera, prepare, stop]);
  const panTo = useCallback(offset => {
    const next = { ...getCamera(), offset }, motion = active.current;
    if (motion?.kind === 'pan') {
      // A lazy module can register while the pointer gesture is still active.
      // Rebase once at the live camera, then keep painting subsequent samples.
      // The gesture owner retains the original Escape/cancellation offset.
      if (!motion.surface.isCurrent()) prepare({ kind: 'pan', start: getCamera(), frame: null });
      previewCamera(next);
    }
    else { stop(); applyCamera(next); }
  }, [getCamera, prepare, previewCamera, stop, applyCamera]);
  const releasePan = useCallback(velocity => {
    const previous = active.current;
    const start = getCamera(), coast = !preference?.matches && workbenchPanCoast(start, velocity);
    // Release changes the motion clock, not its prepared surfaces. Avoid a full
    // geometry commit between the last pointer sample and the first coast frame.
    if (coast && previous?.kind === 'pan') run({ ...coast, kind: 'coast', start, surface: previous.surface, frame: null, started: null });
    else { stop(); if (coast) run({ ...coast, kind: 'coast', start, frame: null, started: null }); }
  }, [getCamera, preference, stop, run]);
  useLayoutEffect(() => {
    const change = () => {
      const motion = active.current;
      if (preference.matches && motion) { if (motion.kind === 'travel') finish(motion); else stop(); }
    };
    preference?.addEventListener('change', change);
    return () => {
      preference?.removeEventListener('change', change);
      if (active.current) cancelAnimationFrame(active.current.frame);
      active.current = null;
    };
  }, [preference, finish, stop]);
  return { start, stop, moving, beginPan, panTo, releasePan };
}
