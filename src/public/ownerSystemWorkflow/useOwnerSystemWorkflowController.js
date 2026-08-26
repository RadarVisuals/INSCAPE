import { useCallback, useMemo, useState } from 'react';
import { normalizeProfileAddress } from '../../library/config.js';
import { systemWorkflowGridFingerprint } from '../../systemWorkflow/domain/systemWorkflowGrid.js';
import { createSystemWorkflowAuthoringSession } from '../../systemWorkflow/systemWorkflowAuthoringSession.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';

function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }

export default function useOwnerSystemWorkflowController(profileAddress, { storage } = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  const selectedStorage = storage ?? browserStorage();
  const authority = useMemo(() => {
    if (!profile) return null;
    const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: selectedStorage });
    return { store, session: createSystemWorkflowAuthoringSession({ store }) };
  }, [profile, selectedStorage]);
  const [, render] = useState(0); const [error, setError] = useState(null); const [selectedPlacementIds, setSelectedPlacementIds] = useState([]);
  const run = useCallback((operation) => { if (!authority) return false; try { const result = operation(authority.session); setError(null); render((v) => v + 1); return result; } catch (cause) { setError(cause?.message || 'The canonical operation failed'); render((v) => v + 1); return false; } }, [authority]);
  const state = authority ? authority.session.getState() : { draft: null, selectedGridId: null, generation: 0 };
  const selectedGrid = state.draft?.grids.find(({ id }) => id === state.selectedGridId) || null;
  const selectedPlacements = selectedGrid?.placements.filter(({ id }) => selectedPlacementIds.includes(id)) || [];
  const selectPlacement = useCallback((id, additive = false) => setSelectedPlacementIds((current) => additive ? current.includes(id) ? current.filter((value) => value !== id) : [...current, id] : id ? [id] : []), []);
  const replaceSelection = useCallback((ids = []) => setSelectedPlacementIds([...new Set(ids.filter(Boolean))]), []);
  const clearError = useCallback(() => setError(null), []);
  const gridRequest = (grid, extra = {}) => ({ gridId: grid.id, expectedGridFingerprint: systemWorkflowGridFingerprint(grid), ...extra });
  return { ...state, selectedGrid, selectedPlacements, selectedPlacementIds, error, clearError,
    run, selectPlacement, replaceSelection,
    changeGrid: (id) => { run((session) => session.selectGrid(id)); setSelectedPlacementIds([]); },
    createGrid: () => run((session) => session.createGrid()),
    renameGrid: (grid, name) => run((session) => session.renameGrid(gridRequest(grid, { name }))),
    setGridVisibility: (grid, visibility) => run((session) => session.setGridVisibility(gridRequest(grid, { visibility }))),
    reorderGrid: (gridId, toIndex) => run((session) => session.reorderGrid({ gridId, toIndex, expectedOrder: state.draft.grids.map(({ id }) => id) })),
    deleteGrid: (grid) => run((session) => session.deleteGrid({ gridId: grid.id, confirmation: session.inspectGridDeletion({ gridId: grid.id }) })),
    setAppearance: (patch) => run((session) => session.setAppearance({ expectedAppearance: state.draft.appearance, appearance: patch })),
    toggleLock: (placement) => run((session) => session.setPlacementLocked({ gridId: state.selectedGridId, placementId: placement.id, expectedPlacement: placement, locked: !placement.locked })),
  };
}
