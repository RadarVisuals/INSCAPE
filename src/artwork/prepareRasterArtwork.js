// Browser-only, also injected into the isolated SVG document host. This owns a
// disposable paint source, never the saved artwork URL or animation geometry.
export function prepareRasterArtwork(node, source, { scale = 1, observe = true } = {}) {
  const svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
  const read = () => svg ? node.href.baseVal : node.getAttribute('src');
  const write = value => node.setAttribute(svg ? 'href' : 'src', value);
  let active = true, version = 0, frame = 0, url = null, dimensions = '', density = scale;
  const original = new Image();
  const restore = () => {
    if (url && read() === url) write(source);
    if (url) URL.revokeObjectURL(url);
    url = null; dimensions = '';
  };
  const prepare = async () => {
    const current = ++version;
    if (!active || !original.naturalWidth || original.naturalWidth * original.naturalHeight > 16_777_216
      || (read() !== source && read() !== url)) return;
    let width, height;
    if (svg) {
      const matrix = node.getScreenCTM();
      if (!matrix) return;
      width = node.width.baseVal.value * Math.hypot(matrix.a, matrix.b);
      height = node.height.baseVal.value * Math.hypot(matrix.c, matrix.d);
    } else {
      const box = node.getBoundingClientRect(); width = box.width; height = box.height;
    }
    if (!(width > 0 && height > 0)) return;
    // Retain two physical pixels per displayed pixel for rotation and fractional
    // movement. Full-size sources remain available for inspection or enlargement.
    const ratio = Math.min(1, Math.max(width / original.naturalWidth, height / original.naturalHeight) * density * 2);
    if (ratio >= .75) { restore(); return; }
    const w = Math.max(1, Math.ceil(original.naturalWidth * ratio));
    const h = Math.max(1, Math.ceil(original.naturalHeight * ratio));
    const key = `${w}:${h}`;
    if (dimensions === key || w * h > 4_000_000) return;
    const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas'); canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(original, 0, 0, w, h);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    canvas.width = canvas.height = 0;
    if (!active || current !== version || !blob || (read() !== source && read() !== url)) return;
    const next = URL.createObjectURL(blob), decoded = new Image(); decoded.src = next;
    try { await decoded.decode(); } catch { URL.revokeObjectURL(next); return; }
    if (!active || current !== version || (read() !== source && read() !== url)) { URL.revokeObjectURL(next); return; }
    const previous = url; url = next; dimensions = key; write(next);
    if (previous) URL.revokeObjectURL(previous);
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { frame = 0; void prepare(); });
  };
  original.onload = () => {
    // Artwork already has stricter format-specific limits. Bound this optional
    // decode too; unsupported or failed preparation simply keeps the original.
    if (original.naturalWidth * original.naturalHeight <= 16_777_216) schedule();
  };
  original.src = source;
  const observer = observe ? new ResizeObserver(schedule) : null;
  observer?.observe(svg ? node.ownerSVGElement : node);
  return {
    setScale(value) {
      if (density === value) return;
      density = value; version++;
      if (value === Infinity) { cancelAnimationFrame(frame); restore(); }
      else schedule();
    },
    dispose() {
      active = false; version++; cancelAnimationFrame(frame); observer?.disconnect();
      original.onload = null; original.src = ''; restore();
    },
  };
}
