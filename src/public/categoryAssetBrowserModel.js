export const CATEGORY_BROWSER_GAP = 8;
export const CATEGORY_BROWSER_RESIZE_STEP = 40;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function normalizeAssetRatio(value, fallback = 1) {
  const ratio = Number(value);
  return Number.isFinite(ratio) && ratio > 0.05 && ratio < 20 ? ratio : fallback;
}

export function makeJustifiedAssetRows(assets, width, targetHeight = 190, gap = CATEGORY_BROWSER_GAP) {
  const availableWidth = Number(width);
  if (!Number.isFinite(availableWidth) || availableWidth <= 0 || !Array.isArray(assets) || !assets.length) return [];
  const rows = [];
  let pending = [];
  let ratioTotal = 0;

  for (const asset of assets) {
    const normalized = { ...asset, ratio: normalizeAssetRatio(asset?.ratio) };
    pending.push(normalized);
    ratioTotal += normalized.ratio;
    const projectedWidth = ratioTotal * targetHeight + gap * Math.max(0, pending.length - 1);
    if (projectedWidth >= availableWidth && pending.length > 1) {
      rows.push({ assets: pending, height: (availableWidth - gap * (pending.length - 1)) / ratioTotal, incomplete: false });
      pending = [];
      ratioTotal = 0;
    }
  }

  if (pending.length) {
    const justifiedHeight = (availableWidth - gap * Math.max(0, pending.length - 1)) / ratioTotal;
    rows.push({ assets: pending, height: Math.min(targetHeight, justifiedHeight), incomplete: true });
  }
  return rows;
}

export function initialCategoryBrowserRect(viewport) {
  const viewportWidth = Math.max(320, Number(viewport?.width) || 1280);
  const viewportHeight = Math.max(320, Number(viewport?.height) || 720);
  const left = 244;
  const top = 20;
  return {
    left,
    top,
    width: Math.max(320, Math.min(1180, viewportWidth - left - 20)),
    height: Math.max(260, Math.min(760, viewportHeight - 40))
  };
}

export function resizeCategoryBrowserRect(rect, delta, viewport, step = CATEGORY_BROWSER_RESIZE_STEP) {
  const source = rect || initialCategoryBrowserRect(viewport);
  const viewportWidth = Math.max(320, Number(viewport?.width) || 1280);
  const viewportHeight = Math.max(320, Number(viewport?.height) || 720);
  const maximumWidth = Math.max(320, viewportWidth - source.left - 20);
  const maximumHeight = Math.max(260, viewportHeight - source.top - 20);
  const snap = (value) => Math.round(value / step) * step;
  return {
    ...source,
    width: clamp(snap(source.width + (Number(delta?.x) || 0)), Math.min(320, maximumWidth), maximumWidth),
    height: clamp(snap(source.height + (Number(delta?.y) || 0)), Math.min(260, maximumHeight), maximumHeight)
  };
}

export function resizeCategoryBrowserByKey(rect, key, viewport) {
  const delta = {
    ArrowLeft: { x: -CATEGORY_BROWSER_RESIZE_STEP, y: 0 },
    ArrowRight: { x: CATEGORY_BROWSER_RESIZE_STEP, y: 0 },
    ArrowUp: { x: 0, y: -CATEGORY_BROWSER_RESIZE_STEP },
    ArrowDown: { x: 0, y: CATEGORY_BROWSER_RESIZE_STEP }
  }[key];
  return delta ? resizeCategoryBrowserRect(rect, delta, viewport) : null;
}
