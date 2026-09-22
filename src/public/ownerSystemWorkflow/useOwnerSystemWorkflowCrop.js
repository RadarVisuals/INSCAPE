import { useEffect, useRef, useState } from 'react';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import {
  createSystemWorkflowCropPanGesture,
  createSystemWorkflowCropSession,
  nudgeSystemWorkflowCrop,
  reframeSystemWorkflowCropForMask,
  setSystemWorkflowCropZoom,
  systemWorkflowCropMask,
  updateSystemWorkflowCropPanGesture,
} from '../../systemWorkflow/systemWorkflowCrop.js';
import { cropFocusBounds } from '../../lattice/rendering/latticeCrop.js';
import { projectSystemWorkflowTransform, unprojectSystemWorkflowCrop } from '../../systemWorkflow/systemWorkflowTransform.js';
import { ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';
import { sameSystemWorkflowPlacementSnapshot } from '../../systemWorkflow/systemWorkflowRemoval.js';

const mediaFor = (placement, assetsById) => {
  const asset = assetForPlacement(assetsById.get(placement?.stableAssetId), placement);
  const dimensions = ownerSystemWorkflowAssetDimensions(asset);
  return placement && Number.isSafeInteger(dimensions?.width) && Number.isSafeInteger(dimensions?.height)
    ? { stableAssetId: placement.stableAssetId, ...dimensions }
    : null;
};

export default function useOwnerSystemWorkflowCrop({ assetsById, controller }) {
  const [cropSession, setCropSession] = useState(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const operationRef = useRef(0);
  const sessionRef = useRef(null);
  sessionRef.current = cropSession;
  const commit = (crop) => {
    const current = sessionRef.current;
    if (!current) return false;
    const placement = controller.selectedGrid?.placements.find(({ id }) => id === current.placementId);
    const currentMedia = mediaFor(placement, assetsById);
    const committed = placement && currentMedia && current.gridId === controller.selectedGrid?.id
      && current.moduleId === controller.moduleId ? controller.run((session) => session.cropPlacement({
      gridId: controller.selectedGrid.id,
      placementId: placement.id,
      expectedPlacement: current.expectedPlacement,
      media: currentMedia,
      expectedMedia: current.expectedMedia,
      crop,
    })) : false;
    cancelCrop();
    return committed;
  };
  const beginCrop = (placement) => {
    cancelCrop();
    const media = mediaFor(placement, assetsById);
    if (!placement || placement.locked || !media) return;
    const session = createSystemWorkflowCropSession(placement, media);
    const transform = { ...placement.transform };
    const visual = projectSystemWorkflowTransform(transform, media, session.previewCrop);
    const rendered = cropFocusBounds(session.mask, visual.dimensions, visual.crop.zoom).renderedSize;
    const next = { ...session, operationId: ++operationRef.current, gridId: controller.selectedGrid.id, moduleId: controller.moduleId,
      expectedPlacement: structuredClone(placement), controlZoom: visual.crop.zoom, renderedScaleAtZoomOne: rendered.width / visual.dimensions.width / visual.crop.zoom,
      expectedMedia: { ...media }, geometry: { column: placement.column, row: placement.row, columnSpan: placement.columnSpan, rowSpan: placement.rowSpan },
      interacted: false, transform };
    sessionRef.current = next;
    setCropSession(next);
  };
  const cropResize = {
    begin: () => {
      resizeRef.current = sessionRef.current ? structuredClone(sessionRef.current) : null;
    },
    preview: (placement) => {
      const start = resizeRef.current;
      if (!start || placement?.id !== start.placementId || sessionRef.current?.operationId !== start.operationId) return;
      const nextMask = systemWorkflowCropMask(placement);
      const visual = projectSystemWorkflowTransform(start.transform, start.media, start.previewCrop);
      const visualMedia = { ...visual.dimensions, stableAssetId: start.media.stableAssetId };
      const previewCrop = reframeSystemWorkflowCropForMask(visual.crop, visualMedia, start.mask, nextMask, {
        originDelta: { x: placement.column - start.geometry.column, y: placement.row - start.geometry.row },
        renderedScale: start.renderedScaleAtZoomOne * start.controlZoom,
      });
      setCropSession({
        ...start,
        geometry: { column: placement.column, row: placement.row, columnSpan: placement.columnSpan, rowSpan: placement.rowSpan },
        mask: nextMask,
        previewCrop: unprojectSystemWorkflowCrop(start.transform, previewCrop),
        interacted: true,
        dirty: true,
      });
    },
    finish: ({ cancelled = false } = {}) => {
      const start = resizeRef.current;
      if (!start || sessionRef.current?.operationId !== start.operationId) return;
      if (cancelled) { setCropSession(start); resizeRef.current = null; }
      else resizeRef.current = { ...start, awaitingCommit: true };
    },
  };
  const cancelCrop = () => {
    cleanupDrag(); resizeRef.current = null; sessionRef.current = null;
    setCropSession(null);
  };
  const applyCrop = () => sessionRef.current ? commit({ ...sessionRef.current.previewCrop }) : false;
  const restoreNativeFit = () => commit(null);
  const updateCropZoom = (zoom) => setCropSession((current) => {
    if (!current) return current;
    const visual = projectSystemWorkflowTransform(current.transform, current.media, current.previewCrop);
    const visualMedia = { ...visual.dimensions, stableAssetId: current.media.stableAssetId };
    const coverScale = Math.max(current.mask.width / visualMedia.width, current.mask.height / visualMedia.height);
    const previewCrop = setSystemWorkflowCropZoom(visual.crop, visualMedia, current.mask, current.renderedScaleAtZoomOne * zoom / coverScale);
    return { ...current, controlZoom: zoom, dirty: true, interacted: true, previewCrop: unprojectSystemWorkflowCrop(current.transform, previewCrop) };
  });
  const nudge = (delta) => setCropSession((current) => {
    if (!current) return current;
    const visual = projectSystemWorkflowTransform(current.transform, current.media, current.previewCrop);
    const visualMedia = { ...visual.dimensions, stableAssetId: current.media.stableAssetId };
    const previewCrop = nudgeSystemWorkflowCrop(visual.crop, visualMedia, current.mask, delta);
    return { ...current, dirty: true, interacted: true, previewCrop: unprojectSystemWorkflowCrop(current.transform, previewCrop) };
  });

  const cleanupDrag = () => {
    const active = dragRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    dragRef.current = null;
  };
  const beginCropDrag = (event, placementId, cellSize) => {
    const current = sessionRef.current;
    if (!current || current.placementId !== placementId || event.button !== 0 || !Number.isFinite(cellSize) || cellSize <= 0) return;
    cleanupDrag();
    event.preventDefault();
    event.stopPropagation();
    const placement = controller.selectedGrid?.placements.find(item => item.id === placementId);
    const stretchX = placement?.mediaFrameRatio === undefined ? 1 : placement.rowSpan * placement.mediaFrameRatio / placement.columnSpan;
    const point = { x: event.clientX / cellSize * stretchX, y: event.clientY / cellSize };
    const visual = projectSystemWorkflowTransform(current.transform, current.media, current.previewCrop);
    const active = { pointerId: event.pointerId, transform: current.transform, gesture: createSystemWorkflowCropPanGesture({ ...current, media: visual.dimensions, previewCrop: visual.crop }, point) };
    const move = (pointerEvent) => {
      if (pointerEvent.pointerId !== active.pointerId || sessionRef.current?.operationId !== current.operationId) return;
      pointerEvent.preventDefault();
      active.gesture = updateSystemWorkflowCropPanGesture(active.gesture, { x: pointerEvent.clientX / cellSize * stretchX, y: pointerEvent.clientY / cellSize }, 10 / cellSize);
      if (active.gesture.activated) setCropSession((session) => session?.operationId === current.operationId ? {
        ...session,
        dirty: true,
        interacted: true,
        previewCrop: unprojectSystemWorkflowCrop(active.transform, active.gesture.previewCrop),
      } : session);
    };
    const finish = (pointerEvent) => { if (pointerEvent.pointerId === active.pointerId) cleanupDrag(); };
    const cancel = (pointerEvent) => { if (pointerEvent.pointerId === active.pointerId) cleanupDrag(); };
    Object.assign(active, { move, finish, cancel });
    dragRef.current = active;
    globalThis.addEventListener('pointermove', move, true);
    globalThis.addEventListener('pointerup', finish, true);
    globalThis.addEventListener('pointercancel', cancel, true);
  };

  useEffect(() => {
    if (!cropSession) return undefined;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing || event.target?.isContentEditable
        || event.target?.closest?.('input, textarea, select, [role="textbox"]')) return;
      if (event.target?.closest?.('[data-workbench-module]')) return;
      // Dock controls retain their native keyboard behavior (range, buttons,
      // and movable header). Escape still ends this module's crop.
      if (event.key !== 'Escape' && event.target?.closest?.('[data-context-tools]')) return;
      if (event.key === 'Escape') cancelCrop();
      else if (event.key === 'Enter') applyCrop();
      else if (event.key.startsWith('Arrow')) {
        const step = event.shiftKey ? 0.05 : 0.01;
        nudge({ x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 });
      } else return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
    };
    const onPointerDown = (event) => {
      const display = event.target?.closest?.('[data-display-instance]');
      if (display && display.dataset.displayInstance !== controller.moduleId) { cancelCrop(); return; }
      if (event.target?.closest?.('[data-workbench-module]')) return;
      if (event.target?.closest?.('[data-context-tools]')) return;
      if (event.target?.closest?.('[data-system-workflow-crop-surface], .system-workflow__crop-controls, .system-workflow__resize-handle')) return;
      const placementId = event.target?.closest?.('[data-system-workflow-placement-id]')?.dataset?.systemWorkflowPlacementId;
      const placement = controller.selectedGrid?.placements.find(({ id }) => id === placementId);
      if (placement && placement.id !== sessionRef.current?.placementId && !placement.locked && mediaFor(placement, assetsById)) {
        applyCrop();
        controller.replaceSelection([placement.id]);
        beginCrop(placement);
        return;
      }
      applyCrop();
      controller.replaceSelection([]);
    };
    globalThis.addEventListener('keydown', onKeyDown, true);
    globalThis.addEventListener('pointerdown', onPointerDown, true);
    return () => { globalThis.removeEventListener('keydown', onKeyDown, true); globalThis.removeEventListener('pointerdown', onPointerDown, true); };
  }, [cropSession]);

  useEffect(() => {
    if (!cropSession) return;
    // Pointer preview is ahead of canonical placement geometry until pointer-up.
    // Reconciliation here would undo the live reframe and cause a visible jump
    // when the resize transaction commits.
    if (resizeRef.current && !resizeRef.current.awaitingCommit) return;
    const placement = controller.selectedGrid?.placements.find(({ id }) => id === cropSession.placementId);
    if (!placement || cropSession.gridId !== controller.selectedGrid?.id || cropSession.moduleId !== controller.moduleId) { cancelCrop(); return; }
    if (sameSystemWorkflowPlacementSnapshot(placement, cropSession.expectedPlacement)) {
      if (resizeRef.current?.awaitingCommit) {
        setCropSession(resizeRef.current); resizeRef.current = null;
      }
      return;
    }
    // Only the resize initiated by this crop may advance its baseline. Other
    // edits (including crop, transform, media or lock changes) end the preview.
    const resizedBaseline = { ...cropSession.expectedPlacement, ...cropSession.geometry };
    if (resizedBaseline.mediaFrameRatio === undefined && placement.mediaFrameRatio !== undefined
      && placement.mediaFrameRatio === cropSession.expectedPlacement.columnSpan / cropSession.expectedPlacement.rowSpan) {
      resizedBaseline.mediaFrameRatio = placement.mediaFrameRatio;
    }
    if (!resizeRef.current?.awaitingCommit || !sameSystemWorkflowPlacementSnapshot(placement, resizedBaseline)) {
      cancelCrop(); return;
    }
    resizeRef.current = null;
    const nextMask = systemWorkflowCropMask(placement);
    setCropSession((current) => {
      if (!current) return current;
      const visual = projectSystemWorkflowTransform(current.transform, current.media, current.previewCrop);
      const visualMedia = { ...visual.dimensions, stableAssetId: current.media.stableAssetId };
      const previewCrop = reframeSystemWorkflowCropForMask(visual.crop, visualMedia, current.mask, nextMask, {
        originDelta: { x: placement.column - current.geometry.column, y: placement.row - current.geometry.row },
        renderedScale: current.renderedScaleAtZoomOne * current.controlZoom,
      });
      return { ...current, expectedPlacement: structuredClone(placement), geometry: { column: placement.column, row: placement.row, columnSpan: placement.columnSpan, rowSpan: placement.rowSpan },
        mask: nextMask, previewCrop: unprojectSystemWorkflowCrop(current.transform, previewCrop), interacted: true, dirty: true };
    });
  }, [controller.generation, controller.selectedGrid, cropSession]);

  useEffect(() => { cancelCrop(); }, [controller.store, controller.moduleId]);
  useEffect(() => () => { cleanupDrag(); resizeRef.current = null; sessionRef.current = null; }, []);
  return { applyCrop, beginCrop, beginCropDrag, cancelCrop, cropResize, cropSession, restoreNativeFit, updateCropZoom };
}
