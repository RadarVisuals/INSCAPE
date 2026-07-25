import PublishedHomeWorld from './PublishedHomeWorld.jsx';

export default function PublishedProfileDocumentPreview({ document, onMoveKeeper, onMoveKeeperHorizontally, onOpenDirectory, onReturn }) {
  return <PublishedHomeWorld document={document} onMoveKeeper={onMoveKeeper} onMoveKeeperHorizontally={onMoveKeeperHorizontally}
    onOpenDirectory={onOpenDirectory} onReturn={onReturn} />;
}
