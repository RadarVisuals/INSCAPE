import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BROWSER_ASSET_SIZE,
  BROWSER_SORTS,
  BROWSER_VIEW_KINDS,
  browserAssetId,
  browserViewAssets,
  clampBrowserPosition,
  clampBrowserSize,
  filterAndSortBrowserAssets,
  initialBrowserPosition,
  initialBrowserSize,
  reconcileBrowserSelection,
  resizeBrowserAroundCenter,
  resizeBrowserByKey,
  updateBrowserSelection,
} from './browserWorkspaceModel.js';
import { browserAssetSupportsPreview, browserPreviewCandidates, browserPreviewWorkIsCurrent, resolveBrowserPreview } from './browserRenderableAssets.js';

const viewportSize = () => ({ height: globalThis.innerHeight || 720, width: globalThis.innerWidth || 1280 });
const clampSidebarWidth = (value) => Math.min(320, Math.max(48, Number(value) || 174));

export default function useBrowserWorkspace(data) {
  const [view, setView] = useState({ kind: BROWSER_VIEW_KINDS.ALL, id: null });
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState('all');
  const [sort, setSort] = useState(BROWSER_SORTS.TITLE_ASC);
  const [assetSize, setAssetSize] = useState(BROWSER_ASSET_SIZE.DEFAULT);
  const [sidebarWidth, setSidebarWidth] = useState(174);
  const [hideLabels, setHideLabels] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState(null);
  const [lastCategoryId, setLastCategoryId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [windowSize, setWindowSize] = useState(() => initialBrowserSize(viewportSize()));
  const [windowPosition, setWindowPosition] = useState(() => {
    const initialViewport = viewportSize();
    const initialSize = initialBrowserSize(initialViewport);
    return initialBrowserPosition(initialSize, initialViewport);
  });
  const resizeGestureRef = useRef(null);
  const moveGestureRef = useRef(null);
  const sidebarResizeGestureRef = useRef(null);
  const previewJobsRef = useRef(new Map());
  const previewRecordsRef = useRef(new Map());
  const [previewVersion, setPreviewVersion] = useState(0);

  const sourceAssets = Array.isArray(data?.assets) ? data.assets : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  useEffect(() => {
    const liveIds = new Set(sourceAssets.map(browserAssetId));
    for (const [id, job] of previewJobsRef.current) {
      if (!liveIds.has(id)) { job.cancelled = true; previewJobsRef.current.delete(id); }
    }
    for (const id of previewRecordsRef.current.keys()) {
      if (!liveIds.has(id)) previewRecordsRef.current.delete(id);
    }
    for (const asset of sourceAssets) {
      const id = browserAssetId(asset); if (!id) continue;
      const candidates = browserPreviewCandidates(asset);
      const signature = `${asset.mediaType || ''}\n${candidates.join('\n')}`;
      const acceptedPreview = previewRecordsRef.current.get(id);
      if (browserPreviewWorkIsCurrent(acceptedPreview, previewJobsRef.current.get(id), asset, signature)) continue;
      const previous = previewJobsRef.current.get(id); if (previous) previous.cancelled = true;
      if (!browserAssetSupportsPreview(asset) || !candidates.length) {
        previewRecordsRef.current.set(id, { assetRef: asset, signature, status: 'unavailable' });
        previewJobsRef.current.delete(id); continue;
      }
      const job = { cancelled: false, signature }; previewJobsRef.current.set(id, job);
      previewRecordsRef.current.set(id, { assetRef: asset, signature, status: 'pending' });
      resolveBrowserPreview(candidates).then((source) => {
        if (job.cancelled || previewJobsRef.current.get(id) !== job) return;
        previewJobsRef.current.delete(id);
        previewRecordsRef.current.set(id, source
          ? { assetRef: asset, signature, source, status: 'ready' }
          : { assetRef: asset, signature, status: 'unavailable' });
        setPreviewVersion((value) => value + 1);
      });
    }
    setPreviewVersion((value) => value + 1);
  }, [sourceAssets]);
  useEffect(() => () => {
    for (const job of previewJobsRef.current.values()) job.cancelled = true;
    previewJobsRef.current.clear();
  }, []);
  const assets = useMemo(() => sourceAssets.flatMap((asset) => {
    const preview = previewRecordsRef.current.get(browserAssetId(asset));
    return preview?.status === 'ready' ? [{ ...asset, previewSrc: preview.source }] : [];
  }), [previewVersion, sourceAssets]);
  const unavailableCount = sourceAssets.filter((asset) => previewRecordsRef.current
    .get(browserAssetId(asset))?.status === 'unavailable').length;
  const markAssetUnavailable = useCallback((id, source) => {
    const current = previewRecordsRef.current.get(id);
    if (current?.status !== 'ready' || current.source !== source) return;
    previewRecordsRef.current.set(id, { assetRef: current.assetRef, signature: current.signature, status: 'unavailable' });
    setPreviewVersion((value) => value + 1);
  }, []);
  const isAssetRenderable = useCallback((id) => previewRecordsRef.current.get(id)?.status === 'ready', []);
  const areAssetsRenderable = useCallback((ids) => Array.isArray(ids)
    && ids.length > 0 && ids.every((id) => previewRecordsRef.current.get(id)?.status === 'ready'), []);
  const scopedAssets = useMemo(() => browserViewAssets(assets, categories, view, data?.usedAssetIds),
    [assets, categories, data?.usedAssetIds, view]);
  const filteredAssets = useMemo(() => filterAndSortBrowserAssets(scopedAssets,
    { collection, query, sort }), [collection, query, scopedAssets, sort]);
  const collections = useMemo(() => [...new Set(assets.map((asset) => String(asset?.collection || '').trim()).filter(Boolean))].sort(), [assets]);
  const selectedAssets = selectedAssetIds.map((id) => assets.find((asset) => browserAssetId(asset) === id)).filter(Boolean);
  const selectedAsset = selectedAssets.length === 1 ? selectedAssets[0] : null;
  const selectedCategory = view.kind === BROWSER_VIEW_KINDS.CATEGORY
    ? categories.find((category) => category.id === view.id) || null : null;

  useEffect(() => {
    if (view.kind !== BROWSER_VIEW_KINDS.CATEGORY) return;
    if (categories.some(({ id }) => id === view.id)) { setLastCategoryId(view.id); return; }
    setView({ kind: BROWSER_VIEW_KINDS.ALL, id: null });
  }, [categories, view]);

  useEffect(() => {
    setSelectedAssetIds((current) => {
      const next = reconcileBrowserSelection(current, filteredAssets);
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [filteredAssets]);

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = viewportSize();
      setViewport(nextViewport);
      setWindowSize((current) => {
        const nextSize = clampBrowserSize(current, nextViewport);
        setWindowPosition((position) => clampBrowserPosition(position, nextSize, nextViewport));
        return nextSize;
      });
    };
    globalThis.addEventListener?.('resize', handleResize);
    return () => globalThis.removeEventListener?.('resize', handleResize);
  }, []);

  const beginResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rack = event.currentTarget.closest('[data-lattice-chrome]');
    if (rack) rack.dataset.resizing = '';
    resizeGestureRef.current = { point: { x: event.clientX, y: event.clientY }, position: windowPosition, rack, size: windowSize };
  };
  const updateResize = (event) => {
    const gesture = resizeGestureRef.current;
    if (!gesture || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const nextSize = resizeBrowserAroundCenter(gesture.size,
      { x: event.clientX - gesture.point.x, y: event.clientY - gesture.point.y }, viewport);
    setWindowSize(nextSize);
    setWindowPosition(clampBrowserPosition({
      left: gesture.position.left - ((nextSize.width - gesture.size.width) / 2),
      top: gesture.position.top - ((nextSize.height - gesture.size.height) / 2),
    }, nextSize, viewport));
  };
  const finishResize = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resizeGestureRef.current?.rack?.removeAttribute('data-resizing');
    resizeGestureRef.current = null;
  };
  const beginWidthResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rack = event.currentTarget.closest('[data-lattice-chrome]');
    if (rack) rack.dataset.resizing = '';
    resizeGestureRef.current = {
      axis: 'width', point: { x: event.clientX, y: event.clientY }, position: windowPosition, rack, size: windowSize,
    };
  };
  const updateWidthResize = (event) => {
    const gesture = resizeGestureRef.current;
    if (gesture?.axis !== 'width' || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const nextSize = clampBrowserSize({
      height: gesture.size.height,
      width: gesture.size.width + event.clientX - gesture.point.x,
    }, viewport);
    setWindowSize(nextSize);
    setWindowPosition(clampBrowserPosition(gesture.position, nextSize, viewport));
  };
  const resizeWidthByKey = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const nextSize = clampBrowserSize({
      height: windowSize.height,
      width: windowSize.width + (direction * 24),
    }, viewport);
    event.preventDefault();
    event.stopPropagation();
    setWindowSize(nextSize);
    setWindowPosition((position) => clampBrowserPosition(position, nextSize, viewport));
  };
  const resizeByKey = (event) => {
    const next = resizeBrowserByKey(windowSize, event.key, viewport);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setWindowSize(next);
    setWindowPosition((position) => clampBrowserPosition({
      left: position.left - ((next.width - windowSize.width) / 2),
      top: position.top - ((next.height - windowSize.height) / 2),
    }, next, viewport));
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
    setWindowPosition(clampBrowserPosition({
      left: gesture.position.left + event.clientX - gesture.point.x,
      top: gesture.position.top + event.clientY - gesture.point.y,
    }, gesture.size, viewport));
  };
  const finishMove = (event) => {
    const gesture = moveGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    moveGestureRef.current = null;
  };

  const beginSidebarResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    sidebarResizeGestureRef.current = { pointerId: event.pointerId, startWidth: sidebarWidth, startX: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const updateSidebarResize = (event) => {
    const gesture = sidebarResizeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setSidebarWidth(clampSidebarWidth(gesture.startWidth + event.clientX - gesture.startX));
  };
  const finishSidebarResize = (event) => {
    const gesture = sidebarResizeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    sidebarResizeGestureRef.current = null;
  };

  const selectAsset = (id, event = {}) => {
    const next = updateBrowserSelection(selectedAssetIds, filteredAssets, id, {
      additive: Boolean(event.ctrlKey || event.metaKey), anchorId: selectionAnchorId, range: Boolean(event.shiftKey),
    });
    setSelectedAssetIds(next.selectedIds); setSelectionAnchorId(next.anchorId);
  };
  const selectForContext = (id) => {
    if (selectedAssetIds.includes(id)) return selectedAssetIds;
    setSelectedAssetIds([id]); setSelectionAnchorId(id); return [id];
  };
  const clearSelection = () => { setSelectedAssetIds([]); setSelectionAnchorId(null); };
  const selectAllVisible = () => {
    const ids = filteredAssets.map(browserAssetId).filter(Boolean);
    setSelectedAssetIds(ids); setSelectionAnchorId(ids.at(-1) || null);
  };
  const selectView = (nextView) => {
    setView(nextView);
    if (nextView.kind === BROWSER_VIEW_KINDS.CATEGORY) setLastCategoryId(nextView.id);
  };
  const selectCategoriesDestination = () => {
    const id = categories.some(({ id }) => id === lastCategoryId) ? lastCategoryId : null;
    if (id) selectView({ kind: BROWSER_VIEW_KINDS.CATEGORY, id });
    return id || null;
  };
  const hasActiveFilters = Boolean(query.trim() || collection !== 'all');
  const clearFilters = () => { setQuery(''); setCollection('all'); };

  return {
    collection, collections, setCollection, assetSize,
    assetSizeBounds: BROWSER_ASSET_SIZE, setAssetSize,
    sidebarWidth, sidebarResize: { begin: beginSidebarResize, finish: finishSidebarResize, update: updateSidebarResize },
    hideLabels, setHideLabels, query, setQuery,
    sort, setSort, view, selectView, selectCategoriesDestination, lastCategoryId,
    selectedAsset, selectedAssets, selectedAssetIds, selectAsset, selectForContext, clearSelection, selectAllVisible,
    selectedCategory, dialog, setDialog, filteredAssets, viewAssetCount: scopedAssets.length,
    hasActiveFilters, clearFilters, unavailableCount, markAssetUnavailable, isAssetRenderable, areAssetsRenderable,
    renderableAssets: assets, renderableAssetIds: assets.map(browserAssetId), windowPosition, windowSize,
    move: { begin: beginMove, finish: finishMove, update: updateMove },
    rackWidthResize: {
      begin: beginWidthResize, finish: finishResize, keyDown: resizeWidthByKey, update: updateWidthResize,
    },
    resize: { begin: beginResize, finish: finishResize, keyDown: resizeByKey, update: updateResize },
  };
}
