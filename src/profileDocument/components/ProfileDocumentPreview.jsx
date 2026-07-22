import { lazy, Suspense } from 'react';
import PublishedHomeWorld from './PublishedHomeWorld.jsx';
import './profileDocumentPreview.css';

const KeeperPresentationLayer = lazy(() => import('./KeeperPresentationLayer.jsx'));

export default function ProfileDocumentPreview({ document, onExit, onMoveKeeper, reactionBridge, positionTracker, reducedMotion = false }) {
  return <div className="profile-document-owner-preview" data-preview-mode="visitor">
    <PublishedHomeWorld document={document} onMoveKeeper={onMoveKeeper} />
    <Suspense fallback={null}>
      <KeeperPresentationLayer reactionBridge={reactionBridge} positionTracker={positionTracker} reducedMotion={reducedMotion} />
    </Suspense>
    <button className="profile-document-owner-preview__exit" type="button" onClick={onExit}>[ EXIT PREVIEW ]</button>
  </div>;
}
