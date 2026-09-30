import { MAX_KEEPER_DOCKS, KEEPER_DOCK_SIZE, KEEPER_SIZE, validKeeperDocks, createKeeperPresentation } from './keeper.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';

export function addKeeperDock(store, profile, placed = null) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration(), items = draft.keeperDocks || [];
  if (items.length >= MAX_KEEPER_DOCKS) throw new Error('At most four Keeper docks are supported.');
  const record = { id: `keeper:${crypto.randomUUID()}`, name: `Keeper ${items.length + 1}`, asset: null, faces: 'right', size: KEEPER_SIZE.default, visibility: 'PRIVATE' };
  const presentation = createKeeperPresentation(record.id, items.length);
  presentation.position = clampWorkbenchPosition(placed?.position || presentation.position, KEEPER_DOCK_SIZE);
  const layout = placed?.workbench || draft.workbench || createDefaultWorkbenchPresentation();
  if (!store.commitCompletedOperation({ ...draft, keeperDocks: [...items, record],
    workbench: { ...layout, keeperDocks: [...(layout.keeperDocks || []), presentation] } },
  { expectedGeneration: generation, historyLabel: 'Add Keeper dock' })) throw new Error('The Keeper dock could not be saved. Try again.');
  return record.id;
}
export function saveKeeperDock(store, profile, expected, changes) {
  if (store.getProfileAddress() !== profile) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  if (JSON.stringify(draft.keeperDocks?.find(item => item.id === expected.id)) !== JSON.stringify(expected)) return false;
  const keeperDocks = draft.keeperDocks.map(item => item.id === expected.id ? { ...item, ...changes, id: item.id } : item);
  if (!validKeeperDocks(keeperDocks)) return false;
  return store.commitCompletedOperation({ ...draft, keeperDocks }, { expectedGeneration: generation, historyLabel: 'Edit Keeper dock' });
}
