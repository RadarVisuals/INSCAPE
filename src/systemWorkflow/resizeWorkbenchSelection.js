import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';

// Modules prepare their own content; the shared draft store commits a selection
// once, so a mixed Image/Text operation cannot save only part of the group.
export function commitWorkbenchSelectionResize(changes) {
  const first = changes[0];
  if (!first) return false;
  try {
    const { store, profileAddress } = first;
    if (!store || store.getProfileAddress() !== profileAddress || changes.some(change =>
      change.store !== store || change.profileAddress !== profileAddress)) throw new Error('This Workbench is no longer active.');
    const generation = store.getGeneration();
    let draft = store.getDraft();
    for (const change of changes) draft = change.prepare(draft, change);
    let workbench = first.getPresentation?.() || draft.workbench || createDefaultWorkbenchPresentation();
    for (const change of changes) {
      const id = change.id, key = change.layoutKey;
      const window = { left: change.left, top: change.top, width: change.width, height: change.height };
      if (key === 'display') workbench = { ...workbench, display: { ...workbench.display, window } };
      else {
        const items = workbench[key] || [];
        const previous = items.find(item => item.id === id) || { id, open: true };
        const next = key === 'imageModules' ? { ...previous, position: { left: change.left, top: change.top } } : { ...previous, window };
        workbench = { ...workbench, [key]: [...items.filter(item => item.id !== id), next] };
      }
    }
    draft = { ...draft, workbench };
    if (!store.commitCompletedOperation(draft, { expectedGeneration: generation, historyLabel: 'Resize Workbench selection' }))
      throw new Error('The selection could not be saved. Your saved work is unchanged; try again.');
    changes.forEach(change => change.reportError?.(''));
    return true;
  } catch (error) {
    changes.forEach(change => change.reportError?.(error.message));
    return false;
  }
}

export function prepareWindowResize(draft) { return draft; }
