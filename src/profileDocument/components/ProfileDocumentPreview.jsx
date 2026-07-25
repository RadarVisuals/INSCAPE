import { useEffect } from 'react';
import PublishedHomeWorld from './PublishedHomeWorld.jsx';

export default function ProfileDocumentPreview({ document, onExit, onMoveKeeper, onMoveKeeperHorizontally }) {
  useEffect(() => {
    const exitOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onExit?.();
    };
    window.addEventListener('keydown', exitOnEscape);
    return () => window.removeEventListener('keydown', exitOnEscape);
  }, [onExit]);

  return <PublishedHomeWorld document={document} onExit={onExit} onMoveKeeper={onMoveKeeper} onMoveKeeperHorizontally={onMoveKeeperHorizontally} />;
}
