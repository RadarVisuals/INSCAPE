// Session-only edits. Patches preserve unrelated, later window/navigation state.
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function draftChanges(before, after, path = []) {
  if (equal(before, after) || path.join('.') === 'mobile.editor'
    || path[0] === 'animations' && path.at(-1) === 'presentation') return [];
  if (plain(before) && plain(after)) return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .flatMap(key => draftChanges(before[key], after[key], [...path, key]));
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length
    && before.every((value, i) => value?.id && value.id === after[i]?.id)) {
    return before.flatMap((value, i) => draftChanges(value, after[i], [...path, i]));
  }
  return [{ path, before: structuredClone(before), after: structuredClone(after) }];
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
  return ({ miniApps: 'Edit · Mini app', mobile: 'Edit · Mobile', animations: 'Edit · Mirror', identityPresentation: 'Edit · Identity', workbench: 'Edit · Workbench' })[key] || 'Edit · Display';
}
