import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Crop, Trash2 } from 'lucide-react';
import {
  createLatticeProductionTableRenderModel,
  projectLatticeProductionPlacement,
  projectLatticeProductionViewport,
} from '../rendering/latticeProductionProjection.js';
import { createLatticeProductionLayerRanks } from '../rendering/latticeProductionLayerOrder.js';
import {
  LATTICE_PRODUCTION_CROP_MAX_ZOOM,
  LATTICE_PRODUCTION_CROP_MIN_ZOOM,
  LATTICE_PRODUCTION_CROP_ZOOM_STEP,
  createLatticeProductionCropPanGesture,
  createLatticeProductionCropSession,
  finishLatticeProductionCropPanGesture,
  latticeProductionCropMask,
  nudgeLatticeProductionCrop,
  setLatticeProductionCropZoom,
  updateLatticeProductionCropPanGesture,
} from './latticeProductionCrop.js';
import {
  createLatticeProductionMovementGesture,
  finishLatticeProductionMovementGesture,
  nudgeLatticeProductionPlacementGeometry,
  updateLatticeProductionMovementGesture,
} from './latticeProductionMovement.js';
import {
  LATTICE_PRODUCTION_RESIZE_CORNERS,
  createLatticeProductionResizeGesture,
  finishLatticeProductionResizeGesture,
  latticeProductionPlacementBoundaries,
  nudgeLatticeProductionResizeGeometry,
  updateLatticeProductionResizeGesture,
} from './latticeProductionResize.js';
import {
  LATTICE_PRODUCTION_LAYER_OPERATIONS,
  latticeProductionLayerOperationAvailability,
  latticeProductionPlacementToolbarDock,
  latticeProductionLayerTopologySnapshot,
} from './latticeProductionLayer.js';
import './latticeProductionMovementLayer.css';

const KEYBOARD_DELTAS = Object.freeze({
  ArrowDown: Object.freeze({ column: 0, row: 1 }),
  ArrowLeft: Object.freeze({ column: -1, row: 0 }),
  ArrowRight: Object.freeze({ column: 1, row: 0 }),
  ArrowUp: Object.freeze({ column: 0, row: -1 }),
});
const CORNER_LABELS = Object.freeze({
  nw: 'north-west', ne: 'north-east', se: 'south-east', sw: 'south-west',
});
const LAYER_ACTIONS = Object.freeze([
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.BACK, accessible: 'Send placement to back', Icon: ChevronsDown }),
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.BACKWARD, accessible: 'Move placement backward', Icon: ChevronDown }),
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.FORWARD, accessible: 'Move placement forward', Icon: ChevronUp }),
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT, accessible: 'Bring placement to front', Icon: ChevronsUp }),
]);

function PlacementActionIcon({ Icon, tooltipId, tooltip }) {
  return <><Icon aria-hidden="true" /><span className="lattice-production-placement-tooltip" id={tooltipId} role="tooltip">{tooltip}</span></>;
}

function viewportOf(node) {
  return { width: Math.max(0, node?.clientWidth || 0), height: Math.max(0, node?.clientHeight || 0) };
}

function rectangleStyle(rectangle) {
  return { left: rectangle.left, top: rectangle.top, width: rectangle.width, height: rectangle.height };
}

function localPointerPoint(event, node) {
  const bounds = node?.getBoundingClientRect();
  if (!bounds) return null;
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

export function orderedVisibleMovementPlacements(table) {
  return (Array.isArray(table?.placements) ? table.placements : [])
    .filter((placement) => placement.visibility === 'PUBLIC')
    .sort((left, right) => left.navigationOrder - right.navigationOrder || left.id.localeCompare(right.id));
}

export default function LatticeProductionMovementLayer({
  acceptedTable,
  lattice,
  onCommitMove,
  onCommitRemove,
  onCommitResize,
  onCommitCrop,
  onCommitLayer,
  onCropModeChange,
  onPreviewOperation,
  onReturnFocus,
  tableId,
}) {
  const rootRef = useRef(null);
  const controlRefs = useRef(new Map());
  const gestureRef = useRef(null);
  const emptyActivationBlockedUntilRef = useRef(0);
  const fieldRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);
  const [cropSession, setCropSession] = useState(null);
  const model = useMemo(() => createLatticeProductionTableRenderModel(lattice, tableId), [lattice, tableId]);
  const field = viewport.width > 0 && viewport.height > 0
    ? projectLatticeProductionViewport(model, viewport)
    : null;
  fieldRef.current = field;
  const acceptedById = useMemo(() => new Map(
    (acceptedTable?.placements || []).map((placement) => [placement.id, placement]),
  ), [acceptedTable]);
  const placements = useMemo(() => orderedVisibleMovementPlacements(model.table), [model.table]);
  const layerRanks = useMemo(() => createLatticeProductionLayerRanks(placements), [placements]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const update = () => setViewport(viewportOf(node));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selectedPlacementId && !acceptedById.has(selectedPlacementId)) setSelectedPlacementId(null);
  }, [acceptedById, selectedPlacementId]);

  useEffect(() => () => onCropModeChange?.(false), [onCropModeChange]);

  useEffect(() => {
    if (!field?.cellSize) return;
    setCropSession((current) => {
      if (!current || current.cellSize === field.cellSize) return current;
      const acceptedPlacement = acceptedById.get(current.placementId);
      if (!acceptedPlacement) return current;
      const mask = latticeProductionCropMask(acceptedPlacement);
      return {
        ...current,
        cellSize: field.cellSize,
        mask: {
          left: mask.left * field.cellSize,
          top: mask.top * field.cellSize,
          width: mask.width * field.cellSize,
          height: mask.height * field.cellSize,
        },
      };
    });
  }, [acceptedById, field?.cellSize]);

  const controlKey = (placementId, suffix = 'move') => `${placementId}:${suffix}`;
  const restoreFocus = (key) => queueMicrotask(() => {
    controlRefs.current.get(key)?.focus({ preventScroll: true });
  });

  const releaseCapture = (pointerId) => {
    const root = rootRef.current;
    if (root?.hasPointerCapture?.(pointerId)) root.releasePointerCapture(pointerId);
  };

  const cancelGesture = () => {
    const active = gestureRef.current;
    if (!active) return false;
    gestureRef.current = null;
    emptyActivationBlockedUntilRef.current = performance.now() + 250;
    if (active.kind === 'crop') {
      setCropSession(active.session);
      onPreviewOperation?.({ kind: 'crop', request: active.session.request });
    } else onPreviewOperation?.(null);
    releaseCapture(active.pointerId);
    restoreFocus(active.focusKey);
    return true;
  };

  const handlePointerDown = (event) => {
    const cropSurface = event.target.closest?.('[data-lattice-crop-surface]');
    if (cropSession && cropSurface && event.button === 0
      && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      cropSurface.focus({ preventScroll: true });
      try {
        const gesture = createLatticeProductionCropPanGesture(
          cropSession,
          localPointerPoint(event, event.currentTarget),
        );
        event.currentTarget.setPointerCapture(event.pointerId);
        gestureRef.current = {
          focusKey: controlKey(cropSession.placementId, 'crop-surface'),
          kind: 'crop',
          pointerId: event.pointerId,
          session: cropSession,
          gesture,
        };
      } catch { /* Invalid runtime projection remains non-authoring. */ }
      return;
    }
    if (event.target.closest?.('[data-lattice-placement-action]')) return;
    const control = event.target.closest?.('[data-lattice-placement-control]');
    if (cropSession || !control || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    const placementId = control.dataset.placementId;
    const acceptedPlacement = acceptedById.get(placementId);
    const corner = control.dataset.resizeCorner || null;
    setSelectedPlacementId(placementId);
    control.focus({ preventScroll: true });
    if (!acceptedPlacement || acceptedPlacement.locked || !fieldRef.current) return;
    let gesture;
    try {
      gesture = corner
        ? createLatticeProductionResizeGesture(
          acceptedPlacement,
          corner,
          fieldRef.current,
          localPointerPoint(event, event.currentTarget),
        )
        : createLatticeProductionMovementGesture(
          acceptedPlacement,
          fieldRef.current,
          localPointerPoint(event, event.currentTarget),
        );
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    gestureRef.current = {
      expectedPlacement: structuredClone(acceptedPlacement),
      focusKey: controlKey(placementId, corner || 'move'),
      kind: corner ? 'resize' : 'move',
      pointerId: event.pointerId,
      tableId,
      gesture,
    };
  };

  const handlePointerMove = (event) => {
    const active = gestureRef.current;
    if (!active || active.pointerId !== event.pointerId || !fieldRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const point = localPointerPoint(event, event.currentTarget);
    const gesture = active.kind === 'crop'
      ? updateLatticeProductionCropPanGesture(active.gesture, point)
      : active.kind === 'resize'
      ? updateLatticeProductionResizeGesture(active.gesture, point, fieldRef.current)
      : updateLatticeProductionMovementGesture(active.gesture, point, fieldRef.current);
    gestureRef.current = { ...active, gesture };
    if (active.kind === 'crop' && gesture.activated) {
      const next = {
        ...active.session,
        dirty: true,
        previewCrop: { ...gesture.previewCrop },
      };
      next.request = { ...next.request, crop: { ...next.previewCrop } };
      setCropSession(next);
      onPreviewOperation?.({ kind: 'crop', request: next.request });
      return;
    }
    if (gesture.activated) {
      const common = {
        tableId: active.tableId,
        placementId: gesture.placementId,
        destination: { ...gesture.previewGeometry },
      };
      onPreviewOperation?.(active.kind === 'resize' ? {
        kind: 'resize',
        request: {
          ...common,
          corner: gesture.corner,
          expectedPlacement: structuredClone(active.expectedPlacement),
        },
      } : {
        kind: 'move',
        request: { ...common, expectedStartGeometry: { ...gesture.startGeometry } },
      });
    }
  };

  const handlePointerUp = (event) => {
    const active = gestureRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    gestureRef.current = null;
    emptyActivationBlockedUntilRef.current = performance.now() + 250;
    const result = active.kind === 'crop'
      ? finishLatticeProductionCropPanGesture(active.gesture)
      : active.kind === 'resize'
      ? finishLatticeProductionResizeGesture(active.gesture)
      : finishLatticeProductionMovementGesture(active.gesture);
    if (active.kind === 'crop' && result.changed) {
      const next = { ...active.session, dirty: true, previewCrop: { ...result.crop } };
      next.request = { ...next.request, crop: { ...next.previewCrop } };
      setCropSession(next);
      onPreviewOperation?.({ kind: 'crop', request: next.request });
    }
    if (result.committed && active.kind === 'resize') onCommitResize?.({
      tableId: active.tableId,
      placementId: active.gesture.placementId,
      expectedPlacement: structuredClone(active.expectedPlacement),
      corner: active.gesture.corner,
      destination: result.geometry,
    });
    if (result.committed && active.kind === 'move') onCommitMove?.({
      tableId: active.tableId,
      placementId: active.gesture.placementId,
      expectedStartGeometry: { ...active.gesture.startGeometry },
      destination: result.geometry,
    });
    if (active.kind !== 'crop') onPreviewOperation?.(null);
    releaseCapture(event.pointerId);
    restoreFocus(active.focusKey);
  };

  const beginCrop = (placementId) => {
    const acceptedPlacement = acceptedById.get(placementId);
    const projectedPlacement = placements.find((placement) => placement.id === placementId);
    const width = projectedPlacement?.asset?.media?.width;
    const height = projectedPlacement?.asset?.media?.height;
    if (!acceptedPlacement || acceptedPlacement.visibility !== 'PUBLIC' || acceptedPlacement.locked
      || !Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) return;
    try {
      const canonicalMask = latticeProductionCropMask(acceptedPlacement);
      const session = createLatticeProductionCropSession(acceptedPlacement, {
        stableAssetId: acceptedPlacement.stableAssetId,
        width,
        height,
      }, {
        left: canonicalMask.left * fieldRef.current.cellSize,
        top: canonicalMask.top * fieldRef.current.cellSize,
        width: canonicalMask.width * fieldRef.current.cellSize,
        height: canonicalMask.height * fieldRef.current.cellSize,
      });
      const request = {
        crop: { ...session.previewCrop },
        expectedMedia: { ...session.media },
        expectedPlacement: structuredClone(acceptedPlacement),
        media: { ...session.media },
        placementId,
        tableId,
      };
      const next = { ...session, cellSize: fieldRef.current.cellSize, request };
      setCropSession(next);
      setSelectedPlacementId(placementId);
      onCropModeChange?.(true);
      onPreviewOperation?.({ kind: 'crop', request });
      restoreFocus(controlKey(placementId, 'crop-surface'));
    } catch { /* Missing canonical media remains non-authoring. */ }
  };

  const exitCrop = (options = {}) => {
    const { commit = false } = options;
    const session = cropSession;
    if (!session) return;
    const active = gestureRef.current;
    if (active?.kind === 'crop') {
      gestureRef.current = null;
      releaseCapture(active.pointerId);
    }
    const crop = Object.hasOwn(options, 'crop')
      ? options.crop
      : session.dirty ? session.previewCrop : session.startCrop;
    if (commit) onCommitCrop?.({
      crop: crop === null ? null : { ...crop },
      expectedMedia: { ...session.media },
      expectedPlacement: structuredClone(session.request.expectedPlacement),
      placementId: session.placementId,
      tableId,
    });
    setCropSession(null);
    onPreviewOperation?.(null);
    onCropModeChange?.(false);
    restoreFocus(controlKey(session.placementId, 'crop'));
  };

  const updateCrop = (crop) => {
    if (!cropSession) return;
    const next = { ...cropSession, dirty: true, previewCrop: { ...crop } };
    next.request = { ...next.request, crop: { ...next.previewCrop } };
    setCropSession(next);
    onPreviewOperation?.({ kind: 'crop', request: next.request });
  };

  const removePlacement = (placementId) => {
    const acceptedPlacement = acceptedById.get(placementId);
    if (!acceptedPlacement || acceptedPlacement.visibility !== 'PUBLIC' || acceptedPlacement.locked) return;
    const index = placements.findIndex((placement) => placement.id === placementId);
    const focusTarget = placements[index + 1] || placements[index - 1] || null;
    const removed = onCommitRemove?.({
      tableId,
      placementId,
      expectedPlacement: structuredClone(acceptedPlacement),
    });
    if (!removed) {
      restoreFocus(controlKey(placementId, 'remove'));
      return;
    }
    setSelectedPlacementId(focusTarget?.id || null);
    if (focusTarget) restoreFocus(controlKey(focusTarget.id));
    else queueMicrotask(() => onReturnFocus?.());
  };

  const layerPlacement = (placementId, operation) => {
    const acceptedPlacement = acceptedById.get(placementId);
    if (!acceptedPlacement || acceptedPlacement.visibility !== 'PUBLIC' || acceptedPlacement.locked) return;
    onCommitLayer?.({
      expectedPlacement: structuredClone(acceptedPlacement),
      expectedPlacements: latticeProductionLayerTopologySnapshot(acceptedTable),
      operation,
      placementId,
      tableId,
    });
    restoreFocus(controlKey(placementId, `layer-${operation.toLowerCase()}`));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (cropSession) exitCrop();
      else if (!cancelGesture()) {
        const placementId = event.target.closest?.('[data-lattice-placement-control]')?.dataset.placementId;
        setSelectedPlacementId(null);
        if (placementId) restoreFocus(controlKey(placementId));
      }
      return;
    }
    const delta = KEYBOARD_DELTAS[event.key];
    if (!delta) return;
    if (cropSession && event.target.closest?.('input[type="range"]')) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (cropSession) {
      const cropSurface = event.target.closest?.('[data-lattice-crop-surface]');
      if (!cropSurface) return;
      const distance = event.shiftKey ? 0.05 : 0.01;
      updateCrop(nudgeLatticeProductionCrop(
        cropSession.previewCrop,
        cropSession.media,
        cropSession.mask,
        { x: delta.column * distance, y: delta.row * distance },
      ));
      return;
    }
    const control = event.target.closest?.('[data-lattice-placement-control]');
    if (!control || control.dataset.placementAction) return;
    const placementId = control.dataset.placementId;
    const acceptedPlacement = acceptedById.get(placementId);
    const corner = control.dataset.resizeCorner || null;
    setSelectedPlacementId(placementId || null);
    if (!acceptedPlacement || acceptedPlacement.locked) return;
    if (corner) {
      const destination = nudgeLatticeProductionResizeGeometry(acceptedPlacement, corner, delta);
      if (!destination) return;
      onCommitResize?.({
        tableId,
        placementId,
        expectedPlacement: structuredClone(acceptedPlacement),
        corner,
        destination,
      });
      restoreFocus(controlKey(placementId, corner));
      return;
    }
    const destination = nudgeLatticeProductionPlacementGeometry(acceptedPlacement, delta);
    if (!destination) return;
    onCommitMove?.({
      tableId,
      placementId,
      expectedStartGeometry: {
        column: acceptedPlacement.column,
        row: acceptedPlacement.row,
        columnSpan: acceptedPlacement.columnSpan,
        rowSpan: acceptedPlacement.rowSpan,
      },
      destination,
    });
    restoreFocus(controlKey(placementId));
  };

  return <div
    aria-label="Placement composition controls"
    className="lattice-production-movement-layer"
    data-lattice-placement-layer
    onClick={(event) => {
      if (event.target !== event.currentTarget || cropSession || gestureRef.current
        || performance.now() < emptyActivationBlockedUntilRef.current) return;
      setSelectedPlacementId(null);
    }}
    onKeyDown={handleKeyDown}
    onLostPointerCapture={cancelGesture}
    onPointerCancel={cancelGesture}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onWheel={(event) => {
      if (!cropSession) return;
      event.preventDefault();
      event.stopPropagation();
    }}
    ref={rootRef}
  >
    {field && placements.map((placement) => {
      const acceptedPlacement = acceptedById.get(placement.id);
      if (!acceptedPlacement || acceptedPlacement.visibility !== 'PUBLIC') return null;
      const locked = acceptedPlacement.locked === true;
      const selected = selectedPlacementId === placement.id;
      const boundaries = latticeProductionPlacementBoundaries(acceptedPlacement);
      const cropMask = latticeProductionCropMask(acceptedPlacement);
      const layerAvailability = latticeProductionLayerOperationAvailability(acceptedTable, placement.id);
      const placementToolbarDock = latticeProductionPlacementToolbarDock(acceptedPlacement, field.cellSize);
      const label = placement.asset?.name?.trim() || placement.asset?.stableAssetId || placement.id;
      return <div
        className="lattice-production-composition-control"
        data-boundary-bottom={boundaries.bottom || undefined}
        data-boundary-left={boundaries.left || undefined}
        data-boundary-right={boundaries.right || undefined}
        data-boundary-top={boundaries.top || undefined}
        data-selected={selected || undefined}
        key={placement.id}
        style={{ ...rectangleStyle(projectLatticeProductionPlacement(placement, field)), zIndex: layerRanks.get(placement.id) }}
      >
        <button
          aria-disabled={locked || Boolean(cropSession) || undefined}
          aria-label={`${locked ? 'Locked placement' : 'Move placement'}: ${label}`}
          aria-pressed={selected}
          className="lattice-production-movement-control"
          data-lattice-placement-control
          data-locked={locked || undefined}
          data-placement-id={placement.id}
          disabled={Boolean(cropSession)}
          onClick={() => setSelectedPlacementId(placement.id)}
          ref={(node) => { const key = controlKey(placement.id); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
          type="button"
        ><span>{locked ? 'LOCKED' : 'MOVE'}</span></button>
        {selected && !locked && !cropSession && <>
          {LATTICE_PRODUCTION_RESIZE_CORNERS.map((corner) => <button
            aria-label={`Resize placement from ${CORNER_LABELS[corner]} corner: ${label}`}
            className={`lattice-production-resize-control is-${corner}`}
            data-lattice-placement-control
            data-placement-id={placement.id}
            data-resize-corner={corner}
            key={corner}
            ref={(node) => { const key = controlKey(placement.id, corner); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
            type="button"
          />)}
          <div
            aria-label={`Placement actions: ${label}`}
            className="lattice-production-placement-toolbar"
            data-placement-toolbar-dock={placementToolbarDock.vertical}
            role="toolbar"
            style={{ left: placementToolbarDock.left, width: placementToolbarDock.width }}
          >
            <button
              aria-describedby={`lattice-placement-tooltip-${placement.id}-crop`}
              aria-label="Crop placement"
              data-lattice-placement-action="crop"
              data-lattice-placement-control
              data-placement-id={placement.id}
              onClick={() => beginCrop(placement.id)}
              ref={(node) => { const key = controlKey(placement.id, 'crop'); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
              type="button"
            ><PlacementActionIcon Icon={Crop} tooltip="Crop placement" tooltipId={`lattice-placement-tooltip-${placement.id}-crop`} /></button>
            {LAYER_ACTIONS.map((action) => <button
              aria-describedby={`lattice-placement-tooltip-${placement.id}-${action.id.toLowerCase()}`}
              aria-disabled={!layerAvailability[action.id]}
              aria-label={action.accessible}
              data-lattice-placement-action="layer"
              data-lattice-placement-control
              data-layer-operation={action.id}
              data-placement-id={placement.id}
              key={action.id}
              onClick={() => layerPlacement(placement.id, action.id)}
              ref={(node) => {
                const key = controlKey(placement.id, `layer-${action.id.toLowerCase()}`);
                if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key);
              }}
              type="button"
            ><PlacementActionIcon
              Icon={action.Icon}
              tooltip={action.accessible}
              tooltipId={`lattice-placement-tooltip-${placement.id}-${action.id.toLowerCase()}`}
            /></button>)}
            <button
              aria-describedby={`lattice-placement-tooltip-${placement.id}-remove`}
              aria-label="Remove placement"
              className="is-remove"
              data-lattice-placement-action="remove"
              data-lattice-placement-control
              data-placement-id={placement.id}
              onClick={() => removePlacement(placement.id)}
              ref={(node) => { const key = controlKey(placement.id, 'remove'); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
              type="button"
            ><PlacementActionIcon Icon={Trash2} tooltip="Remove placement" tooltipId={`lattice-placement-tooltip-${placement.id}-remove`} /></button>
          </div>
        </>}
        {cropSession?.placementId === placement.id && <section
          aria-label={`Crop placement: ${label}`}
          className="lattice-production-crop-editor"
          style={{
            left: `${(cropMask.left / acceptedPlacement.columnSpan) * 100}%`,
            top: `${(cropMask.top / acceptedPlacement.rowSpan) * 100}%`,
            width: `${(cropMask.width / acceptedPlacement.columnSpan) * 100}%`,
            height: `${(cropMask.height / acceptedPlacement.rowSpan) * 100}%`,
          }}
        >
          <div
            aria-describedby={`lattice-crop-instructions-${placement.id}`}
            aria-label={`Pan crop for ${label}`}
            className="lattice-production-crop-surface"
            data-lattice-crop-surface
            data-lattice-placement-control
            data-placement-id={placement.id}
            ref={(node) => { const key = controlKey(placement.id, 'crop-surface'); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
            role="group"
            tabIndex={0}
          />
          <p className="lattice-production-crop-instructions" id={`lattice-crop-instructions-${placement.id}`}>
            Drag to pan. Arrow keys pan; Shift plus Arrow pans farther. Space-drag moves the camera. Escape cancels.
          </p>
          <div className="lattice-production-crop-toolbar" data-lattice-placement-action="crop-toolbar">
            <label>
              <span>ZOOM {Math.round(cropSession.previewCrop.zoom * 100)}%</span>
              <input
                aria-label={`Crop zoom for ${label}`}
                max={LATTICE_PRODUCTION_CROP_MAX_ZOOM}
                min={LATTICE_PRODUCTION_CROP_MIN_ZOOM}
                onChange={(event) => updateCrop(setLatticeProductionCropZoom(
                  cropSession.previewCrop,
                  cropSession.media,
                  cropSession.mask,
                  Number(event.currentTarget.value),
                ))}
                step={LATTICE_PRODUCTION_CROP_ZOOM_STEP}
                type="range"
                value={cropSession.previewCrop.zoom}
              />
            </label>
            <button onClick={() => exitCrop({ commit: true, crop: null })} type="button">NATIVE FIT</button>
            <button onClick={() => exitCrop()} type="button">CANCEL</button>
            <button onClick={() => exitCrop({ commit: true })} type="button">DONE</button>
          </div>
        </section>}
      </div>;
    })}
  </div>;
}
