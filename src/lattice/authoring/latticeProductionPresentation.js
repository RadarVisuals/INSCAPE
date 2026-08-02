import {
  LATTICE_PRODUCTION_FRAME_IDS,
  LATTICE_PRODUCTION_TRANSPARENCY_MODES,
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from '../domain/latticeProductionDraft.js';
import {
  ARTWORK_MAT_INSET_MAX,
  normalizeArtworkBacking,
  normalizeArtworkMat,
} from '../rendering/latticeMat.js';
import { sameLatticeProductionPlacementSnapshot } from './latticeProductionRemoval.js';

const FRAME_IDS = new Set(LATTICE_PRODUCTION_FRAME_IDS);
const TRANSPARENCY_MODES = new Set(LATTICE_PRODUCTION_TRANSPARENCY_MODES);
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

export function normalizeLatticeProductionPresentation(value) {
  if (!exactKeys(value, PRESENTATION_KEYS)) {
    throw presentationError('LATTICE_PRESENTATION_VALUE_INVALID', 'Placement presentation requires canonical frame, mat, backing, and transparency values');
  }
  if (!FRAME_IDS.has(value.frameId)) {
    throw presentationError('LATTICE_PRESENTATION_FRAME_INVALID', 'Unknown placement frame ID');
  }
  if (!TRANSPARENCY_MODES.has(value.transparencyMode)) {
    throw presentationError('LATTICE_PRESENTATION_TRANSPARENCY_INVALID', 'Unknown placement transparency mode');
  }
  const insets = value.mat?.inset;
  if (!exactKeys(insets, INSET_KEYS) || INSET_KEYS.some((edge) => !Number.isFinite(insets[edge]))) {
    throw presentationError('LATTICE_PRESENTATION_MAT_INSET_INVALID', 'Artwork mat insets must be finite values from 0 to 0.45');
  }
  if (insets.left + insets.right >= 1 || insets.top + insets.bottom >= 1) {
    throw presentationError('LATTICE_PRESENTATION_MAT_INSET_SUM_INVALID', 'Opposing artwork mat insets must sum to less than one');
  }
  if (INSET_KEYS.some((edge) => insets[edge] < 0 || insets[edge] > ARTWORK_MAT_INSET_MAX)) {
    throw presentationError('LATTICE_PRESENTATION_MAT_INSET_INVALID', 'Artwork mat insets must be finite values from 0 to 0.45');
  }
  let mat;
  let backing;
  try {
    mat = normalizeArtworkMat(value.mat);
    backing = normalizeArtworkBacking(value.backing);
  } catch (error) {
    throw presentationError('LATTICE_PRESENTATION_COLOR_INVALID', error?.message || 'Placement presentation colors are invalid');
  }
  return {
    frameId: value.frameId,
    mat,
    backing,
    transparencyMode: value.transparencyMode,
  };
}

export function latticeProductionPlacementPresentation(placement) {
  return normalizeLatticeProductionPresentation({
    frameId: placement?.frameId,
    mat: placement?.mat,
    backing: placement?.backing,
    transparencyMode: placement?.transparencyMode,
  });
}

function samePresentation(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createLatticeProductionPresentationCandidate(draftInput, {
  expectedPlacement,
  placementId,
  presentation,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw presentationError('LATTICE_PRESENTATION_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw presentationError('LATTICE_PRESENTATION_TABLE_PRIVATE', 'Placement presentation is unavailable on a private table');
  }
  const placement = table.placements.find((candidate) => candidate.id === placementId);
  if (!placement) throw presentationError('LATTICE_PRESENTATION_PLACEMENT_UNKNOWN', 'The canonical placement does not exist');
  if (!sameLatticeProductionPlacementSnapshot(placement, expectedPlacement)) {
    throw presentationError('LATTICE_PRESENTATION_PLACEMENT_STALE', 'The canonical placement changed before presentation editing completed');
  }
  if (placement.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw presentationError('LATTICE_PRESENTATION_PLACEMENT_PRIVATE', 'Private placements cannot be edited through the public owner projection');
  }
  if (placement.locked) throw presentationError('LATTICE_PRESENTATION_PLACEMENT_LOCKED', 'The canonical placement is locked');

  const normalized = normalizeLatticeProductionPresentation(presentation);
  if (samePresentation(latticeProductionPlacementPresentation(placement), normalized)) return null;
  placement.frameId = normalized.frameId;
  placement.mat = normalized.mat;
  placement.backing = normalized.backing;
  placement.transparencyMode = normalized.transparencyMode;
  return assertValidLatticeProductionDraft(draft);
}
