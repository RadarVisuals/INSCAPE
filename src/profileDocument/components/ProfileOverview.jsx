import { lazy, Suspense, useMemo, useState } from 'react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import VisitorHeader from './VisitorHeader.jsx';
import VisitorProfile from './VisitorProfile.jsx';
import VisitorLightField from './VisitorLightField.jsx';
import './visitorProfile.css';

const PublishedCanvasGallery = lazy(() => import('./PublishedCanvasGallery.jsx'));
const ReceptionOverview = lazy(() => import('../../reception/ReceptionOverview.jsx'));

// Explicit Reception links and existing published Bento work keep their authored renderer.
function PublishedBento({ publication, model, ...navigation }) {
  const snapshot = useMemo(() => publishedPresentationSnapshot(publication), [publication]);
  return <ReceptionOverview snapshot={snapshot} reception={publication.reception} model={model}
    address={publication.profile.address} {...navigation} />;
}

export default function ProfileOverview({ document: publication, works, reception, account, ownerDestinations,
  onReturnToWorkbench, unavailableTarget, onOpenDirectory, onReturn, onOpenCanvas, onOpenOverview, onConnect }) {
  const identity = useProfileIdentity(publication.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document: publication, identity }), [publication, identity]);
  const [profileLayout, setProfileLayout] = useState('card');
  const [openBento, setOpenBento] = useState(false);
  const [workView, setWorkView] = useState(() => ({ layout: innerWidth >= 900 ? 'list' : 'grid', wrap: true }));
  const [selectedWork, setSelectedWork] = useState(null);
  const [cardSize, setCardSize] = useState(2);
  const [cameraMemory] = useState(() => ({ cameras: new Map() }));
  const legacyBento = reception === true && Boolean(publication.reception);
  const gallery = <PublishedCanvasGallery document={publication} persona={model} onAbout={onOpenOverview}
    selectedId={selectedWork} onSelect={setSelectedWork} view={workView} onViewChange={setWorkView}
    cardSize={cardSize} onCardSize={setCardSize} cameraMemory={cameraMemory} visitorHeader={!legacyBento} />;
  if (legacyBento || (openBento && !works)) {
    return <Suspense fallback={<p role="status">Opening work.</p>}>{works ? gallery : <PublishedBento publication={publication} model={model}
      ownerDestinations={ownerDestinations} onReturnToWorkbench={onReturnToWorkbench} unavailableTarget={unavailableTarget}
      onOpenDirectory={onOpenDirectory} onReturn={onReturn} onCloseBento={openBento ? () => setOpenBento(false) : undefined}
      onOpenCanvas={() => { setOpenBento(false); onOpenCanvas?.(); }} />}</Suspense>;
  }
  return <div className="visitor-publication" data-section={works ? 'works' : 'profile'}>
    <VisitorLightField />
    <VisitorHeader model={model} account={account} works={works} onProfile={onOpenOverview} onWorks={onOpenCanvas}
      onBento={publication.reception ? () => { setOpenBento(true); if (works) onOpenOverview?.(); } : undefined}
      ownerDestinations={ownerDestinations} onDiscover={onOpenDirectory} onReturn={onReturn || onReturnToWorkbench} onConnect={onConnect} />
    {unavailableTarget && <p role="status" className="visitor-notice">That destination is no longer in this publication.</p>}
    {works ? <Suspense fallback={<p role="status">Opening works.</p>}>{gallery}</Suspense> : <VisitorProfile model={model} layout={profileLayout} onLayoutChange={setProfileLayout} />}
  </div>;
}
