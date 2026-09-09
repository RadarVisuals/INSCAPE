// Derived, session-only alpha masks. URLs identify the decoded representation;
// replacement URLs get new masks. LRU + expiry bound memory and stale failures.
const masks = new Map();
const MAX_MASK_SIDE = 1024;
const MAX_MASKS = 24;
const MASK_TTL = 5 * 60_000;
export const ARTWORK_PLACEMENT_SELECTOR = '.system-workflow__placement, .lattice-production-placement';
const inside = (rect, x, y) => x >= rect.left && y >= rect.top && x < rect.right && y < rect.bottom;
const sourceOf = image => image.currentSrc || image.src;

function cached(source) {
  const entry = masks.get(source);
  if (!entry) return null;
  if (Date.now() - entry.created > MASK_TTL) { masks.delete(source); return null; }
  masks.delete(source); masks.set(source, entry);
  return entry;
}

function remember(source, entry) {
  masks.delete(source); masks.set(source, { ...entry, created: Date.now() });
  while (masks.size > MAX_MASKS) masks.delete(masks.keys().next().value);
}

export function readArtworkMask(image) {
  const ratio = Math.min(1, MAX_MASK_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.ceil(image.naturalWidth * ratio));
  const height = Math.max(1, Math.ceil(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    return { status: 'ready', width, height, alpha };
  } finally { canvas.width = 0; canvas.height = 0; }
}

// The existing renderers use center-origin quarter-turn/mirror image transforms,
// with axis-aligned Stage scaling. Invert those transforms before sampling.
export function artworkImagePoint(image, clientX, clientY) {
  const style = getComputedStyle(image);
  const matrix = new DOMMatrixReadOnly(style.transform);
  const width = parseFloat(style.width), height = parseFloat(style.height);
  if (!(width > 0 && height > 0)) return null;
  const bounds = image.getBoundingClientRect();
  const transformedWidth = Math.abs(matrix.a) * width + Math.abs(matrix.c) * height;
  const transformedHeight = Math.abs(matrix.b) * width + Math.abs(matrix.d) * height;
  if (!bounds.width || !bounds.height || !transformedWidth || !transformedHeight) return null;
  const x = (clientX - (bounds.left + bounds.width / 2)) * transformedWidth / bounds.width;
  const y = (clientY - (bounds.top + bounds.height / 2)) * transformedHeight / bounds.height;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!determinant) return null;
  const u = ((matrix.d * x - matrix.c * y) / determinant + width / 2) / width;
  const v = ((-matrix.b * x + matrix.a * y) / determinant + height / 2) / height;
  return u >= 0 && u < 1 && v >= 0 && v < 1 ? { u, v } : null;
}

function hitsArtwork(node, x, y) {
  // Authored backing and mats are visible surfaces too, including letterboxes.
  if ([...node.querySelectorAll('span')].some(span => {
    const color = getComputedStyle(span).backgroundColor;
    return color && color !== 'transparent' && !/[,/]\s*0(?:\.0+)?\s*\)$/.test(color)
      && inside(span.getBoundingClientRect(), x, y);
  })) return true;
  const images = [...node.querySelectorAll('img')].reverse();
  const image = images.find(candidate => candidate.complete && candidate.naturalWidth
    && Number(getComputedStyle(candidate).opacity) > .5);
  if (!image) return true; // Loading/unavailable is not proof of transparency.
  // Crop/opening clips are applied before sampling the transformed image.
  for (let parent = image.parentElement; parent && parent !== node; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (['hidden', 'clip'].includes(style.overflowX) && !inside(parent.getBoundingClientRect(), x, y)) return false;
  }
  const point = artworkImagePoint(image, x, y);
  if (!point) return false; // Letterbox area, outside the image itself.
  const mask = cached(sourceOf(image));
  if (mask?.status !== 'ready') return true;
  return mask.alpha[Math.min(mask.height - 1, Math.floor(point.v * mask.height)) * mask.width
    + Math.min(mask.width - 1, Math.floor(point.u * mask.width))] >= 8;
}

export function createArtworkPicker() {
  let disposed = false;
  let running = 0;
  let cycle = null;
  let press = null;
  const tasks = new Map();
  const queue = [];
  const pump = () => {
    while (!disposed && running < 2 && queue.length) {
      const task = queue.shift(); running++;
      task.timer = setTimeout(() => {
        if (disposed) return;
        let settled = false;
        const finish = result => {
          if (settled) return;
          settled = true;
          clearTimeout(task.timeout);
          if (task.copy) { task.copy.onload = null; task.copy.onerror = null; }
          if (!disposed) remember(task.source, result);
          tasks.delete(task.source); running--; pump();
        };
        if (!task.image.isConnected || sourceOf(task.image) !== task.source) {
          tasks.delete(task.source); running--; pump(); return;
        }
        try { finish(readArtworkMask(task.image)); }
        catch {
          // Keep display loading unchanged. A separate anonymous CORS read may
          // access pixels; a refusal leaves rectangular picking + Alt cycling.
          const copy = task.copy = new Image(); copy.crossOrigin = 'anonymous'; copy.referrerPolicy = 'no-referrer';
          copy.onload = () => {
            try { finish(readArtworkMask(copy)); } catch { finish({ status: 'unavailable' }); }
          };
          copy.onerror = () => finish({ status: 'unavailable' });
          task.timeout = setTimeout(() => { copy.src = ''; finish({ status: 'unavailable' }); }, 8000);
          copy.src = task.source;
        }
      }, 0);
    }
  };
  return {
    prepare(image) {
      if (disposed || image?.tagName !== 'IMG' || !image.naturalWidth || !image.closest(ARTWORK_PLACEMENT_SELECTOR)) return;
      const source = sourceOf(image);
      if (cached(source) || tasks.has(source) || tasks.size >= 64) return;
      const task = { source, image }; tasks.set(source, task); queue.push(task); pump();
    },
    pick(event, plane) {
      if (disposed || !plane) return null;
      if (event.type !== 'pointerdown' && event.detail === 0) return event.currentTarget; // Keyboard activation.
      const { clientX: x, clientY: y } = event;
      if (event.type !== 'pointerdown' && press?.plane === plane && Date.now() - press.time < 1000
        && Math.hypot(x - press.x, y - press.y) < 4 && (!press.node || press.node.isConnected)) return press.node;
      const candidates = [...plane.children].filter(node => node.matches(ARTWORK_PLACEMENT_SELECTOR))
        .map((node, index) => ({ node, index, style: getComputedStyle(node) }))
        .filter(({ node, style }) => style.visibility !== 'hidden' && style.display !== 'none'
          && style.pointerEvents !== 'none' && Number(style.opacity) > 0 && inside(node.getBoundingClientRect(), x, y))
        .sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0) || b.index - a.index)
        .map(item => item.node);
      // Evicted/expired masks are prepared asynchronously. A click never waits
      // for preparation; unknown pixels retain the rectangular fallback.
      candidates.forEach(candidate => candidate.querySelectorAll('img').forEach(image => this.prepare(image)));
      let node;
      if (event.altKey && candidates.length) {
        const same = cycle?.plane === plane && Math.hypot(x - cycle.x, y - cycle.y) < 5
          && candidates.length === cycle.nodes.length && candidates.every((item, i) => item === cycle.nodes[i]);
        const index = same ? (cycle.index + 1) % candidates.length : Math.min(1, candidates.length - 1);
        cycle = { plane, x, y, nodes: candidates, index }; node = candidates[index];
      } else { cycle = null; node = candidates.find(candidate => hitsArtwork(candidate, x, y)) || null; }
      if (event.type === 'pointerdown') press = { plane, x, y, node, time: Date.now() };
      return node;
    },
    dispose() {
      disposed = true; cycle = null; press = null;
      for (const task of tasks.values()) {
        clearTimeout(task.timer); clearTimeout(task.timeout);
        if (task.copy) { task.copy.onload = null; task.copy.onerror = null; task.copy.src = ''; }
      }
      tasks.clear(); queue.length = 0;
    },
  };
}
