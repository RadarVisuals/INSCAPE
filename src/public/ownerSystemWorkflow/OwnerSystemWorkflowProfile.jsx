import { UserRound } from 'lucide-react';
import { useMemo } from 'react';
const compactAddress = (address) => address?.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;

export default function OwnerSystemWorkflowProfile({ identity, model, onDisconnect, onOpenIdentity, phase }) {
  const sourceIdentity = useMemo(() => ({
    avatarUrl: model?.officialProfile.avatarUrl || identity?.avatarUrl || null,
    displayName: model?.officialProfile.name || identity?.name || 'UNNAMED PROFILE',
    secondaryLabel: `${compactAddress(model?.address)} · OWNER`,
  }), [identity, model]);
  return <>
    <aside aria-hidden={phase === 'closing' || undefined} aria-label="Profile" className="system-workflow__profile system-workflow__motion-panel"
      inert={phase === 'closing' ? '' : undefined}>
      <button className="system-workflow__profile-card" data-identity-dossier-source="true"
        onClick={onOpenIdentity} type="button">
        <span className="system-workflow__profile-avatar">{sourceIdentity.avatarUrl ? <img alt="" src={sourceIdentity.avatarUrl} /> : <UserRound />}
          <svg aria-hidden="true" className="inscape-profile-avatar-ring" focusable="false" viewBox="0 0 36 36"><circle cx="18" cy="18" fill="none" r="17.5" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" /></svg>
        </span>
        <span><b>{sourceIdentity.displayName}</b><small>{sourceIdentity.secondaryLabel}</small></span>
      </button>
      {onDisconnect && <button className="system-workflow__profile-disconnect" onClick={onDisconnect} type="button">Disconnect</button>}
    </aside>
  </>;
}
