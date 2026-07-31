import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
import { createLatticeProductionCropCandidate } from '../lattice/authoring/latticeProductionCrop.js';
import {
  createLatticeProductionDuplicateCandidate,
  createLatticeProductionGroupDuplicateCandidate,
} from '../lattice/authoring/latticeProductionDuplicate.js';
import { createLatticeProductionLayerCandidate, createLatticeProductionLayerReorderCandidate } from '../lattice/authoring/latticeProductionLayer.js';
import { createLatticeProductionPlacementCandidate } from '../lattice/authoring/latticeProductionPlacement.js';
import {
  createLatticeProductionGroupMovementCandidate,
  createLatticeProductionMovementCandidate,
} from '../lattice/authoring/latticeProductionMovement.js';
import {
  createLatticeProductionGroupRemovalCandidate,
  createLatticeProductionRemovalCandidate,
} from '../lattice/authoring/latticeProductionRemoval.js';
import {
  createLatticeProductionGroupResizeCandidate,
  createLatticeProductionResizeCandidate,
} from '../lattice/authoring/latticeProductionResize.js';
import {
  createLatticeProductionGroupTransformCandidate,
  createLatticeProductionTransformCandidate,
} from '../lattice/authoring/latticeProductionTransform.js';
import { adaptLatticeProductionBrowserAsset } from '../lattice/browser/latticeProductionBrowserAdapter.js';
import {
  LATTICE_PRODUCTION_RECORD_STATUS,
  createLatticeProductionDraftStore,
} from '../lattice/storage/latticeProductionDraftStore.js';

export const OWNER_LATTICE_AUTHORING_STATUS = Object.freeze({
  READY: 'ready',
  CORRUPT: 'corrupt',
  ERROR: 'error',
});
const EMPTY_ASSET_RECORDS = Object.freeze([]);

export function resolveOwnerLatticeAuthoringStorage(options = {}, environment = globalThis) {
  if (Object.hasOwn(options, 'storage')) return options.storage;
  try { return environment.localStorage; }
  catch { return null; }
}

export function ownerLatticePlacementUnavailableReason({ activeTable, authoringStatus, profileReady } = {}) {
  if (authoringStatus === OWNER_LATTICE_AUTHORING_STATUS.CORRUPT) {
    return 'CANONICAL STORAGE CORRUPT / RECOVERY REQUIRED';
  }
  if (!activeTable) return 'CANONICAL DRAFT UNAVAILABLE';
  if (activeTable.visibility === 'PRIVATE') return 'PUBLIC PLACEMENT UNAVAILABLE / PRIVATE TABLE';
  return profileReady ? null : 'ASSET PROFILE RESOLVING';
}

export function shouldLoadOwnerLatticeAssets({ libraryStatus, profileReady, referencedAssetCount } = {}) {
  return Boolean(profileReady && libraryStatus === 'idle'
    && Number.isSafeInteger(referencedAssetCount) && referencedAssetCount > 0);
}

export function createOwnerLatticeAuthoringSession({ generatePlacementId, profileAddress, storage } = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid owner authoring profile is required');
  const store = createLatticeProductionDraftStore({ profileAddress: profile, storage });
  const classification = store.classifyForReconciliation();
  if (classification.status === LATTICE_PRODUCTION_RECORD_STATUS.CORRUPT) {
    return Object.freeze({
      commitCrop: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitDuplicate: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitGroupDuplicate: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitLayer: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitLayerReorder: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitGroupMovement: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitMovement: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitPlacement: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitGroupRemoval: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitGroupResize: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitRemoval: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitResize: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitGroupTransform: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitTransform: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      getDraft: () => null,
      getProfileAddress: () => profile,
      status: OWNER_LATTICE_AUTHORING_STATUS.CORRUPT,
    });
  }

  return Object.freeze({
    commitGroupDuplicate({ expectedPlacements, placementIds, tableId } = {}) {
      const currentDraft = store.getDraft();
      let candidate;
      try {
        candidate = createLatticeProductionGroupDuplicateCandidate(currentDraft, {
          expectedPlacements, generatePlacementId, placementIds, tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID GROUP DUPLICATE' });
      }
      if (!store.commitCompletedOperation(candidate.draft)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft(), placementIds: candidate.placementIds });
    },
    commitGroupMovement({ assetRecords, moves, tableId } = {}) {
      const currentDraft = store.getDraft();
      const activeTable = currentDraft.tables.find((table) => table.id === tableId);
      if (!activeTable) return Object.freeze({ ok: false, reason: 'CANONICAL DRAFT UNAVAILABLE' });
      let candidate;
      try {
        candidate = createLatticeProductionGroupMovementCandidate(currentDraft, { moves, tableId });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID GROUP MOVEMENT' });
      }
      if (!candidate) return Object.freeze({ ok: false, noOp: true, reason: 'PLACEMENT POSITIONS UNCHANGED' });
      const records = new Map((Array.isArray(assetRecords) ? assetRecords : []).map((record) => [record?.id, record]));
      for (const move of moves) {
        const placement = activeTable.placements.find(({ id }) => id === move.placementId);
        const asset = adaptLatticeProductionBrowserAsset(records.get(placement?.stableAssetId), profile);
        if (!asset?.placeable || asset.stableAssetId !== placement?.stableAssetId) return Object.freeze({
          ok: false,
          reason: asset?.placementUnavailableReason || 'STALE OR UNAVAILABLE ASSET',
        });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitDuplicate({ expectedPlacement, placementId, tableId } = {}) {
      const currentDraft = store.getDraft();
      let candidate;
      try {
        candidate = createLatticeProductionDuplicateCandidate(currentDraft, {
          expectedPlacement, generatePlacementId, placementId, tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT DUPLICATE' });
      }
      if (!store.commitCompletedOperation(candidate.draft)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft(), placementId: candidate.placementId });
    },
    commitCrop({
      assetRecord,
      crop,
      expectedMedia,
      expectedPlacement,
      placementId,
      tableId,
    } = {}) {
      const currentDraft = store.getDraft();
      const activeTable = currentDraft.tables.find((table) => table.id === tableId);
      if (!activeTable) return Object.freeze({ ok: false, reason: 'CANONICAL DRAFT UNAVAILABLE' });
      const placement = activeTable.placements.find((candidate) => candidate.id === placementId);
      if (!placement) return Object.freeze({ ok: false, reason: 'CANONICAL PLACEMENT UNAVAILABLE' });
      const asset = adaptLatticeProductionBrowserAsset(assetRecord, profile);
      if (!asset?.placeable) return Object.freeze({
        ok: false,
        reason: asset?.placementUnavailableReason || 'STALE OR UNAVAILABLE ASSET',
      });
      let candidate;
      try {
        candidate = createLatticeProductionCropCandidate(currentDraft, {
          crop,
          expectedMedia,
          expectedPlacement,
          media: asset,
          placementId,
          tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT CROP' });
      }
      if (!candidate) return Object.freeze({ ok: false, noOp: true, reason: 'PLACEMENT CROP UNCHANGED' });
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitLayer({
      assetRecords,
      expectedPlacement,
      expectedPlacements,
      operation,
      placementId,
      tableId,
    } = {}) {
      const currentDraft = store.getDraft();
      const activeTable = currentDraft.tables.find((table) => table.id === tableId);
      if (!activeTable) return Object.freeze({ ok: false, reason: 'CANONICAL DRAFT UNAVAILABLE' });
      if (activeTable.visibility !== 'PUBLIC') return Object.freeze({
        ok: false, reason: 'PLACEMENT LAYER UNAVAILABLE / PRIVATE TABLE',
      });
      const placement = activeTable.placements.find((candidate) => candidate.id === placementId);
      if (!placement) return Object.freeze({ ok: false, reason: 'CANONICAL PLACEMENT UNAVAILABLE' });
      if (placement.visibility !== 'PUBLIC') return Object.freeze({
        ok: false, reason: 'PRIVATE PLACEMENT UNAVAILABLE',
      });
      if (placement.locked) return Object.freeze({ ok: false, reason: 'PLACEMENT LOCKED' });
      let candidate;
      try {
        candidate = createLatticeProductionLayerCandidate(currentDraft, {
          expectedPlacement,
          expectedPlacements,
          operation,
          placementId,
          tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT LAYER' });
      }
      if (!candidate) return Object.freeze({ ok: false, noOp: true, reason: 'PLACEMENT LAYER UNCHANGED' });
      const records = new Map((Array.isArray(assetRecords) ? assetRecords : []).map((record) => [record?.id, record]));
      for (const publicPlacement of activeTable.placements.filter(({ visibility }) => visibility === 'PUBLIC')) {
        const asset = adaptLatticeProductionBrowserAsset(records.get(publicPlacement.stableAssetId), profile);
        if (!asset?.placeable || asset.stableAssetId !== publicPlacement.stableAssetId) return Object.freeze({
          ok: false,
          reason: asset?.placementUnavailableReason || 'STALE OR UNAVAILABLE ASSET',
        });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitLayerReorder({ expectedPlacements, orderedPlacementIds, tableId } = {}) {
      const currentDraft = store.getDraft();
      let candidate;
      try {
        candidate = createLatticeProductionLayerReorderCandidate(currentDraft, {
          expectedPlacements, orderedPlacementIds, tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID LAYER ORDER' });
      }
      if (!candidate) return Object.freeze({ ok: false, noOp: true, reason: 'LAYER ORDER UNCHANGED' });
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitPlacement({ assetRecord, destination, tableId } = {}) {
      const asset = adaptLatticeProductionBrowserAsset(assetRecord, profile);
      if (!asset?.placeable) return Object.freeze({
        ok: false,
        reason: asset?.placementUnavailableReason || 'STALE OR UNAVAILABLE ASSET',
      });
      const currentDraft = store.getDraft();
      const activeTable = currentDraft.tables.find((table) => table.id === tableId);
      if (!activeTable) return Object.freeze({ ok: false, reason: 'CANONICAL DRAFT UNAVAILABLE' });
      if (activeTable.visibility === 'PRIVATE') return Object.freeze({
        ok: false,
        reason: 'PUBLIC PLACEMENT UNAVAILABLE / PRIVATE TABLE',
      });
      let candidate;
      try {
        candidate = createLatticeProductionPlacementCandidate(currentDraft, {
          generatePlacementId,
          destination,
          nativeHeight: asset.height,
          nativeWidth: asset.width,
          stableAssetId: asset.stableAssetId,
          tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT' });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitMovement({
      assetRecord,
      destination,
      expectedStartGeometry,
      placementId,
      tableId,
    } = {}) {
      const currentDraft = store.getDraft();
      const activeTable = currentDraft.tables.find((table) => table.id === tableId);
      if (!activeTable) return Object.freeze({ ok: false, reason: 'CANONICAL DRAFT UNAVAILABLE' });
      if (activeTable.visibility !== 'PUBLIC') return Object.freeze({
        ok: false, reason: 'PLACEMENT MOVE UNAVAILABLE / PRIVATE TABLE',
      });
      const placement = activeTable.placements.find((candidate) => candidate.id === placementId);
      if (!placement) return Object.freeze({ ok: false, reason: 'CANONICAL PLACEMENT UNAVAILABLE' });
      if (placement.visibility !== 'PUBLIC') return Object.freeze({
        ok: false, reason: 'PRIVATE PLACEMENT UNAVAILABLE',
      });
      if (placement.locked) return Object.freeze({ ok: false, reason: 'PLACEMENT LOCKED' });
      const asset = adaptLatticeProductionBrowserAsset(assetRecord, profile);
      if (!asset?.placeable || asset.stableAssetId !== placement.stableAssetId) return Object.freeze({
        ok: false,
        reason: asset?.placementUnavailableReason || 'STALE OR UNAVAILABLE ASSET',
      });
      let candidate;
      try {
        candidate = createLatticeProductionMovementCandidate(currentDraft, {
          destination,
          expectedStartGeometry,
          placementId,
          tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT MOVEMENT' });
      }
      if (!candidate) return Object.freeze({ ok: false, noOp: true, reason: 'PLACEMENT POSITION UNCHANGED' });
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitResize({
      assetRecord,
      corner,
      destination,
      expectedPlacement,
      placementId,
      tableId,
    } = {}) {
      const currentDraft = store.getDraft();
      const activeTable = currentDraft.tables.find((table) => table.id === tableId);
      if (!activeTable) return Object.freeze({ ok: false, reason: 'CANONICAL DRAFT UNAVAILABLE' });
      if (activeTable.visibility !== 'PUBLIC') return Object.freeze({
        ok: false, reason: 'PLACEMENT RESIZE UNAVAILABLE / PRIVATE TABLE',
      });
      const placement = activeTable.placements.find((candidate) => candidate.id === placementId);
      if (!placement) return Object.freeze({ ok: false, reason: 'CANONICAL PLACEMENT UNAVAILABLE' });
      if (placement.visibility !== 'PUBLIC') return Object.freeze({
        ok: false, reason: 'PRIVATE PLACEMENT UNAVAILABLE',
      });
      if (placement.locked) return Object.freeze({ ok: false, reason: 'PLACEMENT LOCKED' });
      const asset = adaptLatticeProductionBrowserAsset(assetRecord, profile);
      if (!asset?.placeable || asset.stableAssetId !== placement.stableAssetId) return Object.freeze({
        ok: false,
        reason: asset?.placementUnavailableReason || 'STALE OR UNAVAILABLE ASSET',
      });
      let candidate;
      try {
        candidate = createLatticeProductionResizeCandidate(currentDraft, {
          corner,
          destination,
          expectedPlacement,
          placementId,
          tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT RESIZE' });
      }
      if (!candidate) return Object.freeze({ ok: false, noOp: true, reason: 'PLACEMENT SIZE UNCHANGED' });
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitGroupResize({
      assetRecords,
      corner,
      destinations,
      expectedPlacements,
      placementIds,
      tableId,
    } = {}) {
      const currentDraft = store.getDraft();
      const activeTable = currentDraft.tables.find((table) => table.id === tableId);
      if (!activeTable) return Object.freeze({ ok: false, reason: 'CANONICAL DRAFT UNAVAILABLE' });
      let candidate;
      try {
        candidate = createLatticeProductionGroupResizeCandidate(currentDraft, {
          corner, destinations, expectedPlacements, placementIds, tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID GROUP RESIZE' });
      }
      if (!candidate) return Object.freeze({ ok: false, noOp: true, reason: 'PLACEMENT SIZES UNCHANGED' });
      const records = new Map((Array.isArray(assetRecords) ? assetRecords : []).map((record) => [record?.id, record]));
      for (const placementId of placementIds) {
        const placement = activeTable.placements.find(({ id }) => id === placementId);
        const asset = adaptLatticeProductionBrowserAsset(records.get(placement?.stableAssetId), profile);
        if (!asset?.placeable || asset.stableAssetId !== placement?.stableAssetId) return Object.freeze({
          ok: false,
          reason: asset?.placementUnavailableReason || 'STALE OR UNAVAILABLE ASSET',
        });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitRemoval({ expectedPlacement, placementId, tableId } = {}) {
      const currentDraft = store.getDraft();
      let candidate;
      try {
        candidate = createLatticeProductionRemovalCandidate(currentDraft, {
          expectedPlacement,
          placementId,
          tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT REMOVAL' });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitGroupRemoval({ expectedPlacements, placementIds, tableId } = {}) {
      const currentDraft = store.getDraft();
      let candidate;
      try {
        candidate = createLatticeProductionGroupRemovalCandidate(currentDraft, {
          expectedPlacements, placementIds, tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID GROUP REMOVAL' });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitTransform({ expectedPlacement, operation, placementId, tableId } = {}) {
      const currentDraft = store.getDraft();
      let candidate;
      try {
        candidate = createLatticeProductionTransformCandidate(currentDraft, {
          expectedPlacement, operation, placementId, tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID PLACEMENT TRANSFORM' });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    commitGroupTransform({ expectedPlacements, operation, placementIds, tableId } = {}) {
      const currentDraft = store.getDraft();
      let candidate;
      try {
        candidate = createLatticeProductionGroupTransformCandidate(currentDraft, {
          expectedPlacements, operation, placementIds, tableId,
        });
      } catch (error) {
        return Object.freeze({ ok: false, reason: error?.message || 'INVALID GROUP TRANSFORM' });
      }
      if (!store.commitCompletedOperation(candidate)) {
        return Object.freeze({ ok: false, reason: 'CANONICAL STORAGE WRITE FAILED' });
      }
      return Object.freeze({ ok: true, draft: store.getDraft() });
    },
    getDraft: () => store.getDraft(),
    getProfileAddress: () => profile,
    status: OWNER_LATTICE_AUTHORING_STATUS.READY,
  });
}

export default function useOwnerLatticeAuthoring(profileAddress, options = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  const storageRef = useRef(resolveOwnerLatticeAuthoringStorage(options));
  const libraryProfileAddress = useLibraryStore((state) => state.profileAddress);
  const workspaceProfileAddress = useLibraryStore((state) => state.workspace?.profileAddress);
  const assets = useLibraryStore((state) => state.assets);
  const libraryStatus = useLibraryStore((state) => state.status);
  const load = useLibraryStore((state) => state.load);
  const generationRef = useRef(0);
  const session = useMemo(
    () => profile ? createOwnerLatticeAuthoringSession({ profileAddress: profile, storage: storageRef.current }) : null,
    [profile],
  );
  const [runtime, setRuntime] = useState(() => ({
    draft: session?.getDraft() || null,
    error: null,
    status: session?.status || OWNER_LATTICE_AUTHORING_STATUS.ERROR,
  }));

  useEffect(() => {
    generationRef.current += 1;
    setRuntime({
      draft: session?.getDraft() || null,
      error: null,
      status: session?.status || OWNER_LATTICE_AUTHORING_STATUS.ERROR,
    });
  }, [session]);

  const profileReady = Boolean(profile && libraryProfileAddress === profile
    && normalizeProfileAddress(workspaceProfileAddress) === profile);
  const referencedIds = useMemo(() => new Set(
    (runtime.draft?.tables || []).flatMap((table) => table.placements.map(({ stableAssetId }) => stableAssetId)),
  ), [runtime.draft]);
  const currentIds = useMemo(() => new Set(assets.map(({ id }) => id)), [assets]);
  const missingReferencedAssets = [...referencedIds].some((id) => !currentIds.has(id));

  useEffect(() => {
    if (shouldLoadOwnerLatticeAssets({ libraryStatus, profileReady, referencedAssetCount: referencedIds.size })) load();
  }, [libraryStatus, load, profileReady, referencedIds]);

  const placePublicAsset = useCallback(({ destination, stableAssetId, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      const reason = 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE';
      setRuntime((current) => ({ ...current, error: reason }));
      return false;
    }
    const assetRecord = liveLibrary.assets.find(({ id }) => id === stableAssetId);
    const result = session.commitPlacement({ assetRecord, destination, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const cropPublicPlacement = useCallback(({
    crop,
    expectedMedia,
    expectedPlacement,
    placementId,
    tableId,
  } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      const reason = 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE';
      setRuntime((current) => ({ ...current, error: reason }));
      return false;
    }
    const runtimePlacement = runtime.draft?.tables.find((table) => table.id === tableId)
      ?.placements.find((placement) => placement.id === placementId);
    const assetRecord = liveLibrary.assets.find(({ id }) => id === runtimePlacement?.stableAssetId);
    const result = session.commitCrop({
      assetRecord,
      crop,
      expectedMedia,
      expectedPlacement,
      placementId,
      tableId,
    });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      if (!result.noOp) setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, runtime.draft, session]);

  const duplicatePublicPlacement = useCallback(({ expectedPlacement, placementId, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return null;
    }
    const result = session.commitDuplicate({ expectedPlacement, placementId, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return null;
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return null;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return result.placementId;
  }, [profile, session]);

  const duplicatePublicPlacements = useCallback(({ expectedPlacements, placementIds, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return [];
    }
    const result = session.commitGroupDuplicate({ expectedPlacements, placementIds, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return [];
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return [];
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return [...result.placementIds];
  }, [profile, session]);

  const movePublicPlacement = useCallback(({
    destination,
    expectedStartGeometry,
    placementId,
    tableId,
  } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      const reason = 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE';
      setRuntime((current) => ({ ...current, error: reason }));
      return false;
    }
    const runtimePlacement = runtime.draft?.tables.find((table) => table.id === tableId)
      ?.placements.find((placement) => placement.id === placementId);
    const assetRecord = liveLibrary.assets.find(({ id }) => id === runtimePlacement?.stableAssetId);
    const result = session.commitMovement({
      assetRecord,
      destination,
      expectedStartGeometry,
      placementId,
      tableId,
    });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      if (!result.noOp) setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, runtime.draft, session]);

  const movePublicPlacements = useCallback(({ moves, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return false;
    }
    const result = session.commitGroupMovement({ assetRecords: liveLibrary.assets, moves, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      if (!result.noOp) setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const layerPublicPlacement = useCallback(({
    expectedPlacement,
    expectedPlacements,
    operation,
    placementId,
    tableId,
  } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      const reason = 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE';
      setRuntime((current) => ({ ...current, error: reason }));
      return false;
    }
    const result = session.commitLayer({
      assetRecords: liveLibrary.assets,
      expectedPlacement,
      expectedPlacements,
      operation,
      placementId,
      tableId,
    });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      if (!result.noOp) setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const reorderPublicPlacements = useCallback(({ expectedPlacements, orderedPlacementIds, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return false;
    }
    const result = session.commitLayerReorder({ expectedPlacements, orderedPlacementIds, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      if (!result.noOp) setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const resizePublicPlacement = useCallback(({
    corner,
    destination,
    expectedPlacement,
    placementId,
    tableId,
  } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      const reason = 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE';
      setRuntime((current) => ({ ...current, error: reason }));
      return false;
    }
    const runtimePlacement = runtime.draft?.tables.find((table) => table.id === tableId)
      ?.placements.find((placement) => placement.id === placementId);
    const assetRecord = liveLibrary.assets.find(({ id }) => id === runtimePlacement?.stableAssetId);
    const result = session.commitResize({
      assetRecord,
      corner,
      destination,
      expectedPlacement,
      placementId,
      tableId,
    });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      if (!result.noOp) setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, runtime.draft, session]);

  const resizePublicPlacements = useCallback(({
    corner,
    destinations,
    expectedPlacements,
    placementIds,
    tableId,
  } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return false;
    }
    const result = session.commitGroupResize({
      assetRecords: liveLibrary.assets,
      corner,
      destinations,
      expectedPlacements,
      placementIds,
      tableId,
    });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      if (!result.noOp) setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const removePublicPlacement = useCallback(({
    expectedPlacement,
    placementId,
    tableId,
  } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      const reason = 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE';
      setRuntime((current) => ({ ...current, error: reason }));
      return false;
    }
    const result = session.commitRemoval({ expectedPlacement, placementId, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const removePublicPlacements = useCallback(({ expectedPlacements, placementIds, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile
      || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return false;
    }
    const result = session.commitGroupRemoval({ expectedPlacements, placementIds, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const transformPublicPlacement = useCallback(({ expectedPlacement, operation, placementId, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return false;
    }
    const result = session.commitTransform({ expectedPlacement, operation, placementId, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  const transformPublicPlacements = useCallback(({ expectedPlacements, operation, placementIds, tableId } = {}) => {
    const generation = generationRef.current;
    const liveLibrary = useLibraryStore.getState();
    if (!session || session.status !== OWNER_LATTICE_AUTHORING_STATUS.READY
      || session.getProfileAddress() !== profile || liveLibrary.profileAddress !== profile
      || normalizeProfileAddress(liveLibrary.workspace?.profileAddress) !== profile) {
      setRuntime((current) => ({ ...current, error: 'STALE PROFILE OR CANONICAL STORAGE UNAVAILABLE' }));
      return false;
    }
    const result = session.commitGroupTransform({ expectedPlacements, operation, placementIds, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
  }, [profile, session]);

  return {
    assetRecords: profileReady ? assets : EMPTY_ASSET_RECORDS,
    cropPublicPlacement,
    duplicatePublicPlacement,
    duplicatePublicPlacements,
    draft: runtime.draft,
    error: runtime.error,
    layerPublicPlacement,
    missingReferencedAssets,
    movePublicPlacement,
    movePublicPlacements,
    placePublicAsset,
    profileReady,
    reorderPublicPlacements,
    removePublicPlacement,
    removePublicPlacements,
    resizePublicPlacement,
    resizePublicPlacements,
    status: runtime.status,
    transformPublicPlacement,
    transformPublicPlacements,
  };
}
