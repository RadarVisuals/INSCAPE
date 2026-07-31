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

export function decodeBrowserPreview(source, ImageConstructor = globalThis.Image) {
  if (typeof ImageConstructor !== 'function') return Promise.reject(new TypeError('Image decoding is unavailable'));
  return new Promise((resolve, reject) => {
    const image = new ImageConstructor();
    image.decoding = 'async';
    image.onerror = () => reject(new TypeError('Preview decoding failed'));
    if (typeof image.decode === 'function') {
      image.src = source;
      image.decode().then(() => resolve(source), reject);
      return;
    }
    image.onload = () => resolve(source);
    image.src = source;
  });
}

export async function resolveBrowserPreview(candidates, decode = decodeBrowserPreview) {
  for (const source of candidates) {
    try { await decode(source); return source; }
    catch { /* Try the next already-normalized candidate locally. */ }
  }
  return null;
}
