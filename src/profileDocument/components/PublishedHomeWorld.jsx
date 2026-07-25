import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PublishedImage from './PublishedImage.jsx';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import HomeWorldSurface from '../../public/HomeWorldSurface.jsx';
import { clampVerticalHomeWorldCamera } from '../../public/homeWorldCamera.js';
import { exceedsSpatialPointerDragThreshold, shouldActivateSpatialPointer } from '../../public/spatialWorldCamera.js';
import { projectDocumentAsset } from '../domain/documentProjection.js';
import {
  createPublishedVisitorLayout,
  publishedWorldTransform
} from '../domain/publishedVisitorWorld.js';
import ProfileNavigationDock from '../../public/ProfileNavigationDock.jsx';
import { SPATIAL_WORLD_LEVEL } from '../../public/spatialWorldLevels.js';
import { useProfileIdentity } from '../../profileIdentity/index.js';
import { getIdentityProfileViewModel } from '../../public/identity/profileViewModel.js';

const THEME = Object.freeze({ '--os-accent': '#e87945', '--module-accent': '#e87945', '--hu-text': '#eeebdf', '--hu-text-muted': '#a9a59c' });
const GALLERY_TRANSITION_MS = 720;
const GALLERY_DOCK_COLLAPSE_MS = 170;
const GalleryWorld = lazy(() => import('../../public/GalleryWorld.jsx'));
const SpatialLevelNavigation = lazy(() => import('../../public/SpatialLevelNavigation.jsx'));
const NftFlipViewer = lazy(() => import('../../public/NftFlipViewer.jsx'));

function viewportSize() {
  return { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 };
}

export default function PublishedHomeWorld({ document, onMoveKeeper, onExit, onOpenDirectory, onReturn }) {
  const [viewport, setViewport] = useState(viewportSize);
  const layout = useMemo(() => createPublishedVisitorLayout(document, viewport.width, viewport.height), [document, viewport]);
  const [camera, setCamera] = useState(layout.camera);
  const [openArtworkId, setOpenArtworkId] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTransitionPhase, setGalleryTransitionPhase] = useState('home');
  const worldRef = useRef(null);
  const artworkTriggerRef = useRef(null);
  const galleryTransitionTimerRef = useRef(0);
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
  }, [document]);

  useEffect(() => () => {
    if (galleryTransitionTimerRef.current) window.clearTimeout(galleryTransitionTimerRef.current);
  }, []);

  const enterGallery = useCallback(() => {
    if (galleryOpen) return;
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
  }, [galleryOpen]);

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
  return <main ref={worldRef} className="public-shell published-home-world" data-interface-visible data-preview-mode="visitor" data-published-focus-fallback tabIndex="-1" aria-label="Published profile visitor world" style={THEME} onKeyDownCapture={(event) => { if (event.code === 'Space' && event.target.closest?.('button,a[href],[role="button"]')) event.stopPropagation(); }}>
    <ProfileNavigationDock
      profile={publicProfile}
      categories={navigationCategories}
      creations={{ profileAddress: document.profile.address }}
      activity={{ profileAddress: document.profile.address }}
      gallery={{ open: galleryOpen, onOpenChange: (open) => open ? enterGallery() : exitGallery() }}
      spatialWorldActive={galleryOpen}
    />
    <header className="public-shell__masthead published-home-world__header"><div className="system-hud__identity"><h1>[ <span className="system-hud__brand-accent">{onExit ? 'VISITOR PREVIEW' : 'PUBLISHED WORLD'}</span> ]</h1><span className="system-hud__operator">{displayName}</span><span className="system-hud__live"><i aria-hidden="true" />Document v{document.version}</span></div>{(onExit || onOpenDirectory || onReturn) && <nav className="system-hud__commands">{onOpenDirectory && <button type="button" onClick={onOpenDirectory}>[ Directory ]</button>}{onReturn && <button type="button" onClick={onReturn}>[ Return ]</button>}{onExit && <button type="button" onClick={onExit}>[ Exit Preview ]</button>}</nav>}</header>
    {(!galleryOpen || ['preparing', 'entering', 'exiting'].includes(galleryTransitionPhase)) && <HomeWorldSurface camera={camera} geometry={layout.geometry} world={layout.world} gridVisible theme={THEME} visible onCameraChange={setCamera} onMoveKeeper={onMoveKeeper} narrowGestureRef={compactTapRef} transitionPhase={galleryTransitionPhase} />}
    {!galleryOpen && <section className="published-home-world__spatial" aria-label="Published home canvas" style={{ width: layout.placementGeometry.usableWidth, height: layout.placementGeometry.usableHeight, transform, '--grid-cell-width': `${layout.geometry.cellWidth}px`, '--grid-cell-height': `${layout.geometry.cellHeight}px` }} onWheel={handleWorldWheel} onPointerDown={beginCompactTap} onPointerMove={moveCompactTap} onPointerUp={finishCompactTap} onPointerCancel={(event) => finishCompactTap(event, true)} onPointerLeave={(event) => { if (event.pointerType === 'mouse') finishCompactTap(event, true); }} />}
    {galleryOpen && galleryTransitionPhase !== 'preparing' && <Suspense fallback={null}><GalleryWorld
      objects={galleryObjects}
      assets={galleryAssets}
      theme={THEME}
      transitionPhase={galleryTransitionPhase}
      renderImage={(props) => <PublishedImage {...props} />}
      onOpenArtwork={openArtworkPreview}
      onExit={exitGallery}
      onMoveKeeper={onMoveKeeper}
    /></Suspense>}
    <Suspense fallback={null}><SpatialLevelNavigation
      level={galleryOpen ? SPATIAL_WORLD_LEVEL.GALLERY : SPATIAL_WORLD_LEVEL.HOME}
      disabled={galleryOpen && galleryTransitionPhase !== 'gallery'}
      onDown={galleryOpen ? undefined : enterGallery}
      onUp={galleryOpen ? exitGallery : undefined}
    /></Suspense>
    {openArtwork && <Suspense fallback={null}><NftFlipViewer asset={projectDocumentAsset(openArtwork.asset)} onClose={() => setOpenArtworkId(null)} returnFocus={artworkTriggerRef.current} /></Suspense>}
  </main>;
}
