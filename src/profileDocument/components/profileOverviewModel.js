import { createDefaultWorkbenchPresentation } from '../domain/workbenchPresentation.js';

// Project module instances, retaining their complete authored scene sequence.
// Shared publication facts stay public; no draft, camera or layout writes.
export function publicDisplayModules(document) {
  const { displays, miniApps, texts, imageModules, shapes, keeperDocks, workbenchGroups, reception, canvas, canvases, ...shared } = document;
  return [{ id: 'display:primary', geometry: document.geometry, appearance: document.appearance, grids: document.grids }, ...(displays || [])]
    .filter(module => module.grids.length > 0).map(module => {
      const presentation = module.id === 'display:primary' ? document.workbench?.display
        : document.workbench?.displays?.find(item => item.id === module.id);
      const { id: presentationId, ...display } = presentation || createDefaultWorkbenchPresentation().display;
      const { id, ...content } = module;
      return { id, key: id, kind: 'display', title: display.name || 'Display Module', target: { moduleId: id },
        document: { ...shared, ...content, workbench: { display } } };
    });
}

export function publicCanvasItems(document) {
  const displays = publicDisplayModules(document);
  const images = (document.imageModules || []).map(record => ({
    key: record.id, kind: 'image', title: record.name, description: record.sides[0]?.asset.description || '',
    target: { moduleId: record.id }, asset: record.sides[0]?.asset, record,
  }));
  const texts = (document.texts || []).map(record => ({
    key: record.id, kind: 'text', title: record.article.title || 'Untitled article',
    description: articleExcerpt(record.article.content), target: { moduleId: record.id }, record,
  }));
  return [...displays.slice(0, 1), ...texts.filter(item => item.record.sceneLink), ...images.slice(0, 1),
    ...texts.filter(item => !item.record.sceneLink).slice(0, 1), ...displays.slice(1), ...images.slice(1),
    ...texts.filter(item => !item.record.sceneLink).slice(1)];
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
  const item = publicCanvasItems(document).find(item => item.target.moduleId === target.moduleId);
  if (!item) return null;
  if (target.gridId) {
    if (item.kind !== 'display' || !item.document.grids.some(grid => grid.id === target.gridId)) return null;
    return { moduleId: target.moduleId, gridId: target.gridId };
  }
  return item.target;
}

// Temporary reading order, derived exclusively from the verified publication.
// Source records are retained; neither a second document nor draft data is made.
export function publicReadingPages(document, moduleId) {
  return publicCanvasItems(document).filter(item => item.kind !== 'display' && !item.record?.sceneLink
    && (!moduleId || item.target.moduleId === moduleId)).flatMap(item => {
    if (item.kind === 'image') return item.record.sides.map((side, index) => ({ ...item,
      key: item.key + '/' + side.id, side, description: side.asset.description || '',
      title: item.record.sides.length > 1 ? item.title + ' · ' + (index + 1) : item.title,
    }));
    const article = item.record.article;
    return [{ ...item, key: item.key + '/0', article,
      title: article.title || item.title, description: articleExcerpt(article.content) }];
  });
}
