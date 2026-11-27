export const KEEPER_VISION = Object.freeze({ count: 2, edge: 512, imageChars: 1_500_000 });

// A source-art preview, not a screenshot of the desktop or a scriptable SVG
// document. Loading SVG as an image keeps its scripts and external resources off.
export function keeperArtworkPreview(src, { signal, document = globalThis.document } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(src, document.baseURI);
    if (!['https:', 'http:', 'blob:', 'data:'].includes(url.protocol)
      || url.protocol === 'http:' && url.origin !== new URL(document.baseURI).origin
      || url.protocol === 'data:' && !/^data:image\/(png|webp|jpeg|svg\+xml)[;,]/i.test(src)) {
      reject(new Error('Artwork source cannot be previewed.')); return;
    }
    const image = new document.defaultView.Image();
    const controller = new AbortController();
    let complete = false, recovered = false, objectUrl;
    const finish = (error, value) => {
      if (complete) return;
      complete = true; controller.abort();
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      image.onload = image.onerror = null; image.removeAttribute('src');
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(signal.reason || new DOMException('Stopped', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Artwork preview took too long.')), 8000);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
    image.onerror = async () => {
      if (recovered) { finish(new Error('This source does not allow an artwork preview.')); return; }
      recovered = true;
      try {
        // Reuse the Library's bounded SVG reader for gateways serving SVG as
        // application/xml. The resulting blob still loads only as an inert image.
        const { svgPreview } = await import('../public/ownerSystemWorkflow/LibraryArtworkImage.jsx');
        const blob = await svgPreview(url.href, controller.signal);
        if (complete) return;
        objectUrl = URL.createObjectURL(blob); image.src = objectUrl;
      } catch { finish(new Error('This source does not allow an artwork preview.')); }
    };
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('Artwork is not ready.');
        const scale = Math.min(1, KEEPER_VISION.edge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#808080'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > KEEPER_VISION.imageChars) throw new Error('Artwork preview is too large.');
        finish(null, dataUrl);
      } catch (error) { finish(error); }
    };
    image.src = url.href;
  });
}
