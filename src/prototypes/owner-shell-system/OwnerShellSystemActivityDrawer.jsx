import { History } from 'lucide-react';

const ACTIVITY_TABS = Object.freeze(['ALL', 'ASSETS', 'LYX', 'SOCIAL']);

export default function OwnerShellSystemActivityDrawer({
  activeTab,
  events,
  onOpenHistory,
  onTabChange,
  phase,
}) {
  return <aside
    aria-hidden={phase === 'closing' || undefined}
    aria-label="Activity notifications"
    className="owner-shell-system__activity-drawer owner-shell-system__motion-panel"
    data-panel-phase={phase}
    inert={phase === 'closing' ? '' : undefined}
  >
    <ol>{events.map((event) => <li data-unread={event.unread || undefined} key={event.id}>
      <i aria-hidden="true" className="owner-shell-system__activity-state-indicator" />
      <time>{event.time}</time>
      <span><b>{event.label}</b><small>{event.detail}</small></span>
    </li>)}</ol>
    <nav aria-label="Activity filters" className="owner-shell-system__local-rail">
      {ACTIVITY_TABS.map((tab) => <button aria-pressed={activeTab === tab} key={tab}
        onClick={() => onTabChange(tab)} type="button">{tab}</button>)}
      <button aria-label="Open full activity history" onClick={onOpenHistory} title="Open full history" type="button">
        <History size={13} />
      </button>
    </nav>
  </aside>;
}
