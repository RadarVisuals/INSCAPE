import { Check, X } from 'lucide-react';
import { OwnerShellSystemSearch, OwnerShellSystemSelectMenu } from './OwnerShellSystemControls.jsx';

const ACTIVITY_FILTERS = Object.freeze(['ALL', 'UNREAD', 'ASSETS', 'LYX', 'SOCIAL']);

export default function OwnerShellSystemActivityHistory({
  events,
  filter,
  menuSurface,
  onClose,
  onFilterChange,
  onMarkAllRead,
  onOpenEvent,
  onQueryChange,
  phase,
  query,
  unreadCount,
}) {
  return <section
    aria-hidden={phase === 'closing' || undefined}
    aria-label="Full activity history"
    className="owner-shell-system__activity-history owner-shell-system__motion-panel"
    data-panel-phase={phase}
    inert={phase === 'closing' ? '' : undefined}
  >
    {events.length > 0 ? <ol>{events.map((event) => <li data-unread={event.unread || undefined} key={event.id}>
      <time><strong>{event.date}</strong><small>{event.time}</small></time>
      <i aria-hidden="true" className="owner-shell-system__activity-state-indicator" />
      <span><strong>{event.label}</strong><small>{event.detail}</small></span>
      <em>{event.type}</em>
      <button onClick={() => onOpenEvent(event.id)} type="button">OPEN →</button>
    </li>)}</ol> : <p>NO EVENTS MATCH THIS VIEW.</p>}
    <footer aria-label="Activity history controls" className="owner-shell-system__activity-history-rail owner-shell-system__local-rail">
      <OwnerShellSystemSearch onChange={onQueryChange} placeholder="EVENT, ASSET OR PROFILE" value={query} />
      <nav aria-label="Full activity history filters">{ACTIVITY_FILTERS.map((value) => <button
        aria-pressed={filter === value} key={value} onClick={() => onFilterChange(value)} type="button">{value}</button>)}</nav>
      <OwnerShellSystemSelectMenu className="owner-shell-system__activity-history-filter" label="FILTER"
        menuSurface={menuSurface} onChange={onFilterChange}
        options={ACTIVITY_FILTERS.map((value) => ({ label: value, value }))}
        triggerLabel={`FILTER: ${filter}`} value={filter} />
      <button aria-label="Mark all activity read" className="owner-shell-system__activity-history-read"
        disabled={unreadCount === 0} onClick={onMarkAllRead} title="Mark all read" type="button">
        <Check size={13} /><span>MARK ALL READ</span>
      </button>
      <button aria-label="Close full activity history" onClick={onClose} title="Close" type="button"><X size={15} /></button>
    </footer>
  </section>;
}
