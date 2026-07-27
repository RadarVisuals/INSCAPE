import React from 'react';

import { TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import { projectTableMediaPlacements } from './latticePlacement.js';
import './latticePlacementRenderer.css';

export default function LatticePlacementRenderer({ artboard, assetsByStableId, table, viewport }) {
  const renderEntries = projectTableMediaPlacements({ artboard, assetsByStableId, table, viewport });

  return (
    <div className="lattice-placement-layer" data-table-id={table.id}>
      {renderEntries.map(({ media, mediaRectangle, placement, transparencyMode }) => (
        <div
          className={`lattice-placement-media${transparencyMode === TRANSPARENCY_MODES.OPAQUE ? ' is-opaque' : ''}`}
          data-placement-id={placement.id}
          data-transparency-mode={transparencyMode}
          key={placement.id}
          style={{
            left: mediaRectangle.left,
            top: mediaRectangle.top,
            width: mediaRectangle.width,
            height: mediaRectangle.height,
            zIndex: placement.layer,
          }}
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
