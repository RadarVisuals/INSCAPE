// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OwnerRuntimeBoundary from './public/OwnerRuntimeBoundary.jsx';
import { Startveil } from './startveil/index.js';
import { StartupDestinationBoundary, StartupDestinationContext } from './startveil/StartupDestinationContext.jsx';
import { useWalletStore } from './store/useWalletStore.js';
import { resolveLibraryProfile, resolveWorkspaceProfile } from './library/config.js';
import { createSelectedProfileUrl, createViewedProfileUrl, resolveExplicitViewedProfile } from './profileDiscovery/viewedProfileUrl.js';
import {
  PROFILE_TARGET_SOURCE,
  resolveProfileTarget
} from './profileDiscovery/profileTarget.js';
import PublishedProfileBoundary from './profileDocument/components/PublishedProfileBoundary.jsx';
import { usePublishedProfile } from './profileDocument/state/usePublishedProfile.js';
import { PUBLISHED_PROFILE_STATUS } from './profileDocument/storage/luksoPublishedProfileRepository.js';
import {
  resolveOwnerAuthoringEnabled,
  selectPublicProfileRoute
} from './public/publicAccess.js';
import { reportControlledError } from './diagnostics.js';
import AlphaSupportPanel from './support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from './support/alphaSupport.js';

const PublicDiscoverExperience = lazy(() => import('./profileDiscovery/PublicDiscoverExperience.jsx'));
const CreepsMetadataRecoveryPanel = import.meta.env.DEV
  ? lazy(() => import('./recovery/CreepsMetadataRecoveryPanel.jsx'))
  : null;

function App() {
  const desktopContextMenuRef = useRef(null);
  const standaloneWalletSessionRef = useRef(null);
  const routeWorkspaceProfileAddress = useMemo(() => resolveLibraryProfile(window.location), []);
  const creepsMetadataRecoveryRoute = useMemo(() => import.meta.env.DEV
    && window.location.pathname.replace(/\/+$/, '') === '/development/creeps-recovery', []);
  const [explicitViewedProfileAddress, setExplicitViewedProfileAddress] = useState(() => resolveExplicitViewedProfile(window.location));
  const [retainedPublicProfileAddress, setRetainedPublicProfileAddress] = useState(null);
  const [revealStage, setRevealStage] = useState('sealed');
  const [readyDestinationKey, setReadyDestinationKey] = useState(null);
  const interfaceRef = useRef(null);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [standaloneSignInActive, setStandaloneSignInActive] = useState(false);
  const [galleryActive, setGalleryActive] = useState(false);
  const visitorWalletConnected = useWalletStore((state) => state.isWalletConnected);
  const walletProfileMetadata = useWalletStore((state) => state.profileMetadata);
  const ownershipVerified = useWalletStore((state) => state.isHostProfileOwner);
  const verifiedOwnerProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const authorityLifecycleStatus = useWalletStore((state) => state.authorityLifecycleStatus);
  const initializationError = useWalletStore((state) => state.initializationError);
  const initWallet = useWalletStore((state) => state.initWallet);
  const beginWalletTransition = useWalletStore((state) => state.beginWalletTransition);
  const scheduleWalletRelease = useWalletStore((state) => state.scheduleWalletRelease);
  const connectedWorkspaceProfileAddress = resolveWorkspaceProfile(verifiedOwnerProfileAddress, {
    search: routeWorkspaceProfileAddress ? `?profile=${routeWorkspaceProfileAddress}` : ''
  });
  const profileTarget = resolveProfileTarget({
    explicitViewedProfileAddress,
    connectedProfileAddress: verifiedOwnerProfileAddress,
    workspaceFallbackAddress: routeWorkspaceProfileAddress || retainedPublicProfileAddress,
    authorityLifecycleStatus
  });
  const viewedProfileAddress = profileTarget.address;
  const interfaceVisible = ['interface', 'complete'].includes(revealStage);
  const ownerAuthoringEnabled = resolveOwnerAuthoringEnabled({
    ownershipVerified,
    verifiedOwnerProfileAddress,
    workspaceProfileAddress: connectedWorkspaceProfileAddress,
    viewedProfileAddress
  });
  const getWalletPublicationContext = useCallback(() => useWalletStore.getState(), []);
  const publicProfileRoute = selectPublicProfileRoute(ownerAuthoringEnabled);
  const localOwnerRoute = publicProfileRoute === 'LOCAL_OWNER';
  const publicEntryPortal = !explicitViewedProfileAddress && !routeWorkspaceProfileAddress && !retainedPublicProfileAddress
    && [PROFILE_TARGET_SOURCE.PENDING, PROFILE_TARGET_SOURCE.NONE].includes(profileTarget.source);
  const [publishedResolution, retryPublishedProfile] = usePublishedProfile(viewedProfileAddress);
  const ownerSourceReady = publishedResolution?.status !== PUBLISHED_PROFILE_STATUS.LOADING;
  const connectedProfile = verifiedOwnerProfileAddress ? {
    address: verifiedOwnerProfileAddress,
    name: walletProfileMetadata?.name || '',
    avatarUrl: walletProfileMetadata?.avatarUrl || null,
  } : null;

  // Reveal a resolved destination or its recovery UI; optional artwork media
  // continues loading inside that destination. The public portal is independent.
  const destinationKey = `${publicProfileRoute}:${viewedProfileAddress || 'directory'}`;
  const onDestinationReady = useCallback(() => setReadyDestinationKey(destinationKey), [destinationKey]);
  const entryDestinationReady = publicEntryPortal || (!profileTarget.pending && ownerSourceReady
    && readyDestinationKey === destinationKey);
  useEffect(() => {
    if (revealStage !== 'complete') return;
    const node = interfaceRef.current;
    if (!node) return;
    const focusTarget = node.querySelector('[data-published-focus-fallback], .visitor-grid-world, .system-workflow__global-bar button');
    (focusTarget || node).focus({ preventScroll: true });
  }, [revealStage]);

  useEffect(() => {
    if (authorityLifecycleStatus === 'complete' && verifiedOwnerProfileAddress) {
      setRetainedPublicProfileAddress(verifiedOwnerProfileAddress);
    }
  }, [authorityLifecycleStatus, verifiedOwnerProfileAddress]);

  useEffect(() => {
    if (authorityLifecycleStatus !== 'complete' || verifiedOwnerProfileAddress
      || explicitViewedProfileAddress || routeWorkspaceProfileAddress || !retainedPublicProfileAddress) return;
    const nextUrl = createSelectedProfileUrl(window.location, retainedPublicProfileAddress);
    window.history.replaceState({ viewedProfileAddress: retainedPublicProfileAddress }, '', nextUrl);
    setExplicitViewedProfileAddress(retainedPublicProfileAddress);
  }, [authorityLifecycleStatus, explicitViewedProfileAddress, retainedPublicProfileAddress,
    routeWorkspaceProfileAddress, verifiedOwnerProfileAddress]);

  useEffect(() => {
    if (window.parent !== window) {
      initWallet();
      return () => scheduleWalletRelease();
    }

    let acquisition = null;
    let cancelled = false;
    const setup = import('./wallet/standaloneWalletSession.js')
      .then(({ acquireStandaloneWalletSession }) => {
        acquisition = acquireStandaloneWalletSession({
          initializeWallet: initWallet,
          disposeWallet: () => useWalletStore.getState().disposeWallet(),
          beginWalletTransition,
          onSignInClose: () => setStandaloneSignInActive(false),
          onError: (error) => reportControlledError('standalone-wallet-connect', error)
        });
        if (cancelled) {
          acquisition.release();
          return null;
        }
        standaloneWalletSessionRef.current = acquisition.session;
        return acquisition.session;
      })
      .catch((error) => {
        reportControlledError('standalone-wallet-setup', error);
        return null;
      });
    standaloneWalletSessionRef.current = setup;

    return () => {
      cancelled = true;
      if (standaloneWalletSessionRef.current === setup || standaloneWalletSessionRef.current === acquisition?.session) {
        standaloneWalletSessionRef.current = null;
      }
      acquisition?.release();
    };
  }, [beginWalletTransition, initWallet, scheduleWalletRelease]);

  useEffect(() => {
    if (standaloneSignInActive && visitorWalletConnected && authorityLifecycleStatus === 'complete') setStandaloneSignInActive(false);
  }, [authorityLifecycleStatus, standaloneSignInActive, visitorWalletConnected]);

  useEffect(() => {
    const syncProfileFromUrl = () => {
      setExplicitViewedProfileAddress(resolveExplicitViewedProfile(window.location));
    };
    syncProfileFromUrl();
    window.addEventListener('popstate', syncProfileFromUrl);
    return () => window.removeEventListener('popstate', syncProfileFromUrl);
  }, [routeWorkspaceProfileAddress]);

  const visitProfile = useCallback((address, { returnToConnectedProfile = false } = {}) => {
    const nextUrl = returnToConnectedProfile
      ? createViewedProfileUrl(window.location, address, verifiedOwnerProfileAddress)
      : createSelectedProfileUrl(window.location, address);
    window.history.pushState({ viewedProfileAddress: address }, '', nextUrl);
    setExplicitViewedProfileAddress(resolveExplicitViewedProfile(window.location));
  }, [verifiedOwnerProfileAddress]);

  const requestStandaloneSignIn = useCallback(() => {
    if (window.parent !== window) return;
    const sessionOrPromise = standaloneWalletSessionRef.current;
    if (!sessionOrPromise) return;
    setStandaloneSignInActive(true);
    void Promise.resolve(sessionOrPromise).then((session) => {
      if (!session) { setStandaloneSignInActive(false); return null; }
      return session.showSignIn();
    }).catch((error) => {
      setStandaloneSignInActive(false);
      reportControlledError('standalone-wallet-sign-in', error);
    });
  }, []);

  const disconnectStandalone = useCallback(() => {
    if (window.parent !== window) {
      useWalletStore.getState().disposeWallet();
      return;
    }
    const sessionOrPromise = standaloneWalletSessionRef.current;
    if (!sessionOrPromise) return;
    void Promise.resolve(sessionOrPromise).then((session) => session?.disconnect()).catch((error) => {
      reportControlledError('standalone-wallet-disconnect', error);
    });
  }, []);

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
      <StartupDestinationContext.Provider key={destinationKey} value={onDestinationReady}>
      <StartupDestinationBoundary>
        {authorityLifecycleStatus === 'complete' && initializationError && <AlphaSupportPanel compact
          code={ALPHA_SUPPORT_CODES.AUTHORITY_INITIALIZATION_FAILED} phase="OWNER_AUTHORITY"
          providerCategory="UP_PROVIDER" profileAddress={viewedProfileAddress} routeClass="AUTHORITY_ENTRY"
          message={initializationError.message} />}
        {standaloneSignInActive || publicEntryPortal ? null : profileTarget.pending
            ? <div className="mode-loading" role="status">Resolving profile...</div>
            : profileTarget.source === PROFILE_TARGET_SOURCE.NONE ? <Suspense fallback={null}>
              <PublicDiscoverExperience onRequestOwner={requestStandaloneSignIn}
                onSelect={(address) => visitProfile(address)} />
            </Suspense>
            : localOwnerRoute ? !ownerSourceReady ? <div className="mode-loading" role="status">Resolving owner workspace...</div> : <OwnerRuntimeBoundary
            ownerAuthoringEnabled={ownerAuthoringEnabled}
            workspaceProfileAddress={connectedWorkspaceProfileAddress}
            getWalletPublicationContext={getWalletPublicationContext}
            visitorWalletConnected={visitorWalletConnected}
            viewedProfileAddress={viewedProfileAddress}
            onVisitProfile={visitProfile}
            connectedProfile={connectedProfile}
            onConnect={requestStandaloneSignIn}
            onDisconnect={disconnectStandalone}
            onEnterMyWorld={enterConnectedWorld}
            interfaceVisible={interfaceVisible}
            onPreviewDocumentChange={setPreviewDocument}
            registerWorldContextMenu={registerDesktopContextMenu}
            onGalleryOpenChange={setGalleryActive}
            publishedResolution={publishedResolution}
            onPublicationConfirmed={retryPublishedProfile}
          /> : <PublishedProfileBoundary address={viewedProfileAddress} resolution={publishedResolution}
            connectedProfile={connectedProfile} onConnect={requestStandaloneSignIn}
            onDisconnect={disconnectStandalone} onEnterMyWorld={enterConnectedWorld}
            onRetry={retryPublishedProfile}
            returnProfileAddress={profileTarget.source === PROFILE_TARGET_SOURCE.EXPLICIT
              ? verifiedOwnerProfileAddress
              : null}
            onVisitProfile={visitProfile} />}
      </StartupDestinationBoundary>
      </StartupDestinationContext.Provider>
      </div>
      <Startveil
        connectedProfile={connectedProfile}
        ready={entryDestinationReady}
        portal={publicEntryPortal}
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
