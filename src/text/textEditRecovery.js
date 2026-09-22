// Failed edits only, never saved content or a second draft. Workbench buffers
// belong to the page session and profile, surviving runtime disposal/navigation.
// Ordinary standalone stores remain isolated. Confirmed saves remove entries;
// a full page reload ends this in-memory recovery lifetime.
const stores = new WeakMap();
const workbenchProfiles = new Map();
const pendingStates = new Set();
const guardLeave = event => { event.preventDefault(); event.returnValue = ''; };
function syncLeaveGuard(s) {
  const hadPending = pendingStates.size > 0;
  if (s.entries.size) pendingStates.add(s); else pendingStates.delete(s);
  if (typeof window === 'undefined') return;
  if (!hadPending && pendingStates.size) window.addEventListener('beforeunload', guardLeave);
  if (hadPending && !pendingStates.size) window.removeEventListener('beforeunload', guardLeave);
}
const emptyState = () => ({ entries: new Map(), listeners: new Set(), revision: 0 });
export function bindWorkbenchTextRecovery(store) {
  const profile = store.getProfileAddress();
  if (!workbenchProfiles.has(profile)) workbenchProfiles.set(profile, emptyState());
  stores.set(store, workbenchProfiles.get(profile));
}
function state(store) {
  if (!stores.has(store)) stores.set(store, emptyState());
  return stores.get(store);
}
const keyOf = scope => JSON.stringify([scope.profile, scope.moduleId || null, scope.gridId || null, scope.id]);
export const textRecoveryScope = (profile, id, moduleId, gridId) => ({ profile, id, moduleId, gridId });
export const readTextRecovery = (store, scope) => store?.getProfileAddress() === scope.profile ? state(store).entries.get(keyOf(scope)) : undefined;
export function textRecoveries(store, profile) {
  return store?.getProfileAddress() === profile ? [...state(store).entries.values()].filter(entry => entry.scope.profile === profile) : [];
}
export function retainTextRecovery(store, scope, expected, value, failure) {
  if (!store || store.getProfileAddress() !== scope.profile) return;
  const s = state(store);
  s.entries.set(keyOf(scope), structuredClone({ scope, expected, value, failure }));
  syncLeaveGuard(s);
  s.revision++; s.listeners.forEach(listener => listener());
}
export function clearTextRecovery(store, scope) {
  if (store?.getProfileAddress() !== scope.profile) return;
  const s = state(store);
  if (s.entries.delete(keyOf(scope))) { syncLeaveGuard(s); s.revision++; s.listeners.forEach(listener => listener()); }
}
export function subscribeTextRecovery(store, listener) {
  const s = state(store); s.listeners.add(listener); return () => s.listeners.delete(listener);
}
export const textRecoveryRevision = store => state(store).revision;
export const TEXT_RECOVERY_MESSAGE = 'Text has unsaved changes. Reopen its editor and retry saving before previewing, publishing or changing the composition.';
