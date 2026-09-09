import { UserRound } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';

const LatticeProductionIdentityDossier = lazy(() => import('../../lattice/rendering/LatticeProductionIdentityDossier.jsx'));

const rectangle = (node) => {
  const value = node?.getBoundingClientRect();
  return value ? { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height } : null;
};
const compactAddress = (address) => address?.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;

export default function OwnerSystemWorkflowProfile({ identity, layout, menuSurface, model, onClose, onDossierChange, phase, workspaceSurfaceColor }) {
  const cardRef = useRef(null);
  const [session, setSession] = useState(null);
  const sourceIdentity = useMemo(() => ({
    avatarUrl: model?.profile.avatarUrl || identity?.avatarUrl || null,
    displayName: model?.profile.displayName || identity?.name || 'UNNAMED PROFILE',
    secondaryLabel: `${compactAddress(model?.address)} · OWNER`,
  }), [identity, model]);
  const openDossier = () => {
    const originRectangle = rectangle(cardRef.current?.closest('.system-workflow__profile') || cardRef.current);
    if (!originRectangle || !model) return;
    setSession({ originRectangle, returnFocus: cardRef.current });
    onDossierChange?.(true);
  };
  const dismissDossier = () => {
    setSession(null);
    onDossierChange?.(false);
    onClose?.();
  };
  return <>
    <aside aria-hidden={phase === 'closing' || undefined} aria-label="Profile" className="system-workflow__profile system-workflow__motion-panel"
      data-viewing={Boolean(session) || undefined} inert={phase === 'closing' ? '' : undefined}>
      <button aria-expanded={Boolean(session)} className="system-workflow__profile-card" data-identity-dossier-source="true"
        data-viewing={Boolean(session) || undefined} onClick={openDossier} ref={cardRef} type="button">
        <span className="system-workflow__profile-avatar">{sourceIdentity.avatarUrl ? <img alt="" src={sourceIdentity.avatarUrl} /> : <UserRound />}
          <svg aria-hidden="true" className="inscape-profile-avatar-ring" focusable="false" viewBox="0 0 36 36"><circle cx="18" cy="18" fill="none" r="17.5" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" /></svg>
        </span>
        <span><b>{sourceIdentity.displayName}</b><small>{sourceIdentity.secondaryLabel}</small></span>
      </button>
    </aside>
    {session && model && <Suspense fallback={null}><LatticeProductionIdentityDossier
      dismissOnBackdrop
      getReturnRectangle={() => rectangle(cardRef.current?.closest('.system-workflow__profile') || cardRef.current) || session.originRectangle}
      gridVisible={false}
      inlineCloseControl
      menuSurfaceId={menuSurface}
      model={model}
      onClosed={() => onDossierChange?.(false)}
      onDismiss={dismissDossier}
      onOpening={() => onDossierChange?.(true)}
      originRectangle={session.originRectangle}
      preloadedProfileImageUrl={sourceIdentity.avatarUrl}
      persistent
      reducedMotion={layout.reducedMotion}
      returnFocus={session.returnFocus}
      sourceIdentity={sourceIdentity}
      workspaceSurfaceColor={workspaceSurfaceColor}
      viewport={{ width: layout.width, height: Math.max(1, layout.height - 52) }}
    /></Suspense>}
  </>;
}
