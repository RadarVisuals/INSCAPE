import {
  Activity as ActivityIcon,
  ChevronRight,
  Compass,
  FolderTree,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from 'lucide-react';
import './latticeProfileRail.css';

const ENTRY_ICONS = Object.freeze({
  categories: FolderTree,
  creations: Images,
  activity: ActivityIcon,
  discover: Compass,
});

function OfficialIdentitySummary({ identity, active, collapsed, disabled, expanded, identityControlRef, onActivate, sourceHidden }) {
  const displayName = identity?.displayName || 'UNRESOLVED PROFILE';
  const secondaryLabel = identity?.secondaryLabel || 'UNIVERSAL PROFILE';
  return <button
    type="button"
    className="lattice-profile-rail__identity"
    data-active={active || undefined}
    data-identity-dossier-source="true"
    data-viewer-source-hidden={sourceHidden || undefined}
    aria-label={disabled
      ? `${displayName} identity rack unavailable in this phase`
      : identity ? `Open ${displayName} identity rack` : 'Open unresolved identity rack entry'}
    aria-controls="lattice-profile-dossier"
    aria-expanded={expanded}
    disabled={disabled}
    title={disabled ? 'Identity rack is temporarily unavailable' : undefined}
    onClick={onActivate}
    ref={identityControlRef}
  >
    <span className="lattice-profile-rail__avatar" aria-hidden="true">
      {identity?.avatarUrl
        ? <img src={identity.avatarUrl} alt="" />
        : <UserRound />}
    </span>
    {!collapsed && <span className="lattice-profile-rail__identity-copy">
      <strong>{displayName}{identity?.hash && <small>{identity.hash}</small>}</strong>
      <small>{secondaryLabel}</small>
    </span>}
  </button>;
}

export default function LatticeProfileRail({
  officialIdentity = null,
  entries,
  activeEntryId = null,
  collapsed = false,
  compact = false,
  blocked = false,
  identityControlRef,
  identityDisabled = false,
  identityExpanded = false,
  identitySourceHidden = false,
  onEntryActivate,
  onIdentityActivate,
  onCollapsedChange,
  onEscape,
}) {
  const visuallyCollapsed = collapsed || compact;
  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onEscape?.();
  };

  return <aside
    className="lattice-profile-rail"
    data-collapsed={visuallyCollapsed || undefined}
    data-blocked={blocked || undefined}
    inert={blocked ? '' : undefined}
    aria-label="Profile navigation"
    onKeyDown={handleKeyDown}
  >
    {!visuallyCollapsed && <header><span>PROFILE / NAVIGATION</span><b>01</b></header>}
    <OfficialIdentitySummary
      identity={officialIdentity}
      active={identityExpanded || activeEntryId === 'identity'}
      collapsed={visuallyCollapsed}
      disabled={identityDisabled}
      expanded={identityExpanded}
      identityControlRef={identityControlRef}
      sourceHidden={identitySourceHidden}
      onActivate={onIdentityActivate}
    />
    <nav aria-label="Public profile areas">
      {entries.map((entry) => {
        const Icon = ENTRY_ICONS[entry.id];
        const active = activeEntryId === entry.id;
        return <button
          type="button"
          key={entry.id}
          data-active={active || undefined}
          aria-current={active ? 'page' : undefined}
          aria-label={entry.label}
          disabled={entry.disabled === true}
          onClick={(event) => onEntryActivate?.(entry.id, event.currentTarget)}
          title={entry.disabledReason}
        >
          {Icon && <Icon aria-hidden="true" />}
          {!visuallyCollapsed && <><strong>{entry.label}</strong><small>{entry.note}</small><ChevronRight className="lattice-profile-rail__row-chevron" aria-hidden="true" /></>}
        </button>;
      })}
    </nav>
    {!compact && <button
      type="button"
      className="lattice-profile-rail__collapse"
      aria-label={collapsed ? 'Expand profile navigation' : 'Collapse profile navigation'}
      aria-expanded={!collapsed}
      onClick={() => onCollapsedChange?.(!collapsed)}
    >
      {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <><PanelLeftClose aria-hidden="true" /><span>COLLAPSE</span></>}
    </button>}
    {!visuallyCollapsed && <footer><span>INSCAPE</span><span>PUBLIC PROFILE</span></footer>}
  </aside>;
}
