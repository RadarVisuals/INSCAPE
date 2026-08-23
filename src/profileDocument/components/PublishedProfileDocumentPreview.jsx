import { lazy, Suspense } from 'react';

const ProfileDocumentV9Preview = lazy(() => import('./ProfileDocumentV9Preview.jsx'));

export default function PublishedProfileDocumentPreview({
  document, onExit, onOpenDirectory, onReturn,
}) {
  return <Suspense fallback={<main className="public-shell" role="status">LOADING VISITOR GRID</main>}>
    <ProfileDocumentV9Preview document={document} onExit={onExit}
      onOpenDirectory={onOpenDirectory} onReturn={onReturn} />
  </Suspense>;
}
