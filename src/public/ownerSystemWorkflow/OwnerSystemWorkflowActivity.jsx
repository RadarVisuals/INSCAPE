import { Check, History, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOwnerSystemWorkflowPanelPresence } from './useOwnerSystemWorkflowPanels.js';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';
import './workbenchToolPanel.css';
import './activity.css';

const TABS = ['ALL', 'ASSETS', 'LYX', 'SOCIAL'];
const HISTORY_FILTERS = ['ALL', 'UNREAD', 'ASSETS', 'LYX', 'SOCIAL'];
const displayFilter = value => value === 'LYX' ? value : `${value.charAt(0)}${value.slice(1).toLowerCase()}`;

function ActivityFeedback({ activity, empty }) {
  return <div className="system-workflow__activity-feedback">
    {activity.status === 'loading' && <p role="status">{empty ? 'Syncing LUKSO activity…' : 'Refreshing activity…'}</p>}
    {activity.partialError && <p role="status">Partial on-chain data · {activity.partialError}</p>}
    {activity.persistenceError && <p role="alert">{activity.persistenceError}
      {activity.status === 'error' && !activity.error && <button onClick={activity.retry} type="button">Retry</button>}</p>}
    {activity.status === 'error' && (activity.error || !activity.persistenceError) && <p role="alert">{activity.error || 'Activity unavailable'} <button onClick={activity.retry} type="button">Retry</button></p>}
    {empty && activity.status !== 'loading' && activity.status !== 'error' && <p role="status">{activity.entries.length ? 'No events match this view.' : 'No activity yet.'}</p>}
  </div>;
}

export default function OwnerSystemWorkflowActivity({ activity, onClose, phase }) {
  const [tab, setTab] = useState('ALL'), [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('ALL'), [query, setQuery] = useState('');
  const historyTrigger = useRef(null), search = useRef(null), returning = useRef(null);
  const keyboardHistory = useRef(false);
  const historyPresence = useOwnerSystemWorkflowPanelPresence(historyOpen);
  const closeHistory = () => {
    clearOwnerSystemWorkflowDocumentSelection();
    returning.current = document.activeElement;
    setHistoryOpen(false);
  };
  useEffect(() => {
    if (!historyOpen) return undefined;
    const escape = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); closeHistory();
    };
    globalThis.addEventListener('keydown', escape, true);
    return () => globalThis.removeEventListener('keydown', escape, true);
  }, [historyOpen]);
  useEffect(() => {
    if (historyOpen && historyPresence.present && keyboardHistory.current) search.current?.focus({ preventScroll: true });
    if (historyOpen || historyPresence.present || !returning.current) return undefined;
    const previous = returning.current; returning.current = null;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === document.body || document.activeElement === previous)
        historyTrigger.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [historyOpen, historyPresence.present]);
  const drawerEntries = activity.entries.filter(entry => tab === 'ALL' || entry.type === tab).slice(0, 5);
  const historyEntries = useMemo(() => activity.entries.filter(entry => {
    if (historyFilter === 'UNREAD' && !entry.unread) return false;
    if (!['ALL', 'UNREAD'].includes(historyFilter) && entry.type !== historyFilter) return false;
    return !query.trim() || `${entry.label} ${entry.detail}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [activity.entries, historyFilter, query]);
  const expanded = historyPresence.present, entries = expanded ? historyEntries : drawerEntries;
  const closing = phase === 'closing' || expanded && historyPresence.phase === 'closing';
  const Surface = expanded ? 'section' : 'aside';
  return <Surface aria-hidden={closing || undefined} aria-label={expanded ? 'Full activity history' : 'Activity notifications'}
    className={`workbench-tool-panel activity-panel system-workflow__activity-${expanded ? 'history' : 'drawer'} system-workflow__motion-panel`}
    data-workflow-material="tactile" data-workflow-finish="flat"
    data-panel-phase={expanded ? historyPresence.phase : undefined} inert={closing ? '' : undefined}
    onTransitionEnd={event => { if (expanded && event.propertyName === 'transform') historyPresence.completeTransition(); }}>
    <header className="workbench-tool-panel-header"><h2>{expanded ? 'Activity history' : 'Activity'}</h2>
      <button className="workbench-tool-panel-close" aria-label={expanded ? 'Close full activity history' : 'Close activity'}
        title={expanded ? 'Return to recent activity' : 'Close activity'} onClick={expanded ? closeHistory : onClose} type="button"><X aria-hidden="true" /></button>
    </header>
    {expanded && <label className="activity-search"><Search aria-hidden="true" size={14} />
      <input ref={search} aria-label="Search activity" onChange={event => setQuery(event.target.value)} placeholder="Search activity" type="search" value={query} /></label>}
    <nav className="activity-filters" aria-label={expanded ? 'Full activity history filters' : 'Activity filters'}>
      {(expanded ? HISTORY_FILTERS : TABS).map(value => <button aria-pressed={(expanded ? historyFilter : tab) === value}
        key={value} onClick={() => expanded ? setHistoryFilter(value) : setTab(value)} type="button">{displayFilter(value)}</button>)}
    </nav>
    <div className="activity-body">
      <ActivityFeedback activity={activity} empty={!entries.length} />
      {entries.length > 0 && <ol aria-label={expanded ? 'Activity history entries' : 'Recent activity'}>
        {entries.map(entry => <li data-unread={entry.unread || undefined} key={entry.id}>
          <i aria-hidden="true" />
          <div className="activity-entry-copy"><strong>{entry.label}</strong><span>{entry.detail}</span>
            <div className="activity-entry-meta"><time>{expanded ? `${entry.date} · ${entry.time}` : entry.time}</time>
              {expanded && <span>{displayFilter(entry.type)}</span>}</div>
          </div>
          <button className="activity-read" aria-label={entry.unread ? `Mark ${entry.label} as read` : `${entry.label}, read`}
            disabled={!entry.unread} onClick={() => activity.markRead(entry.id)} type="button">
            {entry.unread ? 'Mark as read' : <><Check aria-hidden="true" size={13} />Read</>}
          </button>
        </li>)}
      </ol>}
    </div>
    <footer className="activity-actions">
      {expanded ? <>
        <button aria-label="Mark all activity read" disabled={!activity.unreadCount} onClick={() => activity.markRead()} type="button"><Check aria-hidden="true" size={14} />Mark all read</button>
        <button aria-label={activity.status === 'loading' ? 'Syncing activity' : 'Refresh activity'} disabled={activity.status === 'loading'}
          onClick={activity.refresh} type="button"><RefreshCw aria-hidden="true" size={14} />{activity.status === 'loading' ? 'Syncing' : 'Refresh'}</button>
      </> : <button aria-label="Open full activity history" onClick={event => { keyboardHistory.current = event.detail === 0; setHistoryOpen(true); }} ref={historyTrigger} type="button"><History aria-hidden="true" size={14} />View full history</button>}
    </footer>
  </Surface>;
}
