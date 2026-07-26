import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushLibraryWorkspace, useLibraryStore } from '../library/index.js';
import { flushSignalDocument } from '../signals/state/useSignalStore.js';
import { useProfileDocumentStore } from '../profileDocument/state/useProfileDocumentStore.js';
import { reportControlledError } from '../diagnostics.js';
import { createProfileDocumentRestorePlan } from '../profileDocument/domain/profileDocumentRestore.js';
import { profileDocumentContentFingerprint, profileDocumentReconciliationFingerprint } from '../profileDocument/domain/profileDocumentSerialization.js';
import { decideOwnerPublicationReconciliation, isWorkspacePublicProjectionEmpty, OWNER_RECONCILIATION_ACTION } from '../profileDocument/domain/ownerPublicationReconciliation.js';
import { canonicalPublicationHash, publicationContentFingerprint } from '../profileDocument/domain/profileDocumentPublication.js';
import { saveRestoredPresentation } from '../profileDocument/storage/profileDocumentStorage.js';
import { loadOwnerPublicationBaseline, publicationPointerMetadata, saveOwnerPublicationBaseline } from '../profileDocument/storage/ownerPublicationBaselineStorage.js';
import { normalizeProfileAddress } from '../library/config.js';
import { encodeModuleLayout, MODULE_LAYOUT_STORAGE_KEY } from './moduleLayout.js';
import { writeOwnerProfileValue } from './ownerProfileStorage.js';

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
    const publishedFingerprint = profileDocumentReconciliationFingerprint(publication);
    if (publicationReconciliation.profileAddress === workspace.profileAddress
      && publicationReconciliation.publishedFingerprint === publishedFingerprint
      && publicationReconciliation.status === 'ready') return;
    const baseline = loadOwnerPublicationBaseline(window.localStorage, workspace.profileAddress);
    let action = decideOwnerPublicationReconciliation({
      localRecordPresence: record.presence,
      localFingerprint: reconciliationFingerprint,
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
    if (action === OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION) {
      try {
        const plan = createProfileDocumentRestorePlan(publication, workspace);
        if (!replaceWorkspace(plan.workspace)) throw new Error('Could not persist the hydrated public workspace');
        if (!replaceSignalSettings(plan.signalSettings)) throw new Error('Could not persist hydrated Activity settings');
        if (!saveRestoredPresentation(window.localStorage, workspace.profileAddress, {
          keeperId: plan.keeperId,
          stageId: plan.stageId,
          environment: plan.environment,
          avatarShape: plan.avatarShape,
          visitorNavigation: plan.visitorNavigation
        })) throw new Error('Could not persist hydrated profile presentation');
        const nextPositions = { ...positions };
        const nextSystemPresentation = { ...systemPresentation };
        Object.entries(plan.systemModules).forEach(([id, module]) => {
          if (module.placement) nextPositions[id] = module.placement;
          if (nextSystemPresentation[id]) nextSystemPresentation[id] = { ...nextSystemPresentation[id], ...module };
        });
        setPositions(nextPositions);
        setSystemPresentation(nextSystemPresentation);
        writeOwnerProfileValue(window.localStorage, MODULE_LAYOUT_STORAGE_KEY, workspace.profileAddress, encodeModuleLayout(nextPositions));
        saveSystemPresentation(workspace.profileAddress, nextSystemPresentation);
        setAvatarShape(plan.avatarShape);
        setVisitorNavigation(plan.visitorNavigation);
        onApplyRestoredPresentation?.({ keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment });
        saveOwnerPublicationBaseline(window.localStorage, workspace.profileAddress, {
          ...pointer, publishedFingerprint, localFingerprint: publishedFingerprint, hydratedAt: Date.now()
        });
        workspaceRecordRef.current.set(workspace.profileAddress, { presence: 'current', profileAddress: workspace.profileAddress });
      } catch (error) {
        reportControlledError('owner-publication-hydration', error);
        setPublicationReconciliation({ profileAddress: workspace.profileAddress, publishedFingerprint, status: 'blocked' });
        return;
      }
    } else {
      saveOwnerPublicationBaseline(window.localStorage, workspace.profileAddress, {
        ...pointer, publishedFingerprint, localFingerprint: reconciliationFingerprint, hydratedAt: Date.now()
      });
    }
    setPublicationReconciliation({ profileAddress: workspace.profileAddress, publishedFingerprint, status: 'ready' });
  }, [onApplyRestoredPresentation, ownerAuthoringEnabled, positions, publicationProfileAddress, publicationReconciliation,
    publishedResolution, reconciliationFingerprint, replaceSignalSettings, replaceWorkspace, saveSystemPresentation, setAvatarShape, setPositions,
    setSystemPresentation, setVisitorNavigation, systemPresentation, workspace, workspaceRecordRef]);

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
