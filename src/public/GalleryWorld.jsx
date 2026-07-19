import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FramedArtwork from './FramedArtwork.jsx';
import { clampGalleryCamera, createGalleryLayout } from './galleryLayout.js';
import { getSpatialGridOffset, panSpatialCamera } from './spatialWorldCamera.js';
import './galleryWorld.css';

const EMPTY_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

function GalleryFloorGrid({ width, height, offset }) {
  const spacing = 80;
  const columnCount = Math.ceil(width / spacing) + 6;
  const horizontalCount = 8;
  const shiftedOffset = ((offset % spacing) + spacing) % spacing;
  return <svg className="gallery-world__floor-grid" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
    <g className="gallery-world__floor-columns">
      {Array.from({ length: columnCount }, (_, index) => {
        const wallX = (index - 3) * spacing + shiftedOffset;
        const bottomX = width / 2 + (wallX - width / 2) * 1.48;
        return <line key={wallX} x1={wallX} y1="0" x2={bottomX} y2={height} />;
      })}
    </g>
    <g className="gallery-world__floor-depth">
      {Array.from({ length: horizontalCount }, (_, index) => {
        const progress = (index + 1) / horizontalCount;
        const y = Math.round(height * Math.pow(progress, 1.35));
        return <line key={y} x1="0" y1={y} x2={width} y2={y} />;
      })}
    </g>
  </svg>;
}

export default function GalleryWorld({ objects, assets, theme, onOpenArtwork, onExit, onMoveKeeper, onMoveKeeperHorizontally }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? EMPTY_VIEWPORT.width : window.innerWidth,
    height: typeof window === 'undefined' ? EMPTY_VIEWPORT.height : window.innerHeight
  }));
  const [cameraX, setCameraX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const layout = useMemo(() => createGalleryLayout(objects, viewport), [objects, viewport]);

  const moveCamera = useCallback((nextOrUpdater, direction = 0) => {
    setCameraX((current) => clampGalleryCamera(
      typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater,
      layout.maxCameraX
    ));
    if (direction) onMoveKeeperHorizontally?.(direction > 0 ? viewport.width * 0.66 : viewport.width * 0.34);
  }, [layout.maxCameraX, onMoveKeeperHorizontally, viewport.width]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const measure = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => setCameraX((current) => clampGalleryCamera(current, layout.maxCameraX)), [layout.maxCameraX]);

  useEffect(() => {
    const keydown = (event) => {
      if (event.target.closest?.('input,select,textarea')) return;
      if (event.key === 'Escape') { event.preventDefault(); onExit(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') moveCamera(0, -1);
      else if (event.key === 'End') moveCamera(layout.maxCameraX, 1);
      else { const direction = event.key === 'ArrowRight' ? 1 : -1; moveCamera((current) => current + direction * Math.max(180, viewport.width * 0.22), direction); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [layout.maxCameraX, moveCamera, onExit, viewport.width]);

  const handleWheel = (event) => {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    moveCamera((current) => current + delta, Math.sign(delta));
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest?.('button,a,.canvas-artwork')) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    const verticalDistance = event.clientY - drag.startY;
    drag.moved ||= Math.hypot(distance, verticalDistance) > 5;
    const nextCamera = panSpatialCamera(
      { x: drag.cameraX, y: 0 },
      { x: drag.startX, y: drag.startY },
      { x: event.clientX, y: event.clientY },
      { minX: 0, maxX: layout.maxCameraX, minY: 0, maxY: 0 }
    );
    moveCamera(nextCamera.x, -Math.sign(distance));
  };

  const finishPointer = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (!drag.moved) {
      onMoveKeeper?.(event.clientX, Math.min(event.clientY, layout.horizon - 32));
    }
  };

  const gridOffset = getSpatialGridOffset({ x: cameraX, y: 0 }, 80).x;
  const progress = layout.maxCameraX ? cameraX / layout.maxCameraX : 0;
  const portalTarget = typeof document === 'undefined' ? null : document.querySelector('.application-root');
  const worldTheme = { ...theme, '--module-accent': theme?.['--hu-accent-primary'] || '#e87945' };
  const backdrop = <div className="gallery-world-backdrop" aria-hidden="true" style={{ ...worldTheme, '--gallery-grid-offset': `${gridOffset}px`, '--gallery-horizon': `${layout.horizon}px` }}>
    <div className="gallery-world__shader-glass" />
    <div className="gallery-world__wall" />
    <div className="gallery-world__horizon" />
    <div className="gallery-world__floor"><GalleryFloorGrid width={viewport.width} height={Math.max(1, viewport.height - layout.horizon)} offset={gridOffset} /></div>
  </div>;

  const gallery = <section
    ref={viewportRef}
    className="gallery-world"
    data-dragging={dragging || undefined}
    aria-label="Side-scrolling creations gallery"
    tabIndex="-1"
    style={{ ...worldTheme, '--gallery-horizon': `${layout.horizon}px` }}
    onWheel={handleWheel}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={finishPointer}
    onPointerCancel={finishPointer}
    onLostPointerCapture={finishPointer}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
  >
    <div className="gallery-world__track" style={{ width: layout.worldWidth, transform: `translate3d(${-cameraX}px,0,0)` }}>
      {layout.items.map(({ object, left, top, width, height }) => {
        const asset = assets.find((entry) => entry.id === object.stableAssetId) || null;
        return <FramedArtwork key={object.id} object={object} asset={asset} arranging={false} selected={false}
          style={{ left, top, width, height, zIndex: 12 + object.presentationOrder }}
          onActivate={() => onOpenArtwork(object.id)} />;
      })}
      <span className="gallery-world__origin" aria-hidden="true">GALLERY / 00</span>
      <span className="gallery-world__terminus" aria-hidden="true" style={{ left: layout.worldWidth - 220 }}>END OF EXHIBITION</span>
    </div>
    {!layout.items.length && <div className="gallery-world__empty"><strong>Gallery awaiting works</strong><span>Add framed artwork to the desktop to populate this wall.</span></div>}
    <nav className="gallery-world__controls" aria-label="Gallery movement">
      <button type="button" onClick={() => moveCamera((current) => current - viewport.width * 0.7, -1)} aria-label="Move gallery left">←</button>
      <span>Drag · Scroll · Arrow keys</span>
      <button type="button" onClick={() => moveCamera((current) => current + viewport.width * 0.7, 1)} aria-label="Move gallery right">→</button>
    </nav>
    <div className="gallery-world__progress" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0.025, progress)})` }} /></div>
  </section>;

  // The gallery is a world layer, not interface chrome. Portaling both its
  // architecture and artwork beside the Pixi canvas gives us a real compositor:
  // architecture/artwork -> resident canvas -> fixed public interface.
  return portalTarget ? createPortal(<>{backdrop}{gallery}</>, portalTarget) : gallery;
}
