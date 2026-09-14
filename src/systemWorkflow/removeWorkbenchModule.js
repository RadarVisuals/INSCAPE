import { PRIMARY_DISPLAY_ID } from './domain/displayModules.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';

// Deletion is one authored operation; assets in Library and publications are untouched.
export function removeWorkbenchModule(store, profile, kind, expected) {
  if (store.getProfileAddress() !== profile || !expected) return false;
  const keys = { display: 'displays', mirror: 'animations', mobile: 'mobile', 'mini-app': 'miniApps' };
  const key = keys[kind];
  if (!key) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  if (kind === 'display' && expected.id === PRIMARY_DISPLAY_ID) {
    if (!draft.grids.length || JSON.stringify(draft.grids) !== JSON.stringify(expected.grids)) return false;
    return store.commitCompletedOperation({ ...draft, grids: [],
      ...(draft.workbench ? { workbench: { ...draft.workbench, display: createDefaultWorkbenchPresentation().display } } : {}),
    }, { expectedGeneration: generation, historyLabel: 'Delete Display' });
  }
  const current = kind === 'mobile' ? draft.mobile : draft[key]?.find(item => item.id === expected.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const next = { ...draft };
  if (kind === 'mobile') delete next.mobile;
  else next[key] = draft[key].filter(item => item.id !== expected.id);
  const layoutKey = kind === 'display' ? 'displays' : kind === 'mini-app' ? 'miniApps' : null;
  if (layoutKey && draft.workbench?.[layoutKey]) next.workbench = { ...draft.workbench,
    [layoutKey]: draft.workbench[layoutKey].filter(item => item.id !== expected.id) };
  return store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: `Delete · ${kind}` });
}
