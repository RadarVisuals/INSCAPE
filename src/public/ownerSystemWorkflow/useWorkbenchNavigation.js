import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import useWorkbenchPan from './useWorkbenchPan.js';
import { constrainWorkbenchFrameCamera, fitWorkbenchReferenceFrame } from './workbenchReferenceFrame.js';
import { zoomWorkbenchCamera } from './workbenchViewScale.js';
import useWorkbenchCameraMotion from './useWorkbenchCameraMotion.js';
import { restoreWorkbenchCamera, workbenchDestinationCamera, workbenchNavigationViewport } from './workbenchNavigation.js';

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
  isEditing, cancelEditing, releaseAbandonedGesture, captureContext, restoreContext }) {
  const { offset, locked, getCamera, updateCamera } = useWorkbenchCamera();
  const interaction = useRef(null);
  interaction.current = { isEditing, cancelEditing, releaseAbandonedGesture, onReferenceFrameVisibleChange, captureContext, restoreContext };
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  const remember = useCallback(next => { historyRef.current = next; setHistory(next); }, []);
  const framing = useRef({ viewport: null, fitted: null, frameKey: null });
  framing.current.enabled = referenceFrameEnabled;
  framing.current.frame = referenceFrame;
  const constrainCamera = useCallback(camera => {
    const { enabled, viewport, frame } = framing.current;
    return enabled && viewport ? constrainWorkbenchFrameCamera(camera, viewport, frame) : camera;
  }, []);
  const applyCamera = useCallback(camera => updateCamera(constrainCamera(camera)), [constrainCamera, updateCamera]);
  const { start: travel, stop: stopTravel, moving } = useWorkbenchCameraMotion(getCamera, applyCamera);
  const getOffset = useCallback(() => getCamera().offset, [getCamera]);
  const panTo = useCallback(next => { stopTravel(); applyCamera({ ...getCamera(), offset: next }); }, [stopTravel, applyCamera, getCamera]);
  const beforePan = useCallback(() => { stopTravel(); interaction.current.cancelEditing(); }, [stopTravel]);
  const pan = useWorkbenchPan(hostRef, disabled || locked, { getOffset, update: panTo, onBegin: beforePan });
  const isPanning = useCallback(() => Boolean(pan.active.current), [pan.active]);
  const readViewport = useCallback(() => {
    const host = hostRef.current;
    if (!host) return null;
    const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
    return { width: host.clientWidth, height: host.clientHeight - dock - (controlsRef.current?.offsetHeight || 32) - 16 };
  }, [hostRef, controlsRef]);
  const focusDestination = useCallback(destination => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return false;
    const host = hostRef.current, viewport = readViewport(), bounds = destination.getBounds();
    if (!host || !viewport || !bounds) return false;
    const hostRect = host.getBoundingClientRect();
    const obstacles = [...host.querySelectorAll('[data-detached-window]:not([data-workbench-view-id])')]
      .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
      .map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left - hostRect.left, top: rect.top - hostRect.top, width: rect.width, height: rect.height };
      });
    const available = workbenchNavigationViewport(viewport, obstacles);
    const camera = getCamera();
    const minimum = referenceFrameEnabled ? framing.current.fitted?.scale ?? camera.scale : Math.min(.25, camera.scale);
    const candidate = workbenchDestinationCamera(bounds, available, minimum);
    if (!candidate) return false;
    const end = constrainCamera(candidate);
    if (Math.abs(end.scale - camera.scale) < 1e-7 && Math.abs(end.offset.x - camera.offset.x) < 1e-7
      && Math.abs(end.offset.y - camera.offset.y) < 1e-7) {
      stopTravel(); destination.onArrive?.(); host.focus({ preventScroll: true }); return true;
    }
    const originalBounds = JSON.stringify(bounds);
    const isCurrent = () => JSON.stringify(destination.getBounds()) === originalBounds;
    remember([...historyRef.current, { camera, viewport, context: interaction.current.captureContext?.() }].slice(-50));
    travel(end, { isCurrent, onComplete: destination.onArrive });
    host.focus({ preventScroll: true });
    return true;
  }, [disabled, locked, isPanning, hostRef, readViewport, getCamera, referenceFrameEnabled, constrainCamera, remember, travel, stopTravel]);
  const goBack = useCallback(() => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return false;
    const previous = historyRef.current.at(-1);
    if (!previous) return false;
    const end = constrainCamera(restoreWorkbenchCamera(previous.camera, previous.viewport, readViewport()));
    hostRef.current?.focus({ preventScroll: true });
    travel(end, { onComplete: () => {
      // An interrupted Back must remain available until its return completes.
      if (historyRef.current.at(-1) === previous) remember(historyRef.current.slice(0, -1));
      interaction.current.restoreContext?.(previous.context);
    } });
    return true;
  }, [disabled, locked, isPanning, remember, readViewport, constrainCamera, travel, hostRef]);
  useLayoutEffect(() => {
    if (disabled || locked) stopTravel();
    if (disabled) remember([]);
  }, [disabled, locked, stopTravel, remember]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.setProperty('--workbench-pan-x', `${offset.x}px`);
    host.style.setProperty('--workbench-pan-y', `${offset.y}px`);
    host.toggleAttribute('data-workbench-panned', offset.x !== 0 || offset.y !== 0);
  }, [hostRef, offset]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    host?.toggleAttribute('data-workbench-travelling', moving);
    return () => host?.removeAttribute('data-workbench-travelling');
  }, [hostRef, moving]);
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
    if (!host || disabled || locked) return;
    const measure = () => {
      const previous = framing.current;
      const viewport = readViewport();
      if (!viewport || viewport.width <= 0 || viewport.height <= 0) return;
      const frame = previous.frame, frameKey = referenceFrameEnabled ? frame.width + ':' + frame.height : null;
      const fitted = referenceFrameEnabled ? fitWorkbenchReferenceFrame(viewport, frame) : null;
      if (previous.viewport?.width === viewport.width && previous.viewport?.height === viewport.height && previous.frameKey === frameKey) return;
      const wasFitted = !previous.fitted || getCamera().scale <= previous.fitted.scale + 1e-6;
      const sizeChanged = previous.frameKey !== frameKey;
      const oldViewport = previous.viewport;
      framing.current = { ...previous, viewport, fitted, frameKey };
      stopTravel();
      if (!referenceFrameEnabled) return;
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
    dockVisible, disabled, locked, getCamera, applyCamera, pan.cancel, readViewport, stopTravel]);

  const zoom = useCallback((point, factor) => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    stopTravel();
    const anchor = { x: point.x - rect.left, y: point.y - rect.top };
    const camera = getCamera();
    const minimum = framing.current.enabled ? framing.current.fitted?.scale : undefined;
    applyCamera(zoomWorkbenchCamera(camera.scale, camera.offset, camera.scale * factor, anchor, minimum));
  }, [disabled, locked, hostRef, getCamera, applyCamera, isPanning, stopTravel]);
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
    stopTravel(); remember([]);
    interaction.current.onReferenceFrameVisibleChange(true);
    applyCamera(next);
    host.focus({ preventScroll: true });
  }, [hostRef, disabled, locked, isPanning, applyCamera, stopTravel, remember]);
  const resetView = useCallback(() => {
    if (disabled || locked) return;
    if (referenceFrameEnabled) fitFrame();
    else { stopTravel(); remember([]); pan.cancel(); panTo({ x: 0, y: 0 }); }
    hostRef.current?.focus({ preventScroll: true });
  }, [disabled, locked, referenceFrameEnabled, fitFrame, pan.cancel, panTo, hostRef, stopTravel, remember]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) return;
    // Native colour pickers can leave WheelEvent.buttons set after release.
    // Only pointer presses observed in this Workbench block camera input.
    const pressedPointers = new Set();
    const press = event => {
      pressedPointers.delete(event.pointerId);
      if (host.contains(event.target)) {
        pressedPointers.add(event.pointerId);
        stopTravel();
      }
    };
    const release = event => pressedPointers.delete(event.pointerId);
    const move = event => { if (!event.buttons) release(event); };
    const clear = () => { pressedPointers.clear(); stopTravel(); };
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
      // Stop before a module's keyboard editing or inspection handler runs.
      if (!event.target.closest?.('.workbench-view-controls') && !['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) stopTravel();
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
  }, [hostRef, disabled, locked, getCamera, isPanning, panTo, zoom, resetZoom, stopTravel]);

  return { offset, locked, getCamera, isPanning, fitFrame, resetView, resetZoom,
    focusDestination, goBack, canGoBack: history.length > 0, stopTravel };
}
