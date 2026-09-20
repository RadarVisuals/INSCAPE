import { createArticle, MAX_TEXT_MODULES, validTextModules } from './domain/article.js';
export function addTextModule(store, profile) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  if ((draft.texts?.length || 0) >= MAX_TEXT_MODULES) throw new Error(`At most ${MAX_TEXT_MODULES} Text modules are supported.`);
  const item = { id: `text:${crypto.randomUUID()}`, article: createArticle(), visibility: 'PRIVATE' };
  if (!store.commitCompletedOperation({ ...draft, texts: [...(draft.texts || []), item] }, { expectedGeneration: generation, historyLabel: 'Add Text' })) throw new Error('Text module could not be saved.');
  return item.id;
}
export function saveTextModule(store, profile, expected, next) {
  return saveTextModuleResult(store, profile, expected, next).saved;
}

const messages = {
  profile: 'This profile is no longer active. Your unsaved text is still here.',
  conflict: 'This Text was changed elsewhere. Your edits are still here. Retry checks the latest saved version.',
  missing: 'This Text was removed from the saved draft. Your unsaved text is still here.',
  changed: 'The saved draft changed elsewhere. Retry will preserve unrelated changes.',
  stale: 'The draft changed while saving. Retry checks the latest version.',
  invalid: 'The draft could not be validated. Your unsaved text is still here.',
  corrupt: 'The saved draft could not be read safely. It has not been overwritten.',
  read_failed: 'Browser storage could not be read. Your unsaved text is still here.',
  write_failed: 'Browser storage could not save your changes. It may be full or blocked. Your unsaved text is still here.',
};
export const textSaveFailure = code => ({ saved: false, reason: code, message: messages[code] || messages.write_failed });
export function saveTextModuleResult(store, profile, expected, next, { retry = false, replace = false } = {}) {
  let reason;
  const failed = textSaveFailure;
  if (store.getProfileAddress() !== profile) return failed('profile');
  const generation = store.getGeneration();
  const candidate = draft => {
    const current = draft.texts?.find(item => item.id === expected.id);
    if (!current) { reason = 'missing'; return null; }
    const value = { ...current };
    for (const key of ['article', 'visibility', 'sceneLink', 'pagination']) {
      if (JSON.stringify(expected[key]) === JSON.stringify(next[key])) continue;
      if (JSON.stringify(current[key]) !== JSON.stringify(expected[key]) && JSON.stringify(current[key]) !== JSON.stringify(next[key]) && !replace) {
        reason = 'conflict'; return null;
      }
      value[key] = next[key];
    }
    if (!retry && JSON.stringify(current) !== JSON.stringify(expected)) { reason = 'conflict'; return null; }
    const texts = draft.texts.map(item => item.id === current.id ? value : item);
    if (!validTextModules(texts)) { reason = 'invalid'; return null; }
    return { ...draft, texts };
  };
  try {
    const options = { expectedGeneration: generation, historyLabel: 'Edit Text' };
    const nextDraft = retry ? null : candidate(store.getDraft());
    const saved = retry ? store.retryCompletedOperation(candidate, options) : nextDraft && store.commitCompletedOperation(nextDraft, options);
    return saved ? { saved: true, record: store.getDraft().texts.find(item => item.id === expected.id) }
      : failed(reason || store.getLastCommitFailure?.() || 'write_failed');
  } catch (error) { return { saved: false, reason: 'invalid', message: error.message }; }
}
