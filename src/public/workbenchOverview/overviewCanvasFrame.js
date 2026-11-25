export function overviewCanvasNode(host, id, preferredCycle) {
  const explorer = host?.querySelector(`.composition-explorer-viewport[data-canvas-id="${CSS.escape(id)}"]`);
  if (explorer) return explorer;
  const cards = [...(host?.querySelectorAll(`[data-card-id="${CSS.escape(id)}"]`) || [])];
  const viewport = host?.querySelector('.workbench-overview-gallery')?.getBoundingClientRect();
  // A repeated tile can be a sliver at either edge. With no explicit origin,
  // prefer a fully visible copy near the centre of the gallery.
  let best = null, coverage = 0, distance = Infinity;
  if (viewport) for (const card of cards) {
    const box = card.getBoundingClientRect();
    const width = Math.min(box.right, viewport.right) - Math.max(box.left, viewport.left);
    const height = Math.min(box.bottom, viewport.bottom) - Math.max(box.top, viewport.top);
    if (width <= 0 || height <= 0) continue;
    if (card.closest('[data-gallery-cycle]')?.dataset.galleryCycle === preferredCycle) return card;
    const fraction = Math.round(1000 * width * height / (box.width * box.height));
    const centre = Math.hypot(box.left + box.right - viewport.left - viewport.right, box.top + box.bottom - viewport.top - viewport.bottom);
    if (fraction > coverage || (fraction === coverage && centre < distance)) {
      best = card;
      coverage = fraction;
      distance = centre;
    }
  }
  return best || cards.find(card => card.closest('[data-gallery-cycle="0"]'));
}

export function captureOverviewCanvas(node, model, name, id) {
  const canvas = node?.querySelector('.workbench-overview-canvas');
  if (!canvas || !node.isConnected) return null;
  const frame = node.getBoundingClientRect(), content = canvas.getBoundingClientRect();
  if (!frame.width || !content.width) return null;
  const style = getComputedStyle(node);
  return { id, name, model, frame: { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
    radius: parseFloat(style.borderRadius) || 0, background: style.backgroundColor,
    paint: { left: content.left - frame.left, top: content.top - frame.top, scale: content.width / (Number(canvas.dataset.worldWidth) || model.area.width) } };
}
