import { useEffect, useRef, useState } from 'react';

const MAX_SVG_BYTES = 8 * 1024 * 1024;

export async function readSvgArtwork(source, signal) {
  const response = await fetch(source, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_SVG_BYTES) throw new Error('SVG unavailable');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SVG_BYTES) throw new Error('SVG too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const sourceText = await new Blob(chunks).text();
  if (/<!DOCTYPE/i.test(sourceText)) throw new Error('Unsupported SVG document');
  const document = new DOMParser().parseFromString(sourceText, 'image/svg+xml');
  const svg = document.documentElement;
  if (document.querySelector('parsererror') || svg.localName !== 'svg'
    || svg.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Invalid SVG');
  return svg;
}

async function svgPreview(source, signal) {
  const svg = await readSvgArtwork(source, signal);
  // Percentage-sized standalone documents still need intrinsic preview dimensions.
  const box = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0
    && (!svg.getAttribute('width') || svg.getAttribute('width').includes('%'))
    && (!svg.getAttribute('height') || svg.getAttribute('height').includes('%'))) {
    svg.setAttribute('width', String(box[2])); svg.setAttribute('height', String(box[3]));
  }
  return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
}

// Correct a gateway's XML media type only for the inert thumbnail. Callers
// retain the original source URL for placement, metadata and persistence.
export default function LibraryArtworkImage({ src, fileType, onError, ...props }) {
  const [recovering, setRecovering] = useState(null);
  const [preview, setPreview] = useState(null);
  const errorRef = useRef(onError); errorRef.current = onError;
  useEffect(() => {
    if (recovering !== src) return undefined;
    const controller = new AbortController();
    let disposed = false, objectUrl;
    const timer = setTimeout(() => controller.abort(), 15000);
    svgPreview(src, controller.signal).then(blob => {
      if (disposed || controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setPreview({ source: src, url: objectUrl });
    }).catch(() => { if (!disposed) errorRef.current?.(); })
      .finally(() => clearTimeout(timer));
    return () => { disposed = true; controller.abort(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, recovering]);
  return <img {...props} src={preview?.source === src ? preview.url : src} onError={event => {
    const svg = /^(image\/svg\+xml|svg)$/i.test(fileType || '') || /\.svg(?:[?#]|$)/i.test(src);
    if (svg && recovering !== src) setRecovering(src);
    else onError?.(event);
  }} />;
}
