import { MIN_CROP_PROJECTION_ZOOM } from '../lattice/rendering/latticeCrop.js';
import { workbenchArea, workbenchAreaBounds } from '../systemWorkflow/domain/workbenchArea.js';
import { MAX_IMAGE_MODULES, validImageModules, createImagePresentation, IMAGE_SIZE_LIMITS } from './imageModule.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';
import { MAX_WORKBENCH_GROUP_MEMBERS } from '../systemWorkflow/domain/workbenchGroups.js';

// A new Image joins its target cell in the same commit. Existing Images keep
// their own membership even when the user is editing a different cell.
function validEditingImages(store, images, addedId, targetCell = store?.getEditingCell?.()) {
  const cells = store?.getCells?.();
  return validImageModules(images, false, {
    minimumCropZoom: cells ? MIN_CROP_PROJECTION_ZOOM : 1,
    isCellMember: id => cells?.some(cell => id === addedId ? cell.id === targetCell : cell.members.includes(id)),
  });
}

export function addImageModule(store, profile, placed = null) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  if ((draft.imageModules?.length || 0) >= MAX_IMAGE_MODULES) throw new Error('At most sixteen Image modules are supported.');
  const record = { id: `image:${crypto.randomUUID()}`, name: 'Image',
    width: placed?.size.width ?? 360, height: placed?.size.height ?? 360,
    artwork: placed?.artwork ?? null, visibility: placed ? 'PUBLIC' : 'PRIVATE' };
  const next = { ...draft, imageModules: [...(draft.imageModules || []), record] };
  if (placed) {
    const workbench = placed.workbench || draft.workbench || createDefaultWorkbenchPresentation();
    next.workbench = { ...workbench, imageModules: [...(workbench.imageModules || []),
      { id: record.id, open: true, position: placed.position }] };
  }
  if (!validEditingImages(store, next.imageModules, record.id, placed?.cellId)) throw new Error('The Image could not be created from this artwork.');
  if (placed?.groupId) {
    const group = draft.workbenchGroups?.find(item => item.id === placed.groupId);
    if (!group?.position || placed.cellId || store.getCells) throw new Error('This stack is no longer available.');
    if (group.memberIds.length >= MAX_WORKBENCH_GROUP_MEMBERS) throw new Error('This group is full.');
    next.workbenchGroups = draft.workbenchGroups.map(item => item === group
      ? { ...item, memberIds: [...item.memberIds, record.id] } : item);
  }
  const options = { expectedGeneration: generation, historyLabel: placed?.groupId ? 'Add Image to group' : 'Add Image' };
  const saved = placed?.cellId ? store.commitInCell?.(placed.cellId, next, options) : store.commitCompletedOperation(next, options);
  if (!saved) {
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
  // Copy the authored artwork directly: Library insertion and resize intentionally
  // choose new fitting defaults and must not run for an existing composition.
  const record = structuredClone(expected);
  if (!store.getEditingCell?.()) record.height = Math.max(record.height, IMAGE_SIZE_LIMITS.minimumHeight);
  record.id = `image:${crypto.randomUUID()}`;
  record.name = `${expected.name.slice(0, 43)} copy`;
  if (record.artwork) record.artwork.id = `artwork:${crypto.randomUUID()}`;
  const layout = workbench || draft.workbench || createDefaultWorkbenchPresentation();
  const origin = position || layout.imageModules?.find(item => item.id === expected.id)?.position
    || createImagePresentation(expected.id, index).position;
  const presentation = { id: record.id, open: true,
    position: clampWorkbenchPosition({ left: origin.left + 24, top: origin.top + 24 }, record, workbenchAreaBounds(workbenchArea(layout))) };
  const imageModules = [...draft.imageModules, record];
  if (!validEditingImages(store, imageModules, record.id)) throw new Error('The Image could not be duplicated.');
  const next = { ...draft, imageModules,
    workbench: { ...layout, imageModules: [...(layout.imageModules || []), presentation] } };
  if (!store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: 'Duplicate Image' }))
    throw new Error('The Image copy could not be saved. Your saved work is unchanged; try again.');
  return record.id;
}
export function saveImageModule(store, profile, expected, next, workbench) {
  if (store.getProfileAddress() !== profile || !expected || !next) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  const current = draft.imageModules?.find(item => item.id === expected.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const imageModules = draft.imageModules.map(item => item.id === expected.id ? { ...next, id: expected.id } : item);
  if (!validEditingImages(store, imageModules)) return false;
  return store.commitCompletedOperation({ ...draft, imageModules, ...(workbench ? { workbench } : {}) }, { expectedGeneration: generation, historyLabel: 'Edit Image' });
}

export function prepareImageResize(draft, { expected, width, height, store }) {
  if (JSON.stringify(draft.imageModules?.find(item => item.id === expected.id)) !== JSON.stringify(expected))
    throw new Error('An Image changed during resizing. Try the selection again.');
  const imageModules = draft.imageModules.map(item => item.id === expected.id ? { ...item, width, height } : item);
  if (!validEditingImages(store, imageModules)) throw new Error('Image dimensions are outside the supported range.');
  return { ...draft, imageModules };
}
