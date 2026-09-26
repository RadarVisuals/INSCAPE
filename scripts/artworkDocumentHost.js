// An opaque-origin document for self-contained SVG artwork. Network access is
// restricted to the two public LUKSO RPCs used by the supported artwork.
// No wallet bridge, storage access, external scripts or general network access.
export const ARTWORK_DOCUMENT_PATH = '/.netlify/functions/artwork-document';
export const ARTWORK_DOCUMENT_HEADERS = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https://rpc.mainnet.lukso.network https://42.rpc.thirdweb.com; img-src data: blob:; font-src data:; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
});

// Runs inside the opaque SVG document, where its image cache lives. Preparing
// the same URLs in the outer host does not warm this cache. Only an explicit
// inspection request allocates full-size decodes; ordinary thumbnails do not.
function prepareSvgInspection() {
  let request = null, pending = null;
  const retained = new Set();
  const prepare = () => {
    if (pending) return pending;
    pending = (async () => {
      const urls = [...new Set([...document.querySelectorAll('image')].map(node => node.href.baseVal))]
        .filter(url => /^data:image\/(png|jpe?g|webp)[;,]/i.test(url)).slice(0, 16);
      const images = await Promise.all(urls.map(url => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
      })));
      let pixels = 0;
      const bounded = images.filter(image => {
        const size = image ? image.naturalWidth * image.naturalHeight : 0;
        if (!size || size > 4_000_000 || pixels + size > 20_000_000) return false;
        pixels += size; return true;
      });
      await Promise.allSettled(bounded.map(image => image.decode()));
      if (request !== null) bounded.forEach(image => retained.add(image));
    })().finally(() => { pending = null; });
    return pending;
  };
  addEventListener('message', async event => {
    if (event.source !== parent) return;
    if (event.data?.type === 'inscape:release-artwork') {
      request = null; retained.clear(); return;
    }
    if (event.data?.type !== 'inscape:prepare-artwork' || !Number.isSafeInteger(event.data.requestId)) return;
    const id = request = event.data.requestId;
    try { await prepare(); } catch { /* Preparation is optional; retain the live artwork on failure. */ }
    if (request === id) parent.postMessage({ type: 'inscape:artwork-prepared', requestId: id }, '*');
  });
}

export const ARTWORK_DOCUMENT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>INSCAPE artwork</title>
<style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden;background:transparent;color-scheme:normal}iframe{display:block}</style>
</head><body><script>
(() => {
  let url, frame;
  addEventListener('message', event => {
    if (event.source === frame?.contentWindow && event.data?.type === 'inscape:artwork-prepared'
      && Number.isSafeInteger(event.data.requestId)) {
      parent.postMessage({ type: 'inscape:artwork-prepared', requestId: event.data.requestId }, '*'); return;
    }
    if (event.source === parent && ['inscape:prepare-artwork', 'inscape:release-artwork'].includes(event.data?.type)) {
      frame?.contentWindow.postMessage(event.data, '*'); return;
    }
    if (event.source !== parent || event.data?.type !== 'inscape:artwork-source'
      || typeof event.data.svg !== 'string' || event.data.svg.length > 8 * 1024 * 1024 || url) return;
    const svg = new DOMParser().parseFromString(event.data.svg, 'image/svg+xml');
    const preparation = svg.createElementNS('http://www.w3.org/2000/svg', 'script');
    preparation.textContent = ${JSON.stringify(`(${prepareSvgInspection.toString()})();`)};
    svg.documentElement.append(preparation);
    url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml'}));
    frame = document.createElement('iframe');
    frame.title = 'Interactive artwork';
    frame.sandbox = 'allow-scripts';
    frame.referrerPolicy = 'no-referrer';
    frame.addEventListener('load', () => parent.postMessage({type:'inscape:artwork-loaded'}, '*'), {once:true});
    frame.src = url;
    document.body.append(frame);
  });
  addEventListener('pagehide', () => { if (url) URL.revokeObjectURL(url); });
})();
</script></body></html>`;

export function artworkDocumentHostPlugin() {
  const install = server => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== ARTWORK_DOCUMENT_PATH) return next();
      for (const [name, value] of Object.entries(ARTWORK_DOCUMENT_HEADERS)) response.setHeader(name, value);
      response.end(ARTWORK_DOCUMENT_HTML);
    });
  };
  return { name: 'artwork-document-host', configureServer: install, configurePreviewServer: install };
}
