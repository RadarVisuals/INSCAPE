import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBrowserWorkspace from '../../lattice/browser/useBrowserWorkspace.js';
import '../../lattice/browser/browserWorkspace.css';
import { createSystemWorkflowDropGeometry } from '../../systemWorkflow/systemWorkflowPlacement.js';
import { systemWorkflowSnapStep } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import OwnerSystemWorkflowWorkspaceRail from './OwnerSystemWorkflowWorkspaceControls.jsx';
import { OwnerSystemWorkflowWorkspaceShell } from './OwnerSystemWorkflowBrowserWorkspace.jsx';
import { createOwnerSystemWorkflowProjectedField } from './systemWorkflowArtboardProjection.js';
import { decodeOwnerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';
import OwnerSystemWorkflowLibraryPresenter from './OwnerSystemWorkflowLibraryPresenter.jsx';
import { projectLatticePixelRectangle } from '../../lattice/rendering/latticePixelGeometry.js';

const rejectDrop = () => globalThis.dispatchEvent?.(new CustomEvent('inscape:system-workflow-drop-rejected'));
const DRAG_THRESHOLD = 6;
const sourceFor = (asset) => asset?.previewSrc || asset?.src || asset?.imageUrl || asset?.thumbnailUrl || null;
const libraryPreferences = { assetSize: 150, hideLabels: false, sidebarWidth: 174 };

function projectDropPreview(destination, field) {
  if (!destination || !field) return null;
  return projectLatticePixelRectangle(destination, field);
}

export default function OwnerSystemWorkflowLibraryWorkspace({ categoryCommands, controller, data, menuSurface, onClose, phase,
  resolveAssetDimensions }) {
  const workspace = useBrowserWorkspace(data, null, libraryPreferences);
  const resolveDimensions = resolveAssetDimensions || decodeOwnerSystemWorkflowAssetDimensions;
  const [dragPreview, setDragPreview] = useState(null);
  const dragRef = useRef(null);
  useEffect(() => {
    libraryPreferences.assetSize = workspace.assetSize;
    libraryPreferences.hideLabels = workspace.hideLabels;
    libraryPreferences.sidebarWidth = workspace.sidebarWidth;
  }, [workspace.assetSize, workspace.hideLabels, workspace.sidebarWidth]);
  const place = async (asset, destination = null, resolvedDimensions = null) => {
    const dimensions = resolvedDimensions || await resolveDimensions(asset);
    if (!dimensions) return false;
    return controller.run((session) => session.placeAsset({
      gridId: controller.selectedGridId,
      stableAssetId: asset.stableAssetId || asset.id,
      nativeWidth: dimensions.width,
      nativeHeight: dimensions.height,
      ...(destination ? { destination } : {}),
    }));
  };
  const cleanup = () => {
    const active = dragRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    active.source?.removeAttribute('data-workflow-dragging');
    dragRef.current = null;
    setDragPreview(null);
  };
  const beginAssetDrag = (event, asset, _workspace, options = {}) => {
    if (event.button !== 0 || !asset.placeable) return;
    const origin = { x: event.clientX, y: event.clientY };
    const active = { asset, dimensions: null, lastPointer: null, pointerId: event.pointerId, moved: false, source: event.currentTarget };
    const previewAt = (pointerEvent, dimensions = active.dimensions) => {
      const canvas = document.querySelector('.system-workflow__canvas');
      const rectangle = canvas?.getBoundingClientRect();
      const inside = Boolean(rectangle
        && pointerEvent.clientX >= rectangle.left && pointerEvent.clientX <= rectangle.right
        && pointerEvent.clientY >= rectangle.top && pointerEvent.clientY <= rectangle.bottom);
      const field = inside ? createOwnerSystemWorkflowProjectedField(
        canvas, systemWorkflowSnapStep(controller.draft.appearance.guideSize),
      ) : null;
      if (!field) return { destination: null, rectangle: null };
      if (!dimensions) return { destination: null, rectangle: null };
      const destination = createSystemWorkflowDropGeometry(dimensions.width, dimensions.height,
        { x: pointerEvent.clientX, y: pointerEvent.clientY }, field, options);
      return { destination, rectangle: projectDropPreview(destination, field) };
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
      const dimensions = active.dimensions || await active.dimensionPromise;
      const preview = active.moved && dimensions ? previewAt(pointerEvent, dimensions) : null;
      if (preview?.destination) await place(asset, preview.destination, dimensions);
      else if (active.moved) rejectDrop();
      cleanup();
    };
    const cancel = () => cleanup(); Object.assign(active, { move, finish, cancel }); dragRef.current = active;
    active.dimensionPromise = Promise.resolve(resolveDimensions(asset)).then((dimensions) => {
      active.dimensions = dimensions;
      if (dragRef.current === active && active.moved && active.lastPointer && dimensions) {
        setDragPreview({ asset, ...previewAt(active.lastPointer, dimensions) });
      }
      return dimensions;
    });
    globalThis.addEventListener('pointermove', move, true); globalThis.addEventListener('pointerup', finish, true); globalThis.addEventListener('pointercancel', cancel, true);
  };
  useEffect(() => () => cleanup(), []);
  return <OwnerSystemWorkflowWorkspaceShell className="system-workflow__library" label="Library workspace" phase={phase}
    placing={Boolean(dragPreview)} rail={<OwnerSystemWorkflowWorkspaceRail menuSurface={menuSurface} onClose={onClose} workspace={workspace} />}
    sidebarCollapsed={workspace.sidebarWidth <= 72}>
    <OwnerSystemWorkflowLibraryPresenter categoryCommands={categoryCommands} data={data}
      menuSurfaceId={menuSurface} onAssetActivate={(_event, asset) => asset.placeable && place(asset)}
      onAssetPointerDown={beginAssetDrag} workspace={workspace} />
    {dragPreview?.rectangle && createPortal(<div aria-hidden="true" className="system-workflow__placement-preview" style={dragPreview.rectangle}>
      {sourceFor(dragPreview.asset) && <img alt="" src={sourceFor(dragPreview.asset)} />}
      <span>{dragPreview.asset.title || dragPreview.asset.name || 'ASSET'} / RELEASE TO PLACE</span>
    </div>, document.querySelector('.system-workflow') || document.body)}
  </OwnerSystemWorkflowWorkspaceShell>;
}
