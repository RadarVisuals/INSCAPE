import { useEffect, useRef, useState } from 'react';
import {
  createPlacementFromAssetDrop,
  placementRectangleFromPointer,
} from './ownerShellSystemPlacementGeometry.js';

const DRAG_THRESHOLD = 6;

export default function useOwnerShellSystemAssetPlacement({
  activeTableId,
  canvasRef,
  cell,
  preview,
  replaceSelection,
  setPlacements,
}) {
  const [drag, setDrag] = useState(null);
  const gestureRef = useRef(null);

  const beginAssetDrag = (event, asset) => {
    if (event.button !== 0 || preview) return;
    const gesture = {
      asset,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    const rectangleAt = (pointerEvent) => placementRectangleFromPointer({
      asset,
      bounds: canvasRef.current?.getBoundingClientRect(),
      cell,
      clientX: pointerEvent.clientX,
      clientY: pointerEvent.clientY,
    });
    const cleanup = () => {
      globalThis.removeEventListener('pointermove', move, true);
      globalThis.removeEventListener('pointerup', finish, true);
      globalThis.removeEventListener('pointercancel', cancel, true);
      if (gestureRef.current === gesture) gestureRef.current = null;
      setDrag(null);
    };
    const move = (pointerEvent) => {
      if (pointerEvent.pointerId !== gesture.pointerId) return;
      if (Math.hypot(pointerEvent.clientX - gesture.startX, pointerEvent.clientY - gesture.startY) > DRAG_THRESHOLD) gesture.moved = true;
      setDrag({ asset, moved: gesture.moved, previewRectangle: gesture.moved ? rectangleAt(pointerEvent) : null });
    };
    const finish = (pointerEvent) => {
      if (pointerEvent.pointerId !== gesture.pointerId) return;
      const rectangle = gesture.moved ? rectangleAt(pointerEvent) : null;
      if (rectangle) {
        const placement = createPlacementFromAssetDrop({ asset, rectangle, stamp: Date.now(), tableId: activeTableId });
        setPlacements((current) => [...current, placement]);
        replaceSelection([placement.id], placement.id);
      }
      cleanup();
    };
    const cancel = (pointerEvent) => {
      if (pointerEvent.pointerId === gesture.pointerId) cleanup();
    };
    gesture.cleanup = cleanup;
    gestureRef.current = gesture;
    setDrag({ asset, moved: false, previewRectangle: null });
    globalThis.addEventListener('pointermove', move, true);
    globalThis.addEventListener('pointerup', finish, true);
    globalThis.addEventListener('pointercancel', cancel, true);
  };

  useEffect(() => () => gestureRef.current?.cleanup(), []);

  return { beginAssetDrag, drag };
}
