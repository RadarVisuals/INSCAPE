import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BROWSER_ASSET_SIZE,
  BROWSER_SORTS,
  BROWSER_VIEW_KINDS,
  browserAssetId,
  browserViewAssets,
  filterAndSortBrowserAssets,
  reconcileBrowserSelection,
  updateBrowserSelection,
} from './browserWorkspaceModel.js';
import { browserAssetSupportsPreview, browserPreviewCandidates } from './browserRenderableAssets.js';
import useLatticeFloatingWindow from '../windows/useLatticeFloatingWindow.js';

const clampSidebarWidth = (value) => Math.min(320, Math.max(48, Number(value) || 174));

export default function useBrowserWorkspace(data, sharedPreviewRecords = null, initialPreferences = null) {
  const [view, setView] = useState({ kind: BROWSER_VIEW_KINDS.ALL, id: null });
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState('all');
  const [sort, setSort] = useState(BROWSER_SORTS.TITLE_ASC);
  const [assetSize, setAssetSize] = useState(() => Number(initialPreferences?.assetSize) || BROWSER_ASSET_SIZE.DEFAULT);
  const [sidebarWidth, setSidebarWidth] = useState(() => clampSidebarWidth(initialPreferences?.sidebarWidth));
  const [hideLabels, setHideLabels] = useState(() => initialPreferences?.hideLabels === true);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState(null);
  const [lastCategoryId, setLastCategoryId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const floatingWindow = useLatticeFloatingWindow();
  const sidebarResizeGestureRef = useRef(null);
  const expandedSidebarWidthRef = useRef(sidebarWidth >= 152 ? sidebarWidth : 174);
  const previewRecordsRef = useRef(sharedPreviewRecords || new Map());
  const [previewVersion, setPreviewVersion] = useState(0);

  const sourceAssets = Array.isArray(data?.assets) ? data.assets : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  useEffect(() => {
    const liveIds = new Set(sourceAssets.map(browserAssetId));
    if (!sharedPreviewRecords) for (const id of previewRecordsRef.current.keys()) {
      if (!liveIds.has(id)) previewRecordsRef.current.delete(id);
    }
  }, [sharedPreviewRecords, sourceAssets]);
  const assets = useMemo(() => sourceAssets.map((asset) => {
    const preview = previewRecordsRef.current.get(browserAssetId(asset));
    const fallback = browserPreviewCandidates(asset)[0] || null;
    return preview?.status === 'ready' ? {
      ...asset,
      decodedImageHeight: preview.height,
      decodedImageSource: preview.source,
      decodedImageWidth: preview.width,
      previewSrc: preview.source,
    } : { ...asset, previewSrc: preview?.status === 'unavailable' ? null : fallback };
  }), [previewVersion, sourceAssets]);
  const unavailableCount = sourceAssets.filter((asset) => previewRecordsRef.current
    .get(browserAssetId(asset))?.status === 'unavailable').length;
  const markAssetReady = useCallback((id, source, width, height) => {
    const asset = sourceAssets.find((candidate) => browserAssetId(candidate) === id);
    if (!asset || !source || !Number(width) || !Number(height)) return;
    const current = previewRecordsRef.current.get(id);
    if (current?.status === 'ready' && current.source === source && current.width === width && current.height === height) return;
    previewRecordsRef.current.set(id, { assetRef: asset, source, width, height, status: 'ready' });
    setPreviewVersion((value) => value + 1);
  }, [sourceAssets]);
  const markAssetUnavailable = useCallback((id) => {
    const asset = sourceAssets.find((candidate) => browserAssetId(candidate) === id);
    if (!asset) return;
    previewRecordsRef.current.set(id, { assetRef: asset, status: 'unavailable' });
    setPreviewVersion((value) => value + 1);
  }, [sourceAssets]);
  const renderableIds = useMemo(() => new Set(assets.filter((asset) => asset.previewSrc
    && browserAssetSupportsPreview(asset)).map(browserAssetId)), [assets]);
  const isAssetRenderable = useCallback((id) => renderableIds.has(id), [renderableIds]);
  const areAssetsRenderable = useCallback((ids) => Array.isArray(ids)
    && ids.length > 0 && ids.every((id) => renderableIds.has(id)), [renderableIds]);
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

  const beginSidebarResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    sidebarResizeGestureRef.current = { pointerId: event.pointerId, startWidth: sidebarWidth, startX: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const updateSidebarResize = (event) => {
    const gesture = sidebarResizeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const next = clampSidebarWidth(gesture.startWidth + event.clientX - gesture.startX);
    if (next >= 152) expandedSidebarWidthRef.current = next;
    setSidebarWidth(next);
  };
  const ensureSidebarWidth = (minimum = 152) => {
    if (sidebarWidth >= minimum) return;
    setSidebarWidth(Math.max(minimum, expandedSidebarWidthRef.current));
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
    sidebarWidth, ensureSidebarWidth,
    sidebarResize: { begin: beginSidebarResize, finish: finishSidebarResize, update: updateSidebarResize },
    hideLabels, setHideLabels, query, setQuery,
    sort, setSort, view, selectView, selectCategoriesDestination, lastCategoryId,
    selectedAsset, selectedAssets, selectedAssetIds, selectAsset, selectForContext, clearSelection, selectAllVisible,
    selectedCategory, dialog, setDialog, filteredAssets, viewAssetCount: scopedAssets.length,
    hasActiveFilters, clearFilters, unavailableCount, markAssetReady, markAssetUnavailable, isAssetRenderable, areAssetsRenderable,
    renderableAssets: assets,
    renderableAssetIds: [...renderableIds],
    move: floatingWindow.move,
    rackWidthResize: floatingWindow.rackWidthResize,
    resize: floatingWindow.resize,
    windowPosition: floatingWindow.windowPosition,
    windowSize: floatingWindow.windowSize,
  };
}
