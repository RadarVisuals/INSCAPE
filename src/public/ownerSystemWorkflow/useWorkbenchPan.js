import { useCallback, useEffect, useRef } from 'react';

export const isWorkbenchBackground = (target, host) => target === host
  || Boolean(target?.matches?.('.system-workflow__workbench, .system-workflow__display-instance'));

// Space-drag input only. The navigation controller owns camera updates and
// constraints; this gesture retains only the offset needed for cancellation.
export default function useWorkbenchPan(hostRef, disabled, { getOffset, update, onBegin }) {
  const active = useRef(null), space = useRef(false);
  const suppressedPointer = useRef(null), beforeBegin = useRef(onBegin);
  beforeBegin.current = onBegin;
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
      // Interface buttons keep native Space activation. A subsequent camera drag
      // moves focus to the host, so releasing Space does not click that button.
      space.current = true; host.dataset.workbenchPanReady = '';
      if (isWorkbenchBackground(event.target, host) || event.target === document.body
        || event.target?.matches?.('[data-workbench-selectable]')) event.preventDefault();
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
  const begin = useCallback(event => {
    const host = hostRef.current;
    if (disabled || !space.current || event.button !== 0 || active.current || !host?.contains(event.target)) return false;
    event.preventDefault(); event.stopImmediatePropagation();
    beforeBegin.current?.();
    suppressedPointer.current = event.pointerId;
    host.focus({ preventScroll: true });
    const origin = getOffset(), point = { x: event.clientX, y: event.clientY };
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
  }, [disabled, hostRef, finish, update, getOffset]);
  useEffect(() => {
    if (disabled) return;
    // Claim Space gestures before React's capture handlers can activate or move
    // a module. Module and Grid interaction never receive this pointer press.
    const pointer = event => {
      suppressedPointer.current = null;
      begin(event);
    };
    const click = event => {
      if (event.pointerId !== suppressedPointer.current) return;
      suppressedPointer.current = null;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    window.addEventListener('pointerdown', pointer, true);
    window.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('pointerdown', pointer, true);
      window.removeEventListener('click', click, true);
      suppressedPointer.current = null;
    };
  }, [begin, disabled]);
  return { active, cancel: finish };
}
