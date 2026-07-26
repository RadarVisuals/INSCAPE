import { useCallback, useEffect, useRef, useState } from 'react';
import { clampVerticalHomeWorldCamera, loadHomeWorldCamera, saveHomeWorldCamera } from './homeWorldCamera.js';
import { getSpatialGridOffset } from './spatialWorldCamera.js';
import { SPATIAL_WORLD_LEVEL } from './spatialWorldLevels.js';

const DOCK_COLLAPSE_MS = 170;
const WORLD_TRANSITION_MS = 720;

function clearTimer(timerRef) {
  if (!timerRef.current) return;
  clearTimeout(timerRef.current);
  timerRef.current = 0;
}

export function useSpatialWorldNavigation({
  canvasObjects,
  geometry,
  homeOrigin,
  homeWorld,
  libraryAssetById,
  libraryStatus,
  loadLibrary,
  onGalleryOpenChange,
  ownerAuthoringEnabled,
  prepareSpatialLevel,
  profileAddress,
  reducedMotion
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTransitionPhase, setGalleryTransitionPhase] = useState('home');
  const [upperOpen, setUpperOpen] = useState(false);
  const [upperTransitionPhase, setUpperTransitionPhase] = useState('home');
  const [homeGridPhaseX, setHomeGridPhaseX] = useState(0);
  const [homeCameraState, setHomeCameraState] = useState(() => ({
    profileAddress,
    camera: loadHomeWorldCamera(window.localStorage, profileAddress, { x: geometry.width, y: geometry.height, zoom: 1 })
  }));
  const galleryTransitionTimerRef = useRef(0);
  const upperTransitionTimerRef = useRef(0);
  const galleryCameraXRef = useRef(0);
  const galleryGridBasePhaseXRef = useRef(0);
  const homeCameraRef = useRef(homeCameraState.camera);

  const homeCamera = geometry.narrow || homeCameraState.profileAddress !== profileAddress
    ? homeOrigin
    : clampVerticalHomeWorldCamera(homeCameraState.camera, homeWorld, homeOrigin.x);
  homeCameraRef.current = homeCamera;
  const gridSpacing = geometry.narrow ? 56 : 80;
  const homeGridScreenOffsetY = getSpatialGridOffset(homeCamera, gridSpacing).y;
  const galleryGridOffsetY = ((homeGridScreenOffsetY - geometry.height) % gridSpacing + gridSpacing) % gridSpacing;
  const upperGridOffsetY = ((homeGridScreenOffsetY + geometry.height) % gridSpacing + gridSpacing) % gridSpacing;
  const homeWorldMounted = (!galleryOpen && !upperOpen)
    || ['preparing', 'entering', 'exiting'].includes(galleryTransitionPhase)
    || ['preparing', 'entering', 'exiting'].includes(upperTransitionPhase);
  const galleryWorldMounted = galleryOpen && galleryTransitionPhase !== 'preparing';
  const upperWorldMounted = upperOpen && upperTransitionPhase !== 'preparing';
  const homeWorldTransitionPhase = upperOpen
    ? upperTransitionPhase === 'entering' ? 'entering-upper' : upperTransitionPhase === 'exiting' ? 'exiting-upper' : 'home'
    : galleryTransitionPhase;
  const spatialLevel = upperOpen
    ? SPATIAL_WORLD_LEVEL.UPPER
    : galleryOpen ? SPATIAL_WORLD_LEVEL.GALLERY : SPATIAL_WORLD_LEVEL.HOME;
  const spatialLevelTransitioning = galleryOpen && galleryTransitionPhase !== 'gallery'
    || upperOpen && upperTransitionPhase !== 'upper';

  const setHomeCameraImmediately = useCallback((camera) => {
    const verticalCamera = clampVerticalHomeWorldCamera(camera, homeWorld, homeOrigin.x);
    homeCameraRef.current = verticalCamera;
    setHomeCameraState({ profileAddress, camera: verticalCamera });
  }, [homeOrigin.x, homeWorld, profileAddress]);

  useEffect(() => {
    setHomeCameraState({
      profileAddress,
      camera: clampVerticalHomeWorldCamera(loadHomeWorldCamera(window.localStorage, profileAddress, homeOrigin), homeWorld, homeOrigin.x)
    });
  }, [homeOrigin, homeWorld, profileAddress]);

  useEffect(() => {
    if (homeCameraState.profileAddress !== profileAddress) return;
    const timeout = window.setTimeout(() => saveHomeWorldCamera(window.localStorage, profileAddress, homeCameraState.camera), 140);
    return () => window.clearTimeout(timeout);
  }, [homeCameraState, profileAddress]);

  useEffect(() => () => {
    clearTimer(galleryTransitionTimerRef);
    clearTimer(upperTransitionTimerRef);
  }, []);

  const exitGallery = useCallback(() => {
    if (!galleryOpen || galleryTransitionPhase !== 'gallery') return;
    clearTimer(galleryTransitionTimerRef);
    const inheritedPhase = getSpatialGridOffset({ x: galleryCameraXRef.current - galleryGridBasePhaseXRef.current, y: 0 }, gridSpacing).x;
    setHomeGridPhaseX(inheritedPhase);
    setGalleryTransitionPhase('exiting');
    galleryTransitionTimerRef.current = window.setTimeout(() => {
      galleryTransitionTimerRef.current = 0;
      setGalleryOpen(false);
      setGalleryTransitionPhase('home');
      window.requestAnimationFrame(() => {
        const galleryButton = document.querySelector('.gallery-navigation-card[data-visible] > button');
        (galleryButton || document.querySelector('.profile-identity-card__avatar'))?.focus();
      });
    }, reducedMotion ? 1 : WORLD_TRANSITION_MS);
  }, [galleryOpen, galleryTransitionPhase, gridSpacing, reducedMotion]);

  const enterGallery = useCallback(() => {
    if (galleryOpen || upperOpen) return;
    const galleryAssetsMissing = canvasObjects.some((object) => !libraryAssetById.has(object.stableAssetId));
    if (ownerAuthoringEnabled && galleryAssetsMissing && libraryStatus !== 'loading') void loadLibrary();
    clearTimer(galleryTransitionTimerRef);
    galleryCameraXRef.current = 0;
    galleryGridBasePhaseXRef.current = homeGridPhaseX;
    prepareSpatialLevel('gallery');
    setGalleryOpen(true);
    setGalleryTransitionPhase(reducedMotion ? 'entering' : 'preparing');
    const preparation = reducedMotion ? 0 : DOCK_COLLAPSE_MS;
    const duration = reducedMotion ? 1 : WORLD_TRANSITION_MS;
    galleryTransitionTimerRef.current = window.setTimeout(() => {
      setGalleryTransitionPhase('entering');
      galleryTransitionTimerRef.current = window.setTimeout(() => {
        galleryTransitionTimerRef.current = 0;
        setGalleryTransitionPhase('gallery');
      }, duration);
    }, preparation);
  }, [canvasObjects, galleryOpen, homeGridPhaseX, libraryAssetById, libraryStatus, loadLibrary, ownerAuthoringEnabled, prepareSpatialLevel, reducedMotion, upperOpen]);

  const exitUpper = useCallback(() => {
    if (!upperOpen || upperTransitionPhase !== 'upper') return;
    clearTimer(upperTransitionTimerRef);
    setUpperTransitionPhase('exiting');
    upperTransitionTimerRef.current = window.setTimeout(() => {
      upperTransitionTimerRef.current = 0;
      setUpperOpen(false);
      setUpperTransitionPhase('home');
    }, reducedMotion ? 1 : WORLD_TRANSITION_MS);
  }, [reducedMotion, upperOpen, upperTransitionPhase]);

  const enterUpper = useCallback(() => {
    if (upperOpen || galleryOpen) return;
    clearTimer(upperTransitionTimerRef);
    prepareSpatialLevel('upper');
    setUpperOpen(true);
    setUpperTransitionPhase(reducedMotion ? 'entering' : 'preparing');
    const preparation = reducedMotion ? 0 : DOCK_COLLAPSE_MS;
    const duration = reducedMotion ? 1 : WORLD_TRANSITION_MS;
    upperTransitionTimerRef.current = window.setTimeout(() => {
      setUpperTransitionPhase('entering');
      upperTransitionTimerRef.current = window.setTimeout(() => {
        upperTransitionTimerRef.current = 0;
        setUpperTransitionPhase('upper');
      }, duration);
    }, preparation);
  }, [galleryOpen, prepareSpatialLevel, reducedMotion, upperOpen]);

  useEffect(() => {
    onGalleryOpenChange?.(galleryOpen);
    return () => { if (galleryOpen) onGalleryOpenChange?.(false); };
  }, [galleryOpen, onGalleryOpenChange]);

  return {
    enterGallery, enterUpper, exitGallery, exitUpper,
    galleryGridBasePhaseX: galleryGridBasePhaseXRef.current,
    galleryGridOffsetY, galleryOpen, galleryTransitionPhase, galleryWorldMounted,
    homeCamera, homeCameraRef, homeGridPhaseX, homeWorldMounted, homeWorldTransitionPhase,
    setGalleryCameraX: (cameraX) => galleryCameraXRef.current = cameraX,
    setHomeCameraImmediately, spatialLevel, spatialLevelTransitioning,
    upperGridOffsetY, upperOpen, upperTransitionPhase, upperWorldMounted
  };
}
