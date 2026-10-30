import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { defaultBrowserPreferences, libraryOpeningPreferences } from './browserPreferences.js';
import {
  BROWSER_ASSET_SIZE,
  BROWSER_VIEW_KINDS,
  browserAssetId,
  browserViewAssets,
  filterAndSortBrowserAssets,
  reconcileBrowserSelection,
  updateBrowserSelection,
} from './browserWorkspaceModel.js';
import { browserAssetHasPreviewCandidate, browserAssetPreviewUnavailable, browserAssetSupportsPreview,
  browserPreviewCandidates } from './browserRenderableAssets.js';
import useLatticeFloatingWindow from '../windows/useLatticeFloatingWindow.js';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';

const clampSidebarWidth = (value) => Math.min(320, Math.max(48, Number(value) || 174));

const noSubscription = () => () => {};
const EMPTY_ITEMS = Object.freeze([]);
export default function useBrowserWorkspace(data, sharedPreviewRecords = null, initialPreferences = null, preferenceStore = null, open = true) {
  const [localPreferences, setLocalPreferences] = useState(() => ({ ...defaultBrowserPreferences(), ...initialPreferences }));
  const savedPreferences = useSyncExternalStore(preferenceStore?.subscribe || noSubscription, preferenceStore?.getSnapshot || (() => localPreferences));
  const openingProfile = useRef(null);
  const opening = open && data.workspaceReady !== false && openingProfile.current !== data.ownerContext;
  const preferences = opening ? libraryOpeningPreferences(savedPreferences, data.categories || []) : savedPreferences;
  const { view, query, collection, sort, assetSize, sidebarWidth, hideLabels, libraryWidth } = preferences;
  const updatePreferences = preferenceStore?.update || setLocalPreferences;
  useEffect(() => {
    if (!open) openingProfile.current = null;
    else if (opening) {
      openingProfile.current = data.ownerContext;
      if (preferences !== savedPreferences) updatePreferences(preferences);
    }
  }, [open, opening, data.ownerContext, preferences, savedPreferences, updatePreferences]);
  const change = key => value => updatePreferences(current => ({ ...current, [key]: typeof value === 'function' ? value(current[key]) : value }));
  const setView = useCallback(view => updatePreferences(current => ({ ...current, view })), [updatePreferences]);
  const setQuery = change('query'), setCollection = change('collection'), setSort = change('sort');
  const setAssetSize = change('assetSize'), setSidebarWidth = change('sidebarWidth'), setHideLabels = change('hideLabels');
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState(null);
  const [lastCategoryId, setLastCategoryId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const floatingWindow = useLatticeFloatingWindow();
  const sidebarResizeGestureRef = useRef(null);
  const expandedSidebarWidthRef = useRef(sidebarWidth >= 152 ? sidebarWidth : 174);
  const [previewSnapshot, setPreviewSnapshot] = useState(() => ({ records: sharedPreviewRecords || new Map() }));

  const categories = Array.isArray(data?.categories) ? data.categories : EMPTY_ITEMS;
  const selectedCategory = view.kind === BROWSER_VIEW_KINDS.CATEGORY
    ? categories.find((category) => category.id === view.id) || null : null;
  const sourceAssets = useMemo(() => (Array.isArray(data?.assets) ? data.assets : EMPTY_ITEMS).map(asset => {
    const image = selectedCategory?.imageSelections?.find(entry => entry.assetId === browserAssetId(asset));
    return image ? assetForPlacement(asset, { selectedMedia: { url: image.url, width: null, height: null } }) : asset;
  }), [data?.assets, selectedCategory?.imageSelections]);
  useEffect(() => {
    const liveIds = new Set(sourceAssets.map(browserAssetId));
    if (!sharedPreviewRecords) for (const id of previewSnapshot.records.keys()) {
      if (!liveIds.has(id)) previewSnapshot.records.delete(id);
    }
  }, [sharedPreviewRecords, sourceAssets, previewSnapshot]);
  // The snapshot identity changes when this workspace records a decoded preview.
  const assets = useMemo(() => sourceAssets.filter((asset) => browserAssetHasPreviewCandidate(asset)
    && (!browserAssetPreviewUnavailable(previewSnapshot.records.get(browserAssetId(asset)), asset)
      || asset.imageGroups?.length > 1)).map((asset) => {
    const cachedPreview = previewSnapshot.records.get(browserAssetId(asset));
    const preview = cachedPreview?.signature === browserPreviewCandidates(asset).join('\n') ? cachedPreview : null;
    const fallback = browserPreviewCandidates(asset)[0] || null;
    return preview?.status === 'ready' ? {
      ...asset,
      decodedImageHeight: preview.height,
      decodedImageSource: preview.source,
      decodedImageWidth: preview.width,
      previewSrc: preview.source,
    } : { ...asset, previewSrc: preview?.status === 'unavailable' ? null : fallback };
  }), [sourceAssets, previewSnapshot]);
  const unavailableCount = sourceAssets.filter((asset) => !browserAssetHasPreviewCandidate(asset)
    || browserAssetPreviewUnavailable(previewSnapshot.records.get(browserAssetId(asset)), asset)).length;
  const markAssetReady = useCallback((id, source, width, height) => {
    const asset = sourceAssets.find((candidate) => browserAssetId(candidate) === id);
    if (!asset || !source || !Number(width) || !Number(height) || !browserPreviewCandidates(asset).includes(source)) return;
    const current = previewSnapshot.records.get(id);
    if (current?.status === 'ready' && current.signature === browserPreviewCandidates(asset).join('\n') && current.source === source && current.width === width && current.height === height) return;
    previewSnapshot.records.set(id, { assetRef: asset, signature: browserPreviewCandidates(asset).join('\n'),
      source, width, height, status: 'ready' });
    setPreviewSnapshot(value => ({ records: value.records }));
  }, [sourceAssets, previewSnapshot]);
  const markAssetUnavailable = useCallback((id) => {
    const asset = sourceAssets.find((candidate) => browserAssetId(candidate) === id);
    if (!asset) return;
    previewSnapshot.records.set(id, { assetRef: asset,
      signature: browserPreviewCandidates(asset).join('\n'), status: 'unavailable' });
    setPreviewSnapshot(value => ({ records: value.records }));
  }, [sourceAssets, previewSnapshot]);
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

  useEffect(() => {
    if (view.kind !== BROWSER_VIEW_KINDS.CATEGORY || data?.status !== 'ready') return;
    if (categories.some(({ id }) => id === view.id)) { setLastCategoryId(view.id); return; }
    setView({ kind: BROWSER_VIEW_KINDS.ALL, id: null });
  }, [categories, view, data?.status, setView]);

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
    startCategoryId: preferences.startCategoryId, setStartCategory: change('startCategoryId'),
    libraryWidth, setLibraryWidth: change('libraryWidth'),
    relationshipView: preferences.relationshipView, setRelationshipView: change('relationshipView'),
    collapsedSections: preferences.collapsedSections, setCollapsedSections: change('collapsedSections'),
    collection, collections, setCollection, assetSize,
    assetSizeBounds: BROWSER_ASSET_SIZE, setAssetSize,
    sidebarWidth, ensureSidebarWidth,
    sidebarResize: { begin: beginSidebarResize, finish: finishSidebarResize, update: updateSidebarResize },
    hideLabels, setHideLabels, query, setQuery,
    sort, setSort, view, selectView, selectCategoriesDestination, lastCategoryId,
    selectedAsset, selectedAssets, selectedAssetIds, selectAsset, selectForContext, clearSelection, selectAllVisible,
    selectedCategory, dialog, setDialog, filteredAssets, viewAssetCount: scopedAssets.length,
    hasActiveFilters, clearFilters, unavailableCount, markAssetReady, markAssetUnavailable,
    isAssetRenderable, areAssetsRenderable,
    renderableAssets: assets,
    renderableAssetIds: [...renderableIds],
    move: floatingWindow.move,
    rackWidthResize: floatingWindow.rackWidthResize,
    resize: floatingWindow.resize,
    windowPosition: floatingWindow.windowPosition,
    windowSize: floatingWindow.windowSize,
  };
}
