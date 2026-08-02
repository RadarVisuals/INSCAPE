import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RackMenu from '../../public/menus/RackMenu.jsx';
import LatticeProductionPresentationInspector from './LatticeProductionPresentationInspector.jsx';
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
  clampLatticeProductionGroupDelta,
  createLatticeProductionGroupMovementRequest,
  createLatticeProductionMovementGesture,
  finishLatticeProductionMovementGesture,
  nudgeLatticeProductionPlacementGeometry,
  updateLatticeProductionMovementGesture,
} from './latticeProductionMovement.js';
import {
  LATTICE_PRODUCTION_RESIZE_CORNERS,
  createLatticeProductionGroupResizeGesture,
  createLatticeProductionResizeGesture,
  finishLatticeProductionGroupResizeGesture,
  finishLatticeProductionResizeGesture,
  latticeProductionGroupBounds,
  latticeProductionPlacementBoundaries,
  nudgeLatticeProductionGroupResizeGeometries,
  nudgeLatticeProductionResizeGeometry,
  updateLatticeProductionGroupResizeGesture,
  updateLatticeProductionResizeGesture,
} from './latticeProductionResize.js';
import {
  LATTICE_PRODUCTION_LAYER_OPERATIONS,
  latticeProductionLayerOperationAvailability,
  latticeProductionLayerTopologySnapshot,
} from './latticeProductionLayer.js';
import {
  LATTICE_MARQUEE_SELECTION_MODES,
  latticeMarqueeIntersects,
  latticeMarqueeRectangle,
  resolveLatticeMarqueeSelection,
} from './latticeProductionMarqueeSelection.js';
import { sameLatticeProductionPlacementSnapshot } from './latticeProductionRemoval.js';
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
const MARQUEE_ACTIVATION_DISTANCE = 4;
const LAYER_ACTIONS = Object.freeze([
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.BACK, label: 'Layer / Send to back' }),
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.BACKWARD, label: 'Layer / Move backward' }),
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.FORWARD, label: 'Layer / Move forward' }),
  Object.freeze({ id: LATTICE_PRODUCTION_LAYER_OPERATIONS.FRONT, label: 'Layer / Bring to front' }),
]);

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
  onCommitMoveGroup,
  onCommitPresentation,
  onCommitRemove,
  onCommitRemoveGroup,
  onCommitResize,
  onCommitResizeGroup,
  onCommitCrop,
  onCommitLayer,
  onCropModeChange,
  onPreviewOperation,
  onReturnFocus,
  onSelectedPlacementChange,
  onSelectedPlacementsChange,
  selectedPlacementId: controlledSelectedPlacementId,
  selectedPlacementIds = [],
  tableId,
}) {
  const rootRef = useRef(null);
  const controlRefs = useRef(new Map());
  const gestureRef = useRef(null);
  const emptyActivationBlockedUntilRef = useRef(0);
  const fieldRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [internalSelectedPlacementId, setInternalSelectedPlacementId] = useState(null);
  const [marqueeSession, setMarqueeSession] = useState(null);
  const selectedPlacementId = controlledSelectedPlacementId === undefined
    ? internalSelectedPlacementId : controlledSelectedPlacementId;
  const setSelectedPlacementId = (placementId, options) => {
    setInternalSelectedPlacementId(placementId);
    onSelectedPlacementChange?.(placementId, options);
  };
  const selectedPlacementSet = new Set(selectedPlacementIds.length
    ? selectedPlacementIds : selectedPlacementId ? [selectedPlacementId] : []);
  const renderedSelectedPlacementSet = new Set(marqueeSession?.previewIds || selectedPlacementSet);
  const [cropSession, setCropSession] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [presentationInspector, setPresentationInspector] = useState(null);
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
  const selectedProjectedPlacements = placements.filter(({ id }) => selectedPlacementSet.has(id));
  const groupResizeGeometry = selectedProjectedPlacements.length > 1
    ? latticeProductionGroupBounds(selectedProjectedPlacements) : null;
  const groupResizeRectangle = field && groupResizeGeometry
    ? projectLatticeProductionPlacement(groupResizeGeometry, field) : null;
  const groupResizeBoundaries = groupResizeGeometry
    ? latticeProductionPlacementBoundaries(groupResizeGeometry) : null;
  const groupResizeLocked = selectedProjectedPlacements.some(({ id }) => acceptedById.get(id)?.locked === true);

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
    if (contextMenu && !acceptedById.has(contextMenu.placementId)) setContextMenu(null);
    if (presentationInspector && (!acceptedById.has(presentationInspector.placementId)
      || !sameLatticeProductionPlacementSnapshot(
        acceptedById.get(presentationInspector.placementId),
        presentationInspector.expectedPlacement,
      ))) {
      setPresentationInspector(null);
      onPreviewOperation?.(null);
    }
  }, [acceptedById, contextMenu, presentationInspector, selectedPlacementId]);

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
    if (active.kind === 'marquee') {
      setMarqueeSession(null);
      onReturnFocus?.();
    } else if (active.kind === 'crop') {
      setCropSession(active.session);
      onPreviewOperation?.({ kind: 'crop', request: active.session.request });
    } else onPreviewOperation?.(null);
    releaseCapture(active.pointerId);
    if (active.focusKey) restoreFocus(active.focusKey);
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
    const groupResizeControl = event.target.closest?.('[data-group-resize-corner]');
    if (!cropSession && groupResizeControl && event.button === 0
      && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      const corner = groupResizeControl.dataset.groupResizeCorner;
      const groupPlacements = [...selectedPlacementSet].map((id) => acceptedById.get(id)).filter(Boolean);
      if (groupPlacements.length < 2 || groupPlacements.some((placement) => placement.visibility !== 'PUBLIC' || placement.locked)
        || !fieldRef.current) return;
      try {
        const gesture = createLatticeProductionGroupResizeGesture(
          groupPlacements, corner, fieldRef.current, localPointerPoint(event, event.currentTarget),
        );
        event.currentTarget.setPointerCapture(event.pointerId);
        groupResizeControl.focus({ preventScroll: true });
        gestureRef.current = {
          focusKey: `group-resize:${corner}`,
          kind: 'group-resize',
          pointerId: event.pointerId,
          tableId,
          gesture,
        };
      } catch { /* Invalid runtime projection remains non-authoring. */ }
      return;
    }
    if (!cropSession && event.target === event.currentTarget && event.button === 0 && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      const start = localPointerPoint(event, event.currentTarget);
      if (!start) return;
      const mode = event.ctrlKey || event.metaKey
        ? LATTICE_MARQUEE_SELECTION_MODES.TOGGLE
        : event.shiftKey ? LATTICE_MARQUEE_SELECTION_MODES.ADD : LATTICE_MARQUEE_SELECTION_MODES.REPLACE;
      const session = {
        activated: false,
        baseIds: [...selectedPlacementSet],
        end: start,
        mode,
        previewIds: [...selectedPlacementSet],
        rectangle: latticeMarqueeRectangle(start, start),
        start,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureRef.current = { kind: 'marquee', pointerId: event.pointerId, session };
      setMarqueeSession(session);
      onReturnFocus?.();
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
    if (corner || !selectedPlacementSet.has(placementId)) setSelectedPlacementId(placementId);
    control.focus({ preventScroll: true });
    if (!acceptedPlacement || acceptedPlacement.locked || !fieldRef.current) return;
    const groupPlacements = !corner && selectedPlacementSet.has(placementId) && selectedPlacementSet.size > 1
      ? [...selectedPlacementSet].map((id) => acceptedById.get(id)).filter(Boolean)
      : [acceptedPlacement];
    if (groupPlacements.some((placement) => placement.visibility !== 'PUBLIC' || placement.locked)) return;
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
      groupPlacements: groupPlacements.map((placement) => structuredClone(placement)),
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
    if (active.kind === 'marquee') {
      const rectangle = latticeMarqueeRectangle(active.session.start, point);
      const activated = active.session.activated
        || Math.hypot(point.x - active.session.start.x, point.y - active.session.start.y) >= MARQUEE_ACTIVATION_DISTANCE;
      const hitIds = activated ? placements
        .filter((placement) => acceptedById.has(placement.id)
          && latticeMarqueeIntersects(rectangle, projectLatticeProductionPlacement(placement, fieldRef.current)))
        .map((placement) => placement.id) : [];
      const previewIds = activated
        ? resolveLatticeMarqueeSelection(active.session.baseIds, hitIds, active.session.mode)
        : active.session.baseIds;
      const session = { ...active.session, activated, end: point, previewIds, rectangle };
      gestureRef.current = { ...active, session };
      setMarqueeSession(session);
      return;
    }
    if (active.kind === 'group-resize') {
      const gesture = updateLatticeProductionGroupResizeGesture(active.gesture, point, fieldRef.current);
      gestureRef.current = { ...active, gesture };
      if (gesture.activated) onPreviewOperation?.({
        kind: 'group-resize',
        request: {
          corner: gesture.corner,
          destinations: gesture.previewDestinations,
          expectedPlacements: gesture.expectedPlacements,
          placementIds: gesture.placementIds,
          tableId: active.tableId,
        },
      });
      return;
    }
    let gesture = active.kind === 'crop'
      ? updateLatticeProductionCropPanGesture(active.gesture, point)
      : active.kind === 'resize'
      ? updateLatticeProductionResizeGesture(active.gesture, point, fieldRef.current)
      : updateLatticeProductionMovementGesture(active.gesture, point, fieldRef.current);
    if (active.kind === 'move' && active.groupPlacements.length > 1 && gesture.activated) {
      const delta = clampLatticeProductionGroupDelta(active.groupPlacements, {
        column: gesture.previewGeometry.column - gesture.startGeometry.column,
        row: gesture.previewGeometry.row - gesture.startGeometry.row,
      });
      gesture = {
        ...gesture,
        previewGeometry: {
          ...gesture.startGeometry,
          column: gesture.startGeometry.column + delta.column,
          row: gesture.startGeometry.row + delta.row,
        },
      };
    }
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
      const groupRequest = active.kind === 'move' && active.groupPlacements.length > 1
        ? createLatticeProductionGroupMovementRequest(active.groupPlacements, {
          column: gesture.previewGeometry.column - gesture.startGeometry.column,
          row: gesture.previewGeometry.row - gesture.startGeometry.row,
        }, active.tableId)
        : null;
      onPreviewOperation?.(active.kind === 'resize' ? {
        kind: 'resize',
        request: {
          ...common,
          corner: gesture.corner,
          expectedPlacement: structuredClone(active.expectedPlacement),
        },
      } : groupRequest ? {
        kind: 'group-move',
        request: groupRequest,
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
    if (active.kind === 'marquee') {
      setMarqueeSession(null);
      onSelectedPlacementsChange?.(active.session.activated
        ? active.session.previewIds
        : active.session.mode === LATTICE_MARQUEE_SELECTION_MODES.REPLACE ? [] : active.session.baseIds);
      releaseCapture(event.pointerId);
      onReturnFocus?.();
      return;
    }
    if (active.kind === 'group-resize') {
      const result = finishLatticeProductionGroupResizeGesture(active.gesture);
      if (result.committed) onCommitResizeGroup?.({
        corner: active.gesture.corner,
        destinations: result.destinations,
        expectedPlacements: active.gesture.expectedPlacements,
        placementIds: active.gesture.placementIds,
        tableId: active.tableId,
      });
      onPreviewOperation?.(null);
      releaseCapture(event.pointerId);
      restoreFocus(active.focusKey);
      return;
    }
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
    if (result.committed && active.kind === 'move') {
      const delta = {
        column: result.geometry.column - active.gesture.startGeometry.column,
        row: result.geometry.row - active.gesture.startGeometry.row,
      };
      const groupRequest = active.groupPlacements.length > 1
        ? createLatticeProductionGroupMovementRequest(active.groupPlacements, delta, active.tableId)
        : null;
      if (groupRequest) onCommitMoveGroup?.(groupRequest);
      else onCommitMove?.({
        tableId: active.tableId,
        placementId: active.gesture.placementId,
        expectedStartGeometry: { ...active.gesture.startGeometry },
        destination: result.geometry,
      });
    }
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
    restoreFocus(controlKey(session.placementId));
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
    const removalIds = selectedPlacementSet.has(placementId) && selectedPlacementSet.size > 1
      ? [...selectedPlacementSet] : [placementId];
    const removalPlacements = removalIds.map((id) => acceptedById.get(id)).filter(Boolean);
    if (removalPlacements.length !== removalIds.length
      || removalPlacements.some((placement) => placement.visibility !== 'PUBLIC' || placement.locked)) return;
    const focusTarget = placements.find((placement) => !removalIds.includes(placement.id)) || null;
    const removed = removalIds.length > 1
      ? onCommitRemoveGroup?.({
        expectedPlacements: removalPlacements.map((placement) => structuredClone(placement)),
        placementIds: removalIds,
        tableId,
      })
      : onCommitRemove?.({
        tableId,
        placementId,
        expectedPlacement: structuredClone(acceptedPlacement),
      });
    if (!removed) {
      restoreFocus(controlKey(placementId));
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
    restoreFocus(controlKey(placementId));
  };

  const openPresentationInspector = (placementId, anchor, returnFocus) => {
    const acceptedPlacement = acceptedById.get(placementId);
    const projectedPlacement = placements.find((placement) => placement.id === placementId);
    if (!acceptedPlacement || acceptedPlacement.visibility !== 'PUBLIC' || acceptedPlacement.locked) return;
    setContextMenu(null);
    setPresentationInspector({
      anchor,
      artworkName: projectedPlacement?.asset?.name?.trim() || acceptedPlacement.stableAssetId,
      expectedPlacement: structuredClone(acceptedPlacement),
      placementId,
      returnFocus,
    });
  };

  const openPlacementContextMenu = (event, placementId, control) => {
    event.preventDefault();
    event.stopPropagation();
    const acceptedPlacement = acceptedById.get(placementId);
    if (cropSession || gestureRef.current || presentationInspector || !acceptedPlacement || acceptedPlacement.locked
      || acceptedPlacement.visibility !== 'PUBLIC') return;
    const bounds = control?.getBoundingClientRect?.();
    const pointerAnchor = event.clientX || event.clientY;
    if (!selectedPlacementSet.has(placementId)) setSelectedPlacementId(placementId);
    setContextMenu({
      anchor: pointerAnchor
        ? { x: event.clientX, y: event.clientY }
        : { x: (bounds?.left || 0) + ((bounds?.width || 0) / 2), y: (bounds?.top || 0) + ((bounds?.height || 0) / 2) },
      placementId,
      returnFocus: control,
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      const control = event.target.closest?.('[data-lattice-placement-control]');
      const placementId = control?.dataset.placementId;
      if (control && placementId) openPlacementContextMenu(event, placementId, control);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (cropSession) exitCrop();
      else if (!cancelGesture()) {
        const placementId = event.target.closest?.('[data-lattice-placement-control]')?.dataset.placementId;
        setContextMenu(null);
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
    const groupCorner = control.dataset.groupResizeCorner || null;
    if (groupCorner) {
      const groupPlacements = [...selectedPlacementSet].map((id) => acceptedById.get(id)).filter(Boolean);
      if (groupPlacements.length < 2
        || groupPlacements.some((placement) => placement.visibility !== 'PUBLIC' || placement.locked)) return;
      const destinations = nudgeLatticeProductionGroupResizeGeometries(groupPlacements, groupCorner, delta);
      if (!destinations) return;
      onCommitResizeGroup?.({
        corner: groupCorner,
        destinations,
        expectedPlacements: groupPlacements.map((placement) => structuredClone(placement)),
        placementIds: groupPlacements.map(({ id }) => id),
        tableId,
      });
      restoreFocus(`group-resize:${groupCorner}`);
      return;
    }
    const placementId = control.dataset.placementId;
    const acceptedPlacement = acceptedById.get(placementId);
    const corner = control.dataset.resizeCorner || null;
    if (corner || !selectedPlacementSet.has(placementId)) setSelectedPlacementId(placementId || null);
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
    const groupPlacements = selectedPlacementSet.has(placementId) && selectedPlacementSet.size > 1
      ? [...selectedPlacementSet].map((id) => acceptedById.get(id)).filter(Boolean)
      : [acceptedPlacement];
    if (groupPlacements.some((placement) => placement.visibility !== 'PUBLIC' || placement.locked)) return;
    if (groupPlacements.length > 1) {
      const request = createLatticeProductionGroupMovementRequest(groupPlacements, delta, tableId);
      if (request) onCommitMoveGroup?.(request);
      restoreFocus(controlKey(placementId));
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
      const selected = renderedSelectedPlacementSet.has(placement.id);
      const primary = selected && selectedPlacementId === placement.id;
      const boundaries = latticeProductionPlacementBoundaries(acceptedPlacement);
      const cropMask = latticeProductionCropMask(acceptedPlacement);
      const label = placement.asset?.name?.trim() || placement.asset?.stableAssetId || placement.id;
      return <div
        className="lattice-production-composition-control"
        data-boundary-bottom={boundaries.bottom || undefined}
        data-boundary-left={boundaries.left || undefined}
        data-boundary-right={boundaries.right || undefined}
        data-boundary-top={boundaries.top || undefined}
        data-selected={selected || undefined}
        key={placement.id}
        onContextMenu={(event) => openPlacementContextMenu(
          event,
          placement.id,
          controlRefs.current.get(controlKey(placement.id)),
        )}
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
          onClick={(event) => {
            if (performance.now() < emptyActivationBlockedUntilRef.current) return;
            setSelectedPlacementId(placement.id, {
              additive: event.ctrlKey || event.metaKey,
              range: event.shiftKey,
            });
          }}
          ref={(node) => { const key = controlKey(placement.id); if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
          type="button"
        ><span>{locked ? 'LOCKED' : 'MOVE'}</span></button>
        {primary && selectedPlacementSet.size === 1 && !locked && !cropSession && <>
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
    {groupResizeRectangle && !cropSession && <div
      aria-label={`Resize ${selectedProjectedPlacements.length} selected placements`}
      className="lattice-production-group-resize-control"
      data-boundary-bottom={groupResizeBoundaries.bottom || undefined}
      data-boundary-left={groupResizeBoundaries.left || undefined}
      data-boundary-right={groupResizeBoundaries.right || undefined}
      data-boundary-top={groupResizeBoundaries.top || undefined}
      style={rectangleStyle(groupResizeRectangle)}
    >
      {LATTICE_PRODUCTION_RESIZE_CORNERS.map((corner) => <button
        aria-disabled={groupResizeLocked || undefined}
        aria-label={`Resize selected placements from ${CORNER_LABELS[corner]} corner`}
        className={`lattice-production-resize-control is-${corner}`}
        data-group-resize-corner={corner}
        data-lattice-placement-control
        disabled={groupResizeLocked}
        key={corner}
        ref={(node) => { const key = `group-resize:${corner}`; if (node) controlRefs.current.set(key, node); else controlRefs.current.delete(key); }}
        type="button"
      />)}
    </div>}
    {marqueeSession?.activated && <div
      aria-hidden="true"
      className="lattice-production-selection-marquee"
      style={rectangleStyle(marqueeSession.rectangle)}
    />}
    {contextMenu && rootRef.current && createPortal((() => {
      const placement = acceptedById.get(contextMenu.placementId);
      const availability = latticeProductionLayerOperationAvailability(acceptedTable, contextMenu.placementId);
      const commands = [
        { id: 'crop', label: 'Crop' },
        { id: 'presentation', label: 'Frame & mat…' },
        ...LAYER_ACTIONS.map((action) => ({
          id: `layer:${action.id}`,
          label: action.label,
          disabled: !availability[action.id],
        })),
        { id: 'remove', label: 'Remove' },
      ];
      return <RackMenu
        anchor={contextMenu.anchor}
        className="lattice-production-placement-context-menu"
        commands={commands}
        label={`Placement actions: ${placement?.id || contextMenu.placementId}`}
        onClose={() => setContextMenu(null)}
        onCommand={(command) => {
          const placementId = contextMenu.placementId;
          const { anchor, returnFocus } = contextMenu;
          setContextMenu(null);
          if (command === 'crop') beginCrop(placementId);
          else if (command === 'presentation') openPresentationInspector(placementId, anchor, returnFocus);
          else if (command === 'remove') removePlacement(placementId);
          else if (command.startsWith('layer:')) layerPlacement(placementId, command.slice(6));
        }}
        returnFocus={contextMenu.returnFocus}
      />;
    })(), document.querySelector('.owner-lattice-shell') || document.body)}
    {presentationInspector && rootRef.current && createPortal(<LatticeProductionPresentationInspector
      anchor={presentationInspector.anchor}
      artworkName={presentationInspector.artworkName}
      onApply={(presentation) => {
        const committed = onCommitPresentation?.({
          expectedPlacement: structuredClone(presentationInspector.expectedPlacement),
          placementId: presentationInspector.placementId,
          presentation,
          tableId,
        });
        if (!committed) return false;
        setPresentationInspector(null);
        return true;
      }}
      onCancel={() => setPresentationInspector(null)}
      onPreview={(presentation) => onPreviewOperation?.(presentation ? {
        kind: 'presentation',
        request: {
          expectedPlacement: structuredClone(presentationInspector.expectedPlacement),
          placementId: presentationInspector.placementId,
          presentation,
          tableId,
        },
      } : null)}
      placement={presentationInspector.expectedPlacement}
      returnFocus={presentationInspector.returnFocus}
    />, document.querySelector('.owner-lattice-shell') || document.body)}
  </div>;
}
