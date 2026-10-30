import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import useWorkbenchPan, { isWorkbenchHandSurface } from './useWorkbenchPan.js';
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

// Both rails reserve screen space, whether they sit beside or above each other.
function controlsTop(host, controls) {
  const top = Math.min(controls?.getBoundingClientRect().top ?? Infinity,
    host?.querySelector('[data-workbench-toolbar]')?.getBoundingClientRect().top ?? Infinity);
  return Number.isFinite(top) ? top : undefined;
}

// Navigation never receives a draft store or module transforms. Editing owns
// its gestures and exposes only cancellation and input-ownership callbacks.
export default function useWorkbenchNavigation({ hostRef, controlsRef, disabled, dockVisible, creationToolbarVisible, onControlsTopChange,
  interactionTool = 'select', setInteractionTool,
  isEditing, cancelEditing, releaseAbandonedGesture, captureContext, restoreContext, returnTargets, resetPresentation, entries }) {
  const camera = useWorkbenchCamera();
  const { offset, locked, getCamera, updateCamera } = camera;
  const navigatorGesture = useRef(null);
  const interaction = useRef(null);
  interaction.current = { isEditing, cancelEditing, releaseAbandonedGesture, captureContext, restoreContext, returnTargets, resetPresentation };
  const [history, setHistory] = useState([]);
  const hand = interactionTool === 'hand';
  const historyRef = useRef(history);
  const remember = useCallback(next => { historyRef.current = next; setHistory(next); }, []);
  const measuredViewport = useRef(null);
  const captureCheck = useRef(null);
  const hasCapturedPointer = useCallback(() => captureCheck.current?.() || false, []);
  const { start: travel, stop: stopTravel, moving, beginPan, panTo: previewPan, releasePan } = useWorkbenchCameraMotion(camera, hostRef, entries);
  const getOffset = useCallback(() => getCamera().offset, [getCamera]);
  const panTo = useCallback(next => { stopTravel(); updateCamera({ ...getCamera(), offset: next }); }, [stopTravel, updateCamera, getCamera]);
  const beforePan = useCallback(() => { interaction.current.cancelEditing(); beginPan(); }, [beginPan]);
  const afterPan = useCallback(velocity => releasePan(hand ? velocity : null), [releasePan, hand]);
  const pan = useWorkbenchPan(hostRef, disabled || locked, { getOffset, update: previewPan, onBegin: beforePan, onEnd: afterPan, hand });
  const toggleHand = useCallback(() => { stopTravel(true); pan.cancel(); interaction.current.cancelEditing(); setInteractionTool?.(hand ? 'select' : 'hand'); }, [stopTravel, pan.cancel, hand, setInteractionTool]);
  useLayoutEffect(() => {
    stopTravel(); pan.cancel(true); interaction.current.cancelEditing();
  }, [interactionTool, stopTravel, pan.cancel]);
  useEffect(() => {
    const reset = () => { pan.cancel(true); setInteractionTool?.('select'); };
    const hidden = () => { if (document.hidden) reset(); };
    globalThis.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => { globalThis.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', hidden); };
  }, [pan.cancel, setInteractionTool]);
  useLayoutEffect(() => { if (disabled) setInteractionTool?.('select'); }, [disabled, setInteractionTool]);
  const isPanning = useCallback(() => Boolean(pan.active.current || navigatorGesture.current), [pan.active]);
  const readViewport = useCallback(() => {
    const host = hostRef.current;
    if (!host) return null;
    const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
    // Return context uses the Workbench viewport, independent of selection-driven
    // toolbar wrapping. Only destination fitting reserves the camera controls.
    return { width: host.clientWidth, height: host.clientHeight - dock };
  }, [hostRef]);
  const navigationViewport = useCallback(() => {
    const viewport = readViewport(), host = hostRef.current;
    if (!viewport || !host) return null;
    const top = controlsTop(host, controlsRef.current);
    return workbenchNavigationViewport(viewport, Number.isFinite(top) ? top - host.getBoundingClientRect().top : undefined);
  }, [readViewport, hostRef, controlsRef]);
  const beginNavigator = useCallback(() => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return false;
    navigatorGesture.current = getCamera(); beginPan(); return true;
  }, [disabled, locked, isPanning, getCamera, beginPan]);
  const moveNavigator = useCallback(point => {
    if (!navigatorGesture.current) return;
    const viewport = navigationViewport(), current = getCamera();
    if (!viewport) return;
    previewPan({ x: viewport.left + viewport.width / 2 - point.x * current.scale,
      y: viewport.top + viewport.height / 2 - point.y * current.scale });
  }, [navigationViewport, getCamera, previewPan]);
  const endNavigator = useCallback(cancelled => {
    const start = navigatorGesture.current;
    if (!start) return;
    navigatorGesture.current = null;
    if (cancelled) previewPan(start.offset);
    releasePan(null);
  }, [previewPan, releasePan]);
  useEffect(() => () => endNavigator(true), [endNavigator]);
  useEffect(() => { if (disabled || locked) endNavigator(true); }, [disabled, locked, endNavigator]);
  const captureView = useCallback(() => {
    const host = hostRef.current, viewport = readViewport();
    if (!host || !viewport || moving || locked || interaction.current.isEditing() || isPanning()) return null;
    const top = controlsTop(hostRef.current, controlsRef.current);
    const available = workbenchNavigationViewport(viewport, Number.isFinite(top) ? top - host.getBoundingClientRect().top : undefined);
    const camera = getCamera();
    return { left: (available.left - camera.offset.x) / camera.scale,
      top: (available.top - camera.offset.y) / camera.scale,
      width: available.width / camera.scale, height: available.height / camera.scale };
  }, [hostRef, controlsRef, readViewport, getCamera, moving, locked, isPanning]);
  const goBack = useCallback(() => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return false;
    const previous = historyRef.current.at(-1);
    if (!previous) return false;
    const end = restoreWorkbenchCamera(previous.camera, previous.viewport, readViewport());
    hostRef.current?.focus({ preventScroll: true });
    travel(end, { destinations: interaction.current.returnTargets?.(previous.context), onComplete: () => {
      // An interrupted Back must remain available until its return completes.
      if (historyRef.current.at(-1) === previous) remember(historyRef.current.slice(0, -1));
      interaction.current.restoreContext?.(previous.context);
    } });
    return true;
  }, [disabled, locked, isPanning, remember, readViewport, travel, hostRef]);
  const focusDestination = useCallback(destination => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return false;
    // Destination identity lives with its existing return context, never in a
    // separate toggle flag. Explicit Focus clicks remain idempotent.
    if (destination.toggle && destination.key && historyRef.current.at(-1)?.destinationKey === destination.key) return goBack();
    const host = hostRef.current, viewport = readViewport();
    if (!host || !viewport) return false;
    const context = interaction.current.captureContext?.();
    const unavailable = () => { if (destination.prepare) interaction.current.restoreContext?.(context); return false; };
    destination.prepare?.();
    const bounds = destination.getBounds();
    if (!bounds) return unavailable();
    const hostRect = host.getBoundingClientRect();
    // Focus has a predictable centre. Floating instruments do not choose a
    // different destination; the actual bottom rail includes toolbar clearance.
    const chromeTop = controlsTop(hostRef.current, controlsRef.current);
    const available = workbenchNavigationViewport(viewport,
      Number.isFinite(chromeTop) ? chromeTop - hostRect.top : undefined);
    const camera = getCamera();
    const end = workbenchDestinationCamera(bounds, available, .25, destination.padding ?? 32);
    if (!end) return unavailable();
    if (!destination.remember && Math.abs(end.scale - camera.scale) < 1e-7 && Math.abs(end.offset.x - camera.offset.x) < 1e-7
      && Math.abs(end.offset.y - camera.offset.y) < 1e-7) {
      stopTravel(); destination.onArrive?.(); host.focus({ preventScroll: true }); return true;
    }
    const originalBounds = JSON.stringify(bounds);
    const isCurrent = () => JSON.stringify(destination.getBounds()) === originalBounds;
    if (!destination.replaceHistory || !historyRef.current.length) remember([...historyRef.current, { camera, viewport, context, destinationKey: destination.key }].slice(-50));
    travel(end, { isCurrent, onComplete: destination.onArrive, origins: destination.origins });
    host.focus({ preventScroll: true });
    return true;
  }, [disabled, locked, isPanning, hostRef, controlsRef, readViewport, getCamera, remember, travel, stopTravel, goBack]);
  useLayoutEffect(() => {
    if (disabled || locked) stopTravel();
    if (disabled) remember([]);
  }, [disabled, locked, stopTravel, remember]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Only unregistered shortcuts consume inherited pan. Module windows own
    // their full camera geometry; changing properties on the host restyles every
    // artwork/editor descendant even when those properties are never used there.
    const selector = '[data-workbench-pan]:not([data-workbench-view-id])';
    const paint = node => {
      const { offset } = getCamera();
      node.style.setProperty('--workbench-pan-x', `${offset.x}px`);
      node.style.setProperty('--workbench-pan-y', `${offset.y}px`);
    };
    host.querySelectorAll(selector).forEach(paint);
    // A minimized or lazy shortcut may mount after this camera commit.
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches(selector)) paint(node);
        node.querySelectorAll(selector).forEach(paint);
      }
    });
    observer.observe(host, { childList: true, subtree: true });
    const current = getCamera();
    host.dataset.workbenchCameraScale = String(current.scale);
    host.dataset.workbenchCameraX = String(current.offset.x);
    host.dataset.workbenchCameraY = String(current.offset.y);
    host.toggleAttribute('data-workbench-panned', offset.x !== 0 || offset.y !== 0);
    return () => observer.disconnect();
  }, [hostRef, offset, getCamera]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    host?.toggleAttribute('data-workbench-hand', interactionTool === 'hand' && !disabled && !locked);
    return () => host?.removeAttribute('data-workbench-hand');
  }, [hostRef, interactionTool, disabled, locked]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    host?.toggleAttribute('data-workbench-travelling', moving);
    return () => host?.removeAttribute('data-workbench-travelling');
  }, [hostRef, moving]);
  useEffect(() => {
    const host = hostRef.current;
    return () => {
      host?.querySelectorAll('[data-workbench-pan]:not([data-workbench-view-id])').forEach(node => {
        node.style.removeProperty('--workbench-pan-x'); node.style.removeProperty('--workbench-pan-y');
      });
      host?.removeAttribute('data-workbench-panned');
      for (const name of ['data-workbench-camera-scale', 'data-workbench-camera-x', 'data-workbench-camera-y']) host?.removeAttribute(name);
    };
  }, [hostRef]);
  useEffect(() => {
    const host = hostRef.current, controls = controlsRef.current;
    if (!host || disabled) { onControlsTopChange?.(null); return; }
    const toolbar = host.querySelector('[data-workbench-toolbar]');
    const switcher = host.querySelector('.workbench-switcher');
    const properties = ['--workbench-toolbar-clearance', '--workbench-toolbar-width', '--workbench-toolbar-offset'];
    const previousProperties = properties.map(name => controls?.style.getPropertyValue(name));
    const previousOffset = toolbar?.style.getPropertyValue(properties[2]);
    const measure = () => {
      // The camera rail owns its placement beside/above the creation toolbar.
      // Keep measured CSS values on that rail, outside authored module trees.
      const rectangle = toolbar?.getBoundingClientRect();
      if (controls && rectangle) {
        for (const [index, value] of [rectangle.height, rectangle.width].entries()) {
          const pixels = `${Math.ceil(value)}px`, property = properties[index];
          if (controls.style.getPropertyValue(property) !== pixels) controls.style.setProperty(property, pixels);
        }
        // Preserve the normal offset while fitting both rails below the
        // Workbench switcher on short screens. This owner already measures
        // their wrapped sizes; a second fixed positioning rule drifts from it.
        const style = getComputedStyle(host), top = host.getBoundingClientRect().top;
        const ceiling = Math.max(0, (switcher?.getBoundingClientRect().bottom ?? top) - top + 8);
        const available = host.clientHeight - ceiling - controls.offsetHeight - rectangle.height
          - (parseFloat(style.getPropertyValue('--workflow-dock-height')) || 0) - 24;
        const offset = `${Math.max(0, Math.floor(Math.min(
          parseFloat(style.getPropertyValue(properties[2])) || 0, available
        )))}px`;
        for (const node of [toolbar, controls]) {
          if (node.style.getPropertyValue(properties[2]) !== offset) node.style.setProperty(properties[2], offset);
        }
      }
      // The same live chrome measurement also bounds companion tools. Their
      // screen space must account for wrapping controls and the current dock.
      onControlsTopChange?.(controlsTop(host, controls) ?? null);
      const previous = measuredViewport.current;
      const viewport = readViewport();
      if (!viewport || viewport.width <= 0 || viewport.height <= 0) return;
      const controlsHeight = controls?.offsetHeight || 32;
      if (previous?.width === viewport.width && previous?.height === viewport.height && previous?.controlsHeight === controlsHeight) return;
      measuredViewport.current = { ...viewport, controlsHeight };
      // Changing the free viewport invalidates travel, but never recentres the
      // camera or moves authored windows to fit a screen or composition frame.
      if (!locked) stopTravel();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (controls) observer.observe(controls);
    if (toolbar) observer.observe(toolbar);
    if (switcher) observer.observe(switcher);
    return () => {
      observer.disconnect();
      properties.forEach((property, index) => {
        if (previousProperties[index]) controls?.style.setProperty(property, previousProperties[index]);
        else controls?.style.removeProperty(property);
      });
      if (previousOffset) toolbar?.style.setProperty(properties[2], previousOffset);
      else toolbar?.style.removeProperty(properties[2]);
    };
  }, [hostRef, controlsRef, dockVisible, creationToolbarVisible, disabled, locked, readViewport, stopTravel, onControlsTopChange]);

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
    stopTravel(); remember([]); interaction.current.resetPresentation?.(); pan.cancel(); panTo({ x: 0, y: 0 });
    hostRef.current?.focus({ preventScroll: true });
  }, [disabled, locked, pan.cancel, panTo, hostRef, stopTravel, remember]);

  const navigatorZoom = useCallback(percent => {
    const viewport = navigationViewport(), rect = hostRef.current?.getBoundingClientRect();
    if (!viewport || !rect) return;
    zoom({ x: rect.left + viewport.left + viewport.width / 2, y: rect.top + viewport.top + viewport.height / 2 }, percent / 100 / getCamera().scale);
  }, [navigationViewport, hostRef, zoom, getCamera]);
  const navigatorHome = useCallback(() => {
    if (disabled || locked || interaction.current.isEditing() || isPanning()) return;
    resetView(); updateCamera({ scale: 1, offset: { x: 0, y: 0 } });
  }, [disabled, locked, isPanning, resetView, updateCamera]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) return;
    // A missed release from browser/native UI must not latch wheel input off.
    // Remember possible capture owners, then consult live pointer capture;
    // neither an old pointerdown nor WheelEvent.buttons proves a live drag.
    const pressedPointers = new Map();
    const press = event => {
      pressedPointers.delete(event.pointerId);
      if (host.contains(event.target)) {
        pressedPointers.set(event.pointerId, event.target);
        if (!isPanning()) stopTravel(true);
      }
    };
    const release = event => pressedPointers.delete(event.pointerId);
    const capture = event => { if (host.contains(event.target)) pressedPointers.set(event.pointerId, event.target); };
    const checkCapture = () => {
      for (const [id, target] of pressedPointers) {
        let captured = host.hasPointerCapture(id);
        // pointerdown runs before a module chooses its capture target. Check
        // that target's ancestors too, even before gotpointercapture arrives.
        for (let node = target; !captured && node && host.contains(node); node = node.parentElement) captured = node.hasPointerCapture(id);
        if (!captured) pressedPointers.delete(id);
      }
      return pressedPointers.size > 0;
    };
    captureCheck.current = checkCapture;
    const move = event => { if (!event.buttons) release(event); };
    const clear = () => { pressedPointers.clear(); endNavigator(true); stopTravel(); };
    const hidden = () => { if (document.hidden) clear(); };
    const wheel = event => {
      if (event.target.closest?.(".workspace-navigation")) return;
      if (!event.ctrlKey && !event.metaKey && event.target.closest?.("[data-workbench-navigator]")) return;
      pan.releaseAbandonedGesture();
      const released = interaction.current.releaseAbandonedGesture();
      if (released !== null) pressedPointers.delete(released);
      const pointerHeld = hasCapturedPointer();
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
        if (!interaction.current.isEditing() && !isPanning() && !pointerHeld) {
          const current = getCamera().offset;
          panTo({ x: current.x - dx, y: current.y - dy });
        }
        return;
      }
      if (!event.ctrlKey || !event.deltaY || event.target.closest?.('[data-immersive]')) return;
      event.preventDefault(); event.stopPropagation();
      if (interaction.current.isEditing() || pointerHeld) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
      zoom({ x: event.clientX, y: event.clientY }, Math.exp(-Math.max(-120, Math.min(120, delta)) * .003));
    };
    const key = event => {
      if (event.target.closest?.("[data-workbench-navigator]") && !((event.ctrlKey || event.metaKey) && event.key === "0")) return;
      // Focus selection owns this key, including repeated keydown events. Its
      // command replaces active travel; holding F must not interrupt arrival.
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey
        && !event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      // Stop before a module's keyboard editing or inspection handler runs.
      if (!event.target.closest?.('.workbench-view-controls') && !['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) {
        const stopped = stopTravel(true);
        if (event.key === 'Escape' && stopped === 'coast') { event.preventDefault(); event.stopPropagation(); return; }
      }
      // Hand owns pointer and keyboard movement. Readers, inputs and controls
      // keep native keys; module and placement geometry stay put.
      if (hand && !locked && isWorkbenchHandSurface(event.target, host)
        && (event.key.startsWith('Arrow') || ['Delete', 'Backspace'].includes(event.key) || event.shiftKey && event.key === 'Enter')) {
        event.preventDefault(); event.stopPropagation(); return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.key !== '0') return;
      if (locked) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.altKey || event.target.closest?.('[data-immersive], input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault(); event.stopPropagation();
      interaction.current.cancelEditing(); resetZoom();
    };
    globalThis.addEventListener('pointerdown', press, true);
    globalThis.addEventListener('gotpointercapture', capture, true);
    globalThis.addEventListener('pointermove', move, true);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'click']) globalThis.addEventListener(name, release, true);
    globalThis.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hidden);
    host.addEventListener('wheel', wheel, { passive: false, capture: true });
    host.addEventListener('keydown', key, true);
    return () => {
      if (captureCheck.current === checkCapture) captureCheck.current = null;
      clear();
      globalThis.removeEventListener('pointerdown', press, true);
      globalThis.removeEventListener('gotpointercapture', capture, true);
      globalThis.removeEventListener('pointermove', move, true);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'click']) globalThis.removeEventListener(name, release, true);
      globalThis.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', hidden);
      host.removeEventListener('wheel', wheel, true);
      host.removeEventListener('keydown', key, true);
    };
  }, [hostRef, disabled, locked, hand, getCamera, isPanning, pan.releaseAbandonedGesture, panTo, zoom, resetZoom, stopTravel, endNavigator]);

  return { navigationViewport, beginNavigator, moveNavigator, endNavigator, navigatorZoom, navigatorHome, offset, locked, getCamera, isPanning, hasCapturedPointer, resetView, resetZoom, moving, hand, toggleHand,
    captureView, focusDestination, goBack, canGoBack: history.length > 0, stopTravel };
}
