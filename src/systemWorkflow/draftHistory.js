// Session-only edits. Patches preserve unrelated, later window/navigation state.
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
// Drafts are validated JSON data. Compare branches once instead of serializing
// every ancestor of a changed leaf (including all unrelated articles).
const equal = (a, b) => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
};
export function draftChanges(before, after, path = []) {
  if (Object.is(before, after)) return [];
  if (plain(before) && plain(after)) return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .flatMap(key => draftChanges(before[key], after[key], [...path, key]));
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length
    && before.every((value, i) => value?.id && value.id === after[i]?.id)) {
    return before.flatMap((value, i) => draftChanges(value, after[i], [...path, i]));
  }
  return equal(before, after) ? [] : [{ path, before: structuredClone(before), after: structuredClone(after) }];
}
export function applyDraftChanges(draft, changes, direction) {
  const next = structuredClone(draft);
  for (const change of changes) {
    let parent = next;
    for (const key of change.path.slice(0, -1)) { parent = parent?.[key]; if (!parent) return null; }
    const key = change.path.at(-1), expected = direction === 'undo' ? change.after : change.before;
    if (draftChanges(expected, parent[key], change.path).length) return null;
    const value = direction === 'undo' ? change.before : change.after;
    if (value === undefined) delete parent[key]; else parent[key] = structuredClone(value);
  }
  return next;
}
export function draftChangeLabel(changes) {
  const key = changes[0]?.path[0];
  return ({ texts: 'Edit · Text', imageModules: 'Edit · Image', shapes: 'Edit · Shape', keeperDocks: 'Edit · Keeper',
    miniApps: 'Edit · Mini app', identityPresentation: 'Edit · Identity', workbench: 'Edit · Workbench',
    grids: 'Edit · Display', appearance: 'Edit · Display', displays: 'Edit · Display' })[key] || 'Edit';
}
