import { assertValidSystemWorkflowDraft, SYSTEM_WORKFLOW_DRAFT_VERSION, SYSTEM_WORKFLOW_LIMITS } from './systemWorkflowDraft.js';

export const WORKBENCH_COLLECTION_TYPE = 'inscape-local-workbenches';
export const FIRST_WORKBENCH_ID = 'workbench:main';
export const MAX_WORKBENCHES = 8;
export const WORKBENCH_COLLECTION_LIMIT = MAX_WORKBENCHES * SYSTEM_WORKFLOW_LIMITS.maxJsonBytes;
export const validWorkbenchName = name => typeof name === 'string' && name === name.trim()
  && name.length > 0 && name.length <= 64 && !/[\u0000-\u001f\u007f]/u.test(name);
const validId = id => typeof id === 'string' && /^workbench:[A-Za-z0-9_-]{1,80}$/u.test(id);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
export const isWorkbenchCollection = value => value?.type === WORKBENCH_COLLECTION_TYPE;

// This is the persisted ownership boundary. Modules still receive their existing
// validated operation input, derived from one composition and shared profile data.
// No mutable module content is copied into the overview or another composition.
function splitDraft(draft) {
  const { profileAddress, draftVersion, identityPresentation, keeperDocks, reception, appearance, ...content } = draft;
  const { menuSurfaceId, ...canvasAppearance } = appearance;
  return {
    shared: { identityPresentation, menuSurfaceId,
      ...(keeperDocks === undefined ? {} : { keeperDocks }), ...(reception === undefined ? {} : { reception }) },
    content: { ...content, appearance: canvasAppearance },
  };
}

export function projectWorkbenchDraft(collection, id = collection.activeId) {
  const item = collection.workbenches.find(item => item.id === id);
  if (!item) throw new Error('This Workbench is unavailable.');
  const { menuSurfaceId, ...shared } = collection.shared;
  return { profileAddress: collection.profileAddress, draftVersion: SYSTEM_WORKFLOW_DRAFT_VERSION,
    ...item.content, ...shared, appearance: { ...item.content.appearance, menuSurfaceId } };
}

export function createWorkbenchCollection(draft) {
  const value = assertValidSystemWorkflowDraft(draft), { shared, content } = splitDraft(value);
  return { type: WORKBENCH_COLLECTION_TYPE, version: 1, profileAddress: value.profileAddress,
    activeId: FIRST_WORKBENCH_ID, shared, workbenches: [{ id: FIRST_WORKBENCH_ID, name: 'Workbench 1', content }] };
}

export function replaceWorkbenchDraft(collection, id, draft) {
  if (draft.profileAddress !== collection.profileAddress || !collection.workbenches.some(item => item.id === id))
    throw new Error('This Workbench no longer belongs to the active profile.');
  const { shared, content } = splitDraft(draft);
  return { ...collection, shared, workbenches: collection.workbenches.map(item => item.id === id ? { ...item, content } : item) };
}

export function appendWorkbench(collection, id, name, draft) {
  if (!validId(id) || !validWorkbenchName(name) || collection.workbenches.length >= MAX_WORKBENCHES
    || collection.workbenches.some(item => item.id === id)) throw new Error('The Workbench could not be created.');
  const { content } = splitDraft(draft);
  return { ...collection, activeId: id, workbenches: [...collection.workbenches, { id, name, content }] };
}

export function assertValidWorkbenchCollection(input) {
  if (!exact(input, ['type', 'version', 'profileAddress', 'activeId', 'shared', 'workbenches'])
    || !isWorkbenchCollection(input) || input.version !== 1
    || !object(input.shared) || !exact(input.shared, ['identityPresentation', 'menuSurfaceId',
      ...['keeperDocks', 'reception'].filter(key => Object.hasOwn(input.shared, key))])
    || !Array.isArray(input.workbenches) || !input.workbenches.length || input.workbenches.length > MAX_WORKBENCHES)
    throw new Error('Invalid local Workbench collection.');
  const ids = new Set();
  for (const item of input.workbenches) {
    if (!exact(item, ['id', 'name', 'content']) || !validId(item.id) || ids.has(item.id)
      || !validWorkbenchName(item.name) || !object(item.content)
      || ['profileAddress', 'draftVersion', 'identityPresentation', 'keeperDocks', 'reception'].some(key => Object.hasOwn(item.content, key))
      || Object.hasOwn(item.content.appearance || {}, 'menuSurfaceId'))
      throw new Error('Invalid or duplicate Workbench.');
    ids.add(item.id);
    assertValidSystemWorkflowDraft(projectWorkbenchDraft(input, item.id));
  }
  if (!ids.has(input.activeId)) throw new Error('The active Workbench is unavailable.');
  if (new TextEncoder().encode(JSON.stringify(input)).length > WORKBENCH_COLLECTION_LIMIT)
    throw new Error('The local Workbenches exceed the storage limit.');
  return structuredClone(input);
}
