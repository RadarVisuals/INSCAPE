// @ts-check
// An authored move uses one completed draft operation. Windows still own their
// frames, contents, fitting and geometry validation; only positions change here.
/** @typedef {import('../contracts/workbench.js').WorkbenchPresentation} WorkbenchPresentation */
/** @typedef {import('../contracts/workbench.js').Position} Position */
/** @typedef {import('../contracts/workbench.js').WindowId} WindowId */

/**
 * Resolve the actual frame, copying a live entry only when its first move
 * needs to materialize it. Other windows keep their saved layout.
 * @param {WorkbenchPresentation} layout
 * @param {WindowId} id
 * @param {WorkbenchPresentation} [live]
 * @returns {{position?: Position, window?: Position} | undefined}
 */
function frameEntry(layout, id, live) {
  if (id === 'display:primary') return layout.display;
  for (const key of /** @type {const} */ (['displays', 'texts', 'imageModules', 'shapes', 'keeperDocks', 'miniApps'])) {
    const entry = layout[key]?.find(item => item.id === id);
    if (entry) return entry;
    const missing = live?.[key]?.find(item => item.id === id);
    if (missing) {
      const copy = structuredClone(missing);
      Object.assign(layout, { [key]: [...(layout[key] || []), copy] });
      return copy;
    }
  }
  const savedFrame = layout.texts?.flatMap(text => text.frames || []).find(frame => frame.id === id);
  if (savedFrame || !live) return savedFrame;
  const parent = live.texts?.find(text => text.frames?.some(frame => frame.id === id));
  const frame = parent?.frames?.find(item => item.id === id);
  if (!frame || !parent) return;
  const savedParent = layout.texts?.find(text => text.id === parent.id);
  if (!savedParent) {
    const copy = structuredClone(parent);
    (layout.texts ??= []).push(copy);
    return copy.frames?.find(item => item.id === id);
  }
  const copy = structuredClone(frame);
  (savedParent.frames ??= []).push(copy);
  return copy;
}

/**
 * @param {import('../contracts/workbench.js').MountedWorkbenchStore} store
 * @param {string} profileAddress
 * @param {(Position & {id: import('../contracts/workbench.js').WindowId, from?: Position})[]} changes
 * @param {import('../contracts/workbench.js').WorkbenchPresentation | undefined} presentation
 * @param {number} expectedGeneration
 * @returns {void}
 */
export function moveWorkbenchSelection(store, profileAddress, changes, presentation, expectedGeneration = store.getGeneration()) {
  if (store.getProfileAddress() !== profileAddress || !store.hasWriteAccess()) throw new Error('This Workbench is no longer active.');
  if (store.getGeneration() !== expectedGeneration) throw new Error('The Workbench changed. Try the move again.');
  const draft = store.getDraft();
  const base = draft.workbench || presentation;
  if (!base) throw new Error('The Workbench layout is unavailable. Try again.');
  const workbench = structuredClone(base);
  const historyPresentation = structuredClone(base);
  let moved = false;
  for (const { id, left, top, from } of changes) {
    const item = frameEntry(workbench, id, presentation);
    if (!item) throw new Error('The selected artwork is no longer available.');
    const key = item.position ? 'position' : 'window';
    const start = from || (presentation && frameEntry(presentation, id)?.[key]) || item[key];
    if (!start) throw new Error('The artwork position is unavailable.');
    if (Math.abs(left - start.left) < 1e-7 && Math.abs(top - start.top) < 1e-7) continue;
    moved = true;
    const previous = frameEntry(historyPresentation, id, presentation);
    if (previous) previous[key] = { ...previous[key], left: start.left, top: start.top };
    item[key] = { ...item[key], left, top };
  }
  if (!moved) return;
  const historyLabel = changes.length === 1 && changes[0].id.startsWith('image:') ? 'Move Image' : 'Move Workbench group';
  if (!store.commitCompletedOperation({ ...draft, workbench }, { expectedGeneration, historyLabel, historyPresentation }))
    throw new Error('The selection could not be moved. Try again.');
}
