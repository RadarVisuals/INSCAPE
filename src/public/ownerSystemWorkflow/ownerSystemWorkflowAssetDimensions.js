function positiveDimension(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function ownerSystemWorkflowAssetSource(asset) {
  return asset?.src || asset?.originalImageUrl || asset?.imageUrl || asset?.thumbnailUrl || null;
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
  const source = ownerSystemWorkflowAssetSource(asset);
  const width = positiveDimension(decoded?.width);
  const height = positiveDimension(decoded?.height);
  if (!asset || !source || decoded?.source !== source || !width || !height) return asset;
  return Object.freeze({
    ...asset,
    decodedImageSource: source,
    decodedImageWidth: width,
    decodedImageHeight: height,
    imageWidth: width,
    imageHeight: height,
    width,
    height,
  });
}

const decodedBySource = new Map();

export function decodeOwnerSystemWorkflowAssetDimensions(asset, {
  ImageConstructor = globalThis.Image,
  cache = decodedBySource,
} = {}) {
  const source = ownerSystemWorkflowAssetSource(asset);
  if (!source || typeof ImageConstructor !== 'function') return Promise.resolve(null);
  if (cache.has(source)) return cache.get(source);
  const pending = new Promise((resolve) => {
    const image = new ImageConstructor();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const width = positiveDimension(image.naturalWidth);
      const height = positiveDimension(image.naturalHeight);
      resolve(width && height ? Object.freeze({ source, width, height }) : null);
    };
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
}
