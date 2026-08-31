import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle } from '../../lattice/rendering/latticeGeometry.js';
import LatticePixelGrid from '../../lattice/rendering/LatticePixelGrid.jsx';
import { projectLatticeRasterBleedRectangle } from '../../lattice/rendering/latticePixelGeometry.js';
import { createSystemWorkflowDropGeometry } from '../../systemWorkflow/systemWorkflowPlacement.js';
import { isSystemWorkflowWorldCoverGrid, systemWorkflowSnapStep } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { adjacentSystemWorkflowGridId } from '../../systemWorkflow/domain/systemWorkflowNavigation.js';
import {
  projectSystemWorkflowImageRenderRectangle,
  projectSystemWorkflowTransform,
  renderedSystemWorkflowCssTransform,
} from '../../systemWorkflow/systemWorkflowTransform.js';
import useOwnerSystemWorkflowPlacementInteraction from './useOwnerSystemWorkflowPlacementInteraction.js';
import {
  OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES,
  createOwnerSystemWorkflowProjectedField,
  measureOwnerSystemWorkflowArtboard,
  measureOwnerSystemWorkflowHeroArtboard,
  ownerSystemWorkflowProjectedFieldContainsPoint,
  projectOwnerSystemWorkflowPlacement,
} from './systemWorkflowArtboardProjection.js';
import {
  decodeOwnerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowAssetDimensions,
} from './ownerSystemWorkflowAssetDimensions.js';
import { markOwnerSystemWorkflowPointerFocus } from './ownerSystemWorkflowSelection.js';
import ProgressiveArtworkImage from './ProgressiveArtworkImage.jsx';
import { progressiveArtworkSources } from './progressiveArtworkSources.js';

const sourceFor = (asset) => progressiveArtworkSources(asset).high;
const boundsOf = (placements) => placements.length ? {
  column: Math.min(...placements.map(({ column }) => column)),
  row: Math.min(...placements.map(({ row }) => row)),
  right: Math.max(...placements.map(({ column, columnSpan }) => column + columnSpan)),
  bottom: Math.max(...placements.map(({ row, rowSpan }) => row + rowSpan)),
} : null;
const projectedSelectionOutline = (bounds, field) => {
  const rectangle = projectOwnerSystemWorkflowPlacement({
    column: bounds.column, row: bounds.row,
    columnSpan: bounds.right - bounds.column,
    rowSpan: bounds.bottom - bounds.row,
  }, field);
  return rectangle;
};
const screenPixelMetrics = (rectangle, scale) => {
  const devicePixelRatio = Number.isFinite(globalThis.devicePixelRatio) && globalThis.devicePixelRatio > 0
    ? globalThis.devicePixelRatio : 1;
  const snap = (value) => Math.round(value * scale * devicePixelRatio) / devicePixelRatio;
  const left = snap(rectangle.left);
  const top = snap(rectangle.top);
  const right = snap(rectangle.left + rectangle.width);
  const bottom = snap(rectangle.top + rectangle.height);
  return {
    rectangle: { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) },
    screenPixel: 1 / devicePixelRatio,
  };
};
const screenHandlePoint = (corner, rectangle) => ({
  left: corner.includes('e') ? rectangle.left + rectangle.width : rectangle.left,
  top: corner.includes('s') ? rectangle.top + rectangle.height : rectangle.top,
});

function GridSwipePreview({ appearance, assetsById, grid, onAssetDimensions, snapStep, worldViewport }) {
  if (!grid || !worldViewport) return null;
  return <>
    <LatticePixelGrid color={appearance.guideColor} field={worldViewport} guideInterval={snapStep}
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
      const imageRenderRectangle = projectSystemWorkflowImageRenderRectangle(
        imageRectangle && projectLatticeRasterBleedRectangle(imageRectangle, opening), transform,
      );
      return <div className="system-workflow__placement" data-cropped={Boolean(placement.crop) || undefined} key={placement.id}
        style={{ ...projected, zIndex: placement.layer + 1 }}>
        <span data-frame={placement.frameId} style={{ background: placement.backing.enabled ? placement.backing.color : 'transparent', padding: placement.mat.enabled ? '5%' : 0 }}>
          {src ? <ProgressiveArtworkImage asset={asset} onSourceLoad={(dimensions) => onAssetDimensions?.(asset, dimensions)}
            style={imageRenderRectangle ? { ...imageRenderRectangle,
              transform: renderedSystemWorkflowCssTransform(transform) } : undefined} /> : <em>Media</em>}
        </span>
      </div>;
    })}
  </>;
}

export default function OwnerSystemWorkflowCanvas({ assetsById, boardScale = 1, controller, crop, interactionDisabled = false, onAssetDimensions,
  onChangeGrid, onOpenViewer, onPlacementRef, reducedMotion = false, renderingMode = 'settled', resolveAssetDimensions,
  selectionOverlayHost, viewerPlacementId }) {
  const canvasRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const [dropFeedback, setDropFeedback] = useState(null);
  const [worldViewport, setWorldViewport] = useState(null);
  const retainedSelection = useRef(null);
  const grid = controller.selectedGrid;
  const worldCover = isSystemWorkflowWorldCoverGrid(grid);
  const artboardMode = worldCover ? OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES.HERO : OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES.GRID;
  const cropSession = crop?.cropSession || null;
  const appearance = controller.draft?.appearance;
  const snapStep = systemWorkflowSnapStep(appearance.guideSize);
  const viewScale = Number.isFinite(boardScale) && boardScale > 0 ? boardScale : 1;
  const viewerOpen = Boolean(viewerPlacementId);
  const adjacentGrid = (direction) => controller.draft && grid
    ? adjacentSystemWorkflowGridId(controller.draft, grid.id, direction)
    : null;
  const interaction = useOwnerSystemWorkflowPlacementInteraction({
    canvasRef, canNavigateGrid: adjacentGrid, controller, cropResize: crop?.cropResize, cropSession,
    disabled: interactionDisabled,
    onNavigateGrid: (direction, options) => {
      const gridId = adjacentGrid(direction);
      if (gridId) onChangeGrid?.(gridId, direction, options);
    },
    reducedMotion,
    snapStep,
    artboardMode, viewScale,
  });
  const swipeGridId = interaction.gridSwipe?.targetGridId || null;
  const swipeGrid = swipeGridId ? controller.draft.grids.find(({ id }) => id === swipeGridId) : null;
  const selectionNavigating = Boolean(interaction.gridSwipe);
  const swipeStyle = interaction.gridSwipe ? {
    '--workflow-grid-swipe-x': `${interaction.gridSwipe.deltaX / viewScale}px`,
    '--workflow-grid-swipe-side': interaction.gridSwipe.direction === 'next' ? '100%' : '-100%',
  } : undefined;
  const projectedPlacements = grid?.placements.map((placement) => ({ ...placement, ...(interaction.previewById.get(placement.id) || {}) })) || [];
  const selected = projectedPlacements.filter(({ id, locked }) => controller.selectedPlacementIds.includes(id) && !locked);
  const selectionBounds = boundsOf(selected);
  if (retainedSelection.current?.gridId !== grid?.id) retainedSelection.current = null;
  if (selectionBounds) retainedSelection.current = { bounds: selectionBounds, primary: selected.at(-1), count: selected.length, gridId: grid.id };
  const renderedSelection = retainedSelection.current;
  const selectionMetrics = renderedSelection && worldViewport
    ? screenPixelMetrics(projectedSelectionOutline(renderedSelection.bounds, worldViewport), viewScale)
    : null;

  useLayoutEffect(() => {
    const node = canvasRef.current;
    if (!node) return undefined;
    const measure = () => {
      const rectangle = { width: node.clientWidth, height: node.clientHeight };
      setWorldViewport(worldCover
        ? measureOwnerSystemWorkflowHeroArtboard(rectangle.width, rectangle.height)
        : measureOwnerSystemWorkflowArtboard(rectangle.width, rectangle.height));
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    globalThis.addEventListener?.('resize', measure);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', measure); };
  }, [renderingMode, worldCover]);

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
  return <section className="system-workflow__stage-content" aria-label={`${grid.title} Grid`} data-system-workflow-stage data-world-cover={worldCover || undefined}>
    <div ref={canvasRef} className="system-workflow__canvas" data-guide={appearance.guideMode} data-space-navigation={interaction.spaceNavigation || undefined} data-system-workflow-artboard data-swipe-direction={interaction.gridSwipe?.direction} data-swiping={Boolean(interaction.gridSwipe) || undefined} data-swipe-settling={interaction.gridSwipe?.settling || undefined} style={{ '--guide-color': appearance.guideColor, '--world-cell-size': worldViewport ? `${worldViewport.cellSize}px` : undefined, '--world-origin-x': worldViewport ? `${worldViewport.left}px` : undefined, '--world-origin-y': worldViewport ? `${worldViewport.top}px` : undefined, '--workflow-board-inverse-scale': 1 / viewScale, ...swipeStyle }}
      onPointerDown={(event) => { if (!cropSession) interaction.beginCanvasSelection(event); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={async (event) => {
        const asset = assetsById.get(event.dataTransfer.getData('application/x-inscape-asset'));
        if (!asset) return;
        const dimensions = await (resolveAssetDimensions || decodeOwnerSystemWorkflowAssetDimensions)(asset);
        if (!dimensions) return;
        const field = createOwnerSystemWorkflowProjectedField(canvasRef.current, snapStep, 1, artboardMode);
        if (!field || worldCover && !ownerSystemWorkflowProjectedFieldContainsPoint(field, { x: event.clientX, y: event.clientY })) {
          globalThis.dispatchEvent?.(new CustomEvent('inscape:system-workflow-drop-rejected'));
          return;
        }
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
        const imageRenderRectangle = projectSystemWorkflowImageRenderRectangle(
          imageRectangle && projectLatticeRasterBleedRectangle(imageRectangle, opening), transform,
        );
        return <div aria-disabled={placement.locked || undefined} aria-label={`Select ${asset?.title || asset?.name || 'artwork'}`} aria-pressed={isSelected}
          className="system-workflow__placement" data-cropped={Boolean(visibleCrop) || undefined} data-cropping={cropping || undefined} data-system-workflow-crop-surface={cropping || undefined} data-system-workflow-placement-id={placement.id} data-locked={placement.locked || undefined}
          data-viewing={viewerPlacementId === placement.id || undefined}
          key={placement.id} onClick={(event) => { if (!cropSession && !interaction.clickSuppressedRef.current && !placement.locked) controller.selectPlacement(placement.id, event.shiftKey); }}
          onDoubleClick={(event) => { if (cropSession || placement.locked) return; event.stopPropagation(); onOpenViewer?.(placement, event.currentTarget); }}
          onKeyDown={(event) => {
            if (cropSession || placement.locked) return;
            if (event.key === 'Enter') { event.preventDefault(); onOpenViewer?.(placement, event.currentTarget); return; }
            if (event.key !== ' ') return;
            event.preventDefault();
            controller.selectPlacement(placement.id, event.shiftKey);
          }}
          onPointerDown={(event) => { markOwnerSystemWorkflowPointerFocus(event.currentTarget); if (cropping) crop.beginCropDrag(event, placement.id, worldViewport.cellSize * viewScale); else if (!cropSession) interaction.beginPlacementGesture(event, placement); }} ref={(node) => onPlacementRef?.(placement.id, node)} role="button" tabIndex={placement.locked ? -1 : 0}
          style={{ ...projected, zIndex: placement.layer + 1 }}>
          <span data-frame={placement.frameId} style={{ background: placement.backing.enabled ? placement.backing.color : 'transparent', padding: placement.mat.enabled ? '5%' : 0 }}>
            {src ? <ProgressiveArtworkImage asset={asset} onSourceLoad={(dimensions) => onAssetDimensions?.(asset, dimensions)}
              style={imageRenderRectangle ? { ...imageRenderRectangle,
                transform: renderedSystemWorkflowCssTransform(transform) } : undefined} /> : <em>Media</em>}
          </span>
        </div>;
      })}
      {interaction.marquee && <i className="system-workflow__marquee" style={interaction.marquee} />}
      {worldCover && worldViewport && <div aria-hidden="true" className="system-workflow__world-cover-aperture"
        style={{ left: worldViewport.left, top: worldViewport.top, width: worldViewport.width, height: worldViewport.height }}>
        <span>INSCAPE HERO IMAGE · VISIBLE AREA 768 × 432 · 16:9</span>
      </div>}
      </div>
      {interaction.gridSwipe && swipeGrid && <div aria-hidden="true" className="system-workflow__grid-plane system-workflow__grid-plane--adjacent">
        <GridSwipePreview appearance={appearance} assetsById={assetsById} grid={swipeGrid}
          onAssetDimensions={onAssetDimensions} snapStep={snapStep} worldViewport={worldViewport} />
      </div>}
    </div>
    {selectionMetrics && selectionOverlayHost && createPortal(<div className="system-workflow__selection-chrome" aria-hidden={viewerOpen || !selectionBounds || selectionNavigating}
      data-cropping={Boolean(cropSession) || undefined} data-group={renderedSelection.count > 1 || undefined}
      data-navigating={selectionNavigating || undefined} data-selected={Boolean(selectionBounds) || undefined} data-viewing={viewerOpen || undefined}
      style={{ '--workflow-screen-pixel': `${selectionMetrics.screenPixel}px` }}>
      {['nw', 'ne', 'se', 'sw'].map((corner) => <button aria-label={`Resize selection from ${corner}`}
        className={`system-workflow__resize-handle is-${corner}`} disabled={viewerOpen || !selectionBounds || selectionNavigating}
        key={corner} onPointerDown={(event) => interaction.beginPlacementGesture(event, renderedSelection.primary, 'resize', corner)}
        type="button" style={screenHandlePoint(corner, selectionMetrics.rectangle)} />)}
    </div>, selectionOverlayHost)}
    <output aria-live="polite" className="system-workflow__drop-feedback" data-visible={Boolean(dropFeedback) || undefined}>{dropFeedback}</output>
  </section>;
}
