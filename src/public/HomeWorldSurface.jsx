import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clampVerticalHomeWorldCamera } from './homeWorldCamera.js';
import { exceedsSpatialPointerDragThreshold, finalizeSpatialPointer, getCenteredHorizontalGridOffset } from './spatialWorldCamera.js';
import './homeWorld.css';

export default function HomeWorldSurface({ camera, geometry, world, gridVisible, theme, visible, transitionPhase = 'home', gridPhaseX = 0, onCameraChange, onMoveKeeper, onOpenContextMenu, narrowGestureRef }) {
  const surfaceRef = useRef(null);
  const pointerRef = useRef(null);
  const narrow = geometry.narrow;
  const gridSpacing = narrow ? 56 : 80;
  // The grid lives inside the camera-transformed world, so compensate for
  // that parent translation before placing its center line in screen space.
  const gridOffset = getCenteredHorizontalGridOffset(-(camera.x + gridPhaseX), geometry.width, gridSpacing);
  const worldTheme = { ...theme, '--module-accent': theme?.['--os-accent'] || '#e87945' };

  const handlePointerDown = (event) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || event.isPrimary === false || event.target.closest?.('button')) return;
    if (event.pointerType !== 'mouse' && narrowGestureRef?.current) {
      narrowGestureRef.current.activePointers.add(event.pointerId);
      if (narrowGestureRef.current.activePointers.size > 1) narrowGestureRef.current.multiTouch = true;
    }
    pointerRef.current = {
      pointerId: event.pointerId,
      originPointer: { x: event.clientX, y: event.clientY },
      moved: false,
      multiTouch: false
    };
  };

  const handlePointerMove = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointer.moved ||= exceedsSpatialPointerDragThreshold(pointer.originPointer, { x: event.clientX, y: event.clientY });
  };

  const handleWheel = (event) => {
    if (narrow) return;
    event.preventDefault();
    if (event.ctrlKey || event.deltaY === 0) return;
    onCameraChange(clampVerticalHomeWorldCamera({ ...camera, y: camera.y + event.deltaY }, world, camera.x));
  };

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || narrow) return undefined;
    surface.addEventListener('wheel', handleWheel, { passive: false });
    return () => surface.removeEventListener('wheel', handleWheel);
  }, [camera, narrow, world]);

  const finishPointer = (event, cancelled = false) => {
    const result = finalizeSpatialPointer({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      drag: pointerRef.current,
      sharedGesture: narrow ? narrowGestureRef?.current : null,
      cancelled
    });
    pointerRef.current = result.drag;
    if (result.shouldActivate) onMoveKeeper?.(event.clientX, event.clientY);
  };

  const root = typeof document === 'undefined' ? null : document.querySelector('.application-root');
  const surface = <section
    ref={surfaceRef}
    className="home-world-surface"
    data-desktop-canvas
    data-visible={visible || undefined}
    data-gallery-transition={transitionPhase}
    aria-label="Vertically scrolling home world"
    style={worldTheme}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={finishPointer}
    onPointerCancel={(event) => finishPointer(event, true)}
    onLostPointerCapture={(event) => finishPointer(event, true)}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onOpenContextMenu?.(event); }}
  >
    <div className="home-world-surface__world" style={{width:world.width,height:world.height,transform:`translate3d(${-camera.x}px,${-camera.y}px,0)`}}>
      {gridVisible && <div className="home-world-surface__grid" aria-hidden="true" style={{ '--home-grid-offset': `${gridOffset}px` }} />}
    </div>
  </section>;

  return root ? createPortal(surface, root) : surface;
}
