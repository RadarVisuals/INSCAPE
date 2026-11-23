import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { DISPLAY_CONTENT_KEYS, MAX_DISPLAY_MODULES, PRIMARY_DISPLAY_ID, displayFormat, projectDisplayDraft, mergeDisplayDraft } from './domain/displayModules.js';
import { createDefaultWorkbenchPresentation, createNewDisplayPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createSystemWorkflowAppearanceCandidate } from './systemWorkflowAppearance.js';

export function createDisplayModuleSession(store, id, navigation) {
  let sourceSnapshot, displaySnapshot;
  return createSystemWorkflowAuthoringSession({ navigation, store: {
    getDraft: () => projectDisplayDraft(store.getDraft(), id),
    // Derived view only. Re-read every accepted root to detect removal/reload,
    // but unrelated module edits must not replace this Display's snapshot.
    getSnapshot: store.getSnapshot ? () => {
      const source = store.getSnapshot();
      if (source !== sourceSnapshot) {
        const projected = projectDisplayDraft(source, id);
        if (!displaySnapshot || Object.keys(projected).some(key => projected[key] !== displaySnapshot[key])) {
          displaySnapshot = Object.freeze(projected);
        }
        sourceSnapshot = source;
      }
      return displaySnapshot;
    } : undefined,
    getGeneration: () => store.getGeneration(),
    commitCompletedOperation: (candidate, options) => store.commitCompletedOperation(
      mergeDisplayDraft(store.getDraft(), id, candidate), options),
  } });
}

export function addDisplayModule(store, orientation = 'LANDSCAPE', appearance = {}) {
  const draft = store.getDraft();
  const format = displayFormat(orientation);
  const nextAppearance = (createSystemWorkflowAppearanceCandidate(draft, { expectedAppearance: draft.appearance, appearance }) || draft).appearance;
  if (!draft.grids.length) {
    const empty = createEmptySystemWorkflowDraft(draft.profileAddress);
    const candidate = { ...draft, appearance: nextAppearance, grids: empty.grids, ...format,
      workbench: { ...(draft.workbench || createDefaultWorkbenchPresentation()), display: createNewDisplayPresentation(format.geometry) } };
    if (!store.commitCompletedOperation(candidate, { expectedGeneration: store.getGeneration() })) throw new Error('The new Display could not be saved');
    return PRIMARY_DISPLAY_ID;
  }
  if ((draft.displays?.length || 0) >= MAX_DISPLAY_MODULES - 1) throw new TypeError('This workbench already has eight Display Modules');
  const id = `display:${globalThis.crypto.randomUUID()}`;
  const empty = { ...createEmptySystemWorkflowDraft(draft.profileAddress), appearance: structuredClone(nextAppearance), ...format };
  const module = { id, visibility: 'PRIVATE', ...Object.fromEntries(DISPLAY_CONTENT_KEYS.map(key => [key, empty[key]])) };
  const candidate = assertValidSystemWorkflowDraft({ ...draft, displays: [...(draft.displays || []), module] });
  if (!store.commitCompletedOperation(candidate, { expectedGeneration: store.getGeneration() })) throw new Error('The new Display could not be saved');
  return id;
}
