// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APPLICATION_MODES,
  createApplicationModeUrl,
  resolveApplicationMode
} from './app/appMode.js';
import ArtCanvas from './components/Canvas/ArtCanvas';
import OwnerRuntimeBoundary from './public/OwnerRuntimeBoundary.jsx';
import { AssetResolver } from './engine/assets/AssetResolver.js';
import { Startveil } from './startveil/index.js';
import { useStore } from './store/useStore.js';
import { useWalletStore } from './store/useWalletStore.js';
import { resolveLibraryProfile, resolveWorkspaceProfile } from './library/config.js';
import { loadRestoredPresentation } from './profileDocument/storage/profileDocumentStorage.js';
import { createViewedProfileUrl, resolveViewedProfile } from './profileDiscovery/viewedProfileUrl.js';
import PublishedProfileBoundary from './profileDocument/components/PublishedProfileBoundary.jsx';
import { resolveOwnerAuthoringEnabled, selectPublicProfileRoute } from './public/publicAccess.js';

const AtelierExperience = lazy(() => import('./app/AtelierExperience.jsx'));

function AtelierLoadingFallback() {
  return <div className="mode-loading" role="status">Opening Atelier…</div>;
}

function App() {
  const canvasRef = useRef(null);
  const desktopContextMenuRef = useRef(null);
  const [applicationMode, setApplicationMode] = useState(() => resolveApplicationMode(window.location));
  const routeWorkspaceProfileAddress = useMemo(() => resolveLibraryProfile(window.location), []);
  const [viewedProfileAddress, setViewedProfileAddress] = useState(() => resolveViewedProfile(window.location, routeWorkspaceProfileAddress));
  const [worldReady, setWorldReady] = useState(false);
  const [revealStage, setRevealStage] = useState('sealed');
  const [revealPresentation, setRevealPresentation] = useState({
    sequence: 'full',
    reducedMotion: false
  });
  const [previewDocument, setPreviewDocument] = useState(null);
  const [publishedDocument, setPublishedDocument] = useState(null);
  const [keeperUserVisible, setKeeperUserVisible] = useState(true);
  const [stageUserVisible, setStageUserVisible] = useState(true);
  const [galleryActive, setGalleryActive] = useState(false);
  const activeActorId = useStore((state) => state.renderConfig.actor.id);
  const activeStageId = useStore((state) => state.renderConfig.scene.background.backdropId);
  const activeEnvironment = useStore((state) => state.renderConfig.scene.environment);
  const visitorWalletConnected = useWalletStore((state) => state.isWalletConnected);
  const ownershipVerified = useWalletStore((state) => state.isHostProfileOwner);
  const verifiedOwnerProfileAddress = useWalletStore((state) => state.hostProfileAddress);
  const initWallet = useWalletStore((state) => state.initWallet);
  const scheduleWalletRelease = useWalletStore((state) => state.scheduleWalletRelease);
  const applyRenderConfig = useStore((state) => state.applyRenderConfig);
  const loadActorPresets = useStore((state) => state.loadActorPresets);
  const connectedWorkspaceProfileAddress = resolveWorkspaceProfile(verifiedOwnerProfileAddress, {
    search: routeWorkspaceProfileAddress ? `?profile=${routeWorkspaceProfileAddress}` : ''
  });
  const worldVisible = ['world', 'resident', 'interface', 'complete'].includes(revealStage);
  const actorVisible = ['resident', 'interface', 'complete'].includes(revealStage);
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
  const canvasDocument = localOwnerRoute ? previewDocument : publishedDocument;

  useEffect(() => {
    initWallet();
    return () => scheduleWalletRelease();
  }, [initWallet, scheduleWalletRelease]);

  useEffect(() => {
    const syncModeFromUrl = () => {
      setApplicationMode(resolveApplicationMode(window.location));
      setViewedProfileAddress(resolveViewedProfile(window.location, connectedWorkspaceProfileAddress));
    };
    syncModeFromUrl();
    window.addEventListener('popstate', syncModeFromUrl);
    return () => window.removeEventListener('popstate', syncModeFromUrl);
  }, [connectedWorkspaceProfileAddress]);

  const applyPublicPresentation = useCallback(({ keeperId, stageId, environment }) => {
    const current = useStore.getState().renderConfig;
    applyRenderConfig({ ...current, actor: { ...current.actor, id: keeperId },
      scene: { ...current.scene,
        environment: environment || current.scene.environment,
        background: { ...current.scene.background, backdropId: stageId } } });
  }, [applyRenderConfig]);

  useEffect(() => {
    if (!ownerAuthoringEnabled) return;
    loadActorPresets();
    const restored = loadRestoredPresentation(window.localStorage, connectedWorkspaceProfileAddress);
    if (restored) applyPublicPresentation(restored);
  }, [applyPublicPresentation, connectedWorkspaceProfileAddress, loadActorPresets, ownerAuthoringEnabled]);

  const changeApplicationMode = useCallback((mode) => {
    const nextUrl = createApplicationModeUrl(window.location, mode);
    window.history.pushState({ applicationMode: mode }, '', nextUrl);
    setApplicationMode(mode);
  }, []);

  const visitProfile = useCallback((address) => {
    const nextUrl = createViewedProfileUrl(window.location, address, connectedWorkspaceProfileAddress);
    window.history.pushState({ viewedProfileAddress: address }, '', nextUrl);
    setViewedProfileAddress(resolveViewedProfile(window.location, connectedWorkspaceProfileAddress));
  }, [connectedWorkspaceProfileAddress]);

  const residentHandoff = useMemo(() => ({
    start(bounds, options) {
      return canvasRef.current?.startResidentHandoff(bounds, options);
    },
    updateBounds(bounds) {
      return canvasRef.current?.updateResidentHandoffBounds(bounds);
    },
    exit(bounds, options) {
      return canvasRef.current?.exitResidentHandoff(bounds, options);
    },
    cancel() {
      canvasRef.current?.cancelResidentHandoff();
    },
    trackActorPosition(target) {
      canvasRef.current?.setActorScreenPositionTarget(target);
    },
    moveToScreenPosition(clientX, clientY) {
      canvasRef.current?.moveActorToScreenPosition(clientX, clientY);
    },
    moveHorizontallyToScreenPosition(clientX, direction) {
      canvasRef.current?.moveActorHorizontallyToScreenPosition(clientX, direction);
    }
  }), []);

  const keeperReactions = useMemo(() => ({
    getAvailability() {
      return canvasRef.current?.getKeeperReactionAvailability?.();
    },
    trigger(reactionType) {
      return canvasRef.current?.triggerKeeperReaction?.(reactionType);
    }
  }), []);

  const handleUserGesture = useCallback(() => {
    canvasRef.current?.acknowledgeUserGesture();
  }, []);

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
        <div id="keeper-dock-underlay" className="application-resident-underlay" />
        <div className="application-resident-canvas">
          <ArtCanvas
            ref={canvasRef}
            actorVisible={actorVisible && keeperUserVisible && (effectiveApplicationMode === APPLICATION_MODES.ATELIER || localOwnerRoute || Boolean(publishedDocument))}
            stageVisible={effectiveApplicationMode === APPLICATION_MODES.ATELIER && stageUserVisible}
            foregroundOnly={effectiveApplicationMode === APPLICATION_MODES.PUBLIC}
            reducedMotion={revealPresentation.reducedMotion}
            presentationOverride={canvasDocument?.presentation || null}
            onReady={() => setWorldReady(true)}
          />
        </div>
      </div>
      <div
        className="application-interface"
        data-visible={interfaceVisible || undefined}
        aria-hidden={!interfaceVisible}
        inert={interfaceVisible ? undefined : ''}
      >
        {effectiveApplicationMode === APPLICATION_MODES.ATELIER ? (
          <Suspense fallback={<AtelierLoadingFallback />}>
            <AtelierExperience onRequestPublic={() => changeApplicationMode(APPLICATION_MODES.PUBLIC)} />
          </Suspense>
        ) : (
          localOwnerRoute ? <OwnerRuntimeBoundary
            ownerAuthoringEnabled={ownerAuthoringEnabled}
            workspaceProfileAddress={connectedWorkspaceProfileAddress}
            getWalletPublicationContext={getWalletPublicationContext}
            visitorWalletConnected={visitorWalletConnected}
            viewedProfileAddress={viewedProfileAddress}
            onVisitProfile={visitProfile}
            onRequestAtelier={() => changeApplicationMode(APPLICATION_MODES.ATELIER)}
            activeActorId={activeActorId}
            stageId={activeStageId}
            environment={activeEnvironment}
            avatarSrc={AssetResolver.resolveActorAvatarPath(activeActorId)}
            residentHandoff={residentHandoff}
            keeperReactions={keeperReactions}
            interfaceVisible={interfaceVisible}
            revealPresentation={revealPresentation}
            onApplyRestoredPresentation={applyPublicPresentation}
            onPreviewDocumentChange={setPreviewDocument}
            keeperVisible={keeperUserVisible}
            stageVisible={false}
            onKeeperVisibilityChange={setKeeperUserVisible}
            onStageVisibilityChange={setStageUserVisible}
            registerWorldContextMenu={registerDesktopContextMenu}
            onGalleryOpenChange={setGalleryActive}
          /> : <PublishedProfileBoundary address={viewedProfileAddress}
            returnProfileAddress={connectedWorkspaceProfileAddress}
            onVisitProfile={visitProfile}
            onDocumentChange={setPublishedDocument}
            onMoveKeeper={residentHandoff.moveToScreenPosition} />
        )}
      </div>
      <Startveil
        ready={worldReady}
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
