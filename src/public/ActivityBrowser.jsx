import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { abbreviateAddress } from '../signals/domain/signalMessages.js';
import useActivityController from '../signals/state/useActivityController.js';
import { getOfficialProfileUrl, PROFILE_IDENTITY_STATUS, useProfileIdentity } from '../profileIdentity/index.js';
import {
  initialCategoryBrowserRect,
  resizeCategoryBrowserByKey,
  resizeCategoryBrowserRect
} from './categoryAssetBrowserModel.js';
import FloatingWindowCloseButton from './FloatingWindowCloseButton.jsx';
import './activityBrowser.css';

const LABELS = Object.freeze({
  ASSET_RECEIVED: 'ASSET RECEIVED',
  ASSET_SENT: 'ASSET SENT',
  LYX_RECEIVED: 'LYX RECEIVED',
  LYX_SENT: 'LYX SENT',
  FOLLOWER_GAINED: 'NEW FOLLOWER',
  PROFILE_FOLLOWED: 'PROFILE FOLLOWED',
  UNKNOWN_ACTIVITY: 'ACTIVITY'
});
const viewportSize = () => ({ width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 });
const formatTime = (timestamp) => timestamp ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : null;

function formatLyx(wei) {
  if (wei == null) return null;
  try {
    const value = BigInt(wei);
    const whole = value / 10n ** 18n;
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
  return <span className="activity-browser__identity" title={address}>
    <i>{identity?.avatarUrl && !avatarFailed ? <img src={identity.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} /> : null}</i>
    {profileUrl ? <a href={profileUrl} target="_blank" rel="noopener noreferrer">{name || compact}</a> : <b>{name || compact}</b>}
    {name && <small>{compact}</small>}
  </span>;
}

export default function ActivityBrowser({ visible = false, open = false, onOpenChange, profileAddress, menuSurfaceId = 'mist', repository }) {
  const resizeRef = useRef(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [rect, setRect] = useState(() => initialCategoryBrowserRect(viewportSize()));
  const { error, partialError, refresh, retry, signals: activity, status } = useActivityController({
    active: open,
    profileAddress,
    repository,
  });
  const displayStatus = status === 'idle' && open ? 'loading' : status;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange?.(false);
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [onOpenChange, open]);

  useEffect(() => {
    const resize = () => {
      const nextViewport = viewportSize();
      setViewport(nextViewport);
      setRect((current) => resizeCategoryBrowserRect(current, { x: 0, y: 0 }, nextViewport));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const beginResize = (event) => {
    if (viewport.width < 720 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    resizeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect };
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveResize = (event) => {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setRect(resizeCategoryBrowserRect(active.rect, { x: event.clientX - active.x, y: event.clientY - active.y }, viewport));
  };
  const finishResize = (event) => { if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null; };
  const resizeByKey = (event) => {
    const next = resizeCategoryBrowserByKey(rect, event.key, viewport);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setRect(next);
  };

  const workspace = open && typeof document !== 'undefined' ? createPortal(<section className="activity-browser" data-lattice-menu-surface data-menu-surface={menuSurfaceId} style={rect} aria-label="Profile activity" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    <header><strong>ACTIVITY</strong><span>NEWEST FIRST</span><button type="button" disabled={displayStatus === 'loading'} onClick={refresh}>{displayStatus === 'loading' ? 'LOADING' : 'REFRESH'}</button></header>
    <FloatingWindowCloseButton onClose={() => onOpenChange?.(false)} label="Close activity browser" />
    <div className="activity-browser__body">
      <div className="activity-browser__feedback">
        {partialError && <p className="activity-browser__notice" role="status">PARTIAL ON-CHAIN DATA</p>}
        {displayStatus === 'loading' && !activity.length && <p className="activity-browser__status">LOADING PROFILE ACTIVITY</p>}
        {displayStatus === 'error' && !activity.length && <div className="activity-browser__error" role="alert"><p>{error || 'ACTIVITY UNAVAILABLE'}</p><button type="button" onClick={retry}>RETRY</button></div>}
        {displayStatus !== 'idle' && displayStatus !== 'loading' && displayStatus !== 'error' && !activity.length && <p className="activity-browser__status">NO RECENT PROFILE ACTIVITY</p>}
      </div>
      <ol>
        {activity.map((signal, index) => <li key={signal.id}>
          <span className="activity-browser__number">{String(index + 1).padStart(2, '0')}</span>
          <div className="activity-browser__event">
            <header><strong>{LABELS[signal.type] || 'ACTIVITY'}</strong>{signal.assetReference?.standard && <span>{signal.assetReference.standard}</span>}</header>
            <h2>{signal.title}</h2>
            <ActivityIdentity address={signal.counterparty} />
          </div>
          <div className="activity-browser__record">
            {formatLyx(signal.value) && <strong>{formatLyx(signal.value)}</strong>}
            {formatTime(signal.timestamp) && <time dateTime={new Date(signal.timestamp).toISOString()}>{formatTime(signal.timestamp)}</time>}
            {signal.transactionHash && <small title={signal.transactionHash}>{abbreviateAddress(signal.transactionHash) || signal.transactionHash}</small>}
          </div>
        </li>)}
      </ol>
    </div>
    <button className="activity-browser__resize" type="button" aria-label="Resize activity browser" onKeyDown={resizeByKey} onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize}><i aria-hidden="true">›</i></button>
  </section>, document.body) : null;

  return <>
    <section className="activity-navigation-card" aria-hidden={!visible} data-visible={visible || undefined} data-expanded={open || undefined}>
      <button type="button" tabIndex={visible ? 0 : -1} aria-expanded={open} onClick={() => onOpenChange?.(!open)}><strong>ACTIVITY</strong><i aria-hidden="true">›</i></button>
    </section>
    {workspace}
  </>;
}
