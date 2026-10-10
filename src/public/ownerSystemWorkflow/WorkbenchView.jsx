import { WorkbenchView, WorkbenchActions, useWorkbenchView, workbenchModuleTransform } from './WorkbenchViewContext.js';
export { useWorkbenchView, useWorkbenchActions, workbenchModuleTransform, useWorkbenchViewRegistration } from './WorkbenchViewContext.js';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { clampWorkbenchMove, identityWorkbenchTransform, scaleWorkbenchTransform, stepWorkbenchViewScale, workbenchSelectionBounds } from './workbenchViewScale.js';
import { WorkbenchCameraProvider, useWorkbenchCamera, useWorkbenchCameraScale } from './WorkbenchCamera.jsx';
import './workbenchView.css';
import { moveWorkbenchGroup } from '../../systemWorkflow/moveWorkbenchGroup.js';
import { workbenchMemberIds } from '../../systemWorkflow/domain/workbenchGroups.js';
const WorkbenchGroups = lazy(() => import('./WorkbenchGroups.jsx'));
const PublishedWorkbenchGroups = lazy(() => import('./PublishedWorkbenchGroups.jsx'));
import { useWorkbenchMovementSnap } from './WorkbenchPlacement.jsx';
import useWorkbenchNavigation from './useWorkbenchNavigation.js';
import { projectWorkbenchBounds } from './workbenchSpace.js';
import { workbenchPaintGeometry } from './workbenchPaintGeometry.js';
const GridSeamProbe = import.meta.env.DEV ? lazy(() => import('./GridSeamProbe.jsx')) : null;

// Session-only view transforms, never module content or publication geometry.
export function WorkbenchViewProvider(props) {
  return <WorkbenchCameraProvider><WorkbenchViewStateProvider {...props} /></WorkbenchCameraProvider>;
}

function WorkbenchViewStateProvider({ children, store, profileAddress, presentation, groupContent }) {
  // Editors need scale for projection, but panning must not render them again.
  const { scale, setScale } = useWorkbenchCameraScale();
  const [transforms, setTransforms] = useState({});
  const [presentationTransforms, setPresentationTransforms] = useState({});
  const [hiddenModuleIds, setHiddenModuleIds] = useState([]);
  const [selection, setSelection] = useState([]);
  const [interactionTool, setInteractionTool] = useState('select');
  const [toolViewportBottom, setToolViewportBottom] = useState(null);
  const entries = useRef(new Map());
  const frames = useRef(new Map());
  const resizeTargets = useRef(new Map());
  const presentationRef = useRef(presentation); presentationRef.current = presentation;
  const getPresentation = useCallback(() => presentationRef.current, []);
  const selectedRef = useRef(selection); selectedRef.current = selection;
  const getSelection = useCallback(() => selectedRef.current.filter(id => entries.current.has(id)), []);
  // Content that only needs commands must not subscribe to camera geometry.
  const focusModulesRef = useRef(null);
  const inspections = useRef(new Map());
  const registerInspection = useCallback((id, action) => {
    inspections.current.set(id, action);
    return () => { if (inspections.current.get(id) === action) inspections.current.delete(id); };
  }, []);
  const actions = useMemo(() => ({ getPresentation, setSelection, getSelection, registerInspection,
    focusModules: ids => focusModulesRef.current?.(ids) ?? false }), [getPresentation, getSelection, registerInspection]);
  const revision = useRef(0), listeners = useRef(new Set());
  const resizeObserver = useRef(null);
  // One observer delivers one geometry notification for all resized modules.
  // Individual observers caused a synchronous overlay commit per module on
  // every camera frame, followed by another layout read and bounds update.
  const changed = useCallback(() => { revision.current += 1; listeners.current.forEach(listener => listener()); }, []);
  const subscribe = useCallback(listener => { listeners.current.add(listener); return () => listeners.current.delete(listener); }, []);
  const snapshot = useCallback(() => revision.current, []);
  const register = useCallback((id, node) => {
    const previous = entries.current.get(id);
    if (previous) resizeObserver.current?.unobserve(previous);
    if (node) entries.current.set(id, node); else entries.current.delete(id);
    if (node) {
      resizeObserver.current ??= new ResizeObserver(changed);
      resizeObserver.current.observe(node);
    }
    changed();
  }, [changed]);
  useLayoutEffect(() => () => { resizeObserver.current?.disconnect(); resizeObserver.current = null; }, []);
  return <WorkbenchView.Provider value={{ scale, setScale, transforms, setTransforms, presentationTransforms, setPresentationTransforms, hiddenModuleIds, setHiddenModuleIds, selection, setSelection, interactionTool, setInteractionTool, toolViewportBottom, setToolViewportBottom, focusModulesRef, inspections: inspections.current, entries: entries.current, frames: frames.current, resizeTargets: resizeTargets.current, store, profileAddress, groupContent, getPresentation, subscribe, snapshot, register, changed }}><WorkbenchActions.Provider value={actions}>{children}</WorkbenchActions.Provider></WorkbenchView.Provider>;
}

function WorkbenchZoomControl({ disabled, onClick }) {
  const { getCamera, subscribeCameraPaint } = useWorkbenchCamera();
  const node = useRef(null);
  const paint = useCallback(({ scale }) => {
    const label = `${Math.round(scale * 100)}%`;
    if (node.current && node.current.textContent !== label) node.current.textContent = label;
  }, []);
  // This control alone owns its text. Read the live camera after commits and
  // during projection, never the temporarily prepared artwork resolution.
  useLayoutEffect(() => { paint(getCamera()); });
  useLayoutEffect(() => subscribeCameraPaint(paint), [subscribeCameraPaint, paint]);
  return <button ref={node} type="button" disabled={disabled} aria-label="Reset Workbench zoom to 100%"
    title="Zoom to 100% around the current view (Ctrl+0)" onClick={onClick} />;
}

export function WorkbenchViewControls({ hostRef, disabled = false, dockVisible = true, historyBlocked = null, showHandTool = true }) {
  const view = useWorkbenchView();
  const snapMovement = useWorkbenchMovementSnap();
  const { scale, transforms, setTransforms, selection = [], setSelection, entries } = view;
  const revision = useSyncExternalStore(view.subscribe, view.snapshot);
  const latest = useRef(view); latest.current = view;
  const gesture = useRef(null), groupDrop = useRef(null), groupScene = useRef(null);
  const [moveError, setMoveError] = useState('');
  const controlsRef = useRef(null), inspectionTarget = useRef(null);
  const [marquee, setMarquee] = useState(null), [bounds, setBounds] = useState(null);
  const selected = selection.filter(id => entries.has(id) && !entries.get(id).hasAttribute('data-workbench-group-hidden'));
  const cancelGesture = useCallback((restore = true) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    globalThis.removeEventListener('blur', active.cancel);
    document.removeEventListener('visibilitychange', active.hidden);
    active.host.removeEventListener('lostpointercapture', active.lost);
    if (active.host.hasPointerCapture(active.pointerId)) active.host.releasePointerCapture(active.pointerId);
    if (restore && active.transforms) latest.current.setTransforms(active.transforms);
    if (restore && active.selection) latest.current.setSelection(active.selection);
    snapMovement.finish();
    groupDrop.current?.cancel();
    setMarquee(null);
  }, []);
  const isEditing = useCallback(() => Boolean(gesture.current), []);
  const releaseAbandonedGesture = useCallback(() => {
    const active = gesture.current;
    if (!active || active.host.hasPointerCapture(active.pointerId)) return null;
    const pointerId = active.pointerId;
    cancelGesture();
    return pointerId;
  }, [cancelGesture]);
  const captureContext = useCallback(() => ({ selection: [...latest.current.selection], group: groupScene.current?.capture() }), []);
  const restoreContext = useCallback(context => {
    groupScene.current?.restore(context?.group);
    const current = latest.current;
    const ids = (context?.selection || []).filter(id => current.entries.has(id));
    current.setSelection(ids);
    inspectionTarget.current = ids.length === 1 ? ids[0] : null;
    const node = current.entries.get(ids[0]);
    const target = node?.matches('[data-workbench-selectable]') ? node : node?.querySelector('[data-workbench-selectable]');
    (target || hostRef.current)?.focus({ preventScroll: true });
  }, [hostRef]);
  const navigation = useWorkbenchNavigation({ hostRef, controlsRef, disabled, dockVisible,
    interactionTool: view.interactionTool, setInteractionTool: view.setInteractionTool,
    onControlsTopChange: view.setToolViewportBottom,
    isEditing, cancelEditing: cancelGesture, releaseAbandonedGesture, captureContext, restoreContext, returnTargets: context => groupScene.current?.returnTargets(context?.group), resetPresentation: () => groupScene.current?.restore(null), entries });
  const { locked } = navigation;
  const focusModules = useCallback(moduleIds => {
    const ids = [...new Set(moduleIds)].filter(id => {
      const node = latest.current.entries.get(id);
      return node && !node.hasAttribute('data-workbench-group-hidden');
    });
    const nodes = ids.map(id => latest.current.entries.get(id));
    if (!ids.length) return false;
    const accepted = navigation.focusDestination({
      getBounds: () => {
        const current = latest.current;
        if (ids.some((id, index) => current.entries.get(id) !== nodes[index] || !nodes[index].isConnected)) return null;
        const rectangles = ids.map(id => {
          const transform = current.presentationTransforms[id] || current.transforms[id] || identityWorkbenchTransform;
          const frame = transform.frame || current.frames.get(id)?.current;
          return frame && { left: frame.left * transform.scale + transform.x,
            top: frame.top * transform.scale + transform.y,
            width: frame.width * transform.scale, height: frame.height * transform.scale };
        });
        return rectangles.every(Boolean) ? workbenchSelectionBounds(rectangles) : null;
      },
      onArrive: () => latest.current.setSelection([]),
    });
    if (accepted) inspectionTarget.current = ids.length === 1 ? ids[0] : null;
    return accepted;
  }, [navigation.focusDestination]);
  const focusSelection = () => focusModules(latest.current.selection);
  useLayoutEffect(() => {
    // Modules request navigation through stable actions; the mounted camera owns it.
    view.focusModulesRef.current = focusModules;
    return () => { if (view.focusModulesRef.current === focusModules) view.focusModulesRef.current = null; };
  }, [view.focusModulesRef, focusModules]);
  useEffect(() => () => cancelGesture(false), [cancelGesture]);
  useLayoutEffect(() => { if (disabled || locked) cancelGesture(); }, [disabled, locked, cancelGesture]);
  useLayoutEffect(() => {
    if (navigation.moving) return;
    const next = workbenchSelectionBounds(selected.map(id => entries.get(id).getBoundingClientRect()));
    setBounds(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, [scale, transforms, selection, revision, navigation.offset, navigation.moving]);
  // During camera travel the authored rectangles are stable and already known.
  // Project them directly instead of forcing layout and a second React commit.
  const travellingBounds = navigation.moving && workbenchSelectionBounds(selected.flatMap(id => {
    const transform = workbenchModuleTransform(view, id);
    const frame = transform.frame || view.frames.get(id)?.current;
    if (!frame) return [];
    const density = globalThis.devicePixelRatio || 1;
    const rectangle = workbenchPaintGeometry({ left: frame.left * transform.scale + transform.x + navigation.offset.x,
      top: frame.top * transform.scale + transform.y + navigation.offset.y,
      width: frame.width * transform.scale, height: frame.height * transform.scale }, density);
    return [Object.fromEntries(Object.entries(rectangle).map(([key, value]) => [key, value / density]))];
  }));
  const install = (active, event) => {
    active.pointerId = event.pointerId;
    active.host = hostRef.current;
    const move = active.move, finish = active.finish;
    active.move = pointer => {
      if (pointer.pointerId !== active.pointerId) return;
      if (!(pointer.buttons & 1)) { cancelGesture(); return; }
      move(pointer);
    };
    active.finish = pointer => {
      if (pointer.pointerId !== active.pointerId) return;
      try { finish(pointer); }
      finally { if (gesture.current === active) cancelGesture(); }
    };
    active.lost = pointer => { if (pointer.pointerId === active.pointerId && gesture.current === active) cancelGesture(); };
    active.hidden = () => { if (document.hidden) cancelGesture(); };
    gesture.current = active;
    globalThis.addEventListener('pointermove', active.move, true);
    globalThis.addEventListener('pointerup', active.finish, true);
    globalThis.addEventListener('pointercancel', active.cancel, true);
    globalThis.addEventListener('blur', active.cancel);
    document.addEventListener('visibilitychange', active.hidden);
    active.host.addEventListener('lostpointercapture', active.lost);
    active.host.setPointerCapture(active.pointerId);
  };
  const workspaceBounds = () => {
    const camera = navigation.getCamera();
    return projectWorkbenchBounds(camera.scale, camera.offset);
  };
  const finishMove = (current, ids, transforms) => {
    if (!current.store) return;
    const draft = current.store.getSnapshot();
    const members = workbenchMemberIds(draft, ids);
    if (draft.workbenchGroups?.some(group => group.memberIds.some(id => members.includes(id)))) {
      const changes = ids.flatMap(id => {
        const registration = current.frames.get(id), transform = transforms[id];
        if (!registration?.move || !transform || !transform.x && !transform.y) return [];
        return [{ id, left: registration.current.left + transform.x / transform.scale,
          top: registration.current.top + transform.y / transform.scale }];
      });
      if (changes.length) try {
        moveWorkbenchGroup(current.store, current.profileAddress, changes, current.getPresentation());
        setMoveError('');
      } catch (failure) {
        setTransforms(current.transforms); setMoveError(failure.message); return;
      }
    }
    const next = { ...transforms };
    for (const id of ids) {
      const registration = current.frames.get(id), transform = transforms[id];
      if (!registration?.move || !transform || !transform.x && !transform.y) continue;
      const frame = registration.current;
      // Absorb translation only. Camera zoom/pan and any independent local
      // scale remain view state; moving cannot choose a size or crop.
      registration.move({ left: frame.left + transform.x / transform.scale,
        top: frame.top + transform.y / transform.scale });
      if (transform.scale === 1) delete next[id];
      else next[id] = { ...transform, x: 0, y: 0 };
    }
    setTransforms(next);
  };
  const translate = (current, ids, rectangle, delta, bypass = false) => {
    const candidate = { ...rectangle, left: rectangle.left + delta.x, top: rectangle.top + delta.y, width: rectangle.width, height: rectangle.height };
    const snapped = snapMovement(candidate, ids.map(id => current.entries.get(id)), current.scale, bypass);
    const movement = clampWorkbenchMove(rectangle, { x: (snapped.left ?? candidate.left) - rectangle.left, y: (snapped.top ?? candidate.top) - rectangle.top }, workspaceBounds());
    const next = { ...current.transforms, ...Object.fromEntries(ids.map(id => {
      const transform = current.transforms[id] || identityWorkbenchTransform;
      return [id, { ...transform, x: transform.x + movement.x / current.scale, y: transform.y + movement.y / current.scale }];
    })) };
    setTransforms(next);
    return next;
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
    let moved = null;
    install({ transforms: current.transforms,
      move: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        pointer.preventDefault(); pointer.stopPropagation();
        if (ids.some(id => !latest.current.entries.has(id))) { cancelGesture(); return; }
        moved = translate(current, ids, rectangle, { x: pointer.clientX - origin.x, y: pointer.clientY - origin.y }, pointer.altKey);
        groupDrop.current?.preview(pointer);
      },
      finish: pointer => {
        if (pointer.pointerId !== event.pointerId) return;
        if (moved && groupDrop.current?.commit(pointer, ids)) setTransforms(current.transforms);
        else if (moved) finishMove(current, ids, moved);
        cancelGesture(false);
      },
      cancel: () => cancelGesture(),
    }, event);
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
    const cameraOffset = navigation.getCamera().offset;
    const worldAnchor = { x: (anchor.x - cameraOffset.x) / current.scale,
      y: (anchor.y - cameraOffset.y) / current.scale };
    // Preview and commit use the same endpoints, including Text's reflow box.
    const resizedFrame = (frame, factor, continuous = false) => {
      // Text reflow and fixed-ratio Display keep their shared exact endpoints.
      // Only modules with whole-pixel dimensions (Image) quantize here.
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
          return [id, { ...identityWorkbenchTransform, frame: resizedFrame(originals[i], factor, editors[i].continuousGeometry) }];
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
    }, event);
  };
  const resizeByKey = (event, corner) => {
    if (gesture.current || navigation.isPanning() || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
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
    if (!host || disabled) return;
    const key = event => {
      if (event.target.closest?.('[data-workbench-group-tools], [data-workbench-selection-tools]')) return;
      const presentedId = event.target.closest?.('[data-workbench-view-id]')?.dataset.workbenchViewId;
      if (latest.current.presentationTransforms[presentedId] && (event.shiftKey && event.key === 'Enter' || event.key.startsWith('Arrow') && event.target.matches('[data-workbench-selectable]'))) { event.preventDefault(); event.stopPropagation(); return; }
      const header = event.target.closest?.('header[data-workbench-selectable]');
      const selectable = event.target.closest?.('[data-workbench-selectable]');
      if (locked) {
        // Inspection locks editing, while titles retain menu and focus access.
        const accessKey = ['Tab', 'Escape', 'ContextMenu'].includes(event.key) || event.shiftKey && event.key === 'F10';
        if (selectable === event.target && !accessKey) {
          event.preventDefault(); event.stopPropagation();
        }
        return;
      }
      if (event.shiftKey && event.key === 'Enter' && selectable === event.target) {
        const id = selectable.closest('[data-workbench-view-id]')?.dataset.workbenchViewId;
        if (!entries.has(id)) return;
        event.preventDefault(); event.stopPropagation();
        setSelection(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
        return;
      }
      const editable = event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey
        && !event.isComposing && !editable && !event.target.closest?.('[data-immersive], [role="dialog"], [role="menu"]')) {
        if (event.repeat) { event.preventDefault(); return; }
        if (focusModules(latest.current.selection)) { event.preventDefault(); event.stopPropagation(); }
        return;
      }
      if (event.key.toLowerCase() === 'i' && !event.ctrlKey && !event.metaKey && !event.altKey
        && !event.shiftKey && !event.isComposing && !editable && !event.defaultPrevented
        && !event.target.closest?.('[data-immersive], [role="dialog"], [role="menu"]')) {
        if (event.repeat) { event.preventDefault(); return; }
        if (gesture.current || navigation.isPanning() || navigation.hasCapturedPointer()) return;
        const current = latest.current;
        const selected = current.selection.filter(id => current.entries.has(id));
        if (selected.length > 1) return;
        const target = event.target.closest?.('[data-workbench-inspection-target]')?.dataset.workbenchInspectionTarget;
        const id = selected[0] || target || presentedId || inspectionTarget.current;
        const node = current.entries.get(id);
        if (node && !node.hasAttribute('data-workbench-group-hidden') && current.inspections.get(id)?.current?.(event.target)) {
          event.preventDefault(); event.stopPropagation();
        }
        return;
      }
      const headerId = header?.closest('[data-workbench-view-id]')?.dataset.workbenchViewId;
      const current = latest.current, transform = headerId && workbenchModuleTransform(current, headerId);
      if (header === event.target && entries.has(headerId) && (transform.scale !== 1 || transform.x || transform.y)
        && ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        snapMovement.begin(event, [entries.get(headerId)]);
        const step = event.shiftKey ? 24 : 8;
        const moved = translate(current, [headerId], snapMovement.rectangle([entries.get(headerId)]),
          { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0, y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 }, event.altKey);
        finishMove(current, [headerId], moved);
        return;
      }
      if (event.key === 'Escape' && (gesture.current || !editable && latest.current.selection.length)) {
        event.preventDefault(); event.stopPropagation();
        if (gesture.current) cancelGesture(); else { setSelection([]); host.focus({ preventScroll: true }); }
        return;
      }
    };
    // Let module React handlers consume Escape before using it for Back. The
    // capture handler above still owns selection and active editing gestures.
    const backKey = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || !host.contains(event.target)
        || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (navigation.goBack()) { event.preventDefault(); event.stopPropagation(); }
    };
    const pointer = event => {
      if (locked || latest.current.interactionTool !== 'select' || event.target.closest?.('[data-workbench-selection-tools], [data-workbench-toolbar]')) return;
      if (event.button === 0 && gesture.current?.pointerId === event.pointerId) cancelGesture();
      if (event.button !== 0 || gesture.current || event.target.closest?.('[data-immersive]')) return;
      // Resolve Shift-click through the selection overlay to the module's own
      // selectable surface: a window header or Image's artwork surface.
      const target = event.shiftKey && event.target.matches?.('.workbench-selection')
        ? latest.current.selection.map(id => entries.get(id)?.querySelector('[data-workbench-selectable]')).find(header => {
          if (!header) return false;
          const rect = header.getBoundingClientRect();
          return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        }) || event.target
        : event.target;
      const module = target.closest?.('[data-workbench-view-id]');
      if (module && latest.current.presentationTransforms[module.dataset.workbenchViewId]) return;
      if (module && event.shiftKey && target.closest('[data-workbench-selectable]') && !target.closest('[role="separator"], button:not([data-workbench-selectable]), a')) {
        const id = module.dataset.workbenchViewId;
        if (!entries.has(id)) return;
        event.preventDefault(); event.stopPropagation();
        setSelection(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
        return;
      }
      if (!event.target.closest?.('.workbench-selection, .workbench-view-controls, [data-workbench-group-tools], [data-workbench-toolbar]') && !event.shiftKey) setSelection([]);
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
          if (node.hasAttribute('data-workbench-group-hidden') || latest.current.presentationTransforms[node.dataset.workbenchViewId]) return false;
          const b = node.getBoundingClientRect();
          return b.right > rectangle.left && b.left < rectangle.left + rectangle.width && b.bottom > rectangle.top && b.top < rectangle.top + rectangle.height;
        }).map(([id]) => id);
        setSelection([...new Set([...previous, ...hits])]);
      }, finish: pointer => { if (pointer.pointerId === event.pointerId) cancelGesture(false); }, cancel: () => cancelGesture() };
      setSelection(previous); install(active, event);
    };
    const activateInspection = event => {
      const node = event.target.closest?.('[data-workbench-view-id], [data-workbench-inspection-target]');
      if (node) inspectionTarget.current = node.dataset.workbenchInspectionTarget || node.dataset.workbenchViewId;
      else if (event.type === 'pointerdown' && event.target === host) inspectionTarget.current = null;
    };
    host.addEventListener('pointerdown', activateInspection, true);
    host.addEventListener('focusin', activateInspection);
    host.addEventListener('keydown', key, true);
    globalThis.addEventListener('keydown', backKey);
    host.addEventListener('pointerdown', pointer, true);
    return () => {
      host.removeEventListener('pointerdown', activateInspection, true);
      host.removeEventListener('focusin', activateInspection);
      host.removeEventListener('keydown', key, true);
      globalThis.removeEventListener('keydown', backKey);
      host.removeEventListener('pointerdown', pointer, true);
    };
  }, [hostRef, disabled, locked, cancelGesture, setSelection, entries, navigation.goBack, focusModules]);
  if (disabled) return null;
  return <>
    {moveError && <p className="workbench-move-error" role="alert" onClick={() => setMoveError('')}>{moveError}</p>}
    {marquee && <div className="workbench-marquee" style={marquee} />}
    {!locked && view.interactionTool === 'select' && bounds && selected.length > 0 && <div className="workbench-selection" style={travellingBounds || bounds} role="group" tabIndex={0}
      aria-label={`${selected.length} selected Workbench modules`} aria-description="Drag to move the selection. Arrow keys move it; Shift moves further. Escape clears selection."
      onPointerDown={event => { if (event.target === event.currentTarget) beginMove(event); }} onKeyDown={event => {
        if (event.target !== event.currentTarget || gesture.current || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const step = event.shiftKey ? 10 : 1;
        snapMovement.begin(event, selected.map(id => entries.get(id)));
        const current = latest.current;
        const moved = translate(current, selected, snapMovement.rectangle(selected.map(id => entries.get(id))), { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
          y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 }, event.altKey);
        finishMove(current, selected, moved);
      }}>
      {['nw', 'ne', 'sw', 'se'].map(corner => <button key={corner} className={`workbench-selection__handle is-${corner}`} type="button"
        aria-label={`Scale selected modules from ${corner}`} onPointerDown={event => beginResize(event, corner)}
        onKeyDown={event => resizeByKey(event, corner)} />)}
    </div>}
    <div ref={controlsRef} className="workbench-view-controls" role="group" aria-label="Workbench zoom">
      {showHandTool && <button type="button" disabled={locked} aria-pressed={navigation.hand} aria-label="Hand tool"
        title="Drag to explore with momentum. Click artwork to focus its module; module positions stay fixed." onClick={navigation.toggleHand}>Hand</button>}
      <button type="button" disabled={locked || !navigation.canGoBack} aria-label="Back to previous Workbench view"
        title="Return to the view before focusing (Escape after clearing selection)" onClick={navigation.goBack}>Back</button>
      <button type="button" disabled={locked || !selected.length} aria-label="Focus selected Workbench modules"
        aria-keyshortcuts="F" title="Center the selected modules (F)" onClick={focusSelection}>Focus selection</button>
      <button type="button" disabled={locked} aria-label="Reset Workbench position" title="Return to the starting view" onClick={navigation.resetView}>Reset view</button>
      {selected.length > 0 && <span className="workbench-view-controls__selection-count">{selected.length} selected</span>}
      <WorkbenchZoomControl disabled={locked} onClick={navigation.resetZoom} />
      {view.store && <Suspense fallback={null}><WorkbenchGroups view={view} hostRef={hostRef} locked={locked} dropRef={groupDrop} historyBlocked={historyBlocked} navigation={navigation} sceneRef={groupScene} disabled={disabled} /></Suspense>}
      {!view.store && view.groupContent?.workbenchGroups?.length > 0 && <Suspense fallback={null}><PublishedWorkbenchGroups view={view} content={view.groupContent} hostRef={hostRef} navigation={navigation} sceneRef={groupScene} disabled={disabled} locked={locked} /></Suspense>}
      {GridSeamProbe && <Suspense fallback={null}><GridSeamProbe hostRef={hostRef} scale={scale} offset={navigation.offset} /></Suspense>}
    </div>
  </>;
}
