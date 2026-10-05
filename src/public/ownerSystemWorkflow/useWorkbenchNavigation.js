import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import useWorkbenchPan from './useWorkbenchPan.js';
import { constrainWorkbenchFrameCamera, fitWorkbenchReferenceFrame } from './workbenchReferenceFrame.js';
import { zoomWorkbenchCamera } from './workbenchViewScale.js';

// Native readers keep wheel input at both ends of an overflowing axis. Clipped
// artwork and paged readers leave it to the Workbench. Measure live, after edits.
function hasNativeWheelScroll(target, host, dx, dy) {
  for (let node = target; node && node !== host; node = node.parentElement) {
    if (node.nodeType !== 1) continue;
    const style = getComputedStyle(node);
    if (dy && /^(auto|scroll)$/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1
      || dx && /^(auto|scroll)$/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1) return true;
  }
  return false;
}

// Navigation never receives a draft store or module transforms. Editing owns
// its gestures and exposes only cancellation and input-ownership callbacks.
export default function useWorkbenchNavigation({ hostRef, controlsRef, disabled, dockVisible,
  referenceFrame, referenceFrameEnabled, onReferenceFrameVisibleChange,
  isEditing, cancelEditing, releaseAbandonedGesture }) {
  const { offset, locked, getCamera, updateCamera } = useWorkbenchCamera();
  const interaction = useRef(null);
  interaction.current = { isEditing, cancelEditing, releaseAbandonedGesture, onReferenceFrameVisibleChange };
  const framing = useRef({ viewport: null, fitted: null, frameKey: null });
  framing.current.enabled = referenceFrameEnabled;
  framing.current.frame = referenceFrame;
  const applyCamera = useCallback(camera => {
    const { enabled, viewport, frame } = framing.current;
    updateCamera(enabled && viewport ? constrainWorkbenchFrameCamera(camera, viewport, frame) : camera);
  }, [updateCamera]);
  const getOffset = useCallback(() => getCamera().offset, [getCamera]);
  const panTo = useCallback(next => applyCamera({ ...getCamera(), offset: next }), [applyCamera, getCamera]);
  const beforePan = useCallback(() => interaction.current.cancelEditing(), []);
  const pan = useWorkbenchPan(hostRef, disabled || locked, { getOffset, update: panTo, onBegin: beforePan });
  const isPanning = useCallback(() => Boolean(pan.active.current), [pan.active]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.setProperty('--workbench-pan-x', `${offset.x}px`);
    host.style.setProperty('--workbench-pan-y', `${offset.y}px`);
    host.toggleAttribute('data-workbench-panned', offset.x !== 0 || offset.y !== 0);
  }, [hostRef, offset]);
  useEffect(() => {
    const host = hostRef.current;
    return () => {
      host?.style.removeProperty('--workbench-pan-x');
      host?.style.removeProperty('--workbench-pan-y');
      host?.removeAttribute('data-workbench-panned');
    };
  }, [hostRef]);
  useEffect(() => {
    const host = hostRef.current, controls = controlsRef.current;
    if (!host || !referenceFrameEnabled || disabled || locked) return;
    const measure = () => {
      const previous = framing.current;
      const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
      const viewport = { width: host.clientWidth, height: host.clientHeight - dock - (controls?.offsetHeight || 32) - 16 };
      const frame = previous.frame, frameKey = frame.width + ':' + frame.height;
      const fitted = fitWorkbenchReferenceFrame(viewport, frame);
      if (!fitted) return;
      if (previous.viewport?.width === viewport.width && previous.viewport?.height === viewport.height && previous.frameKey === frameKey) return;
      const wasFitted = !previous.fitted || getCamera().scale <= previous.fitted.scale + 1e-6;
      const sizeChanged = previous.frameKey !== frameKey;
      const oldViewport = previous.viewport;
      framing.current = { ...previous, viewport, fitted, frameKey };
      interaction.current.cancelEditing();
      pan.cancel(true);
      const camera = getCamera();
      if (wasFitted || sizeChanged) applyCamera(fitted);
      else applyCamera({ scale: camera.scale, offset: {
        x: camera.offset.x + (viewport.width - oldViewport.width) / 2,
        y: camera.offset.y + (viewport.height - oldViewport.height) / 2,
      } });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (controls) observer.observe(controls);
    return () => observer.disconnect();
  }, [hostRef, controlsRef, referenceFrameEnabled, referenceFrame.width, referenceFrame.height,
    dockVisible, disabled, locked, getCamera, applyCamera, pan.cancel]);

  const zoom = useCallback((point, factor) => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    const anchor = { x: point.x - rect.left, y: point.y - rect.top };
    const camera = getCamera();
    const minimum = framing.current.enabled ? framing.current.fitted?.scale : undefined;
    applyCamera(zoomWorkbenchCamera(camera.scale, camera.offset, camera.scale * factor, anchor, minimum));
  }, [disabled, locked, hostRef, getCamera, applyCamera, isPanning]);
  const resetZoom = useCallback(() => {
    const host = hostRef.current, rect = host?.getBoundingClientRect();
    if (!rect) return;
    const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
    zoom({ x: rect.left + rect.width / 2, y: rect.top + (rect.height - dock) / 2 }, 1 / getCamera().scale);
    host.focus({ preventScroll: true });
  }, [hostRef, zoom, getCamera]);
  const fitFrame = useCallback(() => {
    const host = hostRef.current;
    if (!host || disabled || locked || interaction.current.isEditing() || isPanning()) return;
    const next = framing.current.fitted;
    if (!next) return;
    interaction.current.onReferenceFrameVisibleChange(true);
    applyCamera(next);
    host.focus({ preventScroll: true });
  }, [hostRef, disabled, locked, isPanning, applyCamera]);
  const resetView = useCallback(() => {
    if (disabled || locked) return;
    if (referenceFrameEnabled) fitFrame();
    else { pan.cancel(); panTo({ x: 0, y: 0 }); }
    hostRef.current?.focus({ preventScroll: true });
  }, [disabled, locked, referenceFrameEnabled, fitFrame, pan.cancel, panTo, hostRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) return;
    // Native colour pickers can leave WheelEvent.buttons set after release.
    // Only pointer presses observed in this Workbench block camera input.
    const pressedPointers = new Set();
    const press = event => {
      pressedPointers.delete(event.pointerId);
      if (host.contains(event.target)) pressedPointers.add(event.pointerId);
    };
    const release = event => pressedPointers.delete(event.pointerId);
    const move = event => { if (!event.buttons) release(event); };
    const clear = () => pressedPointers.clear();
    const hidden = () => { if (document.hidden) clear(); };
    const wheel = event => {
      const released = interaction.current.releaseAbandonedGesture();
      if (released !== null) pressedPointers.delete(released);
      if (locked) {
        if (event.ctrlKey || !hasNativeWheelScroll(event.target, host, event.deltaX, event.deltaY)) {
          event.preventDefault(); event.stopPropagation();
        }
        return;
      }
      if (event.target.closest?.('.workbench-reference-size')) { event.preventDefault(); return; }
      if (!event.ctrlKey && !event.metaKey && !event.target.closest?.('[data-immersive]')) {
        const unitX = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientWidth : 1;
        const unitY = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
        const dx = (event.shiftKey ? Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY : event.deltaX) * unitX;
        const dy = event.shiftKey ? 0 : event.deltaY * unitY;
        if (!dx && !dy || hasNativeWheelScroll(event.target, host, dx, dy)) return;
        event.preventDefault(); event.stopPropagation();
        if (!interaction.current.isEditing() && !isPanning() && !pressedPointers.size) {
          const current = getCamera().offset;
          panTo({ x: current.x - dx, y: current.y - dy });
        }
        return;
      }
      if (!event.ctrlKey || !event.deltaY || event.target.closest?.('[data-immersive]')) return;
      event.preventDefault(); event.stopPropagation();
      if (interaction.current.isEditing() || pressedPointers.size) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
      zoom({ x: event.clientX, y: event.clientY }, Math.exp(-Math.max(-120, Math.min(120, delta)) * .003));
    };
    const key = event => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== '0') return;
      if (locked) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.altKey || event.target.closest?.('[data-immersive], input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault(); event.stopPropagation();
      interaction.current.cancelEditing(); resetZoom();
    };
    globalThis.addEventListener('pointerdown', press, true);
    globalThis.addEventListener('pointermove', move, true);
    for (const name of ['pointerup', 'pointercancel', 'click']) globalThis.addEventListener(name, release, true);
    globalThis.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hidden);
    host.addEventListener('wheel', wheel, { passive: false, capture: true });
    host.addEventListener('keydown', key, true);
    return () => {
      clear();
      globalThis.removeEventListener('pointerdown', press, true);
      globalThis.removeEventListener('pointermove', move, true);
      for (const name of ['pointerup', 'pointercancel', 'click']) globalThis.removeEventListener(name, release, true);
      globalThis.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', hidden);
      host.removeEventListener('wheel', wheel, true);
      host.removeEventListener('keydown', key, true);
    };
  }, [hostRef, disabled, locked, getCamera, isPanning, panTo, zoom, resetZoom]);

  return { offset, locked, getCamera, isPanning, fitFrame, resetView, resetZoom };
}
