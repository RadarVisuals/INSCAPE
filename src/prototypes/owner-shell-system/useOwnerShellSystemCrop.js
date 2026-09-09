import { useEffect, useRef, useState } from 'react';
import {
  createLatticeProductionCropPanGesture,
  createLatticeProductionCropSession,
  setLatticeProductionCropZoom,
  updateLatticeProductionCropPanGesture,
} from '../../lattice/authoring/latticeProductionCrop.js';

export default function useOwnerShellSystemCrop({ assets, onNotice, setPlacements }) {
  const [cropSession, setCropSession] = useState(null);
  const cropDragRef = useRef(null);
  const closeCropSession = () => setCropSession(null);

  const beginCrop = (placement) => {
    if (!placement) return;
    const asset = assets.find(({ stableAssetId }) => stableAssetId === placement.assetId);
    if (!asset) return;
    setCropSession({ ...createLatticeProductionCropSession(placement, {
      height: asset.height,
      stableAssetId: asset.stableAssetId,
      width: asset.width,
    }, { left: 0, top: 0, width: placement.width, height: placement.height }),
    interacted: false,
    startPlacement: { ...placement },
    });
  };
  const cancelCrop = () => {
    if (!cropSession) return;
    const startPlacement = cropSession.startPlacement;
    setPlacements((current) => current.map((placement) => placement.id === cropSession.placementId
      ? { ...placement, crop: startPlacement.crop, height: startPlacement.height, left: startPlacement.left, top: startPlacement.top, width: startPlacement.width }
      : placement));
    closeCropSession();
  };
  const updateCropZoom = (zoom) => setCropSession((current) => current && ({
    ...current,
    dirty: true,
    interacted: true,
    previewCrop: setLatticeProductionCropZoom(current.previewCrop, current.media, current.mask, zoom),
  }));
  const restoreNativeFit = () => {
    if (!cropSession) return;
    setPlacements((current) => current.map((placement) => placement.id === cropSession.placementId
      ? { ...placement, crop: null }
      : placement));
    closeCropSession();
    onNotice('NATIVE FIT RESTORED IN SESSION STUDY');
  };
  const applyCrop = () => {
    if (!cropSession) return;
    setPlacements((current) => current.map((placement) => placement.id === cropSession.placementId
      ? { ...placement, crop: { ...cropSession.previewCrop } }
      : placement));
    closeCropSession();
    onNotice('CROP APPLIED IN SESSION STUDY');
  };
  const finishCrop = () => {
    if (!cropSession) return;
    if (cropSession.interacted) applyCrop();
    else cancelCrop();
  };
  const updateCropPlacementGeometry = (placement) => {
    if (!placement) return;
    setCropSession((current) => {
      if (!current || current.placementId !== placement.id) return current;
      const mask = { left: 0, top: 0, width: placement.width, height: placement.height };
      return {
        ...current,
        dirty: true,
        interacted: true,
        mask,
        previewCrop: setLatticeProductionCropZoom(current.previewCrop, current.media, mask, current.previewCrop.zoom),
      };
    });
  };

  const cleanupCropDrag = () => {
    const active = cropDragRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.listeners.move, true);
    globalThis.removeEventListener('pointerup', active.listeners.finish, true);
    globalThis.removeEventListener('pointercancel', active.listeners.finish, true);
    if (active.target?.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    cropDragRef.current = null;
  };
  const updateCropFromPointer = (event) => {
    const active = cropDragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const gesture = updateLatticeProductionCropPanGesture(active.gesture, { x: event.clientX, y: event.clientY });
    active.gesture = gesture;
    if (gesture.activated) setCropSession((current) => current && ({
      ...current,
      dirty: true,
      interacted: true,
      previewCrop: { ...gesture.previewCrop },
    }));
  };
  const finishCropDrag = (event) => {
    if (cropDragRef.current?.pointerId !== event.pointerId) return;
    cleanupCropDrag();
  };
  const beginCropDrag = (event, placementId) => {
    if (cropSession?.placementId !== placementId || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const listeners = { finish: finishCropDrag, move: updateCropFromPointer };
    cropDragRef.current = {
      gesture: createLatticeProductionCropPanGesture(cropSession, { x: event.clientX, y: event.clientY }),
      listeners,
      pointerId: event.pointerId,
      target: event.currentTarget,
    };
    globalThis.addEventListener('pointermove', listeners.move, true);
    globalThis.addEventListener('pointerup', listeners.finish, true);
    globalThis.addEventListener('pointercancel', listeners.finish, true);
  };

  useEffect(() => {
    if (!cropSession) return undefined;
    const completeCropFromKeyboard = (event) => {
      if (event.key === 'Escape') cancelCrop();
      else if (event.key === 'Enter') applyCrop();
      else return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };
    globalThis.addEventListener('keydown', completeCropFromKeyboard, true);
    return () => globalThis.removeEventListener('keydown', completeCropFromKeyboard, true);
  }, [cropSession]);

  useEffect(() => () => {
    const active = cropDragRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.listeners.move, true);
    globalThis.removeEventListener('pointerup', active.listeners.finish, true);
    globalThis.removeEventListener('pointercancel', active.listeners.finish, true);
    if (active.target?.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
  }, []);

  return {
    applyCrop,
    beginCrop,
    beginCropDrag,
    cancelCrop,
    cropSession,
    finishCrop,
    restoreNativeFit,
    updateCropPlacementGeometry,
    updateCropZoom,
  };
}
