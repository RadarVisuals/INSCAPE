import { useRef } from 'react';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle } from '../../lattice/rendering/latticeGeometry.js';

export default function OwnerShellSystemCanvas({
  canvasRef,
  cropPlacementId,
  drag,
  entries,
  gridDisplay,
  gridDotSize,
  marquee,
  onCanvasPointerDown,
  onPlacementClick,
  onPlacementDoubleClick,
  onPlacementKeyDown,
  onPlacementPointerDown,
  onPlacementRef,
  onResizePointerDown,
  preview,
  selectedPlacement,
  selectedPlacementCount,
  selectionBounds,
  viewerPlacementId,
}) {
  const retainedSelectionRef = useRef(null);
  const activeSelection = selectionBounds && selectedPlacement ? {
    bounds: selectionBounds,
    count: selectedPlacementCount,
    placement: selectedPlacement,
  } : null;
  if (activeSelection) retainedSelectionRef.current = activeSelection;
  const renderedSelection = activeSelection || retainedSelectionRef.current;

  return <section aria-label="Central lattice" className="owner-shell-system__canvas" data-grid-display={gridDisplay} onPointerDown={onCanvasPointerDown} ref={canvasRef}
    style={{ '--prototype-grid-dot-size': `${gridDotSize}px` }}>
    {entries.map(({ asset, cropping, placement, selected, visibleCrop }, index) => {
      const mediaOpening = { left: 0, top: 0, width: placement.width, height: placement.height };
      const mediaDimensions = asset ? { width: asset.width, height: asset.height } : null;
      const imageRectangle = asset
        ? visibleCrop
          ? projectCroppedMediaRectangle(mediaOpening, mediaDimensions, visibleCrop)
          : fitNativeMediaRectangle(mediaOpening, mediaDimensions)
        : null;
      const ownerLocked = placement.locked && !preview;
      return <div aria-disabled={ownerLocked || undefined} aria-label={`Select ${asset?.title || 'artwork'}`} aria-pressed={selected}
        className="owner-shell-system__placement" data-cropped={Boolean(visibleCrop) || undefined} data-cropping={cropping || undefined}
        data-locked={placement.locked || undefined}
        data-viewing={viewerPlacementId === placement.id || undefined} key={placement.id}
        onClick={(event) => onPlacementClick(event, placement)}
        onDoubleClick={(event) => onPlacementDoubleClick(event, placement)}
        onKeyDown={(event) => onPlacementKeyDown(event, placement)}
        onPointerDown={(event) => onPlacementPointerDown(event, placement, cropping)}
        ref={(node) => onPlacementRef(placement.id, node)} role="button"
        style={{ left: placement.left, top: placement.top, width: placement.width, height: placement.height, zIndex: index + 1 }} tabIndex={ownerLocked ? -1 : 0}>
        <img alt="" draggable="false" src={asset?.src} style={imageRectangle ? {
          height: imageRectangle.height,
          left: imageRectangle.left,
          position: 'absolute',
          top: imageRectangle.top,
          width: imageRectangle.width,
        } : undefined} /><span>{asset?.title}</span>
      </div>;
    })}
    {renderedSelection && <div aria-hidden={Boolean(viewerPlacementId) || !activeSelection} className="owner-shell-system__selection-chrome"
      data-cropping={cropPlacementId === renderedSelection.placement.id || undefined}
      data-group={renderedSelection.count > 1 || undefined} data-selected={Boolean(activeSelection) || undefined}
      data-viewing={Boolean(viewerPlacementId) || undefined}>
      <div aria-hidden="true" className="owner-shell-system__selection-outline" style={{
        height: renderedSelection.bounds.bottom - renderedSelection.bounds.top,
        left: renderedSelection.bounds.left,
        top: renderedSelection.bounds.top,
        width: renderedSelection.bounds.right - renderedSelection.bounds.left,
      }} />
      {['nw', 'ne', 'se', 'sw'].map((corner) => {
        const east = corner.includes('e');
        const south = corner.includes('s');
        return <button aria-label={`Resize selection from ${corner}`} className={`owner-shell-system__resize-handle is-${corner}`} key={corner}
          disabled={Boolean(viewerPlacementId) || !activeSelection}
          onPointerDown={(event) => onResizePointerDown(event, renderedSelection.placement, corner)}
          style={{ left: (east ? renderedSelection.bounds.right : renderedSelection.bounds.left) - 4, top: (south ? renderedSelection.bounds.bottom : renderedSelection.bounds.top) - 4, zIndex: entries.length + 12 }} type="button" />;
      })}
    </div>}
    {marquee && <div aria-hidden="true" className="owner-shell-system__marquee" style={marquee} />}
    {drag?.moved && drag.previewRectangle && <div aria-hidden="true" className="owner-shell-system__placement-preview" style={drag.previewRectangle}>
      <img alt="" src={drag.asset.previewSrc} /><span>{drag.asset.title} / RELEASE TO PLACE</span>
    </div>}
  </section>;
}
