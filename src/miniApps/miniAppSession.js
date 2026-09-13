import { MAX_MINI_APPS, validMiniApps } from './domain/miniApps.js';

export function addMiniApp(store, profile) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  if ((draft.miniApps?.length || 0) >= MAX_MINI_APPS) throw new Error('At most four mini apps are supported.');
  const record = { id: `miniapp:${crypto.randomUUID()}`, name: 'Mini app', url: '', visibility: 'PRIVATE' };
  if (!store.commitCompletedOperation({ ...draft, miniApps: [...(draft.miniApps || []), record] }, { expectedGeneration: generation })) {
    throw new Error('The mini app could not be saved. Reload the profile before continuing.');
  }
  return record.id;
}

export function saveMiniApp(store, profile, expected, next) {
  if (store.getProfileAddress() !== profile) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  const current = draft.miniApps?.find(item => item.id === expected.id);
  if (JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const miniApps = next ? draft.miniApps.map(item => item.id === expected.id ? { ...next, id: expected.id } : item)
    : draft.miniApps.filter(item => item.id !== expected.id);
  if (!validMiniApps(miniApps)) return false;
  const workbench = draft.workbench?.miniApps ? { ...draft.workbench,
    miniApps: draft.workbench.miniApps.filter(item => miniApps.some(app => app.id === item.id)) } : draft.workbench;
  return store.commitCompletedOperation({ ...draft, miniApps, ...(workbench ? { workbench } : {}) }, { expectedGeneration: generation });
}
