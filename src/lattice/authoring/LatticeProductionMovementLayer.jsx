import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createLatticeProductionTableRenderModel,
  projectLatticeProductionPlacement,
  projectLatticeProductionViewport,
} from '../rendering/latticeProductionProjection.js';
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
  latticeProductionTopBoundaryRemoveDock,
  nudgeLatticeProductionResizeGeometry,
  updateLatticeProductionResizeGesture,
} from './latticeProductionResize.js';
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
  onPreviewOperation,
  onReturnFocus,
  tableId,
}) {
  const rootRef = useRef(null);
  const controlRefs = useRef(new Map());
  const gestureRef = useRef(null);
  const fieldRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);
  const model = useMemo(() => createLatticeProductionTableRenderModel(lattice, tableId), [lattice, tableId]);
  const field = viewport.width > 0 && viewport.height > 0
    ? projectLatticeProductionViewport(model, viewport)
    : null;
  fieldRef.current = field;
  const acceptedById = useMemo(() => new Map(
    (acceptedTable?.placements || []).map((placement) => [placement.id, placement]),
  ), [acceptedTable]);
  const placements = useMemo(() => orderedVisibleMovementPlacements(model.table), [model.table]);

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
    onPreviewOperation?.(null);
    releaseCapture(active.pointerId);
    restoreFocus(active.focusKey);
    return true;
  };

  const handlePointerDown = (event) => {
    if (event.target.closest?.('[data-lattice-placement-action]')) return;
    const control = event.target.closest?.('[data-lattice-placement-control]');
    if (!control || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
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
    const gesture = active.kind === 'resize'
      ? updateLatticeProductionResizeGesture(active.gesture, point, fieldRef.current)
      : updateLatticeProductionMovementGesture(active.gesture, point, fieldRef.current);
    gestureRef.current = { ...active, gesture };
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
    const result = active.kind === 'resize'
      ? finishLatticeProductionResizeGesture(active.gesture)
      : finishLatticeProductionMovementGesture(active.gesture);
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
    onPreviewOperation?.(null);
    releaseCapture(event.pointerId);
    restoreFocus(active.focusKey);
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

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!cancelGesture()) {
        const placementId = event.target.closest?.('[data-lattice-placement-control]')?.dataset.placementId;
        setSelectedPlacementId(null);
        if (placementId) restoreFocus(controlKey(placementId));
      }
      return;
    }
    const delta = KEYBOARD_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
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
    onKeyDown={handleKeyDown}
    onLostPointerCapture={cancelGesture}
    onPointerCancel={cancelGesture}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    ref={rootRef}
  >
    {field && placements.map((placement) => {
      const acceptedPlacement = acceptedById.get(placement.id);
      if (!acceptedPlacement || acceptedPlacement.visibility !== 'PUBLIC') return null;
      const locked = acceptedPlacement.locked === true;
      const selected = selectedPlacementId === placement.id;
      const boundaries = latticeProductionPlacementBoundaries(acceptedPlacement);
      const removeDock = latticeProductionTopBoundaryRemoveDock(acceptedPlacement, field.cellSize);
      const label = placement.asset?.name?.trim() || placement.asset?.stableAssetId || placement.id;
      return <div
        className="lattice-production-composition-control"
        data-boundary-bottom={boundaries.bottom || undefined}
        data-boundary-left={boundaries.left || undefined}
        data-boundary-right={boundaries.right || undefined}
        data-boundary-top={boundaries.top || undefined}
        data-remove-dock={removeDock.side || undefined}
        data-selected={selected || undefined}
        key={placement.id}
        style={{ ...rectangleStyle(projectLatticeProductionPlacement(placement, field)), zIndex: placement.layer }}
      >
        <button
          aria-disabled={locked || undefined}
          aria-label={`${locked ? 'Locked placement' : 'Move placement'}: ${label}`}
          aria-pressed={selected}
          className="lattice-production-movement-control"
          data-lattice-placement-control
          data-locked={locked || undefined}
          data-placement-id={placement.id}
          onClick={() => setSelectedPlacementId(placement.id)}
          ref={(node) => { const key = controlKey(placement.id); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
          type="button"
        ><span>{locked ? 'LOCKED' : 'MOVE'}</span></button>
        {selected && !locked && <>
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
          <button
            aria-label={`Remove placement: ${label}`}
            className="lattice-production-remove-control"
            data-lattice-placement-action="remove"
            data-lattice-placement-control
            data-placement-id={placement.id}
            onClick={() => removePlacement(placement.id)}
            ref={(node) => { const key = controlKey(placement.id, 'remove'); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
            style={removeDock.maximumWidth ? { '--lattice-remove-maximum-width': `${removeDock.maximumWidth}px` } : undefined}
            type="button"
          >REMOVE</button>
        </>}
      </div>;
    })}
  </div>;
}
