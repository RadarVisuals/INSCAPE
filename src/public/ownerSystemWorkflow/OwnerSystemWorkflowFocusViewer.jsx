import { useLayoutEffect } from 'react';
import LatticeFocusViewer from '../../lattice/rendering/LatticeFocusViewer.jsx';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';

const containedRectangle = (rectangle, container) => {
  const bounds = container?.getBoundingClientRect();
  return rectangle && bounds ? { ...rectangle, left: rectangle.left - bounds.left, top: rectangle.top - bounds.top } : null;
};

export default function OwnerSystemWorkflowFocusViewer({ container, controlsContainer, menuSurface, viewer, workspaceSurfaceColor }) {
  useLayoutEffect(() => { viewer.present?.(); }, [viewer.placementId]);
  if (!viewer.entry || !viewer.originRectangle) return null;
  const originRectangle = containedRectangle(viewer.getReturnRectangle(), container);
  if (!originRectangle) return null;
  return <LatticeFocusViewer controlsTarget={controlsContainer} dossier={viewer.entry.dossier} entry={viewer.entry}
    contained portalTarget={container}
    getReturnRectangle={() => containedRectangle(viewer.getReturnRectangle(), container)}
    gridVariables={{ '--lattice-grid-cell-size': '1px', '--lattice-grid-origin-x': '0px', '--lattice-grid-origin-y': '0px' }}
    gridVisible={false} inspectionFrameGridVisible={false} inspectionVariant="none" menuSurfaceId={menuSurface}
    navigationPlacement="viewport" navigationViewportBottom={72} onClosed={viewer.close}
    onClosing={() => { clearOwnerSystemWorkflowDocumentSelection(); viewer.beginReturn(); }} onNavigate={viewer.navigate}
    onReturnLanding={viewer.revealSource}
    originRectangle={originRectangle} overlayInk="var(--workflow-ink)" position={viewer.position}
    renderArtwork={(entry, context) => <LatticeProductionFocusArtwork entry={entry} motion={context.motion} />}
    returnFocus={viewer.returnFocus} surfaceColor={workspaceSurfaceColor} total={viewer.total} />;
}
