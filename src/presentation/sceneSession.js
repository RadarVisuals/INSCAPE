import { createSceneSelection } from './sceneSelection.js';
import { displayContent, displayModuleIds } from '../systemWorkflow/domain/displayModules.js';

export const sceneScopeKey = ({ profileAddress, canvasId, revision }) => {
  if (!profileAddress || !canvasId || revision == null) throw new TypeError('A profile, canvas and snapshot scope are required.');
  return JSON.stringify([profileAddress.toLowerCase(), canvasId, revision]);
};

// One presentation owns this session, independently of mounted Display views.
// A new profile/canvas/publication gets a different session, never a global map.
export function createSceneSession(scope, content) {
  const key = sceneScopeKey(scope), entries = new Map(), listeners = new Set();
  let snapshot = Object.freeze({});
  const publish = () => {
    const next = Object.fromEntries([...entries].map(([id, entry]) => [id, entry.selection.getSnapshot()]));
    if (Object.keys(next).length === Object.keys(snapshot).length && Object.keys(next).every(id => next[id] === snapshot[id])) return;
    snapshot = Object.freeze(next); listeners.forEach(listener => listener());
  };
  const prepare = content => {
    const ids = displayModuleIds(content);
    for (const id of ids) {
      const grids = displayContent(content, id).grids;
      const entry = entries.get(id);
      if (!entry) {
        const selection = createSceneSelection(grids);
        const current = { selection, release: selection.subscribe(publish) };
        let entryTarget;
        // A retained callback from a removed module cannot control its replacement.
        current.controller = Object.freeze({ ...selection,
          select: gridId => entries.get(id) === current && selection.select(gridId),
          next: direction => entries.get(id) === current && selection.next(direction),
          reset: () => entries.get(id) === current && selection.reset(),
          enter: gridId => {
            if (entries.get(id) !== current || gridId === entryTarget) return false;
            entryTarget = gridId;
            return gridId ? selection.select(gridId) : false;
          },
          reconcile: (grids, notify) => entries.get(id) === current ? selection.reconcile(grids, notify) : null,
        });
        entries.set(id, current);
      }
    }
  };
  const configure = content => {
    const ids = displayModuleIds(content);
    for (const [id, entry] of entries) if (!ids.includes(id)) { entry.release(); entries.delete(id); }
    prepare(content);
    for (const id of ids) entries.get(id).selection.reconcile(displayContent(content, id).grids, false);
    publish();
  };
  configure(content);
  return Object.freeze({ key, configure, prepare,
    controller: id => entries.get(id)?.controller || null,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  });
}
