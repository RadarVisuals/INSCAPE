import {
  Bell,
  ChevronUp,
  Compass,
  Eye,
  Grid3X3,
  Library,
  Settings2,
  Upload,
  UserRound,
} from 'lucide-react';

export default function OwnerShellSystemGlobalBar({
  activeTableName,
  activityExpanded,
  activityTriggerRef,
  discoverOpen,
  discoverTriggerRef,
  libraryOpen,
  libraryTriggerRef,
  onActivityToggle,
  onDiscoverToggle,
  onLibraryToggle,
  onPreviewToggle,
  onProfileToggle,
  onPublish,
  onSettingsToggle,
  onTableToggle,
  preview,
  profileOpen,
  settingsOpen,
  tableOpen,
  unreadCount,
}) {
  return <header className="owner-shell-system__global">
    <div className="owner-shell-system__identity">
      <strong>INSCAPE</strong>
      <button aria-expanded={profileOpen} disabled={preview} onClick={onProfileToggle} type="button"><UserRound size={13} />PROFILE</button>
      <button aria-expanded={activityExpanded} className="owner-shell-system__activity-trigger" disabled={preview}
        onClick={onActivityToggle} ref={activityTriggerRef} type="button"><Bell size={13} />ACTIVITY
        {unreadCount > 0 && <i aria-label={`${unreadCount} unread`}>{unreadCount}</i>}
      </button>
      <button aria-pressed={discoverOpen} disabled={preview} onClick={onDiscoverToggle} ref={discoverTriggerRef} type="button"><Compass size={13} />DISCOVER</button>
    </div>
    <button aria-expanded={tableOpen} className="owner-shell-system__table" disabled={preview} onClick={onTableToggle} type="button">
      <Grid3X3 className="owner-shell-system__table-icon" size={14} /><small>ACTIVE TABLE</small><b>{activeTableName || 'HOME'}</b><ChevronUp className="owner-shell-system__table-chevron" size={12} />
    </button>
    <nav aria-label="Owner workspace">
      <button aria-pressed={libraryOpen} disabled={preview} onClick={onLibraryToggle} ref={libraryTriggerRef} type="button"><Library size={14} />LIBRARY</button>
      <button aria-pressed={preview} onClick={onPreviewToggle} type="button"><Eye size={14} />{preview ? 'RETURN' : 'PREVIEW'}</button>
      <button onClick={onPublish} type="button"><Upload size={14} />PUBLISH</button>
      <button aria-expanded={settingsOpen} disabled={preview} onClick={onSettingsToggle} type="button"><Settings2 size={14} />SETTINGS</button>
    </nav>
  </header>;
}
