// Diagnostic geometry only. A media bounding rectangle cannot prove opacity:
// source alpha, SVG content, filtering and compositing remain unmeasured.
function clippedMedia(image) {
  const canvas = image.canvas?.rect;
  const media = (image.svgImage || image.svgDocument || image.image)?.rect;
  if (!canvas || !media) return null;
  const rect = { left: Math.max(canvas.left, media.left), top: Math.max(canvas.top, media.top),
    right: Math.min(canvas.right, media.right), bottom: Math.min(canvas.bottom, media.bottom) };
  return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
}

export function measureImageJoins(images, density = 1) {
  const joins = [];
  for (let i = 0; i < images.length; i++) for (let j = i + 1; j < images.length; j++) {
    const a = images[i], b = images[j];
    if (!a.canvas?.rect || !b.canvas?.rect) continue;
    for (const [axis, start, end, crossStart, crossEnd] of [
      ['horizontal', 'left', 'right', 'top', 'bottom'],
      ['vertical', 'top', 'bottom', 'left', 'right'],
    ]) {
      const [first, second] = a.canvas.rect[start] <= b.canvas.rect[start] ? [a, b] : [b, a];
      const left = first.canvas.rect, right = second.canvas.rect;
      const overlap = Math.min(left[crossEnd], right[crossEnd]) - Math.max(left[crossStart], right[crossStart]);
      const gap = right[start] - left[end];
      if (overlap <= 0 || Math.abs(gap * density) > 4) continue;
      const leftMedia = clippedMedia(first), rightMedia = clippedMedia(second);
      const mediaOverlap = leftMedia && rightMedia
        ? Math.min(leftMedia[crossEnd], rightMedia[crossEnd]) - Math.max(leftMedia[crossStart], rightMedia[crossStart]) : 0;
      joins.push({ firstId: first.moduleId, secondId: second.moduleId, axis,
        canvasGapPhysicalPx: gap * density,
        mediaRectangleGapPhysicalPx: mediaOverlap > 0 ? (rightMedia[start] - leftMedia[end]) * density : null });
    }
  }
  return joins;
}
