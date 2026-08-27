import {
  SYSTEM_WORKFLOW_FRAME_IDS,
  SYSTEM_WORKFLOW_TRANSPARENCY_MODES,
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
} from './domain/systemWorkflowDraft.js';
import {
  ARTWORK_MAT_INSET_MAX,
  normalizeArtworkBacking,
  normalizeArtworkMat,
} from '../lattice/rendering/latticeMat.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

const FRAME_IDS = new Set(SYSTEM_WORKFLOW_FRAME_IDS);
const TRANSPARENCY_MODES = new Set(SYSTEM_WORKFLOW_TRANSPARENCY_MODES);
const PRESENTATION_KEYS = Object.freeze(['frameId', 'mat', 'backing', 'transparencyMode']);
const INSET_KEYS = Object.freeze(['top', 'right', 'bottom', 'left']);

function presentationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function exactKeys(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key)));
}

export function normalizeSystemWorkflowPresentation(value) {
  if (!exactKeys(value, PRESENTATION_KEYS)) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_VALUE_INVALID', 'Placement presentation requires canonical frame, mat, backing, and transparency values');
  }
  if (!FRAME_IDS.has(value.frameId)) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_FRAME_INVALID', 'Unknown placement frame ID');
  }
  if (!TRANSPARENCY_MODES.has(value.transparencyMode)) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_TRANSPARENCY_INVALID', 'Unknown placement transparency mode');
  }
  const insets = value.mat?.inset;
  if (!exactKeys(insets, INSET_KEYS) || INSET_KEYS.some((edge) => !Number.isFinite(insets[edge]))) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_MAT_INSET_INVALID', 'Artwork mat insets must be finite values from 0 to 0.45');
  }
  if (insets.left + insets.right >= 1 || insets.top + insets.bottom >= 1) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_MAT_INSET_SUM_INVALID', 'Opposing artwork mat insets must sum to less than one');
  }
  if (INSET_KEYS.some((edge) => insets[edge] < 0 || insets[edge] > ARTWORK_MAT_INSET_MAX)) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_MAT_INSET_INVALID', 'Artwork mat insets must be finite values from 0 to 0.45');
  }
  let mat;
  let backing;
  try {
    mat = normalizeArtworkMat(value.mat);
    backing = normalizeArtworkBacking(value.backing);
  } catch (error) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_COLOR_INVALID', error?.message || 'Placement presentation colors are invalid');
  }
  return {
    frameId: value.frameId,
    mat,
    backing,
    transparencyMode: value.transparencyMode,
  };
}

export function systemWorkflowPlacementPresentation(placement) {
  return normalizeSystemWorkflowPresentation({
    frameId: placement?.frameId,
    mat: placement?.mat,
    backing: placement?.backing,
    transparencyMode: placement?.transparencyMode,
  });
}

function samePresentation(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createSystemWorkflowPresentationCandidate(draftInput, {
  expectedPlacement,
  placementId,
  presentation,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_GRID_PRIVATE', 'Placement presentation is unavailable on a private grid');
  }
  const placement = grid.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_PLACEMENT_STALE', 'The canonical placement changed before presentation editing completed');
  }
  if (placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_PLACEMENT_PRIVATE', 'Private placements cannot be edited through the public owner projection');
  }
  if (placement.locked) throw presentationError('SYSTEM_WORKFLOW_PRESENTATION_PLACEMENT_LOCKED', 'The canonical placement is locked');

  const normalized = normalizeSystemWorkflowPresentation(presentation);
  if (samePresentation(systemWorkflowPlacementPresentation(placement), normalized)) return null;
  placement.frameId = normalized.frameId;
  placement.mat = normalized.mat;
  placement.backing = normalized.backing;
  placement.transparencyMode = normalized.transparencyMode;
  return assertValidSystemWorkflowDraft(draft);
}
