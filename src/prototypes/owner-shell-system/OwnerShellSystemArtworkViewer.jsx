import LatticeFocusViewer from '../../lattice/rendering/LatticeFocusViewer.jsx';
import OwnerShellSystemFocusArtwork from './OwnerShellSystemFocusArtwork.jsx';

const GRID_VARIABLES = Object.freeze({
  '--lattice-grid-cell-size': '40px',
  '--lattice-grid-origin-x': '0px',
  '--lattice-grid-origin-y': '0px',
});

export default function OwnerShellSystemArtworkViewer({
  entry,
  getReturnRectangle,
  menuSurface,
  onClosed,
  onNavigate,
  originRectangle,
  position,
  returnFocus,
  total,
}) {
  if (!entry || !originRectangle) return null;

  return <LatticeFocusViewer
    dossier={entry.dossier}
    entry={entry}
    getReturnRectangle={getReturnRectangle}
    gridVariables={GRID_VARIABLES}
    gridVisible={false}
    inspectionFrameGridVisible={false}
    inspectionVariant="rack"
    menuSurfaceId={menuSurface}
    navigationViewportBottom={72}
    onClosed={onClosed}
    onNavigate={onNavigate}
    originRectangle={originRectangle}
    position={position}
    recenterArtworkWhenInspectionClosed
    renderArtwork={(focusEntry, context) => <OwnerShellSystemFocusArtwork entry={focusEntry} phase={context.phase} />}
    returnFocus={returnFocus}
    surfaceColor="var(--lattice-menu-panel)"
    total={total}
  />;
}
