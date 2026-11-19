import { lazy, Suspense, useMemo, useState } from 'react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';
import { publishedCompositionEntries } from '../domain/publishedCanvases.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import PublicWorkspaceHeader from './PublicWorkspaceHeader.jsx';
import VisitorProfile from './VisitorProfile.jsx';
import VisitorLightField from './VisitorLightField.jsx';
import './visitorProfile.css';

const PublishedCanvasGallery = lazy(() => import('./PublishedCanvasGallery.jsx'));
const ReceptionOverview = lazy(() => import('../../reception/ReceptionOverview.jsx'));
const PublishedWriting = lazy(() => import('./PublishedWriting.jsx'));

export default function ProfileOverview({ document: publication, works, writing, reception, account, ownerDestinations,
  onReturnToWorkbench, onEditReception, onEditComposition, unavailableTarget, onOpenDirectory, onOpenCanvas, onOpenOverview,
  onOpenWriting, onNewComposition, onRemoveFromGallery, onConnect, onDisconnect, onReturn }) {
  useStartupDestinationReady();
  const identity = useProfileIdentity(publication.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document: publication, identity }), [publication, identity]);
  const snapshot = useMemo(() => publishedPresentationSnapshot(publication), [publication]);
  const [profileLayout, setProfileLayout] = useState('card');
  const [workView, setWorkView] = useState(() => ({ layout: innerWidth >= 900 ? 'list' : 'grid', wrap: true }));
  const [selectedWork, setSelectedWork] = useState(null);
  const [profileWork, setProfileWork] = useState(null);
  const [writingSource, setWritingSource] = useState(null);
  const [cardSize, setCardSize] = useState(2);
  const [cameraMemory] = useState(() => ({ cameras: new Map() }));
  const destination = works ? 'gallery' : 'profile';
  const entries = useMemo(() => publishedCompositionEntries(publication, destination), [publication, destination]);
  const explicitBento = !works && !writing && reception === true && publication.reception;
  const current = writing ? 'Writing' : works ? 'Gallery' : 'Profile';
  const selectedId = works ? selectedWork : profileWork;
  const selectedEntry = entries.find(item => item.id === selectedId);
  const defaultEntry = works ? entries[0] : entries.find(item => item.id === 'reception');
  const currentWork = writing ? writingSource : (explicitBento && 'reception') || (selectedEntry || defaultEntry)?.id;
  const edit = id => id === 'reception' ? onEditReception?.() : onEditComposition?.(id);
  const editCurrent = onReturnToWorkbench && (currentWork && (currentWork === 'reception' ? onEditReception : onEditComposition)
    ? () => edit(currentWork) : onNewComposition || onReturnToWorkbench);
  const destinations = editCurrent ? { ...ownerDestinations, Studio: editCurrent } : ownerDestinations;
  return <div className="visitor-publication" data-section={writing ? 'writing' : works ? 'works' : 'profile'}>
    <VisitorLightField />
    <PublicWorkspaceHeader model={model} account={account} current={current} onProfile={onOpenOverview} onWorks={onOpenCanvas}
      onWriting={onOpenWriting} onEdit={editCurrent} ownerDestinations={destinations}
      onDiscover={onOpenDirectory} onConnect={onConnect} onDisconnect={onDisconnect} />
    {unavailableTarget && <p role="status" className="visitor-notice">That destination is no longer in this publication.</p>}
    <Suspense fallback={<p role="status">Opening {current}.</p>}>
      {writing ? <PublishedWriting snapshot={snapshot} reception={publication.reception} onSelectSource={setWritingSource} /> : explicitBento
        ? <ReceptionOverview embedded snapshot={snapshot} reception={publication.reception} model={model}
            address={publication.profile.address} onOpenCanvas={onOpenCanvas} onOpenDirectory={onOpenDirectory} onCloseBento={onOpenOverview} onReturn={onReturn} />
        : <>{!works && <VisitorProfile model={model} layout={profileLayout} onLayoutChange={setProfileLayout} />}
          {(works || entries.length > 0) && <PublishedCanvasGallery entries={entries} snapshot={snapshot} persona={model}
            profileLinks={!works} onRemoveFromGallery={works ? onRemoveFromGallery : undefined} onNewComposition={onNewComposition} selectedId={selectedId} onSelect={works ? setSelectedWork : setProfileWork}
            view={workView} onViewChange={setWorkView} cardSize={cardSize} onCardSize={setCardSize} cameraMemory={cameraMemory}
            onEdit={onReturnToWorkbench && onEditComposition ? edit : undefined} />}</>}
    </Suspense>
  </div>;
}
