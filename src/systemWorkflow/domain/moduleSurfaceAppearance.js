// Omission preserves the appearance of existing work.
export const defaultModuleEdges = (display = false) => ({ corners: display ? [10, 10, 10, 10] : [0, 0, 0, 0], shadow: display, grain: 0 });
export function validModuleEdges(value) {
  return value && typeof value === 'object' && Object.keys(value).length === 3
    && Array.isArray(value.corners) && value.corners.length === 4
    && value.corners.every(v => Number.isFinite(v) && v >= 0 && v <= 64)
    && typeof value.shadow === 'boolean' && Number.isFinite(value.grain) && value.grain >= 0 && value.grain <= 1;
}
export function moduleEdgeStyle(edges, scale = 1) {
  return edges ? { '--module-corners': edges.corners.map(v => `${v * scale}px`).join(' '),
    '--module-shadow': edges.shadow ? 'var(--workflow-window-chrome-shadow)' : 'none', '--module-grain': edges.grain * .3 } : {};
}
