import { useMemo } from 'react';
import { Folder, Plus, UserCheck, UserRound, UsersRound } from 'lucide-react';
import { OwnerShellSystemWorkspaceRail } from './OwnerShellSystemControls.jsx';

const directorySections = (people) => [
  { id: 'all', label: 'ALL PEOPLE', icon: UsersRound, count: people.length },
  { id: 'following', label: 'FOLLOWING', icon: UserCheck, count: people.filter(({ following }) => following).length },
  { id: 'followers', label: 'FOLLOWERS', icon: UserRound, count: people.filter(({ follower }) => follower).length },
];

export default function OwnerShellSystemDiscoverWorkspace({
  cardSize,
  filter,
  groups,
  labelsVisible,
  menuSurface,
  onClose,
  onCreateGroup,
  onFilterChange,
  onLabelsVisibleChange,
  onOpenPerson,
  onQueryChange,
  onResetFilter,
  onSectionChange,
  onSizeChange,
  onSortChange,
  people,
  phase,
  query,
  resize,
  section,
  sidebarCollapsed,
  sidebarWidth,
  sort,
  sortOptions,
  visiblePeople,
}) {
  const filterOptions = useMemo(() => [...new Set(people.map(({ role }) => role).filter(Boolean))]
    .sort().map((role) => ({ label: role, value: role })), [people]);
  return <section aria-hidden={phase === 'closing' || undefined} aria-label="Discover directory"
    className="owner-shell-system__workspace-window owner-shell-system__discover owner-shell-system__motion-panel"
    data-panel-phase={phase} inert={phase === 'closing' ? '' : undefined}>
    <div className="owner-shell-system__discover-browser" data-sidebar-collapsed={sidebarCollapsed || undefined}
      style={{ '--discover-card-size': `${cardSize}px`, '--prototype-sidebar-width': `${sidebarWidth}px` }}>
      <aside aria-label="Discover sections" className="owner-shell-system__discover-sidebar">
        {directorySections(people).map(({ count, icon: Icon, id, label }) => <button aria-label={label}
          aria-pressed={section === id} data-active={section === id || undefined} key={id}
          onClick={() => onSectionChange(id)} title={label} type="button"><span><Icon size={15} /><b>{label}</b></span><i>{count}</i></button>)}
        <div className="owner-shell-system__discover-group-heading">
          <button aria-label="Create people group" onClick={onCreateGroup} title="Create group" type="button">
            <Plus size={15} /><span>CREATE GROUP</span>
          </button>
        </div>
        {groups.map((group) => <button aria-label={group.name} aria-pressed={section === group.id}
          data-active={section === group.id || undefined} key={group.id} onClick={() => onSectionChange(group.id)}
          title={group.name} type="button"><span><Folder size={15} /><b>{group.name}</b></span>
          <i>{people.filter((person) => person.groups.includes(group.id)).length}</i></button>)}
      </aside>
      <button aria-label="Resize Discover sidebar" className="owner-shell-system__discover-sidebar-resize"
        onPointerCancel={resize.finish} onPointerDown={resize.begin} onPointerMove={resize.update}
        onPointerUp={resize.finish} type="button" />
      {visiblePeople.length > 0 ? <div className="owner-shell-system__discover-grid">{visiblePeople.map((person) => <button
        key={person.id} onClick={() => onOpenPerson(person)} type="button"><img alt="" src={person.asset.previewSrc} />
        {labelsVisible && <span><small>{person.role}</small><b>{person.name}</b><em>OPEN PUBLIC PROFILE →</em></span>}
      </button>)}</div> : <p className="owner-shell-system__discover-empty">NO PEOPLE MATCH THIS VIEW.</p>}
    </div>
    <footer className="owner-shell-system__local-rail"><OwnerShellSystemWorkspaceRail
      filterMenu={{
        accessibleLabel: 'Profile filters',
        active: filter !== 'ALL',
        onChange: onFilterChange,
        onReset: onResetFilter,
        options: filterOptions,
        value: filter,
      }}
      labelsVisible={labelsVisible}
      menuSurface={menuSurface}
      onClose={onClose}
      onLabelsVisibleChange={onLabelsVisibleChange}
      onQueryChange={onQueryChange}
      onSizeChange={onSizeChange}
      query={query}
      secondaryMenu={{ label: 'SORT', onChange: onSortChange, options: sortOptions, triggerPrefix: 'SORT', value: sort }}
      size={cardSize}
      sizeBounds={{ maximum: 320, minimum: 160 }}
    /></footer>
  </section>;
}
