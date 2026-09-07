import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../../library/config.js';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import { systemWorkflowGridFingerprint, systemWorkflowGridOrder } from '../../systemWorkflow/domain/systemWorkflowGrid.js';
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
  const liveAuthority = useRef(authority);
  liveAuthority.current = authority;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [, render] = useState(0);
  const [failure, setFailure] = useState(null);
  const error = failure?.authority === authority ? failure.message : null;
  // View-only visibility: never committed to the draft or browser storage.
  const [layerVisibility, setLayerVisibility] = useState({ authority: null, hidden: new Set() });
  const hiddenPlacementIds = useMemo(() => layerVisibility.authority === authority
    ? layerVisibility.hidden : new Set(), [authority, layerVisibility]);
  const run = useCallback((operation) => {
    if (!authority || !mounted.current || liveAuthority.current !== authority) return false;
    try {
      const result = operation(authority.session);
      setFailure(null);
      render((v) => v + 1);
      return result;
    } catch (cause) {
      setFailure({ authority, message: cause?.message || 'The canonical operation failed' });
      render((v) => v + 1);
      return false;
    }
  }, [authority]);
  const state = authority ? authority.session.getState() : { draft: null, selectedGridId: null, generation: 0 };
  const selectedGrid = state.draft?.grids.find(({ id }) => id === state.selectedGridId) || null;
  const selectionScope = useMemo(() => ({}), [authority, state.selectedGridId]);
  const liveSelectionScope = useRef(selectionScope);
  liveSelectionScope.current = selectionScope;
  const [selection, setSelection] = useState(null);
  const availablePlacementIds = new Set(selectedGrid?.placements.map(({ id }) => id));
  const selectedPlacementIds = selection?.scope === selectionScope
    ? selection.ids.filter((id) => availablePlacementIds.has(id) && !hiddenPlacementIds.has(id)) : [];
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
    setSelectedPlacementIds((current) => additive ? current.includes(id) ? current.filter((value) => value !== id) : [...current, id] : id ? [id] : []);
  }, [hiddenPlacementIds, setSelectedPlacementIds]);
  const replaceSelection = useCallback((ids = []) => setSelectedPlacementIds([...new Set(ids.filter((id) => id && !hiddenPlacementIds.has(id)))]), [hiddenPlacementIds, setSelectedPlacementIds]);
  const togglePlacementVisibility = (placement) => {
    if (!mounted.current || liveSelectionScope.current !== selectionScope || !availablePlacementIds.has(placement.id)) return;
    setLayerVisibility((current) => {
      const hidden = new Set(current.authority === authority ? current.hidden : []);
      if (hidden.has(placement.id)) hidden.delete(placement.id); else hidden.add(placement.id);
      return { authority, hidden };
    });
    setSelectedPlacementIds((current) => current.filter((id) => id !== placement.id));
  };
  const clearError = useCallback(() => setFailure(null), []);
  const gridRequest = (grid, extra = {}) => ({ gridId: grid.id, expectedGridFingerprint: systemWorkflowGridFingerprint(grid), ...extra });
  return { ...state, selectedGrid, selectedPlacements, selectedPlacementIds, error, clearError,
    run, selectPlacement, replaceSelection, hiddenPlacementIds, togglePlacementVisibility,
    setIdentityAvatar: (avatar) => run((session) => session.setIdentityAvatar({ expectedAvatar: state.draft.identityPresentation.avatar, avatar })),
    setIdentityCard: (card) => run((session) => session.setIdentityCard({ expectedCard: resolveIdentityCard(state.draft.identityPresentation), card })),
    setIdentityDetails: (values) => run((session) => {
      const { alias, bio, tags } = state.draft.identityPresentation;
      return session.setIdentityDetails({ expectedDetails: { alias, bio, tags }, details: {
        alias: values.title, bio: { mode: values.description ? 'inscape' : 'official', customText: values.description },
        tags: { ...tags, additional: values.tags },
      } });
    }),
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
