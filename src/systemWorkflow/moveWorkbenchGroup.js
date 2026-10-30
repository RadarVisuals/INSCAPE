// @ts-check
// Group movement uses one completed draft operation. Windows still own their
// frames, contents, fitting and geometry validation; only positions change here.
/** @typedef {import('../contracts/workbench.js').WorkbenchPresentation} WorkbenchPresentation */
/** @typedef {import('../contracts/workbench.js').Position} Position */
/**
 * @param {import('../contracts/workbench.js').MountedWorkbenchStore} store
 * @param {string} profileAddress
 * @param {(import('../contracts/workbench.js').Position & {id: import('../contracts/workbench.js').WindowId})[]} changes
 * @param {import('../contracts/workbench.js').WorkbenchPresentation | undefined} presentation
 * @param {number} expectedGeneration
 * @returns {void}
 */
export function moveWorkbenchGroup(store, profileAddress, changes, presentation, expectedGeneration = store.getGeneration()) {
  if (store.getProfileAddress() !== profileAddress) throw new Error('This Workbench is no longer active.');
  if (store.getGeneration() !== expectedGeneration) throw new Error('The Workbench changed. Select the group again.');
  const draft = store.getDraft();
  let workbench = structuredClone(presentation || draft.workbench);
  const historyPresentation = structuredClone(draft.workbench || presentation);
  if (!workbench) throw new Error('The Workbench layout is unavailable. Try again.');
  /**
   * @param {WorkbenchPresentation} layout
   * @param {import('../contracts/workbench.js').WindowId} id
   * @returns {{position?: Position, window?: Position} | undefined}
   */
  const find = (layout, id) => id === 'display:primary' ? layout.display
    : /** @type {const} */ (['displays', 'texts', 'imageModules', 'shapes', 'keeperDocks']).flatMap(
      /** @returns {{id: import('../contracts/workbench.js').WindowId, position?: Position, window?: Position}[]} */ key => layout[key] || []).find(item => item.id === id)
    || layout.texts?.flatMap(text => text.frames || []).find(frame => frame.id === id);
  for (const { id, left, top } of changes) {
    // The layout guard above also proves the reversed fallback used for history.
    const item = find(workbench, id), previous = find(/** @type {WorkbenchPresentation} */ (historyPresentation), id);
    if (!item) throw new Error('A group member is no longer available. Select the group again.');
    const key = item.position ? 'position' : 'window';
    // Capture live positions of the moved members only. Unrelated responsive
    // windows must not become the starting point of this operation's Undo.
    // Validated presentation members have the position/window selected above.
    if (previous) previous[key] = { .../** @type {Position} */ (item[key]) };
    item[key] = { ...item[key], left, top };
  }
  if (!store.commitCompletedOperation({ ...draft, workbench }, { expectedGeneration, historyLabel: 'Move Workbench group',
    ...(presentation ? { historyPresentation } : {}) }))
    throw new Error('The group could not be moved. Your saved work is unchanged; try again.');
}
