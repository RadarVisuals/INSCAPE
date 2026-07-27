import React from 'react';

import { PLACEMENT_RESIZE_CORNERS } from '../controller/latticePlacementResize.js';
import { TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import { projectTableMediaPlacements } from './latticePlacement.js';
import './latticePlacementRenderer.css';

export default function LatticePlacementRenderer({
  arrangeEnabled = false,
  artboard,
  assetsByStableId,
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
      {renderEntries.map(({ media, mediaRectangle, placement, transparencyMode }) => (
        <div
          aria-label={typeof media.accessibleLabel === 'string' ? media.accessibleLabel : 'Artwork placement'}
          className={`lattice-placement-media${transparencyMode === TRANSPARENCY_MODES.OPAQUE ? ' is-opaque' : ''}${selectedPlacementId === placement.id ? ' is-selected' : ''}`}
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
          />
        </div>
      ))}
      {selectedEntry && (
        <div
          aria-hidden="true"
          className="lattice-placement-selection-overlay"
          style={{
            left: selectedEntry.mediaRectangle.left,
            top: selectedEntry.mediaRectangle.top,
            width: selectedEntry.mediaRectangle.width,
            height: selectedEntry.mediaRectangle.height,
            zIndex: Math.max(...renderEntries.map(({ placement }) => placement.layer)) + 1,
          }}
        >
          {PLACEMENT_RESIZE_CORNERS.map((corner) => (
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
