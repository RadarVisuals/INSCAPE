import { useEffect, useMemo, useRef, useState } from 'react';
import { createLatticeProductionLayerRanks } from './latticeProductionLayerOrder.js';
import { adaptLatticeProductionMedia, LATTICE_PRODUCTION_MEDIA_STATUS } from './latticeProductionMedia.js';
import {
  createLatticeProductionTableRenderModel,
  projectLatticeProductionArtwork,
  projectLatticeProductionLabel,
  projectLatticeProductionViewport,
} from './latticeProductionProjection.js';
import './latticeProductionTableRenderer.css';

export const LATTICE_PRODUCTION_EAGER_MEDIA_RETRY_DELAY = 4_000;
export const LATTICE_PRODUCTION_EAGER_MEDIA_ATTEMPTS = 3;

const rectangleStyle = (rectangle) => ({
  left: rectangle.left,
  top: rectangle.top,
  width: rectangle.width,
  height: rectangle.height,
});

function viewportOf(node) {
  return { width: Math.max(0, node?.clientWidth || 0), height: Math.max(0, node?.clientHeight || 0) };
}

function ProductionPlacement({ field, imageLoading, layerRank, onMediaState, onPlacementActivate, placement, tableId, viewerSourceHidden }) {
  const media = useMemo(() => adaptLatticeProductionMedia(placement.asset), [placement.asset]);
  const [loadState, setLoadState] = useState(() => ({ src: media.src, status: 'loading', dimensions: null, attempt: 0 }));
  useEffect(() => setLoadState({ src: media.src, status: 'loading', dimensions: null, attempt: 0 }), [media.src]);
  useEffect(() => {
    if (media.status !== LATTICE_PRODUCTION_MEDIA_STATUS.READY || imageLoading !== 'eager'
      || loadState.src !== media.src || loadState.status !== 'loading') return undefined;
    const timer = setTimeout(() => setLoadState((current) => {
      if (current.src !== media.src || current.status !== 'loading') return current;
      return current.attempt + 1 < LATTICE_PRODUCTION_EAGER_MEDIA_ATTEMPTS
        ? { ...current, attempt: current.attempt + 1 }
        : { ...current, status: 'failed', dimensions: null };
    }), LATTICE_PRODUCTION_EAGER_MEDIA_RETRY_DELAY);
    return () => clearTimeout(timer);
  }, [imageLoading, loadState.attempt, loadState.src, loadState.status, media.src, media.status]);
  const decodedDimensions = loadState.src === media.src && loadState.status === 'loaded' ? loadState.dimensions : null;
  const dimensions = decodedDimensions || media.dimensions;
  const artwork = projectLatticeProductionArtwork(placement, field, dimensions);
  const effectiveBackground = placement.backing.enabled
    ? placement.backing.color
    : placement.transparencyMode === 'OPAQUE' ? '#d8d4ca' : 'transparent';
  const ready = media.status === LATTICE_PRODUCTION_MEDIA_STATUS.READY;
  const loaded = ready && loadState.src === media.src && loadState.status === 'loaded';
  const failed = !ready || loadState.src === media.src && loadState.status === 'failed';
  useEffect(() => {
    onMediaState?.({
      dimensions: loaded ? dimensions : null,
      media,
      placementId: placement.id,
      status: failed ? 'failed' : loaded ? 'ready' : 'loading',
      tableId,
    });
  }, [dimensions?.height, dimensions?.width, failed, loaded, media.src, onMediaState, placement.id, tableId]);
  const activatable = Boolean(onPlacementActivate && loaded && dimensions);

  const activate = (event) => {
    if (!activatable) return;
    onPlacementActivate({ element: event.currentTarget, placement, tableId });
  };

  return (
    <figure
      aria-label={media.label}
      className={`lattice-production-placement${placement.mat.enabled ? ' has-mat' : ''}`}
      data-frame-id={placement.frameId}
      data-media-state={failed ? media.status === 'ready' ? 'failed' : media.status : loaded ? 'ready' : 'loading'}
      data-placement-id={placement.id}
      data-placement-activatable={activatable || undefined}
      data-transparency-mode={placement.transparencyMode}
      data-viewer-source-hidden={viewerSourceHidden || undefined}
      style={{ ...rectangleStyle(artwork.footprint), zIndex: layerRank }}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        activate(event);
      }}
      tabIndex={activatable ? 0 : -1}
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
            key={`${media.src}:${loadState.attempt}`}
            loading={imageLoading}
            onError={() => setLoadState((current) => {
              if (current.src !== media.src) return current;
              return imageLoading === 'eager' && current.attempt + 1 < LATTICE_PRODUCTION_EAGER_MEDIA_ATTEMPTS
                ? { ...current, attempt: current.attempt + 1 }
                : { ...current, status: 'failed', dimensions: null };
            })}
            onLoad={(event) => {
              const { naturalHeight: height, naturalWidth: width } = event.currentTarget;
              if (!width || !height) return;
              setLoadState((current) => current.src === media.src ? {
                ...current, status: 'loaded', dimensions: { width, height },
              } : current);
            }}
            referrerPolicy="no-referrer"
            src={media.src}
            style={artwork.imageRenderRectangle ? {
              ...rectangleStyle({
                left: artwork.imageRenderRectangle.left - artwork.mediaOpeningRectangle.left,
                top: artwork.imageRenderRectangle.top - artwork.mediaOpeningRectangle.top,
                width: artwork.imageRenderRectangle.width,
                height: artwork.imageRenderRectangle.height,
              }),
              transform: artwork.imageTransform,
              transformOrigin: 'center',
            } : undefined}
          />
        )}
        {!loaded && <span className="lattice-production-placement__status">{failed ? 'Artwork unavailable' : 'Loading artwork'}</span>}
      </span>
    </figure>
  );
}

export default function LatticeProductionTableRenderer({
  lattice, tableId, className = '', imageLoading = 'lazy', onMediaState, onPlacementActivate, viewerPlacementId = null,
}) {
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
  const layerRanks = useMemo(() => createLatticeProductionLayerRanks(table.placements), [table.placements]);
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
          <ProductionPlacement
            field={projected}
            imageLoading={imageLoading}
            key={placement.id}
            layerRank={layerRanks.get(placement.id)}
            onMediaState={onMediaState}
            onPlacementActivate={onPlacementActivate}
            placement={placement}
            tableId={tableId}
            viewerSourceHidden={placement.id === viewerPlacementId}
          />
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
