import { useEffect, useRef } from 'react';
import { useArtworkGeometry } from '../artwork/ArtworkGeometry.jsx';
import { imagePaintClient } from './imagePaintQueue.js';

// Image owns a disposable paint source, never a second authored media record.
// Saved media, fitting, transforms and Inspect still use the original URL.
export function usePreparedImageArtwork(source, enabled) {
  const node = useRef(null), geometry = useArtworkGeometry();
  useEffect(() => {
    if (!enabled || !node.current) return undefined;
    let path;
    try { path = new URL(source, location.href).pathname; } catch { return undefined; }
    // Explicit WebP URLs only. APNG/GIF/AVIF and extensionless media stay native.
    // The worker verifies actual bytes before it can flatten any image.
    if (!/\.webp$/i.test(path)) return undefined;
    const element = node.current, client = imagePaintClient();
    let active = true, generation = 0, timer = 0, url = null, pendingUrl = null;
    let preparedWidth = 0, preparedHeight = 0, requested = '';
    const restore = () => {
      if (url && element.href.baseVal === url) element.setAttribute('href', source);
      if (url) URL.revokeObjectURL(url);
      url = null; preparedWidth = preparedHeight = 0;
    };
    const invalidate = () => {
      generation++; client.cancel();
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      pendingUrl = null;
    };
    const refresh = () => {
      if (!active || !element.getClientRects().length) return;
      const matrix = element.getScreenCTM(); if (!matrix) return;
      const density = (devicePixelRatio || 1) * 2;
      const width = Math.ceil(element.width.baseVal.value * Math.hypot(matrix.a, matrix.b) * density / 128) * 128;
      const height = Math.ceil(element.height.baseVal.value * Math.hypot(matrix.c, matrix.d) * density / 128) * 128;
      if (!width || !height || preparedWidth >= width && preparedHeight >= height) return;
      const key = `${width}:${height}`;
      if (requested === key) return;
      requested = key; invalidate(); restore();
      const current = generation;
      client.prepare({ source, width, height }, async result => {
        if (!active || current !== generation || !result.blob) return;
        const next = URL.createObjectURL(result.blob), image = new Image();
        pendingUrl = next; image.src = next;
        try { await image.decode(); } catch { URL.revokeObjectURL(next); if (pendingUrl === next) pendingUrl = null; return; }
        if (!active || current !== generation) { URL.revokeObjectURL(next); return; }
        pendingUrl = null; url = next; preparedWidth = result.width; preparedHeight = result.height;
        element.setAttribute('href', next);
      });
    };
    // Transform-only camera preparation must restore detail before the next
    // paint. Resize observation covers authored sizing and crop changes.
    const unsubscribe = geometry.subscribe(refresh);
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 0); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element.ownerSVGElement); observer.observe(element);
    addEventListener('resize', refresh); schedule();
    return () => {
      active = false; clearTimeout(timer); invalidate(); observer.disconnect();
      unsubscribe(); removeEventListener('resize', refresh); client.dispose(); restore();
    };
  }, [source, enabled, geometry]);
  return node;
}
