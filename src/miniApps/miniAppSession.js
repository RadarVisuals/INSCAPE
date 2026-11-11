import { MAX_MINI_APPS, validMiniApps } from './domain/miniApps.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';

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

export function saveMiniApp(store, profile, expected, next, placement) {
  if (!next) return removeWorkbenchModule(store, profile, 'mini-app', expected);
  if (store.getProfileAddress() !== profile) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  const current = draft.miniApps?.find(item => item.id === expected.id);
  if (JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const miniApps = draft.miniApps.map(item => item.id === expected.id ? { ...next, id: expected.id } : item);
  if (!validMiniApps(miniApps)) return false;
  if (placement && expected.surface !== next.surface) {
    const base = draft.workbench || createDefaultWorkbenchPresentation();
    const items = base.miniApps || [];
    const withWindow = window => {
      const entry = { ...placement.previous, window };
      return { ...base, miniApps: items.some(item => item.id === expected.id)
        ? items.map(item => item.id === expected.id ? entry : item) : [...items, entry] };
    };
    // A surface and its coordinates change meaning together, including on Undo.
    return store.commitCompletedOperation({ ...draft, miniApps, workbench: withWindow(placement.window) },
      { expectedGeneration: generation, historyPresentation: withWindow(placement.previous.window) });
  }
  return store.commitCompletedOperation({ ...draft, miniApps }, { expectedGeneration: generation });
}
