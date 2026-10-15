import { useLayoutEffect } from 'react';
import { workbenchPanVelocity, workbenchPanCoast } from '../../public/ownerSystemWorkflow/workbenchInertia.js';

// Native horizontal scrolling owns position and touch momentum. Mouse dragging
// uses the existing bounded decay, without taking over live Display gestures.
export default function useReceptionCarousel(ref, { disabled, reducedMotion, revision }) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || disabled) return undefined;
    let gesture = null, frame = 0, suppressClick = false;
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };
    const finish = (event, coast = false) => {
      if (!gesture || event && event.pointerId !== gesture.id) return;
      const previous = gesture; gesture = null;
      delete node.dataset.dragging;
      if (node.hasPointerCapture(previous.id)) node.releasePointerCapture(previous.id);
      if (!previous.dragged || !coast || reducedMotion) return;
      const last = previous.samples.at(-1);
      // Measure at the final movement, unless the pointer rested before release.
      // A slow paint must not discard the preceding movement sample merely
      // because pointerup arrives a few milliseconds later.
      const releasedAt = event.timeStamp - last.time <= 64 ? last.time : event.timeStamp;
      const cutoff = releasedAt - 100;
      const first = previous.samples.findIndex(sample => sample.time >= cutoff);
      const samples = previous.samples.slice(Math.max(0, first));
      const before = previous.samples[first - 1], after = samples[0];
      // Retain the segment crossing the history boundary. Under a slow paint,
      // two real mouse samples can be more than 100 ms apart; discarding that
      // segment would turn a moving release into a stationary one.
      if (before && after && after.time > cutoff && after.time - before.time <= 250) {
        const progress = (cutoff - before.time) / (after.time - before.time);
        samples.unshift({ x: before.x + (after.x - before.x) * progress, y: 0, time: cutoff });
      }
      const velocity = workbenchPanVelocity(samples, releasedAt);
      const motion = workbenchPanCoast({ scale: 1, offset: { x: node.scrollLeft, y: 0 } }, { x: -velocity.x, y: 0 });
      if (!motion) return;
      const start = performance.now();
      const tick = now => {
        const position = motion.at(now - start).offset.x;
        node.scrollLeft = position;
        // The first RAF may share the release frame and round to the same
        // scroll pixel. Only a real edge or elapsed duration ends the coast.
        if (now - start < motion.duration && position > 0 && position < node.scrollWidth - node.clientWidth) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const down = event => {
      stop(); suppressClick = false;
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey
        || event.target.closest('button, input, textarea, select, .published-display, .bento-linked-text')) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, dragged: false,
        samples: [{ x: event.clientX, y: 0, time: event.timeStamp }] };
    };
    const move = event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (!event.buttons) { finish(event); return; }
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.dragged) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { finish(event); return; }
        gesture.dragged = true; suppressClick = true;
        node.setPointerCapture(event.pointerId); node.dataset.dragging = '';
      }
      event.preventDefault();
      gesture.samples.push({ x: event.clientX, y: 0, time: event.timeStamp });
      if (gesture.samples.length > 12) gesture.samples.shift();
      node.scrollLeft = gesture.left - dx;
    };
    const up = event => finish(event, true);
    const cancel = event => { stop(); finish(event?.pointerId ? event : null); };
    const lost = event => { if (gesture?.id === event.pointerId) cancel(event); };
    const click = event => { if (suppressClick && event.detail !== 0) { suppressClick = false; event.preventDefault(); event.stopPropagation(); } };
    const drag = event => event.preventDefault();
    const hidden = () => { if (document.hidden) cancel(); };
    const key = event => {
      stop();
      if (event.key === 'Escape') { cancel(); return; }
      if (event.target !== node || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const left = event.key === 'Home' ? 0 : event.key === 'End' ? node.scrollWidth
        : node.scrollLeft + node.clientWidth * .65 * (event.key === 'ArrowRight' ? 1 : -1);
      node.scrollTo({ left, behavior: reducedMotion ? 'instant' : 'smooth' });
    };
    node.addEventListener('pointerdown', down, true);
    node.addEventListener('click', click, true);
    node.addEventListener('dragstart', drag);
    node.addEventListener('keydown', key);
    node.addEventListener('wheel', stop, { passive: true });
    node.addEventListener('lostpointercapture', lost);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancel();
      node.removeEventListener('pointerdown', down, true); node.removeEventListener('click', click, true);
      node.removeEventListener('dragstart', drag); node.removeEventListener('keydown', key); node.removeEventListener('wheel', stop);
      node.removeEventListener('lostpointercapture', lost);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [ref, disabled, reducedMotion, revision]);
}
