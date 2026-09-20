import { expandPlacementGroups } from '../../systemWorkflow/domain/placementGroups.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../../library/config.js';
import { systemWorkflowGridFingerprint, systemWorkflowGridOrder } from '../../systemWorkflow/domain/systemWorkflowGrid.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createDisplayModuleSession, setDisplayModuleFormat } from '../../systemWorkflow/displayModuleSession.js';
import { textRecoveries, TEXT_RECOVERY_MESSAGE } from '../../text/textEditRecovery.js';
import { PRIMARY_DISPLAY_ID } from '../../systemWorkflow/domain/displayModules.js';

function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }

export default function useOwnerSystemWorkflowController(profileAddress, { storage, sharedStore, moduleId = PRIMARY_DISPLAY_ID, initialGridId } = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  const selectedStorage = storage ?? browserStorage();
  const authority = useMemo(() => {
    if (!profile) return null;
    const store = sharedStore || createSystemWorkflowDraftStore({ profileAddress: profile, storage: selectedStorage });
    const session = createDisplayModuleSession(store, moduleId);
    if (initialGridId && session.getState().draft.grids.some(grid => grid.id === initialGridId)) session.selectGrid(initialGridId);
    return { store, session };
  }, [profile, selectedStorage, sharedStore, moduleId]);
  const liveAuthority = useRef(authority);
  liveAuthority.current = authority;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [, render] = useState(0);
  useEffect(() => authority?.store.subscribe(() => render(v => v + 1)), [authority]);
  const [failure, setFailure] = useState(null);
  const error = failure?.authority === authority ? failure.message : null;
  // View-only visibility: never committed to the draft or browser storage.
  const [layerVisibility, setLayerVisibility] = useState({ authority: null, hidden: new Set() });
  const hiddenPlacementIds = useMemo(() => layerVisibility.authority === authority
    ? layerVisibility.hidden : new Set(), [authority, layerVisibility]);
  const run = useCallback((operation) => {
    if (!authority || !mounted.current || liveAuthority.current !== authority) return false;
    try {
      if (textRecoveries(authority.store, profile).some(entry => entry.scope.moduleId === moduleId)) throw new Error(TEXT_RECOVERY_MESSAGE);
      const result = operation(authority.session);
      setFailure(null);
      render((v) => v + 1);
      return result;
    } catch (cause) {
      setFailure({ authority, message: cause?.message || 'The canonical operation failed' });
      render((v) => v + 1);
      return false;
    }
  }, [authority, profile, moduleId]);
  const state = authority ? authority.session.getSnapshot() : { draft: null, selectedGridId: null, generation: 0 };
  const selectedGrid = state.draft?.grids.find(({ id }) => id === state.selectedGridId) || null;
  const selectionScope = useMemo(() => ({}), [authority, state.selectedGridId]);
  const liveSelectionScope = useRef(selectionScope);
  liveSelectionScope.current = selectionScope;
  const [selection, setSelection] = useState(null);
  const availablePlacementIds = new Set(selectedGrid?.placements.map(({ id }) => id));
  const selectedPlacementIds = selection?.scope === selectionScope
    ? expandPlacementGroups(selectedGrid, selection.ids).filter((id) => availablePlacementIds.has(id) && !hiddenPlacementIds.has(id)) : [];
  const setSelectedPlacementIds = useCallback((update) => {
    if (!mounted.current || liveSelectionScope.current !== selectionScope) return;
    setSelection((current) => {
      const ids = current?.scope === selectionScope ? current.ids : [];
      return { scope: selectionScope, ids: typeof update === 'function' ? update(ids) : update };
    });
  }, [selectionScope]);
  const selectedPlacements = selectedGrid?.placements.filter(({ id }) => selectedPlacementIds.includes(id)) || [];
  const selectPlacement = useCallback((id, additive = false) => {
    if (hiddenPlacementIds.has(id)) return;
    const ids = expandPlacementGroups(selectedGrid, id ? [id] : []);
    setSelectedPlacementIds(current => additive ? current.includes(id) ? current.filter(value => !ids.includes(value)) : [...new Set([...current, ...ids])] : ids);
  }, [hiddenPlacementIds, setSelectedPlacementIds, selectedGrid]);
  const replaceSelection = useCallback((ids = []) => setSelectedPlacementIds(expandPlacementGroups(selectedGrid, ids).filter(id => id && !hiddenPlacementIds.has(id))), [hiddenPlacementIds, setSelectedPlacementIds, selectedGrid]);
  const togglePlacementVisibility = (placement) => {
    if (!mounted.current || liveSelectionScope.current !== selectionScope || !availablePlacementIds.has(placement.id)) return;
    setLayerVisibility((current) => {
      const hidden = new Set(current.authority === authority ? current.hidden : []);
      const hide = !hidden.has(placement.id);
      for (const id of expandPlacementGroups(selectedGrid, [placement.id])) { if (hide) hidden.add(id); else hidden.delete(id); }
      return { authority, hidden };
    });
    setSelectedPlacementIds((current) => current.filter(id => !expandPlacementGroups(selectedGrid, [placement.id]).includes(id)));
  };
  const clearError = useCallback(() => setFailure(null), []);
  const gridRequest = (grid, extra = {}) => ({ gridId: grid.id, expectedGridFingerprint: systemWorkflowGridFingerprint(grid), ...extra });
  return { ...state, store: authority?.store, moduleId, selectedGrid, selectedPlacements, selectedPlacementIds, error, clearError,
    setDisplayFormat: orientation => run(() => {
      if (!setDisplayModuleFormat(authority.store, moduleId, orientation)) throw new Error('The Display format could not be saved');
      return true;
    }),
    run, selectPlacement, replaceSelection, hiddenPlacementIds, togglePlacementVisibility,
    placeAsset: (request) => run((session) => {
      const before = new Set(session.getState().draft.grids.find(({ id }) => id === request.gridId)?.placements.map(({ id }) => id));
      const committed = session.placeAsset(request);
      if (committed) {
        const added = session.getState().draft.grids.find(({ id }) => id === request.gridId)?.placements.filter(({ id }) => !before.has(id));
        setSelectedPlacementIds(added.map(({ id }) => id));
      }
      return committed;
    }),
    changeGrid: (id) => { run((session) => session.selectGrid(id)); setSelectedPlacementIds([]); },
    createGrid: () => { const result = run((session) => session.createGrid()); if (result !== false) setSelectedPlacementIds([]); return result; },
    renameGrid: (grid, name) => run((session) => session.renameGrid(gridRequest(grid, { name }))),
    setGridVisibility: (grid, visibility) => run((session) => session.setGridVisibility(gridRequest(grid, { visibility }))),
    reorderGrid: (gridId, toIndex) => run((session) => session.reorderGrid({ gridId, toIndex, expectedOrder: systemWorkflowGridOrder(state.draft) })),
    deleteGrid: (grid) => { const result = run((session) => session.deleteGrid({ gridId: grid.id, confirmation: session.inspectGridDeletion({ gridId: grid.id }) })); if (result !== false && grid.id === state.selectedGridId) setSelectedPlacementIds([]); return result; },
    setAppearance: (patch) => run((session) => session.setAppearance({ expectedAppearance: state.draft.appearance, appearance: patch })),
    toggleLock: (placement) => run((session) => session.setPlacementLocked({ gridId: state.selectedGridId, placementId: placement.id, expectedPlacement: placement, locked: !placement.locked })),
  };
}
