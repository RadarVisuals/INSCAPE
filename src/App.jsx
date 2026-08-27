// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APPLICATION_MODES,
  createApplicationModeUrl,
  resolveApplicationMode
} from './app/appMode.js';
import OwnerRuntimeBoundary from './public/OwnerRuntimeBoundary.jsx';
import { Startveil } from './startveil/index.js';
import { useWalletStore } from './store/useWalletStore.js';
import { resolveLibraryProfile, resolveWorkspaceProfile } from './library/config.js';
import { createSelectedProfileUrl, createViewedProfileUrl, resolveExplicitViewedProfile } from './profileDiscovery/viewedProfileUrl.js';
import {
  PROFILE_TARGET_SOURCE,
  resolveProfileTarget,
  shouldRequestStandaloneSignIn
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

const AtelierExperience = lazy(() => import('./app/AtelierExperience.jsx'));
const PublicDiscoverExperience = lazy(() => import('./profileDiscovery/PublicDiscoverExperience.jsx'));

function AtelierLoadingFallback() {
  return <div className="mode-loading" role="status">Opening Atelier…</div>;
}

function App() {
  const desktopContextMenuRef = useRef(null);
  const standaloneWalletSessionRef = useRef(null);
  const [applicationMode, setApplicationMode] = useState(() => resolveApplicationMode(window.location));
  const routeWorkspaceProfileAddress = useMemo(() => resolveLibraryProfile(window.location), []);
  const [explicitViewedProfileAddress, setExplicitViewedProfileAddress] = useState(() => resolveExplicitViewedProfile(window.location));
  const [retainedPublicProfileAddress, setRetainedPublicProfileAddress] = useState(null);
  const [worldReady, setWorldReady] = useState(false);
  const [revealStage, setRevealStage] = useState('sealed');
  const [revealPresentation, setRevealPresentation] = useState({
    sequence: 'full',
    reducedMotion: false
  });
  const [previewDocument, setPreviewDocument] = useState(null);
  const [standaloneSignInActive, setStandaloneSignInActive] = useState(false);
  const [galleryActive, setGalleryActive] = useState(false);
  const visitorWalletConnected = useWalletStore((state) => state.isWalletConnected);
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
  const worldVisible = ['world', 'resident', 'interface', 'complete'].includes(revealStage);
  const interfaceVisible = ['interface', 'complete'].includes(revealStage);
  const ownerAuthoringEnabled = resolveOwnerAuthoringEnabled({
    ownershipVerified,
    verifiedOwnerProfileAddress,
    workspaceProfileAddress: connectedWorkspaceProfileAddress,
    viewedProfileAddress
  });
  const getWalletPublicationContext = useCallback(() => useWalletStore.getState(), []);
  const effectiveApplicationMode = applicationMode === APPLICATION_MODES.ATELIER && ownerAuthoringEnabled
    ? APPLICATION_MODES.ATELIER
    : APPLICATION_MODES.PUBLIC;
  const publicProfileRoute = selectPublicProfileRoute(ownerAuthoringEnabled);
  const localOwnerRoute = publicProfileRoute === 'LOCAL_OWNER';
  const publicEntryPortal = effectiveApplicationMode === APPLICATION_MODES.PUBLIC
    && !explicitViewedProfileAddress && !routeWorkspaceProfileAddress && !retainedPublicProfileAddress
    && [PROFILE_TARGET_SOURCE.PENDING, PROFILE_TARGET_SOURCE.NONE].includes(profileTarget.source);
  const [publishedResolution, retryPublishedProfile] = usePublishedProfile(viewedProfileAddress);
  const ownerSourceReady = publishedResolution?.status !== PUBLISHED_PROFILE_STATUS.LOADING;

  useEffect(() => setWorldReady(true), []);

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
    const syncModeFromUrl = () => {
      setApplicationMode(resolveApplicationMode(window.location));
      setExplicitViewedProfileAddress(resolveExplicitViewedProfile(window.location));
    };
    syncModeFromUrl();
    window.addEventListener('popstate', syncModeFromUrl);
    return () => window.removeEventListener('popstate', syncModeFromUrl);
  }, [routeWorkspaceProfileAddress]);

  const changeApplicationMode = useCallback((mode) => {
    const nextUrl = createApplicationModeUrl(window.location, mode);
    window.history.pushState({ applicationMode: mode }, '', nextUrl);
    setApplicationMode(mode);
  }, []);

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

  const handleUserGesture = useCallback(() => {
    const signInRequired = shouldRequestStandaloneSignIn({
      embedded: window.parent !== window,
      walletConnected: useWalletStore.getState().isWalletConnected,
      targetSource: profileTarget.source
    });
    if (signInRequired) requestStandaloneSignIn();
  }, [profileTarget.source, requestStandaloneSignIn]);

  const registerDesktopContextMenu = useCallback((handler) => {
    desktopContextMenuRef.current = handler;
  }, []);

  return (
    <div className="application-root" data-application-mode={effectiveApplicationMode} data-startveil-stage={revealStage} data-gallery-active={galleryActive || undefined}>
      <div
        className="application-world"
        data-visible={worldVisible || undefined}
        onContextMenu={(event) => desktopContextMenuRef.current?.(event)}
      >
      </div>
      <div
        className="application-interface"
        data-visible={interfaceVisible || undefined}
        aria-hidden={!interfaceVisible}
        inert={interfaceVisible ? undefined : ''}
      >
        {authorityLifecycleStatus === 'complete' && initializationError && <AlphaSupportPanel compact
          code={ALPHA_SUPPORT_CODES.AUTHORITY_INITIALIZATION_FAILED} phase="OWNER_AUTHORITY"
          providerCategory="UP_PROVIDER" profileAddress={viewedProfileAddress} routeClass="AUTHORITY_ENTRY"
          message={initializationError.message} />}
        {effectiveApplicationMode === APPLICATION_MODES.ATELIER ? (
          <Suspense fallback={<AtelierLoadingFallback />}>
            <AtelierExperience onRequestPublic={() => changeApplicationMode(APPLICATION_MODES.PUBLIC)} />
          </Suspense>
        ) : (
          standaloneSignInActive || publicEntryPortal ? null : profileTarget.pending
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
            onRequestAtelier={() => changeApplicationMode(APPLICATION_MODES.ATELIER)}
            interfaceVisible={interfaceVisible}
            revealPresentation={revealPresentation}
            onPreviewDocumentChange={setPreviewDocument}
            registerWorldContextMenu={registerDesktopContextMenu}
            onGalleryOpenChange={setGalleryActive}
            publishedResolution={publishedResolution}
            onPublicationConfirmed={retryPublishedProfile}
          /> : <PublishedProfileBoundary address={viewedProfileAddress} resolution={publishedResolution}
            onRetry={retryPublishedProfile}
            returnProfileAddress={profileTarget.source === PROFILE_TARGET_SOURCE.EXPLICIT
              ? verifiedOwnerProfileAddress
              : null}
            onVisitProfile={visitProfile} />
        )}
      </div>
      <Startveil
        ready={worldReady}
        portal={publicEntryPortal}
        onConnect={requestStandaloneSignIn}
        onVisitProfile={(address) => visitProfile(address)}
        onUserGesture={handleUserGesture}
        onPresentationMode={setRevealPresentation}
        onRevealWorld={() => setRevealStage('world')}
        onRevealActor={() => setRevealStage('resident')}
        onRevealInterface={() => setRevealStage('interface')}
        onComplete={() => setRevealStage('complete')}
      />
    </div>
  );
}

export default App;
