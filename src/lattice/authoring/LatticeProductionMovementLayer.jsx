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
import './latticeProductionMovementLayer.css';

const KEYBOARD_DELTAS = Object.freeze({
  ArrowDown: Object.freeze({ column: 0, row: 1 }),
  ArrowLeft: Object.freeze({ column: -1, row: 0 }),
  ArrowRight: Object.freeze({ column: 1, row: 0 }),
  ArrowUp: Object.freeze({ column: 0, row: -1 }),
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
  onPreviewMove,
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

  const restoreFocus = (placementId) => queueMicrotask(() => {
    controlRefs.current.get(placementId)?.focus({ preventScroll: true });
  });

  const releaseCapture = (pointerId) => {
    const root = rootRef.current;
    if (root?.hasPointerCapture?.(pointerId)) root.releasePointerCapture(pointerId);
  };

  const cancelGesture = () => {
    const active = gestureRef.current;
    if (!active) return false;
    gestureRef.current = null;
    onPreviewMove?.(null);
    releaseCapture(active.pointerId);
    restoreFocus(active.gesture.placementId);
    return true;
  };

  const handlePointerDown = (event) => {
    const control = event.target.closest?.('[data-lattice-placement-control]');
    if (!control || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    const placementId = control.dataset.movementPlacementId;
    const acceptedPlacement = acceptedById.get(placementId);
    setSelectedPlacementId(placementId);
    control.focus({ preventScroll: true });
    if (!acceptedPlacement || acceptedPlacement.locked || !fieldRef.current) return;
    let gesture;
    try {
      gesture = createLatticeProductionMovementGesture(
        acceptedPlacement,
        fieldRef.current,
        localPointerPoint(event, event.currentTarget),
      );
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    gestureRef.current = { pointerId: event.pointerId, tableId, gesture };
  };

  const handlePointerMove = (event) => {
    const active = gestureRef.current;
    if (!active || active.pointerId !== event.pointerId || !fieldRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const gesture = updateLatticeProductionMovementGesture(
      active.gesture,
      localPointerPoint(event, event.currentTarget),
      fieldRef.current,
    );
    gestureRef.current = { ...active, gesture };
    if (gesture.activated) onPreviewMove?.({
      tableId: active.tableId,
      placementId: gesture.placementId,
      expectedStartGeometry: { ...gesture.startGeometry },
      destination: { ...gesture.previewGeometry },
    });
  };

  const handlePointerUp = (event) => {
    const active = gestureRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    gestureRef.current = null;
    const result = finishLatticeProductionMovementGesture(active.gesture);
    if (result.committed) onCommitMove?.({
      tableId: active.tableId,
      placementId: active.gesture.placementId,
      expectedStartGeometry: { ...active.gesture.startGeometry },
      destination: result.geometry,
    });
    onPreviewMove?.(null);
    releaseCapture(event.pointerId);
    restoreFocus(active.gesture.placementId);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!cancelGesture()) setSelectedPlacementId(null);
      return;
    }
    const delta = KEYBOARD_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    const control = event.target.closest?.('[data-lattice-placement-control]');
    const placementId = control?.dataset.movementPlacementId;
    const acceptedPlacement = acceptedById.get(placementId);
    setSelectedPlacementId(placementId || null);
    if (!acceptedPlacement || acceptedPlacement.locked) return;
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
    restoreFocus(placementId);
  };

  return <div
    aria-label="Placement movement controls"
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
      const label = placement.asset?.name?.trim() || placement.asset?.stableAssetId || placement.id;
      return <button
        aria-disabled={locked || undefined}
        aria-label={`${locked ? 'Locked placement' : 'Move placement'}: ${label}`}
        aria-pressed={selectedPlacementId === placement.id}
        className="lattice-production-movement-control"
        data-lattice-placement-control
        data-locked={locked || undefined}
        data-movement-placement-id={placement.id}
        key={placement.id}
        ref={(node) => { if (node) controlRefs.current.set(placement.id, node); else controlRefs.current.delete(placement.id); }}
        style={{ ...rectangleStyle(projectLatticeProductionPlacement(placement, field)), zIndex: placement.layer }}
        type="button"
      ><span>{locked ? 'LOCKED' : 'MOVE'}</span></button>;
    })}
  </div>;
}
