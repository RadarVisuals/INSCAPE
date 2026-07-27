import React from 'react';

import { PLACEMENT_RESIZE_CORNERS } from '../controller/latticePlacementResize.js';
import { TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import { projectTableMediaPlacements } from './latticePlacement.js';
import './latticePlacementRenderer.css';

export default function LatticePlacementRenderer({
  arrangeEnabled = false,
  artboard,
  assetsByStableId,
  cropEditingPlacementId = null,
  framing,
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
      {renderEntries.map(({ cropped, imageRectangle, media, mediaRectangle, placement, transparencyMode }) => (
        <div
          aria-label={typeof media.accessibleLabel === 'string' ? media.accessibleLabel : 'Artwork placement'}
          className={`lattice-placement-media${cropped ? ' is-cropped' : ''}${cropEditingPlacementId === placement.id ? ' is-crop-editing' : ''}${transparencyMode === TRANSPARENCY_MODES.OPAQUE ? ' is-opaque' : ''}${selectedPlacementId === placement.id ? ' is-selected' : ''}`}
          data-placement-id={placement.id}
          data-transparency-mode={transparencyMode}
          key={placement.id}
          onFocus={() => onPlacementFocus?.(placement.id)}
          onPointerDown={(event) => onPlacementPointerDown?.(event, placement)}
          role={arrangeEnabled ? 'button' : undefined}
          style={{
            left: mediaRectangle.left,
            top: mediaRectangle.top,
            width: mediaRectangle.width,
            height: mediaRectangle.height,
            zIndex: placement.layer,
          }}
          tabIndex={arrangeEnabled ? 0 : undefined}
        >
          <img
            alt={typeof media.accessibleLabel === 'string' ? media.accessibleLabel : ''}
            draggable="false"
            src={media.src}
            style={{
              left: imageRectangle.left - mediaRectangle.left,
              top: imageRectangle.top - mediaRectangle.top,
              width: imageRectangle.width,
              height: imageRectangle.height,
            }}
          />
        </div>
      ))}
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
            left: selectedEntry.mediaRectangle.left,
            top: selectedEntry.mediaRectangle.top,
            width: selectedEntry.mediaRectangle.width,
            height: selectedEntry.mediaRectangle.height,
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
