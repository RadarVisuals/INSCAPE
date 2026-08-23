import { Bell, CloudUpload, Compass, Eye, FileText, Grid3X3, Layers3, Library, Settings2, UserRound } from 'lucide-react';

export default function OwnerSystemWorkflowGlobalBar({ activePanel, layersActivated = false, layersOpen, onOpen,
  onPreview, onPublish, onToggleLayers, publicationOpen = false, unreadCount }) {
  const panelButton = (id, label, Icon, extra = null) => <button data-system-workflow-panel-trigger aria-label={label}
    aria-expanded={['profile', 'activity', 'grids', 'settings'].includes(id) ? activePanel === id : undefined}
    aria-pressed={['discover', 'library'].includes(id) ? activePanel === id : undefined}
    className={id === 'activity' ? 'system-workflow__activity-trigger' : undefined}
    onClick={(event) => onOpen(id, event.currentTarget)} type="button"><Icon size={14} /><span>{label}</span>{extra}</button>;
  return <header className="system-workflow__global-bar">
    <strong aria-label="Inscape" className="system-workflow__brand"><span aria-hidden="true" /></strong>
    <nav aria-label="System Workflow">
      {panelButton('profile', 'Profile', UserRound)}
      {panelButton('library', 'Library', Library)}
      {panelButton('grids', 'Grids', Grid3X3)}
      {panelButton('discover', 'Discover', Compass)}
      {panelButton('activity', 'Activity', Bell, unreadCount > 0 ? <i aria-label={`${unreadCount} unread`}>{unreadCount}</i> : null)}
      <button aria-label="Preview" onClick={onPreview} type="button"><Eye size={14} /><span>Preview</span></button>
      <button aria-expanded={publicationOpen} aria-label="Publish" onClick={onPublish} type="button"><CloudUpload size={14} /><span>Publish</span></button>
    </nav>
    <div aria-label="Workspace tools" className="system-workflow__dock-tools" role="toolbar">
      <button data-system-workflow-panel-trigger aria-expanded={activePanel === 'docs'} aria-label="Docs"
        onClick={(event) => onOpen('docs', event.currentTarget)} title="Docs" type="button"><FileText size={14} /></button>
      <button data-system-workflow-panel-trigger aria-expanded={activePanel === 'settings'} aria-label="Settings"
        onClick={(event) => onOpen('settings', event.currentTarget)} title="Settings" type="button"><Settings2 size={14} /></button>
      <button aria-expanded={layersOpen} aria-label="Layers" className="system-workflow__layers-trigger" data-layers-activated={layersActivated || undefined}
        onClick={onToggleLayers} title="Layers" type="button"><Layers3 size={14} /></button>
    </div>
  </header>;
}
