import { MAX_IMAGE_MODULES, validImageModules, imageCropForResize, createImagePresentation } from './imageModule.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';

export function addImageModule(store, profile, placed = null) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  if ((draft.imageModules?.length || 0) >= MAX_IMAGE_MODULES) throw new Error('At most sixteen Image modules are supported.');
  const record = { id: `image:${crypto.randomUUID()}`, name: 'Image',
    width: placed?.size.width ?? 360, height: placed?.size.height ?? 360,
    sides: placed ? [placed.side] : [], visibility: placed ? 'PUBLIC' : 'PRIVATE' };
  const next = { ...draft, imageModules: [...(draft.imageModules || []), record] };
  if (placed) {
    const workbench = placed.workbench || draft.workbench || createDefaultWorkbenchPresentation();
    next.workbench = { ...workbench, imageModules: [...(workbench.imageModules || []),
      { id: record.id, open: true, position: placed.position }] };
  }
  if (!validImageModules(next.imageModules)) throw new Error('The Image could not be created from this artwork.');
  if (!store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: 'Add Image' })) {
    throw new Error('Image could not be saved. Try again when local storage is available.');
  }
  return record.id;
}
export function duplicateImageModule(store, profile, expected, { workbench, position } = {}) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  const index = draft.imageModules?.findIndex(item => item.id === expected?.id) ?? -1;
  if (index < 0 || JSON.stringify(draft.imageModules[index]) !== JSON.stringify(expected))
    throw new Error('This Image changed. Try duplicating it again.');
  if (draft.imageModules.length >= MAX_IMAGE_MODULES) throw new Error('At most sixteen Image modules are supported.');
  // Copy the authored sides directly: Library insertion and resize intentionally
  // choose new fitting defaults and must not run for an existing composition.
  const record = structuredClone(expected);
  record.id = `image:${crypto.randomUUID()}`;
  record.name = `${expected.name.slice(0, 43)} copy`;
  record.sides = record.sides.map(side => ({ ...side, id: `side:${crypto.randomUUID()}` }));
  const layout = workbench || draft.workbench || createDefaultWorkbenchPresentation();
  const origin = position || layout.imageModules?.find(item => item.id === expected.id)?.position
    || createImagePresentation(expected.id, index).position;
  const presentation = { id: record.id, open: true,
    position: clampWorkbenchPosition({ left: origin.left + 24, top: origin.top + 24 }, record) };
  const imageModules = [...draft.imageModules, record];
  if (!validImageModules(imageModules)) throw new Error('The Image could not be duplicated.');
  const next = { ...draft, imageModules,
    workbench: { ...layout, imageModules: [...(layout.imageModules || []), presentation] } };
  if (!store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: 'Duplicate Image' }))
    throw new Error('The Image copy could not be saved. Your saved work is unchanged; try again.');
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
  const imageModules = draft.imageModules.map(item => item.id === expected.id ? { ...item, width, height,
    sides: item.sides.map(side => ({ ...side, crop: imageCropForResize(side.crop, item, { width, height }) })) } : item);
  if (!validImageModules(imageModules)) throw new Error('Image dimensions are outside the supported range.');
  return { ...draft, imageModules };
}
