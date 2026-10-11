// Profile-specific editorial heading requested for the desktop entrance.
// This is presentation copy; the published identity and other profiles retain their names.
export function publicOverviewHeading(address, profileName) {
  return address?.toLowerCase() === '0x001048331cd14cef40dd5da644a738e7324fe691' ? 'NOMAD' : profileName;
}

// A bounded index of the verified public document. No draft or inventory reads.
export function publicCanvasItems(document) {
  const displays = [{ id: 'display:primary', ...document }, ...(document.displays || [])];
  const compositions = displays.flatMap(display => display.grids.map(grid => ({
    key: `${display.id}/${grid.id}`, kind: 'composition', title: grid.title,
    description: grid.subtitle, target: { moduleId: display.id, gridId: grid.id },
    grid, display,
  })));
  const images = (document.imageModules || []).map(record => ({
    key: record.id, kind: 'image', title: record.name, description: record.sides[0]?.asset.description || '',
    target: { moduleId: record.id }, asset: record.sides[0]?.asset, record,
  }));
  const texts = (document.texts || []).map(record => ({
    key: record.id, kind: 'text', title: record.article.title || 'Untitled article',
    description: articleExcerpt(record.article.content), target: { moduleId: record.id }, record,
  }));
  // First composition leads; vary the remaining tiles without inventing curation.
  return [...compositions.slice(0, 1), ...images.slice(0, 1), ...texts.slice(0, 1),
    ...compositions.slice(1), ...images.slice(1), ...texts.slice(1)];
}

export function articleExcerpt(node, maximum = 240) {
  const parts = [];
  let length = 0;
  const visit = current => {
    if (!current || length >= maximum) return;
    if (typeof current.text === 'string') { parts.push(current.text); length += current.text.length; }
    else for (const child of current.content || []) visit(child);
    if (['paragraph', 'heading', 'listItem'].includes(current.type)) parts.push(' ');
  };
  visit(node);
  const value = parts.join('').replace(/\s+/gu, ' ').trim();
  return value.length > maximum ? `${value.slice(0, maximum).trimEnd()}…` : value;
}

export function resolvePublicCanvasTarget(document, target) {
  if (!target) return null;
  // Resolve against the publication, never against arbitrary module identifiers.
  return publicCanvasItems(document).find(item => item.target.moduleId === target.moduleId
    && (!target.gridId || item.target.gridId === target.gridId))?.target || null;
}

// Temporary reading order, derived exclusively from the verified publication.
// Source records are retained; neither a second document nor draft data is made.
export function publicReadingPages(document) {
  return publicCanvasItems(document).flatMap(item => {
    if (item.kind === 'composition') return [item];
    if (item.kind === 'image') return item.record.sides.map((side, index) => ({ ...item,
      key: item.key + '/' + side.id, side, description: side.asset.description || '',
      title: item.record.sides.length > 1 ? item.title + ' · ' + (index + 1) : item.title,
    }));
    const articles = [item.record.article, ...(item.record.sceneLink?.passages || []).map(p => p.article)];
    return articles.map((article, index) => ({ ...item, key: item.key + '/' + index, article,
      title: article.title || item.title, description: articleExcerpt(article.content),
    }));
  });
}
