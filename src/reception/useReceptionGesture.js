import { useEffect, useRef } from 'react';

// Pointer candidates are temporary. Every exit route cleans up capture and
// listeners; only a valid release may submit one completed operation.
export default function useReceptionGesture(version) {
  const active = useRef(null);
  useEffect(() => { active.current?.cancel(); }, [version]);
  useEffect(() => () => active.current?.cancel(), []);
  return { cancel: () => active.current?.cancel(), begin(event, { update, commit, cancel }) {
    if (event.button !== 0) return;
    active.current?.cancel(); event.preventDefault(); event.stopPropagation();
    const source = event.currentTarget, pointerId = event.pointerId;
    let done = false;
    const finish = accepted => {
      if (done) return; done = true; active.current = null;
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', abort, true); removeEventListener('keydown', key, true); removeEventListener('blur', abort);
      document.removeEventListener('visibilitychange', hidden); source.removeEventListener('lostpointercapture', abort);
      if (source.hasPointerCapture(pointerId)) source.releasePointerCapture(pointerId);
      if (accepted) commit(); else cancel();
    };
    const abort = () => finish(false), key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); abort(); } };
    const hidden = () => { if (document.hidden) abort(); };
    const move = e => { if (e.pointerId === pointerId) { if (!e.buttons) abort(); else update(e); } };
    const up = e => { if (e.pointerId === pointerId) { update(e); finish(true); } };
    active.current = { cancel: abort };
    source.setPointerCapture(pointerId);
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', abort, true);
    addEventListener('keydown', key, true); addEventListener('blur', abort); document.addEventListener('visibilitychange', hidden);
    source.addEventListener('lostpointercapture', abort);
  } };
}
