import LatticeFocusViewer from '../../lattice/rendering/LatticeFocusViewer.jsx';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';

export default function OwnerSystemWorkflowFocusViewer({ menuSurface, viewer, workspaceSurfaceColor }) {
  if (!viewer.entry || !viewer.originRectangle) return null;
  return <LatticeFocusViewer dossier={viewer.entry.dossier} entry={viewer.entry}
    getReturnRectangle={viewer.getReturnRectangle} gridVariables={{ '--lattice-grid-cell-size': '1px', '--lattice-grid-origin-x': '0px', '--lattice-grid-origin-y': '0px' }}
    gridVisible={false} inspectionFrameGridVisible={false} inspectionVariant="rack" inlineRackClose menuSurfaceId={menuSurface}
    navigationPlacement="viewport" navigationViewportBottom={72} onClosed={viewer.close}
    onClosing={clearOwnerSystemWorkflowDocumentSelection} onNavigate={viewer.navigate}
    onReturnLanding={viewer.revealSource}
    originRectangle={viewer.originRectangle} position={viewer.position} recenterArtworkWhenInspectionClosed
    renderArtwork={(entry, context) => <LatticeProductionFocusArtwork entry={entry} motion={context.motion} />}
    returnFocus={viewer.returnFocus} surfaceColor={workspaceSurfaceColor} total={viewer.total} />;
}
