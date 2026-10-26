import { lazy, Suspense } from 'react';

const ProfileDocumentV9Preview = lazy(() => import('./ProfileDocumentV9Preview.jsx'));

export default function PublishedProfileDocumentPreview({
  document, ownerEditingAllowed = false, onExit, onOpenDirectory, onReturn, onConnect, entry, onOpenOverview, onOpenCanvas,
}) {
  return <Suspense fallback={<main className="public-shell" role="status">LOADING VISITOR GRID</main>}>
    <ProfileDocumentV9Preview document={document} ownerEditingAllowed={ownerEditingAllowed} onExit={onExit} entry={entry} onOpenOverview={onOpenOverview}
      onOpenDirectory={onOpenDirectory} onReturn={onReturn} onConnect={onConnect} onOpenCanvas={onOpenCanvas} />
  </Suspense>;
}
