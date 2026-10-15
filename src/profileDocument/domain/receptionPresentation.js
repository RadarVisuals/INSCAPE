// Optional curation. Absence preserves older publications' automatic overview;
// an explicit empty list is an authored empty reception, not a default request.
export function validReception(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 2 && value.version === 1 && Array.isArray(value.items)
    && value.items.length <= 128 && new Set(value.items).size === value.items.length
    && value.items.every(id => typeof id === 'string' && /^(?:display:primary|(?:image|text|display):[A-Za-z0-9_-]{1,80})$/u.test(id)));
}

export function receptionModuleIds(document) {
  const records = key => Array.isArray(document[key]) ? document[key] : [];
  return [ ...(records('grids').length ? ['display:primary'] : []),
    ...records('displays').filter(item => item?.grids?.length && item.visibility !== 'PRIVATE').map(item => item.id),
    ...records('imageModules').filter(item => item && item.visibility !== 'PRIVATE').map(item => item.id),
    ...records('texts').filter(item => item && item.visibility !== 'PRIVATE').map(item => item.id) ];
}

export function projectReception(value, document) {
  if (!value) return undefined;
  const available = new Set(receptionModuleIds(document));
  return { version: 1, items: value.items.filter(id => available.has(id)) };
}

export function saveReceptionSelection(store, profile, expected, items) {
  if (store.getProfileAddress() !== profile) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  const reception = { version: 1, items: [...items] };
  if (JSON.stringify(draft.reception) !== JSON.stringify(expected) || !validReception(reception)) return false;
  return store.commitCompletedOperation({ ...draft, reception }, { expectedGeneration: generation, historyLabel: 'Edit reception selection' });
}
