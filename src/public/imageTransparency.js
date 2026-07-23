const transparencyCache = new Map();

async function inspectImageTransparency(url) {
  if (typeof fetch !== 'function' || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return false;
  const response = await fetch(url, { referrerPolicy: 'no-referrer' });
  if (!response.ok) return false;
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const maximum = 72;
    const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 250) return true;
    }
    return false;
  } finally {
    bitmap.close?.();
  }
}

export function detectImageTransparency(url) {
  if (typeof url !== 'string' || !url) return Promise.resolve(false);
  if (!transparencyCache.has(url)) {
    transparencyCache.set(url, inspectImageTransparency(url).catch(() => {
      transparencyCache.delete(url);
      return false;
    }));
  }
  return transparencyCache.get(url);
}

export function resetImageTransparencyCacheForTests() {
  transparencyCache.clear();
}
