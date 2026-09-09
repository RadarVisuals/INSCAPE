import { Check, History, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOwnerSystemWorkflowPanelPresence } from './useOwnerSystemWorkflowPanels.js';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';

const TABS = ['ALL', 'ASSETS', 'LYX', 'SOCIAL'];
const HISTORY_FILTERS = ['ALL', 'UNREAD', 'ASSETS', 'LYX', 'SOCIAL'];
const displayFilter = (value) => value === 'LYX' ? value : `${value.charAt(0)}${value.slice(1).toLowerCase()}`;

export default function OwnerSystemWorkflowActivity({ activity, onClose, phase }) {
  const [tab, setTab] = useState('ALL');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const historyTrigger = useRef(null);
  const historyPresence = useOwnerSystemWorkflowPanelPresence(historyOpen);
  useEffect(() => {
    if (!historyOpen) return undefined;
    const closeHistory = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      clearOwnerSystemWorkflowDocumentSelection();
      setHistoryOpen(false);
    };
    globalThis.addEventListener?.('keydown', closeHistory, true);
    return () => globalThis.removeEventListener?.('keydown', closeHistory, true);
  }, [historyOpen]);
  useEffect(() => {
    if (!historyOpen && !historyPresence.present) requestAnimationFrame(() => historyTrigger.current?.focus());
  }, [historyOpen, historyPresence.present]);
  const drawerEntries = activity.entries.filter((entry) => tab === 'ALL' || entry.type === tab).slice(0, 5);
  const historyEntries = useMemo(() => activity.entries.filter((entry) => {
    if (historyFilter === 'UNREAD' && !entry.unread) return false;
    if (!['ALL', 'UNREAD'].includes(historyFilter) && entry.type !== historyFilter) return false;
    const search = `${entry.label} ${entry.detail}`.toLowerCase();
    return !query.trim() || search.includes(query.trim().toLowerCase());
  }), [activity.entries, historyFilter, query]);
  if (historyPresence.present) return <section aria-hidden={phase === 'closing' || historyPresence.phase === 'closing' || undefined} aria-label="Full activity history"
    className="system-workflow__activity-history system-workflow__motion-panel" data-panel-phase={historyPresence.phase} inert={phase === 'closing' || historyPresence.phase === 'closing' ? '' : undefined}
    onTransitionEnd={(event) => { if (event.propertyName === 'transform') historyPresence.completeTransition(); }}>
    <div className="system-workflow__activity-feedback">
      {activity.partialError && <p role="status">Partial on-chain data · {activity.partialError}</p>}
      {activity.status === 'error' && <p role="alert">{activity.error || 'Activity unavailable'} <button onClick={activity.retry} type="button">Retry</button></p>}
    </div>
    {historyEntries.length ? <ol>{historyEntries.map((entry) => <li data-unread={entry.unread || undefined} key={entry.id}>
      <i /><time><strong>{entry.date}</strong><small>{entry.time}</small></time><span><strong>{entry.label}</strong><small>{entry.detail}</small></span><em>{entry.type}</em>
      <button onClick={() => activity.markRead(entry.id)} type="button">Open →</button>
    </li>)}</ol> : <p className="system-workflow__empty">No events match this view.</p>}
    <footer className="system-workflow__activity-history-rail">
      <label><Search aria-hidden="true" size={14} /><input aria-label="Search activity" onChange={(event) => setQuery(event.target.value)} placeholder="Search" type="search" value={query} /></label>
      <nav aria-label="Full activity history filters">{HISTORY_FILTERS.map((value) => <button aria-pressed={historyFilter === value} key={value} onClick={() => setHistoryFilter(value)} type="button">{displayFilter(value)}</button>)}</nav>
      <button aria-label="Mark all activity read" disabled={!activity.unreadCount} onClick={() => activity.markRead()} type="button"><Check size={13} />Mark all read</button>
      <button aria-label={activity.status === 'loading' ? 'Syncing activity' : 'Refresh activity'} className="system-workflow__activity-refresh" disabled={activity.status === 'loading'} onClick={activity.refresh} type="button"><RefreshCw size={13} /><span>{activity.status === 'loading' ? 'Syncing' : 'Refresh'}</span></button>
      <button aria-label="Close full activity history" onClick={() => { clearOwnerSystemWorkflowDocumentSelection(); setHistoryOpen(false); }} type="button"><X size={14} /></button>
    </footer>
  </section>;
  return <aside aria-hidden={phase === 'closing' || undefined} aria-label="Activity notifications"
    className="system-workflow__activity-drawer system-workflow__motion-panel" inert={phase === 'closing' ? '' : undefined}>
    <div className="system-workflow__activity-feedback">
      {activity.status === 'loading' && !drawerEntries.length && <p>Syncing LUKSO activity…</p>}
      {activity.status === 'error' && <p role="alert">{activity.error || 'Activity unavailable'} <button onClick={activity.retry} type="button">Retry</button></p>}
    </div>
    <ol>{drawerEntries.map((entry) => <li data-unread={entry.unread || undefined} key={entry.id}>
      <i /><time>{entry.time}</time><button onClick={() => activity.markRead(entry.id)} type="button"><b>{entry.label}</b><small>{entry.detail}</small></button>
    </li>)}</ol>
    <nav aria-label="Activity filters" className="system-workflow__local-rail">{TABS.map((value) => <button aria-pressed={tab === value} key={value} onClick={() => setTab(value)} type="button">{displayFilter(value)}</button>)}
      <button aria-label="Open full activity history" onClick={() => setHistoryOpen(true)} ref={historyTrigger} type="button"><History size={13} /></button>
      <button aria-label="Close activity" onClick={onClose} type="button"><X size={13} /></button>
    </nav>
  </aside>;
}
