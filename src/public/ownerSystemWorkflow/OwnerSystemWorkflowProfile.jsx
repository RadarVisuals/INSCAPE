import { UserRound } from 'lucide-react';
import WorkbenchDestinationPanel from './WorkbenchDestinationPanel.jsx';
const compactAddress = (address) => address?.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;

export default function OwnerSystemWorkflowProfile({ identity, model, onClose, onDisconnect, onOpenIdentity, onOpenReception, onEditReception, phase }) {
  const sourceIdentity = {
    avatarUrl: model?.officialProfile.avatarUrl || identity?.avatarUrl || null,
    displayName: model?.officialProfile.name || identity?.name || 'Unnamed profile',
    secondaryLabel: [compactAddress(model?.address || identity?.address), 'Owner'].filter(Boolean).join(' · '),
  };
  return <>
    <WorkbenchDestinationPanel title="Profile" onClose={onClose} aria-hidden={phase === 'closing' || undefined} className="system-workflow__profile"
      inert={phase === 'closing' ? '' : undefined}>
      <div className="workbench-destination-body">
      <button className="system-workflow__profile-card" data-identity-dossier-source="true"
        onClick={onOpenIdentity} type="button">
        <span className="system-workflow__profile-avatar">{sourceIdentity.avatarUrl ? <img alt="" src={sourceIdentity.avatarUrl} /> : <UserRound />}
          <svg aria-hidden="true" className="inscape-profile-avatar-ring" focusable="false" viewBox="0 0 36 36"><circle cx="18" cy="18" fill="none" r="17.5" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" /></svg>
        </span>
        <span><b>{sourceIdentity.displayName}</b><small>{sourceIdentity.secondaryLabel}</small></span>
      </button>
      {onOpenReception && <button className="system-workflow__profile-action" onClick={onOpenReception} type="button">View my reception</button>}
      {onEditReception && <button className="system-workflow__profile-action" onClick={onEditReception} type="button">Edit Reception</button>}
      {onDisconnect && <button className="system-workflow__profile-action" onClick={onDisconnect} type="button">Disconnect</button>}
      </div>
    </WorkbenchDestinationPanel>
  </>;
}
