// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OwnerRuntimeBoundary from './public/OwnerRuntimeBoundary.jsx';
import ProfileSignIn from './startveil/ProfileSignIn.jsx';
import { Startveil } from './startveil/index.js';
import { StartupDestinationBoundary, StartupDestinationContext, StartupDestinationReady } from './startveil/StartupDestinationContext.jsx';
import { getConnectedProfileAddress, useWalletStore } from './store/useWalletStore.js';
import { GalleryStudioMotion } from './navigation/galleryStudioMotion.js';
import GalleryStudioStage from './navigation/GalleryStudioStage.jsx';
import useApplicationNavigation from './navigation/useApplicationNavigation.js';
import { usePublishedProfile } from './profileDocument/state/usePublishedProfile.js';
import { PUBLISHED_PROFILE_STATUS } from './profileDocument/storage/luksoPublishedProfileRepository.js';
import { reportControlledError } from './diagnostics.js';
import AlphaSupportPanel from './support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from './support/alphaSupport.js';
import { createStandaloneWalletLoader, hasPersistedStandaloneConnection } from './wallet/standaloneWalletLoader.js';
import { normalizeProfileAddress } from './library/config.js';

const CurationPage = lazy(() => import('./library/CurationPage.jsx'));
const PublishedProfileBoundary = lazy(() => import('./profileDocument/components/PublishedProfileBoundary.jsx'));
const PublicationConfirmation = lazy(() => import('./public/PublicationConfirmation.jsx'));
const CreepsMetadataRecoveryPanel = import.meta.env.DEV
  ? lazy(() => import('./recovery/CreepsMetadataRecoveryPanel.jsx'))
  : null;

function App() {
  const desktopContextMenuRef = useRef(null);
  const standaloneWalletSessionRef = useRef(null);
  const creepsMetadataRecoveryRoute = useMemo(() => import.meta.env.DEV
    && window.location.pathname.replace(/\/+$/, '') === '/development/creeps-recovery', []);
  const [revealStage, setRevealStage] = useState('sealed');
  const [readyDestinationKey, setReadyDestinationKey] = useState(null);
  const interfaceRef = useRef(null);
  const [standaloneSignInActive, setStandaloneSignInActive] = useState(false);
  const [galleryActive, setGalleryActive] = useState(false);
  const [publicationConfirmation, setPublicationConfirmation] = useState(null);
  const visitorWalletConnected = useWalletStore((state) => state.isWalletConnected);
  const connectedProfileAddress = useWalletStore(getConnectedProfileAddress);
  const walletProfileMetadata = useWalletStore((state) => state.profileMetadata);
  const ownershipVerified = useWalletStore((state) => state.isHostProfileOwner);
  const verifiedOwnerProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const authorityLifecycleStatus = useWalletStore((state) => state.authorityLifecycleStatus);
  const initializationError = useWalletStore((state) => state.initializationError);
  const initWallet = useWalletStore((state) => state.initWallet);
  const beginWalletTransition = useWalletStore((state) => state.beginWalletTransition);
  const scheduleWalletRelease = useWalletStore((state) => state.scheduleWalletRelease);
  const navigation = useApplicationNavigation({ status: authorityLifecycleStatus,
    profileAddress: verifiedOwnerProfileAddress, signedInAddress: connectedProfileAddress, ownershipVerified });
  const { destination, beginDisconnect } = navigation;
  const viewedProfileAddress = destination.address || null;
  const interfaceVisible = ['interface', 'complete'].includes(revealStage);
  const ownerAuthoringEnabled = destination.kind === 'workbench';
  const connectedWorkspaceProfileAddress = ownerAuthoringEnabled ? viewedProfileAddress : null;
  const getWalletPublicationContext = useCallback(() => useWalletStore.getState(), []);
  const localOwnerRoute = ownerAuthoringEnabled;
  const showStartveilSignIn = destination.kind === 'entry' && revealStage !== 'complete';
  const canOpenStudio = Boolean(connectedProfileAddress && ownershipVerified && authorityLifecycleStatus === 'complete'
    && normalizeProfileAddress(connectedProfileAddress) === normalizeProfileAddress(verifiedOwnerProfileAddress));
  const ownViewedProfile = canOpenStudio && normalizeProfileAddress(viewedProfileAddress) === normalizeProfileAddress(connectedProfileAddress);
  const publicationAddress = ownViewedProfile ? viewedProfileAddress : null;
  const [publishedResolution, retryPublishedProfile, acceptConfirmedPublication] = usePublishedProfile(viewedProfileAddress);
  // A confirmed publication belongs to the application session: refreshing the
  // owner runtime must not dispose its receipt or success message.
  const publicationProfileRef = useRef(publicationAddress);
  publicationProfileRef.current = publicationAddress;
  useEffect(() => setPublicationConfirmation(null), [publicationAddress]);
  const onPublicationConfirmed = (result, context) => {
    const address = normalizeProfileAddress(result?.document?.profile?.address);
    if (result?.status !== PUBLISHED_PROFILE_STATUS.RESOLVED || !address
      || address !== publicationAddress || address !== publicationProfileRef.current || !acceptConfirmedPublication(result)) return;
    setPublicationConfirmation({ profileAddress: address, transactionHash: result.transactionHash, ...context });
  };
  const ownerSourceReady = publishedResolution?.status !== PUBLISHED_PROFILE_STATUS.LOADING;
  const accountMetadata = connectedProfileAddress?.toLowerCase() === verifiedOwnerProfileAddress?.toLowerCase() ? walletProfileMetadata : null;
  const connectedProfile = connectedProfileAddress ? {
    address: connectedProfileAddress,
    name: accountMetadata?.name || '',
    avatarUrl: accountMetadata?.avatarUrl || null,
  } : null;

  // Reveal a resolved destination or its recovery UI; optional artwork media
  // continues loading inside that destination. Sign-in is immediately available.
  const destinationKey = `${destination.kind}:${destination.address || ''}`;
  const onDestinationReady = useCallback(() => setReadyDestinationKey(destinationKey), [destinationKey]);
  const entryDestinationReady = showStartveilSignIn || (destination.kind !== 'pending'
    && (destination.kind === 'curation' || ownerSourceReady) && readyDestinationKey === destinationKey);
  useEffect(() => {
    if (revealStage !== 'complete') return;
    const node = interfaceRef.current;
    if (!node) return;
    if (document.activeElement !== node && node.contains(document.activeElement)
      && !document.activeElement.closest('[inert]')) return;
    const focusTarget = [...node.querySelectorAll('[data-published-focus-fallback], .visitor-grid-world, .workspace-header .workspace-brand')]
      .find((target) => !target.closest('[inert]') && target.getClientRects().length && !target.disabled);
    (focusTarget || node).focus({ preventScroll: true });
  }, [revealStage, destinationKey, readyDestinationKey]);

  useEffect(() => {
    if (window.parent !== window) {
      initWallet();
      return () => scheduleWalletRelease();
    }

    const loader = createStandaloneWalletLoader({
          initializeWallet: initWallet,
          disposeWallet: () => useWalletStore.getState().disposeWallet(),
          beginWalletTransition,
          onSignInClose: () => setStandaloneSignInActive(false),
          onError: (error) => reportControlledError('standalone-wallet-connect', error)
    });
    standaloneWalletSessionRef.current = loader;
    if (hasPersistedStandaloneConnection()) {
      void loader.getSession().catch((error) => {
        if (standaloneWalletSessionRef.current !== loader) return;
        useWalletStore.getState().disposeWallet();
        reportControlledError('standalone-wallet-setup', error);
      });
    } else {
      // Fresh visitors can enter without downloading a connector runtime.
      useWalletStore.getState().disposeWallet();
    }

    return () => {
      if (standaloneWalletSessionRef.current === loader) {
        standaloneWalletSessionRef.current = null;
      }
      loader.release();
    };
  }, [beginWalletTransition, initWallet, scheduleWalletRelease]);

  useEffect(() => {
    if (standaloneSignInActive && visitorWalletConnected && authorityLifecycleStatus === 'complete') {
      setStandaloneSignInActive(false);
    }
  }, [authorityLifecycleStatus, standaloneSignInActive, visitorWalletConnected]);

  const visitProfile = navigation.visitProfile;

  const requestStandaloneSignIn = useCallback(() => {
    if (window.parent !== window) return;
    const loader = standaloneWalletSessionRef.current;
    if (!loader) return;
    setStandaloneSignInActive(true);
    void loader.getSession().then((session) => {
      if (!session) { setStandaloneSignInActive(false); return null; }
      return session.showSignIn();
    }).catch((error) => {
      setStandaloneSignInActive(false);
      reportControlledError('standalone-wallet-sign-in', error);
    });
  }, []);

  const disconnectStandalone = useCallback(() => {
    const finish = beginDisconnect();
    if (!finish) return;
    if (window.parent !== window) {
      useWalletStore.getState().disposeWallet();
      finish(true);
      return;
    }
    const loader = standaloneWalletSessionRef.current;
    if (!loader) { finish(false); return; }
    void loader.getSession().then(async (session) => {
      if (!session) { finish(false); return; }
      await session.disconnect();
      finish(true);
    }).catch((error) => {
      finish(false);
      reportControlledError('standalone-wallet-disconnect', error);
    });
  }, [beginDisconnect]);

  const ownerDestinations = connectedProfileAddress ? {
    Profile: () => navigation.openOverview(connectedProfileAddress),
    Gallery: () => navigation.openCanvas(connectedProfileAddress),
    Writing: () => navigation.openWriting(connectedProfileAddress),
    Curation: canOpenStudio ? () => navigation.openCuration(connectedProfileAddress) : undefined,
    Studio: canOpenStudio ? () => navigation.openStudio(connectedProfileAddress) : undefined,
  } : undefined;

  const registerDesktopContextMenu = useCallback((handler) => {
    desktopContextMenuRef.current = handler;
  }, []);

  const ownerWorkspace = localOwnerRoute ? !ownerSourceReady ? <div className="mode-loading" role="status">Resolving owner workspace...</div> : <OwnerRuntimeBoundary
            requestedWorkId={destination.worksEditorId}
            onReturnToWorks={() => navigation.returnToWorks(viewedProfileAddress)}
            onOpenGallery={() => navigation.openCanvas(viewedProfileAddress)}
            onManageCompositions={() => navigation.manageCompositions(viewedProfileAddress)}
            initialPublicationReview={navigation.route.reviewPublication === true && navigation.route.address === publicationAddress}
            onPublicationReviewOpened={navigation.consumePublicationReview}
            initialNew={destination.newComposition === true}
            onNewOpened={navigation.consumeNewComposition}
            returnLabel={navigation.studioReturnLabel}
            onOpenWriting={() => navigation.openWriting(viewedProfileAddress)}
            ownerDestinations={ownerDestinations}
            ownerAuthoringEnabled={ownerAuthoringEnabled}
            canvasOverviewRequested={destination.canvas === true}
            workspaceProfileAddress={connectedWorkspaceProfileAddress}
            getWalletPublicationContext={getWalletPublicationContext}
            visitorWalletConnected={visitorWalletConnected}
            viewedProfileAddress={viewedProfileAddress}
            onOpenProfile={() => navigation.openOverview(viewedProfileAddress)}
            onEditorDocumentChange={(id, options) => navigation.editWork(viewedProfileAddress, id, options)}
            connectedProfile={connectedProfile}
            onConnect={requestStandaloneSignIn}
            onDisconnect={disconnectStandalone}
            interfaceVisible={interfaceVisible}
            registerWorldContextMenu={registerDesktopContextMenu}
            onGalleryOpenChange={setGalleryActive}
            publishedResolution={publishedResolution}
            onPublicationConfirmed={onPublicationConfirmed}
          /> : null;

  if (creepsMetadataRecoveryRoute && CreepsMetadataRecoveryPanel) return <Suspense
    fallback={<div className="mode-loading">Opening CREEPS recovery control…</div>}
  >
    <CreepsMetadataRecoveryPanel onRequestSignIn={requestStandaloneSignIn} />
  </Suspense>;

  return (
    <GalleryStudioMotion.Provider value={navigation.motion}><div className="application-root" data-application-mode="public" data-startveil-stage={revealStage} data-gallery-active={galleryActive || undefined}>
      <div
        className="application-world"
        data-visible={interfaceVisible || undefined}
        onContextMenu={(event) => desktopContextMenuRef.current?.(event)}
      >
      </div>
      <div
        className="application-interface"
        ref={interfaceRef} tabIndex={-1}
        data-visible={interfaceVisible || undefined}
        aria-hidden={!interfaceVisible}
        inert={revealStage === 'complete' ? undefined : ''}
      >
      <StartupDestinationContext.Provider key={`${destination.kind}:${viewedProfileAddress || ''}`} value={onDestinationReady}>
      <StartupDestinationBoundary>
        {authorityLifecycleStatus === 'complete' && initializationError && <AlphaSupportPanel compact
          code={ALPHA_SUPPORT_CODES.AUTHORITY_INITIALIZATION_FAILED} phase="OWNER_AUTHORITY"
          providerCategory="UP_PROVIDER" profileAddress={viewedProfileAddress} routeClass="AUTHORITY_ENTRY"
           />}
        {standaloneSignInActive || showStartveilSignIn ? null : destination.kind === 'pending'
            ? <div className="mode-loading" role="status">Resolving profile...</div>
            : destination.kind === 'entry' ? <ProfileSignIn onConnect={requestStandaloneSignIn} />
            : destination.kind === 'curation' && canOpenStudio ? <Suspense fallback={<div className="mode-loading" role="status">Opening Curation...</div>}>
              <CurationPage key={destination.address} profileAddress={destination.address} destinations={ownerDestinations} onBack={navigation.closeCuration} />
              <StartupDestinationReady />
            </Suspense> : localOwnerRoute ? ownerWorkspace : <Suspense fallback={<div className="mode-loading" role="status">Opening profile…</div>}>
            <PublishedProfileBoundary address={viewedProfileAddress} resolution={publishedResolution}
            connectedProfile={connectedProfile} onConnect={requestStandaloneSignIn} ownerDestinations={ownerDestinations}
            onDisconnect={disconnectStandalone}
            onRetry={retryPublishedProfile}
            onReviewReplacement={ownViewedProfile ? () => navigation.openStudio(viewedProfileAddress, { reviewPublication: true }) : undefined}
            getWalletPublicationContext={publicationAddress ? getWalletPublicationContext : undefined}
            onPublicationConfirmed={publicationAddress ? onPublicationConfirmed : undefined}
            returnProfileAddress={connectedProfileAddress}
            onReturnToWorkbench={ownViewedProfile ? ownerDestinations.Studio : undefined}
            onEditComposition={ownViewedProfile ? id => navigation.editWork(viewedProfileAddress, id) : undefined}
            onManageWorks={ownViewedProfile ? () => navigation.manageCompositions(viewedProfileAddress) : undefined}
            onNewComposition={ownViewedProfile ? () => navigation.openStudio(viewedProfileAddress, { create: true }) : undefined}
            onVisitProfile={visitProfile}
            entry={{ surface: destination.writing ? 'writing' : destination.canvas ? 'canvas' : 'overview', target: destination.target }}
            onOpenWriting={() => navigation.openWriting(viewedProfileAddress)}
            onOpenCanvas={() => navigation.openCanvas(viewedProfileAddress)}
            onOpenOverview={() => navigation.openOverview(viewedProfileAddress)} /></Suspense>}
      </StartupDestinationBoundary>
      </StartupDestinationContext.Provider>
      <GalleryStudioStage />
      {publicationConfirmation && publicationConfirmation.profileAddress === publicationAddress && <Suspense fallback={null}>
        <PublicationConfirmation confirmation={publicationConfirmation} onClose={() => {
          setPublicationConfirmation(null);
          (interfaceRef.current?.querySelector('button[aria-label="Publish"], .visitor-tabs [aria-current="page"]') || interfaceRef.current)?.focus({ preventScroll: true });
        }} />
      </Suspense>}
      </div>
      <Startveil
        ready={entryDestinationReady}
        portal={showStartveilSignIn}
        onConnect={requestStandaloneSignIn}
        onRevealInterface={() => setRevealStage('interface')}
        onComplete={() => setRevealStage('complete')}
      />
    </div></GalleryStudioMotion.Provider>
  );
}

export default App;
