import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle } from '../../lattice/rendering/latticeGeometry.js';
import LatticePixelGrid from '../../lattice/rendering/LatticePixelGrid.jsx';
import { createSystemWorkflowDropGeometry } from '../../systemWorkflow/systemWorkflowPlacement.js';
import { systemWorkflowSnapStep } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { adjacentSystemWorkflowGridId } from '../../systemWorkflow/domain/systemWorkflowNavigation.js';
import {
  projectSystemWorkflowImageRenderRectangle,
  projectSystemWorkflowTransform,
} from '../../systemWorkflow/systemWorkflowTransform.js';
import useOwnerSystemWorkflowPlacementInteraction from './useOwnerSystemWorkflowPlacementInteraction.js';
import {
  createOwnerSystemWorkflowProjectedField,
  measureOwnerSystemWorkflowArtboard,
  projectOwnerSystemWorkflowPlacement,
} from './systemWorkflowArtboardProjection.js';
import { ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';
import { markOwnerSystemWorkflowPointerFocus } from './ownerSystemWorkflowSelection.js';

const sourceFor = (asset) => asset?.src || asset?.originalImageUrl || asset?.imageUrl || asset?.thumbnailUrl || null;
const boundsOf = (placements) => placements.length ? {
  column: Math.min(...placements.map(({ column }) => column)),
  row: Math.min(...placements.map(({ row }) => row)),
  right: Math.max(...placements.map(({ column, columnSpan }) => column + columnSpan)),
  bottom: Math.max(...placements.map(({ row, rowSpan }) => row + rowSpan)),
} : null;
const projectedHandlePoint = (column, row, field) => {
  const { left, top } = projectOwnerSystemWorkflowPlacement({ column, row, columnSpan: 0, rowSpan: 0 }, field);
  return { left, top };
};
const projectedSelectionOutline = (bounds, field) => {
  const rectangle = projectOwnerSystemWorkflowPlacement({
    column: bounds.column, row: bounds.row,
    columnSpan: bounds.right - bounds.column,
    rowSpan: bounds.bottom - bounds.row,
  }, field);
  return { ...rectangle, width: rectangle.width + 1, height: rectangle.height + 1 };
};

function GridSwipePreview({ appearance, assetsById, grid, worldViewport }) {
  if (!grid || !worldViewport) return null;
  return <>
    <LatticePixelGrid color={appearance.guideColor} field={worldViewport} guideInterval={systemWorkflowSnapStep(appearance.guideSize)}
      height={worldViewport.height} mode={appearance.guideMode} width={worldViewport.width} />
    {grid.placements.slice().sort((left, right) => left.layer - right.layer).map((placement) => {
      const asset = assetsById.get(placement.stableAssetId);
      const src = sourceFor(asset);
      const projected = projectOwnerSystemWorkflowPlacement(placement, worldViewport);
      const dimensions = ownerSystemWorkflowAssetDimensions(asset);
      const opening = { left: 0, top: 0, width: projected.width, height: projected.height };
      const transform = dimensions
        ? projectSystemWorkflowTransform(placement.transform, dimensions, placement.crop)
        : projectSystemWorkflowTransform(placement.transform, { width: placement.columnSpan, height: placement.rowSpan }, placement.crop);
      const imageRectangle = dimensions && (transform.crop
        ? projectCroppedMediaRectangle(opening, transform.dimensions, transform.crop)
        : fitNativeMediaRectangle(opening, transform.dimensions));
      const imageRenderRectangle = projectSystemWorkflowImageRenderRectangle(imageRectangle, transform);
      return <div className="system-workflow__placement" data-cropped={Boolean(placement.crop) || undefined} key={placement.id}
        style={{ ...projected, zIndex: placement.layer + 1 }}>
        <span data-frame={placement.frameId} style={{ background: placement.backing.enabled ? placement.backing.color : 'transparent', padding: placement.mat.enabled ? '5%' : 0 }}>
          {src ? <img src={src} alt="" draggable={false} style={imageRenderRectangle ? { ...imageRenderRectangle, transform: transform.css } : undefined} /> : <em>Media</em>}
        </span>
      </div>;
    })}
  </>;
}

export default function OwnerSystemWorkflowCanvas({ assetsById, controller, crop, interactionDisabled = false, onChangeGrid, onOpenViewer, onPlacementRef, reducedMotion = false, viewerPlacementId = null }) {
  const canvasRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const [dropFeedback, setDropFeedback] = useState(null);
  const [worldViewport, setWorldViewport] = useState(null);
  const retainedSelection = useRef(null);
  const grid = controller.selectedGrid;
  const cropSession = crop?.cropSession || null;
  const appearance = controller.draft?.appearance;
  const snapStep = systemWorkflowSnapStep(appearance.guideSize);
  const viewerOpen = Boolean(viewerPlacementId);
  const adjacentGrid = (direction) => controller.draft && grid
    ? adjacentSystemWorkflowGridId(controller.draft, grid.id, direction)
    : null;
  const interaction = useOwnerSystemWorkflowPlacementInteraction({
    canvasRef, canNavigateGrid: adjacentGrid, controller, cropSession,
    disabled: interactionDisabled || viewerOpen,
    onNavigateGrid: (direction, options) => {
      const gridId = adjacentGrid(direction);
      if (gridId) onChangeGrid?.(gridId, direction, options);
    },
    reducedMotion,
    snapStep,
  });
  const swipeGridId = interaction.gridSwipe?.targetGridId || null;
  const swipeGrid = swipeGridId ? controller.draft.grids.find(({ id }) => id === swipeGridId) : null;
  const swipeStyle = interaction.gridSwipe ? {
    '--workflow-grid-swipe-x': `${interaction.gridSwipe.deltaX}px`,
    '--workflow-grid-swipe-side': interaction.gridSwipe.direction === 'next' ? '100%' : '-100%',
  } : undefined;
  const projectedPlacements = grid?.placements.map((placement) => ({ ...placement, ...(interaction.previewById.get(placement.id) || {}) })) || [];
  const selected = projectedPlacements.filter(({ id, locked }) => controller.selectedPlacementIds.includes(id) && !locked);
  const selectionBounds = boundsOf(selected);
  if (selectionBounds) retainedSelection.current = { bounds: selectionBounds, primary: selected.at(-1), count: selected.length };
  const renderedSelection = selectionBounds ? retainedSelection.current : retainedSelection.current;

  useLayoutEffect(() => {
    const node = canvasRef.current;
    if (!node) return undefined;
    const measure = () => {
      const rectangle = node.getBoundingClientRect();
      setWorldViewport(measureOwnerSystemWorkflowArtboard(rectangle.width, rectangle.height));
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    globalThis.addEventListener?.('resize', measure);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', measure); };
  }, []);

  useEffect(() => {
    const reportRejectedDrop = () => {
      globalThis.clearTimeout?.(feedbackTimerRef.current);
      setDropFeedback('PLACE INSIDE THE ARTBOARD');
      feedbackTimerRef.current = globalThis.setTimeout?.(() => setDropFeedback(null), 1600);
    };
    globalThis.addEventListener?.('inscape:system-workflow-drop-rejected', reportRejectedDrop);
    return () => {
      globalThis.removeEventListener?.('inscape:system-workflow-drop-rejected', reportRejectedDrop);
      globalThis.clearTimeout?.(feedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!grid || cropSession || interactionDisabled || viewerOpen || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)) return;
      if (event.key === 'Escape') { controller.replaceSelection([]); return; }
      const records = grid.placements.filter(({ id }) => controller.selectedPlacementIds.includes(id));
      if (!records.length) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        const removable = records.filter(({ locked }) => !locked);
        if (!removable.length) return;
        controller.run((session) => removable.length === 1
          ? session.removePlacement({ gridId: grid.id, placementId: removable[0].id, expectedPlacement: removable[0] })
          : session.removePlacements({ gridId: grid.id, placementIds: removable.map(({ id }) => id), expectedPlacements: removable }));
        controller.replaceSelection([]);
      }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
      const step = snapStep * (event.shiftKey ? 2 : 1);
        interaction.nudgeSelection({
          column: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
          row: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
        });
      }
    };
    globalThis.addEventListener?.('keydown', onKeyDown);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown);
  }, [controller, cropSession, grid, interaction, interactionDisabled, snapStep, viewerOpen]);

  if (!grid) return null;
  return <section className="system-workflow__stage" aria-label={`${grid.title} Grid`} data-system-workflow-stage>
    <div ref={canvasRef} className="system-workflow__canvas" data-guide={appearance.guideMode} data-system-workflow-artboard data-swipe-direction={interaction.gridSwipe?.direction} data-swiping={Boolean(interaction.gridSwipe) || undefined} data-swipe-settling={interaction.gridSwipe?.settling || undefined} style={{ '--guide-color': appearance.guideColor, '--world-cell-size': worldViewport ? `${worldViewport.cellSize}px` : undefined, '--world-origin-x': worldViewport ? `${worldViewport.left}px` : undefined, '--world-origin-y': worldViewport ? `${worldViewport.top}px` : undefined, ...swipeStyle }}
      onPointerDown={(event) => { if (!cropSession) interaction.beginCanvasSelection(event); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const asset = assetsById.get(event.dataTransfer.getData('application/x-inscape-asset'));
        if (!asset) return;
        const dimensions = ownerSystemWorkflowAssetDimensions(asset);
        if (!dimensions) return;
        const field = createOwnerSystemWorkflowProjectedField(canvasRef.current, snapStep);
        if (!field) return;
        controller.run((session) => session.placeAsset({
          gridId: grid.id,
          stableAssetId: asset.stableAssetId || asset.id,
          nativeWidth: dimensions.width,
          nativeHeight: dimensions.height,
          destination: createSystemWorkflowDropGeometry(dimensions.width, dimensions.height, { x: event.clientX, y: event.clientY }, field),
        }));
      }}>
      <div className="system-workflow__grid-plane system-workflow__grid-plane--current">
      {worldViewport && <LatticePixelGrid color={appearance.guideColor} field={worldViewport} guideInterval={snapStep}
        height={worldViewport.height} mode={appearance.guideMode} width={worldViewport.width} />}
      {projectedPlacements.slice().sort((left, right) => left.layer - right.layer).map((placement) => {
        const asset = assetsById.get(placement.stableAssetId);
        const src = sourceFor(asset);
        const isSelected = controller.selectedPlacementIds.includes(placement.id) && !placement.locked;
        const visibleCrop = cropSession?.placementId === placement.id ? cropSession.previewCrop : placement.crop;
        const cropping = cropSession?.placementId === placement.id;
        const projected = worldViewport && projectOwnerSystemWorkflowPlacement(placement, worldViewport);
        if (!projected) return null;
        const opening = { left: 0, top: 0, width: projected.width, height: projected.height };
        const dimensions = ownerSystemWorkflowAssetDimensions(asset);
        const transform = dimensions
          ? projectSystemWorkflowTransform(placement.transform, dimensions, visibleCrop)
          : projectSystemWorkflowTransform(placement.transform, { width: placement.columnSpan, height: placement.rowSpan }, visibleCrop);
        const imageRectangle = dimensions && (transform.crop ? projectCroppedMediaRectangle(opening, transform.dimensions, transform.crop) : fitNativeMediaRectangle(opening, transform.dimensions));
        const imageRenderRectangle = projectSystemWorkflowImageRenderRectangle(imageRectangle, transform);
        return <div aria-disabled={placement.locked || undefined} aria-label={`Select ${asset?.title || asset?.name || 'artwork'}`} aria-pressed={isSelected}
          className="system-workflow__placement" data-cropped={Boolean(visibleCrop) || undefined} data-cropping={cropping || undefined} data-system-workflow-crop-surface={cropping || undefined} data-locked={placement.locked || undefined}
          data-viewing={viewerPlacementId === placement.id || undefined}
          key={placement.id} onClick={(event) => { if (!cropSession && !interaction.clickSuppressedRef.current && !placement.locked) controller.selectPlacement(placement.id, event.shiftKey); }}
          onDoubleClick={(event) => { if (cropSession || placement.locked) return; event.stopPropagation(); onOpenViewer(placement, event.currentTarget); }}
          onKeyDown={(event) => { if (!cropSession && event.key === 'Enter' && !placement.locked) { event.preventDefault(); onOpenViewer(placement, event.currentTarget); } }}
          onPointerDown={(event) => { markOwnerSystemWorkflowPointerFocus(event.currentTarget); if (cropping) crop.beginCropDrag(event, placement.id, worldViewport.cellSize); else if (!cropSession) interaction.beginPlacementGesture(event, placement); }} ref={(node) => onPlacementRef?.(placement.id, node)} role="button" tabIndex={placement.locked ? -1 : 0}
          style={{ ...projected, zIndex: placement.layer + 1 }}>
          <span data-frame={placement.frameId} style={{ background: placement.backing.enabled ? placement.backing.color : 'transparent', padding: placement.mat.enabled ? '5%' : 0 }}>
            {src ? <img src={src} alt="" draggable={false} style={imageRenderRectangle ? { ...imageRenderRectangle, transform: transform.css } : undefined} /> : <em>Media</em>}
          </span>
        </div>;
      })}
      {renderedSelection && worldViewport && <div className="system-workflow__selection-chrome" aria-hidden={viewerOpen || !selectionBounds} data-cropping={Boolean(cropSession) || undefined} data-group={renderedSelection.count > 1 || undefined} data-selected={Boolean(selectionBounds) || undefined} data-viewing={viewerOpen || undefined}>
        <i className="system-workflow__selection-outline" style={projectedSelectionOutline(renderedSelection.bounds, worldViewport)} />
        {['nw', 'ne', 'se', 'sw'].map((corner) => <button aria-label={`Resize selection from ${corner}`} className={`system-workflow__resize-handle is-${corner}`} disabled={viewerOpen || !selectionBounds}
          key={corner} onPointerDown={(event) => interaction.beginPlacementGesture(event, renderedSelection.primary, 'resize', corner)} type="button"
          style={projectedHandlePoint(corner.includes('e') ? renderedSelection.bounds.right : renderedSelection.bounds.column,
            corner.includes('s') ? renderedSelection.bounds.bottom : renderedSelection.bounds.row, worldViewport)} />)}
      </div>}
      {interaction.marquee && <i className="system-workflow__marquee" style={interaction.marquee} />}
      </div>
      {interaction.gridSwipe && swipeGrid && <div aria-hidden="true" className="system-workflow__grid-plane system-workflow__grid-plane--adjacent">
        <GridSwipePreview appearance={appearance} assetsById={assetsById} grid={swipeGrid} worldViewport={worldViewport} />
      </div>}
    </div>
    <output aria-live="polite" className="system-workflow__drop-feedback" data-visible={Boolean(dropFeedback) || undefined}>{dropFeedback}</output>
  </section>;
}
