import { useEffect, useRef, useState } from 'react';
import {
  getPlacementBounds,
  getPlacementsInsideMarquee,
  movePlacementGroup,
  resizePlacementGroup,
} from './ownerShellSystemPlacementGeometry.js';

export default function useOwnerShellSystemPlacementInteraction({
  activePlacements,
  assets,
  canvasRef,
  cell,
  cropSession,
  onPlacementGeometryChange,
  onClearCanvas,
  presentationSession,
  preview,
  setPlacements,
}) {
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const placementGestureRef = useRef(null);
  const placementClickSuppressedRef = useRef(false);
  const marqueeRef = useRef(null);

  const selectedPlacementRecords = activePlacements.filter(({ id }) => selectedPlacementIds.includes(id));
  const selectedPlacements = selectedPlacementRecords.filter(({ locked }) => !locked);
  const selectedPlacement = activePlacements.find(({ id }) => id === selectedPlacementId) || selectedPlacementRecords[0] || null;
  const selectionBounds = getPlacementBounds(selectedPlacements);

  const replaceSelection = (ids, primaryId = ids.at(-1) || null) => {
    setSelectedPlacementIds(ids);
    setSelectedPlacementId(primaryId);
  };
  const clearSelection = () => replaceSelection([]);
  const selectPlacement = (placementId, additive = false) => {
    if (activePlacements.find(({ id }) => id === placementId)?.locked) return;
    if (!additive) {
      replaceSelection([placementId], placementId);
      return;
    }
    setSelectedPlacementIds((current) => {
      const exists = current.includes(placementId);
      const next = exists ? current.filter((id) => id !== placementId) : [...current, placementId];
      setSelectedPlacementId(exists ? next.at(-1) || null : placementId);
      return next;
    });
  };

  const cleanupPlacementGesture = () => {
    const gesture = placementGestureRef.current;
    if (!gesture) return;
    globalThis.removeEventListener('pointermove', gesture.listeners.move, true);
    globalThis.removeEventListener('pointerup', gesture.listeners.finish, true);
    globalThis.removeEventListener('pointercancel', gesture.listeners.cancel, true);
    globalThis.removeEventListener('keydown', gesture.listeners.escape, true);
    placementGestureRef.current = null;
  };
  const updatePlacementGesture = (event) => {
    const gesture = placementGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.hypot(dx, dy) > 6) gesture.moved = true;
    const updatedPlacements = gesture.kind === 'move'
      ? movePlacementGroup({ ...gesture, cell, dx, dy })
      : resizePlacementGroup({ ...gesture, assets, cell, dx, dy, preserveRatio: event.shiftKey });
    if (gesture.kind === 'resize') onPlacementGeometryChange?.(updatedPlacements.find(({ id }) => id === gesture.primaryPlacementId));
    const byId = new Map(updatedPlacements.map((placement) => [placement.id, placement]));
    setPlacements((current) => current.map((placement) => byId.get(placement.id) || placement));
  };
  const finishPlacementGesture = (event) => {
    const gesture = placementGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      placementClickSuppressedRef.current = true;
      globalThis.setTimeout(() => { placementClickSuppressedRef.current = false; }, 0);
    }
    cleanupPlacementGesture();
  };
  const cancelPlacementGesture = (event) => {
    const gesture = placementGestureRef.current;
    if (!gesture || (event.pointerId != null && gesture.pointerId !== event.pointerId)) return;
    const byId = new Map(gesture.placements.map((placement) => [placement.id, placement]));
    setPlacements((current) => current.map((placement) => byId.get(placement.id) || placement));
    cleanupPlacementGesture();
  };
  const cancelPlacementGestureOnEscape = (event) => {
    if (event.key === 'Escape') cancelPlacementGesture(event);
  };
  const beginPlacementGesture = (event, placement, kind = 'move', corner = null) => {
    if (placement.locked || preview || presentationSession || event.button !== 0) return;
    if (cropSession && (kind !== 'resize' || cropSession.placementId !== placement.id)) return;
    if (kind === 'move' && event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!canvas) return;
    const gesturePlacements = selectedPlacementIds.includes(placement.id) ? selectedPlacements : [placement];
    const bounds = getPlacementBounds(gesturePlacements);
    replaceSelection(selectedPlacementIds.includes(placement.id) ? selectedPlacementIds : [placement.id], placement.id);
    const listeners = {
      cancel: cancelPlacementGesture,
      escape: cancelPlacementGestureOnEscape,
      finish: finishPlacementGesture,
      move: updatePlacementGesture,
    };
    placementGestureRef.current = {
      bounds,
      canvas,
      corner,
      cropResize: Boolean(cropSession),
      kind,
      listeners,
      moved: false,
      placements: gesturePlacements.map((item) => ({ ...item })),
      pointerId: event.pointerId,
      primaryPlacementId: placement.id,
      startX: event.clientX,
      startY: event.clientY,
    };
    globalThis.addEventListener('pointermove', listeners.move, true);
    globalThis.addEventListener('pointerup', listeners.finish, true);
    globalThis.addEventListener('pointercancel', listeners.cancel, true);
    globalThis.addEventListener('keydown', listeners.escape, true);
  };

  const cleanupMarquee = () => {
    const gesture = marqueeRef.current;
    if (!gesture) return;
    globalThis.removeEventListener('pointermove', gesture.listeners.move, true);
    globalThis.removeEventListener('pointerup', gesture.listeners.finish, true);
    globalThis.removeEventListener('pointercancel', gesture.listeners.cancel, true);
    marqueeRef.current = null;
    setMarquee(null);
  };
  const updateMarquee = (event) => {
    const gesture = marqueeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const x = Math.max(0, Math.min(gesture.canvas.width, event.clientX - gesture.canvas.left));
    const y = Math.max(0, Math.min(gesture.canvas.height, event.clientY - gesture.canvas.top));
    const moved = gesture.moved || Math.hypot(x - gesture.startX, y - gesture.startY) > 6;
    Object.assign(gesture, { moved, x, y });
    if (moved) setMarquee({ height: Math.abs(y - gesture.startY), left: Math.min(x, gesture.startX), top: Math.min(y, gesture.startY), width: Math.abs(x - gesture.startX) });
  };
  const finishMarquee = (event) => {
    const gesture = marqueeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      const rectangle = { left: Math.min(gesture.x, gesture.startX), right: Math.max(gesture.x, gesture.startX), top: Math.min(gesture.y, gesture.startY), bottom: Math.max(gesture.y, gesture.startY) };
      const ids = getPlacementsInsideMarquee(activePlacements.filter(({ locked }) => !locked), rectangle);
      replaceSelection(ids);
    } else {
      clearSelection();
      onClearCanvas();
    }
    cleanupMarquee();
  };
  const cancelMarquee = (event) => {
    if (marqueeRef.current?.pointerId !== event.pointerId) return;
    cleanupMarquee();
  };
  const beginCanvasSelection = (event) => {
    if (event.target !== event.currentTarget || event.button !== 0 || preview || cropSession) return;
    event.preventDefault();
    const canvas = event.currentTarget.getBoundingClientRect();
    const listeners = { cancel: cancelMarquee, finish: finishMarquee, move: updateMarquee };
    marqueeRef.current = { canvas, listeners, moved: false, pointerId: event.pointerId, startX: event.clientX - canvas.left, startY: event.clientY - canvas.top, x: event.clientX - canvas.left, y: event.clientY - canvas.top };
    globalThis.addEventListener('pointermove', listeners.move, true);
    globalThis.addEventListener('pointerup', listeners.finish, true);
    globalThis.addEventListener('pointercancel', listeners.cancel, true);
  };

  useEffect(() => () => {
    const placementGesture = placementGestureRef.current;
    if (placementGesture) {
      globalThis.removeEventListener('pointermove', placementGesture.listeners.move, true);
      globalThis.removeEventListener('pointerup', placementGesture.listeners.finish, true);
      globalThis.removeEventListener('pointercancel', placementGesture.listeners.cancel, true);
      globalThis.removeEventListener('keydown', placementGesture.listeners.escape, true);
    }
    const marqueeGesture = marqueeRef.current;
    if (marqueeGesture) {
      globalThis.removeEventListener('pointermove', marqueeGesture.listeners.move, true);
      globalThis.removeEventListener('pointerup', marqueeGesture.listeners.finish, true);
      globalThis.removeEventListener('pointercancel', marqueeGesture.listeners.cancel, true);
    }
  }, []);

  useEffect(() => {
    const gesture = placementGestureRef.current;
    if (!cropSession && gesture?.cropResize) cleanupPlacementGesture();
  }, [cropSession]);

  return {
    beginCanvasSelection,
    beginPlacementGesture,
    clearSelection,
    marquee,
    placementClickSuppressedRef,
    replaceSelection,
    selectedPlacement,
    selectedPlacementId,
    selectedPlacementIds,
    selectedPlacements,
    selectionBounds,
    selectPlacement,
  };
}
