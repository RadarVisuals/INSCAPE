import { startTransition, useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import useGridSwipe from './useGridSwipe.js';
import { coastGrid } from './gridMomentum.js';

export const GRID_PLAYBACK_SLIDE_MS = 12000;

// One temporary camera owns drag, inertia and autoplay. Display still owns
// navigation; offsets and velocity never enter the document.
export default function useGridPlayback(options) {
  const latest = useRef(options); latest.current = options;
  const position = useRef(0), source = useRef(options.gridId), velocity = useRef(0);
  // Grid-local progress drives navigation/Text; the rail keeps an uninterrupted
  // visual coordinate while crossing Grids. Explicit navigation resets both.
  const rail = useRef(0), travelDirection = useRef('next');
  const committedRail = useRef(0);
  const drag = useRef(null), frame = useRef(null), previous = useRef(null), driver = useRef(null);
  const [swipe, setSwipe] = useGridSwipe(options.canvasRef, options.trackRef);
  const width = () => Math.max(1, (latest.current.canvasRef.current?.clientWidth || 1) - 1);
  const cancelFrame = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; previous.current = null;
  };
  const reset = () => { cancelFrame(); drag.current = null; velocity.current = 0; position.current = 0; rail.current = 0; setSwipe(null); };
  const neighbor = direction => latest.current.adjacentGrid?.(source.current, direction)
    || (direction === 'next' ? latest.current.nextGridId : null);
  const paint = () => {
    if (!position.current && !rail.current) { setSwipe(null); return; }
    const direction = position.current ? position.current < 0 ? 'next' : 'previous' : travelDirection.current;
    const targetGridId = neighbor(direction);
    if (!targetGridId || targetGridId === source.current) { reset(); return; }
    const span = width();
    setSwipe({ sourceGridId: source.current, targetGridId, direction, settling: false, sourceSlot: rail.current,
      moving: Boolean(drag.current || velocity.current || latest.current.playing && !latest.current.suspended),
      deltaX: position.current * span, railPosition: position.current - rail.current });
  };
  // Pausing ends motion, not the view. A resting offset remains editable.
  const pause = () => {
    latest.current.onPause(); cancelFrame(); drag.current = null; velocity.current = 0;
    paint();
  };
  const advance = direction => {
    const target = neighbor(direction);
    if (!target || target === source.current) return false;
    source.current = target;
    travelDirection.current = direction;
    if (!latest.current.reducedMotion) rail.current += direction === 'next' ? 1 : -1;
    let result;
    // Ordinary crossings use already prepared surfaces. Keep React work out of
    // the motion frame; only a jump beyond that neighborhood must catch up now.
    const commit = () => {
      if (latest.current.reducedMotion) setSwipe(null);
      else paint();
      result = latest.current.onAdvance(target, direction, { animate: false });
    };
    if (latest.current.reducedMotion || Math.abs(rail.current - committedRail.current) > 1) flushSync(commit);
    else startTransition(commit);
    if (result === false) source.current = latest.current.gridId;
    return result !== false;
  };
  const move = amount => {
    position.current += amount;
    // Discard floating-point residue at exact boundaries (far below a pixel),
    // so a held, canonical arrival can return to editing when released.
    const integer = Math.round(position.current);
    if (Math.abs(position.current - integer) < 1e-10) position.current = integer;
    let advanced = false;
    while (Math.abs(position.current) >= 1) {
      const direction = position.current < 0 ? 'next' : 'previous';
      position.current += direction === 'next' ? 1 : -1;
      if (!advance(direction)) { reset(); return; }
      advanced = true;
    }
    // advance already painted the remaining offset. A second paint would read
    // layout again and republish identical progress.
    if (!advanced) startTransition(paint);
  };
  const wake = () => { if (frame.current === null) frame.current = requestAnimationFrame(time => driver.current(time)); };
  driver.current = time => {
    frame.current = null;
    const current = latest.current;
    const dt = previous.current === null ? 0 : Math.min(50, time - previous.current);
    previous.current = time;
    if (!current.enabled || current.suspended || document.hidden || drag.current) { velocity.current = 0; previous.current = null; return; }
    if (current.playing && current.enabled) {
      if (current.reducedMotion) {
        position.current -= dt / GRID_PLAYBACK_SLIDE_MS;
        if (position.current <= -1) { position.current = 0; advance('next'); }
      } else move(-dt / GRID_PLAYBACK_SLIDE_MS);
      wake();
    } else if (velocity.current) {
      const step = coastGrid(velocity.current, dt);
      velocity.current = step.velocity; move(step.distance);
      if (velocity.current) wake(); else previous.current = null;
    }
  };
  useLayoutEffect(() => {
    committedRail.current = swipe?.sourceSlot || 0;
    // A concurrent commit may acknowledge an earlier camera crossing. Explicit
    // navigation has no matching swipe source and resets the temporary camera.
    if (source.current !== options.gridId && swipe?.sourceGridId !== options.gridId) {
      reset(); source.current = options.gridId;
    }
  }, [options.gridId, swipe?.sourceGridId, swipe?.sourceSlot]);
  useEffect(() => { reset(); source.current = latest.current.gridId; }, [options.scope]);
  useEffect(() => {
    if (!options.enabled) { reset(); options.onPause(); }
    else if (options.playing) { velocity.current = 0; previous.current = null; wake(); }
    else if (!velocity.current) {
      cancelFrame();
      if (!drag.current && !position.current) { rail.current = 0; setSwipe(null); }
      else paint();
    }
  }, [options.enabled, options.playing]);
  useEffect(() => { if (options.suspended) pause(); }, [options.suspended]);
  useEffect(() => {
    if (options.reducedMotion) { velocity.current = 0; position.current = 0; rail.current = 0; setSwipe(null); }
  }, [options.reducedMotion]);
  useEffect(() => {
    const visibility = () => {
      velocity.current = 0; drag.current = null; cancelFrame();
      paint();
      if (!document.hidden && latest.current.playing && latest.current.enabled) wake();
    };
    const blur = () => { velocity.current = 0; drag.current = null; cancelFrame(); paint(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', visibility);
    const observer = new ResizeObserver(() => { if (!latest.current.reducedMotion) paint(); });
    if (latest.current.canvasRef.current) observer.observe(latest.current.canvasRef.current);
    return () => { cancelFrame(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', visibility); };
  }, []);
  return { swipe, isDragging: () => Boolean(drag.current),
    isMoving: () => Boolean(drag.current || velocity.current || latest.current.playing && !latest.current.suspended),
    pause,
    beginDrag(x) {
      if (!latest.current.enabled || latest.current.suspended) return;
      cancelFrame(); velocity.current = 0; latest.current.onPause();
      const node = latest.current.canvasRef.current;
      drag.current = { x, time: performance.now(), velocity: 0, scale: node.getBoundingClientRect().width / node.clientWidth || 1 };
      startTransition(paint);
    },
    moveDrag(x) {
      const active = drag.current; if (!active) return;
      const now = performance.now(), dt = Math.max(1, now - active.time);
      const distance = (x - active.x) / (width() * active.scale);
      active.velocity = dt > 120 ? 0 : Math.max(-.002, Math.min(.002, distance / dt));
      active.x = x; active.time = now; move(distance);
    },
    endDrag(cancelled = false) {
      const active = drag.current; drag.current = null;
      if (!active) return;
      if (!position.current) { reset(); return; }
      if (latest.current.reducedMotion) {
        if (!cancelled && Math.abs(position.current) >= .08) advance(position.current < 0 ? 'next' : 'previous');
        reset(); return;
      }
      velocity.current = cancelled || performance.now() - active.time > 100 ? 0 : active.velocity;
      paint();
      if (velocity.current) wake();
    },
    stop() { latest.current.onPause(); reset(); },
  };
}
