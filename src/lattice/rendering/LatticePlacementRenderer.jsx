import React from 'react';

import { TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import { projectTableMediaPlacements } from './latticePlacement.js';
import './latticePlacementRenderer.css';

export default function LatticePlacementRenderer({
  arrangeEnabled = false,
  artboard,
  assetsByStableId,
  onPlacementFocus,
  onPlacementPointerDown,
  selectedPlacementId = null,
  table,
  viewport,
}) {
  const renderEntries = projectTableMediaPlacements({ artboard, assetsByStableId, table, viewport });

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
    </div>
  );
}
