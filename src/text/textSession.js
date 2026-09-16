import { createArticle, MAX_TEXT_MODULES, validTextModules } from './domain/article.js';
export function addTextModule(store, profile) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  if ((draft.texts?.length || 0) >= MAX_TEXT_MODULES) throw new Error('At most four Text modules are supported.');
  const item = { id: `text:${crypto.randomUUID()}`, article: createArticle(), visibility: 'PRIVATE' };
  if (!store.commitCompletedOperation({ ...draft, texts: [...(draft.texts || []), item] }, { expectedGeneration: generation, historyLabel: 'Add Text' })) throw new Error('Text module could not be saved.');
  return item.id;
}
export function saveTextModule(store, profile, expected, next) {
  if (store.getProfileAddress() !== profile) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  if (JSON.stringify(draft.texts?.find(i => i.id === expected.id)) !== JSON.stringify(expected)) return false;
  const texts = draft.texts.map(i => i.id === expected.id ? { ...next, id: i.id } : i);
  return validTextModules(texts) && store.commitCompletedOperation({ ...draft, texts }, { expectedGeneration: generation, historyLabel: 'Edit Text' });
}
