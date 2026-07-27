import React from 'react';

import {
  TABLE_VISIBILITY,
  tableDisplayTitle,
} from '../domain/latticeProfile.js';
import {
  projectCanonicalLatticeArtboard,
  projectTableLabelPosition,
} from './latticeGeometry.js';
import LatticePlacementRenderer from './LatticePlacementRenderer.jsx';
import LatticeAlignmentGuides from './LatticeAlignmentGuides.jsx';
import './latticeTableRenderer.css';

export default function LatticeTableRenderer({
  active = false,
  alignmentGuides = [],
  arrangeEnabled = false,
  artboard,
  assetsByStableId = {},
  geometry,
  hidden = false,
  onPlacementFocus,
  onPlacementPointerDown,
  onPlacementResizePointerDown,
  positionStyle,
  selectedPlacementId,
  table,
  viewport,
}) {
  const privateTable = table?.visibility === TABLE_VISIBILITY.PRIVATE;
  const title = tableDisplayTitle(table);
  const subtitle = privateTable || typeof table?.subtitle !== 'string' ? '' : table.subtitle.trim();
  const labelVisible = !privateTable && table?.labelVisible !== false && Boolean(title || subtitle);
  const field = projectCanonicalLatticeArtboard(artboard, viewport);

  return (
    <article
      className={`lattice-table-renderer${active ? ' is-active' : ''}`}
      aria-hidden={hidden || undefined}
      style={positionStyle}
    >
      <div
        className="lattice-table-renderer__authored-field"
        style={{ left: field.left, top: field.top, width: field.width, height: field.height }}
      >
      </div>
      <LatticePlacementRenderer
        arrangeEnabled={arrangeEnabled}
        artboard={artboard}
        assetsByStableId={assetsByStableId}
        onPlacementFocus={onPlacementFocus}
        onPlacementPointerDown={onPlacementPointerDown}
        onPlacementResizePointerDown={onPlacementResizePointerDown}
        selectedPlacementId={selectedPlacementId}
        table={table}
        viewport={viewport}
      />
      <LatticeAlignmentGuides
        artboard={artboard}
        guides={alignmentGuides}
        viewport={viewport}
      />
      {labelVisible && (
        <header
          className="lattice-table-renderer__label"
          style={projectTableLabelPosition(table, geometry, viewport)}
        >
          {title && <strong>{title}</strong>}
          {subtitle && <span>{subtitle}</span>}
        </header>
      )}
    </article>
  );
}
