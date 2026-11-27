// A route snapshot can be released when the first visible artwork has real pixels
// or its error UI. Off-screen artwork and later edits keep their own lifecycle.
export function intersectsViewport(node, clip) {
  const box = node.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.right > Math.max(0, clip.left)
    && box.left < Math.min(innerWidth, clip.right) && box.bottom > Math.max(0, clip.top)
    && box.top < Math.min(innerHeight, clip.bottom);
}

export function observeInitialArtwork(root, onReady) {
  const check = () => {
    if (root.querySelector('[data-artwork-module-pending]')) return;
    const clip = root.getBoundingClientRect();
    for (const node of root.querySelectorAll('[data-preview-paint="pending"], .image-module__artwork[data-media-state="loading"], [data-svg-artwork-host]')) {
      if (node.closest('[data-editor-hidden], [data-workbench-canvas-hidden]') || !intersectsViewport(node, clip)) continue;
      if (node.hasAttribute('data-svg-artwork-host') && node.querySelector('[data-svg-paint="ready"], [data-svg-paint="failed"]')) continue;
      return;
    }
    observer.disconnect();
    onReady();
  };
  const observer = new MutationObserver(check);
  observer.observe(root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-media-state', 'data-svg-paint', 'data-preview-paint', 'data-editor-hidden', 'data-workbench-canvas-hidden'] });
  check();
  return () => observer.disconnect();
}

export function markPreviewPainted(event) {
  event.currentTarget.dataset.previewPaint = 'ready';
}
