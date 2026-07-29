import { useEffect, useMemo, useRef, useState } from 'react';
import { adaptLatticeProductionMedia, LATTICE_PRODUCTION_MEDIA_STATUS } from './latticeProductionMedia.js';
import {
  createLatticeProductionTableRenderModel,
  projectLatticeProductionArtwork,
  projectLatticeProductionLabel,
  projectLatticeProductionViewport,
} from './latticeProductionProjection.js';
import './latticeProductionTableRenderer.css';

const rectangleStyle = (rectangle) => ({
  left: rectangle.left,
  top: rectangle.top,
  width: rectangle.width,
  height: rectangle.height,
});

function viewportOf(node) {
  return { width: Math.max(0, node?.clientWidth || 0), height: Math.max(0, node?.clientHeight || 0) };
}

function ProductionPlacement({ field, placement }) {
  const media = useMemo(() => adaptLatticeProductionMedia(placement.asset), [placement.asset]);
  const [loadState, setLoadState] = useState(() => ({ src: media.src, status: 'loading', dimensions: null }));
  useEffect(() => setLoadState({ src: media.src, status: 'loading', dimensions: null }), [media.src]);
  const dimensions = media.dimensions || (loadState.src === media.src ? loadState.dimensions : null);
  const artwork = projectLatticeProductionArtwork(placement, field, dimensions);
  const effectiveBackground = placement.backing.enabled
    ? placement.backing.color
    : placement.transparencyMode === 'OPAQUE' ? '#d8d4ca' : 'transparent';
  const ready = media.status === LATTICE_PRODUCTION_MEDIA_STATUS.READY;
  const loaded = ready && loadState.src === media.src && loadState.status === 'loaded';
  const failed = !ready || loadState.src === media.src && loadState.status === 'failed';

  return (
    <figure
      aria-label={media.label}
      className={`lattice-production-placement${placement.mat.enabled ? ' has-mat' : ''}`}
      data-frame-id={placement.frameId}
      data-media-state={failed ? media.status === 'ready' ? 'failed' : media.status : loaded ? 'ready' : 'loading'}
      data-placement-id={placement.id}
      data-transparency-mode={placement.transparencyMode}
      style={{ ...rectangleStyle(artwork.footprint), zIndex: placement.layer }}
    >
      {artwork.backplateRectangle && <span aria-hidden="true" className="lattice-production-placement__mat" style={{ backgroundColor: artwork.mat.color }} />}
      <span
        className="lattice-production-placement__opening"
        style={{
          ...rectangleStyle({
            left: artwork.mediaOpeningRectangle.left - artwork.footprint.left,
            top: artwork.mediaOpeningRectangle.top - artwork.footprint.top,
            width: artwork.mediaOpeningRectangle.width,
            height: artwork.mediaOpeningRectangle.height,
          }),
          backgroundColor: effectiveBackground,
        }}
      >
        {ready && (
          <img
            alt={media.label}
            className={loaded && artwork.imageRectangle ? 'is-ready' : ''}
            decoding="async"
            draggable="false"
            loading="lazy"
            onError={() => setLoadState({ src: media.src, status: 'failed', dimensions: null })}
            onLoad={(event) => setLoadState({
              src: media.src,
              status: 'loaded',
              dimensions: {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              },
            })}
            referrerPolicy="no-referrer"
            src={media.src}
            style={artwork.imageRectangle ? rectangleStyle({
              left: artwork.imageRectangle.left - artwork.mediaOpeningRectangle.left,
              top: artwork.imageRectangle.top - artwork.mediaOpeningRectangle.top,
              width: artwork.imageRectangle.width,
              height: artwork.imageRectangle.height,
            }) : undefined}
          />
        )}
        {!loaded && <span className="lattice-production-placement__status">{failed ? 'Artwork unavailable' : 'Loading artwork'}</span>}
      </span>
    </figure>
  );
}

export default function LatticeProductionTableRenderer({ lattice, tableId, className = '' }) {
  const rootRef = useRef(null);
  const model = useMemo(() => createLatticeProductionTableRenderModel(lattice, tableId), [lattice, tableId]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const update = () => setViewport(viewportOf(node));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const projected = viewport.width > 0 && viewport.height > 0
    ? projectLatticeProductionViewport(model, viewport)
    : null;
  const table = model.table;
  const privateTable = table.visibility === 'PRIVATE';
  const title = privateTable ? '' : table.title.trim();
  const subtitle = privateTable ? '' : table.subtitle.trim();
  const labelVisible = !privateTable && table.labelVisible && Boolean(title || subtitle);
  const accessibleName = title || `INSCAPE ${table.id}`;

  return (
    <section
      aria-label={accessibleName}
      className={`lattice-production-table ${className}`.trim()}
      data-surface={model.surfaceId}
      data-table-id={table.id}
      ref={rootRef}
      style={projected ? {
        '--lattice-production-cell-size': `${projected.cellSize}px`,
        '--lattice-production-grid-origin-x': `${projected.left}px`,
        '--lattice-production-grid-origin-y': `${projected.top}px`,
      } : undefined}
    >
      {projected && <>
        <span
          aria-hidden="true"
          className="lattice-production-table__authored-plane"
          style={rectangleStyle(projected)}
        />
        {!privateTable && table.placements.map((placement) => (
          <ProductionPlacement field={projected} key={placement.id} placement={placement} />
        ))}
        {labelVisible && (
          <header className="lattice-production-table__label" style={projectLatticeProductionLabel(table, projected)}>
            {title && <strong>{title}</strong>}
            {subtitle && <span>{subtitle}</span>}
          </header>
        )}
      </>}
    </section>
  );
}
