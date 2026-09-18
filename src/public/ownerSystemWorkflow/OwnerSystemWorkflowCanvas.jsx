import { placementMotionStyle } from '../../animation/placementMotion.js';
import useSceneMotion from '../../animation/useSceneMotion.js';
import { useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DisplayStageSizeContext } from './DisplayStageSizeContext.js';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import { createPortal } from 'react-dom';
import { nudgeSystemWorkflowResizeGeometry } from '../../systemWorkflow/systemWorkflowResize.js';
import { placementMediaRectangle } from '../../lattice/rendering/placementMediaRectangle.js';
import LatticePixelGrid from '../../lattice/rendering/LatticePixelGrid.jsx';
import { projectLatticeRasterBleedRectangle, projectLatticePixelRectangle } from '../../lattice/rendering/latticePixelGeometry.js';
import { createSystemWorkflowDropGeometry } from '../../systemWorkflow/systemWorkflowPlacement.js';
import { isSystemWorkflowWorldCoverGrid, systemWorkflowSnapStep, quantizeSystemWorkflowGridCoordinate } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { attachTextToDisplay } from '../../text/textTransfer.js';
import { displayTextLabel } from '../../systemWorkflow/domain/displayText.js';
import DisplayArticleEditor from '../../text/DisplayArticleEditor.jsx';
import { adjacentSystemWorkflowGridIdInOrder } from '../../systemWorkflow/domain/systemWorkflowNavigation.js';
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
import useArtworkPicking from './useArtworkPicking.js';
import { progressiveArtworkSources } from './progressiveArtworkSources.js';
import useGridPlayback from './useGridPlayback.js';
import { systemWorkflowPlacementRequest } from './systemWorkflowPlacementRequest.js';
import DisplayTextContent from './DisplayTextContent.jsx';

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
const screenHandlePoint = (corner, rectangle, width, height) => {
  const left = Math.max(14, Math.min(width - 42, rectangle.left));
  const top = Math.max(14, Math.min(height - 42, rectangle.top));
  const right = Math.max(left + 28, Math.min(width - 14, rectangle.left + rectangle.width));
  const bottom = Math.max(top + 28, Math.min(height - 14, rectangle.top + rectangle.height));
  return {
    left: corner === 'n' || corner === 's' ? (left + right) / 2 : corner.includes('e') ? right : left,
    top: corner === 'e' || corner === 'w' ? (top + bottom) / 2 : corner.includes('s') ? bottom : top,
  };
};

export default function OwnerSystemWorkflowCanvas({ assetsById, authoringLocked = false, boardScale = 1, controller, crop, interactionDisabled = false, onAssetDimensions,
  onChangeGrid, onOpenViewer, onPlacementRef, reducedMotion = false, renderingMode = 'settled', resolveAssetDimensions,
  placementTargetRef, selectionOverlayHost, viewerPlacementId, motionEnabled = false, motionPreview = false, playingGrids = false, onPauseGrids, onPlaybackTransitionChange, editingTextId, onEditText }) {
  const canvasRef = useRef(null);
  useSceneMotion(canvasRef);
  const feedbackTimerRef = useRef(null);
  const [dropFeedback, setDropFeedback] = useState(null);
  const [measuredViewport, setWorldViewport] = useState(null);
  const stageSize = useContext(DisplayStageSizeContext);
  const retainedSelection = useRef(null);
  const grid = controller.selectedGrid;
  const picking = useArtworkPicking(canvasRef, grid?.id + ':' + controller.draft.profileAddress);
  const pickPlacement = event => {
    const element = crop?.cropSession ? event.currentTarget : picking.pick(event, event.currentTarget.parentElement);
    const placement = grid?.placements.find(item => item.id === element?.dataset.systemWorkflowPlacementId);
    return placement ? { placement, element } : null;
  };
  const worldCover = isSystemWorkflowWorldCoverGrid(grid);
  const worldViewport = stageSize
    ? (worldCover ? measureOwnerSystemWorkflowHeroArtboard : measureOwnerSystemWorkflowArtboard)(stageSize.width, stageSize.height, 1, controller.draft.geometry)
    : measuredViewport;
  const artboardMode = worldCover ? OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES.HERO : OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES.GRID;
  const cropSession = crop?.cropSession || null;
  const appearance = controller.draft?.appearance;
  const snapStep = systemWorkflowSnapStep(appearance.guideSize);
  const viewScale = Number.isFinite(boardScale) && boardScale > 0 ? boardScale : 1;
  const viewerOpen = Boolean(viewerPlacementId);
  const placementContext = useMemo(() => ({}), [grid?.id, controller.draft.profileAddress, authoringLocked, interactionDisabled, playingGrids]);
  const currentPlacementContext = useRef(placementContext);
  currentPlacementContext.current = placementContext;
  useImperativeHandle(placementTargetRef, () => {
    const isCurrent = () => currentPlacementContext.current === placementContext
      && canvasRef.current?.isConnected && !authoringLocked && !interactionDisabled && !playingGrids;
    return {
      isCurrent,
      id: controller.moduleId,
      get label() { return `${canvasRef.current?.closest('.system-workflow__presentation-board')?.querySelector('.system-workflow__board-title')?.textContent || 'Display'} / ${grid?.title || 'Untitled Grid'}`; },
      get node() { return canvasRef.current; },
      previewTextAt: (point, rectangle, explicit = false) => {
        const canvas = canvasRef.current;
        if (!isCurrent() || !grid || grid.visibility !== 'PUBLIC' || !explicit && !canvas.contains(document.elementFromPoint(point.x, point.y))) return null;
        const field = createOwnerSystemWorkflowProjectedField(canvas, snapStep, viewScale, artboardMode);
        if (!field || !ownerSystemWorkflowProjectedFieldContainsPoint(field, point)) return null;
        const q = quantizeSystemWorkflowGridCoordinate;
        const destination = { column: q((rectangle.left - field.left) / field.cellSize), row: q((rectangle.top - field.top) / field.cellSize),
          columnSpan: q(rectangle.width / field.cellSize), rowSpan: q(rectangle.height / field.cellSize) };
        return { destination, cellSize: field.cellSize, rectangle: projectLatticePixelRectangle(destination, field), label: `Move into ${grid.title || 'Display'}` };
      },
      attachText: (expected, preview) => {
        if (!isCurrent()) throw new Error('Display is no longer available.');
        const id = attachTextToDisplay(controller.store, controller.draft.profileAddress, { expected, moduleId: controller.moduleId, gridId: grid.id, ...preview });
        controller.replaceSelection([id]); onEditText?.(id);
      },
      placeAsset: (asset, dimensions, destination = null) => isCurrent()
        && controller.placeAsset(systemWorkflowPlacementRequest(asset, dimensions, grid.id, destination)),
      previewAt: (point, dimensions, options = {}) => {
        const canvas = canvasRef.current;
        if (!isCurrent() || !dimensions || !canvas.contains(document.elementFromPoint(point.x, point.y))) return null;
        const field = createOwnerSystemWorkflowProjectedField(canvas, snapStep, viewScale, artboardMode);
        if (!field || worldCover && !ownerSystemWorkflowProjectedFieldContainsPoint(field, point)) return null;
        const destination = createSystemWorkflowDropGeometry(dimensions.width, dimensions.height, point, field, options);
        return { destination, rectangle: projectLatticePixelRectangle(destination, field) };
      },
    };
  });
  const gridOrder = useMemo(() => controller.draft.grids
    .filter((candidate) => !isSystemWorkflowWorldCoverGrid(candidate)).map(({ id }) => id), [controller.draft.grids]);
  const adjacentGrid = (direction) => controller.draft && grid
    ? adjacentSystemWorkflowGridIdInOrder(gridOrder, grid.id, direction)
    : null;
  const interaction = useOwnerSystemWorkflowPlacementInteraction({
    artboardMode, authoringDisabled: authoringLocked, canvasRef, canNavigateGrid: adjacentGrid, controller,
    cropResize: crop?.cropResize, cropSession, disabled: interactionDisabled,
    onNavigateGrid: (direction, options) => {
      const gridId = adjacentGrid(direction);
      if (gridId) onChangeGrid?.(gridId, direction, options);
    },
    reducedMotion,
    snapStep, viewScale,
  });
  const playback = useGridPlayback({ playing: playingGrids, enabled: !interactionDisabled && !cropSession && !worldCover && !interaction.gridSwipe,
    gridId: grid?.id, nextGridId: adjacentGrid('next'), canvasRef, viewScale, reducedMotion,
    onPause: onPauseGrids || (() => {}), onAdvance: onChangeGrid });
  const gridSwipe = interaction.gridSwipe || playback.swipe;
  const dropContext = useMemo(() => ({}), [grid?.id, controller.draft.profileAddress, authoringLocked, interactionDisabled, playingGrids, Boolean(gridSwipe)]);
  const currentDropContext = useRef(dropContext);
  currentDropContext.current = dropContext;
  const swipeSourceRef = useRef(grid?.id);
  if (!gridSwipe) swipeSourceRef.current = grid?.id;
  const sourceGridId = gridSwipe ? swipeSourceRef.current : grid?.id;
  useEffect(() => { onPlaybackTransitionChange?.(Boolean(playback.swipe)); }, [Boolean(playback.swipe), onPlaybackTransitionChange]);
  useEffect(() => () => onPlaybackTransitionChange?.(false), [onPlaybackTransitionChange]);
  const swipeGridId = gridSwipe?.targetGridId || null;
  // Keep neighboring media mounted outside the clipped Stage before a gesture.
  // A newly mounted image can miss the first paint even when its URL is cached.
  const previousGridId = adjacentGrid('previous');
  const nextGridId = adjacentGrid('next');
  // Continuous playback has no dwell at arrival. Warm the following scene
  // during the current slide, before it becomes the next visible neighbor.
  const playbackAheadId = playingGrids && nextGridId
    ? adjacentSystemWorkflowGridIdInOrder(gridOrder, nextGridId, 'next') : null;
  const renderedGrids = [...new Set([grid?.id, sourceGridId, previousGridId, nextGridId, playbackAheadId, swipeGridId].filter(Boolean))]
    .map((id) => controller.draft.grids.find((candidate) => candidate.id === id)).filter(Boolean);
  const selectionNavigating = Boolean(gridSwipe);
  const swipeStyle = gridSwipe ? {
    '--workflow-grid-swipe-x': `${gridSwipe.deltaX / viewScale}px`,
    '--workflow-grid-swipe-side': gridSwipe.direction === 'next' ? 'calc(100% - 1px)' : 'calc(-100% + 1px)',
  } : undefined;
  const projectedPlacements = grid?.placements.filter(({ id }) => !controller.hiddenPlacementIds?.has(id))
    .map((placement) => ({ ...placement, ...(interaction.previewById.get(placement.id) || {}) })) || [];
  const selected = projectedPlacements.filter(({ id, locked }) => controller.selectedPlacementIds.includes(id) && !locked);
  const selectionBounds = boundsOf(selected);
  if (retainedSelection.current?.gridId !== grid?.id || controller.hiddenPlacementIds?.has(retainedSelection.current?.primary?.id)) retainedSelection.current = null;
  if (selectionBounds) retainedSelection.current = { bounds: selectionBounds, primary: selected.at(-1), count: selected.length, gridId: grid.id };
  const renderedSelection = retainedSelection.current;
  const selectionMetrics = renderedSelection && worldViewport
    ? screenPixelMetrics(projectedSelectionOutline(renderedSelection.bounds, worldViewport), viewScale)
    : null;

  useLayoutEffect(() => {
    const node = canvasRef.current;
    if (!node || stageSize) return undefined;
    const measure = () => {
      const style = getComputedStyle(node);
      const rectangle = { width: parseFloat(style.width), height: parseFloat(style.height) };
      setWorldViewport(worldCover
        ? measureOwnerSystemWorkflowHeroArtboard(rectangle.width, rectangle.height)
        : measureOwnerSystemWorkflowArtboard(rectangle.width, rectangle.height, 1, controller.draft.geometry));
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    globalThis.addEventListener?.('resize', measure);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', measure); };
  }, [renderingMode, worldCover, Boolean(stageSize)]);

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
      const instance = canvasRef.current?.closest('[data-display-instance]');
      if (instance && !instance.hasAttribute('data-active-display')) return;
      if (event.target?.closest?.('[data-workbench-module]')) return;
      if (!grid || cropSession || interactionDisabled || viewerOpen || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)) return;
      if (event.key === 'Escape') { controller.replaceSelection([]); return; }
      if (authoringLocked || interactionDisabled || playingGrids || playback.swipe) return;
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
  }, [authoringLocked, controller, cropSession, grid, interaction, interactionDisabled, snapStep, viewerOpen, playingGrids, playback.swipe]);

  if (!grid) return null;
  return <section className="system-workflow__stage-content" aria-label={`${grid.title} Grid`} data-system-workflow-stage data-world-cover={worldCover || undefined}>
    <div ref={canvasRef} data-stage-columns={controller.draft.geometry.columns} data-stage-rows={controller.draft.geometry.rows} className="system-workflow__canvas" data-guide={appearance.guideMode} data-space-navigation={interaction.spaceNavigation || undefined} data-system-workflow-artboard data-swipe-direction={interaction.gridSwipe?.direction} data-swiping={Boolean(interaction.gridSwipe) || undefined} data-swipe-settling={interaction.gridSwipe?.settling || undefined} style={{ '--guide-color': appearance.guideColor, '--world-cell-size': worldViewport ? `${worldViewport.cellSize}px` : undefined, '--world-origin-x': worldViewport ? `${worldViewport.left}px` : undefined, '--world-origin-y': worldViewport ? `${worldViewport.top}px` : undefined, '--workflow-board-inverse-scale': 1 / viewScale, ...swipeStyle }}
      onLoadCapture={picking.onLoadCapture}
      onClick={(event) => {
        if (cropSession || interaction.clickSuppressedRef.current || event.target.closest?.('[data-system-workflow-placement-id]')) return;
        controller.replaceSelection([]);
      }}
      onPointerDownCapture={(event) => {
        if (playingGrids || playback.swipe) {
          event.preventDefault(); event.stopPropagation(); playback.stop();
          return;
        }
        if (authoringLocked && !cropSession) interaction.beginCanvasSelection(event, { navigationOnly: true });
      }}
      onPointerDown={(event) => { if (!cropSession) interaction.beginCanvasSelection(event); }}
      onDragOver={(event) => { if (!authoringLocked) event.preventDefault(); }}
      onDrop={async (event) => {
        if (authoringLocked || interactionDisabled || playingGrids || gridSwipe) return;
        const point = { x: event.clientX, y: event.clientY };
        const asset = assetsById.get(event.dataTransfer.getData('application/x-inscape-asset'));
        if (!asset) return;
        let dimensions;
        try { dimensions = await (resolveAssetDimensions || decodeOwnerSystemWorkflowAssetDimensions)(asset); } catch { return; }
        if (!dimensions || !canvasRef.current?.isConnected || currentDropContext.current !== dropContext) return;
        const field = createOwnerSystemWorkflowProjectedField(canvasRef.current, snapStep, 1, artboardMode);
        if (!field || worldCover && !ownerSystemWorkflowProjectedFieldContainsPoint(field, point)) {
          globalThis.dispatchEvent?.(new CustomEvent('inscape:system-workflow-drop-rejected'));
          return;
        }
        controller.placeAsset(systemWorkflowPlacementRequest(asset, dimensions, grid.id,
          createSystemWorkflowDropGeometry(dimensions.width, dimensions.height, point, field)));
      }}>
      <div className="system-workflow__grid-track">
      {renderedGrids.map((scene) => {
        const active = scene.id === grid.id;
        const source = scene.id === sourceGridId;
        const incoming = scene.id === swipeGridId;
        const scenePlacements = active ? projectedPlacements : scene.placements.filter(({ id }) => !controller.hiddenPlacementIds?.has(id));
        return <div key={scene.id} aria-hidden={!active || undefined} inert={active ? undefined : ''}
          data-preview-grid-id={active ? undefined : scene.id} data-rendered-grid-id={scene.id}
          className={`system-workflow__grid-plane system-workflow__grid-plane--${source ? 'current' : 'adjacent'}`}
          style={{ visibility: source || incoming ? 'visible' : 'hidden',
            left: source ? 0 : incoming ? undefined : scene.id === previousGridId ? 'calc(-100% + 1px)' : 'calc(100% - 1px)' }}>
      {worldViewport && <LatticePixelGrid color={appearance.guideColor} field={worldViewport} guideInterval={snapStep}
        height={worldViewport.height} mode={appearance.guideMode} width={worldViewport.width} />}
      <div className="system-workflow__artwork-plane">
      {scenePlacements.slice().sort((left, right) => left.layer - right.layer).map((placement) => {
        const asset = assetForPlacement(assetsById.get(placement.stableAssetId), placement);
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
        const imageRectangle = dimensions && placementMediaRectangle(opening, transform.dimensions, transform.crop, placement.mediaFrameRatio);
        const imageRenderRectangle = projectSystemWorkflowImageRenderRectangle(
          imageRectangle && projectLatticeRasterBleedRectangle(imageRectangle, opening), transform,
        );
        const textEditing = active && placement.kind === 'text' && editingTextId === placement.id && !authoringLocked;
        return <div aria-disabled={placement.locked || undefined} aria-label={`Select ${placement.kind === 'text' ? displayTextLabel(placement.text) : asset?.title || asset?.name || 'artwork'}`} aria-pressed={isSelected}
          className="system-workflow__placement" data-cropped={Boolean(visibleCrop) || undefined} data-cropping={cropping || undefined} data-system-workflow-crop-surface={cropping || undefined} data-system-workflow-placement-id={active ? placement.id : undefined} data-locked={placement.locked || undefined}
          data-viewing={viewerPlacementId === placement.id || undefined}
          key={placement.id} onClick={(event) => {
            if (event.target.closest('.text-editor-page, .text-tools-window, .display-text-edit-actions')) { event.stopPropagation(); return; }
            if (cropSession || interactionDisabled || interaction.clickSuppressedRef.current) return;
            const hit = pickPlacement(event);
            event.stopPropagation();
            if (!hit) { controller.replaceSelection([]); return; }
            if (!hit.placement.locked) controller.selectPlacement(hit.placement.id, event.shiftKey);
          }}
          onDoubleClick={(event) => {
            if (event.target.closest('.text-editor-page, .text-tools-window')) return;
            if (cropSession || interactionDisabled) return;
            event.stopPropagation();
            const hit = pickPlacement(event);
            if (hit && !hit.placement.locked) { if (hit.placement.kind === 'text') onEditText?.(hit.placement.id); else onOpenViewer?.(hit.placement, hit.element); }
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (cropSession || placement.locked) return;
            if (event.key === 'Enter') { event.preventDefault(); if (placement.kind === 'text') { controller.selectPlacement(placement.id); onEditText?.(placement.id); } else onOpenViewer?.(placement, event.currentTarget); return; }
            if (event.key !== ' ') return;
            event.preventDefault();
            controller.selectPlacement(placement.id, event.shiftKey);
          }}
          onPointerDown={(event) => {
            if (event.target.closest('.text-editor-page, .text-tools-window, .display-text-edit-actions')) { event.stopPropagation(); return; }
            if (interactionDisabled) return;
            const hit = pickPlacement(event);
            if (!hit) {
              interaction.beginCanvasSelection(event, { emptyArtworkHit: true });
              return;
            }
            markOwnerSystemWorkflowPointerFocus(hit.element);
            if (hit.element !== event.currentTarget) { event.preventDefault(); hit.element.focus({ preventScroll: true }); }
            if (authoringLocked) return;
            if (cropping) crop.beginCropDrag(event, placement.id, worldViewport.cellSize * viewScale);
            else if (!cropSession) interaction.beginPlacementGesture(event, hit.placement);
          }} ref={active ? (node) => onPlacementRef?.(placement.id, node) : undefined} role="button" tabIndex={!active || placement.locked ? -1 : 0}
          data-placement-motion={placement.animation ? '' : undefined}
          style={{ ...projected, zIndex: placement.layer + 1, ...placementMotionStyle(placement.animation, worldViewport.cellSize, motionEnabled && (source || incoming)) }}>
          {textEditing ? <DisplayArticleEditor key={`${grid.id}:${placement.id}`} placement={placement} controller={controller} cellSize={worldViewport.cellSize}
            screenCellSize={worldViewport.cellSize * viewScale} canvasRef={canvasRef} onClose={() => onEditText?.(null)} />
            : placement.kind === 'text' ? <DisplayTextContent placement={placement} cellSize={worldViewport.cellSize} /> : <span data-frame={placement.frameId} style={{ background: placement.backing.enabled ? placement.backing.color : 'transparent', padding: placement.mat.enabled ? '5%' : 0 }}>
            {src ? <ProgressiveArtworkImage asset={asset} onSourceLoad={(dimensions) => onAssetDimensions?.(asset, dimensions)}
              style={imageRenderRectangle ? { ...imageRenderRectangle,
                transform: renderedSystemWorkflowCssTransform(transform) } : undefined} /> : <em>Media</em>}
          </span>}
        </div>;
      })}
      </div>
      {active && interaction.marquee && <i className="system-workflow__marquee" style={interaction.marquee} />}
      {active && worldCover && worldViewport && <div aria-hidden="true" className="system-workflow__world-cover-aperture"
        style={{ left: worldViewport.left, top: worldViewport.top, width: worldViewport.width, height: worldViewport.height }}>
        <span>INSCAPE HERO IMAGE · VISIBLE AREA 768 × 432 · 16:9</span>
      </div>}
      </div>;
      })}
      </div>
    </div>
    {!authoringLocked && !motionPreview && selectionMetrics && selectionOverlayHost && createPortal(<div className="system-workflow__selection-chrome" aria-hidden={viewerOpen || !selectionBounds || selectionNavigating}
      data-cropping={Boolean(cropSession) || undefined} data-group={renderedSelection.count > 1 || undefined}
      data-navigating={selectionNavigating || undefined} data-selected={Boolean(selectionBounds) || undefined} data-viewing={viewerOpen || undefined}
      style={{ '--workflow-screen-pixel': `${selectionMetrics.screenPixel}px` }}>
      {['nw', 'ne', 'se', 'sw', ...(renderedSelection.count > 1 || cropSession ? [] : ['n', 'e', 's', 'w'])].map((corner) => <button aria-label={`Resize selection from ${corner}`}
        className={`system-workflow__resize-handle is-${corner}`} disabled={authoringLocked || viewerOpen || !selectionBounds || selectionNavigating}
        key={corner} onPointerDown={(event) => interaction.beginPlacementGesture(event, renderedSelection.primary, 'resize', corner)}
        onKeyDown={event => {
          if (renderedSelection.count !== 1 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const step = event.altKey ? 1 / 9 : 1;
          const destination = nudgeSystemWorkflowResizeGeometry(renderedSelection.primary, corner, {
            column: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
            row: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
          });
          if (destination) controller.run(session => session.resizePlacement({ gridId: grid.id,
            placementId: renderedSelection.primary.id, expectedPlacement: renderedSelection.primary, destination, corner }));
        }}
        type="button" title="Resize artwork · Shift keeps proportions · Alt for fine adjustment" style={screenHandlePoint(corner, selectionMetrics.rectangle, selectionOverlayHost.clientWidth, selectionOverlayHost.clientHeight)} />)}
    </div>, selectionOverlayHost)}
    <output aria-live="polite" className="system-workflow__drop-feedback" data-visible={Boolean(dropFeedback) || undefined}>{dropFeedback}</output>
  </section>;
}
