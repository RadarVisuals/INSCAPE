// @ts-check
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
/** @typedef {import('../contracts/workbench.js').TextPresentation} TextPresentation */

// Modules prepare their own content; the shared draft store commits a selection
// once, so a mixed Image/Text operation cannot save only part of the group.
/**
 * @param {import('../contracts/workbench.js').SelectionResizeChange[]} changes
 * @returns {boolean}
 */
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
    /** @type {import('../contracts/workbench.js').WorkbenchPresentation} */
    let workbench = first.getPresentation?.() || draft.workbench || createDefaultWorkbenchPresentation();
    for (const change of changes) {
      const id = change.id, key = change.layoutKey;
      const window = { left: change.left, top: change.top, width: change.width, height: change.height };
      if (change.parentTextId) {
        const text = workbench.texts?.find(item => item.id === change.parentTextId);
        if (!text?.frames?.some(frame => frame.id === id)) throw new Error('The linked Text frame was removed.');
        // The membership check above proves both arrays for this matching Text.
        workbench = { ...workbench, texts: /** @type {TextPresentation[]} */ (workbench.texts).map(item => item !== text ? item : {
          ...item, frames: /** @type {NonNullable<TextPresentation['frames']>} */ (item.frames).map(frame => frame.id === id ? { ...frame, window } : frame),
        }) };
      } else if (key === 'display') workbench = { ...workbench, display: { ...workbench.display, window } };
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
    changes.forEach(change => change.reportError?.(/** @type {Error} */ (error).message));
    return false;
  }
}

/** @param {import('../contracts/workbench.js').WorkflowDraft} draft */
export function prepareWindowResize(draft) { return draft; }
