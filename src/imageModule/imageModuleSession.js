import { MAX_IMAGE_MODULES, validImageModules } from './imageModule.js';

export function addImageModule(store, profile) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  if ((draft.imageModules?.length || 0) >= MAX_IMAGE_MODULES) throw new Error('At most sixteen Image modules are supported.');
  const record = { id: `image:${crypto.randomUUID()}`, name: 'Image', width: 360, height: 360, sides: [], visibility: 'PRIVATE' };
  if (!store.commitCompletedOperation({ ...draft, imageModules: [...(draft.imageModules || []), record] }, { expectedGeneration: generation, historyLabel: 'Add Image' })) {
    throw new Error('Image could not be saved. Try again when local storage is available.');
  }
  return record.id;
}
export function saveImageModule(store, profile, expected, next) {
  if (store.getProfileAddress() !== profile || !expected || !next) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  const current = draft.imageModules?.find(item => item.id === expected.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const imageModules = draft.imageModules.map(item => item.id === expected.id ? { ...next, id: expected.id } : item);
  if (!validImageModules(imageModules)) return false;
  return store.commitCompletedOperation({ ...draft, imageModules }, { expectedGeneration: generation, historyLabel: 'Edit Image' });
}

export function prepareImageResize(draft, { expected, width, height }) {
  if (JSON.stringify(draft.imageModules?.find(item => item.id === expected.id)) !== JSON.stringify(expected))
    throw new Error('An Image changed during resizing. Try the selection again.');
  const imageModules = draft.imageModules.map(item => item.id === expected.id ? { ...item, width, height } : item);
  if (!validImageModules(imageModules)) throw new Error('Image dimensions are outside the supported range.');
  return { ...draft, imageModules };
}
