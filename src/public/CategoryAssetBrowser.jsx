import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initialCategoryBrowserRect,
  makeJustifiedAssetRows,
  normalizeAssetRatio,
  resizeCategoryBrowserByKey,
  resizeCategoryBrowserRect
} from './categoryAssetBrowserModel.js';
import NftFlipViewer from './NftFlipViewer.jsx';
import './categoryAssetBrowser.css';

const viewportSize = () => ({ width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 });
const previewUrl = (asset) => asset?.thumbnailUrl || asset?.imageUrl || null;

function BrowserAssetImage({ asset, onRatio }) {
  const [failed, setFailed] = useState(false);
  const source = previewUrl(asset);
  useEffect(() => setFailed(false), [source]);
  if (!source || failed) return <span className="category-asset-card__fallback">IMAGE UNAVAILABLE</span>;
  return <img
    src={source}
    alt={asset.name || 'Untitled asset'}
    loading="lazy"
    decoding="async"
    draggable="false"
    referrerPolicy="no-referrer"
    onLoad={(event) => onRatio(asset.id, event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
    onError={() => setFailed(true)}
  />;
}

export default function CategoryAssetBrowser({ open = false, category = null, status = 'ready' }) {
  const rowsRef = useRef(null);
  const resizeRef = useRef(null);
  const viewerTriggerRef = useRef(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [rect, setRect] = useState(() => initialCategoryBrowserRect(viewportSize()));
  const [contentWidth, setContentWidth] = useState(0);
  const [thumbnailSize, setThumbnailSize] = useState(190);
  const [ratios, setRatios] = useState({});
  const [selectedAsset, setSelectedAsset] = useState(null);
  const assets = Array.isArray(category?.assets) ? category.assets : [];

  useEffect(() => {
    if (!open || (selectedAsset && !assets.some((asset) => asset.id === selectedAsset.id))) setSelectedAsset(null);
  }, [assets, open, selectedAsset]);

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

  const registerRatio = useCallback((id, ratio) => {
    const normalized = normalizeAssetRatio(ratio);
    setRatios((current) => current[id] === normalized ? current : { ...current, [id]: normalized });
  }, []);

  const preparedAssets = useMemo(() => assets.map((asset, index) => ({
    ...asset,
    displayIndex: index + 1,
    ratio: ratios[asset.id] || normalizeAssetRatio(Number(asset.width) / Number(asset.height))
  })), [assets, ratios]);
  const rows = useMemo(
    () => makeJustifiedAssetRows(preparedAssets, contentWidth, thumbnailSize),
    [contentWidth, preparedAssets, thumbnailSize]
  );

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

  const closeViewer = useCallback(() => {
    const trigger = viewerTriggerRef.current;
    const assetId = selectedAsset?.id;
    setSelectedAsset(null);
    window.requestAnimationFrame(() => {
      const fallback = assetId
        ? [...(rowsRef.current?.querySelectorAll('.category-asset-card') || [])].find((node) => node.dataset.assetId === String(assetId))
        : null;
      (trigger?.isConnected ? trigger : fallback)?.focus?.();
    });
  }, [selectedAsset]);

  const loading = status === 'idle' || status === 'loading';
  return <>
  <section
    className="category-asset-browser"
    data-visible={open || undefined}
    aria-hidden={!open}
    aria-label={category ? `${category.label} NFT browser` : 'NFT browser'}
    style={rect}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <header>
      <strong>{category?.label || 'CATEGORY'}</strong>
      <label className="category-asset-browser__density">
        <span>THUMBNAIL SIZE</span>
        <input aria-label="Thumbnail size" type="range" min="110" max="300" step="10" value={thumbnailSize} onChange={(event) => setThumbnailSize(Number(event.target.value))} tabIndex={open ? 0 : -1} />
        <output>{thumbnailSize}</output>
      </label>
    </header>
    <div className="category-asset-browser__rows" ref={rowsRef}>
      {loading && !assets.length && <p className="category-asset-browser__status">LOADING PUBLISHED WORKS</p>}
      {!loading && !assets.length && <p className="category-asset-browser__status">NO WORKS IN THIS CATEGORY</p>}
      {rows.map((row, rowIndex) => <div
        className="category-asset-browser__row"
        data-incomplete={row.incomplete || undefined}
        key={`${rowIndex}-${row.assets.map((asset) => asset.id).join('-')}`}
        style={{ '--asset-row-height': `${row.height}px` }}
      >
        {row.assets.map((asset) => <button
          className="category-asset-card"
          type="button"
          key={asset.id}
          data-asset-id={asset.id}
          tabIndex={open ? 0 : -1}
          aria-label={`Open NFT viewer for ${asset.name || 'untitled asset'}`}
          style={{ width: `${row.height * asset.ratio}px` }}
          onClick={(event) => {
            viewerTriggerRef.current = event.currentTarget;
            setSelectedAsset(asset);
          }}
        >
          <span className="category-asset-card__media"><BrowserAssetImage asset={asset} onRatio={registerRatio} /></span>
          <span className="category-asset-card__rail">
            <strong>{asset.name || 'Untitled asset'}</strong>
            <small>#{String(asset.displayIndex).padStart(2, '0')} · {asset.standard || 'NFT'}</small>
          </span>
        </button>)}
      </div>)}
    </div>
    <button
      className="category-asset-browser__resize"
      type="button"
      tabIndex={open && viewport.width >= 720 ? 0 : -1}
      aria-label="Resize NFT browser"
      aria-describedby="category-asset-browser-resize-help"
      onKeyDown={resizeByKey}
      onPointerDown={beginResize}
      onPointerMove={moveResize}
      onPointerUp={finishResize}
      onPointerCancel={finishResize}
      onLostPointerCapture={finishResize}
    ><i aria-hidden="true">›</i></button>
    <span className="sr-only" id="category-asset-browser-resize-help">Use the arrow keys to resize in 40 pixel steps.</span>
  </section>
  {selectedAsset && <NftFlipViewer asset={selectedAsset} onClose={closeViewer} returnFocus={viewerTriggerRef.current} />}
  </>;
}
