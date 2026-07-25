import { useEffect, useState } from 'react';
import PublishedProfileDocumentPreview from './PublishedProfileDocumentPreview.jsx';
import ProfileDiscoveryBoundary from '../../profileDiscovery/ProfileDiscoveryBoundary.jsx';
import { PUBLISHED_PROFILE_STATUS } from '../storage/luksoPublishedProfileRepository.js';
import { usePublishedProfile } from '../state/usePublishedProfile.js';
import '../../public/moduleGrid.css';
import '../../library/collection.css';
import '../profileDocument.css';
import '../../public/canvasObjects.css';
import './publishedProfileStatus.css';

const STATUS_COPY = Object.freeze({
  CONTEXT_REQUIRED: ['PROFILE CONTEXT REQUIRED', 'Open the installed app from a Universal Profile, or provide an explicit profile address while developing locally.'],
  LOADING: ['RESOLVING PUBLISHED PROFILE', 'Reading and verifying the profile document.'],
  UNAVAILABLE: ['PROFILE UNAVAILABLE', 'This Universal Profile has not published an INSCAPE profile document.'],
  INVALID: ['INVALID PUBLISHED PROFILE', 'The published pointer or document could not be verified.'],
  ERROR: ['PROFILE TEMPORARILY UNAVAILABLE', 'The public network or content gateway could not be reached.']
});

function RetryButton({ state, onRetry }) {
  return <button type="button" className="published-profile-retry" onClick={onRetry} disabled={state?.busy}
    aria-disabled={state?.busy} aria-busy={state?.busy}>{state?.busy ? 'RETRYING…' : 'RETRY'}</button>;
}

function PublishedStatusSurface({ state, onRetry, onOpenDirectory, onReturn }) {
  const [title, message] = STATUS_COPY[state?.status] || STATUS_COPY.ERROR;
  return <main className="public-shell published-profile-status" data-published-focus-fallback tabIndex="-1" aria-label="Published profile status">
    <section className="published-profile-status__card" role="status" aria-busy={state?.busy}>
      <span>INSCAPE / PUBLIC WORLD</span><h1>{title}</h1><p>{message}</p><code>{state?.address}</code>
      <div className="published-profile-actions">{onOpenDirectory && <button type="button" onClick={onOpenDirectory}>DIRECTORY</button>}
        {onReturn && <button type="button" onClick={onReturn}>RETURN</button>}
        {state?.status !== PUBLISHED_PROFILE_STATUS.LOADING && state?.status !== 'CONTEXT_REQUIRED' && <RetryButton state={state} onRetry={onRetry} />}</div>
    </section>
  </main>;
}

export default function PublishedProfileBoundary({ address, returnProfileAddress, onVisitProfile, onDocumentChange, onMoveKeeper, onMoveKeeperHorizontally }) {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [resolution, retry] = usePublishedProfile(address);
  const visibleDocument = [PUBLISHED_PROFILE_STATUS.RESOLVED, PUBLISHED_PROFILE_STATUS.STALE].includes(resolution?.status) ? resolution.document : null;
  const canReturn = Boolean(returnProfileAddress && returnProfileAddress.toLowerCase() !== String(address || '').toLowerCase());
  const returnHome = canReturn ? () => onVisitProfile?.(returnProfileAddress) : null;
  useEffect(() => { onDocumentChange?.(visibleDocument); return () => onDocumentChange?.(null); }, [onDocumentChange, visibleDocument]);
  const content = !visibleDocument
    ? <PublishedStatusSurface state={resolution} onRetry={retry} onOpenDirectory={() => setDirectoryOpen(true)} onReturn={returnHome} />
    : <><PublishedProfileDocumentPreview document={visibleDocument} onMoveKeeper={onMoveKeeper} onMoveKeeperHorizontally={onMoveKeeperHorizontally}
      onOpenDirectory={() => setDirectoryOpen(true)} onReturn={returnHome} />
    {resolution.status === PUBLISHED_PROFILE_STATUS.STALE && <div className="published-profile-stale" role="status" aria-busy={resolution.busy}>Showing the last verified document while {resolution.busy ? 'checking the network.' : 'the network is unavailable.'} <RetryButton state={resolution} onRetry={retry} /></div>}
    </>;
  return <>{content}{directoryOpen && <ProfileDiscoveryBoundary onClose={() => setDirectoryOpen(false)} onSelect={(profile) => {
    onVisitProfile?.(profile.address); setDirectoryOpen(false);
  }} />}</>;
}
