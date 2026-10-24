import { Bell, ChevronDown, ChevronRight, Compass, Eye, FileText, Grid3X3, Images,
  PanelLeftClose, PanelLeftOpen, PanelsTopLeft, Settings2, Upload, UserRound } from 'lucide-react';
import './workspaceNavigation.css';

// Presentation only. The host owns destinations, panel lifetimes and authority.
export default function WorkspaceNavigation({ hidden, collapsed, onCollapse, onWorkbench, onLibrary,
  openPanels = [], onOpen, onPreview, onPublish, publicationOpen = false, unreadCount = 0,
  navigationHost, reference = false, className = '', style }) {
  const libraryOpen = openPanels.includes('library');
  const link = (label, Icon, action, state = {}) => <button type="button"
    className="workspace-navigation-link" aria-label={label} title={action ? label : `${label} · available in the app`}
    data-system-workflow-panel-trigger disabled={!action} onClick={action} {...state}>
    <Icon size={18} aria-hidden="true" /><span>{label}</span>
    {label === 'Activity' && unreadCount > 0 && <i aria-label={`${unreadCount} unread`}>{unreadCount}</i>}
    {label === 'Library' && (libraryOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
  </button>;
  const panel = (id, label, Icon) => link(label, Icon, onOpen && (!reference || id === 'grids') ? (event => onOpen(id, event.currentTarget)) : null,
    { 'aria-expanded': openPanels.includes(id), 'data-active': openPanels.includes(id) || undefined });
  return <aside hidden={hidden} className={`workspace-navigation ${className}`} style={style}
    data-workflow-material="tactile" data-workflow-finish="flat" data-collapsed={collapsed || undefined}
    data-workbench-selection-tools data-system-workflow-overlay aria-label="Workspace sidebar">
    <div className="workspace-navigation-identity" title="Personal workspace" aria-label="Inscape">
      <PanelsTopLeft size={18} aria-hidden="true" /><span><strong>Inscape</strong><small>Personal workspace</small></span>
    </div>
    <div className="workspace-navigation-scroll">
      <nav aria-label="Workspace navigation">
        <div className="workspace-navigation-group"><p>Workspace</p>
          {link('Workbench', PanelsTopLeft, onWorkbench, { 'aria-current': !openPanels.length && !publicationOpen ? 'page' : undefined })}
          {panel('grids', 'Grids', Grid3X3)}
        </div>
        <div className="workspace-navigation-group"><p>Artwork</p>
          {link('Library', Images, onLibrary, { 'aria-expanded': libraryOpen, 'data-active': libraryOpen || undefined })}
        </div>
      </nav>
      <div ref={navigationHost} className="workspace-library-navigation system-workflow__browser-workspace"
        hidden={!libraryOpen || collapsed} />
      <nav aria-label="Explore navigation" className="workspace-navigation-group"><p>Explore</p>
        {panel('discover', 'Discover', Compass)}{panel('activity', 'Activity', Bell)}
      </nav>
      <div className="workspace-navigation-footer">
        <nav aria-label="Share navigation" className="workspace-navigation-group"><p>Share</p>
          {link('Preview', Eye, onPreview)}{link('Publish', Upload, onPublish, { 'aria-expanded': publicationOpen })}
        </nav>
        {reference && !collapsed && <small className="workspace-navigation-note">Account & sharing: available in the app</small>}
        <div className="workspace-navigation-utilities" role="toolbar" aria-label="Workspace utilities">
          {[[UserRound, 'Profile', 'profile'], [FileText, 'Docs', 'docs'], [Settings2, 'Settings', 'settings']].map(([Icon, label, id]) =>
            <button key={id} type="button" aria-label={label} title={label} data-system-workflow-panel-trigger
              aria-expanded={openPanels.includes(id)} disabled={!onOpen || reference}
              onClick={event => onOpen?.(id, event.currentTarget)}><Icon size={18} aria-hidden="true" /></button>)}
        </div>
      </div>
    </div>
    <button type="button" className="workspace-navigation-link workspace-navigation-collapse"
      onClick={onCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
      <span>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
    </button>
  </aside>;
}
