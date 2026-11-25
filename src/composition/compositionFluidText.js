import { textAppearance } from '../text/domain/article.js';

// Read-only typography projection. Width is the actual layer width, not the
// browser viewport; source article records and inline formatting stay intact.
export function compositionFluidText(article, width, referenceWidth) {
  if (!(width > 0 && referenceWidth > width)) return article;
  const appearance = textAppearance(article);
  const zoom = appearance.scale || 1, base = appearance.fontSize || 16;
  let minimum = article.title ? appearance.titleFontSize ?? 28 : Infinity;
  const visit = (node, inherited = base) => {
    const level = node.type === 'heading' && node.attrs?.level;
    const size = level ? appearance.textStyles?.['h' + level]?.fontSize ?? base * [0, 1.65, 1.35, 1.15][level] : inherited;
    if (node.type === 'text' && node.text?.trim()) minimum = Math.min(minimum,
      node.marks?.find(mark => mark.type === 'textStyle' && mark.attrs?.fontSize)?.attrs.fontSize ?? size);
    if (node.type === 'artwork' && node.attrs?.caption) minimum = Math.min(minimum, appearance.textStyles?.caption?.fontSize ?? base * .85);
    node.content?.forEach(child => visit(child, size));
  };
  visit(article.content);
  const factor = Math.min(1, Math.max(width / referenceWidth, 16 / (minimum * zoom)));
  return factor === 1 ? article : { ...article, appearance: { ...appearance, scale: zoom * factor } };
}
