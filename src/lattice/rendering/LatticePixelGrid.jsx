import { useId, useMemo } from 'react';
import { createLatticePixelBoundaryPositions, createLatticePixelGuideBounds } from './latticePixelGeometry.js';

const finitePositive = (value) => Number.isFinite(value) && value > 0;

export default function LatticePixelGrid({ color, field, guideInterval = 1, guideSize = 1, height, mode, width }) {
  const guideClipId = `lattice-guide-${useId().replaceAll(':', '')}`;
  const geometry = useMemo(() => {
    if (!field || mode === 'NONE' || !finitePositive(width) || !finitePositive(height)) return null;
    const strokeWidth = Math.max(1, Math.round(guideSize));
    const interval = finitePositive(guideInterval) ? guideInterval : 1;
    const spacing = field.cellSize * interval;
    const columns = createLatticePixelBoundaryPositions(field, 'column', interval, width, strokeWidth);
    const rows = createLatticePixelBoundaryPositions(field, 'row', interval, height, strokeWidth);
    const linePath = mode === 'LINES'
      ? `${columns.map((x) => `M${x} 0V${height}`).join('')}${rows.map((y) => `M0 ${y}H${width}`).join('')}`
      : '';
    const dotPath = mode === 'DOTS'
      ? rows.map((y) => columns.map((x) => `M${x} ${y}h0`).join('')).join('')
      : '';
    const bounds = createLatticePixelGuideBounds(field, spacing / 2);
    return { bounds, columns, dotPath, linePath, rows, spacing, strokeWidth };
  }, [field, guideInterval, guideSize, height, mode, width]);
  if (!geometry) return null;
  return <svg aria-hidden="true" className="lattice-pixel-grid" data-guide-spacing={geometry.spacing} focusable="false" height={height}
    style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'block', overflow: 'hidden', pointerEvents: 'none' }}
    viewBox={`0 0 ${width} ${height}`} width={width}>
    {geometry.bounds && <defs><clipPath id={guideClipId} clipPathUnits="userSpaceOnUse">
      <rect {...geometry.bounds} />
    </clipPath></defs>}
    {mode === 'LINES' && <path d={geometry.linePath} fill="none" shapeRendering="crispEdges" stroke={color}
      strokeLinecap="butt" strokeWidth={geometry.strokeWidth} clipPath={geometry.bounds ? `url(#${guideClipId})` : undefined} />}
    {mode === 'DOTS' && <path d={geometry.dotPath} fill="none" stroke={color} strokeLinecap="round"
      strokeWidth={geometry.strokeWidth * 2} clipPath={geometry.bounds ? `url(#${guideClipId})` : undefined} />}
  </svg>;
}
