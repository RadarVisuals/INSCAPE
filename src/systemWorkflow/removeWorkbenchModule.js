import { PRIMARY_DISPLAY_ID } from './domain/displayModules.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';

// Deletion is one authored operation; assets in Library and publications are untouched.
export function removeWorkbenchModule(store, profile, kind, expected) {
  if (store.getProfileAddress() !== profile || !expected) return false;
  const keys = { display: 'displays', 'mini-app': 'miniApps', text: 'texts', image: 'imageModules', shape: 'shapes', keeper: 'keeperDocks' };
  const key = keys[kind];
  if (!key) return false;
  const draft = store.getDraft(), generation = store.getGeneration();
  if (kind === 'display' && expected.id === PRIMARY_DISPLAY_ID) {
    if (!draft.grids.length || JSON.stringify(draft.grids) !== JSON.stringify(expected.grids)) return false;
    return store.commitCompletedOperation({ ...draft, grids: [],
      ...(draft.workbench ? { workbench: { ...draft.workbench, display: createDefaultWorkbenchPresentation().display } } : {}),
    }, { expectedGeneration: generation, historyLabel: 'Delete Display' });
  }
  const current = draft[key]?.find(item => item.id === expected.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
  const next = { ...draft };
  next[key] = draft[key].filter(item => item.id !== expected.id);
  if (draft.workbench?.[key]) next.workbench = { ...draft.workbench,
    [key]: draft.workbench[key].filter(item => item.id !== expected.id) };
  return store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: `Delete · ${kind}` });
}
