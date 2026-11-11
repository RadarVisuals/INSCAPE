export function overviewCanvasNode(host, id) {
  const explorer = host?.querySelector(`.composition-explorer-viewport[data-canvas-id="${CSS.escape(id)}"]`);
  if (explorer) return explorer;
  const cards = [...(host?.querySelectorAll(`[data-card-id="${CSS.escape(id)}"]`) || [])];
  const viewport = host?.querySelector('.workbench-overview-gallery')?.getBoundingClientRect();
  return cards.find(card => { const box = card.getBoundingClientRect(); return box.bottom > viewport?.top && box.top < viewport?.bottom; })
    || cards.find(card => card.closest('[data-gallery-cycle="0"]'));
}

export function captureOverviewCanvas(node, model, name, id) {
  const canvas = node?.querySelector('.workbench-overview-canvas');
  if (!canvas || !node.isConnected) return null;
  const frame = node.getBoundingClientRect(), content = canvas.getBoundingClientRect();
  if (!frame.width || !content.width) return null;
  const style = getComputedStyle(node);
  return { id, name, model, frame: { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
    radius: parseFloat(style.borderRadius) || 0, background: style.backgroundColor,
    paint: { left: content.left - frame.left, top: content.top - frame.top, scale: content.width / model.area.width } };
}
