// The original article belongs to link.gridId. Additional articles are owned once,
// by their Grid entry. Missing passages inherit appearance, never another scene's prose.
import { sectionArticle } from './articleSections.js';
export function passageArticle(record, gridId, gridOrder = []) {
  if (record.sceneLink?.mode === 'sections') return sectionArticle(record.article, gridOrder.indexOf(gridId));
  if (!record.sceneLink || record.sceneLink.gridId === gridId) return record.article;
  return record.sceneLink.passages.find(p => p.gridId === gridId)?.article || {
    ...record.article, title: '', content: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
}
export function editPassage(record, gridId, article) {
  if (record.sceneLink?.mode === 'sections') return { ...record, article };
  if (!record.sceneLink || record.sceneLink.gridId === gridId) return { ...record, article };
  const passages = record.sceneLink.passages.filter(p => p.gridId !== gridId);
  return { ...record, sceneLink: { ...record.sceneLink, passages: [...passages, { gridId, article }] } };
}
export function textDisplays(draft) {
  return [{ id: 'display:primary', name: draft.workbench?.display?.name || 'Display Module', grids: draft.grids },
    ...(draft.displays || []).map(d => ({ ...d, name: draft.workbench?.displays?.find(p => p.id === d.id)?.name || 'Display Module' }))]
    .filter(d => d.grids?.length);
}
