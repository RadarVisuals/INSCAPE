import { createMirrorRecord, MAX_MIRROR_MODULES } from './domain/mirrorModules.js';

export function addMirrorModule(store) {
  const draft = store.getDraft();
  if ((draft.animations?.length || 0) >= MAX_MIRROR_MODULES) throw new Error('At most four Mirror modules are supported.');
  const record = createMirrorRecord(draft.animations?.length || 0);
  if (!store.commitCompletedOperation({ ...draft, animations: [...(draft.animations || []), record] }, { expectedGeneration: store.getGeneration() })) {
    throw new Error('Mirror module could not be saved. Your existing draft is unchanged.');
  }
  return record.id;
}
export function updateMirrorModule(store, profile, id, change) {
  if (store.getProfileAddress() !== profile) return false;
  const draft = store.getDraft();
  if (!draft.animations?.some(item => item.id === id)) return false;
  return store.commitCompletedOperation({ ...draft, animations: draft.animations.map(item => item.id === id ? { ...item, ...change } : item) },
    { expectedGeneration: store.getGeneration() });
}
