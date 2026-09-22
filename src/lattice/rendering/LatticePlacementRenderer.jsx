import React from 'react';

import { PLACEMENT_RESIZE_CORNERS } from '../controller/latticePlacementResize.js';
import { projectTableMediaPlacements } from './latticePlacement.js';
import './latticePlacementRenderer.css';

const percentage = (value, total) => `${(value / total) * 100}%`;

export function LatticeArtworkPresentation({ cropEditing = false, entry }) {
  const {
    cropped,
    imageRectangle,
    media,
    mediaRectangle,
    selectionRectangle,
  } = entry;

  return <>
    <div
      className={`lattice-placement-media${cropped ? ' is-cropped' : ''}${cropEditing ? ' is-crop-editing' : ''}`}
      style={{
        left: percentage(mediaRectangle.left - selectionRectangle.left, selectionRectangle.width),
        top: percentage(mediaRectangle.top - selectionRectangle.top, selectionRectangle.height),
        width: percentage(mediaRectangle.width, selectionRectangle.width),
        height: percentage(mediaRectangle.height, selectionRectangle.height),
      }}
    >
      <img
        alt={typeof media.accessibleLabel === 'string' ? media.accessibleLabel : ''}
        draggable="false"
        src={media.src}
        style={{
          left: percentage(imageRectangle.left - mediaRectangle.left, mediaRectangle.width),
          top: percentage(imageRectangle.top - mediaRectangle.top, mediaRectangle.height),
          width: percentage(imageRectangle.width, mediaRectangle.width),
          height: percentage(imageRectangle.height, mediaRectangle.height),
        }}
      />
    </div>
  </>;
}

export default function LatticePlacementRenderer({
  arrangeEnabled = false,
  artboard,
  assetsByStableId,
  cropEditingPlacementId = null,
  framing,
  focusedPlacementId = null,
  onPlacementActivate,
  onPlacementFocus,
  onPlacementPointerDown,
  onPlacementResizePointerDown,
  selectedPlacementId = null,
  table,
  viewport,
}) {
  const renderEntries = projectTableMediaPlacements({ artboard, assetsByStableId, framing, table, viewport });
  const selectedEntry = arrangeEnabled
    ? renderEntries.find(({ placement }) => placement.id === selectedPlacementId)
    : null;

  return (
    <div className={`lattice-placement-layer${arrangeEnabled ? ' is-arranging' : ''}`} data-table-id={table.id}>
      {renderEntries.map((entry) => {
        const { media, placement, selectionRectangle } = entry;
        const viewerEnabled = typeof onPlacementActivate === 'function' && !arrangeEnabled;
        return (
        <div
          aria-label={typeof media.accessibleLabel === 'string' ? media.accessibleLabel : 'Artwork placement'}
          className={`lattice-placement${selectedPlacementId === placement.id ? ' is-selected' : ''}${focusedPlacementId === placement.id ? ' is-viewer-origin' : ''}`}
          data-placement-id={placement.id}
          key={placement.id}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={viewerEnabled ? (event) => onPlacementActivate(event, entry) : undefined}
          onFocus={() => onPlacementFocus?.(placement.id)}
          onKeyDown={viewerEnabled ? (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onPlacementActivate(event, entry);
          } : undefined}
          onPointerDown={(event) => {
            if (viewerEnabled) event.stopPropagation();
            onPlacementPointerDown?.(event, placement);
          }}
          role={arrangeEnabled || viewerEnabled ? 'button' : undefined}
          style={{
            left: selectionRectangle.left,
            top: selectionRectangle.top,
            width: selectionRectangle.width,
            height: selectionRectangle.height,
            zIndex: placement.layer,
          }}
          tabIndex={arrangeEnabled || viewerEnabled ? 0 : undefined}
        >
          <LatticeArtworkPresentation cropEditing={cropEditingPlacementId === placement.id} entry={entry} />
        </div>
        );
      })}
      {selectedEntry && (
        <div
          aria-hidden={cropEditingPlacementId === selectedEntry.placement.id ? undefined : true}
          aria-label={cropEditingPlacementId === selectedEntry.placement.id ? `Edit crop for ${typeof selectedEntry.media.accessibleLabel === 'string' ? selectedEntry.media.accessibleLabel : 'artwork'}` : undefined}
          className={`lattice-placement-selection-overlay${cropEditingPlacementId === selectedEntry.placement.id ? ' is-crop-editing' : ''}`}
          data-crop-placement-id={cropEditingPlacementId === selectedEntry.placement.id ? selectedEntry.placement.id : undefined}
          onPointerDown={cropEditingPlacementId === selectedEntry.placement.id
            ? (event) => onPlacementPointerDown?.(event, selectedEntry.placement)
            : undefined}
          role={cropEditingPlacementId === selectedEntry.placement.id ? 'button' : undefined}
          style={{
            left: cropEditingPlacementId === selectedEntry.placement.id ? selectedEntry.mediaRectangle.left : selectedEntry.selectionRectangle.left,
            top: cropEditingPlacementId === selectedEntry.placement.id ? selectedEntry.mediaRectangle.top : selectedEntry.selectionRectangle.top,
            width: cropEditingPlacementId === selectedEntry.placement.id ? selectedEntry.mediaRectangle.width : selectedEntry.selectionRectangle.width,
            height: cropEditingPlacementId === selectedEntry.placement.id ? selectedEntry.mediaRectangle.height : selectedEntry.selectionRectangle.height,
            zIndex: Math.max(...renderEntries.map(({ placement }) => placement.layer)) + 1,
          }}
          tabIndex={cropEditingPlacementId === selectedEntry.placement.id ? -1 : undefined}
        >
          {cropEditingPlacementId !== selectedEntry.placement.id && PLACEMENT_RESIZE_CORNERS.map((corner) => (
            <span
              className={`lattice-placement-resize-handle is-${corner}`}
              data-resize-corner={corner}
              key={corner}
              onPointerDown={(event) => onPlacementResizePointerDown?.(event, selectedEntry.placement, corner)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
