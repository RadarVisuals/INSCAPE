import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clampWorkbenchMove, identityWorkbenchTransform, scaleWorkbenchTransform, stepWorkbenchViewScale, workbenchSelectionBounds } from './workbenchViewScale.js';
import './workbenchView.css';
import { useWorkbenchMovementSnap } from './WorkbenchPlacement.jsx';

const WorkbenchView = createContext({ scale: 1, transforms: {}, entries: new Map() });
export const useWorkbenchView = () => useContext(WorkbenchView);
export function workbenchModuleTransform(view, id) {
  const local = view.transforms[id] || identityWorkbenchTransform;
  return { scale: view.scale * local.scale, x: view.scale * local.x, y: view.scale * local.y };
}

// Session-only view transforms, never module content or publication geometry.
export function WorkbenchViewProvider({ children }) {
  const [scale, setScale] = useState(1), [transforms, setTransforms] = useState({});
  const [selection, setSelection] = useState([]);
  const entries = useRef(new Map());
  const revision = useRef(0), listeners = useRef(new Set());
  // Geometry reports refresh only the selection overlay, not module editors.
  const changed = useCallback(() => { revision.current += 1; listeners.current.forEach(listener => listener()); }, []);
  const subscribe = useCallback(listener => { listeners.current.add(listener); return () => listeners.current.delete(listener); }, []);
  const snapshot = useCallback(() => revision.current, []);
  const register = useCallback((id, node) => {
    if (node) entries.current.set(id, node); else entries.current.delete(id);
    changed();
  }, [changed]);
  return <WorkbenchView.Provider value={{ scale, setScale, transforms, setTransforms, selection, setSelection, entries: entries.current, subscribe, snapshot, register, changed }}>{children}</WorkbenchView.Provider>;
}

export function useWorkbenchViewRegistration(id, node, enabled, frame) {
  const { register, changed } = useWorkbenchView();
  useLayoutEffect(() => {
    if (!id || !enabled || !node.current || !register) return;
    register(id, node.current);
    const observer = new ResizeObserver(changed); observer.observe(node.current);
    return () => { observer.disconnect(); register(id, null); };
  }, [id, node, enabled, register, changed]);
  useLayoutEffect(() => { if (id && enabled) changed?.(); }, [id, enabled, frame?.left, frame?.top, frame?.width, frame?.height, changed]);
}

export function WorkbenchViewControls({ hostRef, disabled = false }) {
  const view = useWorkbenchView();
  const snapMovement = useWorkbenchMovementSnap();
  const { scale, setScale, transforms, setTransforms, selection = [], setSelection, entries } = view;
  const revision = useSyncExternalStore(view.subscribe, view.snapshot);
  const latest = useRef(view); latest.current = view;
  const gesture = useRef(null);
  const [marquee, setMarquee] = useState(null), [bounds, setBounds] = useState(null);
  const selected = selection.filter(id => entries.has(id));
  const selectedScale = selected.length ? Math.max(...selected.map(id => workbenchModuleTransform(view, id).scale)) : scale;
  const reset = () => { setScale(1); setTransforms({}); hostRef.current?.focus(); };
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
  }, [scale, transforms, selection, revision]);
  const zoom = direction => {
    if (gesture.current) return;
    const current = latest.current, ids = current.selection.filter(id => current.entries.has(id));
    if (!ids.length) {
      const locals = [...current.entries.keys()].map(id => (current.transforms[id] || identityWorkbenchTransform).scale);
      const minimum = .25 / Math.min(1, ...locals), maximum = Math.min(1, 1 / Math.max(1, ...locals));
      current.setScale(value => Math.max(minimum, Math.min(maximum, stepWorkbenchViewScale(value, direction)))); return;
    }
    const group = workbenchSelectionBounds(ids.map(id => current.entries.get(id).getBoundingClientRect()));
    const scales = ids.map(id => workbenchModuleTransform(current, id).scale), maximum = Math.max(...scales);
    const factor = Math.max(.25 / Math.min(...scales), Math.min(1 / maximum, stepWorkbenchViewScale(maximum, direction) / maximum));
    const anchor = { x: group.left / current.scale, y: group.top / current.scale };
    current.setTransforms(values => ({ ...values, ...Object.fromEntries(ids.map(id => [id,
      scaleWorkbenchTransform(values[id] || identityWorkbenchTransform, factor, anchor)])) }));
  };
  const install = active => {
    gesture.current = active;
    globalThis.addEventListener('pointermove', active.move, true);
    globalThis.addEventListener('pointerup', active.finish, true);
    globalThis.addEventListener('pointercancel', active.cancel, true);
    globalThis.addEventListener('blur', active.cancel);
  };
  const viewport = () => {
    const host = hostRef.current, rect = host.getBoundingClientRect();
    const dock = host.querySelector('.system-workflow__global-bar, .visitor-grid-world__dock')?.getBoundingClientRect();
    return { left: rect.left + 8, top: rect.top + 8, right: rect.right - 8, bottom: Math.min(rect.bottom, dock?.top ?? rect.bottom - 46) - 8 };
  };
  const translate = (current, ids, rectangle, delta, bypass = true) => {
    const candidate = { ...rectangle, left: rectangle.left + delta.x, top: rectangle.top + delta.y, width: rectangle.width, height: rectangle.height };
    const snapped = snapMovement(candidate, ids.map(id => current.entries.get(id)), current.scale, bypass);
    const movement = clampWorkbenchMove(rectangle, { x: (snapped.left ?? candidate.left) - rectangle.left, y: (snapped.top ?? candidate.top) - rectangle.top }, viewport());
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
    const rectangle = workbenchSelectionBounds(ids.map(id => current.entries.get(id).getBoundingClientRect()));
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
  const beginResize = (event, corner) => {
    if (event.button !== 0 || !bounds || gesture.current) return;
    event.preventDefault(); event.stopPropagation();
    const current = latest.current, ids = [...selected];
    const anchor = { x: corner.includes('w') ? bounds.left + bounds.width : bounds.left,
      y: corner.includes('n') ? bounds.top + bounds.height : bounds.top };
    const vector = { x: (corner.includes('w') ? -1 : 1) * bounds.width, y: (corner.includes('n') ? -1 : 1) * bounds.height };
    const origin = { x: event.clientX, y: event.clientY };
    const scales = ids.map(id => workbenchModuleTransform(current, id).scale);
    const limits = viewport();
    const availableX = corner.includes('w') ? anchor.x - limits.left : limits.right - anchor.x;
    const availableY = corner.includes('n') ? anchor.y - limits.top : limits.bottom - anchor.y;
    install({ transforms: current.transforms,
      move: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        if (ids.some(id => !latest.current.entries.has(id))) { cancelGesture(); return; }
        const projected = 1 + ((pointer.clientX - origin.x) * vector.x + (pointer.clientY - origin.y) * vector.y) / (vector.x ** 2 + vector.y ** 2);
        const factor = Math.max(.25 / Math.min(...scales), Math.min(1 / Math.max(...scales), availableX / bounds.width, availableY / bounds.height, projected));
        setTransforms({ ...current.transforms, ...Object.fromEntries(ids.map(id => [id,
          scaleWorkbenchTransform(current.transforms[id] || identityWorkbenchTransform, factor, { x: anchor.x / scale, y: anchor.y / scale })])) });
      },
      finish: pointer => { if (pointer.pointerId === event.pointerId) cancelGesture(false); },
      cancel: () => cancelGesture(),
    });
  };
  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled || !setScale) return;
    let accumulated = 0;
    const wheel = event => {
      if (!event.ctrlKey || !event.deltaY || event.target.closest?.('[data-immersive]')) return;
      event.preventDefault(); event.stopPropagation();
      if (gesture.current || event.buttons) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
      if (Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0;
      accumulated += delta;
      if (Math.abs(accumulated) < 40) return;
      zoom(-Math.sign(delta)); accumulated = 0;
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
        translate(current, [headerId], entries.get(headerId).getBoundingClientRect(),
          { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0, y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 });
        return;
      }
      if (event.key === 'Escape' && (gesture.current || !editable && latest.current.selection.length)) {
        event.preventDefault(); event.stopPropagation();
        if (gesture.current) cancelGesture(); else { setSelection([]); host.focus({ preventScroll: true }); }
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.target.closest?.('[data-immersive], input, textarea, select, [contenteditable="true"]')) return;
      if (!['0', '-', '+', '='].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === '0') { cancelGesture(); reset(); } else zoom(event.key === '-' ? -1 : 1);
    };
    const pointer = event => {
      if (event.button !== 0 || gesture.current || event.target.closest?.('[data-immersive]')) return;
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
        translate(latest.current, selected, bounds, { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
          y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 });
      }}>
      {['nw', 'ne', 'sw', 'se'].map(corner => <button key={corner} className={`workbench-selection__handle is-${corner}`} type="button"
        aria-label={`Scale selected modules from ${corner}`} onPointerDown={event => beginResize(event, corner)}
        onKeyDown={event => { if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) { event.preventDefault(); zoom(['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1); } }} />)}
    </div>}
    {(scale !== 1 || Object.keys(transforms).length > 0 || selected.length > 0) && <div className="workbench-view-controls" role="group" aria-label="Workbench zoom">
      {selected.length > 0 && <span>{selected.length} selected</span>}
      <button type="button" aria-label="Zoom out Display and Text" disabled={selectedScale <= .25} onClick={() => zoom(-1)}>−</button>
      <button type="button" aria-label="Reset Workbench zoom to 100%" title="Reset all to 100% (Ctrl+0)" onClick={reset}>{Math.round(selectedScale * 100)}%</button>
      <button type="button" aria-label="Zoom in Display and Text" disabled={selectedScale >= 1} onClick={() => { zoom(1); hostRef.current?.focus(); }}>+</button>
    </div>}
  </>;
}
