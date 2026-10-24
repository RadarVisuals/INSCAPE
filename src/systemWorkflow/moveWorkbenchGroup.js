// Group movement uses one completed draft operation. Windows still own their
// frames, contents, fitting and geometry validation; only positions change here.
export function moveWorkbenchGroup(store, profileAddress, changes, presentation, expectedGeneration = store.getGeneration()) {
  if (store.getProfileAddress() !== profileAddress) throw new Error('This Workbench is no longer active.');
  if (store.getGeneration() !== expectedGeneration) throw new Error('The Workbench changed. Select the group again.');
  const draft = store.getDraft();
  let workbench = structuredClone(presentation || draft.workbench);
  const historyPresentation = structuredClone(draft.workbench || presentation);
  if (!workbench) throw new Error('The Workbench layout is unavailable. Try again.');
  const find = (layout, id) => id === 'display:primary' ? layout.display
    : ['displays', 'texts', 'imageModules', 'shapes', 'keeperDocks'].flatMap(key => layout[key] || []).find(item => item.id === id)
    || layout.texts?.flatMap(text => text.frames || []).find(frame => frame.id === id);
  for (const { id, left, top } of changes) {
    const item = find(workbench, id), previous = find(historyPresentation, id);
    if (!item) throw new Error('A group member is no longer available. Select the group again.');
    const key = item.position ? 'position' : 'window';
    // Capture live positions of the moved members only. Unrelated responsive
    // windows must not become the starting point of this operation's Undo.
    if (previous) previous[key] = { ...item[key] };
    item[key] = { ...item[key], left, top };
  }
  if (!store.commitCompletedOperation({ ...draft, workbench }, { expectedGeneration, historyLabel: 'Move Workbench group',
    ...(presentation ? { historyPresentation } : {}) }))
    throw new Error('The group could not be moved. Your saved work is unchanged; try again.');
}
