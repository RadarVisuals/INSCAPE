import { useLayoutEffect, useRef } from 'react';
import { useWorkbenchInspectionLock } from './WorkbenchCamera.jsx';
import {
  interpolateLatticeProductionFocusRectangle,
  latticeProductionFocusOpeningProgress,
  LATTICE_PRODUCTION_FOCUS_OPENING_MS,
} from '../../lattice/rendering/latticeProductionFocusArtworkMotion.js';
import './displayModuleLift.css';

// Project the existing window at inspection resolution without relocating its
// live artwork documents. Authored geometry stays with the containing Display.
export default function DisplayModuleLift({ source, frame, destination, stageWidth, stageHeight, trigger, reducedMotion,
  closing, nestedInspection, onPhaseChange, onRequestReturn, onClose }) {
  useWorkbenchInspectionLock();
  const progress = useRef(0), latest = useRef(null), paint = useRef(null);
  const workbench = source.closest('.system-workflow');
  latest.current = { frame, destination, stageWidth, stageHeight, onClose, nestedInspection, onPhaseChange, onRequestReturn };

  useLayoutEffect(() => {
    workbench?.setAttribute('data-display-lift-host', '');
    let pointerStart = null;
    const pointerdown = event => {
      pointerStart = { outside: !source.contains(event.target), x: event.clientX, y: event.clientY };
    };
    const click = event => {
      const start = pointerStart;
      pointerStart = null;
      if (event.button !== 0 || !start?.outside || source.contains(event.target)
        || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      latest.current.onRequestReturn();
    };
    const keydown = event => {
      if (event.defaultPrevented) return;
      if (source.contains(event.target) && (event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); event.stopPropagation(); return;
      }
      if (event.key === 'Escape' && !latest.current.nestedInspection) {
        event.preventDefault(); event.stopPropagation(); latest.current.onRequestReturn();
      }
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('pointerdown', pointerdown, true);
    document.addEventListener('click', click, true);
    return () => {
      workbench?.removeAttribute('data-display-lift-host');
      source.style.removeProperty('--display-lift-transform');
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('pointerdown', pointerdown, true);
      document.removeEventListener('click', click, true);
      queueMicrotask(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); });
    };
  }, [source, workbench, trigger]);

  paint.current = () => {
    const original = latest.current.frame;
    const matrix = new DOMMatrix(original.transform);
    const parent = source.parentElement.getBoundingClientRect();
    const origin = { left: parent.left + matrix.e, top: parent.top + matrix.f,
      width: original.width * matrix.a, height: original.height * matrix.d };
    const projected = interpolateLatticeProductionFocusRectangle(origin, latest.current.destination, progress.current);
    source.style.setProperty('--display-lift-transform',
      `matrix(${projected.width / latest.current.stageWidth},0,0,${projected.height / latest.current.stageHeight},${projected.left - parent.left},${projected.top - parent.top})`);
  };
  useLayoutEffect(() => { paint.current(); }, [frame.width, frame.height, frame.transform, stageWidth, stageHeight, destination.left, destination.top]);
  useLayoutEffect(() => {
    const start = progress.current, end = closing ? 0 : 1;
    latest.current.onPhaseChange(closing ? 'closing' : 'opening');
    let animation, started;
    const tick = time => {
      started ??= time;
      const elapsed = reducedMotion ? 1 : Math.min(1, (time - started) / LATTICE_PRODUCTION_FOCUS_OPENING_MS);
      progress.current = start + (end - start) * latticeProductionFocusOpeningProgress(elapsed);
      paint.current();
      if (elapsed < 1) animation = requestAnimationFrame(tick);
      else if (closing) latest.current.onClose();
      else {
        latest.current.onPhaseChange('open');
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      }
    };
    if (reducedMotion) tick(performance.now());
    else animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [closing, reducedMotion]);

  return null;
}
