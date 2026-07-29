import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushLibraryWorkspace, useLibraryStore } from '../library/index.js';
import { flushSignalDocument } from '../signals/state/useSignalStore.js';
import { useProfileDocumentStore } from '../profileDocument/state/useProfileDocumentStore.js';
import { reportControlledError } from '../diagnostics.js';
import { createProfileDocumentRestorePlan } from '../profileDocument/domain/profileDocumentRestore.js';
import { ownerProfileDocumentReconciliationFingerprint, profileDocumentContentFingerprint, profileDocumentReconciliationFingerprint } from '../profileDocument/domain/profileDocumentSerialization.js';
import { decideOwnerPublicationReconciliation, executeOwnerPublicationReconciliationTransaction, isWorkspacePublicProjectionEmpty, OWNER_RECONCILIATION_ACTION } from '../profileDocument/domain/ownerPublicationReconciliation.js';
import { canonicalPublicationHash, publicationContentFingerprint } from '../profileDocument/domain/profileDocumentPublication.js';
import { profilePresentationKey, saveRestoredPresentation } from '../profileDocument/storage/profilePresentationStorage.js';
import { loadOwnerPublicationBaseline, ownerPublicationBaselineKey, publicationPointerMetadata, saveOwnerPublicationBaseline } from '../profileDocument/storage/ownerPublicationBaselineStorage.js';
import { normalizeProfileAddress } from '../library/config.js';
import { encodeModuleLayout, MODULE_LAYOUT_STORAGE_KEY, SYSTEM_PRESENTATION_STORAGE_KEY } from './moduleLayout.js';
import { ownerProfileStorageKey, writeOwnerProfileValue } from './ownerProfileStorage.js';
import { libraryWorkspaceKey } from '../library/storage/libraryWorkspaceStorage.js';
import { signalStorageKey } from '../signals/storage/signalStorage.js';
import { PROFILE_DOCUMENT_VERSION_8 } from '../profileDocument/domain/constants.js';
import { createLatticeProductionDraftStore } from '../lattice/storage/latticeProductionDraftStore.js';
import { createOwnerReconciliationRuntimeOperations, reportOwnerPublicationReconciliationError } from './ownerPublicationReconciliationRuntime.js';

function captureRawValue(storage, key) {
  const value = storage.getItem(key);
  return Object.freeze({ key, present: value !== null, value });
}

function restoreRawValue(storage, checkpoint) {
  try {
    if (checkpoint.present) storage.setItem(checkpoint.key, checkpoint.value);
    else storage.removeItem(checkpoint.key);
    return true;
  } catch { return false; }
}

export function useOwnerPublicationSync({
  activeActorId,
  avatarShape,
  draftDocument,
  effectivePublishedResolution,
  environment,
  geometry,
  getWalletPublicationContext,
  onApplyRestoredPresentation,
  onPublicationConfirmed,
  ownerAuthoringEnabled,
  positions,
  publicationProfileAddress,
  replaceSignalSettings,
  replaceWorkspace,
  saveSystemPresentation,
  setAvatarShape,
  setPositions,
  setSystemPresentation,
  setVisitorNavigation,
  signalSettings,
  stageId,
  systemPresentation,
  visitorNavigation,
  viewedProfileAddress,
  workspace,
  workspaceRecordRef
}) {
  const [publicationReconciliation, setPublicationReconciliation] = useState({
    profileAddress: null,
    publishedFingerprint: null,
    status: 'pending'
  });
  const [confirmedPublication, setConfirmedPublication] = useState(null);
  const [draftSaveState, setDraftSaveState] = useState(() => ({
    profileAddress: workspace.profileAddress,
    status: 'saving'
  }));
  const latticeStoreRef = useRef(null);
  const draftFingerprint = useMemo(() => profileDocumentContentFingerprint(draftDocument), [draftDocument]);
  const reconciliationFingerprint = useMemo(() => profileDocumentReconciliationFingerprint(draftDocument), [draftDocument]);
  const draftGenerationRef = useRef({ fingerprint: draftFingerprint, generation: 0 });
  if (draftGenerationRef.current.fingerprint !== draftFingerprint) {
    draftGenerationRef.current = {
      fingerprint: draftFingerprint,
      generation: draftGenerationRef.current.generation + 1
    };
  }

  const publishedResolution = confirmedPublication?.profileAddress === workspace.profileAddress
    ? confirmedPublication.resolution
    : effectivePublishedResolution;

  useLayoutEffect(() => {
    const profileAddress = normalizeProfileAddress(publicationProfileAddress);
    if (!profileAddress) return;
    setPublicationReconciliation({ profileAddress, publishedFingerprint: null, status: 'pending' });
    setConfirmedPublication(null);
  }, [publicationProfileAddress]);

  const persistOwnerDraft = useCallback(() => {
    const librarySaved = flushLibraryWorkspace();
    const signalsSaved = flushSignalDocument();
    const presentationSaved = saveRestoredPresentation(window.localStorage, workspace.profileAddress, {
      keeperId: activeActorId, stageId, environment, avatarShape, visitorNavigation
    });
    let layoutSaved = true;
    if (!geometry.narrow) {
      layoutSaved = writeOwnerProfileValue(window.localStorage, MODULE_LAYOUT_STORAGE_KEY, workspace.profileAddress, encodeModuleLayout(positions));
      if (!layoutSaved) reportControlledError('module-grid-layout-persist', new Error('Could not save the profile-scoped module layout'));
    }
    const systemPresentationSaved = saveSystemPresentation(workspace.profileAddress, systemPresentation);
    if (!systemPresentationSaved) reportControlledError('system-presentation-persist', new Error('Could not save the profile-scoped system presentation'));
    const saved = librarySaved && signalsSaved && presentationSaved && layoutSaved && systemPresentationSaved;
    if (!saved) reportControlledError('owner-draft-persist', new Error('Could not save every owner draft source'));
    setDraftSaveState({ profileAddress: workspace.profileAddress, status: saved ? 'saved' : 'error' });
  }, [activeActorId, avatarShape, environment, geometry.narrow, positions, saveSystemPresentation, stageId, systemPresentation, visitorNavigation, workspace.profileAddress]);

  useEffect(() => {
    if (!ownerAuthoringEnabled || normalizeProfileAddress(publicationProfileAddress) !== workspace.profileAddress) return;
    const status = publishedResolution?.status;
    if (status === 'LOADING' || status === 'STALE' && publishedResolution?.busy) return;
    const publication = ['RESOLVED', 'STALE'].includes(status) ? publishedResolution?.document : null;
    const record = workspaceRecordRef.current.get(workspace.profileAddress) || { presence: 'unavailable' };
    if (!publication) {
      setPublicationReconciliation({
        profileAddress: workspace.profileAddress,
        publishedFingerprint: null,
        status: status === 'UNAVAILABLE' || record.presence !== 'absent' ? 'ready' : 'blocked'
      });
      return;
    }
    let activeLatticeStore = null;
    let localReconciliationFingerprint = reconciliationFingerprint;
    if (publication.version === PROFILE_DOCUMENT_VERSION_8) {
      try {
        activeLatticeStore = latticeStoreRef.current;
        if (!activeLatticeStore) {
          activeLatticeStore = createLatticeProductionDraftStore({ storage: window.localStorage, profileAddress: workspace.profileAddress });
          latticeStoreRef.current = activeLatticeStore;
        } else if (!activeLatticeStore.setProfileAddress(workspace.profileAddress)) {
          throw new Error('Could not activate the profile-scoped canonical lattice store');
        }
        if (activeLatticeStore.classifyForReconciliation().status === 'corrupt') {
          throw Object.assign(new Error('The canonical lattice record is corrupt and requires explicit recovery'), {
            code: 'OWNER_RECONCILIATION_CORRUPT_LATTICE',
          });
        }
        localReconciliationFingerprint = ownerProfileDocumentReconciliationFingerprint(
          draftDocument,
          activeLatticeStore.getDraft(),
        );
      } catch (error) {
        reportOwnerPublicationReconciliationError(error);
        setPublicationReconciliation({
          profileAddress: workspace.profileAddress,
          publishedFingerprint: null,
          status: 'blocked',
        });
        return;
      }
    }
    const publishedFingerprint = profileDocumentReconciliationFingerprint(publication);
    if (publicationReconciliation.profileAddress === workspace.profileAddress
      && publicationReconciliation.publishedFingerprint === publishedFingerprint
      && publicationReconciliation.status === 'ready') return;
    const baseline = loadOwnerPublicationBaseline(window.localStorage, workspace.profileAddress);
    let action = decideOwnerPublicationReconciliation({
      localRecordPresence: record.presence,
      localFingerprint: localReconciliationFingerprint,
      localPublicProjectionEmpty: isWorkspacePublicProjectionEmpty(workspace),
      baseline,
      publishedFingerprint
    });
    if (action === OWNER_RECONCILIATION_ACTION.CONFLICT) {
      const restorePublished = window.confirm('This browser contains a local INSCAPE draft that differs from the latest publication. Load the published public presentation? Private folders and private gallery artwork will be preserved. Select Cancel to keep this local draft.');
      action = restorePublished ? OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION : OWNER_RECONCILIATION_ACTION.KEEP_LOCAL;
    }
    if (action === OWNER_RECONCILIATION_ACTION.WAIT) return;
    const pointer = publicationPointerMetadata(publishedResolution?.pointer);
    const reconciliationGeneration = draftGenerationRef.current.generation;
    const getActiveProfileAddress = () => useLibraryStore.getState().workspace.profileAddress;
    const isGenerationCurrent = () => draftGenerationRef.current.generation === reconciliationGeneration;
    if (action === OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION) {
      try {
        const storage = window.localStorage;
        const latticeStore = publication.version === PROFILE_DOCUMENT_VERSION_8 ? activeLatticeStore : null;
        const plan = createProfileDocumentRestorePlan(publication, workspace, {
          currentLatticeDraft: latticeStore?.getDraft(),
        });
        const nextPositions = { ...positions };
        const nextSystemPresentation = { ...systemPresentation };
        Object.entries(plan.systemModules).forEach(([id, module]) => {
          if (module.placement) nextPositions[id] = module.placement;
          if (nextSystemPresentation[id]) nextSystemPresentation[id] = { ...nextSystemPresentation[id], ...module };
        });
        const encodedLayout = encodeModuleLayout(nextPositions);
        const baselineValue = {
          ...pointer, publishedFingerprint, localFingerprint: publishedFingerprint, hydratedAt: Date.now(),
        };
        const rawCheckpoints = {
          workspace: captureRawValue(storage, libraryWorkspaceKey(workspace.profileAddress)),
          signals: captureRawValue(storage, signalStorageKey(workspace.profileAddress)),
          presentation: captureRawValue(storage, profilePresentationKey(workspace.profileAddress)),
          layout: captureRawValue(storage, ownerProfileStorageKey(MODULE_LAYOUT_STORAGE_KEY, workspace.profileAddress)),
          systemPresentation: captureRawValue(storage, ownerProfileStorageKey(SYSTEM_PRESENTATION_STORAGE_KEY, workspace.profileAddress)),
          baseline: captureRawValue(storage, ownerPublicationBaselineKey(workspace.profileAddress)),
        };
        const previousWorkspace = structuredClone(workspace);
        const previousSignalSettings = { ...signalSettings };
        const runtimeOperations = createOwnerReconciliationRuntimeOperations({
          profileAddress: workspace.profileAddress,
          plan,
          nextPositions,
          nextSystemPresentation,
          current: {
            positions, systemPresentation, avatarShape, visitorNavigation,
            keeperId: activeActorId, stageId, environment,
          },
          adapters: {
            setPositions, setSystemPresentation, setAvatarShape, setVisitorNavigation,
            onApplyRestoredPresentation,
          },
          workspaceRecordRef,
        });
        executeOwnerPublicationReconciliationTransaction({
          profileAddress: workspace.profileAddress,
          getActiveProfileAddress,
          isGenerationCurrent,
          latticeStore,
          latticeDraft: plan.latticeDraft,
          compatibilityOperations: [
            {
              name: 'Library workspace',
              validate: () => normalizeProfileAddress(plan.workspace.profileAddress) === workspace.profileAddress,
              apply: () => replaceWorkspace(plan.workspace),
              compensate: () => {
                const persisted = restoreRawValue(storage, rawCheckpoints.workspace);
                const applied = normalizeProfileAddress(getActiveProfileAddress()) === workspace.profileAddress
                  && replaceWorkspace(previousWorkspace, { persist: false });
                return persisted && applied;
              },
            },
            {
              name: 'Signal settings',
              validate: () => plan.signalSettings && typeof plan.signalSettings === 'object',
              apply: () => replaceSignalSettings(plan.signalSettings),
              compensate: () => {
                const persisted = restoreRawValue(storage, rawCheckpoints.signals);
                const applied = normalizeProfileAddress(getActiveProfileAddress()) === workspace.profileAddress
                  && replaceSignalSettings(previousSignalSettings, { persist: false });
                return persisted && applied;
              },
            },
            {
              name: 'restored presentation',
              validate: () => Boolean(plan.keeperId && plan.stageId && plan.environment),
              apply: () => saveRestoredPresentation(storage, workspace.profileAddress, {
                keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment,
                avatarShape: plan.avatarShape, visitorNavigation: plan.visitorNavigation,
              }),
              compensate: () => restoreRawValue(storage, rawCheckpoints.presentation),
            },
            {
              name: 'module layout',
              validate: () => typeof encodedLayout === 'string',
              apply: () => writeOwnerProfileValue(storage, MODULE_LAYOUT_STORAGE_KEY, workspace.profileAddress, encodedLayout),
              compensate: () => restoreRawValue(storage, rawCheckpoints.layout),
            },
            {
              name: 'system presentation',
              validate: () => nextSystemPresentation && typeof nextSystemPresentation === 'object',
              apply: () => saveSystemPresentation(workspace.profileAddress, nextSystemPresentation),
              compensate: () => restoreRawValue(storage, rawCheckpoints.systemPresentation),
            },
          ],
          baselineOperation: {
            validate: () => Boolean(baselineValue.publishedFingerprint && baselineValue.localFingerprint),
            apply: () => saveOwnerPublicationBaseline(storage, workspace.profileAddress, baselineValue),
            compensate: () => restoreRawValue(storage, rawCheckpoints.baseline),
          },
          runtimeOperations,
        });
      } catch (error) {
        reportOwnerPublicationReconciliationError(error);
        setPublicationReconciliation({ profileAddress: workspace.profileAddress, publishedFingerprint, status: 'blocked' });
        return;
      }
    } else {
      try {
        const storage = window.localStorage;
        const checkpoint = captureRawValue(storage, ownerPublicationBaselineKey(workspace.profileAddress));
        const baselineValue = {
          ...pointer, publishedFingerprint, localFingerprint: localReconciliationFingerprint, hydratedAt: Date.now(),
        };
        executeOwnerPublicationReconciliationTransaction({
          profileAddress: workspace.profileAddress,
          getActiveProfileAddress,
          isGenerationCurrent,
          baselineOperation: {
            validate: () => Boolean(baselineValue.publishedFingerprint && baselineValue.localFingerprint),
            apply: () => saveOwnerPublicationBaseline(storage, workspace.profileAddress, baselineValue),
            compensate: () => restoreRawValue(storage, checkpoint),
          },
        });
      } catch (error) {
        reportOwnerPublicationReconciliationError(error);
        setPublicationReconciliation({ profileAddress: workspace.profileAddress, publishedFingerprint, status: 'blocked' });
        return;
      }
    }
    setPublicationReconciliation({ profileAddress: workspace.profileAddress, publishedFingerprint, status: 'ready' });
  }, [activeActorId, avatarShape, draftDocument, environment, onApplyRestoredPresentation, ownerAuthoringEnabled, positions, publicationProfileAddress, publicationReconciliation,
    publishedResolution, reconciliationFingerprint, replaceSignalSettings, replaceWorkspace, saveSystemPresentation, setAvatarShape, setPositions,
    setSystemPresentation, setVisitorNavigation, signalSettings, stageId, systemPresentation, visitorNavigation, workspace, workspaceRecordRef]);

  useEffect(() => {
    if (!ownerAuthoringEnabled || publicationReconciliation.status !== 'ready'
      || publicationReconciliation.profileAddress !== workspace.profileAddress) return undefined;
    setDraftSaveState({ profileAddress: workspace.profileAddress, status: 'saving' });
    const timeout = window.setTimeout(persistOwnerDraft, 240);
    return () => window.clearTimeout(timeout);
  }, [draftFingerprint, ownerAuthoringEnabled, persistOwnerDraft, publicationReconciliation, signalSettings, workspace]);

  useEffect(() => {
    if (!ownerAuthoringEnabled || publicationReconciliation.status !== 'ready'
      || publicationReconciliation.profileAddress !== workspace.profileAddress) return undefined;
    const flush = () => persistOwnerDraft();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [ownerAuthoringEnabled, persistOwnerDraft, publicationReconciliation, workspace.profileAddress]);

  const getPublicationContext = useCallback(() => {
    const wallet = getWalletPublicationContext?.() || {};
    const documentState = useProfileDocumentStore.getState();
    const liveWorkspaceAddress = useLibraryStore.getState().workspace.profileAddress;
    const documentContextMatches = documentState.profileAddress === normalizeProfileAddress(liveWorkspaceAddress);
    const liveSnapshot = documentContextMatches ? documentState.snapshot : null;
    const host = wallet.hostProfileAddress?.toLowerCase();
    const workspaceAddress = liveWorkspaceAddress?.toLowerCase();
    return {
      ...wallet,
      workspaceProfileAddress: liveWorkspaceAddress,
      viewedProfileAddress,
      snapshotGeneration: documentContextMatches ? documentState.snapshotGeneration : 0,
      snapshotArtifactHash: liveSnapshot ? canonicalPublicationHash(liveSnapshot) : null,
      snapshotContentFingerprint: liveSnapshot ? publicationContentFingerprint(liveSnapshot) : null,
      draftFingerprint: publicationContentFingerprint(draftDocument),
      draftGeneration: draftGenerationRef.current.generation,
      snapshotStale: Boolean(liveSnapshot && documentState.snapshotDraftFingerprint !== draftFingerprint),
      ownerAuthoringEnabled: Boolean(wallet.isHostProfileOwner && host && host === workspaceAddress && host === viewedProfileAddress?.toLowerCase())
    };
  }, [draftDocument, draftFingerprint, getWalletPublicationContext, viewedProfileAddress]);

  const handlePublicationConfirmed = useCallback((resolution) => {
    const profileAddress = normalizeProfileAddress(resolution?.document?.profile?.address);
    if (!profileAddress || profileAddress !== workspace.profileAddress) return;
    const fingerprint = profileDocumentReconciliationFingerprint(resolution.document);
    saveOwnerPublicationBaseline(window.localStorage, profileAddress, {
      ...publicationPointerMetadata(resolution.pointer),
      publishedFingerprint: fingerprint,
      localFingerprint: fingerprint,
      hydratedAt: Date.now()
    });
    setConfirmedPublication({ profileAddress, resolution: { ...resolution, status: 'RESOLVED', busy: false } });
    setPublicationReconciliation({ profileAddress, publishedFingerprint: fingerprint, status: 'ready' });
    onPublicationConfirmed?.();
  }, [onPublicationConfirmed, workspace.profileAddress]);

  return {
    draftFingerprint,
    draftSaveStatus: draftSaveState.profileAddress === workspace.profileAddress ? draftSaveState.status : 'saving',
    getPublicationContext,
    handlePublicationConfirmed
  };
}
