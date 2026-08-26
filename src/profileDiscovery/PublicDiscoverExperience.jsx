import OwnerSystemWorkflowDiscoverWorkspace from '../public/ownerSystemWorkflow/OwnerSystemWorkflowDiscoverWorkspace.jsx';
import '../lattice/browser/browserWorkspace.css';
import '../lattice/rendering/latticeMenuSurface.css';
import '../public/ownerSystemWorkflow/ownerSystemWorkflow.css';

export default function PublicDiscoverExperience({ menuSurfaceId = 'mist', onClose, onSelect, surfaceId = 'mist' }) {
  return <main className="system-workflow system-workflow--public-discover" data-lattice-menu-surface
    data-menu-surface={menuSurfaceId} data-surface={surfaceId}>
    <OwnerSystemWorkflowDiscoverWorkspace anonymous menuSurface={menuSurfaceId} onClose={onClose}
      onSelect={(profile) => onSelect?.(profile.address)} />
  </main>;
}
