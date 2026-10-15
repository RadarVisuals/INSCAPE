import { Bell, CloudUpload, Compass, Eye, FileText, Grid3X3, Settings2, UserRound } from 'lucide-react';


export default function OwnerSystemWorkflowGlobalBar({ openPanels = [], onOpen,
  onPreview, onPublish, publicationOpen = false, unreadCount }) {
  const panelButton = (id, label, Icon, extra = null) => <button data-system-workflow-panel-trigger aria-label={label}
    aria-expanded={['profile', 'activity', 'grids', 'settings'].includes(id) ? openPanels.includes(id) : undefined}
    aria-pressed={['discover', 'library'].includes(id) ? openPanels.includes(id) : undefined}
    className={`workflow-tactile-control workflow-tactile-control--quiet${id === 'activity' ? ' system-workflow__activity-trigger' : ''}`}
    onClick={(event) => onOpen(id, event.currentTarget)} type="button"><Icon size={18} strokeWidth={1.6} /><span>{label}</span>{extra}</button>;
  return <header className="system-workflow__global-bar" data-workflow-material="tactile">
    <strong aria-label="Inscape" className="system-workflow__brand"><span aria-hidden="true" /></strong>
    <nav aria-label="System Workflow">
      {panelButton('profile', 'Profile', UserRound)}
      {panelButton('grids', 'Grids', Grid3X3)}
      {panelButton('discover', 'Discover', Compass)}
      {panelButton('activity', 'Activity', Bell, unreadCount > 0 ? <i aria-label={`${unreadCount} unread`}>{unreadCount}</i> : null)}
      <button className="workflow-tactile-control workflow-tactile-control--quiet" aria-label="Preview" onClick={onPreview} type="button"><Eye size={18} strokeWidth={1.6} /><span>Preview</span></button>
      <button className="workflow-tactile-control workflow-tactile-control--quiet" aria-expanded={publicationOpen} aria-label="Publish" onClick={onPublish} type="button"><CloudUpload size={18} strokeWidth={1.6} /><span>Publish</span></button>
    </nav>
    <div aria-label="Workspace tools" className="system-workflow__dock-tools" role="toolbar">
      <button className="workflow-tactile-control workflow-tactile-control--quiet" data-system-workflow-panel-trigger aria-expanded={openPanels.includes('docs')} aria-label="Docs"
        onClick={(event) => onOpen('docs', event.currentTarget)} title="Docs" type="button"><FileText size={18} strokeWidth={1.6} /></button>
      <button className="workflow-tactile-control workflow-tactile-control--quiet" data-system-workflow-panel-trigger aria-expanded={openPanels.includes('settings')} aria-label="Settings"
        onClick={(event) => onOpen('settings', event.currentTarget)} title="Settings" type="button"><Settings2 size={18} strokeWidth={1.6} /></button>
    </div>
  </header>;
}
