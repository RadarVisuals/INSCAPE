import { recoveryStorage, recoveryStorageKey } from '../workspace/profileWorkspace.js';
// Failed edits are scoped to their originating profile and editor context.
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
export function workbenchTextRecovery(entries, profile) {
  if (!Array.isArray(entries)) return entries;
  const current = entries.filter(pair => pair?.[0] !== profile + '/reception');
  return current.length ? current : null;
}
export function pendingProfileText(profile) {
  const contexts = [...workbenchProfiles].filter(([context, buffer]) => context.startsWith(profile + '/') && buffer.entries.size)
    .map(([context, buffer]) => [context, [...buffer.entries.values()]]);
  return contexts.length ? JSON.stringify(contexts) : null;
}
export function bindWorkbenchTextRecovery(store) {
  const profile = store.getProfileAddress();
  const context = `${profile}/${store.getRecoveryContext?.() || store.getWorkbenchId?.() || 'workbench:main'}`;
  const storage = recoveryStorage(profile);
  if (!workbenchProfiles.has(context)) workbenchProfiles.set(context, emptyState());
  const buffer = workbenchProfiles.get(context);
  if (storage && !buffer.persist) {
    const read = () => new Map(workbenchTextRecovery(JSON.parse(storage.getItem(recoveryStorageKey(profile)) || '[]'), profile));
    const saved = read().get(context) || [];
    for (const entry of saved) if (!buffer.entries.has(keyOf(entry.scope))) buffer.entries.set(keyOf(entry.scope), entry);
    buffer.persist = () => {
      const contexts = read();
      if (buffer.entries.size) contexts.set(context, [...buffer.entries.values()]); else contexts.delete(context);
      storage.setItem(recoveryStorageKey(profile), contexts.size ? JSON.stringify([...contexts]) : null);
    };
    if (JSON.stringify([...buffer.entries.values()]) !== JSON.stringify(saved)) buffer.persist();
    syncLeaveGuard(buffer);
  }
  stores.set(store, workbenchProfiles.get(context));
}
if (typeof window !== 'undefined') window.addEventListener('inscape-workspace-change', ({ detail }) => {
  if (detail.kind !== 'textRecovery') return;
  const storage = recoveryStorage(detail.profile);
  const contexts = new Map(workbenchTextRecovery(JSON.parse(storage.getItem(recoveryStorageKey(detail.profile)) || '[]'), detail.profile));
  for (const [context, buffer] of workbenchProfiles) if (buffer.persist && context.startsWith(detail.profile + '/')) {
    buffer.entries = new Map((contexts.get(context) || []).map(entry => [keyOf(entry.scope), entry]));
    syncLeaveGuard(buffer);
    buffer.revision++; buffer.listeners.forEach(listener => listener());
  }
});
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
  s.persist?.();
  syncLeaveGuard(s);
  s.revision++; s.listeners.forEach(listener => listener());
}
export function clearTextRecovery(store, scope) {
  if (store?.getProfileAddress() !== scope.profile) return;
  const s = state(store);
  if (s.entries.delete(keyOf(scope))) { s.persist?.(); syncLeaveGuard(s); s.revision++; s.listeners.forEach(listener => listener()); }
}
export function subscribeTextRecovery(store, listener) {
  const s = state(store); s.listeners.add(listener); return () => s.listeners.delete(listener);
}
export const textRecoveryRevision = store => state(store).revision;
export const TEXT_RECOVERY_MESSAGE = 'Text has unsaved changes. Reopen its editor and retry saving before previewing, publishing or changing the composition.';
