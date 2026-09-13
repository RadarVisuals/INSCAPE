import { useEffect } from 'react';

export default function useDraftUndo(store, suspended, notify) {
  useEffect(() => {
    if (!store || suspended) return undefined;
    const begin = () => store.beginHistoryGroup();
    const finish = () => queueMicrotask(() => store.endHistoryGroup());
    const key = event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented
        || event.target?.closest?.('textarea,input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=button]),[contenteditable=true],[role=dialog]')) return;
      const letter = event.key.toLowerCase();
      if (!['z', 'y'].includes(letter)) return;
      const direction = letter === 'y' || event.shiftKey ? 'redo' : 'undo';
      event.preventDefault();
      const label = store.getHistory()[direction];
      if (!label) { notify(`Nothing to ${direction}.`); return; }
      const ok = store[direction]();
      notify(ok ? `${direction === 'undo' ? 'Undid' : 'Redid'}: ${label}` : 'The edit could not be saved. Your draft is unchanged.');
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', begin, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    window.addEventListener('blur', finish);
    return () => {
      window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', begin, true);
      window.removeEventListener('pointerup', finish, true); window.removeEventListener('pointercancel', finish, true);
      window.removeEventListener('blur', finish); store.endHistoryGroup();
    };
  }, [store, suspended, notify]);
}
