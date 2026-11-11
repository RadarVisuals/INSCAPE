// Shared by the inspector and browser capture command. No app stores or React internals.
export function describeElement(node) {
  const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
  return {
    source: node.getAttribute('data-inscape-source'),
    owner: node.getAttribute('data-inscape-owner'),
    kind: node.localName,
    classes: node.getAttribute('class') || '',
    label: node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 240) || '',
    bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    styles: Object.fromEntries(['display', 'gap', 'padding', 'color', 'backgroundColor', 'fontFamily', 'fontSize', 'borderRadius'].map(name => [name, style[name]])),
  };
}
