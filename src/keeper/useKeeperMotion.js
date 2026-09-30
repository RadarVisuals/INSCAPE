import { useCallback, useEffect, useRef, useState } from 'react';
import { createKeeperMotion, releaseKeeper, returnKeeper, stepKeeper, faceKeeperPointer, keeperZone, keeperViewport } from './keeperMotion.js';

// The module owns this temporary animation. The Workbench only supplies its host
// and dock geometry; no animation frame writes into the draft or layout cache.
export function useKeeperMotion({ dock, actor, hostRef, enabled, reducedMotion, faces, size }) {
  const [phase, setPhase] = useState('docked');
  const motion = useRef(null), pointer = useRef(null);
  const home = useCallback(() => {
    const rect = dock.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 80, y: 100 };
  }, [dock]);
  const paint = useCallback(state => {
    if (!actor.current) return;
    const bob = reducedMotion ? 0 : Math.sin(state.elapsed * 1.5) * 3;
    actor.current.style.transform = `translate3d(${state.x}px, ${state.y + bob}px, 0)`;
    actor.current.style.setProperty('--keeper-facing', state.facing * (faces === 'left' ? -1 : 1));
    actor.current.style.setProperty('--keeper-size', `${keeperViewport(size, innerWidth, innerHeight).size}px`);
  }, [actor, reducedMotion, faces, size]);
  const settle = useCallback(() => { motion.current = null; setPhase('docked'); }, []);
  useEffect(() => { if (!enabled) settle(); }, [enabled, settle]);
  useEffect(() => {
    if (phase === 'docked' || !enabled) return;
    const host = hostRef.current;
    const move = event => {
      pointer.current = { x: event.clientX, y: event.clientY };
      if (motion.current) { faceKeeperPointer(motion.current, pointer.current); paint(motion.current); }
    };
    const leave = () => { pointer.current = null; };
    const stop = () => { if (document.hidden) settle(); };
    host?.addEventListener('pointermove', move, true);
    host?.addEventListener('pointerenter', move);
    host?.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', stop);
    globalThis.addEventListener('blur', settle);
    let frame = 0, previous = 0;
    const viewport = () => keeperViewport(size, innerWidth, innerHeight);
    const resize = () => {
      if (!motion.current || !reducedMotion) return;
      const { bounds } = viewport();
      motion.current.x = Math.max(bounds.left, Math.min(bounds.right, motion.current.x));
      motion.current.y = Math.max(bounds.top, Math.min(bounds.bottom, motion.current.y));
      paint(motion.current);
    };
    globalThis.addEventListener('resize', resize);
    if (reducedMotion) {
      if (motion.current?.phase === 'returning') settle();
      else if (motion.current) {
        if (!motion.current.stationary) {
          Object.assign(motion.current, keeperZone(pointer.current || home(), viewport().bounds, viewport().size));
          motion.current.stationary = true;
        }
        faceKeeperPointer(motion.current, pointer.current); resize();
      }
    } else {
      const tick = now => {
        const state = motion.current;
        if (!state) return;
        state.stationary = false;
        stepKeeper(state, { dt: previous ? (now - previous) / 1000 : 0, pointer: pointer.current, home: home(), ...viewport() });
        previous = now; paint(state);
        if (state.phase === 'docked') settle();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      host?.removeEventListener('pointermove', move, true); host?.removeEventListener('pointerenter', move); host?.removeEventListener('pointerleave', leave);
      globalThis.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', stop); globalThis.removeEventListener('blur', settle);
    };
  }, [phase, enabled, reducedMotion, faces, size, home, paint, settle, hostRef]);
  const toggle = event => {
    if (!enabled) return;
    if (phase === 'free') {
      if (reducedMotion) { settle(); return; }
      returnKeeper(motion.current); setPhase('returning');
    } else {
      if (!motion.current) motion.current = createKeeperMotion(home());
      if (event?.detail && Number.isFinite(event.clientX)) pointer.current = { x: event.clientX, y: event.clientY };
      releaseKeeper(motion.current); faceKeeperPointer(motion.current, pointer.current); paint(motion.current); setPhase('free');
    }
  };
  return { phase, toggle, settle };
}
