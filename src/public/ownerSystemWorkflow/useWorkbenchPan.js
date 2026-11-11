import { useCallback, useEffect, useRef } from 'react';
import { workbenchPanVelocity } from './workbenchInertia.js';

export const isWorkbenchBackground = (target, host) => target === host
  || Boolean(target?.matches?.('.system-workflow__workbench, .system-workflow__display-instance'));

// Space-drag and the Hand tool share one camera gesture. Navigation owns the camera;
// this gesture retains its cancellation offset and bounded release samples.
export function isWorkbenchHandSurface(target, host) {
  if (!host?.contains(target) || target?.closest?.('input, textarea, select, a, summary, [contenteditable="true"], [role="textbox"], [role="slider"], [role="menu"], [role="dialog"], [role="toolbar"], [data-workbench-toolbar], .workbench-view-controls, [data-workbench-group-tools], [data-workbench-selection-tools], [data-immersive], iframe')) return false;
  const button = target.closest?.('button');
  if (button && !button.matches('.image-module__canvas, [data-workbench-selectable], .system-workflow__resize-handle, .workbench-selection__handle')) return false;
  if (target.closest?.('.system-workflow__detached-window-titlebar, .system-workflow__detached-window-resize')) return true;
  if (target.closest?.('[data-shared-display-tools], [data-context-tools], [data-shared-text-tools], [data-system-workflow-panel]')) return false;
  return isWorkbenchBackground(target, host) || Boolean(target.closest?.('[data-workbench-view-id], [data-workbench-module], .system-workflow__canvas, .workbench-selection'));
}

export default function useWorkbenchPan(hostRef, disabled, { getOffset, update, onBegin, onEnd, hand = false }) {
  const active = useRef(null), space = useRef(false);
  const suppressedPointer = useRef(null), beforeBegin = useRef(onBegin);
  beforeBegin.current = onBegin;
  const afterEnd = useRef(onEnd); afterEnd.current = onEnd;
  const finish = useCallback((restore = false, releasedAt) => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = null;
    suppressedPointer.current = gesture.dragged || !gesture.allowClick || releasedAt === undefined ? gesture.id : null;
    window.removeEventListener('pointermove', gesture.move, true);
    window.removeEventListener('pointerup', gesture.up, true);
    window.removeEventListener('pointercancel', gesture.cancel, true);
    gesture.target.removeEventListener('lostpointercapture', gesture.lost);
    if (gesture.target.hasPointerCapture(gesture.id)) gesture.target.releasePointerCapture(gesture.id);
    delete gesture.host.dataset.workbenchPanning;
    if (restore) update(gesture.origin);
    afterEnd.current?.(!gesture.dragged || releasedAt === undefined ? null : workbenchPanVelocity(gesture.samples, releasedAt));
  }, [update]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) return;
    const release = () => { space.current = false; delete host.dataset.workbenchPanReady; finish(); };
    const cancel = () => { space.current = false; delete host.dataset.workbenchPanReady; finish(true); };
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
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancel();
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [hostRef, disabled, finish]);
  const begin = useCallback(event => {
    const host = hostRef.current;
    if (disabled || !(space.current || hand && isWorkbenchHandSurface(event.target, host)) || event.button !== 0 || active.current || !host?.contains(event.target)) return false;
    event.preventDefault(); event.stopImmediatePropagation();
    beforeBegin.current?.();
    const allowClick = hand && !space.current;
    // Retain the original click target for inspection. Claim pointerdown before
    // module drag/resize handlers, then suppress activation only after a drag.
    const target = allowClick ? event.target : host;
    host.focus({ preventScroll: true });
    const origin = getOffset(), point = { x: event.clientX, y: event.clientY };
    const samples = [{ x: event.clientX, y: event.clientY, time: event.timeStamp }];
    const gesture = { id: event.pointerId, host, target, origin, samples, allowClick, dragged: false,
      move: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        pointer.preventDefault(); pointer.stopPropagation();
        samples.push({ x: pointer.clientX, y: pointer.clientY, time: pointer.timeStamp });
        if (samples.length > 12) samples.shift();
        if (gesture.allowClick && !gesture.dragged && Math.hypot(pointer.clientX - point.x, pointer.clientY - point.y) < 5) return;
        gesture.dragged = true;
        host.focus({ preventScroll: true });
        update({ x: origin.x + pointer.clientX - point.x, y: origin.y + pointer.clientY - point.y });
      },
      up: pointer => { if (pointer.pointerId === event.pointerId) finish(false, pointer.timeStamp); },
      cancel: pointer => { if (pointer.pointerId === event.pointerId) finish(true); },
      lost: pointer => { if (pointer.pointerId === event.pointerId) finish(); },
    };
    active.current = gesture;
    host.dataset.workbenchPanning = '';
    target.setPointerCapture(event.pointerId);
    target.addEventListener('lostpointercapture', gesture.lost);
    window.addEventListener('pointermove', gesture.move, true);
    window.addEventListener('pointerup', gesture.up, true);
    window.addEventListener('pointercancel', gesture.cancel, true);
    return true;
  }, [disabled, hand, hostRef, finish, update, getOffset]);
  useEffect(() => {
    if (disabled) return;
    // Claim camera gestures before React's capture handlers can activate or move
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
  const releaseAbandonedGesture = useCallback(() => {
    const gesture = active.current;
    // A wheel can be the first input after a release consumed by browser UI.
    // End like lost capture: retain the shown camera and never start inertia.
    if (gesture && !gesture.target.hasPointerCapture(gesture.id)) finish();
  }, [finish]);
  return { active, cancel: finish, releaseAbandonedGesture };
}
