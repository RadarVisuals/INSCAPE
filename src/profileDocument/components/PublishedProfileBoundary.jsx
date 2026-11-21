import { lazy, Suspense, useState } from 'react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { StartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import PublicWorkspaceHeader from './PublicWorkspaceHeader.jsx';
import PublishedProfileDocumentPreview from './PublishedProfileDocumentPreview.jsx';
import { PUBLISHED_PROFILE_STATUS } from '../storage/luksoPublishedProfileRepository.js';
import './publishedProfileStatus.css';
import '../../public/ownerSystemWorkflow/workflowTactile.css';
import AlphaSupportPanel from '../../support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from '../../support/alphaSupport.js';
import useDeferredFocusReturn from '../../public/useDeferredFocusReturn.js';
const GalleryRemovalReview = lazy(() => import('./GalleryRemovalReview.jsx'));
const OwnerReception = lazy(() => import('../../reception/OwnerReception.jsx'));
const PublishedCanvasGallery = lazy(() => import('./PublishedCanvasGallery.jsx'));
const PublishedWriting = lazy(() => import('./PublishedWriting.jsx'));
const emptyEntries = [];
const emptySnapshot = { entries: emptyEntries };

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

function PublishedStatusSurface({ state, onRetry }) {
  const [title, message] = STATUS_COPY[state?.status] || STATUS_COPY.ERROR;
  const supportRequired = [PUBLISHED_PROFILE_STATUS.INVALID, PUBLISHED_PROFILE_STATUS.ERROR].includes(state?.status);
  return <main className="published-profile-status" data-lattice-menu-surface
    data-published-focus-fallback tabIndex="-1" aria-label="Published profile status">
    {state?.status !== PUBLISHED_PROFILE_STATUS.LOADING && <StartupDestinationReady />}
    <section className="published-profile-status__card" role="status" aria-busy={state?.busy}>
      <header><span>PUBLIC PROFILE</span><h1>{title}</h1></header>
      <div className="published-profile-status__body">
        <p>{message}</p><code>{state?.address}</code>
        <div className="published-profile-actions">{state?.status !== PUBLISHED_PROFILE_STATUS.LOADING && state?.status !== 'CONTEXT_REQUIRED' && <RetryButton state={state} onRetry={onRetry} />}</div>
        {supportRequired && <AlphaSupportPanel
          code={state.status === PUBLISHED_PROFILE_STATUS.INVALID
            ? ALPHA_SUPPORT_CODES.PUBLISHED_DOCUMENT_FAILED
            : ALPHA_SUPPORT_CODES.PUBLICATION_RESOLUTION_FAILED}
          phase="PUBLISHED_PROFILE_RESOLUTION" providerCategory="RPC_OR_IPFS_GATEWAY"
          profileAddress={state.address} routeClass="PUBLISHED_VISITOR"  />}
      </div>
      <footer><span>INSCAPE / PUBLIC WORLD</span><span>{state?.status || 'ERROR'}</span></footer>
    </section>
  </main>;
}

function UnpublishedProfilePage({ address, account, state, entry, onRetry, onNewComposition, onManageWorks, ...header }) {
  const identity = useProfileIdentity(address);
  const own = address && account?.address?.toLowerCase() === address.toLowerCase();
  const name = identity?.name || (own && account.name);
  const avatarUrl = identity?.avatarUrl || (own && account.avatarUrl) || null;
  const model = address && { address, officialProfile: { name: name || address.slice(0, 6) + '…' + address.slice(-4) }, profile: { avatarUrl } };
  const current = entry?.surface === 'writing' ? 'Writing' : entry?.surface === 'canvas' ? 'Gallery' : 'Profile';
  const emptyCollection = state?.status === PUBLISHED_PROFILE_STATUS.UNAVAILABLE && !entry?.target && current !== 'Profile';
  return <div className={emptyCollection ? 'visitor-publication' : 'published-status-page'}>
    <PublicWorkspaceHeader model={model} account={account} current={current} {...header} />
    {emptyCollection ? <Suspense fallback={<p role="status">Opening {current}.</p>}>
      <StartupDestinationReady />
      {current === 'Gallery' ? <PublishedCanvasGallery entries={emptyEntries} snapshot={emptySnapshot} onManageWorks={onManageWorks} onNewComposition={onNewComposition} />
        : <PublishedWriting snapshot={emptySnapshot} />}
    </Suspense> : <PublishedStatusSurface state={state} onRetry={onRetry} />}
  </div>;
}

function OwnerGallery({ resolution, getWalletPublicationContext, onRetry, onPublicationConfirmed, ...preview }) {
  const [removal, setRemoval] = useState(null);
  const { restoreFocus } = useDeferredFocusReturn();
  const verified = resolution.status === PUBLISHED_PROFILE_STATUS.RESOLVED && !resolution.busy;
  const close = () => {
    setRemoval(null);
    restoreFocus(() => removal.trigger?.isConnected ? removal.trigger : window.document.querySelector('.visitor-tabs [aria-current="page"]'));
  };
  const reviewRemoval = (selection, trigger) => {
    const ids = [...new Set(Array.isArray(selection) ? selection : [selection])];
    if (ids.length) setRemoval({ ids, trigger, document: resolution.document });
  };
  return <><PublishedProfileDocumentPreview {...preview} document={resolution.document}
    onRemoveFromGallery={verified ? reviewRemoval : undefined} />
    {removal && <Suspense fallback={<span role="status">Opening publication review.</span>}>
      <GalleryRemovalReview removal={removal} onRetry={onRetry} getWalletPublicationContext={getWalletPublicationContext}
        onClose={close} onPublished={(result, removedTitles) => { close(); onPublicationConfirmed(result, removedTitles); }} />
    </Suspense>}
  </>;
}

export default function PublishedProfileBoundary({
  address, resolution, onRetry, connectedProfile, returnProfileAddress, ownerDestinations, onReturnToWorkbench,
  getWalletPublicationContext, onPublicationConfirmed,
  onManageWorks, onNewComposition, onEditComposition, onEditReception, onVisitProfile, onOpenDiscover, onConnect, onDisconnect,
  entry, onOpenOverview, onOpenCanvas, onOpenWriting,
}) {
  const visibleDocument = [PUBLISHED_PROFILE_STATUS.RESOLVED, PUBLISHED_PROFILE_STATUS.STALE].includes(resolution?.status) ? resolution.document : null;
  const ownProfile = Boolean(returnProfileAddress && returnProfileAddress.toLowerCase() === String(address || '').toLowerCase());
  const returnToWorkbench = ownProfile ? onReturnToWorkbench : null;
  const returnHome = returnProfileAddress && !ownProfile ? () => onVisitProfile?.(returnProfileAddress, { returnToConnectedProfile: true }) : null;
  const editComposition = returnToWorkbench ? onEditComposition : undefined;
  const editProfile = returnToWorkbench ? onEditReception : undefined;
  const createComposition = returnToWorkbench ? onNewComposition : undefined;
  const manageWorks = returnToWorkbench ? onManageWorks : undefined;
  const navigation = { onManageWorks: manageWorks, onNewComposition: createComposition, account: connectedProfile, ownerDestinations, onConnect, onDisconnect, onOpenWriting, onOpenOverview, onOpenCanvas,
    onOpenDirectory: onOpenDiscover, onReturnToWorkbench: returnToWorkbench, onEditReception: editProfile, onEditComposition: editComposition };
  if (returnToWorkbench && entry?.surface === 'overview' && !entry.target && entry?.reception !== 'published') {
    return <Suspense fallback={<p role="status">Opening Profile…</p>}>
      <OwnerReception key={address} address={address} document={visibleDocument} {...navigation} />
    </Suspense>;
  }
  if (!visibleDocument) return <UnpublishedProfilePage address={address} account={connectedProfile} entry={entry}
    state={resolution} onRetry={onRetry} onNewComposition={createComposition} onManageWorks={manageWorks}
    onProfile={onOpenOverview} onWorks={onOpenCanvas} onWriting={onOpenWriting}
    ownerDestinations={ownerDestinations} onDiscover={onOpenDiscover} onConnect={onConnect} onDisconnect={onDisconnect} />;
  const editableGallery = returnToWorkbench && connectedProfile?.address?.toLowerCase() === address.toLowerCase()
    && entry?.surface === 'canvas' && !entry.target && getWalletPublicationContext && onPublicationConfirmed && onRetry;
  return <>{editableGallery ? <OwnerGallery key={address} resolution={resolution} entry={entry} onReturn={returnHome} {...navigation}
    getWalletPublicationContext={getWalletPublicationContext} onPublicationConfirmed={onPublicationConfirmed} onRetry={onRetry} />
    : <PublishedProfileDocumentPreview document={visibleDocument} entry={entry} onReturn={returnHome} {...navigation} />}
    {resolution.status === PUBLISHED_PROFILE_STATUS.STALE && <div className="published-profile-stale" role="status" aria-busy={resolution.busy}>Showing the last verified document while {resolution.busy ? 'checking the network.' : 'the network is unavailable.'} <RetryButton state={resolution} onRetry={onRetry} /></div>}
  </>;
}
