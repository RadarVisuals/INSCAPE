import { useEffect } from 'react';
import PublishedProfileDocumentPreview from './PublishedProfileDocumentPreview.jsx';

export default function ProfileDocumentPreview({
  document, keeperVisible, onCancelKeeperDock, onDockKeeper, onExit, onMoveKeeper, onMoveKeeperHorizontally,
  onReleaseKeeper, onUpdateKeeperDock,
}) {
  useEffect(() => {
    const exitOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onExit?.();
    };
    window.addEventListener('keydown', exitOnEscape);
    return () => window.removeEventListener('keydown', exitOnEscape);
  }, [onExit]);

  return <PublishedProfileDocumentPreview document={document} keeperVisible={keeperVisible}
    onCancelKeeperDock={onCancelKeeperDock} onDockKeeper={onDockKeeper} onExit={onExit} onMoveKeeper={onMoveKeeper}
    onMoveKeeperHorizontally={onMoveKeeperHorizontally} onReleaseKeeper={onReleaseKeeper}
    onUpdateKeeperDock={onUpdateKeeperDock} />;
}
