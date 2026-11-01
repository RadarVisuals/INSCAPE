// Decode and resize away from the UI thread. Only one bounded job runs at a
// time; the host owns queueing, source URLs and each side's lifetime.
const MAX_BYTES = 8 * 1024 * 1024, MAX_PIXELS = 16_777_216;
let current;

function stillWebPSize(bytes) {
  if (bytes.length < 30) return null;
  const text = (a, b) => String.fromCharCode(...bytes.subarray(a, b));
  if (text(0, 4) !== 'RIFF' || text(8, 12) !== 'WEBP') return null;
  const read24 = at => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
  switch (text(12, 16)) {
    // Preserve animation, embedded colour profiles and EXIF orientation through
    // the native renderer; a PNG paint derivative must not flatten those.
    case 'VP8X': return bytes[20] & 0x2a ? null : { width: read24(24) + 1, height: read24(27) + 1 };
    case 'VP8L': return bytes[20] !== 0x2f ? null : {
      width: 1 + (bytes[21] | (bytes[22] & 63) << 8),
      height: 1 + (bytes[22] >> 6 | bytes[23] << 2 | (bytes[24] & 15) << 10),
    };
    case 'VP8 ': return { width: (bytes[26] | bytes[27] << 8) & 0x3fff, height: (bytes[28] | bytes[29] << 8) & 0x3fff };
    default: return null;
  }
}

async function readStillWebP(source, signal) {
  const response = await fetch(source, { credentials: 'omit', referrerPolicy: 'no-referrer', signal });
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_BYTES) {
    await response.body?.cancel(); return null;
  }
  const reader = response.body.getReader(), chunks = [], header = new Uint8Array(30);
  let size, length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.length > MAX_BYTES) return null;
      if (length < header.length) header.set(value.subarray(0, header.length - length), length);
      length += value.length;
      if (!size && length >= header.length) {
        size = stillWebPSize(header);
        if (!size || !size.width || !size.height || size.width * size.height > MAX_PIXELS) return null;
      }
      chunks.push(value);
    }
    return size ? { ...size, blob: new Blob(chunks, { type: 'image/webp' }) } : null;
  } finally { await reader.cancel(); }
}

self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') { if (current?.id === data.id) current.controller.abort(); return; }
  if (data.type !== 'prepare') return;
  const controller = new AbortController(); current = { id: data.id, controller };
  const timeout = setTimeout(() => controller.abort(), 5000);
  let bitmap, blob = null, width = 0, height = 0;
  try {
    const source = await readStillWebP(data.source, controller.signal);
    if (source && !controller.signal.aborted) {
      const ratio = Math.max(data.width / source.width, data.height / source.height);
      // At near-native sizes the source is already the appropriate paint asset.
      if (ratio < .75) {
        width = Math.ceil(source.width * ratio); height = Math.ceil(source.height * ratio);
        if (width * height <= 4_000_000) {
          bitmap = await createImageBitmap(source.blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
          if (!controller.signal.aborted) {
            const canvas = new OffscreenCanvas(width, height), context = canvas.getContext('2d');
            if (context) { context.drawImage(bitmap, 0, 0); blob = await canvas.convertToBlob({ type: 'image/png' }); }
            canvas.width = canvas.height = 0;
          }
        }
      }
    }
  } catch { /* Failed or unsupported preparation always leaves native media. */ }
  finally {
    bitmap?.close(); clearTimeout(timeout);
    if (controller.signal.aborted) blob = null;
    if (current?.id === data.id) current = null;
    self.postMessage({ id: data.id, blob, width, height });
  }
};
