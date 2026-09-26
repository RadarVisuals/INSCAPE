import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clampWorkbenchMove, identityWorkbenchTransform, scaleWorkbenchTransform, stepWorkbenchViewScale, workbenchSelectionBounds, zoomWorkbenchCamera } from './workbenchViewScale.js';
import { WorkbenchCameraProvider } from './WorkbenchCamera.jsx';
import './workbenchView.css';
import { useWorkbenchMovementSnap } from './WorkbenchPlacement.jsx';
import useWorkbenchPan, { isWorkbenchBackground } from './useWorkbenchPan.js';
import { projectWorkbenchBounds } from './workbenchSpace.js';
const GridSeamProbe = import.meta.env.DEV ? lazy(() => import('./GridSeamProbe.jsx')) : null;

const WorkbenchView = createContext({ scale: 1, transforms: {}, entries: new Map() });
export const useWorkbenchView = () => useContext(WorkbenchView);

// Native readers and tool lists own wheel input only when they actually
// overflow on that axis, including at their ends. Clipped artwork and paged
// readers leave it to the Workbench. Measure live: editing/resizing can change it.
function hasNativeWheelScroll(target, host, dx, dy) {
  for (let node = target; node && node !== host; node = node.parentElement) {
    if (node.nodeType !== 1) continue;
    const style = getComputedStyle(node);
    if (dy && /^(auto|scroll)$/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1
      || dx && /^(auto|scroll)$/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1) return true;
  }
  return false;
}
export function workbenchModuleTransform(view, id) {
  const local = view.transforms[id] || identityWorkbenchTransform;
  return { scale: view.scale * local.scale, x: view.scale * local.x, y: view.scale * local.y, frame: local.frame };
}

// Session-only view transforms, never module content or publication geometry.
export function WorkbenchViewProvider({ children, store, profileAddress, presentation }) {
  const [scale, setScale] = useState(1), [transforms, setTransforms] = useState({});
  const [selection, setSelection] = useState([]);
  const entries = useRef(new Map());
  const frames = useRef(new Map());
  const resizeTargets = useRef(new Map());
  const presentationRef = useRef(presentation); presentationRef.current = presentation;
  const getPresentation = useCallback(() => presentationRef.current, []);
  const revision = useRef(0), listeners = useRef(new Set());
  // Geometry reports refresh only the selection overlay, not module editors.
  const changed = useCallback(() => { revision.current += 1; listeners.current.forEach(listener => listener()); }, []);
  const subscribe = useCallback(listener => { listeners.current.add(listener); return () => listeners.current.delete(listener); }, []);
  const snapshot = useCallback(() => revision.current, []);
  const register = useCallback((id, node) => {
    if (node) entries.current.set(id, node); else entries.current.delete(id);
    changed();
  }, [changed]);
  return <WorkbenchView.Provider value={{ scale, setScale, transforms, setTransforms, selection, setSelection, entries: entries.current, frames: frames.current, resizeTargets: resizeTargets.current, store, profileAddress, getPresentation, subscribe, snapshot, register, changed }}><WorkbenchCameraProvider>{children}</WorkbenchCameraProvider></WorkbenchView.Provider>;
}

export function useWorkbenchViewRegistration(id, node, enabled, frame, resizeTarget = null) {
  const { register, changed, frames, resizeTargets, transforms } = useWorkbenchView();
  const previewFrame = transforms?.[id]?.frame;
  // A live reference to module-owned geometry, not a copy of painted DOM bounds.
  const currentFrame = useRef(frame); currentFrame.current = frame;
  const currentResize = useRef(resizeTarget); currentResize.current = resizeTarget;
  const savedLayout = resizeTarget?.store?.getSnapshot().workbench;
  const savedEntry = resizeTarget?.layoutKey === 'display' ? savedLayout?.display
    : savedLayout?.[resizeTarget?.layoutKey]?.find(item => item.id === id);
  const savedFrame = savedEntry?.window || savedEntry?.position;
  const savedKey = JSON.stringify(savedFrame ?? null);
  // Remember the local frame for an older draft without a saved entry. Undoing
  // the first authored resize can then restore it without migrating that draft.
  const savedFrames = useRef(new Map()), previousSavedKey = useRef(savedKey);
  useLayoutEffect(() => {
    if (!frame || !resizeTarget || previewFrame) return;
    if (previousSavedKey.current !== savedKey) {
      const restored = savedFrames.current.get(savedKey) || savedFrame;
      if (restored) resizeTarget.applyFrame(restored);
      previousSavedKey.current = savedKey;
    } else {
      savedFrames.current.set(savedKey, frame);
      // Match the draft history's bounded lifetime; this is only undo recovery
      // for local frames, never an alternative persisted layout.
      while (savedFrames.current.size > 51) savedFrames.current.delete(savedFrames.current.keys().next().value);
    }
  }, [savedKey, frame?.left, frame?.top, frame?.width, frame?.height, resizeTarget, previewFrame]);
  useLayoutEffect(() => {
    if (!id || !enabled || !node.current || !register) return;
    register(id, node.current);
    frames.set(id, currentFrame);
    resizeTargets.set(id, currentResize);
    const observer = new ResizeObserver(changed); observer.observe(node.current);
    return () => { observer.disconnect(); frames.delete(id); resizeTargets.delete(id); register(id, null); };
  }, [id, node, enabled, register, changed, frames, resizeTargets]);
  useLayoutEffect(() => { if (id && enabled) changed?.(); }, [id, enabled, frame?.left, frame?.top, frame?.width, frame?.height, changed]);
}

export function WorkbenchViewControls({ hostRef, disabled = false }) {
  const pan = useWorkbenchPan(hostRef, disabled);
  const view = useWorkbenchView();
  const snapMovement = useWorkbenchMovementSnap();
  const { scale, setScale, transforms, setTransforms, selection = [], setSelection, entries } = view;
  const revision = useSyncExternalStore(view.subscribe, view.snapshot);
  const latest = useRef(view); latest.current = view;
  const gesture = useRef(null);
  const [marquee, setMarquee] = useState(null), [bounds, setBounds] = useState(null);
  const selected = selection.filter(id => entries.has(id));
  const cancelGesture = useCallback((restore = true) => {
    const active = gesture.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    globalThis.removeEventListener('blur', active.cancel);
    if (restore && active.transforms) latest.current.setTransforms(active.transforms);
    if (restore && active.selection) latest.current.setSelection(active.selection);
    snapMovement.finish();
    gesture.current = null; setMarquee(null);
  }, []);
  useEffect(() => () => cancelGesture(false), [cancelGesture]);
  useEffect(() => { if (disabled) cancelGesture(); }, [disabled, cancelGesture]);
  useLayoutEffect(() => {
    const next = workbenchSelectionBounds(selected.map(id => entries.get(id).getBoundingClientRect()));
    setBounds(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, [scale, transforms, selection, revision, pan.offset]);
  const zoom = (point, factor) => {
    if (gesture.current || pan.active.current) return;
    const host = hostRef.current, rect = host?.getBoundingClientRect();
    if (!rect) return;
    const anchor = { x: point.x - rect.left, y: point.y - rect.top };
    const current = latest.current;
    const next = zoomWorkbenchCamera(current.scale, pan.current.current, current.scale * factor, anchor);
    latest.current = { ...current, scale: next.scale };
    current.setScale(next.scale); pan.update(next.offset);
  };
  const resetZoom = () => {
    const host = hostRef.current, rect = host?.getBoundingClientRect();
    if (!rect) return;
    const dock = parseFloat(getComputedStyle(host).getPropertyValue('--workflow-dock-height')) || 0;
    // Keep the world point at the centre of the visible canvas in place.
    // Module geometry and temporary group transforms are independent of zoom.
    zoom({ x: rect.left + rect.width / 2, y: rect.top + (rect.height - dock) / 2 }, 1 / latest.current.scale);
    host.focus({ preventScroll: true });
  };
  const install = active => {
    gesture.current = active;
    globalThis.addEventListener('pointermove', active.move, true);
    globalThis.addEventListener('pointerup', active.finish, true);
    globalThis.addEventListener('pointercancel', active.cancel, true);
    globalThis.addEventListener('blur', active.cancel);
  };
  const workspaceBounds = () => projectWorkbenchBounds(latest.current.scale, pan.current.current);
  const translate = (current, ids, rectangle, delta, bypass = false) => {
    const candidate = { ...rectangle, left: rectangle.left + delta.x, top: rectangle.top + delta.y, width: rectangle.width, height: rectangle.height };
    const snapped = snapMovement(candidate, ids.map(id => current.entries.get(id)), current.scale, bypass);
    const movement = clampWorkbenchMove(rectangle, { x: (snapped.left ?? candidate.left) - rectangle.left, y: (snapped.top ?? candidate.top) - rectangle.top }, workspaceBounds());
    setTransforms({ ...current.transforms, ...Object.fromEntries(ids.map(id => {
      const transform = current.transforms[id] || identityWorkbenchTransform;
      return [id, { ...transform, x: transform.x + movement.x / current.scale, y: transform.y + movement.y / current.scale }];
    })) });
  };
  const beginMove = (event, ids = selected) => {
    if (event.button !== 0 || gesture.current) return;
    event.preventDefault(); event.stopPropagation();
    if (event.target.matches?.('.workbench-selection')) event.target.focus({ preventScroll: true });
    else hostRef.current?.focus({ preventScroll: true });
    const current = latest.current;
    snapMovement.begin(event, ids.map(id => current.entries.get(id)));
    const rectangle = snapMovement.rectangle(ids.map(id => current.entries.get(id)));
    const origin = { x: event.clientX, y: event.clientY };
    install({ transforms: current.transforms,
      move: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        pointer.preventDefault(); pointer.stopPropagation();
        if (ids.some(id => !latest.current.entries.has(id))) { cancelGesture(); return; }
        translate(current, ids, rectangle, { x: pointer.clientX - origin.x, y: pointer.clientY - origin.y }, pointer.altKey);
      },
      finish: pointer => { if (pointer.pointerId === event.pointerId) cancelGesture(false); },
      cancel: () => cancelGesture(),
    });
  };
  const selectionResize = (current, ids, corner) => {
    const nodes = ids.map(id => current.entries.get(id));
    const rectangle = snapMovement.rectangle(nodes);
    if (!rectangle?.width || !rectangle?.height) return null;
    const anchor = { x: corner.includes('w') ? rectangle.left + rectangle.width : rectangle.left,
      y: corner.includes('n') ? rectangle.top + rectangle.height : rectangle.top };
    const vector = { x: (corner.includes('w') ? -1 : 1) * rectangle.width, y: (corner.includes('n') ? -1 : 1) * rectangle.height };
    const scales = ids.map(id => workbenchModuleTransform(current, id).scale);
    const editors = ids.map(id => current.resizeTargets.get(id)?.current);
    // The module supplies its authoring boundary. Workbench only projects frames.
    const authored = editors.every(editor => editor?.enabled && editor.commit === editors[0]?.commit
      && editor.store === editors[0]?.store && editor.profileAddress === editors[0]?.profileAddress);
    // Owner authoring must not silently fall back to an unsaved group scale.
    if (current.store && !authored) return null;
    const originals = nodes.map(node => snapMovement.rectangle([node]));
    const limits = workspaceBounds();
    const availableX = corner.includes('w') ? anchor.x - limits.left : limits.right - anchor.x;
    const availableY = corner.includes('n') ? anchor.y - limits.top : limits.bottom - anchor.y;
    // A camera change must not force an already larger/smaller selection to
    // jump on grab. Existing size remains valid; area bounds still take priority.
    const upper = authored ? Math.min(...editors.flatMap((editor, i) =>
      [editor.maximumWidth * current.scale / originals[i].width, editor.maximumHeight * current.scale / originals[i].height,
        (editor.maximumScale ?? Infinity) / (current.transforms[ids[i]]?.scale || 1)])) : Math.max(1, 1 / Math.max(...scales));
    const lower = authored ? Math.max(...editors.flatMap((editor, i) =>
      [(editor.minimumWidth ?? editor.minimumSize) * current.scale / originals[i].width,
        (editor.minimumHeight ?? editor.minimumSize) * current.scale / originals[i].height,
        (editor.minimumScale ?? 0) / (current.transforms[ids[i]]?.scale || 1)])) : Math.min(1, .25 / Math.min(...scales));
    const maximum = Math.max(0, Math.min(upper, availableX / rectangle.width, availableY / rectangle.height));
    const minimum = Math.min(maximum, lower);
    const worldAnchor = { x: (anchor.x - pan.current.current.x) / current.scale,
      y: (anchor.y - pan.current.current.y) / current.scale };
    const cameraOffset = { ...pan.current.current };
    // Preview and commit use the same endpoints, including Text's reflow box.
    const resizedFrame = (frame, factor, continuous = false) => {
      // Fixed-ratio Display geometry stays continuous, just like its preview.
      // Integer endpoints belong to Image/Text sizing, not Display's Stage.
      const round = value => continuous ? value : Math.round(Math.round(value * 1e7) / 1e7);
      const edge = (value, axis) => worldAnchor[axis] + round(
        ((value - cameraOffset[axis]) / current.scale - worldAnchor[axis]) * factor);
      const left = edge(frame.left, 'x'), top = edge(frame.top, 'y');
      return { left, top, width: continuous ? frame.width / current.scale * factor : round(edge(frame.left + frame.width, 'x') - left),
        height: continuous ? frame.height / current.scale * factor : round(edge(frame.top + frame.height, 'y') - top) };
    };
    let appliedFactor = null;
    return { nodes, vector, authored, maximumScale: Math.max(...scales), commit: () => {
      if (!authored || appliedFactor === null) return true;
      if (ids.some((id, i) => current.resizeTargets.get(id)?.current !== editors[i])) return false;
      // Round common world endpoints around the same anchor, never each width
      // independently. Joined images retain their shared edge with whole sizes.
      const changes = originals.map((frame, i) => ({ ...editors[i], id: ids[i],
        getPresentation: current.getPresentation, ...resizedFrame(frame, appliedFactor, editors[i].continuousGeometry) }));
      if (!editors[0].commit(changes)) return false;
      changes.forEach(change => change.applyFrame({ left: change.left, top: change.top, width: change.width, height: change.height }));
      setTransforms(values => {
        const next = { ...values }; ids.forEach(id => { delete next[id]; }); return next;
      });
      return true;
    }, apply: (requested, bypass) => {
      const bounded = Math.max(minimum, Math.min(maximum, requested));
      const factor = snapMovement.resize(rectangle, anchor, corner, bounded, nodes, current.scale, minimum, maximum, bypass);
      appliedFactor = factor;
      setTransforms({ ...current.transforms, ...Object.fromEntries(ids.map((id, i) => {
        if (editors[i]?.reflow) {
          return [id, { ...identityWorkbenchTransform, frame: resizedFrame(originals[i], factor) }];
        }
        return [id, scaleWorkbenchTransform(current.transforms[id] || identityWorkbenchTransform, factor, worldAnchor)];
      })) });
    } };
  };
  const beginResize = (event, corner) => {
    if (event.button !== 0 || !bounds || gesture.current) return;
    const current = latest.current, ids = [...selected];
    const resize = selectionResize(current, ids, corner);
    if (!resize) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    snapMovement.begin(event, resize.nodes);
    const origin = { x: event.clientX, y: event.clientY }, { vector } = resize;
    install({ transforms: current.transforms,
      move: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        pointer.preventDefault(); pointer.stopPropagation();
        if (ids.some(id => !latest.current.entries.has(id))) { cancelGesture(); return; }
        const projected = 1 + ((pointer.clientX - origin.x) * vector.x + (pointer.clientY - origin.y) * vector.y) / (vector.x ** 2 + vector.y ** 2);
        resize.apply(projected, pointer.altKey);
      },
      finish: pointer => { if (pointer.pointerId === event.pointerId) cancelGesture(!resize.commit()); },
      cancel: () => cancelGesture(),
    });
  };
  const resizeByKey = (event, corner) => {
    if (gesture.current || pan.active.current || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const current = latest.current, ids = current.selection.filter(id => current.entries.has(id));
    const resize = selectionResize(current, ids, corner);
    if (!resize) return;
    const direction = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const nextScale = resize.authored ? resize.maximumScale * (1 + direction * (event.shiftKey ? .25 : .1))
      : stepWorkbenchViewScale(resize.maximumScale, direction);
    if (direction > 0 && nextScale <= resize.maximumScale || direction < 0 && nextScale >= resize.maximumScale) return;
    snapMovement.begin(event, resize.nodes);
    resize.apply(nextScale / resize.maximumScale, event.altKey);
    if (!resize.commit()) setTransforms(current.transforms);
  };
  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled || !setScale) return;
    const wheel = event => {
      if (!event.ctrlKey && !event.metaKey && !event.target.closest?.('[data-immersive]')) {
        const unitX = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientWidth : 1;
        const unitY = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
        const dx = (event.shiftKey ? Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY : event.deltaX) * unitX;
        const dy = event.shiftKey ? 0 : event.deltaY * unitY;
        if (!dx && !dy || hasNativeWheelScroll(event.target, host, dx, dy)) return;
        event.preventDefault(); event.stopPropagation();
        if (!gesture.current && !pan.active.current && !event.buttons) pan.update({ x: pan.current.current.x - dx, y: pan.current.current.y - dy });
        return;
      }
      if (!event.ctrlKey || !event.deltaY || event.target.closest?.('[data-immersive]')) return;
      event.preventDefault(); event.stopPropagation();
      if (gesture.current || event.buttons) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
      zoom({ x: event.clientX, y: event.clientY }, Math.exp(-Math.max(-120, Math.min(120, delta)) * .003));
    };
    const key = event => {
      const header = event.target.closest?.('header[data-workbench-selectable]');
      if (event.shiftKey && event.key === 'Enter' && header === event.target) {
        const id = header.closest('[data-workbench-view-id]')?.dataset.workbenchViewId;
        if (!entries.has(id)) return;
        event.preventDefault(); event.stopPropagation();
        setSelection(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
        return;
      }
      const editable = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
      const headerId = header?.closest('[data-workbench-view-id]')?.dataset.workbenchViewId;
      const current = latest.current, transform = headerId && workbenchModuleTransform(current, headerId);
      if (header === event.target && entries.has(headerId) && (transform.scale !== 1 || transform.x || transform.y)
        && ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        snapMovement.begin(event, [entries.get(headerId)]);
        const step = event.shiftKey ? 24 : 8;
        translate(current, [headerId], snapMovement.rectangle([entries.get(headerId)]),
          { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0, y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 }, event.altKey);
        return;
      }
      if (event.key === 'Escape' && (gesture.current || !editable && latest.current.selection.length)) {
        event.preventDefault(); event.stopPropagation();
        if (gesture.current) cancelGesture(); else { setSelection([]); host.focus({ preventScroll: true }); }
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.target.closest?.('[data-immersive], input, textarea, select, [contenteditable="true"]')) return;
      if (event.key !== '0') return;
      event.preventDefault(); event.stopPropagation();
      cancelGesture(); resetZoom();
    };
    const pointer = event => {
      if (event.button !== 0 || gesture.current || event.target.closest?.('[data-immersive]')) return;
      if (pan.begin(event)) return;
      // The selection surface covers module headers too. Resolve Shift-click
      // against the underlying header to retain additive selection.
      const target = event.shiftKey && event.target.matches?.('.workbench-selection')
        ? latest.current.selection.map(id => entries.get(id)?.querySelector('header[data-workbench-selectable]')).find(header => {
          if (!header) return false;
          const rect = header.getBoundingClientRect();
          return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        }) || event.target
        : event.target;
      const module = target.closest?.('[data-workbench-view-id]');
      if (module && event.shiftKey && target.closest('header') && !target.closest('button, a')) {
        const id = module.dataset.workbenchViewId;
        if (!entries.has(id)) return;
        event.preventDefault(); event.stopPropagation();
        setSelection(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
        return;
      }
      if (!event.target.closest?.('.workbench-selection, .workbench-view-controls') && !event.shiftKey) setSelection([]);
      if (module && target.closest('header[data-workbench-selectable]') && !target.closest('button, a') && entries.has(module.dataset.workbenchViewId)) {
        const id = module.dataset.workbenchViewId, transform = workbenchModuleTransform(latest.current, id);
        if (transform.scale !== 1 || transform.x || transform.y) { beginMove(event, [id]); return; }
      }
      if (event.target !== host && !event.target.matches?.('.system-workflow__workbench, .system-workflow__display-instance')) return;
      event.preventDefault(); host.focus({ preventScroll: true });
      const origin = { x: event.clientX, y: event.clientY }, previous = event.shiftKey ? latest.current.selection : [];
      const active = { selection: latest.current.selection, move: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        const rectangle = { left: Math.min(origin.x, pointer.clientX), top: Math.min(origin.y, pointer.clientY), width: Math.abs(pointer.clientX - origin.x), height: Math.abs(pointer.clientY - origin.y) };
        setMarquee(rectangle);
        const hits = [...entries].filter(([, node]) => {
          const b = node.getBoundingClientRect();
          return b.right > rectangle.left && b.left < rectangle.left + rectangle.width && b.bottom > rectangle.top && b.top < rectangle.top + rectangle.height;
        }).map(([id]) => id);
        setSelection([...new Set([...previous, ...hits])]);
      }, finish: pointer => { if (pointer.pointerId === event.pointerId) cancelGesture(false); }, cancel: () => cancelGesture() };
      setSelection(previous); install(active);
    };
    host.addEventListener('wheel', wheel, { passive: false, capture: true });
    host.addEventListener('keydown', key, true);
    host.addEventListener('pointerdown', pointer, true);
    return () => { host.removeEventListener('wheel', wheel, true); host.removeEventListener('keydown', key, true); host.removeEventListener('pointerdown', pointer, true); };
  }, [hostRef, disabled, setScale, cancelGesture, setSelection, entries]);
  if (disabled) return null;
  return <>
    {marquee && <div className="workbench-marquee" style={marquee} />}
    {bounds && selected.length > 0 && <div className="workbench-selection" style={bounds} role="group" tabIndex={0}
      aria-label={`${selected.length} selected Workbench modules`} aria-description="Drag to move the selection. Arrow keys move it; Shift moves further. Escape clears selection."
      onPointerDown={event => { if (event.target === event.currentTarget) beginMove(event); }} onKeyDown={event => {
        if (event.target !== event.currentTarget || gesture.current || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const step = event.shiftKey ? 10 : 1;
        snapMovement.begin(event, selected.map(id => entries.get(id)));
        translate(latest.current, selected, snapMovement.rectangle(selected.map(id => entries.get(id))), { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
          y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 }, event.altKey);
      }}>
      {['nw', 'ne', 'sw', 'se'].map(corner => <button key={corner} className={`workbench-selection__handle is-${corner}`} type="button"
        aria-label={`Scale selected modules from ${corner}`} onPointerDown={event => beginResize(event, corner)}
        onKeyDown={event => resizeByKey(event, corner)} />)}
    </div>}
    <div className="workbench-view-controls" role="group" aria-label="Workbench zoom">
      <button type="button" aria-label="Reset Workbench position" title="Return to the starting view" onClick={() => { pan.reset(); hostRef.current?.focus({ preventScroll: true }); }}>Reset view</button>
      {selected.length > 0 && <span>{selected.length} selected</span>}
      <button type="button" aria-label="Reset Workbench zoom to 100%" title="Zoom to 100% around the current view (Ctrl+0)" onClick={resetZoom}>{Math.round(scale * 100)}%</button>
      {GridSeamProbe && <Suspense fallback={null}><GridSeamProbe hostRef={hostRef} scale={scale} offset={pan.offset} /></Suspense>}
    </div>
  </>;
}
