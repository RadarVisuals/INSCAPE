function positiveDimension(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function ownerSystemWorkflowAssetSources(asset) {
  return [...new Set([
    asset?.decodedImageSource,
    asset?.previewSrc,
    ...(Array.isArray(asset?.previewCandidates) ? asset.previewCandidates : []),
    asset?.src,
    asset?.originalImageUrl,
    asset?.imageUrl,
    asset?.thumbnailUrl,
  ].filter((source) => typeof source === 'string' && source))];
}

export function ownerSystemWorkflowAssetSource(asset) {
  return ownerSystemWorkflowAssetSources(asset)[0] || null;
}

export function ownerSystemWorkflowAssetDimensions(asset) {
  if (!asset) return null;
  const decodedWidth = positiveDimension(asset.decodedImageWidth);
  const decodedHeight = positiveDimension(asset.decodedImageHeight);
  const source = ownerSystemWorkflowAssetSource(asset);
  if (decodedWidth && decodedHeight && source && asset.decodedImageSource === source) {
    return Object.freeze({ width: decodedWidth, height: decodedHeight });
  }
  const width = positiveDimension(asset.imageWidth) ?? positiveDimension(asset.width);
  const height = positiveDimension(asset.imageHeight) ?? positiveDimension(asset.height);
  return width && height ? Object.freeze({ width, height }) : null;
}

export function ownerSystemWorkflowDecodedAsset(asset, decoded) {
  const acceptedSources = ownerSystemWorkflowAssetSources(asset);
  const source = decoded?.source;
  const width = positiveDimension(decoded?.width);
  const height = positiveDimension(decoded?.height);
  if (!asset || !source || !acceptedSources.includes(source) || !width || !height) return asset;
  return Object.freeze({
    ...asset,
    decodedImageSource: source,
    decodedImageWidth: width,
    decodedImageHeight: height,
    imageWidth: width,
    imageHeight: height,
    previewSrc: source,
    src: source,
    width,
    height,
  });
}

const decodedBySource = new Map();

export function decodeOwnerSystemWorkflowAssetDimensions(asset, {
  ImageConstructor = globalThis.Image,
  cache = decodedBySource,
  timeoutMs = 8_000,
} = {}) {
  const accepted = ownerSystemWorkflowAssetDimensions(asset);
  if (accepted && asset?.decodedImageSource) return Promise.resolve(Object.freeze({
    source: asset.decodedImageSource, ...accepted,
  }));
  const sources = ownerSystemWorkflowAssetSources(asset);
  if (!sources.length || typeof ImageConstructor !== 'function') return Promise.resolve(null);
  const decodeSource = (source) => {
    if (cache.has(source)) return cache.get(source);
    const pending = new Promise((resolve) => {
    const image = new ImageConstructor();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null; image.onerror = null;
      const width = positiveDimension(image.naturalWidth);
      const height = positiveDimension(image.naturalHeight);
      resolve(width && height ? Object.freeze({ source, width, height }) : null);
    };
    const timeout = setTimeout(finish, timeoutMs);
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = finish;
    image.onerror = finish;
    image.src = source;
    if (typeof image.decode === 'function') image.decode().then(finish, () => {});
  });
    cache.set(source, pending);
    pending.then((dimensions) => {
      if (!dimensions && cache.get(source) === pending) cache.delete(source);
    });
    return pending;
  };
  return (async () => {
    for (const source of sources) {
      const dimensions = await decodeSource(source);
      if (dimensions) return dimensions;
    }
    return null;
  })();
}
