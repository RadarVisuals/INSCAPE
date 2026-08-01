import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchCreations } from '../creations/domain/searchCreations.js';
import { useCreationsStore } from '../creations/state/useCreationsStore.js';
import {
  initialCategoryBrowserRect,
  makeJustifiedAssetRows,
  normalizeAssetRatio,
  resizeCategoryBrowserByKey,
  resizeCategoryBrowserRect
} from './categoryAssetBrowserModel.js';
import LatticeFocusViewer from '../lattice/rendering/LatticeFocusViewer.jsx';
import FloatingWindowCloseButton from './FloatingWindowCloseButton.jsx';
import './creationsBrowser.css';

const viewportSize = () => ({ width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 });
const previewUrl = (creation) => creation?.thumbnailUrl || creation?.imageUrl || creation?.originalImageUrl || null;
const fullImageUrl = (creation) => creation?.originalImageUrl || creation?.imageUrl || creation?.thumbnailUrl || null;

function creationFocusEntry(creation, dimensions) {
  const src = fullImageUrl(creation);
  if (!src || !dimensions?.width || !dimensions?.height) return null;
  const creators = Array.isArray(creation.creators) ? creation.creators : [];
  const technical = [
    creators.length ? { label: 'CREATORS / INDEXED ATTRIBUTION', value: creators.map((creator) => creator.name
      ? `${creator.name} — ${creator.address}` : creator.address).join('\n') } : null,
    creation.collectionName ? { label: 'COLLECTION / METADATA', value: creation.collectionName } : null,
    creation.contractAddress ? { label: 'CONTRACT', value: creation.contractAddress } : null,
    creation.tokenId ? { label: 'TOKEN ID / TOKEN', value: creation.tokenId } : null,
    creation.standard ? { label: 'STANDARD / INDEXED', value: String(creation.standard).toUpperCase() } : null,
    creation.chainId ? { label: 'CHAIN ID', value: String(creation.chainId) } : null,
    { label: 'SOURCE DIMENSIONS', value: `${dimensions.width} × ${dimensions.height} PX` },
    creation.contractAddress ? {
      label: 'EXPLORER / DERIVED',
      value: `https://explorer.lukso.network/address/${creation.contractAddress}`,
      href: `https://explorer.lukso.network/address/${creation.contractAddress}`,
    } : null,
  ].filter(Boolean);
  return Object.freeze({
    accessibleLabel: creation.name || 'Untitled creation',
    dossier: {
      title: creation.name || null,
      description: creation.description || null,
      traits: (creation.attributes || []).map((attribute) => ({
        label: typeof attribute.key === 'string' ? attribute.key.trim() : null,
        value: String(attribute.value ?? ''),
      })).filter(({ label }) => label),
      technical,
    },
    focusDimensions: dimensions,
    media: { accessibleLabel: creation.name || 'Untitled creation', src },
    placement: { id: creation.id },
  });
}

function CreationFocusArtwork({ entry }) {
  return <div className="creations-focus-artwork">
    <img alt={entry.accessibleLabel} decoding="async" draggable="false" referrerPolicy="no-referrer" src={entry.media.src} />
  </div>;
}

function CreationImage({ creation, onRatio }) {
  const [failed, setFailed] = useState(false);
  const source = previewUrl(creation);
  useEffect(() => setFailed(false), [source]);
  if (!source || failed) return <span>IMAGE UNAVAILABLE</span>;
  return <img
    src={source}
    alt={creation.name || 'Untitled creation'}
    loading="lazy"
    decoding="async"
    draggable="false"
    referrerPolicy="no-referrer"
    onLoad={(event) => onRatio(
      creation.id,
      event.currentTarget.naturalWidth / event.currentTarget.naturalHeight,
      { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight },
    )}
    onError={() => setFailed(true)}
  />;
}

export default function CreationsBrowser({ visible = false, open = false, onOpenChange, profileAddress, menuSurfaceId = 'mist' }) {
  const assets = useCreationsStore((state) => state.assets);
  const status = useCreationsStore((state) => state.status);
  const progress = useCreationsStore((state) => state.progress);
  const error = useCreationsStore((state) => state.error || state.liveError);
  const load = useCreationsStore((state) => state.load);
  const retry = useCreationsStore((state) => state.retry);
  const rowsRef = useRef(null);
  const resizeRef = useRef(null);
  const [query, setQuery] = useState('');
  const [thumbnailSize, setThumbnailSize] = useState(190);
  const [ratios, setRatios] = useState({});
  const [decodedDimensions, setDecodedDimensions] = useState({});
  const [viewerSession, setViewerSession] = useState(null);
  const [sourceSlow, setSourceSlow] = useState(false);
  const [viewport, setViewport] = useState(viewportSize);
  const [rect, setRect] = useState(() => initialCategoryBrowserRect(viewportSize()));
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    if (open && profileAddress) load(profileAddress);
    if (!open) setViewerSession(null);
  }, [load, open, profileAddress]);

  useEffect(() => {
    if (!open || viewerSession) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange?.(false);
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [onOpenChange, open, viewerSession]);

  useEffect(() => {
    setSourceSlow(false);
    if (!open || status !== 'loading' || assets.length) return undefined;
    const timer = window.setTimeout(() => setSourceSlow(true), 10000);
    return () => window.clearTimeout(timer);
  }, [assets.length, open, status]);

  useEffect(() => {
    const resize = () => {
      const nextViewport = viewportSize();
      setViewport(nextViewport);
      setRect((current) => resizeCategoryBrowserRect(current, { x: 0, y: 0 }, nextViewport));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!open || !rowsRef.current) return undefined;
    const node = rowsRef.current;
    const measure = () => {
      const style = getComputedStyle(node);
      setContentWidth(Math.max(0, node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [open]);

  const visibleAssets = useMemo(() => searchCreations(assets, query), [assets, query]);
  const registerRatio = useCallback((id, ratio, dimensions) => {
    const normalized = normalizeAssetRatio(ratio);
    setRatios((current) => current[id] === normalized ? current : { ...current, [id]: normalized });
    setDecodedDimensions((current) => current[id]?.width === dimensions.width && current[id]?.height === dimensions.height
      ? current : { ...current, [id]: dimensions });
  }, []);
  const preparedAssets = useMemo(() => visibleAssets.map((asset, index) => ({
    ...asset,
    displayIndex: index + 1,
    ratio: ratios[asset.id] || normalizeAssetRatio(Number(asset.width) / Number(asset.height))
  })), [ratios, visibleAssets]);
  const rows = useMemo(() => makeJustifiedAssetRows(preparedAssets, contentWidth, thumbnailSize), [contentWidth, preparedAssets, thumbnailSize]);
  const viewerEntries = useMemo(() => visibleAssets
    .map((creation) => creationFocusEntry(creation, decodedDimensions[creation.id]))
    .filter(Boolean), [decodedDimensions, visibleAssets]);
  const viewerPosition = viewerEntries.findIndex(({ placement }) => placement.id === viewerSession?.assetId);
  const viewerEntry = viewerPosition >= 0 ? viewerEntries[viewerPosition] : null;
  const findCreationElement = useCallback((assetId) => rowsRef.current
    ?.querySelector(`[data-creation-id="${CSS.escape(assetId)}"]`), []);
  const navigateViewer = useCallback((direction) => {
    if (!viewerEntries.length || viewerPosition < 0) return;
    const destination = viewerEntries[(viewerPosition + direction + viewerEntries.length) % viewerEntries.length];
    const element = findCreationElement(destination.placement.id);
    setViewerSession((current) => current && ({
      ...current,
      assetId: destination.placement.id,
      returnFocus: element || current.returnFocus,
    }));
  }, [findCreationElement, viewerEntries, viewerPosition]);

  const beginResize = (event) => {
    if (viewport.width < 720 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    resizeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect };
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveResize = (event) => {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setRect(resizeCategoryBrowserRect(active.rect, { x: event.clientX - active.x, y: event.clientY - active.y }, viewport));
  };
  const finishResize = (event) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };
  const resizeByKey = (event) => {
    const next = resizeCategoryBrowserByKey(rect, event.key, viewport);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setRect(next);
  };

  const workspace = open && typeof document !== 'undefined' ? createPortal(<>
    <section className="creations-browser" style={rect} aria-label="Profile creations" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <header>
        <strong>CREATIONS</strong>
        <label className="creations-browser__search"><span className="sr-only">Search creations</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH CREATIONS" /></label>
        <label className="creations-browser__density"><span>THUMBNAIL SIZE</span><input aria-label="Thumbnail size" type="range" min="110" max="300" step="10" value={thumbnailSize} onChange={(event) => setThumbnailSize(Number(event.target.value))} /><output>{thumbnailSize}</output></label>
      </header>
      <FloatingWindowCloseButton onClose={() => onOpenChange?.(false)} label="Close creations browser" />
      <div className="creations-browser__rows" ref={rowsRef}>
        {(status === 'idle' || status === 'loading') && !assets.length && !sourceSlow && <p className="creations-browser__status">LOADING CREATOR-ATTRIBUTED WORKS{progress.total ? ` ${progress.resolved}/${progress.total}` : ''}</p>}
        {status === 'loading' && !assets.length && sourceSlow && <div className="creations-browser__error" role="status"><p>CREATIONS SOURCE IS NOT RESPONDING</p><button type="button" onClick={retry}>RETRY</button></div>}
        {status === 'error' && !assets.length && <div className="creations-browser__error" role="alert"><p>CREATIONS UNAVAILABLE</p><button type="button" onClick={retry}>RETRY</button></div>}
        {status !== 'idle' && status !== 'loading' && status !== 'error' && !visibleAssets.length && <p className="creations-browser__status">{query ? 'NO CREATIONS MATCH THIS SEARCH' : 'NO CREATOR-ATTRIBUTED WORKS FOUND'}</p>}
        {error && assets.length > 0 && <p className="creations-browser__partial" role="status">PARTIAL RESULTS</p>}
        {rows.map((row, rowIndex) => <div className="creations-browser__row" data-incomplete={row.incomplete || undefined} key={`${rowIndex}-${row.assets.map((asset) => asset.id).join('-')}`} style={{ '--creation-row-height': `${row.height}px` }}>
          {row.assets.map((creation) => <button className="creation-browser-card" data-creation-id={creation.id} type="button" key={creation.id} style={{ width: `${row.height * creation.ratio}px` }} onClick={(event) => {
            if (!decodedDimensions[creation.id]) return;
            setViewerSession({
              assetId: creation.id,
              originRectangle: event.currentTarget.getBoundingClientRect(),
              returnFocus: event.currentTarget,
            });
          }} aria-label={`Open NFT viewer for ${creation.name || 'untitled creation'}`}>
            <span className="creation-browser-card__media"><CreationImage creation={creation} onRatio={registerRatio} /></span>
            <span className="creation-browser-card__rail"><strong>{creation.name || 'Untitled creation'}</strong><small>#{String(creation.displayIndex).padStart(2, '0')} · {creation.standard || 'NFT'}</small></span>
          </button>)}
        </div>)}
      </div>
      <button className="creations-browser__resize" type="button" aria-label="Resize creations browser" onKeyDown={resizeByKey} onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize}><i aria-hidden="true">›</i></button>
    </section>
    {viewerSession && viewerEntry && <LatticeFocusViewer
      dossier={viewerEntry.dossier}
      entry={viewerEntry}
      getReturnRectangle={() => findCreationElement(viewerSession.assetId)?.getBoundingClientRect()}
      gridVisible
      inspectionVariant="rack"
      menuSurfaceId={menuSurfaceId}
      onClosed={() => setViewerSession(null)}
      onNavigate={navigateViewer}
      originRectangle={viewerSession.originRectangle}
      position={viewerPosition}
      renderArtwork={(entry) => <CreationFocusArtwork entry={entry} />}
      returnFocus={viewerSession.returnFocus}
      surfaceColor="var(--lattice-menu-panel)"
      total={viewerEntries.length}
    />}
  </>, document.body) : null;

  return <>
    <section className="creations-navigation-card" aria-hidden={!visible} data-visible={visible || undefined} data-expanded={open || undefined}>
      <button type="button" tabIndex={visible ? 0 : -1} aria-expanded={open} onClick={() => onOpenChange?.(!open)}><strong>CREATIONS</strong><i aria-hidden="true">›</i></button>
    </section>
    {workspace}
  </>;
}
