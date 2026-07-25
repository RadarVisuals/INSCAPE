import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { exceedsSpatialPointerDragThreshold, finalizeSpatialPointer, getCenteredHorizontalGridOffset } from './spatialWorldCamera.js';
import './upperWorld.css';

const EMPTY_VIEWPORT = Object.freeze({ width: 1280, height: 720 });

function UpperPerspectiveGrid({ width, height, offset, spacing }) {
  const columnCount = Math.ceil(width / spacing) + 6;
  const shiftedOffset = ((offset % spacing) + spacing) % spacing;
  return <svg className="upper-world__perspective-grid" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
    <g>
      {Array.from({ length: columnCount }, (_, index) => {
        const wallX = (index - 3) * spacing + shiftedOffset;
        const ceilingX = width / 2 + (wallX - width / 2) * 1.42;
        return <line key={wallX} x1={ceilingX} y1="0" x2={wallX} y2={height} />;
      })}
      {Array.from({ length: 6 }, (_, index) => {
        const progress = (index + 1) / 7;
        const y = Math.round(height * Math.pow(progress, 0.72));
        return <line key={y} x1="0" y1={y} x2={width} y2={y} />;
      })}
    </g>
  </svg>;
}

export default function UpperWorldSurface({ theme, spatialTheme = 'dark', cameraX = 0, gridPhaseX = 0, gridOffsetY = 0, transitionPhase = 'upper', onMoveKeeper }) {
  const surfaceRef = useRef(null);
  const pointerRef = useRef(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? EMPTY_VIEWPORT.width : window.innerWidth,
    height: typeof window === 'undefined' ? EMPTY_VIEWPORT.height : window.innerHeight
  }));

  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return undefined;
    const measure = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const spacing = viewport.width < 720 ? 56 : 80;
  const gridOffset = getCenteredHorizontalGridOffset(cameraX - gridPhaseX, viewport.width, spacing);
  const ceilingHeight = Math.round(viewport.height * 0.24);
  const wallGridOffsetY = ((gridOffsetY - ceilingHeight) % spacing + spacing) % spacing;
  const portalTarget = typeof document === 'undefined' ? null : document.querySelector('.application-root');

  const finishPointer = (event, cancelled = false) => {
    const result = finalizeSpatialPointer({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      drag: pointerRef.current,
      cancelled
    });
    pointerRef.current = result.drag;
    if (result.shouldActivate) onMoveKeeper?.(event.clientX, Math.max(ceilingHeight + 28, event.clientY));
  };

  const surface = <section
    ref={surfaceRef}
    className="upper-world"
    data-transition-phase={transitionPhase}
    data-spatial-theme={spatialTheme}
    aria-label="Upper spatial world"
    style={{ ...theme, '--upper-grid-offset': `${gridOffset}px`, '--upper-grid-offset-y': `${wallGridOffsetY}px`, '--upper-ceiling-height': `${ceilingHeight}px` }}
    onPointerDown={(event) => {
      if ((event.pointerType === 'mouse' && event.button !== 0) || event.isPrimary === false || event.target.closest?.('button')) return;
      pointerRef.current = { pointerId: event.pointerId, originPointer: { x: event.clientX, y: event.clientY }, moved: false, multiTouch: false };
    }}
    onPointerMove={(event) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointer.moved ||= exceedsSpatialPointerDragThreshold(pointer.originPointer, { x: event.clientX, y: event.clientY });
    }}
    onPointerUp={finishPointer}
    onPointerCancel={(event) => finishPointer(event, true)}
    onLostPointerCapture={(event) => finishPointer(event, true)}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
  >
    <div className="upper-world__ceiling"><UpperPerspectiveGrid width={viewport.width} height={ceilingHeight} offset={gridOffset} spacing={spacing} /></div>
    <div className="upper-world__wall" />
    <div className="upper-world__shade" />
  </section>;

  return portalTarget ? createPortal(surface, portalTarget) : surface;
}
