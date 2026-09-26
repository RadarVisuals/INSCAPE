import { useEffect, useState } from 'react';

export default function useSvgArtwork(src, fileType) {
  const [detected, setDetected] = useState(null);
  let path = '';
  try { path = new URL(src, globalThis.location?.href).pathname; } catch { /* Unresolved source. */ }
  const knownSvg = /^image\/svg\+xml(?:;|$)/i.test(fileType || '') || /\.svg$/i.test(path) || /^data:image\/svg\+xml[;,]/i.test(src || '');
  const knownRaster = /\.(png|jpe?g|gif|webp|avif)$/i.test(path) || /^image\/(png|jpeg|gif|webp|avif)$/i.test(fileType || '');
  useEffect(() => {
    if (!src || knownSvg || knownRaster) return undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch(src, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal })
      .then(async response => {
        await response.body?.cancel();
        if (!controller.signal.aborted && response.ok) setDetected({ src,
          svg: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'image/svg+xml' });
      }).catch(() => {}).finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [src, knownSvg, knownRaster]);
  return Boolean(knownSvg || detected && detected.src === src && detected.svg);
}
