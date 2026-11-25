import { lazy, Suspense, useMemo } from 'react';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';

import { resolvePublicCanvasTarget } from './profileOverviewModel.js';
import PublicWorkspaceHeader from './PublicWorkspaceHeader.jsx';
import './profileOverview.css';

const ProfileOverview = lazy(() => import('./ProfileOverview.jsx'));
const ProfileDocumentV9Visitor = lazy(() => import('./ProfileDocumentV9Visitor.jsx'));

export default function ProfileDocumentV9Preview({ document: input, entry, account, ownerDestinations,
  onManageWorks, onNewComposition, onRemoveFromGallery, onEditComposition, onReturnToWorkbench, onExit, onReturn, onConnect,
  onDisconnect, onOpenOverview, onOpenCanvas, onOpenWriting }) {
  const document = useMemo(() => assertValidProfileDocumentV9(input), [input]);
  const target = useMemo(() => resolvePublicCanvasTarget(document, entry?.target), [document, entry?.target]);
  const unavailableTarget = Boolean(entry?.target && !target);
  const gallery = entry?.surface === 'canvas' && !entry.target;
  const writing = entry?.surface === 'writing';
  const overview = entry && ((!target && entry.surface !== 'canvas') || unavailableTarget);
  return <Suspense fallback={<main className="public-shell" role="status">Opening publication…</main>}>
    {(overview || gallery || writing)
      ? <ProfileOverview key={document.profile.address} document={document} works={gallery} writing={writing}
          unavailableTarget={unavailableTarget}
          {...{ account, ownerDestinations, onManageWorks, onNewComposition, onRemoveFromGallery, onEditComposition, onReturnToWorkbench, onOpenOverview,
            onOpenCanvas, onOpenWriting, onReturn, onConnect, onDisconnect }} />
      : <ProfileDocumentV9Visitor key={JSON.stringify([document.profile.address, document.documentId, document.revision, target])}
          document={document} entryTarget={target} onExit={onExit} onReturn={onReturn} onConnect={onConnect}
          renderHeader={entry && (model => <PublicWorkspaceHeader model={model} account={account} current="Gallery"
            onProfile={onOpenOverview} onWorks={onOpenCanvas} onWriting={onOpenWriting}
            ownerDestinations={ownerDestinations} onConnect={onConnect} onDisconnect={onDisconnect} />)} />}
  </Suspense>;
}
