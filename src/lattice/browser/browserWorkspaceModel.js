export const BROWSER_TABS = Object.freeze({ INDEX: 'index', CATEGORIES: 'categories' });
export const BROWSER_FILING_FILTERS = Object.freeze({ ALL: 'all', SORTED: 'sorted', UNSORTED: 'unsorted' });
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

export function filterBrowserAssets(assets, categories, { filing = BROWSER_FILING_FILTERS.ALL, mediaType = 'all', query = '' } = {}) {
  const source = Array.isArray(assets) ? assets : [];
  const filedIds = new Set((Array.isArray(categories) ? categories : [])
    .flatMap((category) => Array.isArray(category.assetIds) ? category.assetIds : []));
  const tokens = String(query || '').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return source.filter((asset) => {
    const id = asset?.stableAssetId || asset?.id;
    if (filing === BROWSER_FILING_FILTERS.SORTED && !filedIds.has(id)) return false;
    if (filing === BROWSER_FILING_FILTERS.UNSORTED && filedIds.has(id)) return false;
    if (mediaType !== 'all' && String(asset?.mediaType || '').toLocaleLowerCase() !== mediaType) return false;
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
