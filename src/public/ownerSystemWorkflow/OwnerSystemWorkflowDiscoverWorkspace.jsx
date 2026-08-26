import { Search, SquareArrowOutUpRight, UserCheck, UserRound, UsersRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useProfileDiscoveryController from '../../profileDiscovery/useProfileDiscoveryController.js';
import { luksoProfileDiscoveryRepository } from '../../profileDiscovery/data/luksoProfileDiscoveryRepository.js';
import RackMenu from '../menus/RackMenu.jsx';
import { BROWSER_ASSET_SIZE } from '../../lattice/browser/browserWorkspaceModel.js';
import { getOfficialProfileUrl } from '../../profileIdentity/domain/profileIdentity.js';
import { OwnerSystemWorkflowSelectMenu } from './OwnerSystemWorkflowWorkspaceControls.jsx';
import { OwnerSystemWorkflowBrowserSidebar, OwnerSystemWorkflowSidebarDeleteConfirmation, OwnerSystemWorkflowSidebarEditor, OwnerSystemWorkflowWorkspaceShell, useOwnerSystemWorkflowSidebar } from './OwnerSystemWorkflowBrowserWorkspace.jsx';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';

const initials = (value) => String(value || 'UP').split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const groupIdForName = (value) => String(value || '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
const discoverPreferences = { cardSize: 220, labelsVisible: true, width: 174 };
function ProfileRouteIcon({ direction }) {
  return <SquareArrowOutUpRight aria-hidden="true" size={13} strokeWidth={1}
    style={direction === 'in' ? { transform: 'scale(-1, -1)' } : undefined} />;
}
function SidebarButton({ active, count, custom = false, icon: Icon, id, label, onContext, onSelect }) {
  return <button aria-label={label} aria-pressed={active} className={custom ? 'system-workflow__discover-group' : undefined} data-active={active || undefined} onClick={() => onSelect(id)}
    onContextMenu={onContext ? (event) => { event.preventDefault(); event.stopPropagation(); onContext(event, id); } : undefined} type="button">
    <span><Icon aria-hidden="true" size={14} /><b>{label}</b></span><i>{count}</i>
  </button>;
}

export default function OwnerSystemWorkflowDiscoverWorkspace({ anonymous = false, assets = [], fixture, groupCommands,
  groups = [], menuSurface, onClose, onSelect, phase = 'open' }) {
  const repository = useMemo(() => fixture ? { source: 'DEVELOPMENT_FIXTURE', list: async () => fixture.map((profile, index) => ({
    ...profile, avatarUrl: assets[index + 2]?.src || assets[index + 2]?.imageUrl || null,
    follower: ['FOLLOWS YOU', 'MUTUAL'].includes(profile.relationship), following: ['FOLLOWING', 'MUTUAL'].includes(profile.relationship),
    groups: [groupIdForName(profile.group)].filter(Boolean), id: profile.address,
  })) } : luksoProfileDiscoveryRepository, [assets, fixture]);
  const discovery = useProfileDiscoveryController({ repository });
  const sidebar = useOwnerSystemWorkflowSidebar(174, discoverPreferences);
  const [section, setSection] = useState('all');
  const [role, setRole] = useState('ALL');
  const [sort, setSort] = useState('name-asc');
  const [cardSize, setCardSize] = useState(() => discoverPreferences.cardSize);
  const [labelsVisible, setLabelsVisible] = useState(() => discoverPreferences.labelsVisible);
  const [groupContext, setGroupContext] = useState(null);
  const [groupDialog, setGroupDialog] = useState(null);
  const normalizedGroups = groups.map((group) => typeof group === 'string' ? { id: group, name: group } : group)
    .filter((group) => group?.id && group?.name);
  const closeGroupContext = () => { clearOwnerSystemWorkflowDocumentSelection(); setGroupContext(null); };
  const closeGroupDialog = () => setGroupDialog(null);
  const confirmGroupDialog = (name) => {
    const id = groupDialog?.category?.id;
    const result = groupDialog?.type === 'create' ? groupCommands?.createGroup(name)
      : groupDialog?.type === 'rename' ? groupCommands?.renameGroup(id, name) : groupCommands?.deleteGroup(id);
    if (!result) { setGroupDialog((current) => ({ ...current, error: 'Group command could not be saved.' })); return; }
    if (groupDialog.type === 'delete' && section === id) setSection('all');
    closeGroupDialog();
  };
  const people = discovery.results.map((profile) => ({ role: profile.role || 'PUBLISHED', following: profile.following === true,
    follower: profile.follower === true, groups: profile.groups || [], ...profile }));
  const roles = ['ALL', ...new Set(people.map(({ role: value }) => value).filter(Boolean))];
  const visible = people.filter((person) => {
    if (section === 'following' && !person.following) return false;
    if (section === 'followers' && !person.follower) return false;
    if (!['all', 'following', 'followers'].includes(section) && !person.groups.includes(section)) return false;
    return role === 'ALL' || person.role === role;
  }).sort((left, right) => sort === 'name-desc' ? String(right.name).localeCompare(String(left.name)) : String(left.name).localeCompare(String(right.name)));
  const sections = anonymous ? [
    { id: 'all', label: 'Published worlds', icon: UsersRound, count: people.length },
  ] : [
    { id: 'all', label: 'All people', icon: UsersRound, count: people.length },
    { id: 'following', label: 'Following', icon: UserCheck, count: people.filter(({ following }) => following).length },
    { id: 'followers', label: 'Followers', icon: UserRound, count: people.filter(({ follower }) => follower).length },
  ];
  const rail = <div className="system-workflow__workspace-rail-controls">
    <label className="system-workflow__workspace-search"><Search size={13} /><input aria-label="Search profiles" onChange={(event) => discovery.setQuery(event.target.value)} placeholder="Search" type="search" value={discovery.query} /></label>
    <label className="system-workflow__workspace-labels"><input checked={labelsVisible} onChange={(event) => { discoverPreferences.labelsVisible = event.target.checked; setLabelsVisible(event.target.checked); }} type="checkbox" /><span>Labels</span></label>
    <label className="system-workflow__workspace-size"><span>Size</span><input aria-label="Profile card size" max={BROWSER_ASSET_SIZE.MAXIMUM} min={BROWSER_ASSET_SIZE.MINIMUM} step="1" onChange={(event) => { const next = Number(event.target.value); discoverPreferences.cardSize = next; setCardSize(next); }} type="range" value={cardSize} /></label>
    <OwnerSystemWorkflowSelectMenu compact defaultValue="ALL" label="Profile filters" menuSurface={menuSurface} onChange={setRole} options={roles.map((value) => ({ label: value === 'ALL' ? 'All' : value, value }))} triggerPrefix="Filters" value={role} />
    <OwnerSystemWorkflowSelectMenu compact label="Sort profiles" menuSurface={menuSurface} onChange={setSort} options={[{ label: 'A–Z', value: 'name-asc' }, { label: 'Z–A', value: 'name-desc' }]} value={sort} />
    {onClose && <button aria-label="Close Discover" className="system-workflow__workspace-close" onClick={onClose} type="button"><X size={13} /></button>}
  </div>;
  return <OwnerSystemWorkflowWorkspaceShell className="system-workflow__discover" label="Discover directory" phase={phase} rail={rail} sidebarCollapsed={sidebar.collapsed}>
    <div className="lattice-browser-panel system-workflow__discover-browser" style={{ '--lattice-browser-sidebar-width': `${sidebar.width}px` }}>
      <OwnerSystemWorkflowBrowserSidebar afterCreate={normalizedGroups.map((group) => groupDialog?.category?.id === group.id
        && groupDialog.type === 'delete' ? <OwnerSystemWorkflowSidebarDeleteConfirmation entityLabel="people group" key={group.id}
          name={group.name} onCancel={closeGroupDialog} onConfirm={confirmGroupDialog} />
        : groupDialog?.category?.id === group.id && groupDialog.type === 'rename'
          ? <OwnerSystemWorkflowSidebarEditor dialog={groupDialog} entityLabel="people group" key={group.id}
            onCancel={closeGroupDialog} onConfirm={confirmGroupDialog} />
          : <SidebarButton active={section === group.id} count={people.filter((person) => person.groups.includes(group.id)).length} custom icon={UsersRound} id={group.id} key={group.id} label={group.name}
            onContext={groupCommands ? (event, groupId) => setGroupContext({ anchor: { x: event.clientX, y: event.clientY }, id: groupId, trigger: event.currentTarget }) : null}
            onSelect={setSection} />)} createLabel="Create Group" editing={Boolean(groupDialog)}
        inlineEditor={groupDialog?.type === 'create' ? <OwnerSystemWorkflowSidebarEditor dialog={groupDialog} entityLabel="people group"
          onCancel={closeGroupDialog} onConfirm={confirmGroupDialog} /> : null}
        onCreate={groupCommands ? (event) => { sidebar.ensureWidth(); setGroupDialog({ trigger: event.currentTarget, type: 'create' }); } : null} sidebar={sidebar}>
        {sections.map((item) => <SidebarButton active={section === item.id} key={item.id} onSelect={setSection} {...item} />)}
      </OwnerSystemWorkflowBrowserSidebar>
      <main className="lattice-browser-results system-workflow__discover-results">
        {discovery.status === 'loading' || discovery.status === 'idle' ? <p role="status">Reading public Inscape directory…</p>
          : discovery.status === 'error' ? <div role="alert"><p>Directory unavailable · {discovery.error}</p><button onClick={discovery.retry} type="button">Retry</button></div>
            : visible.length ? <div className="lattice-browser-assets system-workflow__discover-grid" data-labels={labelsVisible ? 'visible' : 'hidden'} style={{ '--lattice-browser-asset-media-max': `${cardSize}px`, '--lattice-browser-asset-min': `${cardSize}px` }}>{visible.map((person) => {
              const officialProfileUrl = getOfficialProfileUrl(person.address);
              return <article className="lattice-browser-asset system-workflow__discover-card" key={person.address}>
                <button aria-label={`Open ${person.name || 'profile'} in Inscape`} className="lattice-browser-asset__media system-workflow__discover-avatar" onClick={() => onSelect(person)} type="button">{person.avatarUrl ? <img alt="" src={person.avatarUrl} /> : initials(person.name)}</button>
                {labelsVisible && <div className="lattice-browser-asset__record"><strong>{person.name || 'Unnamed profile'}</strong><span className="system-workflow__discover-actions"><button aria-label={`Open ${person.name || 'profile'} in Inscape`} onClick={() => onSelect(person)} title="Open in Inscape" type="button"><ProfileRouteIcon direction="in" /></button>{officialProfileUrl && <a aria-label={`Open ${person.name || 'profile'} on Universal Everything`} href={officialProfileUrl} rel="noreferrer" target="_blank" title="Open Universal Profile"><ProfileRouteIcon direction="out" /></a>}</span><div className="system-workflow__discover-card-meta"><span className="system-workflow__discover-tags"><small>{person.role}</small>{person.relationship && <small>{person.relationship}</small>}</span></div></div>}
              </article>;
            })}</div> : <div className="lattice-browser-status">
              <strong>{people.length ? 'No profiles match this view.' : 'No published Inscape profiles yet.'}</strong>
              {!people.length && <small>Discover shows profiles after they publish an Inscape presentation.</small>}
            </div>}
      </main>
    </div>
    {groupContext && createPortal(<RackMenu anchor={groupContext.anchor} commands={[{ id: 'rename', label: 'Rename' }, { id: 'delete', label: 'Delete' }]}
      label="People group commands" menuSurfaceId={menuSurface} onClose={closeGroupContext} returnFocus={groupContext.trigger}
      onCommand={(command) => { const group = normalizedGroups.find(({ id }) => id === groupContext.id); if (group) { if (command === 'rename') sidebar.ensureWidth(); setGroupDialog({ category: group, trigger: groupContext.trigger, type: command }); } setGroupContext(null); }} systemWorkflowOverlay />, document.body)}
  </OwnerSystemWorkflowWorkspaceShell>;
}
