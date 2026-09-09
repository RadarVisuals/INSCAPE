export const BROWSER_SUPPORTED_MEDIA_TYPES = Object.freeze(['image', 'animation']);

export function browserPreviewCandidates(asset) {
  const candidates = Array.isArray(asset?.previewCandidates) ? asset.previewCandidates
    : [asset?.previewSrc, asset?.src];
  return [...new Set(candidates.filter((source) => typeof source === 'string' && source))];
}

export function browserAssetSupportsPreview(asset) {
  return BROWSER_SUPPORTED_MEDIA_TYPES.includes(String(asset?.mediaType || '').toLocaleLowerCase());
}

export function browserPreviewWorkIsCurrent(record, job, asset, signature) {
  if (job?.signature === signature && job.cancelled !== true) return true;
  if (record?.signature !== signature) return false;
  if (record.status === 'ready') return true;
  return record.status === 'unavailable' && record.assetRef === asset;
}

export function decodeBrowserPreview(source, ImageConstructor = globalThis.Image, timeoutMs = 8_000) {
  if (typeof ImageConstructor !== 'function') return Promise.reject(new TypeError('Image decoding is unavailable'));
  return new Promise((resolve, reject) => {
    const image = new ImageConstructor();
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null; image.onerror = null;
      if (error) { reject(error); return; }
      const width = Number.isSafeInteger(image.naturalWidth) && image.naturalWidth > 0 ? image.naturalWidth : null;
      const height = Number.isSafeInteger(image.naturalHeight) && image.naturalHeight > 0 ? image.naturalHeight : null;
      if (!width || !height) { reject(new TypeError('Preview dimensions unavailable')); return; }
      resolve(Object.freeze({ source, width, height }));
    };
    const timeout = setTimeout(() => finish(new TypeError('Preview decoding timed out')), timeoutMs);
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => finish(new TypeError('Preview decoding failed'));
    image.onload = () => finish();
    if (typeof image.decode === 'function') {
      image.src = source;
      image.decode().then(() => finish(), () => {});
      return;
    }
    image.src = source;
  });
}

export async function resolveBrowserPreview(candidates, decode = decodeBrowserPreview) {
  for (const source of candidates) {
    try {
      const decoded = await decode(source);
      return decoded?.source ? decoded : Object.freeze({ source, width: null, height: null });
    }
    catch { /* Try the next already-normalized candidate locally. */ }
  }
  return null;
}
