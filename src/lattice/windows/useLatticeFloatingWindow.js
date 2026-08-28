import { useEffect, useRef, useState } from 'react';
import {
  LATTICE_FLOATING_WINDOW_RESIZE_STEP,
  clampLatticeFloatingWindowPosition,
  clampLatticeFloatingWindowSize,
  initialLatticeFloatingWindowPosition,
  initialLatticeFloatingWindowSize,
  moveLatticeFloatingWindow,
  positionLatticeFloatingWindowAfterCenteredResize,
  resizeLatticeFloatingWindowAroundCenter,
  resizeLatticeFloatingWindowByKey,
  resizeLatticeFloatingWindowRightEdge,
} from './latticeFloatingWindowModel.js';

export const readLatticeFloatingWindowViewport = () => ({
  height: globalThis.innerHeight || 720,
  width: globalThis.innerWidth || 1280,
});

export const LATTICE_FLOATING_WINDOW_MOVE_CLICK_THRESHOLD = 3;

export function captureLatticeFloatingWindowPointer(event) {
  event.currentTarget.setPointerCapture(event.pointerId);
}

export function releaseLatticeFloatingWindowPointer(event) {
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

export function markLatticeFloatingWindowResizing(element, resizing) {
  if (!element) return;
  if (resizing) element.dataset.resizing = '';
  else element.removeAttribute('data-resizing');
}

export default function useLatticeFloatingWindow({
  getViewportSize = readLatticeFloatingWindowViewport,
  initialSize = null,
} = {}) {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) {
    const initialViewport = getViewportSize();
    const resolvedInitialSize = initialSize
      ? clampLatticeFloatingWindowSize(initialSize, initialViewport)
      : initialLatticeFloatingWindowSize(initialViewport);
    initialStateRef.current = {
      position: initialLatticeFloatingWindowPosition(resolvedInitialSize, initialViewport),
      size: resolvedInitialSize,
      viewport: initialViewport,
    };
  }
  const [viewport, setViewport] = useState(initialStateRef.current.viewport);
  const [windowSize, setWindowSize] = useState(initialStateRef.current.size);
  const [windowPosition, setWindowPosition] = useState(initialStateRef.current.position);
  const resizeGestureRef = useRef(null);
  const moveGestureRef = useRef(null);
  const suppressMoveClickRef = useRef(false);
  const suppressMoveClickTimeoutRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = getViewportSize();
      setViewport(nextViewport);
      setWindowSize((current) => {
        const nextSize = clampLatticeFloatingWindowSize(current, nextViewport);
        setWindowPosition((position) => clampLatticeFloatingWindowPosition(position, nextSize, nextViewport));
        return nextSize;
      });
    };
    globalThis.addEventListener?.('resize', handleResize);
    return () => globalThis.removeEventListener?.('resize', handleResize);
  }, [getViewportSize]);

  useEffect(() => () => globalThis.clearTimeout(suppressMoveClickTimeoutRef.current), []);

  const beginResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    captureLatticeFloatingWindowPointer(event);
    const rack = event.currentTarget.closest('[data-lattice-chrome]');
    markLatticeFloatingWindowResizing(rack, true);
    resizeGestureRef.current = {
      point: { x: event.clientX, y: event.clientY }, position: windowPosition, rack, size: windowSize,
    };
  };
  const updateResize = (event) => {
    const gesture = resizeGestureRef.current;
    if (!gesture || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const nextSize = resizeLatticeFloatingWindowAroundCenter(gesture.size,
      { x: event.clientX - gesture.point.x, y: event.clientY - gesture.point.y }, viewport);
    setWindowSize(nextSize);
    setWindowPosition(positionLatticeFloatingWindowAfterCenteredResize(
      gesture.position,
      gesture.size,
      nextSize,
      viewport,
    ));
  };
  const finishResize = (event) => {
    releaseLatticeFloatingWindowPointer(event);
    markLatticeFloatingWindowResizing(resizeGestureRef.current?.rack, false);
    resizeGestureRef.current = null;
  };
  const beginWidthResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    captureLatticeFloatingWindowPointer(event);
    const rack = event.currentTarget.closest('[data-lattice-chrome]');
    markLatticeFloatingWindowResizing(rack, true);
    resizeGestureRef.current = {
      axis: 'width', point: { x: event.clientX, y: event.clientY }, position: windowPosition, rack, size: windowSize,
    };
  };
  const updateWidthResize = (event) => {
    const gesture = resizeGestureRef.current;
    if (gesture?.axis !== 'width' || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const nextSize = resizeLatticeFloatingWindowRightEdge(
      gesture.size,
      event.clientX - gesture.point.x,
      viewport,
    );
    setWindowSize(nextSize);
    setWindowPosition(clampLatticeFloatingWindowPosition(gesture.position, nextSize, viewport));
  };
  const resizeWidthByKey = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const nextSize = resizeLatticeFloatingWindowRightEdge(
      windowSize,
      direction * LATTICE_FLOATING_WINDOW_RESIZE_STEP,
      viewport,
    );
    event.preventDefault();
    event.stopPropagation();
    setWindowSize(nextSize);
    setWindowPosition((position) => clampLatticeFloatingWindowPosition(position, nextSize, viewport));
  };
  const resizeByKey = (event) => {
    const nextSize = resizeLatticeFloatingWindowByKey(windowSize, event.key, viewport);
    if (!nextSize) return;
    event.preventDefault();
    event.stopPropagation();
    setWindowSize(nextSize);
    setWindowPosition((position) => positionLatticeFloatingWindowAfterCenteredResize(
      position,
      windowSize,
      nextSize,
      viewport,
    ));
  };

  const beginMove = (event, { allowInteractiveTarget = false } = {}) => {
    if (event.button !== 0 || (!allowInteractiveTarget && event.target.closest('button'))) return;
    event.preventDefault();
    event.stopPropagation();
    globalThis.clearTimeout(suppressMoveClickTimeoutRef.current);
    suppressMoveClickRef.current = false;
    const rectangle = event.currentTarget.closest('[data-lattice-chrome]')?.getBoundingClientRect();
    moveGestureRef.current = {
      allowInteractiveTarget,
      moved: false,
      point: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
      position: windowPosition,
      size: rectangle ? { height: rectangle.height, width: rectangle.width } : windowSize,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const updateMove = (event) => {
    const gesture = moveGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const delta = {
      x: event.clientX - gesture.point.x,
      y: event.clientY - gesture.point.y,
    };
    if (Math.abs(delta.x) + Math.abs(delta.y) > LATTICE_FLOATING_WINDOW_MOVE_CLICK_THRESHOLD) {
      gesture.moved = true;
    }
    setWindowPosition(moveLatticeFloatingWindow(gesture.position, {
      x: delta.x,
      y: delta.y,
    }, gesture.size, viewport));
  };
  const finishMove = (event) => {
    const gesture = moveGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    moveGestureRef.current = null;
    suppressMoveClickRef.current = event.type === 'pointerup'
      && gesture.allowInteractiveTarget && gesture.moved;
    if (suppressMoveClickRef.current) {
      suppressMoveClickTimeoutRef.current = globalThis.setTimeout(() => {
        suppressMoveClickRef.current = false;
        suppressMoveClickTimeoutRef.current = null;
      }, 0);
    }
    releaseLatticeFloatingWindowPointer(event);
  };
  const cancelMove = (event) => {
    const gesture = moveGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    moveGestureRef.current = null;
    globalThis.clearTimeout(suppressMoveClickTimeoutRef.current);
    suppressMoveClickTimeoutRef.current = null;
    suppressMoveClickRef.current = false;
    releaseLatticeFloatingWindowPointer(event);
  };
  const consumeMoveClickSuppression = () => {
    const suppressed = suppressMoveClickRef.current;
    globalThis.clearTimeout(suppressMoveClickTimeoutRef.current);
    suppressMoveClickTimeoutRef.current = null;
    suppressMoveClickRef.current = false;
    return suppressed;
  };

  return {
    move: {
      begin: beginMove,
      cancel: cancelMove,
      consumeClickSuppression: consumeMoveClickSuppression,
      finish: finishMove,
      update: updateMove,
    },
    rackWidthResize: {
      begin: beginWidthResize, finish: finishResize, keyDown: resizeWidthByKey, update: updateWidthResize,
    },
    resize: { begin: beginResize, finish: finishResize, keyDown: resizeByKey, update: updateResize },
    windowPosition,
    windowSize,
  };
}
