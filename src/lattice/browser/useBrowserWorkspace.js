import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BROWSER_FILING_FILTERS,
  BROWSER_TABS,
  clampBrowserSize,
  filterBrowserAssets,
  initialBrowserSize,
  resizeBrowserAroundCenter,
  resizeBrowserByKey,
  searchBrowserCategoryAssets,
} from './browserWorkspaceModel.js';

const viewportSize = () => ({ height: globalThis.innerHeight || 720, width: globalThis.innerWidth || 1280 });

export default function useBrowserWorkspace(data) {
  const [activeTab, setActiveTab] = useState(BROWSER_TABS.INDEX);
  const [query, setQuery] = useState('');
  const [filing, setFiling] = useState(BROWSER_FILING_FILTERS.ALL);
  const [mediaType, setMediaType] = useState('all');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [windowSize, setWindowSize] = useState(() => initialBrowserSize(viewportSize()));
  const resizeGestureRef = useRef(null);

  const assets = Array.isArray(data?.assets) ? data.assets : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const favorites = Array.isArray(data?.favorites) ? data.favorites : [];
  const filteredAssets = useMemo(() => filterBrowserAssets(assets, categories, {
    favorites, filing, mediaType, query,
  }), [assets, categories, favorites, filing, mediaType, query]);
  const categoryAssets = useMemo(() => searchBrowserCategoryAssets(assets, query), [assets, query]);
  const mediaTypes = useMemo(() => [...new Set(assets.map((asset) => String(asset?.mediaType || '').toLocaleLowerCase()).filter(Boolean))], [assets]);
  const selectedAsset = assets.find((asset) => (asset.stableAssetId || asset.id) === selectedAssetId) || null;
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || categories[0] || null;

  useEffect(() => {
    if (!selectedCategoryId && categories[0]) setSelectedCategoryId(categories[0].id);
    else if (selectedCategoryId && !categories.some(({ id }) => id === selectedCategoryId)) setSelectedCategoryId(categories[0]?.id || null);
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (selectedAssetId && !assets.some((asset) => (asset.stableAssetId || asset.id) === selectedAssetId)) setSelectedAssetId(null);
  }, [assets, selectedAssetId]);

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = viewportSize();
      setViewport(nextViewport);
      setWindowSize((current) => clampBrowserSize(current, nextViewport));
    };
    globalThis.addEventListener?.('resize', handleResize);
    return () => globalThis.removeEventListener?.('resize', handleResize);
  }, []);

  const beginResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeGestureRef.current = { point: { x: event.clientX, y: event.clientY }, size: windowSize };
  };
  const updateResize = (event) => {
    const gesture = resizeGestureRef.current;
    if (!gesture || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setWindowSize(resizeBrowserAroundCenter(gesture.size, { x: event.clientX - gesture.point.x, y: event.clientY - gesture.point.y }, viewport));
  };
  const finishResize = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resizeGestureRef.current = null;
  };
  const resizeByKey = (event) => {
    const next = resizeBrowserByKey(windowSize, event.key, viewport);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setWindowSize(next);
  };

  return {
    activeTab, setActiveTab, query, setQuery, filing, setFiling, mediaType, setMediaType,
    selectedAsset, selectedAssetId, setSelectedAssetId, selectedCategory, selectedCategoryId, setSelectedCategoryId,
    dialog, setDialog, categoryAssets, filteredAssets, mediaTypes, windowSize,
    resize: { begin: beginResize, finish: finishResize, keyDown: resizeByKey, update: updateResize },
  };
}
