import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import useWorkbenchPan from './useWorkbenchPan.js';
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
  isEditing, cancelEditing, releaseAbandonedGesture, captureContext, restoreContext }) {
  const { offset, locked, getCamera, updateCamera } = useWorkbenchCamera();
  const interaction = useRef(null);
  interaction.current = { isEditing, cancelEditing, releaseAbandonedGesture, captureContext, restoreContext };
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  const remember = useCallback(next => { historyRef.current = next; setHistory(next); }, []);
  const measuredViewport = useRef(null);
  const { start: travel, stop: stopTravel, moving } = useWorkbenchCameraMotion(getCamera, updateCamera);
  const getOffset = useCallback(() => getCamera().offset, [getCamera]);
  const panTo = useCallback(next => { stopTravel(); updateCamera({ ...getCamera(), offset: next }); }, [stopTravel, updateCamera, getCamera]);
  const beforePan = useCallback(() => { stopTravel(); interaction.current.cancelEditing(); }, [stopTravel]);
  const pan = useWorkbenchPan(hostRef, disabled || locked, { getOffset, update: panTo, onBegin: beforePan });
  const isPanning = useCallback(() => Boolean(pan.active.current), [pan.active]);
  const readViewport = useCallback(() => {
    const host = hostRef.current;
    if (!host) return null;
    const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
    // Return context uses the Workbench viewport, independent of selection-driven
    // toolbar wrapping. Only destination fitting reserves the camera controls.
    return { width: host.clientWidth, height: host.clientHeight - dock };
  }, [hostRef]);
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
    const available = workbenchNavigationViewport({ ...viewport,
      height: viewport.height - (controlsRef.current?.offsetHeight || 32) - 16 }, obstacles);
    const camera = getCamera();
    const end = workbenchDestinationCamera(bounds, available);
    if (!end) return false;
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
  }, [disabled, locked, isPanning, hostRef, controlsRef, readViewport, getCamera, remember, travel, stopTravel]);
  const goBack = useCallback(() => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return false;
    const previous = historyRef.current.at(-1);
    if (!previous) return false;
    const end = restoreWorkbenchCamera(previous.camera, previous.viewport, readViewport());
    hostRef.current?.focus({ preventScroll: true });
    travel(end, { onComplete: () => {
      // An interrupted Back must remain available until its return completes.
      if (historyRef.current.at(-1) === previous) remember(historyRef.current.slice(0, -1));
      interaction.current.restoreContext?.(previous.context);
    } });
    return true;
  }, [disabled, locked, isPanning, remember, readViewport, travel, hostRef]);
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
      const previous = measuredViewport.current;
      const viewport = readViewport();
      if (!viewport || viewport.width <= 0 || viewport.height <= 0) return;
      const controlsHeight = controls?.offsetHeight || 32;
      if (previous?.width === viewport.width && previous?.height === viewport.height && previous?.controlsHeight === controlsHeight) return;
      measuredViewport.current = { ...viewport, controlsHeight };
      // Changing the free viewport invalidates travel, but never recentres the
      // camera or moves authored windows to fit a screen or composition frame.
      stopTravel();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (controls) observer.observe(controls);
    return () => observer.disconnect();
  }, [hostRef, controlsRef, dockVisible, disabled, locked, readViewport, stopTravel]);

  const zoom = useCallback((point, factor) => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    stopTravel();
    const anchor = { x: point.x - rect.left, y: point.y - rect.top };
    const camera = getCamera();
    updateCamera(zoomWorkbenchCamera(camera.scale, camera.offset, camera.scale * factor, anchor));
  }, [disabled, locked, hostRef, getCamera, updateCamera, isPanning, stopTravel]);
  const resetZoom = useCallback(() => {
    const host = hostRef.current, rect = host?.getBoundingClientRect();
    if (!rect) return;
    const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
    zoom({ x: rect.left + rect.width / 2, y: rect.top + (rect.height - dock) / 2 }, 1 / getCamera().scale);
    host.focus({ preventScroll: true });
  }, [hostRef, zoom, getCamera]);
  const resetView = useCallback(() => {
    if (disabled || locked) return;
    stopTravel(); remember([]); pan.cancel(); panTo({ x: 0, y: 0 });
    hostRef.current?.focus({ preventScroll: true });
  }, [disabled, locked, pan.cancel, panTo, hostRef, stopTravel, remember]);

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

  return { offset, locked, getCamera, isPanning, resetView, resetZoom,
    focusDestination, goBack, canGoBack: history.length > 0, stopTravel };
}
