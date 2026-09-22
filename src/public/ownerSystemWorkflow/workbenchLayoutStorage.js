import { validSharedTools } from './sharedDisplayToolsState.js';
import { isValidWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { validDisplayInstruments, validInstrumentWindows } from './displayInstrumentState.js';
import { displayModuleIds } from '../../systemWorkflow/domain/displayModules.js';

export const workbenchLayoutKey = profile => `inscape:workbench:layout:v1:${profile.toLowerCase()}`;
// A local view of existing modules, not authored content. An explicit restore of
// draft.workbench invalidates it; deleted module IDs cannot be resurrected by it.
export function loadWorkbenchLayout(profile, draft, storage) {
  try {
    const raw = storage?.getItem(workbenchLayoutKey(profile));
    if (!raw) return { layout: null, views: {} };
    const value = JSON.parse(raw);
    if (value.version !== 1 || !isValidWorkbenchPresentation(value.layout)
      || typeof value.baseline !== 'string' || !value.views || typeof value.views !== 'object' || Array.isArray(value.views)) throw Error('invalid');
    if (value.baseline !== JSON.stringify(draft.workbench || null)) return { layout: null, views: {} };
    const ids = new Set(displayModuleIds(draft));
    const layout = { ...value.layout,
      displays: value.layout.displays?.filter(item => ids.has(item.id)),
      texts: value.layout.texts?.filter(item => draft.texts?.some(text => text.id === item.id)),
      imageModules: value.layout.imageModules?.filter(item => draft.imageModules?.some(image => image.id === item.id)),
      miniApps: value.layout.miniApps?.filter(item => draft.miniApps?.some(app => app.id === item.id)),
    };
    for (const name of ['displays', 'texts', 'miniApps', 'imageModules']) if (layout[name] === undefined) delete layout[name];
    const views = Object.fromEntries(Object.entries(value.views).flatMap(([id, view]) => {
      if (id === 'workbench:tools' && validSharedTools(view)) return [[id, view]];
      if (ids.has(id) && view && typeof view.gridId === 'string' && typeof view.locked === 'boolean') return [[id, {
        gridId: view.gridId, locked: view.locked, ...(validInstrumentWindows(view.instrumentWindows) ? { instrumentWindows: view.instrumentWindows } : {}), ...(validDisplayInstruments(view.instruments) ? { instruments: view.instruments } : {}),
      }]];
      if (draft.texts?.some(text => text.id === id) && view && ['read', 'write'].includes(view.mode) && typeof view.settings === 'boolean') return [[id, { mode: view.mode, settings: view.settings }]];
      return [];
    }));
    return { layout, views };
  } catch { return { layout: null, views: {}, error: 'The previous workspace layout could not be read. Its stored copy has been kept.', blocked: true }; }
}
export function saveWorkbenchLayout(profile, draft, layout, views, storage) {
  if (!isValidWorkbenchPresentation(layout)) return false;
  try {
    if (!storage?.setItem) return false;
    storage.setItem(workbenchLayoutKey(profile), JSON.stringify({ version: 1, baseline: JSON.stringify(draft.workbench || null), layout, views }));
    return true;
  } catch { return false; }
}
