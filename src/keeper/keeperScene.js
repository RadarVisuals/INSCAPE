import { keeperReaction } from './keeperReactions.js';
import { keeperMetadataReference } from './keeperMetadata.js';

// Modules explicitly expose title, source and token cues for their rendered art.
// Read only this Keeper's Workbench at Send time; never scrape text documents,
// account panels, private metadata or other browser tabs.
export function captureKeeperScene(host, origin, pointer, { gestures, shareArtwork, layered, reducedMotion }) {
  const win = host?.ownerDocument.defaultView;
  const visible = node => {
    if (!host?.contains(node) || !node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
    let rect = node.getBoundingClientRect();
    let box = { left: Math.max(0, rect.left), right: Math.min(win.innerWidth, rect.right), top: Math.max(0, rect.top), bottom: Math.min(win.innerHeight - 48, rect.bottom) };
    // Respect closed/cropped modules and off-screen Display scenes.
    for (let parent = node.parentElement; parent && parent !== host; parent = parent.parentElement) {
      const style = win.getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) { box.left = Math.max(box.left, bounds.left); box.right = Math.min(box.right, bounds.right); }
      if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) { box.top = Math.max(box.top, bounds.top); box.bottom = Math.min(box.bottom, bounds.bottom); }
    }
    return box.right - box.left > 8 && box.bottom - box.top > 8 ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } : null;
  };
  const candidates = shareArtwork && host ? [...host.querySelectorAll('[data-artwork-context-id][data-artwork-context-title]')].slice(0, 128)
    .flatMap(node => { const point = visible(node); return point ? [{ node, point, identity: node.dataset.artworkContextId, title: node.dataset.artworkContextTitle, src: node.dataset.artworkContextSrc,
      assetId: node.dataset.artworkContextAsset, standard: node.dataset.artworkContextStandard,
      metadata: keeperMetadataReference(node.dataset.artworkContextAsset, node.dataset.artworkContextStandard) }] : []; })
    .sort((a, b) => Math.hypot(a.point.x - origin.x, a.point.y - origin.y) - Math.hypot(b.point.x - origin.x, b.point.y - origin.y)).slice(0, 8) : [];
  const scene = { gestures, layered, reducedMotion, pointer: Boolean(pointer), artworks: candidates.map((item, i) => ({ id: `art-${i + 1}`, title: item.title.slice(0, 120),
    direction: `${item.point.x < origin.x ? 'left' : 'right'}, ${item.point.y < origin.y ? 'above' : 'below'}`,
    distance: Math.hypot(item.point.x - origin.x, item.point.y - origin.y) < 500 ? 'near' : 'far', ...(item.metadata && { metadata: item.metadata }) })) };
  const current = item => item.node.dataset.artworkContextId === item.identity && item.node.dataset.artworkContextTitle === item.title
    && item.node.dataset.artworkContextSrc === item.src && item.node.dataset.artworkContextAsset === item.assetId
    && item.node.dataset.artworkContextStandard === item.standard && visible(item.node);
  return { scene, async metadata(targets, signal) {
    if (!Array.isArray(targets) || targets.length < 1 || targets.length > 2 || new Set(targets).size !== targets.length) throw new Error('Invalid metadata request.');
    const { loadKeeperMetadata } = await import('./loadKeeperMetadata.js');
    const results = [];
    for (const target of targets) {
      signal?.throwIfAborted();
      const index = scene.artworks.findIndex(item => item.id === target), item = candidates[index];
      if (!item?.metadata) throw new Error('Metadata target is unavailable.');
      const changed = { ...item.metadata, status: 'changed' };
      const result = current(item) ? await loadKeeperMetadata(item.metadata, { signal }) : changed;
      signal?.throwIfAborted();
      results.push({ id: target, ...(current(item) ? result : changed) });
    }
    return results;
  }, async previews(signal) {
    const { KEEPER_VISION, keeperArtworkPreview } = await import('./keeperVision.js');
    const images = [], unavailable = [];
    for (const [index, item] of candidates.slice(0, KEEPER_VISION.count).entries()) {
      signal?.throwIfAborted();
      try {
        if (!item.src || !current(item)) throw new Error('Artwork changed.');
        const dataUrl = await keeperArtworkPreview(item.src, { signal, document: host.ownerDocument });
        if (!current(item)) throw new Error('Artwork changed.');
        images.push({ id: `art-${index + 1}`, dataUrl });
      } catch { signal?.throwIfAborted(); unavailable.push(item.title.slice(0, 120)); }
    }
    return { images, unavailable };
  }, resolve(action) {
    if (!keeperReaction(action, scene) || !host?.isConnected) return null;
    if (action.target === 'none') return { action, point: null };
    if (action.target === 'pointer') return { action, point: pointer };
    const candidate = candidates[Number(action.target.slice(4)) - 1];
    if (!candidate) return null;
    const point = current(candidate);
    return point ? { action, point } : null;
  } };
}
