import { createPlacementGroupCandidate, ungroupPlacementsCandidate, guardGroupedOperation } from './systemWorkflowGroups.js';
import {
  createSystemWorkflowGridCandidate,
  createSystemWorkflowGridDeleteCandidate,
  createSystemWorkflowGridRenameCandidate,
  createSystemWorkflowGridReorderCandidate,
  createSystemWorkflowGridVisibilityCandidate,
  inspectSystemWorkflowGridDeletion,
  systemWorkflowGridOrder,
} from './domain/systemWorkflowGrid.js';
import {
  adjacentSystemWorkflowGridId,
  firstSystemWorkflowGridId,
  reconcileSystemWorkflowGridSelection,
  reconcileSystemWorkflowGridSelectionInGrids,
  selectSystemWorkflowGrid,
  selectSystemWorkflowGridInGrids,
} from './domain/systemWorkflowNavigation.js';
import {
  createSystemWorkflowPlacementCandidate,
} from './systemWorkflowPlacement.js';
import {
  createSystemWorkflowGroupMovementCandidate,
  createSystemWorkflowMovementCandidate,
} from './systemWorkflowMovement.js';
import {
  createSystemWorkflowGroupResizeCandidate,
  createSystemWorkflowResizeCandidate,
} from './systemWorkflowResize.js';
import {
  createSystemWorkflowDuplicateCandidate,
  createSystemWorkflowGroupDuplicateCandidate,
} from './systemWorkflowDuplicate.js';
import {
  createSystemWorkflowGroupRemovalCandidate,
  createSystemWorkflowRemovalCandidate,
} from './systemWorkflowRemoval.js';
import {
  createSystemWorkflowLayerCandidate,
  createSystemWorkflowLayerReorderCandidate,
} from './systemWorkflowLayer.js';
import { createSystemWorkflowCropCandidate } from './systemWorkflowCrop.js';
import { createSystemWorkflowInspectionCandidate } from './systemWorkflowInspection.js';
import {
  createSystemWorkflowGroupTransformCandidate,
  createSystemWorkflowTransformCandidate,
} from './systemWorkflowTransform.js';
import { createSystemWorkflowAppearanceCandidate } from './systemWorkflowAppearance.js';
import { createSystemWorkflowGutterCandidate } from './systemWorkflowGutters.js';
import { createSystemWorkflowLockCandidate } from './systemWorkflowLock.js';
import { createSystemWorkflowArrangeCandidate } from './systemWorkflowArrange.js';

function sessionError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function createSystemWorkflowAuthoringSession({ store } = {}) {
  if (!store?.getDraft || !store?.getGeneration || !store?.commitCompletedOperation) {
    throw new TypeError('A System Workflow draft store is required');
  }
  let selectedGridId = firstSystemWorkflowGridId(store.getDraft());

  function transact(createCandidate, options = {}) {
    const generation = store.getGeneration();
    const draft = store.getDraft();
    const candidate = createCandidate(draft);
    if (candidate === null) return false;
    const candidateDraft = candidate?.draft || candidate;
    if (!store.commitCompletedOperation(candidateDraft, { ...options, expectedGeneration: generation })) {
      throw sessionError('SYSTEM_WORKFLOW_OPERATION_STALE', 'The change could not be saved. Storage may be unavailable or the draft changed in another tab. Reload before continuing.');
    }
    selectedGridId = reconcileSystemWorkflowGridSelection(store.getDraft(), selectedGridId);
    return true;
  }

  return Object.freeze({
    getState() {
      const draft = store.getDraft();
      selectedGridId = reconcileSystemWorkflowGridSelection(draft, selectedGridId);
      return Object.freeze({
        draft,
        generation: store.getGeneration(),
        selectedGridId,
      });
    },

    setProfileAddress(profileAddress) {
      if (!store.setProfileAddress?.(profileAddress)) return false;
      selectedGridId = firstSystemWorkflowGridId(store.getDraft());
      return true;
    },

    selectGrid(gridId) {
      selectedGridId = store.getSnapshot
        ? selectSystemWorkflowGridInGrids(store.getSnapshot().grids, gridId)
        : selectSystemWorkflowGrid(store.getDraft(), gridId);
      return selectedGridId;
    },

    selectAdjacentGrid(direction) {
      const candidate = adjacentSystemWorkflowGridId(store.getDraft(), selectedGridId, direction);
      if (candidate) selectedGridId = candidate;
      return selectedGridId;
    },

    createGrid(options) {
      const previous = new Set(systemWorkflowGridOrder(store.getDraft()));
      const committed = transact((draft) => createSystemWorkflowGridCandidate(draft, options));
      if (committed) selectedGridId = store.getDraft().grids.find(({ id }) => !previous.has(id)).id;
      return committed;
    },

    renameGrid(request) {
      return transact((draft) => createSystemWorkflowGridRenameCandidate(draft, request));
    },

    setGridVisibility(request) {
      return transact((draft) => createSystemWorkflowGridVisibilityCandidate(draft, request));
    },

    reorderGrid(request) {
      return transact((draft) => createSystemWorkflowGridReorderCandidate(draft, request));
    },

    inspectGridDeletion(request) {
      return inspectSystemWorkflowGridDeletion(store.getDraft(), request);
    },

    deleteGrid(request) {
      return transact((draft) => createSystemWorkflowGridDeleteCandidate(draft, request));
    },

    placeAsset(request) {
      return transact((draft) => createSystemWorkflowPlacementCandidate(draft, request));
    },

    movePlacement(request) {
      return transact((draft) => createSystemWorkflowMovementCandidate(guardGroupedOperation(draft, request), request));
    },

    movePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupMovementCandidate(guardGroupedOperation(draft, request), request));
    },

    applyGutters(request) {
      return transact((draft) => {
        if (draft.grids.find(grid => grid.id === request.gridId)?.groups?.length) throw new Error('Ungroup layers before applying composition spacing.');
        return createSystemWorkflowGutterCandidate(draft, request);
      });
    },

    getSnapshot() {
      const draft = store.getSnapshot ? store.getSnapshot() : store.getDraft();
      selectedGridId = store.getSnapshot
        ? reconcileSystemWorkflowGridSelectionInGrids(draft.grids, selectedGridId)
        : reconcileSystemWorkflowGridSelection(draft, selectedGridId);
      return Object.freeze({ draft, generation: store.getGeneration(), selectedGridId });
    },

    resizePlacement(request) {
      return transact((draft) => createSystemWorkflowResizeCandidate(guardGroupedOperation(draft, request), request));
    },

    groupPlacements(request) {
      return transact(draft => createPlacementGroupCandidate(draft, request));
    },

    ungroupPlacements(request) {
      return transact(draft => ungroupPlacementsCandidate(draft, request));
    },

    arrangePlacement(request) {
      return transact(draft => createSystemWorkflowArrangeCandidate(guardGroupedOperation(draft, request), request));
    },

    resizePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupResizeCandidate(guardGroupedOperation(draft, request), request));
    },

    cropPlacement(request) {
      return transact((draft) => createSystemWorkflowCropCandidate(guardGroupedOperation(draft, request), request));
    },

    setPlacementInspection(request) {
      return transact((draft) => createSystemWorkflowInspectionCandidate(guardGroupedOperation(draft, request), request));
    },

    duplicatePlacement(request) {
      return transact((draft) => createSystemWorkflowDuplicateCandidate(guardGroupedOperation(draft, request), request));
    },

    duplicatePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupDuplicateCandidate(guardGroupedOperation(draft, request), request));
    },

    changePlacementLayer(request) {
      return transact((draft) => createSystemWorkflowLayerCandidate(draft, request));
    },

    reorderPlacementLayers(request) {
      return transact((draft) => createSystemWorkflowLayerReorderCandidate(draft, request));
    },

    removePlacement(request) {
      return transact((draft) => createSystemWorkflowRemovalCandidate(guardGroupedOperation(draft, request), request));
    },

    removePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupRemovalCandidate(guardGroupedOperation(draft, request), request));
    },

    transformPlacement(request) {
      return transact((draft) => createSystemWorkflowTransformCandidate(guardGroupedOperation(draft, request), request));
    },

    transformPlacements(request) {
      return transact((draft) => createSystemWorkflowGroupTransformCandidate(guardGroupedOperation(draft, request), request));
    },

    setAppearance(request) {
      return transact((draft) => createSystemWorkflowAppearanceCandidate(draft, request));
    },

    setPlacementLocked(request) {
      return transact((draft) => createSystemWorkflowLockCandidate(draft, request));
    },
  });
}
