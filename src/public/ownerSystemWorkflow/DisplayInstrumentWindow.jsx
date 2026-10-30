import { avoidWorkbenchControl } from './avoidWorkbenchControl.js';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchPlacement } from './WorkbenchPlacement.jsx';
import { useWorkbenchView, workbenchModuleTransform, useWorkbenchViewRegistration } from './WorkbenchViewContext.js';
import { workbenchViewStyle } from './workbenchViewScale.js';
import { workbenchPaintGeometry } from './workbenchPaintGeometry.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import OwnerSystemWorkflowDetachedWindow from './OwnerSystemWorkflowDetachedWindow.jsx';
import { snapWorkbenchCoordinate, WORKBENCH_GRID_STEP } from './workbenchGrid.js';
import { clampWorkbenchPosition } from './workbenchSpace.js';
import { clampOwnerSystemWorkflowWindowPosition, resizeWorkbenchWindow, workbenchResizeControl, WORKBENCH_RESIZE_EDGES } from './ownerSystemWorkflowWindowGeometry.js';

// The host owns gestures and temporary geometry. A module's resize target owns
// validation and persistence; companion tools retain only their screen layout.
export function WorkbenchWindow({ avoidControls, children, background, compact, chrome, menuSurface, className = '', label, controls, title, titleContent, width = 320, resizable = true, resizableWidth = false, initialHeight = 420, minimumHeight = 180, minimumWidth = 240, initialX = 18, initialY = 72, fitContent = false, fitContentFromTop = false, onLayoutChange, snapToGrid = false, placementModule = false, viewId, active, surfaceStyle, resizeTarget, committedFrame, externalControls = false, moveFromContent = false, registerView = true, screenSized = false, preserveAuthoredLayout = false, onLayoutCommit, viewportBottom }) {
  const { editingBounds: areaBounds, area, showOutside, canvasHost } = useWorkbenchArea();
  const view = useWorkbenchView();
  const { offset, getCamera, subscribeCameraPaint } = useWorkbenchCamera();
  const isCompact = Boolean(compact);
  const transformed = Boolean(viewId) && !compact;
  const anchored = transformed && screenSized;
  const camera = transformed ? workbenchModuleTransform(view, viewId) : { scale: 1, x: 0, y: 0 };
  const node = useRef(null), measuredContent = useRef(null), gesture = useRef(null), latest = useRef(null);
  const [frame, setFrame] = useState(() => ({ left: initialX, top: initialY, width, height: initialHeight }));
  const [preview, setPreview] = useState(null);
  const hasPreview = Boolean(preview);
  const [viewport, setViewport] = useState(() => ({ width: globalThis.innerWidth, height: globalThis.innerHeight }));
  const toolViewportBottom = Math.min(viewport.height, viewportBottom ?? view.toolViewportBottom ?? viewport.height - 48);
  // An anchored inspector keeps its chosen top while content scrolls below it.
  // Other floating tools retain their existing fit-to-viewport placement.
  const contentFromTop = fitContent && fitContentFromTop && !viewId && !compact;
  const screenLeft = viewId ? 8 : Math.max(8, view.navigationInset || 0);
  const screenTop = viewId ? 8 : Math.max(8, view.navigationTop || 0);
  const toolTop = contentFromTop ? Math.max(screenTop, Math.min(frame.top, toolViewportBottom - minimumHeight - 8)) : screenTop;
  const toolMaximumHeight = Math.max(1, toolViewportBottom - toolTop - 8);
  const base = { ...frame, width: resizableWidth ? frame.width : width };
  if ((!viewId || anchored) && !compact) {
    if (resizableWidth) base.width = Math.min(base.width, viewport.width - screenLeft - 8);
    if (contentFromTop) base.top = toolTop;
    base.height = Math.min(base.height, toolMaximumHeight);
  }
  // A published screen-window keeps its chosen layout while fitting its pixels
  // to the current viewport. This projection must not become module content.
  if (preserveAuthoredLayout && !viewId && !compact) {
    const position = clampOwnerSystemWorkflowWindowPosition({ x: base.left, y: base.top }, base,
      { width: viewport.width, height: toolViewportBottom });
    base.left = Math.max(screenLeft, position.x); base.top = Math.max(screenTop, position.y);
  }
  const current = camera.frame || preview || base;
  const density = transformed && !anchored ? globalThis.devicePixelRatio || 1 : 1;
  const screen = transformed ? { left: current.left * camera.scale + camera.x + offset.x,
    top: current.top * camera.scale + camera.y + offset.y, width: current.width * (anchored ? 1 : camera.scale), height: current.height * (anchored ? 1 : camera.scale) }
    : { ...current, width: Math.min(current.width, viewport.width - screenLeft - 8) };
  const paint = workbenchPaintGeometry(screen, density);
  const painted = Object.fromEntries(Object.entries(paint).map(([key, value]) => [key, value / density]));
  // External module controls must clear both the viewport and their canvas clip.
  // Floating tools and explicitly presented artwork remain viewport-owned.
  const clippedControls = externalControls && transformed && !anchored && !showOutside
    && !camera.presented && canvasHost?.contains(node.current);
  const controlsTop = clippedControls ? Math.max(0, offset.y + area.top * view.scale) : 0;
  const placement = useWorkbenchPlacement(node, placementModule && !compact, camera.scale, true, screen);
  // A module can opt into the same free-corner geometry for its selection.
  // Keep snapping, constraints and camera conversion in this existing host.
  const registeredResizeTarget = useMemo(() => resizeTarget?.resizeCorner ? {
    ...resizeTarget, resizeCorner: (...args) => latest.current.resizeTo(...args),
  } : resizeTarget, [resizeTarget]);
  useWorkbenchViewRegistration(viewId, node, registerView && !compact, base, registeredResizeTarget,
    position => setFrame(current => ({ ...current, ...position })));
  const canResize = (!preserveAuthoredLayout || base.width >= minimumWidth && base.height >= minimumHeight) && !camera.presented && resizable && !fitContent && !compact && (!resizeTarget?.store || resizeTarget.enabled);
  const local = transformed ? view.transforms[viewId] : null;
  const localScale = local?.scale || 1;
  // Canvas instruments keep screen-sized controls. Only their anchor follows
  // the shared camera; they never join artwork selection or raster projection.
  const anchor = useRef(null);
  anchor.current = { left: current.left * localScale + (local?.x || 0), top: current.top * localScale + (local?.y || 0) };
  useLayoutEffect(() => {
    if (!anchored) return;
    const paint = ({ scale, offset }) => {
      if (!node.current) return;
      node.current.style.left = `${Math.round(anchor.current.left * scale + offset.x)}px`;
      node.current.style.top = `${Math.round(anchor.current.top * scale + offset.y)}px`;
    };
    paint(getCamera());
    return subscribeCameraPaint(paint);
  }, [anchored, getCamera, subscribeCameraPaint, current.left, current.top, localScale, local?.x, local?.y, camera.scale, offset]);
  const bounds = viewId ? {
    left: (areaBounds.left - (local?.x || 0)) / localScale,
    top: (areaBounds.top - (local?.y || 0)) / localScale,
    right: (areaBounds.right - (local?.x || 0)) / localScale,
    bottom: (areaBounds.bottom - (local?.y || 0)) / localScale,
  } : { left: screenLeft, top: screenTop, right: viewport.width - 8, bottom: toolViewportBottom - 8 };
  const commitResize = next => {
    if (resizeTarget?.store) {
      if (!resizeTarget.enabled) return false;
      const authored = { left: next.left * localScale + (local?.x || 0), top: next.top * localScale + (local?.y || 0),
        width: next.width * localScale, height: next.height * localScale };
      if (!resizeTarget.commit([{ ...resizeTarget, id: viewId, ...authored, getPresentation: view.getPresentation }])) return false;
      view.setTransforms(values => { const nextTransforms = { ...values }; delete nextTransforms[viewId]; return nextTransforms; });
      resizeTarget.applyFrame(authored);
      setFrame(authored);
    } else { if (onLayoutCommit?.(next) === false) return false; setFrame(next); }
    return true;
  };
  const finish = (cancelled = false) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    placement.finish();
    if (drag.kind === 'resize') {
      if (!cancelled && drag.next) commitResize(drag.next);
      setPreview(null);
    } else if (drag.kind === 'content-move') {
      if (!cancelled && drag.next && onLayoutCommit?.(drag.next) !== false) setFrame(drag.next);
      setPreview(null);
    } else if (cancelled || drag.next && onLayoutCommit?.(drag.next) === false) setFrame(drag.authoredFrame || drag.frame);
    if (drag.element.hasPointerCapture?.(drag.id)) drag.element.releasePointerCapture(drag.id);
    if (!drag.element.isConnected) queueMicrotask(() => node.current?.querySelector('header')?.focus());
  };
  latest.current = { finish, resizeTo: (...args) => resizeTo(...args) };
  useLayoutEffect(() => {
    const cancel = () => latest.current.finish(true);
    const escape = event => {
      if (event.key !== 'Escape' || !gesture.current) return;
      event.preventDefault(); event.stopPropagation(); cancel();
    };
    const resize = () => { cancel(); setViewport({ width: globalThis.innerWidth, height: globalThis.innerHeight }); };
    document.addEventListener('keydown', escape, true);
    globalThis.addEventListener('blur', cancel);
    globalThis.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('keydown', escape, true);
      globalThis.removeEventListener('blur', cancel);
      globalThis.removeEventListener('resize', resize);
      cancel();
    };
  }, []);
  useLayoutEffect(() => { latest.current.finish(true); }, [camera.scale, camera.x, camera.y, offset.x, offset.y, isCompact, canResize, moveFromContent, resizeTarget?.expected]);
  const lastCommittedFrame = useRef(committedFrame);
  // Tools belong to the viewport. Authored module positions remain in Workbench
  // coordinates and are never rewritten just because the browser got smaller.
  useLayoutEffect(() => {
    // Apply a new controlled layout before clamping. Clamping the old frame in
    // this same commit otherwise overwrites responsive size/position updates.
    if (committedFrame !== lastCommittedFrame.current) {
      lastCommittedFrame.current = committedFrame;
      if (committedFrame) { setFrame(committedFrame); return; }
    }
    if (viewId || preserveAuthoredLayout || isCompact || hasPreview) return;
    const position = clampOwnerSystemWorkflowWindowPosition({ x: base.left, y: base.top }, base,
      { width: viewport.width, height: toolViewportBottom });
    const x = Math.max(screenLeft, position.x), y = Math.max(screenTop, position.y);
    if (x !== frame.left || y !== frame.top || base.width !== frame.width || base.height !== frame.height)
      setFrame({ ...base, left: x, top: y });
  // Depend on geometry values, not the new derived base object on every render.
  }, [committedFrame, viewId, preserveAuthoredLayout, isCompact, hasPreview, frame.left, frame.top, frame.width, frame.height, base.left, base.top, base.width, base.height, viewport.width, toolViewportBottom, screenLeft, screenTop]);
  const { left: layoutLeft, top: layoutTop, width: layoutWidth, height: layoutHeight } = preserveAuthoredLayout ? frame : base;
  useLayoutEffect(() => {
    if (!isCompact && !camera.frame) onLayoutChange?.({ left: layoutLeft, top: layoutTop, width: layoutWidth, height: layoutHeight });
  }, [layoutLeft, layoutTop, layoutWidth, layoutHeight, onLayoutChange, isCompact, camera.frame]);
  useLayoutEffect(() => {
    if (!fitContent || isCompact) return undefined;
    const content = measuredContent.current;
    const measure = () => {
      const style = getComputedStyle(content.parentElement);
      const shell = getComputedStyle(node.current);
      // Measure the chrome independently: a previously hidden tool can start
      // shorter than its titlebar and padding, before the content fits it.
      const chromeHeight = node.current.querySelector('header').offsetHeight
        + ['borderTopWidth', 'borderBottomWidth', 'paddingTop', 'paddingBottom']
          .reduce((height, key) => height + parseFloat(shell[key]) + parseFloat(style[key]), 0)
        + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
      const height = Math.min(toolMaximumHeight, Math.max(minimumHeight,
        Math.ceil(content.getBoundingClientRect().height + chromeHeight)));
      setFrame(value => value.height === height ? value : { ...value, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    // Context tools mount while hidden. Their titlebar becomes measurable on
    // selection and can also grow for touch targets without changing content.
    observer.observe(node.current.querySelector('header'));
    globalThis.addEventListener('resize', measure); measure();
    return () => { observer.disconnect(); globalThis.removeEventListener('resize', measure); };
  }, [fitContent, isCompact, minimumHeight, toolMaximumHeight]);
  useLayoutEffect(() => {
    if (!avoidControls?.length || viewId || compact || gesture.current || !node.current?.getClientRects().length) return;
    // Resolve at layout/selection changes, without adding React work to each
    // projected camera frame. This changes only the companion window.
    const rectangle = node.current.getBoundingClientRect();
    const controls = [...avoidControls].filter(node => node.isConnected).map(node => node.getBoundingClientRect());
    if (!rectangle.height || !controls.length) return;
    const controlBounds = { left: Math.min(...controls.map(rect => rect.left)), right: Math.max(...controls.map(rect => rect.right)),
      top: Math.min(...controls.map(rect => rect.top)), bottom: Math.max(...controls.map(rect => rect.bottom)) };
    const next = avoidWorkbenchControl({ left: rectangle.left, top: rectangle.top, width: rectangle.width, height: rectangle.height },
      controlBounds, bounds, 8, minimumHeight);
    // DOM layout can round a fractional recovery-control edge. Do not schedule
    // another layout update when React already holds the requested position:
    // even a no-op updater can re-enter this effect while other updates commit.
    if ((next.left !== rectangle.left || next.top !== rectangle.top || next.height !== rectangle.height)
      && (frame.left !== next.left || frame.top !== next.top || frame.height !== next.height))
      setFrame({ ...frame, left: next.left, top: next.top, height: next.height });
  });
  const positionFor = (candidate, altKey) => {
    const snapping = snapToGrid && !altKey;
    const placed = placement.position(candidate, current, {
      left: snapWorkbenchCoordinate(candidate.left, snapping), top: snapWorkbenchCoordinate(candidate.top, snapping),
    }, altKey);
    if (viewId) return { ...base, ...clampWorkbenchPosition(placed, anchored ? { width: base.width / camera.scale, height: base.height / camera.scale } : base, areaBounds) };
    const size = contentFromTop ? { ...base, height: Math.min(base.height, minimumHeight) } : base;
    const position = clampOwnerSystemWorkflowWindowPosition({ x: placed.left, y: placed.top }, size,
      { width: viewport.width, height: toolViewportBottom });
    return { ...(preserveAuthoredLayout ? frame : base), left: Math.max(screenLeft, position.x), top: Math.max(screenTop, position.y) };
  };
  const resizeTo = (origin, edge, delta, altKey) => {
    const sizeScale = anchored ? camera.scale : 1;
    const next = (resizeTarget?.resizeCorner || resizeWorkbenchWindow)({ ...origin, width: origin.width / sizeScale, height: origin.height / sizeScale }, edge, delta,
      { width: (resizeTarget?.minimumWidth ?? minimumWidth) / sizeScale, height: (resizeTarget?.minimumHeight ?? minimumHeight) / sizeScale }, bounds,
      resizeTarget?.constrainFrame ? undefined : (axis, side, value) => placement.edge(axis, side, value, origin, altKey) ?? snapWorkbenchCoordinate(value, snapToGrid && !altKey));
    if (preserveAuthoredLayout) {
      if (!delta.x) { next.left = frame.left; next.width = frame.width; }
      if (!delta.y) { next.top = frame.top; next.height = frame.height; }
    }
    return resizeTarget?.constrainFrame?.(next, { edge, bounds }) || { ...next, width: next.width * sizeScale, height: next.height * sizeScale };
  };
  const begin = (event, kind, edge) => {
    if (camera.presented || event.button !== 0 || kind !== 'resize' && event.target.closest('button, a, input, select, textarea')) return;
    event.preventDefault(); event.stopPropagation();
    if (kind === 'content-move') node.current.querySelector('header')?.focus({ preventScroll: true });
    else event.currentTarget.focus();
    placement.begin(event);
    gesture.current = { kind, edge, id: event.pointerId, x: event.clientX, y: event.clientY, frame: base, authoredFrame: preserveAuthoredLayout ? frame : undefined, element: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const drag = gesture.current;
    if (drag?.id !== event.pointerId) return;
    const delta = { x: (event.clientX - drag.x) / camera.scale, y: (event.clientY - drag.y) / camera.scale };
    if (drag.kind === 'content-move') {
      if (!drag.next && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      drag.next = positionFor({ left: drag.frame.left + delta.x, top: drag.frame.top + delta.y }, event.altKey);
      setPreview(drag.next);
    } else if (drag.kind === 'move') { drag.next = positionFor({ left: drag.frame.left + delta.x, top: drag.frame.top + delta.y }, event.altKey); setFrame(drag.next); }
    else { drag.next = resizeTo(drag.frame, drag.edge, delta, event.altKey); setPreview(drag.next); }
  };
  const key = (event, edge) => {
    if (camera.presented || event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopPropagation(); placement.begin(event);
    const step = edge && resizeTarget?.resizeStep ? resizeTarget.resizeStep * (event.shiftKey ? 10 : 1)
      : snapToGrid && !event.altKey ? placement.step() || WORKBENCH_GRID_STEP : event.shiftKey ? WORKBENCH_GRID_STEP : 8;
    const delta = { x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
      y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0 };
    if (edge) commitResize(resizeTo(base, edge, anchored ? { x: delta.x / camera.scale, y: delta.y / camera.scale } : delta, event.altKey));
    else { const next = positionFor({ left: base.left + delta.x, top: base.top + delta.y }, event.altKey); if (onLayoutCommit?.(next) !== false) setFrame(next); }
    placement.finish();
  };
  const pointerProps = { onPointerMove: move, onPointerUp: () => finish(), onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(true) };
  return <OwnerSystemWorkflowDetachedWindow ariaLabel={`${label} — ${title}`} ref={node} viewId={registerView ? viewId : undefined} active={active} workbenchPan={transformed && !anchored}
    className={`system-workflow__instrument-window ${externalControls ? 'workbench-window--external-controls' : ''} ${className}`} title={`${label} · ${title}`}
    headerPointerProps={{ 'aria-label': `Move ${label} window`, 'data-workbench-selectable': registerView && viewId ? true : undefined,
      'data-controls-below': externalControls && painted.top < controlsTop + 56 || undefined, 'aria-keyshortcuts': registerView && viewId ? 'Shift+Enter' : undefined,
      tabIndex: 0, onKeyDown: event => key(event), onPointerDown: event => begin(event, 'move'), ...pointerProps }}
    controls={controls} titleContent={titleContent} background={background} compactContent={compact?.content} chrome={chrome} menuSurface={menuSurface}
    contentPointerProps={moveFromContent ? { 'data-content-move': true, 'data-workbench-selectable': Boolean(viewId) || undefined,
      onPointerDown: event => begin(event, 'content-move'), ...pointerProps } : undefined}
    style={{ ...surfaceStyle, '--workbench-pan-scale': camera.scale, '--workbench-control-scale': density, '--detached-window-width': `${current.width}px`,
      '--workbench-tool-maximum-height': `${toolMaximumHeight}px`,
      left: current.left, top: current.top, height: current.height, maxHeight: viewId ? 'none' : toolMaximumHeight,
      ...(anchored ? { left: painted.left, top: painted.top, width: painted.width, height: painted.height }
        : transformed ? workbenchViewStyle(camera.scale, current.left, current.top, current.width, current.height, camera.x, camera.y, offset) : {}), ...compact?.style }}
    resizeHandles={canResize && WORKBENCH_RESIZE_EDGES.filter(([edge]) => resizableWidth || ['n', 's'].includes(edge)).map(([edge, name]) =>
      <div key={edge} className={`system-workflow__detached-window-resize is-${edge}`}
        aria-label={edge === 'se' ? `Resize ${label} window` : !resizableWidth && edge === 's' ? `Resize ${label} height` : `Resize ${label} from ${name}`}
        role="separator" tabIndex={0} aria-orientation={['w', 'e'].includes(edge) ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(['w', 'e'].includes(edge) ? current.width : current.height)}
        aria-valuetext={`${Math.round(current.width)} by ${Math.round(current.height)} pixels`}
        style={workbenchResizeControl(edge, painted, viewport, globalThis.devicePixelRatio || 1)} onKeyDown={event => key(event, edge)}
        onPointerDown={event => begin(event, 'resize', edge)} {...pointerProps} />)}
    surfaceClassName="system-workflow__instrument-content">
    {fitContent ? <div ref={measuredContent}>{children}</div> : children}
  </OwnerSystemWorkflowDetachedWindow>;
}

export default function DisplayInstrumentWindow({ menuSurface, children, instrument, onClose, title, layout, onLayoutChange }) {
  const label = instrument === 'layers' ? 'Layers' : instrument === 'appearance' ? 'Display appearance' : 'Artwork info';
  return <WorkbenchWindow chrome="tactile" className="workbench-tool-window" menuSurface={menuSurface} label={label} title={title}
    width={320} resizable={false} fitContent fitContentFromTop initialHeight={480} minimumHeight={96}
    initialX={layout?.left ?? 18} initialY={layout?.top ?? (instrument === 'metadata' ? 260 : 24)}
    onLayoutChange={onLayoutChange}
    controls={<button aria-label={`Close ${label}`} className="workflow-tactile-control system-workflow__window-cap"
      onClick={onClose} type="button"><X /></button>}>
    <div onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>{children}</div>
  </WorkbenchWindow>;
}
