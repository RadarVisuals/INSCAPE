export default function OwnerShellSystemProfilePanel({
  dossierOpen,
  onOpenDossier,
  panelRef,
  phase,
  triggerRef,
}) {
  return <aside
    aria-hidden={phase === 'closing' || undefined}
    aria-label="Profile"
    className="owner-shell-system__profile owner-shell-system__motion-panel"
    data-panel-phase={phase}
    data-viewing={dossierOpen || undefined}
    inert={phase === 'closing' ? '' : undefined}
    ref={panelRef}
  >
    <button
      aria-expanded={dossierOpen}
      className="owner-shell-system__profile-card"
      data-identity-dossier-source="true"
      data-viewing={dossierOpen || undefined}
      onClick={onOpenDossier}
      ref={triggerRef}
      type="button"
    >
      <div>RV</div>
      <span><b>RADAR VISUALS</b><small>0xPROTOTYPE · OWNER</small></span>
    </button>
  </aside>;
}
