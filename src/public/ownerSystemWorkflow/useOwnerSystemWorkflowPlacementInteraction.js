import { expandPlacementGroups } from '../../systemWorkflow/domain/placementGroups.js';
import { useEffect, useRef, useState } from 'react';
import {
  clampSystemWorkflowGroupDelta,
  createSystemWorkflowMovementGesture,
  createSystemWorkflowGroupMovementRequest,
  finishSystemWorkflowMovementGesture,
  nudgeSystemWorkflowPlacementGeometry,
  updateSystemWorkflowMovementGesture,
} from '../../systemWorkflow/systemWorkflowMovement.js';
import {
  createSystemWorkflowGroupResizeGesture,
  createSystemWorkflowResizeGesture,
  finishSystemWorkflowGroupResizeGesture,
  finishSystemWorkflowResizeGesture,
  systemWorkflowGroupBounds,
  updateSystemWorkflowGroupResizeGesture,
  updateSystemWorkflowResizeGesture,
} from '../../systemWorkflow/systemWorkflowResize.js';
import { createOwnerSystemWorkflowProjectedField } from './systemWorkflowArtboardProjection.js';

const geometry = ({ column, row, columnSpan, rowSpan }) => ({ column, row, columnSpan, rowSpan });

function projectedField(node, snapStep, artboardMode, originNode) {
  return createOwnerSystemWorkflowProjectedField(node, snapStep, 1, artboardMode, originNode);
}

function selectedRecords(controller, grid, placement) {
  const selected = grid.placements.filter(({ id }) => controller.selectedPlacementIds.includes(id) && !grid.placements.find((entry) => entry.id === id)?.locked);
  return selected.some(({ id }) => id === placement.id) ? selected : grid.placements.filter(item => expandPlacementGroups(grid, [placement.id]).includes(item.id));
}

export default function useOwnerSystemWorkflowPlacementInteraction({ artboardMode = 'grid', authoringDisabled = false,
  canvasRef, sceneRef, canNavigateGrid = () => false, controller, cropResize = null, cropSession = null, disabled = false,
  navigation, snapStep = 1, viewScale = 1 }) {
  const [previewById, setPreviewById] = useState(new Map());
  const [marquee, setMarquee] = useState(null);
  const gridSwipe = navigation.swipe;
  const [spaceNavigation, setSpaceNavigation] = useState(false);
  const gestureRef = useRef(null);
  const marqueeRef = useRef(null);
  const clickSuppressedRef = useRef(false);
  const spacePressedRef = useRef(false);
  const grid = controller.selectedGrid;

  const clearGesture = () => {
    const active = gestureRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    globalThis.removeEventListener('keydown', active.escape, true);
    gestureRef.current = null;
    setPreviewById(new Map());
  };

  const beginPlacementGesture = (event, placement, kind = 'move', corner = null) => {
    if (disabled || authoringDisabled || navigation.isMoving() || placement.locked || event.button !== 0 || !grid) return;
    if (spacePressedRef.current) {
      beginCanvasSelection(event, { navigationOnly: true });
      return;
    }
    if (cropSession && (kind !== 'resize' || cropSession.placementId !== placement.id)) return;
    // Shift-click belongs to selection, not movement. Let the placement click
    // handler toggle the item without replacing the existing selection first.
    if (kind === 'move' && event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    const field = projectedField(canvasRef.current, snapStep, artboardMode, sceneRef?.current);
    if (!field) return;
    const records = selectedRecords(controller, grid, placement);
    controller.replaceSelection(records.map(({ id }) => id));
    const point = { x: event.clientX, y: event.clientY };
    const domainGesture = kind === 'resize'
      ? records.length > 1 ? createSystemWorkflowGroupResizeGesture(records, corner, field, point) : createSystemWorkflowResizeGesture(placement, corner, field, point)
      : createSystemWorkflowMovementGesture(placement, field, point);
    if (kind === 'resize' && cropSession) cropResize?.begin?.();
    const update = (pointerEvent) => {
      const active = gestureRef.current;
      if (!active || pointerEvent.pointerId !== active.pointerId) return;
      const currentField = projectedField(canvasRef.current, pointerEvent.altKey ? 1 / 9 : snapStep, artboardMode, sceneRef?.current);
      const next = active.kind === 'resize'
        ? active.records.length > 1 ? updateSystemWorkflowGroupResizeGesture(active.domainGesture, { x: pointerEvent.clientX, y: pointerEvent.clientY }, currentField, 3, { preserveRatio: pointerEvent.shiftKey }) : updateSystemWorkflowResizeGesture(
          active.domainGesture,
          { x: pointerEvent.clientX, y: pointerEvent.clientY },
          currentField,
          3,
          { preserveRatio: pointerEvent.shiftKey },
        )
        : updateSystemWorkflowMovementGesture(active.domainGesture, { x: pointerEvent.clientX, y: pointerEvent.clientY }, currentField,
          Math.min(10, currentField.cellSize));
      active.domainGesture = next;
      active.moved ||= next.activated;
      const previews = new Map();
      if (active.kind === 'resize') {
        if (active.records.length > 1) next.previewDestinations.forEach(({ placementId, destination }) => previews.set(placementId, destination));
        else {
          previews.set(active.placement.id, { ...next.previewGeometry,
            ...(active.corner.length === 1 && active.placement.kind !== 'text'
              ? { mediaFrameRatio: active.placement.mediaFrameRatio ?? active.placement.columnSpan / active.placement.rowSpan } : {}) });
          if (active.cropResize) cropResize?.preview?.({ ...active.placement, ...next.previewGeometry });
        }
      } else {
        const rawDelta = { column: next.previewGeometry.column - active.placement.column, row: next.previewGeometry.row - active.placement.row };
        const delta = active.records.length > 1 ? clampSystemWorkflowGroupDelta(active.records, rawDelta) : rawDelta;
        active.records.forEach((record) => previews.set(record.id, { ...geometry(record), column: record.column + delta.column, row: record.row + delta.row }));
      }
      setPreviewById(previews);
    };
    const complete = (pointerEvent, cancelled = false) => {
      const active = gestureRef.current;
      if (!active || pointerEvent.pointerId != null && pointerEvent.pointerId !== active.pointerId) return;
      if (active.moved) { clickSuppressedRef.current = true; globalThis.setTimeout(() => { clickSuppressedRef.current = false; }, 0); }
      if (!cancelled) {
        if (active.kind === 'resize') {
          const result = active.records.length > 1 ? finishSystemWorkflowGroupResizeGesture(active.domainGesture) : finishSystemWorkflowResizeGesture(active.domainGesture);
          if (result.committed) controller.run((session) => active.records.length > 1
            ? session.resizePlacements({ gridId: grid.id, placementIds: active.records.map(({ id }) => id), expectedPlacements: active.records, destinations: result.destinations, corner: active.corner })
            : session.resizePlacement({ gridId: grid.id, placementId: active.placement.id, expectedPlacement: active.placement, destination: result.geometry, corner: active.corner }));
        } else {
          const result = finishSystemWorkflowMovementGesture(active.domainGesture);
          if (result.committed) {
            const delta = clampSystemWorkflowGroupDelta(active.records, { column: result.geometry.column - active.placement.column, row: result.geometry.row - active.placement.row });
            controller.run((session) => active.records.length > 1
              ? session.movePlacements(createSystemWorkflowGroupMovementRequest(active.records, delta, grid.id))
              : session.movePlacement({ gridId: grid.id, placementId: active.placement.id, expectedStartGeometry: active.placement, destination: result.geometry }));
          }
        }
      }
      if (active.cropResize) cropResize?.finish?.({ cancelled });
      clearGesture();
    };
    const finish = (pointerEvent) => complete(pointerEvent, false);
    const cancel = (pointerEvent) => complete(pointerEvent, true);
    const escape = (keyEvent) => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); complete(keyEvent, true); } };
    gestureRef.current = { corner, cropResize: Boolean(cropSession), domainGesture, escape, cancel, finish, kind, move: update, moved: false, placement, pointerId: event.pointerId, records };
    globalThis.addEventListener('pointermove', update, true);
    globalThis.addEventListener('pointerup', finish, true);
    globalThis.addEventListener('pointercancel', cancel, true);
    globalThis.addEventListener('keydown', escape, true);
  };

  const clearMarquee = () => {
    const active = marqueeRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    marqueeRef.current = null;
    setMarquee(null);
  };
  const beginCanvasSelection = (event, { navigationOnly = spacePressedRef.current, emptyArtworkHit = false } = {}) => {
    if (disabled || marqueeRef.current || authoringDisabled && !navigationOnly || event.button !== 0 || !grid
      || !navigationOnly && !emptyArtworkHit && event.target !== event.currentTarget) return;
    event.preventDefault();
    if (navigationOnly) { event.stopPropagation(); navigation.beginDrag(event.clientX); }
    const field = projectedField(canvasRef.current, snapStep, artboardMode, sceneRef?.current);
    const surface = (sceneRef?.current || canvasRef.current).getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY };
    const move = (pointerEvent) => {
      const active = marqueeRef.current;
      if (!active || pointerEvent.pointerId !== active.pointerId) return;
      const deltaX = pointerEvent.clientX - origin.x;
      const deltaY = pointerEvent.clientY - origin.y;
      if (active.mode === 'pending' && Math.hypot(deltaX, deltaY) > 6) {
        const direction = deltaX < 0 ? 'next' : 'previous';
        const targetGridId = canNavigateGrid(direction);
        active.mode = navigationOnly && Math.abs(deltaX) > Math.abs(deltaY) * 1.35 && targetGridId
          ? 'swipe' : navigationOnly ? 'navigation' : 'marquee';
        if (active.mode === 'swipe') {
          active.direction = direction;
          active.targetGridId = targetGridId;
        }
      }
      if (active.mode === 'swipe') {
        pointerEvent.preventDefault();
        active.end = { x: pointerEvent.clientX, y: pointerEvent.clientY };
        navigation.moveDrag(pointerEvent.clientX);
        return;
      }
      if (active.mode === 'navigation') {
        active.end = { x: pointerEvent.clientX, y: pointerEvent.clientY };
        return;
      }
      active.end = {
        x: Math.max(field.viewportLeft, Math.min(field.viewportLeft + field.viewportWidth, pointerEvent.clientX)),
        y: Math.max(field.viewportTop, Math.min(field.viewportTop + field.viewportHeight, pointerEvent.clientY)),
      };
      active.moved ||= Math.hypot(active.end.x - origin.x, active.end.y - origin.y) > 6;
      if (active.moved) setMarquee({
        left: (Math.min(origin.x, active.end.x) - surface.left) / viewScale,
        top: (Math.min(origin.y, active.end.y) - surface.top) / viewScale,
        width: Math.abs(active.end.x - origin.x) / viewScale,
        height: Math.abs(active.end.y - origin.y) / viewScale,
      });
    };
    const finish = (pointerEvent) => {
      const active = marqueeRef.current;
      if (!active || pointerEvent.pointerId !== active.pointerId) return;
      if (active.moved || active.mode !== 'pending') {
        clickSuppressedRef.current = true;
        globalThis.setTimeout?.(() => { clickSuppressedRef.current = false; }, 0);
      }
      if (active.mode === 'swipe') {
        navigation.endDrag();
        clearMarquee();
        return;
      }
      if (active.mode === 'navigation' || navigationOnly) {
        navigation.endDrag(true);
        clearMarquee();
        return;
      }
      if (!active.moved) controller.replaceSelection([]);
      else {
        const left = (Math.min(origin.x, active.end.x) - field.left) / field.cellSize;
        const right = (Math.max(origin.x, active.end.x) - field.left) / field.cellSize;
        const top = (Math.min(origin.y, active.end.y) - field.top) / field.cellSize;
        const bottom = (Math.max(origin.y, active.end.y) - field.top) / field.cellSize;
        controller.replaceSelection(grid.placements.filter((entry) => !entry.locked && entry.column < right && entry.column + entry.columnSpan > left && entry.row < bottom && entry.row + entry.rowSpan > top).map(({ id }) => id));
      }
      clearMarquee();
    };
    const cancel = () => { clearMarquee(); navigation.endDrag(true); };
    marqueeRef.current = { cancel, end: origin, finish, mode: 'pending', move, moved: false, pointerId: event.pointerId };
    globalThis.addEventListener('pointermove', move, true);
    globalThis.addEventListener('pointerup', finish, true);
    globalThis.addEventListener('pointercancel', cancel, true);
  };

  const nudgeSelection = (delta) => {
    if (authoringDisabled) return false;
    const records = grid?.placements.filter(({ id, locked }) => controller.selectedPlacementIds.includes(id) && !locked) || [];
    if (!records.length) return false;
    if (records.length === 1) {
      const destination = nudgeSystemWorkflowPlacementGeometry(records[0], delta);
      return destination ? controller.run((session) => session.movePlacement({ gridId: grid.id, placementId: records[0].id, expectedStartGeometry: records[0], destination })) : false;
    }
    const request = createSystemWorkflowGroupMovementRequest(records, delta, grid.id);
    return request ? controller.run((session) => session.movePlacements(request)) : false;
  };

  useEffect(() => () => {
    clearGesture();
    clearMarquee();
  }, []);
  useEffect(() => {
    clearGesture(); if (!navigation.isDragging()) clearMarquee();
  }, [controller.draft.profileAddress, grid?.id]);
  useEffect(() => {
    if (!disabled && !authoringDisabled) return;
    clearGesture();
    clearMarquee();
  }, [authoringDisabled, disabled]);
  useEffect(() => {
    const editable = (event) => /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.target?.isContentEditable;
    const keydown = (event) => {
      const instance = canvasRef.current?.closest('[data-display-instance]');
      if (instance && !instance.hasAttribute('data-active-display')) return;
      if (event.target?.closest?.('[data-workbench-module]')) return;
      if (event.target?.closest?.('button, [role="button"]') && !canvasRef.current?.contains(event.target)) return;
      if (event.code !== 'Space' || editable(event) || disabled || cropSession) return;
      event.preventDefault();
      spacePressedRef.current = true;
      setSpaceNavigation(true);
    };
    const release = (event) => {
      if (event?.code && event.code !== 'Space') return;
      spacePressedRef.current = false;
      setSpaceNavigation(false);
      if (event?.type === 'blur') {
        clearGesture(); clearMarquee();
        navigation.endDrag(true);
      }
    };
    globalThis.addEventListener?.('keydown', keydown, true);
    globalThis.addEventListener?.('keyup', release, true);
    globalThis.addEventListener?.('blur', release);
    return () => {
      globalThis.removeEventListener?.('keydown', keydown, true);
      globalThis.removeEventListener?.('keyup', release, true);
      globalThis.removeEventListener?.('blur', release);
      spacePressedRef.current = false;
    };
  }, [cropSession, disabled]);
  return { beginCanvasSelection, beginPlacementGesture, clickSuppressedRef, gridSwipe, marquee, nudgeSelection, previewById, spaceNavigation };
}
