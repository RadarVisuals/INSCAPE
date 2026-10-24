// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OwnerRuntimeBoundary from './public/OwnerRuntimeBoundary.jsx';
import { Startveil } from './startveil/index.js';
import { StartupDestinationBoundary, StartupDestinationContext, StartupDestinationReady } from './startveil/StartupDestinationContext.jsx';
import { useWalletStore } from './store/useWalletStore.js';
import useApplicationNavigation from './profileDiscovery/useApplicationNavigation.js';
import PublishedProfileBoundary from './profileDocument/components/PublishedProfileBoundary.jsx';
import { usePublishedProfile } from './profileDocument/state/usePublishedProfile.js';
import { PUBLISHED_PROFILE_STATUS } from './profileDocument/storage/luksoPublishedProfileRepository.js';
import { reportControlledError } from './diagnostics.js';
import AlphaSupportPanel from './support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from './support/alphaSupport.js';
import { createStandaloneWalletLoader, hasPersistedStandaloneConnection } from './wallet/standaloneWalletLoader.js';
import { normalizeProfileAddress } from './library/config.js';

const PublicEntryPortal = lazy(() => import('./startveil/PublicEntryPortal.jsx'));
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
  const walletProfileMetadata = useWalletStore((state) => state.profileMetadata);
  const ownershipVerified = useWalletStore((state) => state.isHostProfileOwner);
  const verifiedOwnerProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const authorityLifecycleStatus = useWalletStore((state) => state.authorityLifecycleStatus);
  const initializationError = useWalletStore((state) => state.initializationError);
  const initWallet = useWalletStore((state) => state.initWallet);
  const beginWalletTransition = useWalletStore((state) => state.beginWalletTransition);
  const scheduleWalletRelease = useWalletStore((state) => state.scheduleWalletRelease);
  const navigation = useApplicationNavigation({ status: authorityLifecycleStatus,
    profileAddress: verifiedOwnerProfileAddress, ownershipVerified });
  const { destination, content, completeSignIn, beginSignIn, beginDisconnect } = navigation;
  const viewedProfileAddress = content?.address || null;
  const interfaceVisible = ['interface', 'complete'].includes(revealStage);
  const ownerAuthoringEnabled = content?.kind === 'workbench';
  const connectedWorkspaceProfileAddress = ownerAuthoringEnabled ? viewedProfileAddress : null;
  const getWalletPublicationContext = useCallback(() => useWalletStore.getState(), []);
  const localOwnerRoute = ownerAuthoringEnabled;
  const publicEntryPortal = destination.kind === 'entry' && revealStage !== 'complete';
  const [publishedResolution, retryPublishedProfile] = usePublishedProfile(viewedProfileAddress);
  // A confirmed publication belongs to the application session: refreshing the
  // owner runtime must not dispose its receipt or success message.
  const publicationProfileRef = useRef(connectedWorkspaceProfileAddress);
  publicationProfileRef.current = connectedWorkspaceProfileAddress;
  useEffect(() => setPublicationConfirmation(null), [connectedWorkspaceProfileAddress]);
  const onPublicationConfirmed = (result) => {
    const address = normalizeProfileAddress(result?.document?.profile?.address);
    if (result?.status !== PUBLISHED_PROFILE_STATUS.RESOLVED || !address
      || address !== connectedWorkspaceProfileAddress || address !== publicationProfileRef.current) return;
    setPublicationConfirmation({ profileAddress: address, transactionHash: result.transactionHash, menuSurface: result.menuSurface });
    retryPublishedProfile();
  };
  const ownerSourceReady = publishedResolution?.status !== PUBLISHED_PROFILE_STATUS.LOADING;
  const connectedProfile = verifiedOwnerProfileAddress ? {
    address: verifiedOwnerProfileAddress,
    name: walletProfileMetadata?.name || '',
    avatarUrl: walletProfileMetadata?.avatarUrl || null,
  } : null;

  // Reveal a resolved destination or its recovery UI; optional artwork media
  // continues loading inside that destination. The public portal is independent.
  const destinationKey = `${destination.kind}:${destination.address || ''}`;
  const onDestinationReady = useCallback(() => setReadyDestinationKey(destinationKey), [destinationKey]);
  const entryDestinationReady = publicEntryPortal || (destination.kind !== 'pending'
    && (destination.kind === 'discover' || ownerSourceReady) && readyDestinationKey === destinationKey);
  useEffect(() => {
    if (revealStage !== 'complete') return;
    const node = interfaceRef.current;
    if (!node) return;
    if (document.activeElement !== node && node.contains(document.activeElement)
      && !document.activeElement.closest('[inert]')) return;
    const focusTarget = [...node.querySelectorAll('[data-published-focus-fallback], .visitor-grid-world, .workspace-navigation button, .public-entry-portal__header-wordmark')]
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
      completeSignIn();
    }
  }, [authorityLifecycleStatus, standaloneSignInActive, visitorWalletConnected, completeSignIn]);

  const visitProfile = navigation.visitProfile;

  const requestStandaloneSignIn = useCallback(() => {
    if (window.parent !== window) return;
    const loader = standaloneWalletSessionRef.current;
    if (!loader) return;
    beginSignIn();
    setStandaloneSignInActive(true);
    void loader.getSession().then((session) => {
      if (!session) { setStandaloneSignInActive(false); return null; }
      return session.showSignIn();
    }).catch((error) => {
      setStandaloneSignInActive(false);
      reportControlledError('standalone-wallet-sign-in', error);
    });
  }, [beginSignIn]);

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

  const enterConnectedWorld = useCallback(() => {
    if (verifiedOwnerProfileAddress) visitProfile(verifiedOwnerProfileAddress, { returnToConnectedProfile: true });
  }, [verifiedOwnerProfileAddress, visitProfile]);

  const registerDesktopContextMenu = useCallback((handler) => {
    desktopContextMenuRef.current = handler;
  }, []);

  if (creepsMetadataRecoveryRoute && CreepsMetadataRecoveryPanel) return <Suspense
    fallback={<div className="mode-loading">Opening CREEPS recovery control…</div>}
  >
    <CreepsMetadataRecoveryPanel onRequestSignIn={requestStandaloneSignIn} />
  </Suspense>;

  return (
    <div className="application-root" data-application-mode="public" data-startveil-stage={revealStage} data-gallery-active={galleryActive || undefined}>
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
      <StartupDestinationContext.Provider key={`${content?.kind || 'portal'}:${viewedProfileAddress || ''}`} value={onDestinationReady}>
      <StartupDestinationBoundary>
        {authorityLifecycleStatus === 'complete' && initializationError && <AlphaSupportPanel compact
          code={ALPHA_SUPPORT_CODES.AUTHORITY_INITIALIZATION_FAILED} phase="OWNER_AUTHORITY"
          providerCategory="UP_PROVIDER" profileAddress={viewedProfileAddress} routeClass="AUTHORITY_ENTRY"
          message={initializationError.message} />}
        <div aria-hidden={destination.kind === 'discover' || undefined} inert={destination.kind === 'discover' ? '' : undefined}>
        {standaloneSignInActive || publicEntryPortal || !content ? null : content.kind === 'pending'
            ? <div className="mode-loading" role="status">Resolving profile...</div>
            : content.kind === 'entry' ? null
            : localOwnerRoute ? !ownerSourceReady ? <div className="mode-loading" role="status">Resolving owner workspace...</div> : <OwnerRuntimeBoundary
            ownerAuthoringEnabled={ownerAuthoringEnabled}
            workspaceProfileAddress={connectedWorkspaceProfileAddress}
            getWalletPublicationContext={getWalletPublicationContext}
            visitorWalletConnected={visitorWalletConnected}
            viewedProfileAddress={viewedProfileAddress}
            onVisitProfile={visitProfile}
            onOpenDiscover={navigation.openDiscover}
            onOpenReception={() => navigation.openReception(viewedProfileAddress)}
            connectedProfile={connectedProfile}
            onConnect={requestStandaloneSignIn}
            onDisconnect={disconnectStandalone}
            onEnterMyWorld={enterConnectedWorld}
            interfaceVisible={interfaceVisible}
            registerWorldContextMenu={registerDesktopContextMenu}
            onGalleryOpenChange={setGalleryActive}
            publishedResolution={publishedResolution}
            onPublicationConfirmed={onPublicationConfirmed}
          /> : <PublishedProfileBoundary address={viewedProfileAddress} resolution={publishedResolution}
            connectedProfile={connectedProfile} onConnect={requestStandaloneSignIn}
            onDisconnect={disconnectStandalone} onEnterMyWorld={enterConnectedWorld}
            onRetry={retryPublishedProfile}
            returnProfileAddress={verifiedOwnerProfileAddress}
            onReturnToWorkbench={ownershipVerified && authorityLifecycleStatus === 'complete' ? enterConnectedWorld : undefined}
            onOpenDiscover={navigation.openDiscover} onVisitProfile={visitProfile}
            entry={{ surface: content.canvas ? 'canvas' : 'overview', target: content.target, reception: content.reception }}
            onOpenOverview={() => navigation.openOverview(viewedProfileAddress)} />}
        </div>
        {!standaloneSignInActive && !publicEntryPortal && ['entry', 'discover'].includes(destination.kind) && <Suspense fallback={<div className="mode-loading">Opening Discover...</div>}>
          <PublicEntryPortal embedded mode={destination.kind === 'discover' ? 'explore' : 'landing'}
            onExplore={navigation.openDiscover} onClose={content?.address ? navigation.closeDiscover : undefined} onHome={navigation.closeDiscover}
            connectedProfile={connectedProfile} onConnect={requestStandaloneSignIn}
            onDisconnect={disconnectStandalone} onEnterMyWorld={enterConnectedWorld} onVisitProfile={visitProfile} />
          <StartupDestinationReady />
        </Suspense>}
      </StartupDestinationBoundary>
      </StartupDestinationContext.Provider>
      {publicationConfirmation?.profileAddress === connectedWorkspaceProfileAddress && <Suspense fallback={null}>
        <PublicationConfirmation confirmation={publicationConfirmation} onClose={() => {
          setPublicationConfirmation(null);
          (interfaceRef.current?.querySelector('button[aria-label="Publish"]') || interfaceRef.current)?.focus({ preventScroll: true });
        }} />
      </Suspense>}
      </div>
      <Startveil
        connectedProfile={connectedProfile}
        ready={entryDestinationReady}
        portal={publicEntryPortal}
        onExplore={navigation.openDiscover}
        onConnect={requestStandaloneSignIn}
        onDisconnect={disconnectStandalone}
        onEnterMyWorld={enterConnectedWorld}
        onVisitProfile={(address) => visitProfile(address)}
        onRevealInterface={() => setRevealStage('interface')}
        onComplete={() => setRevealStage('complete')}
      />
    </div>
  );
}

export default App;
