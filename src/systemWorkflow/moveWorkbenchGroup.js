// Group movement uses one completed draft operation. Windows still own their
// frames, contents, fitting and geometry validation; only positions change here.
export function moveWorkbenchGroup(store, profileAddress, changes, presentation) {
  if (store.getProfileAddress() !== profileAddress) throw new Error('This Workbench is no longer active.');
  const generation = store.getGeneration(), draft = store.getDraft();
  let workbench = structuredClone(presentation || draft.workbench);
  if (!workbench) throw new Error('The Workbench layout is unavailable. Try again.');
  for (const { id, left, top } of changes) {
    const item = id === 'display:primary' ? workbench.display
      : ['displays', 'texts', 'imageModules', 'shapes', 'keeperDocks'].flatMap(key => workbench[key] || []).find(item => item.id === id)
      || workbench.texts?.flatMap(text => text.frames || []).find(frame => frame.id === id);
    if (!item) throw new Error('A group member is no longer available. Select the group again.');
    const key = item.position ? 'position' : 'window';
    item[key] = { ...item[key], left, top };
  }
  if (!store.commitCompletedOperation({ ...draft, workbench }, { expectedGeneration: generation, historyLabel: 'Move Workbench group' }))
    throw new Error('The group could not be moved. Your saved work is unchanged; try again.');
}
