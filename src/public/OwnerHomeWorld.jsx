import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HomeWorldSurface from './HomeWorldSurface.jsx';
import FramedArtwork from './FramedArtwork.jsx';
import OwnerFolderRack from './OwnerFolderRack.jsx';
import { exceedsSpatialPointerDragThreshold, shouldActivateSpatialPointer } from './spatialWorldCamera.js';
import {
  createPublishedVisitorLayout,
  publishedItemPixelRect,
  publishedNavigatorLocations,
  publishedWorldTransform
} from '../profileDocument/domain/publishedVisitorWorld.js';
import { createOwnerWorldLayoutDocument } from './ownerWorldProjection.js';
import './ownerDirectManipulation.css';

const viewportSize = () => ({ width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 });

export default function OwnerHomeWorld({ document, objects, assets, camera, theme, rackBoard, arranging, selectedId,
  spatialRef, setObjectRef, interactionProps, resizeProps, onCameraChange, onMoveKeeper, onOpenWorldContextMenu,
  onOpenObjectContextMenu, onActivate, onEdit, controls, folderPanel }) {
  const [viewport, setViewport] = useState(viewportSize);
  const compactTapRef = useRef({ activePointers: new Set(), candidate: null, multiTouch: false });
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const canvasDocument = useMemo(() => createOwnerWorldLayoutDocument(document, objects, assets), [assets, document, objects]);
  const layout = useMemo(() => createPublishedVisitorLayout(canvasDocument, viewport.width, viewport.height), [canvasDocument, viewport]);
  const activeCamera = layout.geometry.narrow ? layout.camera : camera;

  useEffect(() => {
    const resize = () => setViewport(viewportSize());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

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

  const transform = publishedWorldTransform(layout, activeCamera);
  const locations = useMemo(() => publishedNavigatorLocations(layout).filter((location) => location.kind !== 'launcher'), [layout]);
  return <main className="public-shell published-home-world owner-home-world" data-interface-visible data-preview-mode="owner" tabIndex="-1" aria-label="Owner profile world" style={theme} onKeyDownCapture={(event) => { if (event.code === 'Space' && event.target.closest?.('button,a[href],[role="button"]')) event.stopPropagation(); }}>
    {rackBoard}
    <HomeWorldSurface camera={activeCamera} geometry={layout.geometry} world={layout.world} locations={locations} gridVisible theme={theme} visible onCameraChange={onCameraChange} onMoveKeeper={onMoveKeeper} onOpenContextMenu={onOpenWorldContextMenu} narrowGestureRef={compactTapRef} />
    <section ref={spatialRef} className="published-home-world__spatial" aria-label="Owner canvas artwork" style={{ width: layout.placementGeometry.usableWidth, height: layout.placementGeometry.usableHeight, transform, '--grid-cell-width': `${layout.geometry.cellWidth}px`, '--grid-cell-height': `${layout.geometry.cellHeight}px` }} onContextMenu={(event) => { if (event.target.closest?.('[data-canvas-object-id]')) return; event.preventDefault(); event.stopPropagation(); onOpenWorldContextMenu?.(event); }} onPointerDown={beginCompactTap} onPointerMove={moveCompactTap} onPointerUp={finishCompactTap} onPointerCancel={(event) => finishCompactTap(event, true)} onPointerLeave={(event) => { if (event.pointerType === 'mouse') finishCompactTap(event, true); }}>
      {layout.objects.map((item) => { const object = objects.find((entry) => entry.id === item.id); const asset = assetById.get(object.stableAssetId) || null; return <FramedArtwork key={object.id} object={{ ...object, position: item.position, span: item.span }} asset={asset} arranging={arranging} compact={layout.geometry.narrow} editable selected={selectedId === object.id} style={{ ...publishedItemPixelRect(item, layout), zIndex: 10 + object.presentationOrder }} containerRef={(node) => setObjectRef?.(object.id, node)} interactionProps={interactionProps?.(object.id)} resizeProps={resizeProps?.(object.id)} onEdit={() => onEdit?.(object.id)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onOpenObjectContextMenu?.(event, object.id); }} onActivate={(event) => onActivate?.(object.id, event)} />; })}
    </section>
    <nav className="owner-rack-home__controls" aria-label="Owner profile controls">
      <output className="owner-rack-home__save-status" data-state={controls.save} aria-live="polite">{controls.save === 'saved' ? 'SAVED DRAFT' : controls.save === 'error' ? 'SAVE FAILED' : 'SAVING...'}</output>
      <button type="button" onClick={controls.workspace}>[ Workspace ]</button>
      {arranging && <button type="button" onClick={controls.done}>[ Done ]</button>}
      <button type="button" aria-expanded={controls.folders} onClick={controls.toggleFolders}>[ Folders ]</button>
      <button type="button" aria-expanded={controls.share} onClick={controls.toggleShare}>[ Share ]</button>
      <button type="button" onClick={controls.atelier}>[ Atelier ]</button>
    </nav>
    {controls.folders && <OwnerFolderRack {...folderPanel} />}
  </main>;
}
