import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FramedArtwork from './FramedArtwork.jsx';
import { clampGalleryCamera, createGalleryLayout, galleryPlacementFromPoint, moveGalleryGeometry, resizeGalleryGeometry } from './galleryLayout.js';
import { getCenteredHorizontalGridOffset, panSpatialCamera } from './spatialWorldCamera.js';
import './galleryWorld.css';

const EMPTY_VIEWPORT = Object.freeze({ width: 1280, height: 720 });
const KEEPER_DIRECTION_REVERSAL_THRESHOLD = 12;

function GalleryFloorGrid({ width, height, offset, spacing }) {
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

export default function GalleryWorld({ objects, assets, assetStatus = 'ready', theme, spatialTheme = 'dark', ownerAuthoringEnabled = false, selectedArtworkId = null, presentationPreview = null, transitionPhase = 'gallery', gridPhaseX = 0, gridOffsetY = 0, renderImage, onOpenArtwork, onSelectArtwork, onOpenContextMenu, onChangeArtworkGeometry, onRemoveArtwork, onRegisterArtworkElement, onExit, onCameraXChange, onMoveKeeper, onMoveKeeperHorizontally }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const artworkInteractionRef = useRef(null);
  const suppressArtworkActivationRef = useRef(false);
  const previousCameraXRef = useRef(0);
  const previousSceneScaleRef = useRef(1);
  const keeperDirectionRef = useRef(0);
  const pendingKeeperDirectionRef = useRef(0);
  const pendingKeeperDistanceRef = useRef(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? EMPTY_VIEWPORT.width : window.innerWidth,
    height: typeof window === 'undefined' ? EMPTY_VIEWPORT.height : window.innerHeight
  }));
  const [cameraX, setCameraX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [artworkInteraction, setArtworkInteraction] = useState(null);
  const effectiveObjects = useMemo(() => objects.map((object) => {
    let effective = presentationPreview?.id === object.id ? { ...object, presentation: { ...object.presentation, ...presentationPreview.patch } } : object;
    if (artworkInteraction?.id === object.id) effective = {
      ...effective,
      placement: { column: artworkInteraction.geometry.column, row: artworkInteraction.geometry.row },
      span: { columns: artworkInteraction.geometry.columnSpan, rows: artworkInteraction.geometry.rowSpan }
    };
    return effective;
  }), [artworkInteraction, objects, presentationPreview]);
  const layout = useMemo(() => createGalleryLayout(effectiveObjects, viewport), [effectiveObjects, viewport]);

  const moveCamera = useCallback((nextOrUpdater) => {
    setCameraX((current) => clampGalleryCamera(
      typeof nextOrUpdater === 'function' ? nextOrUpdater(current) : nextOrUpdater,
      layout.maxCameraX
    ));
  }, [layout.maxCameraX]);

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

  useEffect(() => () => dragRef.current?.cleanup?.(), []);

  useEffect(() => {
    const previousScale = previousSceneScaleRef.current || 1;
    const nextScale = layout.sceneScale || 1;
    previousSceneScaleRef.current = nextScale;
    setCameraX((current) => {
      const nextCamera = clampGalleryCamera(current * nextScale / previousScale, layout.maxCameraX);
      // Resizing the viewport must not look like navigation to the Keeper.
      previousCameraXRef.current = nextCamera;
      return nextCamera;
    });
  }, [layout.maxCameraX, layout.sceneScale]);

  useEffect(() => {
    const cameraDelta = cameraX - previousCameraXRef.current;
    const direction = Math.sign(cameraDelta);
    previousCameraXRef.current = cameraX;
    onCameraXChange?.(cameraX);
    if (!direction) return;

    const reversingDuringPointerDrag = Boolean(dragRef.current)
      && keeperDirectionRef.current
      && direction !== keeperDirectionRef.current;

    if (!reversingDuringPointerDrag) {
      keeperDirectionRef.current = direction;
      pendingKeeperDirectionRef.current = 0;
      pendingKeeperDistanceRef.current = 0;
    } else {
      if (pendingKeeperDirectionRef.current !== direction) {
        pendingKeeperDirectionRef.current = direction;
        pendingKeeperDistanceRef.current = 0;
      }
      pendingKeeperDistanceRef.current += Math.abs(cameraDelta);
      if (pendingKeeperDistanceRef.current < KEEPER_DIRECTION_REVERSAL_THRESHOLD) return;
      keeperDirectionRef.current = direction;
      pendingKeeperDirectionRef.current = 0;
      pendingKeeperDistanceRef.current = 0;
    }

    onMoveKeeperHorizontally?.(
      direction > 0 ? viewport.width * 0.66 : viewport.width * 0.34,
      direction
    );
  }, [cameraX, onCameraXChange, onMoveKeeperHorizontally, viewport.width]);

  useEffect(() => {
    const keydown = (event) => {
      if (event.defaultPrevented) return;
      if (event.target.closest?.('input,select,textarea')) return;
      if (event.key === 'Escape') { event.preventDefault(); onExit(); return; }
      if (event.key === 'Delete' && ownerAuthoringEnabled && selectedArtworkId) { event.preventDefault(); onRemoveArtwork?.(selectedArtworkId); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') moveCamera(0);
      else if (event.key === 'End') moveCamera(layout.maxCameraX);
      else { const direction = event.key === 'ArrowRight' ? 1 : -1; moveCamera((current) => current + direction * Math.max(180, viewport.width * 0.22)); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [layout.maxCameraX, moveCamera, onExit, onRemoveArtwork, ownerAuthoringEnabled, selectedArtworkId, viewport.width]);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    moveCamera((current) => current + delta);
  }, [moveCamera]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const artwork = event.target.closest?.('.canvas-artwork');
    if (event.target.closest?.('a') || artwork && artwork.dataset.locked !== 'true' || !artwork && event.target.closest?.('button')) return;
    const captureTarget = artwork?.querySelector?.('.canvas-artwork__surface') || event.currentTarget;
    const move = (pointerEvent) => handlePointerMove(pointerEvent);
    const finish = (pointerEvent) => finishPointer(pointerEvent);
    const cleanup = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      captureTarget.removeEventListener('lostpointercapture', finish);
    };
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX, moved: false, artworkId: artwork?.dataset.canvasObjectId || null, cleanup };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    captureTarget.addEventListener('lostpointercapture', finish);
    captureTarget.setPointerCapture?.(event.pointerId);
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
    moveCamera(nextCamera.x);
  };

  const finishPointer = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.cleanup?.();
    dragRef.current = null;
    setDragging(false);
    if (drag.moved && drag.artworkId) suppressArtworkActivationRef.current = true;
    if (!drag.moved && !drag.artworkId) {
      onSelectArtwork?.(null);
      onMoveKeeper?.(event.clientX, Math.min(event.clientY, layout.horizon - 32));
    }
  };

  const beginArtworkInteraction = (event, object, kind) => {
    if (!ownerAuthoringEnabled || object.locked || event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectArtwork?.(object.id);
    artworkInteractionRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, object, kind, corner: event.currentTarget.dataset.resizeCorner || null, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveArtworkInteraction = (event) => {
    const active = artworkInteractionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = { x: event.clientX - active.startX, y: event.clientY - active.startY };
    active.moved ||= Math.hypot(delta.x, delta.y) > 4;
    if (!active.moved) return;
    const geometry = active.kind === 'resize'
      ? resizeGalleryGeometry(active.object, delta, layout, active.corner)
      : moveGalleryGeometry(active.object, delta, layout);
    active.geometry = geometry;
    setArtworkInteraction({ id: active.object.id, geometry });
  };

  const finishArtworkInteraction = (event) => {
    const active = artworkInteractionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    artworkInteractionRef.current = null;
    if (active.moved && active.geometry) {
      suppressArtworkActivationRef.current = true;
      onChangeArtworkGeometry?.(active.object.id, active.geometry);
    }
    setArtworkInteraction(null);
  };

  const openWallContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!ownerAuthoringEnabled) return;
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const placement = galleryPlacementFromPoint({
      worldX: event.clientX - bounds.left + cameraX,
      viewportY: event.clientY - bounds.top,
      span: { columns: 4, rows: 4 }
    }, layout);
    onSelectArtwork?.(null);
    onOpenContextMenu?.(event, { type: 'gallery-canvas', id: 'gallery-canvas', placement });
  };

  const gridSpacing = layout.gridSpacing;
  const gridOffset = getCenteredHorizontalGridOffset(cameraX - gridPhaseX, viewport.width, gridSpacing);
  const progress = layout.maxCameraX ? cameraX / layout.maxCameraX : 0;
  const portalTarget = typeof document === 'undefined' ? null : document.querySelector('.application-root');
  const worldTheme = { ...theme, '--module-accent': 'var(--color-text-primary)' };
  const backdrop = <div className="gallery-world-backdrop" aria-hidden="true" data-spatial-theme={spatialTheme} data-transition-phase={transitionPhase} style={{ ...worldTheme, '--gallery-grid-offset': `${gridOffset}px`, '--gallery-grid-offset-y': `${gridOffsetY}px`, '--gallery-grid-size': `${gridSpacing}px`, '--gallery-horizon': `${layout.horizon}px` }}>
    <div className="gallery-world__shader-glass" />
    <div className="gallery-world__wall" />
    <div className="gallery-world__horizon" />
    <div className="gallery-world__floor"><GalleryFloorGrid width={viewport.width} height={Math.max(1, viewport.height - layout.horizon)} offset={gridOffset} spacing={gridSpacing} /></div>
  </div>;

  const gallery = <section
    ref={viewportRef}
    className="gallery-world"
    data-dragging={dragging || undefined}
    data-transition-phase={transitionPhase}
    data-spatial-theme={spatialTheme}
    aria-label="Side-scrolling creations gallery"
    tabIndex="-1"
    style={{ ...worldTheme, '--gallery-horizon': `${layout.horizon}px` }}
    onPointerDown={handlePointerDown}
    onContextMenu={openWallContextMenu}
  >
    <div className="gallery-world__track" style={{ width: layout.worldWidth, transform: `translate3d(${-cameraX}px,0,0)` }}>
      {layout.items.map(({ object, left, top, width, height }) => {
        const asset = assets.find((entry) => entry.id === object.stableAssetId) || null;
        const arranging = ownerAuthoringEnabled && !object.locked && selectedArtworkId === object.id;
        return <FramedArtwork key={object.id} object={object} asset={asset} arranging={arranging} selected={selectedArtworkId === object.id && !object.locked}
          style={{ left, top, width, height, zIndex: 12 + object.presentationOrder }}
          resolving={!asset && ['idle', 'loading'].includes(assetStatus)}
          showVisibility={ownerAuthoringEnabled}
          renderImage={renderImage}
          containerRef={(node) => onRegisterArtworkElement?.(object.id, node)}
          interactionProps={{
            onPointerDown: (event) => beginArtworkInteraction(event, object, 'move'),
            onPointerMove: moveArtworkInteraction,
            onPointerUp: finishArtworkInteraction,
            onPointerCancel: finishArtworkInteraction,
            onLostPointerCapture: finishArtworkInteraction
          }}
          resizeProps={{
            onPointerDown: (event) => beginArtworkInteraction(event, object, 'resize'),
            onPointerMove: moveArtworkInteraction,
            onPointerUp: finishArtworkInteraction,
            onPointerCancel: finishArtworkInteraction,
            onLostPointerCapture: finishArtworkInteraction
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!ownerAuthoringEnabled) return;
            onSelectArtwork?.(object.locked ? null : object.id);
            onOpenContextMenu?.(event, { type: 'gallery-object', id: object.id });
          }}
          onActivate={(event) => {
            if (suppressArtworkActivationRef.current) { suppressArtworkActivationRef.current = false; return; }
            if (ownerAuthoringEnabled && !object.locked) { onSelectArtwork?.(object.id); return; }
            onOpenArtwork(object.id, event.currentTarget);
          }} />;
      })}
      <span className="gallery-world__origin" aria-hidden="true">GALLERY / 00</span>
      <span className="gallery-world__terminus" aria-hidden="true" style={{ left: layout.worldWidth - 220 }}>END OF EXHIBITION</span>
    </div>
    {!layout.items.length && <div className="gallery-world__empty"><strong>Gallery awaiting works</strong><span>{ownerAuthoringEnabled ? 'Right-click the wall to add artwork.' : 'No public works have been installed.'}</span></div>}
    <button className="gallery-world__exit" type="button" onClick={onExit} aria-label="Exit gallery">EXIT</button>
    <nav className="gallery-world__controls" aria-label="Gallery movement">
      <button type="button" onClick={() => moveCamera((current) => current - viewport.width * 0.7)} aria-label="Move gallery left">‹</button>
      <span>Drag · Scroll · Arrow keys</span>
      <button type="button" onClick={() => moveCamera((current) => current + viewport.width * 0.7)} aria-label="Move gallery right">›</button>
    </nav>
    <div className="gallery-world__progress" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0.025, progress)})` }} /></div>
  </section>;

  // The gallery is a world layer, not interface chrome. Portaling both its
  // architecture and artwork beside the Pixi canvas gives us a real compositor:
  // architecture/artwork -> resident canvas -> fixed public interface.
  return portalTarget ? createPortal(<>{backdrop}{gallery}</>, portalTarget) : gallery;
}
