import { useEffect, useRef, useState } from 'react';

export const GRID_PLAYBACK_SLIDE_MS = 6000;

// Playback changes only the selected Grid and its local camera transition.
export default function useGridPlayback(options) {
  const latest = useRef(options);
  latest.current = options;
  const cycle = useRef(null);
  const [swipe, setSwipe] = useState(null);
  const clear = () => { cycle.current = null; setSwipe(null); };

  useEffect(() => {
    if (!options.enabled) { clear(); options.onPause(); }
  }, [options.enabled, options.playing]);
  useEffect(() => {
    const current = cycle.current;
    if (current && current.source !== options.gridId
      && !(current.phase === 'handoff' && current.target === options.gridId)) clear();
  }, [options.gridId]);

  useEffect(() => {
    if (!options.playing || !options.enabled) return undefined;
    let request;
    let previous = null;
    const tick = (time) => {
      const current = latest.current;
      const delta = previous === null ? 0 : Math.min(100, time - previous);
      previous = time;
      if (document.hidden) { request = requestAnimationFrame(tick); return; }
      if (!cycle.current) {
        if (!current.nextGridId) { current.onPause(); clear(); return; }
        cycle.current = { source: current.gridId, target: current.nextGridId, elapsed: 0, phase: 'slide' };
      }
      const step = cycle.current;
      step.elapsed += delta;
      const progress = Math.min(1, step.elapsed / GRID_PLAYBACK_SLIDE_MS);
      if (!current.reducedMotion) setSwipe({ direction: 'next', targetGridId: step.target,
        deltaX: -Math.max(0, (current.canvasRef.current?.clientWidth || 0) - 1) * current.viewScale * progress,
        settling: false });
      if (progress === 1) {
        step.phase = 'handoff'; step.elapsed = 0;
        const advanced = current.onAdvance(step.target, 'next', { animate: false });
        // Rebase at the boundary in this frame; the next frame continues moving.
        // No dwell timer or easing between scenes, including the last-to-first wrap.
        clear();
        if (advanced === false) { current.onPause(); return; }
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [options.playing, options.enabled]);

  const stop = () => {
    const step = cycle.current;
    const current = latest.current;
    if (step?.phase === 'slide' && step.elapsed >= GRID_PLAYBACK_SLIDE_MS / 2)
      current.onAdvance(step.target, 'next', { animate: false });
    clear(); current.onPause();
  };
  return { swipe, stop };
}
