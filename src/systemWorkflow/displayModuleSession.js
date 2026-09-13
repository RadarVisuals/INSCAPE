import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { DISPLAY_CONTENT_KEYS, MAX_DISPLAY_MODULES, PRIMARY_DISPLAY_ID, displayFormat, projectDisplayDraft, mergeDisplayDraft } from './domain/displayModules.js';

export function createDisplayModuleSession(store, id) {
  if (id === PRIMARY_DISPLAY_ID) return createSystemWorkflowAuthoringSession({ store });
  return createSystemWorkflowAuthoringSession({ store: {
    getDraft: () => projectDisplayDraft(store.getDraft(), id),
    getGeneration: () => store.getGeneration(),
    commitCompletedOperation: (candidate, options) => store.commitCompletedOperation(
      mergeDisplayDraft(store.getDraft(), id, candidate), options),
  } });
}

export function addDisplayModule(store, orientation = 'LANDSCAPE') {
  const draft = store.getDraft();
  if ((draft.displays?.length || 0) >= MAX_DISPLAY_MODULES - 1) throw new TypeError('This workbench already has eight Display Modules');
  const id = `display:${globalThis.crypto.randomUUID()}`;
  const empty = { ...createEmptySystemWorkflowDraft(draft.profileAddress), appearance: structuredClone(draft.appearance), ...displayFormat(orientation) };
  const module = { id, visibility: 'PRIVATE', ...Object.fromEntries(DISPLAY_CONTENT_KEYS.map(key => [key, empty[key]])) };
  const candidate = assertValidSystemWorkflowDraft({ ...draft, displays: [...(draft.displays || []), module] });
  if (!store.commitCompletedOperation(candidate, { expectedGeneration: store.getGeneration() })) throw new Error('The new Display could not be saved');
  return id;
}

export function setDisplayModuleFormat(store, id, orientation) {
  const draft = store.getDraft();
  const scoped = projectDisplayDraft(draft, id);
  const format = displayFormat(orientation);
  if (scoped.artboard.aspectWidth === format.artboard.aspectWidth) return true;
  return store.commitCompletedOperation(assertValidSystemWorkflowDraft(mergeDisplayDraft(draft, id, { ...scoped, ...format })),
    { expectedGeneration: store.getGeneration() });
}
