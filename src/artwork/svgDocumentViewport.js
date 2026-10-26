// Percentage-sized SVG exports have no intrinsic pixels. HTMLImageElement's
// default 300x150 box is useful for an image preview, not as the native layout
// of an isolated document that will be enlarged. Use the authored viewBox for
// those documents, bounded to the existing artwork pixel budget. Fixed-size
// documents retain their native layout (scripts may depend on that viewport).
export function svgDocumentViewport(svg) {
  if (['width', 'height'].some(name => {
    const value = svg.getAttribute(name)?.trim();
    return value && !value.endsWith('%');
  })) return null;
  const box = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (box?.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) return null;
  const scale = Math.min(1, 4096 / Math.max(box[2], box[3]));
  return { width: Math.max(1, Math.round(box[2] * scale)), height: Math.max(1, Math.round(box[3] * scale)) };
}
