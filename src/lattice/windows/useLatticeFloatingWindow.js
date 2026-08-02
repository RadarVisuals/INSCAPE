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
} = {}) {
  const [viewport, setViewport] = useState(getViewportSize);
  const [windowSize, setWindowSize] = useState(() => initialLatticeFloatingWindowSize(getViewportSize()));
  const [windowPosition, setWindowPosition] = useState(() => {
    const initialViewport = getViewportSize();
    const initialSize = initialLatticeFloatingWindowSize(initialViewport);
    return initialLatticeFloatingWindowPosition(initialSize, initialViewport);
  });
  const resizeGestureRef = useRef(null);
  const moveGestureRef = useRef(null);

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

  const beginMove = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    const rectangle = event.currentTarget.closest('[data-lattice-chrome]')?.getBoundingClientRect();
    moveGestureRef.current = {
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
    setWindowPosition(moveLatticeFloatingWindow(gesture.position, {
      x: event.clientX - gesture.point.x,
      y: event.clientY - gesture.point.y,
    }, gesture.size, viewport));
  };
  const finishMove = (event) => {
    const gesture = moveGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    releaseLatticeFloatingWindowPointer(event);
    moveGestureRef.current = null;
  };

  return {
    move: { begin: beginMove, finish: finishMove, update: updateMove },
    rackWidthResize: {
      begin: beginWidthResize, finish: finishResize, keyDown: resizeWidthByKey, update: updateWidthResize,
    },
    resize: { begin: beginResize, finish: finishResize, keyDown: resizeByKey, update: updateResize },
    windowPosition,
    windowSize,
  };
}
