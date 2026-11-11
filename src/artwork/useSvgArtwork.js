import { useEffect, useState } from 'react';

// Detection belongs here for both ordinary rendering and transitions that must
// wait for the right renderer (extensionless IPFS URLs can contain SVGs).
export function useArtworkMediaType(src, fileType) {
  const [detected, setDetected] = useState(null);
  let path = '';
  try { path = new URL(src, globalThis.location?.href).pathname; } catch { /* Unresolved source. */ }
  const knownSvg = /^image\/svg\+xml(?:;|$)/i.test(fileType || '') || /\.svg$/i.test(path) || /^data:image\/svg\+xml[;,]/i.test(src || '');
  const knownRaster = /\.(png|jpe?g|gif|webp|avif)$/i.test(path) || /^image\/(png|jpeg|gif|webp|avif)$/i.test(fileType || '');
  useEffect(() => {
    if (!src || knownSvg || knownRaster) return undefined;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch(src, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal })
      .then(async response => {
        await response.body?.cancel();
        if (!controller.signal.aborted) setDetected({ src,
          svg: response.ok && response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'image/svg+xml' });
      }).catch(() => { if (active) setDetected({ src, svg: false }); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [src, knownSvg, knownRaster]);
  return { svg: Boolean(knownSvg || detected && detected.src === src && detected.svg),
    pending: Boolean(src && !knownSvg && !knownRaster && detected?.src !== src) };
}

export default function useSvgArtwork(src, fileType) {
  return useArtworkMediaType(src, fileType).svg;
}
