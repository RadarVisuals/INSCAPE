import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PublishedImage from './PublishedImage.jsx';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import HomeWorldSurface from '../../public/HomeWorldSurface.jsx';
import UpperWorldSurface from '../../public/UpperWorldSurface.jsx';
import { clampVerticalHomeWorldCamera } from '../../public/homeWorldCamera.js';
import { exceedsSpatialPointerDragThreshold, getSpatialGridOffset, shouldActivateSpatialPointer } from '../../public/spatialWorldCamera.js';
import { projectDocumentAsset } from '../domain/documentProjection.js';
import {
  createPublishedVisitorLayout,
  publishedWorldTransform
} from '../domain/publishedVisitorWorld.js';
import ProfileNavigationDock from '../../public/ProfileNavigationDock.jsx';
import { SPATIAL_WORLD_LEVEL } from '../../public/spatialWorldLevels.js';
import { useProfileIdentity } from '../../profileIdentity/index.js';
import { getIdentityProfileViewModel } from '../../public/identity/profileViewModel.js';
import { getPublicTheme } from '../../public/themeTokens.js';

const GALLERY_TRANSITION_MS = 720;
const GALLERY_DOCK_COLLAPSE_MS = 170;
const GalleryWorld = lazy(() => import('../../public/GalleryWorld.jsx'));
const SpatialLevelNavigation = lazy(() => import('../../public/SpatialLevelNavigation.jsx'));
const NftFlipViewer = lazy(() => import('../../public/NftFlipViewer.jsx'));

function viewportSize() {
  return { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 };
}

export default function PublishedHomeWorld({ document, onMoveKeeper, onMoveKeeperHorizontally, onExit, onOpenDirectory, onReturn }) {
  const theme = useMemo(() => getPublicTheme(document.presentation.keeperId), [document.presentation.keeperId]);
  const [viewport, setViewport] = useState(viewportSize);
  const layout = useMemo(() => createPublishedVisitorLayout(document, viewport.width, viewport.height), [document, viewport]);
  const [camera, setCamera] = useState(layout.camera);
  const [openArtworkId, setOpenArtworkId] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTransitionPhase, setGalleryTransitionPhase] = useState('home');
  const [upperOpen, setUpperOpen] = useState(false);
  const [upperTransitionPhase, setUpperTransitionPhase] = useState('home');
  const worldRef = useRef(null);
  const artworkTriggerRef = useRef(null);
  const galleryTransitionTimerRef = useRef(0);
  const upperTransitionTimerRef = useRef(0);
  const compactTapRef = useRef({ activePointers: new Set(), candidate: null, multiTouch: false });
  const cached = document.profile.cachedIdentity;
  const liveIdentity = useProfileIdentity(document.profile.address);
  const liveProfile = useMemo(() => getIdentityProfileViewModel(liveIdentity), [liveIdentity]);
  const cachedAvatarUrl = resolvePublishedAssetUrl(cached.avatarUrl);
  const avatarUrl = liveProfile.metadataResolved ? liveProfile.avatarUrl || cachedAvatarUrl : cachedAvatarUrl;
  const displayName = cached.name || `${document.profile.address.slice(0, 8)}…${document.profile.address.slice(-6)}`;
  const resolvedDisplayName = liveProfile.metadataResolved && liveProfile.name !== 'Unnamed profile' ? liveProfile.name : displayName;
  const publicProfile = useMemo(() => ({
    address: document.profile.address,
    name: resolvedDisplayName,
    avatarUrl,
    bio: liveProfile.metadataResolved ? liveProfile.bio : null,
    tags: liveProfile.metadataResolved ? liveProfile.tags : [],
    links: liveProfile.metadataResolved ? liveProfile.links : []
  }), [avatarUrl, document.profile.address, liveProfile, resolvedDisplayName]);
  const navigationCategories = useMemo(() => document.spaces.map((space) => ({
    id: space.id,
    label: space.label,
    assets: space.assets.map((asset) => projectDocumentAsset(asset))
  })), [document.spaces]);
  const galleryObjects = useMemo(() => document.canvasObjects.map((object) => ({
    ...object,
    stableAssetId: object.asset.stableAssetId,
    visitorVisible: true,
    locked: true,
    presentationOrder: object.order
  })), [document.canvasObjects]);
  const galleryAssets = useMemo(() => document.canvasObjects.map((object) => projectDocumentAsset(object.asset)), [document.canvasObjects]);
  const visitorNavigation = document.presentation.visitorNavigation || { showCategories: true, showCreations: false };

  useEffect(() => {
    const resize = () => setViewport(viewportSize());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    setCamera(layout.camera);
    setOpenArtworkId(null);
    setGalleryOpen(false);
    setGalleryTransitionPhase('home');
    setUpperOpen(false);
    setUpperTransitionPhase('home');
  }, [document]);

  useEffect(() => () => {
    if (galleryTransitionTimerRef.current) window.clearTimeout(galleryTransitionTimerRef.current);
    if (upperTransitionTimerRef.current) window.clearTimeout(upperTransitionTimerRef.current);
  }, []);

  const enterGallery = useCallback(() => {
    if (galleryOpen || upperOpen) return;
    if (galleryTransitionTimerRef.current) window.clearTimeout(galleryTransitionTimerRef.current);
    setGalleryOpen(true);
    setGalleryTransitionPhase('preparing');
    galleryTransitionTimerRef.current = window.setTimeout(() => {
      setGalleryTransitionPhase('entering');
      galleryTransitionTimerRef.current = window.setTimeout(() => {
        galleryTransitionTimerRef.current = 0;
        setGalleryTransitionPhase('gallery');
      }, GALLERY_TRANSITION_MS);
    }, GALLERY_DOCK_COLLAPSE_MS);
  }, [galleryOpen, upperOpen]);

  const exitGallery = useCallback(() => {
    if (!galleryOpen || galleryTransitionPhase !== 'gallery') return;
    if (galleryTransitionTimerRef.current) window.clearTimeout(galleryTransitionTimerRef.current);
    setGalleryTransitionPhase('exiting');
    galleryTransitionTimerRef.current = window.setTimeout(() => {
      galleryTransitionTimerRef.current = 0;
      setGalleryOpen(false);
      setGalleryTransitionPhase('home');
    }, GALLERY_TRANSITION_MS);
  }, [galleryOpen, galleryTransitionPhase]);

  const enterUpper = useCallback(() => {
    if (upperOpen || galleryOpen) return;
    if (upperTransitionTimerRef.current) window.clearTimeout(upperTransitionTimerRef.current);
    setUpperOpen(true);
    setUpperTransitionPhase('preparing');
    upperTransitionTimerRef.current = window.setTimeout(() => {
      setUpperTransitionPhase('entering');
      upperTransitionTimerRef.current = window.setTimeout(() => {
        upperTransitionTimerRef.current = 0;
        setUpperTransitionPhase('upper');
      }, GALLERY_TRANSITION_MS);
    }, GALLERY_DOCK_COLLAPSE_MS);
  }, [galleryOpen, upperOpen]);

  const exitUpper = useCallback(() => {
    if (!upperOpen || upperTransitionPhase !== 'upper') return;
    if (upperTransitionTimerRef.current) window.clearTimeout(upperTransitionTimerRef.current);
    setUpperTransitionPhase('exiting');
    upperTransitionTimerRef.current = window.setTimeout(() => {
      upperTransitionTimerRef.current = 0;
      setUpperOpen(false);
      setUpperTransitionPhase('home');
    }, GALLERY_TRANSITION_MS);
  }, [upperOpen, upperTransitionPhase]);

  useEffect(() => {
    setCamera((current) => layout.geometry.narrow ? layout.camera : clampVerticalHomeWorldCamera(current, layout.world, layout.camera.x));
  }, [layout.geometry.narrow, layout.world, viewport]);

  const openArtworkPreview = useCallback((id, trigger) => {
    artworkTriggerRef.current = trigger?.isConnected ? trigger : null;
    setOpenArtworkId(id);
  }, []);
  const handleWorldWheel = useCallback((event) => {
    if (layout.geometry.narrow) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey || event.deltaY === 0) return;
    setCamera((current) => clampVerticalHomeWorldCamera({ ...current, y:current.y + event.deltaY }, layout.world, layout.camera.x));
  }, [layout.camera.x, layout.geometry.narrow, layout.world]);
  const beginCompactTap = useCallback((event) => {
    if (!layout.geometry.narrow) return;
    const tracking = compactTapRef.current;
    if (event.pointerType !== 'mouse') tracking.activePointers.add(event.pointerId);
    if (tracking.activePointers.size > 1) {
      tracking.multiTouch = true;
      if (tracking.candidate) tracking.candidate.multiTouch = true;
      return;
    }
    const primaryButton = event.pointerType !== 'mouse' || event.button === 0;
    if (!primaryButton || event.isPrimary === false || event.target !== event.currentTarget) return;
    tracking.candidate = { pointerId: event.pointerId, originPointer: { x: event.clientX, y: event.clientY }, moved: false, panning: false, multiTouch: false };
  }, [layout.geometry.narrow]);
  const moveCompactTap = useCallback((event) => {
    const candidate = compactTapRef.current.candidate;
    if (!candidate || candidate.pointerId !== event.pointerId) return;
    candidate.moved ||= exceedsSpatialPointerDragThreshold(candidate.originPointer, { x: event.clientX, y: event.clientY });
  }, []);
  const finishCompactTap = useCallback((event, cancelled = false) => {
    const tracking = compactTapRef.current;
    if (event.pointerType !== 'mouse') tracking.activePointers.delete(event.pointerId);
    const candidate = tracking.candidate;
    if (!candidate || candidate.pointerId !== event.pointerId) {
      if (tracking.activePointers.size === 0) tracking.multiTouch = false;
      return;
    }
    tracking.candidate = null;
    if (shouldActivateSpatialPointer(candidate, cancelled || tracking.multiTouch)) onMoveKeeper?.(event.clientX, event.clientY);
    if (tracking.activePointers.size === 0) tracking.multiTouch = false;
  }, [onMoveKeeper]);

  const openArtwork = document.canvasObjects.find((object) => object.id === openArtworkId) || null;

  const transform = publishedWorldTransform(layout, camera);
  const gridSpacing = layout.geometry.narrow ? 56 : 80;
  const homeGridScreenOffsetY = getSpatialGridOffset(camera, gridSpacing).y;
  const upperGridOffsetY = ((homeGridScreenOffsetY + layout.geometry.height) % gridSpacing + gridSpacing) % gridSpacing;
  const homeTransitionPhase = upperOpen
    ? upperTransitionPhase === 'entering' ? 'entering-upper' : upperTransitionPhase === 'exiting' ? 'exiting-upper' : 'home'
    : galleryTransitionPhase;
  const homeWorldMounted = (!galleryOpen && !upperOpen)
    || ['preparing', 'entering', 'exiting'].includes(galleryTransitionPhase)
    || ['preparing', 'entering', 'exiting'].includes(upperTransitionPhase);
  const spatialLevel = upperOpen
    ? SPATIAL_WORLD_LEVEL.UPPER
    : galleryOpen ? SPATIAL_WORLD_LEVEL.GALLERY : SPATIAL_WORLD_LEVEL.HOME;
  const spatialTransitioning = (galleryOpen && galleryTransitionPhase !== 'gallery')
    || (upperOpen && upperTransitionPhase !== 'upper');
  return <main ref={worldRef} className="public-shell published-home-world" data-interface-visible data-spatial-theme="dark" data-preview-mode="visitor" data-published-focus-fallback tabIndex="-1" aria-label="Published profile visitor world" style={theme} onKeyDownCapture={(event) => { if (event.code === 'Space' && event.target.closest?.('button,a[href],[role="button"]')) event.stopPropagation(); }}>
    <ProfileNavigationDock
      profile={publicProfile}
      avatarShape={document.presentation.avatarShape || 'square'}
      compactProfileSubtitle="VISITING INSCAPE"
      categories={navigationCategories}
      showCategories={visitorNavigation.showCategories}
      creations={visitorNavigation.showCreations ? { profileAddress: document.profile.address } : null}
      gallery={upperOpen ? null : { open: galleryOpen, onOpenChange: (open) => open ? enterGallery() : exitGallery() }}
      spatialWorldActive={galleryOpen || upperOpen}
    />
    {(onExit || onOpenDirectory || onReturn) && <nav className="published-visitor-navigation" aria-label="Visitor navigation">
      {onOpenDirectory && <button type="button" onClick={onOpenDirectory}>DIRECTORY</button>}
      {onReturn && <button type="button" onClick={onReturn}>MY INSCAPE</button>}
      {onExit && <button type="button" onClick={onExit}>EXIT PREVIEW</button>}
    </nav>}
    {homeWorldMounted && <HomeWorldSurface camera={camera} geometry={layout.geometry} world={layout.world} gridVisible theme={theme} visible onCameraChange={setCamera} onMoveKeeper={onMoveKeeper} narrowGestureRef={compactTapRef} transitionPhase={homeTransitionPhase} />}
    {!galleryOpen && !upperOpen && <section className="published-home-world__spatial" aria-label="Published home canvas" style={{ width: layout.placementGeometry.usableWidth, height: layout.placementGeometry.usableHeight, transform, '--grid-cell-width': `${layout.geometry.cellWidth}px`, '--grid-cell-height': `${layout.geometry.cellHeight}px` }} onWheel={handleWorldWheel} onPointerDown={beginCompactTap} onPointerMove={moveCompactTap} onPointerUp={finishCompactTap} onPointerCancel={(event) => finishCompactTap(event, true)} onPointerLeave={(event) => { if (event.pointerType === 'mouse') finishCompactTap(event, true); }} />}
    {galleryOpen && galleryTransitionPhase !== 'preparing' && <Suspense fallback={null}><GalleryWorld
      objects={galleryObjects}
      assets={galleryAssets}
      theme={theme}
      transitionPhase={galleryTransitionPhase}
      renderImage={(props) => <PublishedImage {...props} />}
      onOpenArtwork={openArtworkPreview}
      onExit={exitGallery}
      onMoveKeeper={onMoveKeeper}
      onMoveKeeperHorizontally={onMoveKeeperHorizontally}
    /></Suspense>}
    {upperOpen && upperTransitionPhase !== 'preparing' && <UpperWorldSurface
      theme={theme}
      cameraX={camera.x}
      gridOffsetY={upperGridOffsetY}
      transitionPhase={upperTransitionPhase}
      onMoveKeeper={onMoveKeeper}
    />}
    <Suspense fallback={null}><SpatialLevelNavigation
      level={spatialLevel}
      disabled={spatialTransitioning}
      onDown={upperOpen ? exitUpper : enterGallery}
      onUp={galleryOpen ? exitGallery : enterUpper}
    /></Suspense>
    {openArtwork && <Suspense fallback={null}><NftFlipViewer asset={projectDocumentAsset(openArtwork.asset)} onClose={() => setOpenArtworkId(null)} returnFocus={artworkTriggerRef.current} /></Suspense>}
  </main>;
}
