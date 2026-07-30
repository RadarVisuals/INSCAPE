export function preloadIdentityProfileImage(url, ImageConstructor = globalThis.Image, timeoutMs = 2500) {
  if (!url || typeof ImageConstructor !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new ImageConstructor();
    let settled = false;
    const timeout = globalThis.setTimeout(() => finish(null), timeoutMs);
    const finish = (value) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(value);
    };
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* Loaded pixels remain usable. */ }
      finish(url);
    };
    image.onerror = () => finish(null);
    image.src = url;
    if (image.complete && image.naturalWidth > 0) image.onload();
  });
}
