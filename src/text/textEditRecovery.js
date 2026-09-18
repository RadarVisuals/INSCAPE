// Failed edits only, scoped to the live profile store. This is a recovery buffer,
// never saved content or a second draft. Successful saves remove their entry.
const stores = new WeakMap();
function state(store) {
  if (!stores.has(store)) stores.set(store, { entries: new Map(), listeners: new Set(), revision: 0 });
  return stores.get(store);
}
const keyOf = scope => JSON.stringify([scope.profile, scope.moduleId || null, scope.gridId || null, scope.id]);
export const textRecoveryScope = (profile, id, moduleId, gridId) => ({ profile, id, moduleId, gridId });
export const readTextRecovery = (store, scope) => store ? state(store).entries.get(keyOf(scope)) : undefined;
export function textRecoveries(store, profile) {
  return store ? [...state(store).entries.values()].filter(entry => entry.scope.profile === profile) : [];
}
export function retainTextRecovery(store, scope, expected, value, failure) {
  if (!store || store.getProfileAddress() !== scope.profile) return;
  const s = state(store);
  s.entries.set(keyOf(scope), structuredClone({ scope, expected, value, failure }));
  s.revision++; s.listeners.forEach(listener => listener());
}
export function clearTextRecovery(store, scope) {
  if (!store) return;
  const s = state(store);
  if (s.entries.delete(keyOf(scope))) { s.revision++; s.listeners.forEach(listener => listener()); }
}
export function subscribeTextRecovery(store, listener) {
  const s = state(store); s.listeners.add(listener); return () => s.listeners.delete(listener);
}
export const textRecoveryRevision = store => state(store).revision;
export const TEXT_RECOVERY_MESSAGE = 'Text has unsaved changes. Reopen its editor and retry saving before previewing, publishing or changing the composition.';
