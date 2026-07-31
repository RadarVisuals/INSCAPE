export const BROWSER_TABS = Object.freeze({ INDEX: 'index', CATEGORIES: 'categories' });
export const BROWSER_FILING_FILTERS = Object.freeze({
  ALL: 'all',
  FAVORITES: 'favorites',
  SORTED: 'sorted',
  UNSORTED: 'unsorted',
});
export const BROWSER_RESIZE_STEP = 24;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function browserViewportBounds(viewport) {
  const width = Math.max(320, Number(viewport?.width) || 1280);
  const height = Math.max(320, Number(viewport?.height) || 720);
  const margin = width < 760 || height < 600 ? 10 : 48;
  return {
    maximumHeight: Math.max(300, height - (margin * 2)),
    maximumWidth: Math.max(300, width - (margin * 2)),
    minimumHeight: Math.min(440, Math.max(300, height - (margin * 2))),
    minimumWidth: Math.min(680, Math.max(300, width - (margin * 2))),
  };
}

export function initialBrowserSize(viewport) {
  const bounds = browserViewportBounds(viewport);
  return {
    width: clamp(1040, bounds.minimumWidth, bounds.maximumWidth),
    height: clamp(680, bounds.minimumHeight, bounds.maximumHeight),
  };
}

export function clampBrowserSize(size, viewport) {
  const bounds = browserViewportBounds(viewport);
  return {
    width: clamp(Number(size?.width) || bounds.minimumWidth, bounds.minimumWidth, bounds.maximumWidth),
    height: clamp(Number(size?.height) || bounds.minimumHeight, bounds.minimumHeight, bounds.maximumHeight),
  };
}

export function resizeBrowserAroundCenter(size, delta, viewport) {
  return clampBrowserSize({
    width: (Number(size?.width) || 0) + ((Number(delta?.x) || 0) * 2),
    height: (Number(size?.height) || 0) + ((Number(delta?.y) || 0) * 2),
  }, viewport);
}

export function resizeBrowserByKey(size, key, viewport, step = BROWSER_RESIZE_STEP) {
  const delta = {
    ArrowDown: { x: 0, y: step / 2 },
    ArrowLeft: { x: -step / 2, y: 0 },
    ArrowRight: { x: step / 2, y: 0 },
    ArrowUp: { x: 0, y: -step / 2 },
  }[key];
  return delta ? resizeBrowserAroundCenter(size, delta, viewport) : null;
}

export function filterBrowserAssets(assets, categories, {
  favorites = [],
  filing = BROWSER_FILING_FILTERS.ALL,
  query = '',
} = {}) {
  const source = Array.isArray(assets) ? assets : [];
  const favoriteIds = new Set(Array.isArray(favorites) ? favorites : []);
  const filedIds = new Set((Array.isArray(categories) ? categories : [])
    .flatMap((category) => Array.isArray(category.assetIds) ? category.assetIds : []));
  const tokens = String(query || '').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return source.filter((asset) => {
    const id = asset?.stableAssetId || asset?.id;
    if (filing === BROWSER_FILING_FILTERS.FAVORITES && !favoriteIds.has(id)) return false;
    if (filing === BROWSER_FILING_FILTERS.SORTED && !filedIds.has(id)) return false;
    if (filing === BROWSER_FILING_FILTERS.UNSORTED && filedIds.has(id)) return false;
    const searchable = [asset?.title, asset?.collection, asset?.stableAssetId, asset?.mediaType]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return tokens.every((token) => searchable.includes(token));
  });
}

export function searchBrowserCategoryAssets(assets, query = '') {
  const tokens = String(query || '').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return (Array.isArray(assets) ? assets : []).filter((asset) => {
    const searchable = [asset?.title, asset?.collection, asset?.stableAssetId, asset?.mediaType]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return tokens.every((token) => searchable.includes(token));
  });
}

export function categoryDialogInitialName(dialog) {
  return dialog?.type === 'rename' ? String(dialog?.category?.name || '') : '';
}

export const BROWSER_VIEW_KINDS = Object.freeze({
  ALL: 'all', CATEGORY: 'category', UNSORTED: 'unsorted', USED: 'used',
});
export const BROWSER_SORTS = Object.freeze({ TITLE_ASC: 'title-asc', TITLE_DESC: 'title-desc', COLLECTION: 'collection' });
export const BROWSER_DISPLAY_MODES = Object.freeze({ GRID: 'grid', LIST: 'list' });
export const BROWSER_ASSET_SIZE = Object.freeze({
  DEFAULT: 150,
  LIST: 68,
  MAXIMUM: 420,
  MINIMUM: 68,
});
export const browserAssetId = (asset) => asset?.stableAssetId || asset?.id || null;

export function categoryAssetIds(categories) {
  return new Set((Array.isArray(categories) ? categories : [])
    .flatMap((category) => Array.isArray(category?.assetIds) ? category.assetIds : []));
}

export function browserViewAssets(assets, categories, view, usedAssetIds = []) {
  const source = Array.isArray(assets) ? assets : [];
  if (view?.kind === BROWSER_VIEW_KINDS.CATEGORY) {
    const category = (Array.isArray(categories) ? categories : []).find(({ id }) => id === view.id);
    const ids = new Set(category?.assetIds || []);
    return source.filter((asset) => ids.has(browserAssetId(asset)));
  }
  if (view?.kind === BROWSER_VIEW_KINDS.UNSORTED) {
    const filed = categoryAssetIds(categories);
    return source.filter((asset) => !filed.has(browserAssetId(asset)));
  }
  if (view?.kind === BROWSER_VIEW_KINDS.USED) {
    const used = new Set(Array.isArray(usedAssetIds) ? usedAssetIds : []);
    return source.filter((asset) => used.has(browserAssetId(asset)));
  }
  return source;
}

export function filterAndSortBrowserAssets(assets, {
  collection = 'all', query = '', sort = BROWSER_SORTS.TITLE_ASC,
} = {}) {
  const tokens = String(query || '').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const filtered = (Array.isArray(assets) ? assets : []).filter((asset) => {
    if (collection !== 'all' && String(asset?.collection || '') !== collection) return false;
    const searchable = [asset?.title, asset?.collection, browserAssetId(asset), asset?.mediaType]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return tokens.every((token) => searchable.includes(token));
  });
  const compare = (left, right) => String(left || '').localeCompare(String(right || ''), undefined,
    { numeric: true, sensitivity: 'base' });
  return [...filtered].sort((left, right) => {
    const title = compare(left?.title || browserAssetId(left), right?.title || browserAssetId(right));
    if (sort === BROWSER_SORTS.TITLE_DESC) return -title;
    if (sort === BROWSER_SORTS.COLLECTION) return compare(left?.collection, right?.collection) || title;
    return title;
  });
}

export function reconcileBrowserSelection(selectedIds, assets) {
  const available = new Set((Array.isArray(assets) ? assets : []).map(browserAssetId));
  return (Array.isArray(selectedIds) ? selectedIds : []).filter((id) => available.has(id));
}

export function updateBrowserSelection(selectedIds, visibleAssets, targetId, {
  additive = false, range = false, anchorId = null,
} = {}) {
  const visibleIds = visibleAssets.map(browserAssetId).filter(Boolean);
  if (!visibleIds.includes(targetId)) return { anchorId, selectedIds };
  if (range && anchorId && visibleIds.includes(anchorId)) {
    const start = visibleIds.indexOf(anchorId); const end = visibleIds.indexOf(targetId);
    const ids = visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1);
    return { anchorId, selectedIds: additive ? [...new Set([...selectedIds, ...ids])] : ids };
  }
  if (additive) return {
    anchorId: targetId,
    selectedIds: selectedIds.includes(targetId) ? selectedIds.filter((id) => id !== targetId) : [...selectedIds, targetId],
  };
  return { anchorId: targetId, selectedIds: [targetId] };
}

export function categoryMembershipState(category, selectedIds) {
  const members = new Set(category?.assetIds || []); const ids = Array.isArray(selectedIds) ? selectedIds : [];
  const included = ids.filter((id) => members.has(id)).length;
  return included === 0 ? 'none' : included === ids.length ? 'all' : 'mixed';
}
