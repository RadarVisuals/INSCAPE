import { useEffect } from 'react';
import PublishedProfileDocumentPreview from './PublishedProfileDocumentPreview.jsx';
import { PUBLISHED_PROFILE_STATUS } from '../storage/luksoPublishedProfileRepository.js';
import { usePublishedProfile } from '../state/usePublishedProfile.js';
import '../../public/moduleGrid.css';
import '../../library/collection.css';
import '../profileDocument.css';
import '../../public/canvasObjects.css';

const STATUS_COPY = Object.freeze({
  LOADING: ['RESOLVING PUBLISHED PROFILE', 'Reading and verifying the profile document.'],
  UNAVAILABLE: ['PROFILE UNAVAILABLE', 'This Universal Profile has not published an OS_UNDERNEATH profile document.'],
  INVALID: ['INVALID PUBLISHED PROFILE', 'The published pointer or document could not be verified.'],
  ERROR: ['PROFILE TEMPORARILY UNAVAILABLE', 'The public network or content gateway could not be reached.']
});

function RetryButton({ state, onRetry }) {
  return <button type="button" className="published-profile-retry" onClick={onRetry} disabled={state?.busy}
    aria-disabled={state?.busy} aria-busy={state?.busy}>{state?.busy ? 'RETRYING…' : 'RETRY'}</button>;
}

function PublishedStatusSurface({ state, onRetry }) {
  const [title, message] = STATUS_COPY[state?.status] || STATUS_COPY.ERROR;
  return <main className="public-shell published-profile-status" aria-label="Published profile status">
    <section className="profile-document-preview__identity" role="status" aria-busy={state?.busy}><div><strong>{title}</strong><small>{message}</small><small>{state?.address}</small>
      {state?.status !== PUBLISHED_PROFILE_STATUS.LOADING && <RetryButton state={state} onRetry={onRetry} />}</div></section>
  </main>;
}

export default function PublishedProfileBoundary({ address, onDocumentChange, onMoveKeeper }) {
  const [resolution, retry] = usePublishedProfile(address);
  const visibleDocument = [PUBLISHED_PROFILE_STATUS.RESOLVED, PUBLISHED_PROFILE_STATUS.STALE].includes(resolution?.status) ? resolution.document : null;
  useEffect(() => { onDocumentChange?.(visibleDocument); return () => onDocumentChange?.(null); }, [onDocumentChange, visibleDocument]);
  if (!visibleDocument) return <PublishedStatusSurface state={resolution} onRetry={retry} />;
  return <><PublishedProfileDocumentPreview document={visibleDocument} onMoveKeeper={onMoveKeeper} />
    {resolution.status === PUBLISHED_PROFILE_STATUS.STALE && <div className="published-profile-stale" role="status" aria-busy={resolution.busy}>Showing the last verified document while {resolution.busy ? 'checking the network.' : 'the network is unavailable.'} <RetryButton state={resolution} onRetry={retry} /></div>}
  </>;
}
