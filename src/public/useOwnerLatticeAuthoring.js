import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
import { createLatticeProductionPlacementCandidate } from '../lattice/authoring/latticeProductionPlacement.js';
import { createLatticeProductionMovementCandidate } from '../lattice/authoring/latticeProductionMovement.js';
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
const ADDITIONAL_PLACEMENT_UNAVAILABLE_REASON =
  'PLACE UNAVAILABLE / ADDITIONAL PLACEMENT REQUIRES NEXT AUTHORING SLICE';

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
  if (activeTable.placements.length > 0) {
    return ADDITIONAL_PLACEMENT_UNAVAILABLE_REASON;
  }
  return profileReady ? null : 'ASSET PROFILE RESOLVING';
}

export function createOwnerLatticeAuthoringSession({ profileAddress, storage } = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid owner authoring profile is required');
  const store = createLatticeProductionDraftStore({ profileAddress: profile, storage });
  const classification = store.classifyForReconciliation();
  if (classification.status === LATTICE_PRODUCTION_RECORD_STATUS.CORRUPT) {
    return Object.freeze({
      commitMovement: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      commitPlacement: () => Object.freeze({ ok: false, reason: 'CORRUPT CANONICAL STORAGE' }),
      getDraft: () => null,
      getProfileAddress: () => profile,
      status: OWNER_LATTICE_AUTHORING_STATUS.CORRUPT,
    });
  }

  return Object.freeze({
    commitPlacement({ assetRecord, tableId } = {}) {
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
      if (activeTable.placements.length > 0) return Object.freeze({
        ok: false,
        reason: ADDITIONAL_PLACEMENT_UNAVAILABLE_REASON,
      });
      let candidate;
      try {
        candidate = createLatticeProductionPlacementCandidate(currentDraft, {
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
    if (profileReady && missingReferencedAssets && libraryStatus === 'idle') load();
  }, [libraryStatus, load, missingReferencedAssets, profileReady]);

  const placePublicAsset = useCallback(({ stableAssetId, tableId } = {}) => {
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
    const result = session.commitPlacement({ assetRecord, tableId });
    if (generation !== generationRef.current || session.getProfileAddress() !== profile) return false;
    if (!result.ok) {
      setRuntime((current) => ({ ...current, error: result.reason }));
      return false;
    }
    setRuntime({ draft: result.draft, error: null, status: OWNER_LATTICE_AUTHORING_STATUS.READY });
    return true;
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

  return {
    assetRecords: profileReady ? assets : EMPTY_ASSET_RECORDS,
    draft: runtime.draft,
    error: runtime.error,
    missingReferencedAssets,
    movePublicPlacement,
    placePublicAsset,
    profileReady,
    status: runtime.status,
  };
}
