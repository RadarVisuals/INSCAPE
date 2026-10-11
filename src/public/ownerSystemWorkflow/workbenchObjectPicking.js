export function pointInWorkbenchFrame(point, frame) {
  return frame.width > 0 && frame.height > 0 && point.x >= frame.left && point.x <= frame.left + frame.width
    && point.y >= frame.top && point.y <= frame.top + frame.height;
}

// Compare stacking contexts, not unrelated z-index numbers from different parents.
function paintPath(node, host) {
  const path = [];
  for (let current = node; current && current !== host; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (current === node || style.zIndex !== 'auto' || style.transform !== 'none'
      || style.isolation === 'isolate' || Number(style.opacity) < 1) {
      path.unshift({ node: current, z: Number.parseInt(style.zIndex, 10) || 0 });
    }
  }
  return path;
}

export function compareWorkbenchPaint(a, b) {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i].node === b[i].node) continue;
    if (a[i].z !== b[i].z) return b[i].z - a[i].z;
    return a[i].node.compareDocumentPosition(b[i].node) & 4 ? 1 : -1;
  }
  return b.length - a.length;
}

export function workbenchObjectsAtPoint(view, host, point) {
  return [...view.entries].flatMap(([id, node]) => {
    if (!node.isConnected || !host.contains(node) || node.hasAttribute('data-workbench-group-hidden')
      || view.presentationTransforms?.[id] || node.closest('[hidden], [aria-hidden="true"], [data-immersive]')) return [];
    const frame = node.getBoundingClientRect(), style = getComputedStyle(node);
    if (!pointInWorkbenchFrame(point, frame) || style.visibility === 'hidden' || style.display === 'none') return [];
    return [{ id, node, path: paintPath(node, host), label: node.getAttribute('aria-label') || id }];
  }).sort((a, b) => compareWorkbenchPaint(a.path, b.path));
}

export function nextWorkbenchObject(hits, selection) {
  if (!hits.length) return null;
  const current = selection.length === 1 ? hits.findIndex(item => item.id === selection[0]) : -1;
  return hits[(Math.max(0, current) + 1) % hits.length].id;
}
