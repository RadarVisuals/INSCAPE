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
  selectSystemWorkflowGrid,
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
import { createSystemWorkflowPresentationCandidate } from './systemWorkflowPresentation.js';
import {
  createSystemWorkflowGroupTransformCandidate,
  createSystemWorkflowTransformCandidate,
} from './systemWorkflowTransform.js';
import { createSystemWorkflowAppearanceCandidate } from './systemWorkflowAppearance.js';
import { createSystemWorkflowLockCandidate } from './systemWorkflowLock.js';
import { assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { resolveIdentityCard } from '../profileIdentity/domain/identityCard.js';

function sessionError(code, message) {
  return Object.assign(new Error(message), { code });
}

function identityDetails({ alias, bio, tags, avatar }) {
  return { alias, bio, tags, avatar };
}

export function createSystemWorkflowAuthoringSession({ store } = {}) {
  if (!store?.getDraft || !store?.getGeneration || !store?.commitCompletedOperation) {
    throw new TypeError('A System Workflow draft store is required');
  }
  let selectedGridId = firstSystemWorkflowGridId(store.getDraft());

  function transact(createCandidate) {
    const generation = store.getGeneration();
    const draft = store.getDraft();
    const candidate = createCandidate(draft);
    if (candidate === null) return false;
    const candidateDraft = candidate?.draft || candidate;
    if (!store.commitCompletedOperation(candidateDraft, { expectedGeneration: generation })) {
      throw sessionError('SYSTEM_WORKFLOW_OPERATION_STALE', 'The change could not be saved. Storage may be unavailable or the draft changed in another tab. Reload before continuing.');
    }
    selectedGridId = reconcileSystemWorkflowGridSelection(store.getDraft(), selectedGridId);
    return true;
  }

  return Object.freeze({
    saveWorkbench(workbench) {
      return transact(draft => assertValidSystemWorkflowDraft({ ...draft, workbench: structuredClone(workbench) }));
    },
    setIdentityConfiguration({ expectedDetails, expectedCard, details, card }) {
      return transact((draft) => {
        const current = draft.identityPresentation;
        const before = { alias: current.alias, bio: current.bio, tags: current.tags, avatar: current.avatar };
        if (JSON.stringify(before) !== JSON.stringify(identityDetails(expectedDetails))
          || JSON.stringify(resolveIdentityCard(current)) !== JSON.stringify(expectedCard)) {
          throw sessionError('SYSTEM_WORKFLOW_IDENTITY_STALE', 'The Identity changed. Reopen the editor before saving.');
        }
        if (JSON.stringify(before) === JSON.stringify(identityDetails(details)) && Object.hasOwn(current, 'card')
          && JSON.stringify(current.card) === JSON.stringify(card)) return null;
        Object.assign(current, structuredClone(details), { card: structuredClone(card) });
        return assertValidSystemWorkflowDraft(draft);
      });
    },
    getState() {
      return Object.freeze({
        draft: store.getDraft(),
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
      selectedGridId = selectSystemWorkflowGrid(store.getDraft(), gridId);
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
      return transact((draft) => createSystemWorkflowMovementCandidate(draft, request));
    },

    movePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupMovementCandidate(draft, request));
    },

    resizePlacement(request) {
      return transact((draft) => createSystemWorkflowResizeCandidate(draft, request));
    },

    resizePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupResizeCandidate(draft, request));
    },

    cropPlacement(request) {
      return transact((draft) => createSystemWorkflowCropCandidate(draft, request));
    },

    setPlacementPresentation(request) {
      return transact((draft) => createSystemWorkflowPresentationCandidate(draft, request));
    },

    duplicatePlacement(request) {
      return transact((draft) => createSystemWorkflowDuplicateCandidate(draft, request));
    },

    duplicatePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupDuplicateCandidate(draft, request));
    },

    changePlacementLayer(request) {
      return transact((draft) => createSystemWorkflowLayerCandidate(draft, request));
    },

    reorderPlacementLayers(request) {
      return transact((draft) => createSystemWorkflowLayerReorderCandidate(draft, request));
    },

    removePlacement(request) {
      return transact((draft) => createSystemWorkflowRemovalCandidate(draft, request));
    },

    removePlacements(request) {
      return transact((draft) => createSystemWorkflowGroupRemovalCandidate(draft, request));
    },

    transformPlacement(request) {
      return transact((draft) => createSystemWorkflowTransformCandidate(draft, request));
    },

    transformPlacements(request) {
      return transact((draft) => createSystemWorkflowGroupTransformCandidate(draft, request));
    },

    setAppearance(request) {
      return transact((draft) => createSystemWorkflowAppearanceCandidate(draft, request));
    },

    setPlacementLocked(request) {
      return transact((draft) => createSystemWorkflowLockCandidate(draft, request));
    },
  });
}
