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
import { browserAssetSupportsPreview, browserPreviewCandidates, browserPreviewWorkIsCurrent, resolveBrowserPreview } from './browserRenderableAssets.js';
import useLatticeFloatingWindow from '../windows/useLatticeFloatingWindow.js';

const clampSidebarWidth = (value) => Math.min(320, Math.max(48, Number(value) || 174));

export default function useBrowserWorkspace(data, sharedPreviewRecords = null) {
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
  const floatingWindow = useLatticeFloatingWindow();
  const sidebarResizeGestureRef = useRef(null);
  const previewJobsRef = useRef(new Map());
  const previewRecordsRef = useRef(sharedPreviewRecords || new Map());
  const [previewVersion, setPreviewVersion] = useState(0);

  const sourceAssets = Array.isArray(data?.assets) ? data.assets : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  useEffect(() => {
    const liveIds = new Set(sourceAssets.map(browserAssetId));
    for (const [id, job] of previewJobsRef.current) {
      if (!liveIds.has(id)) { job.cancelled = true; previewJobsRef.current.delete(id); }
    }
    if (!sharedPreviewRecords) for (const id of previewRecordsRef.current.keys()) {
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
  }, [sharedPreviewRecords, sourceAssets]);
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
    renderableAssets: assets, renderableAssetIds: assets.map(browserAssetId),
    move: floatingWindow.move,
    rackWidthResize: floatingWindow.rackWidthResize,
    resize: floatingWindow.resize,
    windowPosition: floatingWindow.windowPosition,
    windowSize: floatingWindow.windowSize,
  };
}
