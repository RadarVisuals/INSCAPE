import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { fitCanvasRegion } from './fitCanvasRegion.js';

// Aerra's published panels use 0.6–0.7s springs with no bounce. This native
// easing follows that settling motion without bringing in Framer's runtime.
export const PRESENTATION_EASING = 'cubic-bezier(.16,1,.3,1)';
const rect = node => node.getBoundingClientRect();
const geometry = box => ({ left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: '0px', right: 'auto', bottom: 'auto' });
const projection = (canvas, frame) => {
  const box = rect(canvas);
  return { left: `${box.left - frame.left}px`, top: `${box.top - frame.top}px`, scale: box.width / Number(canvas.dataset.worldWidth) };
};

export default function useCanvasPresentationMotion({ dialog, surface, origin, area, region, expanded, onClose }) {
  const [viewport, setViewport] = useState(null);
  const state = useRef({ animations: [], closing: false, pending: null, before: null });
  const latest = useRef({ onClose, region, area }); latest.current = { onClose, region, area };
  const cancel = useCallback(() => { state.current.animations.forEach(animation => animation.cancel()); state.current.animations = []; }, []);
  const snapshot = () => {
    const frame = rect(surface.current), canvas = surface.current.querySelector('.workbench-overview-canvas');
    return { frame, canvas: projection(canvas, frame), shade: getComputedStyle(dialog.current.querySelector('.canvas-presentation-backdrop')).opacity };
  };
  const plan = useCallback((from, returning = false) => {
    const host = surface.current;
    // Read the live frame before cancelling, including an interrupted entrance.
    cancel(); host.dataset.moving = 'true';
    const to = returning && origin?.isConnected ? rect(origin) : rect(host);
    const sourceCanvas = origin?.querySelector('.workbench-overview-canvas');
    const fit = fitCanvasRegion(latest.current.area, latest.current.region, to, 0);
    const destination = returning && sourceCanvas
      ? projection(sourceCanvas, to)
      : { left: `${fit.left}px`, top: `${fit.top}px`, scale: fit.scale };
    state.current.pending = { from, to, destination, returning };
    setViewport({ width: to.width, height: to.height });
  }, [cancel, origin, surface]);
  useLayoutEffect(() => {
    const node = dialog.current, host = surface.current;
    node.showModal(); node.focus({ preventScroll: true });
    const source = origin?.isConnected ? rect(origin) : rect(host);
    const canvas = origin?.querySelector('.workbench-overview-canvas');
    plan({ frame: source, canvas: canvas ? projection(canvas, source) : null, shade: '0' });
    return () => { cancel(); node.close(); };
    // The mounted viewer owns this one origin and model; selection remounts it.
  }, [cancel, dialog, origin, plan, surface]);
  useLayoutEffect(() => {
    if (!state.current.before) return;
    plan(state.current.before); state.current.before = null;
  }, [expanded, region, plan]);
  useLayoutEffect(() => {
    const pending = state.current.pending;
    if (!pending || !viewport) return;
    state.current.pending = null;
    const { from, to, destination, returning } = pending;
    const host = surface.current, canvas = host.querySelector('.workbench-overview-canvas');
    host.dataset.ready = 'true';
    // The preview paints at its final fitted size. Lift scales that one surface
    // temporarily; resting images are never filtered through a second scale.
    const baseScale = parseFloat(canvas.style.width) / latest.current.area.width;
    const keyframe = value => ({ left: value.left, top: value.top, transform: `scale(${value.scale / baseScale})` });
    const options = { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700, easing: PRESENTATION_EASING, fill: 'both' };
    const animations = [
      host.animate([geometry(from.frame), geometry(to)], options),
      canvas.animate([keyframe(from.canvas || destination), keyframe(destination)], options),
      dialog.current.querySelector('.canvas-presentation-backdrop').animate([{ opacity: from.shade }, { opacity: returning ? 0 : 1 }], options),
    ];
    state.current.animations = animations;
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (state.current.animations !== animations) return;
      if (returning) latest.current.onClose();
      else { cancel(); delete host.dataset.moving; setViewport(null); }
    }).catch(() => {});
    // Frame and camera changes share this motion owner and its interruption path.
  }, [viewport, cancel, dialog, surface]);
  useLayoutEffect(() => {
    const resize = () => {
      if (state.current.closing) { latest.current.onClose(); return; }
      cancel(); state.current.pending = null; surface.current.dataset.ready = 'true'; delete surface.current.dataset.moving; setViewport(null);
    };
    addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, [cancel, surface]);
  return { viewport, close: () => {
    if (state.current.closing) return;
    state.current.closing = true;
    dialog.current.dataset.closing = 'true';
    dialog.current.querySelectorAll('.canvas-presentation-chrome').forEach(node => { node.inert = true; });
    plan(snapshot(), true);
  }, beforeViewChange: () => {
    if (state.current.closing) return false;
    state.current.before = snapshot(); return true;
  } };
}
