import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBrowserWorkspace from '../../lattice/browser/useBrowserWorkspace.js';
import '../../lattice/browser/browserWorkspace.css';
import OwnerSystemWorkflowWorkspaceRail from './OwnerSystemWorkflowWorkspaceControls.jsx';
import { OwnerSystemWorkflowWorkspaceShell } from './OwnerSystemWorkflowBrowserWorkspace.jsx';
import { decodeOwnerSystemWorkflowAssetDimensions, ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';
import OwnerSystemWorkflowLibraryPresenter from './OwnerSystemWorkflowLibraryPresenter.jsx';

const rejectDrop = () => globalThis.dispatchEvent?.(new CustomEvent('inscape:system-workflow-drop-rejected'));
const DRAG_THRESHOLD = 6;
const sourceFor = (asset) => asset?.previewSrc || asset?.src || asset?.imageUrl || asset?.thumbnailUrl || null;
const libraryPreferences = { assetSize: 150, hideLabels: false, sidebarWidth: 174 };
const ownerLibraryPreviewRecords = new Map();

export default function OwnerSystemWorkflowLibraryWorkspace({ authoringLocked = false, categoryCommands, placementScope, data, menuSurface, onClose, phase,
  resolveAssetDimensions, moduleAssetTargetRef, placementTargetRef, shortcutTargetRef, workspaceRef }) {
  const workspace = useBrowserWorkspace(data, ownerLibraryPreviewRecords, libraryPreferences);
  const resolveDimensions = resolveAssetDimensions || decodeOwnerSystemWorkflowAssetDimensions;
  const [dragPreview, setDragPreview] = useState(null);
  const dragRef = useRef(null);
  const libraryClosed = phase === 'closing' || phase === 'closed';
  const placementContext = useMemo(() => ({}), [placementScope, authoringLocked, libraryClosed]);
  const currentPlacementContext = useRef(placementContext);
  currentPlacementContext.current = placementContext;
  const mounted = useRef(true);
  const [libraryWidth, setLibraryWidth] = useState(null);
  const resizeRef = useRef(null);
  const clampWidth = (width) => Math.min(window.innerWidth * 0.48, Math.max(300, width));
  useEffect(() => {
    const root = workspaceRef.current;
    if (libraryWidth !== null) root?.style.setProperty('--workflow-library-track', `min(48vw, ${libraryWidth}px)`);
    return () => root?.style.removeProperty('--workflow-library-track');
  }, [libraryWidth]);
  const finishResize = (event) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(() => {
    libraryPreferences.assetSize = workspace.assetSize;
    libraryPreferences.hideLabels = workspace.hideLabels;
    libraryPreferences.sidebarWidth = workspace.sidebarWidth;
  }, [workspace.assetSize, workspace.hideLabels, workspace.sidebarWidth]);
  const place = async (asset, destination = null, resolvedDimensions = null, target = placementTargetRef.current) => {
    if (authoringLocked || libraryClosed) return false;
    let dimensions;
    try { dimensions = resolvedDimensions || await resolveDimensions(asset); } catch { return false; }
    if (!dimensions || !mounted.current || currentPlacementContext.current !== placementContext) return false;
    return target?.placeAsset(asset, dimensions, destination) || false;
  };
  const cleanup = () => {
    const active = dragRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    globalThis.removeEventListener('keydown', active.escape, true);
    active.source?.removeAttribute('data-workflow-dragging');
    dragRef.current = null;
    setDragPreview(null);
  };
  const beginAssetDrag = (event, asset, workspaceState, options = {}) => {
    const id = asset?.stableAssetId || asset?.id;
    if (libraryClosed || dragRef.current || event.button !== 0 || !asset.placeable || !workspaceState?.isAssetRenderable(id)) return;
    const origin = { x: event.clientX, y: event.clientY };
    const active = { target: placementTargetRef.current, asset, dimensions: ownerSystemWorkflowAssetDimensions(asset), lastPointer: null,
      moduleTarget: moduleAssetTargetRef?.current,
      pointerId: event.pointerId, moved: false, source: event.currentTarget };
    const previewAt = (pointerEvent, dimensions = active.dimensions) => {
      const point = { x: pointerEvent.clientX, y: pointerEvent.clientY };
      const hit = document.elementFromPoint(point.x, point.y);
      const moduleTarget = active.moduleTarget;
      if (moduleTarget && moduleAssetTargetRef?.current === moduleTarget && moduleTarget.node?.contains(hit)) {
        const bounds = moduleTarget.node.getBoundingClientRect();
        return { destination: null, kind: 'module', label: moduleTarget.label, rectangle: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } };
      }
      if (hit?.closest('[data-workbench-module]')) return { destination: null, rectangle: null };
      const shortcut = shortcutTargetRef.current?.node;
      if (shortcut?.contains(document.elementFromPoint(point.x, point.y))) {
        const bounds = shortcut.getBoundingClientRect();
        return { destination: null, kind: 'shortcut', rectangle: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } };
      }
      return active.target?.previewAt(point, dimensions, options) || { destination: null, rectangle: null };
    };
    const move = (pointerEvent) => {
      if (pointerEvent.pointerId !== active.pointerId) return;
      active.moved ||= Math.hypot(pointerEvent.clientX - origin.x, pointerEvent.clientY - origin.y) > DRAG_THRESHOLD;
      if (!active.moved) return;
      pointerEvent.preventDefault();
      active.lastPointer = pointerEvent;
      active.source?.setAttribute('data-workflow-dragging', '');
      const preview = previewAt(pointerEvent);
      setDragPreview({ asset, ...preview });
    };
    const finish = async (pointerEvent) => {
      if (pointerEvent.pointerId !== active.pointerId) return;
      const moved = active.moved;
      const pendingDimensions = active.dimensionPromise;
      cleanup();
      if (!moved) return;
      if (!mounted.current || currentPlacementContext.current !== placementContext) return;
      const hit = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const moduleTarget = active.moduleTarget;
      if (moduleTarget && moduleAssetTargetRef?.current === moduleTarget && moduleTarget.node?.contains(hit)) {
        if (!moduleTarget.placeAsset(asset)) rejectDrop();
        return;
      }
      if (hit?.closest('[data-workbench-module]')) { rejectDrop(); return; }
      const shortcut = shortcutTargetRef.current;
      if (shortcut?.node?.contains(document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY))
        && shortcut.placeAsset(asset)) return;
      const dimensions = await pendingDimensions;
      if (!mounted.current || currentPlacementContext.current !== placementContext) return;
      const preview = dimensions ? previewAt(pointerEvent, dimensions) : null;
      if (preview?.destination) await place(asset, preview.destination, dimensions, active.target);
      else rejectDrop();
    };
    const cancel = () => cleanup();
    const escape = (keyEvent) => {
      if (keyEvent.key !== 'Escape' || !active.moved) return;
      keyEvent.preventDefault(); keyEvent.stopPropagation(); cleanup();
    };
    Object.assign(active, { move, finish, cancel, escape }); dragRef.current = active;
    active.dimensionPromise = Promise.resolve().then(() => resolveDimensions(asset)).then((dimensions) => {
      active.dimensions = dimensions;
      if (dragRef.current === active && active.moved && active.lastPointer && dimensions) {
        setDragPreview({ asset, ...previewAt(active.lastPointer, active.dimensions) });
      }
      return active.dimensions;
    }).catch(() => null);
    globalThis.addEventListener('pointermove', move, true); globalThis.addEventListener('pointerup', finish, true); globalThis.addEventListener('pointercancel', cancel, true);
    globalThis.addEventListener('keydown', escape, true);
  };
  useEffect(() => { cleanup(); }, [placementContext]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cleanup(); }; }, []);
  return <OwnerSystemWorkflowWorkspaceShell className="system-workflow__library" label="Library workspace" phase={phase}
    style={libraryWidth === null ? undefined : { '--workflow-library-width': `${libraryWidth}px` }}
    resizeHandle={<button aria-label="Resize Library" className="system-workflow__library-resize" type="button"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        resizeRef.current = { pointerId: event.pointerId, x: event.clientX, width: event.currentTarget.parentElement.getBoundingClientRect().width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={(event) => {
        const gesture = resizeRef.current;
        if (gesture?.pointerId === event.pointerId) setLibraryWidth(clampWidth(gesture.width + event.clientX - gesture.x));
      }} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={() => { resizeRef.current = null; }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const width = event.currentTarget.parentElement.getBoundingClientRect().width;
        setLibraryWidth(clampWidth(event.key === 'Home' ? 300 : event.key === 'End' ? window.innerWidth
          : width + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 80 : 20)));
      }} />}
    placing={Boolean(dragPreview)} rail={<OwnerSystemWorkflowWorkspaceRail menuSurface={menuSurface} onClose={onClose} workspace={workspace} />}
    sidebarCollapsed={workspace.sidebarWidth <= 72}>
    <OwnerSystemWorkflowLibraryPresenter categoryCommands={categoryCommands} data={data}
      menuSurfaceId={menuSurface} onAssetActivate={(_event, asset) => asset.isCollection && asset.collectionRole !== 'cover'
        ? data.onOpenCollection?.(asset.assetRecord)
        : asset.placeable && workspace.isAssetRenderable(asset.stableAssetId || asset.id) && place(asset)}
      onAssetPointerDown={beginAssetDrag} onImageActivate={(_event, asset) => place(asset)} workspace={workspace} />
    {dragPreview?.rectangle && createPortal(<div aria-hidden="true" className="system-workflow__placement-preview" style={dragPreview.rectangle}>
      {sourceFor(dragPreview.asset) && <img alt="" src={sourceFor(dragPreview.asset)} />}
      <span>{dragPreview.kind === 'module' ? dragPreview.label : dragPreview.kind === 'shortcut' ? 'Release to replace icon' : 'Release to add layer'}</span>
    </div>, workspaceRef.current || document.body)}
  </OwnerSystemWorkflowWorkspaceShell>;
}
