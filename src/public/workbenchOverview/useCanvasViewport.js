import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import useWorkbenchPan from '../ownerSystemWorkflow/useWorkbenchPan.js';
import { zoomWorkbenchCamera } from '../ownerSystemWorkflow/workbenchViewScale.js';
import { interpolateWorkbenchCamera, restoreWorkbenchCamera, workbenchDestinationCamera } from '../ownerSystemWorkflow/workbenchNavigation.js';

// A presentation has no editor store. Camera memory belongs to the surrounding
// collection session, keyed by composition, and never enters authored content.
export default function useCanvasViewport({ hostRef, area, destinations, memory, disabled }) {
  const [camera, setCamera] = useState(null), [destinationId, setDestinationId] = useState(memory.current?.destinationId ?? null);
  const live = useRef(null), size = useRef(null), motion = useRef(null), fitTarget = useRef(memory.current ? memory.current.fitTarget : 'all');
  const latest = useRef(null); latest.current = { area, destinations, disabled };
  const commit = useCallback(next => {
    if (!next) return;
    live.current = next; setCamera(next);
    memory.current = { camera: next, size: size.current, fitTarget: fitTarget.current, destinationId: fitTarget.current === 'all' ? null : fitTarget.current };
  }, [memory]);
  const stop = useCallback(() => { if (motion.current !== null) cancelAnimationFrame(motion.current); motion.current = null; }, []);
  const fit = useCallback(region => workbenchDestinationCamera(region, size.current && { ...size.current, left: 0, top: 0 }, .001, 24), []);
  const travel = useCallback(next => {
    stop();
    if (!next) return;
    if (!live.current || matchMedia('(prefers-reduced-motion: reduce)').matches) { commit(next); return; }
    const start = live.current, started = performance.now();
    const tick = time => {
      const progress = Math.min(1, (time - started) / 360);
      commit(interpolateWorkbenchCamera(start, next, 1 - (1 - progress) ** 3));
      motion.current = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    motion.current = requestAnimationFrame(tick);
  }, [commit, stop]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    const measure = () => {
      const next = { width: host.clientWidth, height: host.clientHeight };
      if (!next.width || !next.height || next.width === size.current?.width && next.height === size.current?.height) return;
      stop();
      const previous = size.current || memory.current?.size; size.current = next;
      const region = fitTarget.current === 'all' ? latest.current.area : latest.current.destinations.find(item => item.id === fitTarget.current)?.view;
      const saved = live.current || memory.current?.camera;
      commit(region ? fit(region) : saved ? restoreWorkbenchCamera(saved, previous, next) : fit(latest.current.area));
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(host);
    return () => { observer.disconnect(); stop(); };
  }, [hostRef, memory, fit, commit, stop]);
  const free = useCallback(next => { fitTarget.current = null; setDestinationId(null); commit(next); }, [commit]);
  const getOffset = useCallback(() => live.current?.offset || { x: 0, y: 0 }, []);
  const updateOffset = useCallback(offset => { if (live.current) free({ ...live.current, offset }); }, [free]);
  // Reuse the Workbench's Space/Hand gesture, Escape cancellation and capture
  // cleanup. The artwork surface itself has no editing hit targets.
  const { active: panActive, cancel: cancelPan, releaseAbandonedGesture } = useWorkbenchPan(hostRef, disabled, { getOffset, update: updateOffset, onBegin: stop, hand: true });
  const zoom = useCallback((factor, anchor) => {
    if (latest.current.disabled || !live.current || !size.current) return;
    stop(); releaseAbandonedGesture();
    if (panActive.current) return;
    const current = live.current, minimum = Math.min(.05, fit(latest.current.area).scale / 4);
    free(zoomWorkbenchCamera(current.scale, current.offset, current.scale * factor,
      anchor || { x: size.current.width / 2, y: size.current.height / 2 }, { min: minimum, max: 4 }));
  }, [fit, free, stop, panActive, releaseAbandonedGesture]);
  const choose = useCallback(id => {
    if (latest.current.disabled) return;
    const region = id ? latest.current.destinations.find(item => item.id === id)?.view : latest.current.area;
    if (!region) return;
    cancelPan(); fitTarget.current = id || 'all'; setDestinationId(id); travel(fit(region));
  }, [fit, travel, cancelPan]);
  useEffect(() => {
    const host = hostRef.current;
    if (disabled) { stop(); return; }
    const wheel = event => {
      if (!live.current || host.closest('[inert]')) return;
      event.preventDefault(); releaseAbandonedGesture();
      if (panActive.current) return;
      if (event.ctrlKey || event.metaKey) {
        const rect = host.getBoundingClientRect(); zoom(Math.exp(-event.deltaY * .002), { x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else {
        stop(); const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
        const { offset } = live.current;
        free({ ...live.current, offset: { x: offset.x - event.deltaX * unit, y: offset.y - event.deltaY * unit } });
      }
    };
    host.addEventListener('wheel', wheel, { passive: false });
    return () => host.removeEventListener('wheel', wheel);
  }, [hostRef, disabled, zoom, stop, free, panActive, releaseAbandonedGesture]);
  const onKeyDown = event => {
    if (event.target !== hostRef.current || disabled || !live.current || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Home') { event.preventDefault(); choose(null); }
    else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoom(event.key === '-' ? .8 : 1.25); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); stop(); const { offset } = live.current, amount = event.shiftKey ? 120 : 40;
      free({ ...live.current, offset: { x: offset.x + (event.key === 'ArrowLeft' ? amount : event.key === 'ArrowRight' ? -amount : 0),
        y: offset.y + (event.key === 'ArrowUp' ? amount : event.key === 'ArrowDown' ? -amount : 0) } });
    }
  };
  return { camera, destinationId, fitted: fitTarget.current === 'all', choose, zoom, onKeyDown };
}
