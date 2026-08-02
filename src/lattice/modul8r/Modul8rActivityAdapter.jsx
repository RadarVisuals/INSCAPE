import { useState } from 'react';
import { abbreviateAddress } from '../../signals/domain/signalMessages.js';
import useActivityController from '../../signals/state/useActivityController.js';
import { getOfficialProfileUrl, PROFILE_IDENTITY_STATUS, useProfileIdentity } from '../../profileIdentity/index.js';
import './modul8rActivity.css';

const LABELS = Object.freeze({
  ASSET_RECEIVED: 'ASSET RECEIVED', ASSET_SENT: 'ASSET SENT', FOLLOWER_GAINED: 'NEW FOLLOWER',
  LYX_RECEIVED: 'LYX RECEIVED', LYX_SENT: 'LYX SENT', PROFILE_FOLLOWED: 'PROFILE FOLLOWED',
  UNKNOWN_ACTIVITY: 'ACTIVITY',
});

const formatTime = (timestamp) => timestamp
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : null;

function formatLyx(wei) {
  if (wei == null) return null;
  try {
    const value = BigInt(wei); const whole = value / 10n ** 18n;
    const fraction = String(value % 10n ** 18n).padStart(18, '0').slice(0, 4).replace(/0+$/, '');
    return `${whole}${fraction ? `.${fraction}` : ''} LYX`;
  } catch { return null; }
}

function ActivityIdentity({ address }) {
  const identity = useProfileIdentity(address, { sourceMode: 'LIVE' });
  const [avatarFailed, setAvatarFailed] = useState(false);
  const compact = abbreviateAddress(address);
  const name = identity?.status === PROFILE_IDENTITY_STATUS.RESOLVED ? identity.name : null;
  const profileUrl = identity?.isUniversalProfile ? getOfficialProfileUrl(address) : null;
  if (!compact) return null;
  return <span className="modul8r-activity__identity" title={address}>
    <i>{identity?.avatarUrl && !avatarFailed ? <img alt="" loading="lazy" onError={() => setAvatarFailed(true)} referrerPolicy="no-referrer" src={identity.avatarUrl} /> : null}</i>
    {profileUrl ? <a href={profileUrl} rel="noopener noreferrer" target="_blank">{name || compact}</a> : <b>{name || compact}</b>}
    {name && <small>{compact}</small>}
  </span>;
}

export default function Modul8rActivityAdapter({ active, profileAddress, repository }) {
  const { error, partialError, refresh, retry, signals, status } = useActivityController({ active, profileAddress, repository });
  const displayStatus = status === 'idle' && active ? 'loading' : status;
  const retainedFailure = status === 'error' && signals.length > 0;
  return <div className="modul8r-activity">
    <div className="modul8r-activity__toolbar">
      <span>INDEXED EVENT HISTORY / NEWEST FIRST</span>
      <button disabled={displayStatus === 'loading'} onClick={refresh} type="button">{displayStatus === 'loading' ? 'LOADING' : 'REFRESH'}</button>
    </div>
    <div className="modul8r-activity__feedback">
      {partialError && <p role="status">PARTIAL ON-CHAIN DATA</p>}
      {retainedFailure && <p role="alert">REFRESH FAILED / {error || 'ACTIVITY UNAVAILABLE'} <button onClick={retry} type="button">RETRY</button></p>}
      {displayStatus === 'loading' && !signals.length && <p>LOADING PROFILE ACTIVITY</p>}
      {status === 'error' && !signals.length && <p role="alert">{error || 'ACTIVITY UNAVAILABLE'} <button onClick={retry} type="button">RETRY</button></p>}
      {['ready', 'partial'].includes(status) && !signals.length && <p>NO RECENT PROFILE ACTIVITY</p>}
    </div>
    {signals.length > 0 && <ol className="modul8r-activity__list">
      {signals.map((signal, index) => <li key={signal.id}>
        <span className="modul8r-activity__number">{String(index + 1).padStart(2, '0')}</span>
        <div className="modul8r-activity__event">
          <header><strong>{LABELS[signal.type] || 'ACTIVITY'}</strong>{signal.assetReference?.standard && <span>{signal.assetReference.standard}</span>}</header>
          <h3>{signal.title}</h3>
          <ActivityIdentity address={signal.counterparty} />
        </div>
        <div className="modul8r-activity__record">
          {formatLyx(signal.value) && <strong>{formatLyx(signal.value)}</strong>}
          {formatTime(signal.timestamp) && <time dateTime={new Date(signal.timestamp).toISOString()}>{formatTime(signal.timestamp)}</time>}
          {signal.transactionHash && <small title={signal.transactionHash}>{abbreviateAddress(signal.transactionHash) || signal.transactionHash}</small>}
        </div>
      </li>)}
    </ol>}
  </div>;
}
