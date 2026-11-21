// Read only enough of an original to establish its intrinsic geometry. A
// gateway may ignore Range, so the reader still cancels at the byte limit.
export function imageHeaderDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset, length) => new TextDecoder().decode(bytes.subarray(offset, offset + length));
  const dimensions = (width, height) => Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0 ? { width, height } : null;
  if (bytes.length >= 24 && ascii(1, 3) === 'PNG') return dimensions(view.getUint32(16), view.getUint32(20));
  if (bytes.length >= 10 && ascii(0, 3) === 'GIF') return dimensions(view.getUint16(6, true), view.getUint16(8, true));
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    for (let offset = 12; offset + 18 <= bytes.length;) {
      const type = ascii(offset, 4), length = view.getUint32(offset + 4, true), data = offset + 8;
      if (type === 'VP8X' && bytes[data] & 8) return null; // EXIF orientation needs the browser decoder.
      if (type === 'VP8X') return dimensions(1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16), 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16));
      if (type === 'VP8 ') return dimensions(view.getUint16(data + 6, true) & 16383, view.getUint16(data + 8, true) & 16383);
      if (type === 'VP8L') { const bits = view.getUint32(data + 1, true); return dimensions(1 + (bits & 16383), 1 + ((bits >>> 14) & 16383)); }
      offset = data + length + length % 2;
    }
  }
  // JPEG/AVIF use the browser decoder, which also applies orientation metadata.
  const tag = ascii(0, Math.min(bytes.length, 32768)).match(/<svg\b[^>]*>/i)?.[0];
  if (tag) {
    const attr = name => tag.match(new RegExp('\\b' + name + '\\s*=\\s*["\x27]([^"\x27]+)', 'i'))?.[1];
    const width = attr('width'), height = attr('height');
    if (/^\d+(?:\.\d+)?(?:px)?$/.test(width) && /^\d+(?:\.\d+)?(?:px)?$/.test(height)) return dimensions(Math.round(parseFloat(width)), Math.round(parseFloat(height)));
    const box = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
    if (box?.length === 4) return dimensions(Math.round(box[2]), Math.round(box[3]));
  }
  return null;
}

const pending = new Map();
export function readImageHeaderDimensions(source, fetchImpl = globalThis.fetch) {
  if (!source || typeof fetchImpl !== 'function') return Promise.resolve(null);
  if (pending.has(source)) return pending.get(source);
  const promise = (async () => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 4000);
    let reader;
    try {
      const response = await fetchImpl(source, { headers: { Range: 'bytes=0-65535' }, credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
      if (!response.ok || !response.body) return null;
      reader = response.body.getReader(); let bytes = new Uint8Array(0);
      while (bytes.length < 65536) {
        const { done, value } = await reader.read(); if (done) break;
        const next = new Uint8Array(Math.min(65536, bytes.length + value.length));
        next.set(bytes); next.set(value.subarray(0, next.length - bytes.length), bytes.length); bytes = next;
        const dimensions = imageHeaderDimensions(bytes);
        if (dimensions) return { source, ...dimensions };
      }
    } catch { /* Fall back to the existing image decoder. */ }
    finally { clearTimeout(timeout); await reader?.cancel().catch(() => {}); controller.abort(); }
    return null;
  })();
  pending.set(source, promise);
  if (pending.size > 128) pending.delete(pending.keys().next().value);
  promise.then(result => { if (!result && pending.get(source) === promise) pending.delete(source); });
  return promise;
}
