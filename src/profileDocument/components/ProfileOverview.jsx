import { lazy, Suspense, useContext, useMemo, useState } from 'react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';
import { publishedCompositionEntries } from '../domain/publishedCanvases.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import { GalleryStudioMotion } from '../../profileDiscovery/galleryStudioMotion.js';
import { readGalleryView, rememberGalleryView } from '../../profileDiscovery/galleryViewMemory.js';
import PublicWorkspaceHeader from './PublicWorkspaceHeader.jsx';
import VisitorProfile from './VisitorProfile.jsx';
import VisitorLightField from './VisitorLightField.jsx';
import './visitorProfile.css';

const PublishedCanvasGallery = lazy(() => import('./PublishedCanvasGallery.jsx'));
const ReceptionOverview = lazy(() => import('../../reception/ReceptionOverview.jsx'));
const PublishedWriting = lazy(() => import('./PublishedWriting.jsx'));

export default function ProfileOverview({ document: publication, works, writing, reception, account, ownerDestinations,
  onReturnToWorkbench, onEditReception, onEditComposition, unavailableTarget, onOpenDirectory, onOpenCanvas, onOpenOverview,
  onOpenWriting, onManageWorks, onNewComposition, onRemoveFromGallery, onConnect, onDisconnect, onReturn }) {
  useStartupDestinationReady();
  const identity = useProfileIdentity(publication.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document: publication, identity }), [publication, identity]);
  const snapshot = useMemo(() => publishedPresentationSnapshot(publication), [publication]);
  const address = publication.profile.address;
  const [gallery, setGallery] = useState(() => ({
    layout: innerWidth >= 900 ? 'list' : 'grid', wrap: true, quickView: false, selectedId: null, cardSize: 2, viewportSize: 65,
    ...(onReturnToWorkbench && readGalleryView(address)),
  }));
  const changeGallery = patch => {
    if (onReturnToWorkbench) rememberGalleryView(address, patch);
    setGallery(current => ({ ...current, ...patch }));
  };
  const [toolbarHost, setToolbarHost] = useState(null);
  const [profileLayout, setProfileLayout] = useState('card');
  const [profileWork, setProfileWork] = useState(null);
  const motion = useContext(GalleryStudioMotion);
  const [cameraMemory] = useState(() => onReturnToWorkbench && motion?.galleryMemory.current?.address === address
    ? motion.galleryMemory.current.memory : { cameras: new Map() });
  const destination = works ? 'gallery' : 'profile';
  const entries = useMemo(() => publishedCompositionEntries(publication, destination), [publication, destination]);
  const explicitBento = !works && !writing && reception === true && publication.reception;
  const current = writing ? 'Writing' : works ? 'Gallery' : 'Profile';
  const selectedId = works ? gallery.selectedId : profileWork;
  const edit = id => {
    if (works) changeGallery({ selectedId: id });
    if (id === 'reception') onEditReception?.();
    else onEditComposition?.(id);
  };
  return <div className="visitor-publication" data-section={writing ? 'writing' : works ? 'works' : 'profile'}>
    <VisitorLightField />
    <PublicWorkspaceHeader model={model} account={account} current={current} toolbarRef={works && !writing ? setToolbarHost : undefined} onProfile={onOpenOverview} onWorks={onOpenCanvas}
      onWriting={onOpenWriting} ownerDestinations={ownerDestinations}
      onDiscover={onOpenDirectory} onConnect={onConnect} onDisconnect={onDisconnect} />
    {unavailableTarget && <p role="status" className="visitor-notice">That destination is no longer in this publication.</p>}
    <Suspense fallback={<p role="status">Opening {current}.</p>}>
      {writing ? <PublishedWriting snapshot={snapshot} reception={publication.reception} /> : explicitBento
        ? <ReceptionOverview embedded snapshot={snapshot} reception={publication.reception} model={model}
            address={publication.profile.address} onOpenCanvas={onOpenCanvas} onOpenDirectory={onOpenDirectory} onCloseBento={onOpenOverview} onReturn={onReturn} />
        : <>{!works && <VisitorProfile model={model} layout={profileLayout} onLayoutChange={setProfileLayout} />}
          {(works || entries.length > 0) && <PublishedCanvasGallery entries={entries} snapshot={snapshot} persona={model}
            toolbarHost={toolbarHost} profileLinks={!works} onManageWorks={works ? onManageWorks : undefined} onRemoveFromGallery={works ? onRemoveFromGallery : undefined} onNewComposition={onNewComposition} selectedId={selectedId} onSelect={works ? id => changeGallery({ selectedId: id }) : setProfileWork}
            view={{ layout: gallery.layout, wrap: gallery.wrap, quickView: gallery.quickView, viewportSize: gallery.viewportSize }} onViewChange={changeGallery} cardSize={gallery.cardSize} onCardSize={cardSize => changeGallery({ cardSize })} cameraMemory={cameraMemory}
            onEdit={onReturnToWorkbench && onEditComposition ? edit : undefined} />}</>}
    </Suspense>
  </div>;
}
