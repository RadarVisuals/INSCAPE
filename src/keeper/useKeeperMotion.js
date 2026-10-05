import { useCallback, useEffect, useRef, useState } from 'react';
import { createKeeperMotion, releaseKeeper, returnKeeper, stepKeeper, faceKeeperPointer, keeperZone, keeperViewport, moveKeeperTo, steerKeeper, beginKeeperReaction, stopKeeperReaction } from './keeperMotion.js';
import { captureKeeperScene } from './keeperScene.js';

// The module owns this temporary animation. The Workbench only supplies its host
// and dock geometry; no animation frame writes into the draft or layout cache.
export function useKeeperMotion({ dock, actor, rigActor, hostRef, enabled, reducedMotion, faces, size, movement = 'flip', swim, paused = false, onPosition }) {
  // SVG float shares destination/recall ownership, with its own artwork pose.
  const rigged = movement === 'swim' || movement === 'svg';
  const [phase, setPhase] = useState('docked');
  const motion = useRef(null), pointer = useRef(null), tuning = useRef(swim);
  const attention = useRef(null), reactionVersion = useRef(0);
  const interaction = useRef({ paused });
  interaction.current = { paused };
  // Reading the latest authored controls does not restart flight, input or the rig.
  tuning.current = swim;
  const home = useCallback(() => {
    const rect = dock.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 80, y: 100 };
  }, [dock]);
  const paint = useCallback((state, dt = 0) => {
    if (!actor.current) return;
    const bob = reducedMotion ? 0 : Math.sin(state.elapsed * 1.5) * 3;
    actor.current.style.transform = `translate3d(${state.x}px, ${state.y + bob}px, 0)`;
    actor.current.style.setProperty('--keeper-facing', state.facing * (faces === 'left' ? -1 : 1));
    const renderedSize = keeperViewport(size, innerWidth, innerHeight).size;
    actor.current.style.setProperty('--keeper-size', `${renderedSize}px`);
    actor.current.style.setProperty('--keeper-tilt', `${state.expression?.gesture === 'curious' ? state.expression.amount * .22 : state.expression?.gesture === 'startled' ? state.expression.amount * -.12 : 0}rad`);
    actor.current.dataset.keeperGesture = state.expression?.gesture || 'none';
    if (rigged) rigActor.current?.paint(state, dt, { faces, reducedMotion, swim: tuning.current,
      size: renderedSize, pointer: attention.current, bounds: { left: 8, top: 24, right: innerWidth - 8, bottom: innerHeight - 48 } });
    onPosition?.current?.(state);
  }, [actor, rigActor, reducedMotion, faces, size, movement, rigged, onPosition]);
  const settle = useCallback(() => { motion.current = null; pointer.current = null; rigActor?.current?.reset(); setPhase('docked'); }, [rigActor]);
  const cancelReaction = useCallback(() => { reactionVersion.current++; stopKeeperReaction(motion.current); }, []);
  useEffect(() => { if (!paused || reducedMotion || !enabled) cancelReaction(); }, [paused, reducedMotion, enabled, cancelReaction]);
  useEffect(() => { if (motion.current) motion.current.steering = false; }, [paused]);
  const steer = useCallback(point => {
    if (!enabled || reducedMotion || motion.current?.phase !== 'free') return;
    cancelReaction(); steerKeeper(motion.current, point);
  }, [enabled, reducedMotion, cancelReaction]);
  const nudge = useCallback((x, y) => {
    if (motion.current) steer({ x: motion.current.x + x, y: motion.current.y + y });
  }, [steer]);
  const captureReaction = useCallback(options => {
    cancelReaction();
    const expected = motion.current, version = reactionVersion.current;
    const snapshot = captureKeeperScene(hostRef.current, expected || home(), attention.current,
      { ...options, layered: rigged, reducedMotion });
    return { scene: snapshot.scene, previews: snapshot.previews, metadata: snapshot.metadata, perform(action) {
      if (!enabled || reducedMotion || !interaction.current.paused || !expected || motion.current !== expected
        || reactionVersion.current !== version || expected.steering || document.hidden || !document.hasFocus()) return false;
      const target = snapshot.resolve(action);
      return Boolean(target && beginKeeperReaction(expected, target.action.gesture, target.point, keeperViewport(size, innerWidth, innerHeight).bounds, size));
    } };
  }, [cancelReaction, hostRef, home, rigged, reducedMotion, enabled, size]);
  useEffect(() => { if (!enabled) settle(); }, [enabled, settle]);
  useEffect(() => {
    if (phase === 'docked' || !enabled) return;
    const host = hostRef.current;
    let press = null, following = null, contextPointer = null, inactive = false;
    const canSwim = () => rigged && !reducedMotion && motion.current?.phase === 'free';
    const point = event => ({ x: event.clientX, y: event.clientY });
    // A hold starts on empty Workbench space, then follows across child windows
    // without taking pointer capture from their controls or the host.
    const follow = event => {
      if (event.pointerId !== following) return;
      if (!(event.buttons & 2) || !canSwim()) { following = null; return; }
      steer(point(event));
    };
    const newPress = () => { following = null; contextPointer = null; };
    const move = event => {
      attention.current = point(event);
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) press = null;
      if (rigged || interaction.current.paused) return;
      pointer.current = { x: event.clientX, y: event.clientY };
      if (motion.current) { faceKeeperPointer(motion.current, pointer.current); paint(motion.current); }
    };
    const leave = () => { pointer.current = null; attention.current = null; };
    // A paused conversation survives the external account sign-in tab. Freeze
    // its artwork while inactive; ordinary roaming still returns to the dock.
    const blur = () => {
      cancelReaction();
      if (motion.current) motion.current.steering = false;
      press = null; following = null; contextPointer = null; pointer.current = null;
      if (interaction.current.paused) inactive = true;
      else settle();
    };
    const focus = () => { inactive = false; previous = 0; };
    const stop = () => { if (document.hidden) blur(); else focus(); };
    const down = event => {
      press = null;
      if (!canSwim() || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      // Match the host's empty-space surfaces. Editing, controls and dragging
      // keep their input; background clicks and right-button holds steer swimming.
      if (event.target !== host && !event.target.matches?.('.system-workflow__workbench, .system-workflow__display-instance')) return;
      if (event.button === 2 && event.pointerType === 'mouse') {
        following = event.pointerId; contextPointer = event.pointerId;
        steer(point(event));
        event.preventDefault();
      } else if (event.button === 0) { cancelReaction(); press = { x: event.clientX, y: event.clientY, id: event.pointerId }; }
    };
    const up = event => {
      if (following === event.pointerId && !(event.buttons & 2)) {
        if (canSwim()) steer(point(event));
        following = null;
      }
      if (press?.id === event.pointerId && motion.current && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 5)
        steer({ x: event.clientX, y: event.clientY });
      press = null;
    };
    const cancel = () => { press = null; following = null; contextPointer = null; };
    const contextMenu = event => {
      // Some browsers open on press, others on release. Keep this gesture's
      // context suppression until its menu event, or the next pointer press.
      if (contextPointer === null || event.button !== 2) return;
      event.preventDefault(); event.stopPropagation(); contextPointer = null;
    };
    const key = event => { if (event.key === 'Escape') { following = null; cancelReaction(); } };
    host?.addEventListener('pointermove', move, true);
    host?.addEventListener('pointerenter', move);
    host?.addEventListener('pointerleave', leave);
    host?.addEventListener('pointerdown', down, true);
    globalThis.addEventListener('pointerdown', newPress, true);
    globalThis.addEventListener('pointermove', follow, true);
    globalThis.addEventListener('pointerup', up, true);
    globalThis.addEventListener('pointercancel', cancel, true);
    globalThis.addEventListener('contextmenu', contextMenu, true);
    globalThis.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', stop);
    globalThis.addEventListener('blur', blur);
    globalThis.addEventListener('focus', focus);
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
        if (inactive) {
          if (!interaction.current.paused) { settle(); return; }
          previous = 0; frame = requestAnimationFrame(tick); return;
        }
        state.stationary = false;
        const dt = previous ? (now - previous) / 1000 : 0;
        stepKeeper(state, { dt, pointer: pointer.current, home: home(), movement: movement === 'svg' ? 'swim' : movement, swim: tuning.current, paused: interaction.current.paused, ...viewport() });
        previous = now; paint(state, dt);
        if (state.phase === 'docked') settle();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      host?.removeEventListener('pointermove', move, true); host?.removeEventListener('pointerenter', move); host?.removeEventListener('pointerleave', leave);
      host?.removeEventListener('pointerdown', down, true);
      globalThis.removeEventListener('pointerdown', newPress, true); globalThis.removeEventListener('pointermove', follow, true);
      globalThis.removeEventListener('pointerup', up, true); globalThis.removeEventListener('pointercancel', cancel, true);
      globalThis.removeEventListener('contextmenu', contextMenu, true); globalThis.removeEventListener('keydown', key, true);
      globalThis.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', stop); globalThis.removeEventListener('blur', blur); globalThis.removeEventListener('focus', focus);
    };
  }, [phase, enabled, reducedMotion, faces, size, movement, rigged, home, paint, settle, hostRef, cancelReaction, steer]);
  const toggle = event => {
    if (!enabled) return;
    if (phase === 'free') {
      if (reducedMotion) { settle(); return; }
      returnKeeper(motion.current); setPhase('returning');
    } else {
      if (!motion.current) motion.current = createKeeperMotion(home());
      if (event?.detail && Number.isFinite(event.clientX)) pointer.current = { x: event.clientX, y: event.clientY };
      releaseKeeper(motion.current);
      if (rigged) {
        const viewport = keeperViewport(size, innerWidth, innerHeight);
        moveKeeperTo(motion.current, keeperZone(home(), viewport.bounds, viewport.size));
      } else faceKeeperPointer(motion.current, pointer.current);
      paint(motion.current); setPhase('free');
    }
  };
  return { phase, toggle, settle, captureReaction, cancelReaction, nudge };
}
