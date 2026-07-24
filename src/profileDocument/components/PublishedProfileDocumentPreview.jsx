import PublishedHomeWorld from './PublishedHomeWorld.jsx';

export default function PublishedProfileDocumentPreview({ document, onMoveKeeper, onOpenDirectory, onReturn }) {
  return <PublishedHomeWorld document={document} onMoveKeeper={onMoveKeeper}
    onOpenDirectory={onOpenDirectory} onReturn={onReturn} />;
}
