// Deletion is one authored operation; assets in Library and publications are untouched.
export function removeWorkbenchModule(store, profile, kind, expected) {
  if (store.getProfileAddress() !== profile || !expected) return false;
  const keys = { text: 'texts', image: 'imageModules', shape: 'shapes', keeper: 'keeperDocks' };
  const key = keys[kind];
  if (!key) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  const current = draft[key]?.find(item => item.id === expected.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const next = { ...draft };
  next[key] = draft[key].filter(item => item.id !== expected.id);
  if (draft.workbench?.[key]) next.workbench = { ...draft.workbench,
    [key]: draft.workbench[key].filter(item => item.id !== expected.id) };
  return store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: `Delete · ${kind}` });
}
