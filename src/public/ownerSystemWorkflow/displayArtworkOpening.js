// Express an axis-aligned opening in the untransformed image's coordinates.
// Insets may be negative: native-fit letterboxes remain transparent rather
// than stretching the image. Quarter-turns and screen-axis mirrors share this
// same inverse mapping, including throughout an inspection transition.
export function projectDisplayArtworkOpening(rect, width, height, matrix) {
  const { a, b, c, d } = matrix;
  const determinant = a * d - b * c;
  const dx = width / 2 - rect.left - rect.width / 2;
  const dy = height / 2 - rect.top - rect.height / 2;
  const openingWidth = (Math.abs(d) * width + Math.abs(c) * height) / Math.abs(determinant);
  const openingHeight = (Math.abs(b) * width + Math.abs(a) * height) / Math.abs(determinant);
  const centerX = rect.width / 2 + (d * dx - c * dy) / determinant;
  const centerY = rect.height / 2 + (-b * dx + a * dy) / determinant;
  return {
    left: (width - openingWidth) / 2, top: (height - openingHeight) / 2,
    width: openingWidth, height: openingHeight,
    insets: [(centerY - openingHeight / 2) / rect.height,
      1 - (centerX + openingWidth / 2) / rect.width,
      1 - (centerY + openingHeight / 2) / rect.height,
      (centerX - openingWidth / 2) / rect.width],
  };
}

export function artworkSourcePoint(point, objectViewBox) {
  const match = objectViewBox?.match(/^inset\(([^)]+)\)$/);
  if (!match) return point;
  const values = match[1].trim().split(/\s+/);
  if (!values.length || values.length > 4 || values.some(value => !/^[-.\de+]+%$/i.test(value))) return point;
  const [top, right = top, bottom = top, left = right] = values.map(value => parseFloat(value) / 100);
  return { u: left + point.u * (1 - left - right), v: top + point.v * (1 - top - bottom) };
}
