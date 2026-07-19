import { useEffect, useState } from 'react';
import { Copy, ExternalLink, RefreshCw, RotateCcw, X } from 'lucide-react';
import { abbreviateAddress } from '../domain/signalMessages.js';
import { useSignalStore } from '../state/useSignalStore.js';
import { getOfficialProfileUrl, PROFILE_IDENTITY_STATUS, useProfileIdentity } from '../../profileIdentity/index.js';

const LABELS = { ASSET_RECEIVED: 'Asset received', ASSET_SENT: 'Asset sent', LYX_RECEIVED: 'LYX received', LYX_SENT: 'LYX sent', UNKNOWN_ACTIVITY: 'Activity' };
const formatTime = (timestamp) => timestamp ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : 'Unknown time';

function CounterpartyIdentity({ signal }) {
  const identity = useProfileIdentity(signal.counterparty, { sourceMode: signal.sourceMode });
  const [avatarFailed, setAvatarFailed] = useState(false);
  const addressLabel = abbreviateAddress(signal.counterparty);
  if (!addressLabel) return <span>Profile signal</span>;
  const resolvedName = identity?.status === PROFILE_IDENTITY_STATUS.RESOLVED ? identity.name : null;
  const profileUrl = identity?.isUniversalProfile ? getOfficialProfileUrl(signal.counterparty) : null;
  const copyAddress = async () => { try { await navigator.clipboard.writeText(signal.counterparty); } catch { /* Clipboard is optional. */ } };
  return <div className="signal-identity" title={signal.counterparty}>
    <span className="signal-identity__avatar" aria-hidden="true">
      {identity?.avatarUrl && !avatarFailed ? <img src={identity.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} /> : <i />}
    </span>
    <span className="signal-identity__labels">
      {profileUrl && resolvedName ? <a href={profileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${resolvedName} Universal Profile`}><b>{resolvedName}</b><ExternalLink aria-hidden="true" /></a> : <b>{resolvedName || addressLabel}</b>}
      {resolvedName && <small>{addressLabel}</small>}
      <span className="sr-only">Canonical address {signal.counterparty}</span>
    </span>
    <button type="button" className="signal-identity__copy" onClick={copyAddress} aria-label={`Copy address ${signal.counterparty}`} title="Copy address"><Copy aria-hidden="true" /></button>
  </div>;
}

export default function SignalsWindow({ onClose, dragHandleProps, dragEnabled, editMode, escapeEnabled }) {
  const history = useSignalStore((state) => state.history); const status = useSignalStore((state) => state.status);
  const sourceMode = useSignalStore((state) => state.sourceMode); const error = useSignalStore((state) => state.error);
  const partialError = useSignalStore((state) => state.partialError); const synchronize = useSignalStore((state) => state.synchronize);
  const markSeen = useSignalStore((state) => state.markSeen); const replay = useSignalStore((state) => state.replay);
  const currentReactionId = useSignalStore((state) => state.currentReaction?.id || null);
  const queuedReactionIds = useSignalStore((state) => state.queue.map((signal) => signal.id));
  useEffect(() => { markSeen(); }, [markSeen]);
  useEffect(() => {
    if (!escapeEnabled) return undefined;
    const close = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [escapeEnabled, onClose]);
  return (
    <div className="signals-window">
      <header className="signals-window__header" data-window-titlebar="signals-panel" data-enabled={dragEnabled || undefined} {...dragHandleProps}>
        <div><h2 id="signals-title">Activity</h2></div><b data-source={sourceMode || undefined}>{sourceMode || 'OFFLINE'}</b>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label="Close Activity"><X aria-hidden="true" /></button>
      </header>
      <div className="signals-window__toolbar">
        <span>{history.length} recent / newest first</span>
        <button type="button" disabled={status === 'loading'} onClick={() => synchronize({ mode: 'LIVE' })}><RefreshCw aria-hidden="true" /> Refresh</button>
        {editMode && <button type="button" disabled={status === 'loading'} onClick={() => synchronize({ mode: 'FIXTURE', explicitReplay: true })}>Fixture mode</button>}
      </div>
      {partialError && <p className="signals-window__notice" role="status">Partial data: {partialError}</p>}
      {error && <div className="signals-window__error" role="alert"><p>{error}</p><button type="button" onClick={() => synchronize({ mode: sourceMode || 'LIVE' })}>Retry</button></div>}
      {status === 'loading' && !history.length && <p className="signals-window__empty" role="status">Listening for recent profile activity…</p>}
      {status !== 'loading' && !error && !history.length && <p className="signals-window__empty">No recent Keeper Signals.</p>}
      <ol className="signals-list">
        {history.map((signal) => {
          const replayState = currentReactionId === signal.id ? 'playing' : queuedReactionIds.includes(signal.id) ? 'queued' : 'ready';
          return <li key={signal.id} data-seen={signal.seen || undefined}>
            <i aria-hidden="true" /><div><header><strong>{LABELS[signal.type] || 'Activity'}</strong><span>{signal.sourceMode}</span></header>
              <h3>{signal.title}</h3><div className="signals-list__context">{signal.assetReference?.standard && <span>{signal.assetReference.standard}</span>}<CounterpartyIdentity signal={signal} /></div>
              <time dateTime={new Date(signal.timestamp).toISOString()}>{formatTime(signal.timestamp)}</time></div>
            <div className="signals-list__actions">{!signal.seen && <button type="button" onClick={() => markSeen(signal.id)}>Mark seen</button>}
              {editMode && <button type="button" disabled={replayState !== 'ready'} data-replay-state={replayState}
                onClick={() => replay(signal)} aria-label={`${replayState === 'playing' ? 'Playing' : replayState === 'queued' ? 'Queued' : 'Replay reaction for'} ${signal.title}`}>
                <RotateCcw aria-hidden="true" /><span>{replayState === 'playing' ? 'Playing' : replayState === 'queued' ? 'Queued' : 'Replay'}</span>
              </button>}</div>
          </li>;
        })}
      </ol>
    </div>
  );
}
