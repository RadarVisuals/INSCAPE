import { startTransition, useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import useGridSwipe from './useGridSwipe.js';
import { createGridCameraTransport, GRID_PLAYBACK_SLIDE_MS } from './gridCameraTransport.js';

export { GRID_PLAYBACK_SLIDE_MS } from './gridCameraTransport.js';

// One camera owns drag, coast and Play. Native trajectories drive automatic
// movement; React observes their position to select/prepare Grids, never to
// advance the visual clock. No camera state is persisted in the document.
export default function useGridPlayback(options) {
  const latest = useRef(options); latest.current = options;
  const position = useRef(0), source = useRef(options.gridId);
  const rail = useRef(0), travelDirection = useRef('next');
  const committedRail = useRef(0), transport = useRef(null);
  const drag = useRef(null), frame = useRef(null), previous = useRef(null), driver = useRef(null);
  const [swipe, setSwipe] = useGridSwipe(options.canvasRef, options.trackRef, transport);
  const width = () => Math.max(1, latest.current.canvasRef.current?.clientWidth || 1);
  const cancelFrame = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; previous.current = null;
  };
  const reset = () => {
    cancelFrame(); transport.current?.cancel(); transport.current = null;
    drag.current = null; position.current = 0; rail.current = 0; setSwipe(null);
  };
  const neighbor = direction => latest.current.adjacentGrid?.(source.current, direction)
    || (direction === 'next' ? latest.current.nextGridId : null);
  const paint = () => {
    if (!position.current && !rail.current) { setSwipe(null); return; }
    const direction = position.current ? position.current < 0 ? 'next' : 'previous' : travelDirection.current;
    const targetGridId = neighbor(direction);
    if (!targetGridId || targetGridId === source.current) { reset(); return; }
    setSwipe({ sourceGridId: source.current, targetGridId, direction, settling: false, sourceSlot: rail.current,
      offset: position.current !== 0,
      moving: Boolean(drag.current || transport.current),
      deltaX: position.current * width(), railPosition: position.current - rail.current });
  };
  const advance = direction => {
    const target = neighbor(direction);
    if (!target || target === source.current) return false;
    source.current = target; travelDirection.current = direction;
    if (!latest.current.reducedMotion) rail.current += direction === 'next' ? 1 : -1;
    let result;
    const commit = () => {
      if (latest.current.reducedMotion) setSwipe(null); else paint();
      result = latest.current.onAdvance(target, direction, { animate: false });
    };
    // Ordinary crossings retain prepared surfaces. A very large direct drag
    // must prepare its destination before the pointer moves farther.
    if (latest.current.reducedMotion || Math.abs(rail.current - committedRail.current) > 1) flushSync(commit);
    else startTransition(commit);
    if (result === false) source.current = latest.current.gridId;
    return result !== false;
  };
  const move = amount => {
    position.current += amount;
    const integer = Math.round(position.current);
    if (Math.abs(position.current - integer) < 1e-10) position.current = integer;
    let advanced = false;
    while (Math.abs(position.current) >= 1) {
      const direction = position.current < 0 ? 'next' : 'previous';
      position.current += direction === 'next' ? 1 : -1;
      if (!advance(direction)) { reset(); return; }
      advanced = true;
    }
    if (!advanced) startTransition(paint);
  };
  const synchronize = () => {
    const current = transport.current;
    if (!current) return null;
    const state = current.sample();
    move(state.position - (position.current - rail.current));
    return transport.current === current ? state : null;
  };
  const stopTransport = () => {
    synchronize();
    transport.current?.cancel(); transport.current = null;
  };
  const wake = () => { if (frame.current === null) frame.current = requestAnimationFrame(time => driver.current(time)); };
  const startTransport = (kind, velocity = 0) => {
    const node = latest.current.trackRef.current;
    if (!node || document.hidden || latest.current.suspended) return;
    transport.current = createGridCameraTransport(node, position.current - rail.current, kind, velocity);
    paint(); wake();
  };
  const pause = () => {
    stopTransport(); cancelFrame(); drag.current = null;
    latest.current.onPause(); paint();
  };
  driver.current = time => {
    frame.current = null;
    const current = latest.current;
    if (!current.enabled || current.suspended || document.hidden || drag.current) {
      stopTransport(); previous.current = null; return;
    }
    if (current.reducedMotion) {
      const dt = previous.current === null ? 0 : time - previous.current;
      previous.current = time;
      if (!current.playing) return;
      position.current -= dt / GRID_PLAYBACK_SLIDE_MS;
      while (position.current <= -1) {
        position.current += 1;
        if (!advance('next')) { reset(); return; }
      }
      wake(); return;
    }
    const state = synchronize();
    if (!state) return;
    if (state.done) {
      transport.current.cancel(); transport.current = null;
      // Finish at the same priority as the Grid handoff queued by synchronize.
      // An urgent swipe update can otherwise overtake that navigation and make
      // the layout effect interpret its old Grid as an external camera reset.
      startTransition(paint); return;
    }
    if (state.renew) {
      transport.current.cancel(); transport.current = null;
      startTransport('play');
    } else wake();
  };
  useLayoutEffect(() => {
    committedRail.current = swipe?.sourceSlot || 0;
    if (source.current !== options.gridId && swipe?.sourceGridId !== options.gridId) {
      reset(); source.current = options.gridId;
      if (options.playing && options.enabled && !options.reducedMotion && !options.suspended) startTransport('play');
    }
  }, [options.gridId, swipe?.sourceGridId, swipe?.sourceSlot]);
  useEffect(() => { reset(); source.current = latest.current.gridId; }, [options.scope]);
  useEffect(() => {
    if (!options.enabled) { reset(); options.onPause(); return; }
    if (options.suspended) { pause(); return; }
    if (options.reducedMotion) {
      stopTransport(); cancelFrame(); position.current = 0; rail.current = 0; setSwipe(null);
      if (options.playing) wake();
      return;
    }
    if (options.playing && !drag.current) {
      if (transport.current?.kind !== 'play') { stopTransport(); startTransport('play'); }
    } else if (transport.current?.kind === 'play') {
      stopTransport(); cancelFrame(); paint();
    } else if (!transport.current) {
      cancelFrame(); paint();
    }
  }, [options.enabled, options.playing, options.suspended, options.reducedMotion, options.scope]);
  useEffect(() => {
    const freeze = () => { stopTransport(); drag.current = null; cancelFrame(); paint(); };
    const visibility = () => {
      freeze();
      if (!document.hidden && latest.current.playing && latest.current.enabled && !latest.current.suspended) {
        if (latest.current.reducedMotion) wake(); else startTransport('play');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', freeze);
    window.addEventListener('focus', visibility);
    const observer = new ResizeObserver(() => { if (!latest.current.reducedMotion) { synchronize(); paint(); } });
    if (latest.current.canvasRef.current) observer.observe(latest.current.canvasRef.current);
    return () => {
      cancelFrame(); transport.current?.cancel(); transport.current = null;
      observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', freeze); window.removeEventListener('focus', visibility);
    };
  }, []);
  return { swipe, isDragging: () => Boolean(drag.current),
    isMoving: () => Boolean(drag.current || transport.current || latest.current.playing && !latest.current.suspended),
    pause,
    beginDrag(x) {
      if (!latest.current.enabled || latest.current.suspended) return;
      stopTransport(); cancelFrame(); latest.current.onPause();
      const node = latest.current.canvasRef.current;
      drag.current = { x, time: performance.now(), velocity: 0, scale: node.getBoundingClientRect().width / node.clientWidth || 1 };
      startTransition(paint);
    },
    moveDrag(x) {
      const active = drag.current; if (!active) return;
      const now = performance.now(), dt = Math.max(1, now - active.time);
      const distance = (x - active.x) / (width() * active.scale);
      active.velocity = dt > 120 ? 0 : Math.max(-.002, Math.min(.002, distance / dt));
      active.x = x; active.time = now;
      // Reduced motion selects one neighbour on release, regardless of how
      // many Stage widths the held pointer traverses.
      if (latest.current.reducedMotion) position.current += distance;
      else move(distance);
    },
    endDrag(cancelled = false) {
      const active = drag.current; drag.current = null;
      if (!active) return;
      if (latest.current.reducedMotion) {
        if (!cancelled && Math.abs(position.current) >= .08) advance(position.current < 0 ? 'next' : 'previous');
        reset(); return;
      }
      const velocity = cancelled || performance.now() - active.time > 100 ? 0 : active.velocity;
      if (!cancelled && (velocity || position.current)) startTransport('coast', velocity);
      else paint();
    },
    stop() { latest.current.onPause(); reset(); },
  };
}
