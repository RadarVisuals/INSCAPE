import { lazy, Suspense } from 'react';
import PublishedHomeWorld from './PublishedHomeWorld.jsx';
import { PUBLISHED_PROFILE_RUNTIME, selectPublishedProfileRuntime } from './publishedProfileRuntime.js';

const VisitorLatticeWorld = lazy(() => import('./VisitorLatticeWorld.jsx'));
const PublishedLegacyStyles = lazy(() => import('./PublishedLegacyStyles.jsx'));

export default function PublishedProfileDocumentPreview({
  document, keeperVisible, onCancelKeeperDock, onDockKeeper, onExit, onMoveKeeper, onMoveKeeperHorizontally,
  onOpenDirectory, onReleaseKeeper, onReturn, onUpdateKeeperDock,
}) {
  if (selectPublishedProfileRuntime(document) === PUBLISHED_PROFILE_RUNTIME.LATTICE) {
    return <Suspense fallback={<main className="public-shell" role="status">LOADING VISITOR WORLD</main>}>
      <VisitorLatticeWorld document={document} keeperVisible={keeperVisible} onCancelKeeperDock={onCancelKeeperDock}
        onDockKeeper={onDockKeeper} onExit={onExit} onMoveKeeper={onMoveKeeper} onOpenDirectory={onOpenDirectory}
        onReleaseKeeper={onReleaseKeeper} onReturn={onReturn} onUpdateKeeperDock={onUpdateKeeperDock} />
    </Suspense>;
  }
  return <Suspense fallback={<main className="public-shell" role="status">LOADING COMPATIBILITY WORLD</main>}>
    <PublishedLegacyStyles />
    <PublishedHomeWorld document={document} onExit={onExit} onMoveKeeper={onMoveKeeper} onMoveKeeperHorizontally={onMoveKeeperHorizontally}
      onOpenDirectory={onOpenDirectory} onReturn={onReturn} />
  </Suspense>;
}
