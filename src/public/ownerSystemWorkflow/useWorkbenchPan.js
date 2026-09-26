import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';

export const isWorkbenchBackground = (target, host) => target === host
  || Boolean(target?.matches?.('.system-workflow__workbench, .system-workflow__display-instance'));

// A view offset owned by this mounted Workbench, never a saved window position.
// Only the host's CSS variables change: content editors do not render per pixel.
export default function useWorkbenchPan(hostRef, disabled) {
  const { offset, setOffset } = useWorkbenchCamera();
  const current = useRef(offset), active = useRef(null), space = useRef(false);
  const update = useCallback(next => { current.current = next; setOffset(next); }, [setOffset]);
  const finish = useCallback((restore = false) => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = null;
    window.removeEventListener('pointermove', gesture.move, true);
    window.removeEventListener('pointerup', gesture.up, true);
    window.removeEventListener('pointercancel', gesture.cancel, true);
    gesture.host.removeEventListener('lostpointercapture', gesture.lost);
    if (gesture.host.hasPointerCapture(gesture.id)) gesture.host.releasePointerCapture(gesture.id);
    delete gesture.host.dataset.workbenchPanning;
    if (restore) update(gesture.origin);
  }, [update]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.setProperty('--workbench-pan-x', `${offset.x}px`);
    host.style.setProperty('--workbench-pan-y', `${offset.y}px`);
    host.toggleAttribute('data-workbench-panned', offset.x !== 0 || offset.y !== 0);
  }, [hostRef, offset]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) return;
    const release = () => { space.current = false; delete host.dataset.workbenchPanReady; finish(); };
    const keydown = event => {
      if (event.key === 'Escape' && active.current) {
        event.preventDefault(); event.stopPropagation(); finish(true); return;
      }
      if (event.code !== 'Space' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
        || event.target?.isContentEditable || event.target?.closest?.('input, textarea, select, [role="textbox"], [role="slider"]')) return;
      if (!host.contains(event.target) && !(event.target === document.body && host.matches(':hover'))) return;
      // Buttons keep native Space activation. A subsequent background drag
      // moves focus to the host, so releasing Space does not click that button.
      space.current = true; host.dataset.workbenchPanReady = '';
      if (isWorkbenchBackground(event.target, host) || event.target === document.body) event.preventDefault();
    };
    const keyup = event => { if (event.code === 'Space') release(); };
    const hidden = () => { if (document.hidden) release(); };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      release();
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [hostRef, disabled, finish]);
  useEffect(() => {
    const host = hostRef.current;
    return () => {
      host?.style.removeProperty('--workbench-pan-x');
      host?.style.removeProperty('--workbench-pan-y');
      host?.removeAttribute('data-workbench-panned');
    };
  }, [hostRef]);
  const begin = event => {
    const host = hostRef.current;
    if (disabled || !space.current || event.button !== 0 || active.current || !isWorkbenchBackground(event.target, host)) return false;
    event.preventDefault(); event.stopPropagation();
    host.focus({ preventScroll: true });
    const origin = current.current, point = { x: event.clientX, y: event.clientY };
    const gesture = { id: event.pointerId, host, origin,
      move: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        pointer.preventDefault(); pointer.stopPropagation();
        update({ x: origin.x + pointer.clientX - point.x, y: origin.y + pointer.clientY - point.y });
      },
      up: pointer => { if (pointer.pointerId === event.pointerId) finish(); },
      cancel: pointer => { if (pointer.pointerId === event.pointerId) finish(true); },
      lost: pointer => { if (pointer.pointerId === event.pointerId) finish(); },
    };
    active.current = gesture;
    host.dataset.workbenchPanning = '';
    host.setPointerCapture(event.pointerId);
    host.addEventListener('lostpointercapture', gesture.lost);
    window.addEventListener('pointermove', gesture.move, true);
    window.addEventListener('pointerup', gesture.up, true);
    window.addEventListener('pointercancel', gesture.cancel, true);
    return true;
  };
  return { offset, current, active, begin, update, reset: () => { finish(); update({ x: 0, y: 0 }); } };
}
