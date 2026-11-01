import { useCallback, useMemo, useRef, useState } from 'react';
import { changeWorkbenchSelection, initialWorkbenchSelection, reconcileWorkbenchSelection, workbenchSelectionTarget } from './workbenchSelection.js';

export default function useWorkbenchSelection(content, { initialTargetId = null, readContent } = {}) {
  const [stored, setStored] = useState(() => initialWorkbenchSelection(content, initialTargetId));
  const state = reconcileWorkbenchSelection(stored, content);
  // Reconcile before children paint a deleted target. Saving/Undo owns content;
  // this owner only discards invalid session selection and never revives it.
  if (state !== stored) setStored(state);
  const current = useRef(null); current.current = { content, readContent, state };
  const change = useCallback(action => setStored(previous => changeWorkbenchSelection(previous, action,
    current.current.readContent?.() || current.current.content)), []);
  const actions = useMemo(() => ({
    captureSelection: () => current.current.state,
    restoreSelection: state => change({ type: 'restore', state }),
    setSelection: ids => change({ type: 'replace', ids }),
    selectArtwork: id => change({ type: 'select', id }),
    arriveAt: id => change({ type: 'arrive', id }),
    focusModule: id => change({ type: 'focus', id }),
    clearSelection: () => change({ type: 'clear' }),
    selectLayers: (ids, additive = false, part = null) => change({ type: 'layers', ids, additive, part }),
    enterBlock: id => change({ type: 'enter', id }),
    leaveBlock: (selectMembers = true) => change({ type: 'leave', selectMembers }),
  }), [change]);
  return useMemo(() => ({ ...actions, selection: state.ids, selectionMode: state.mode,
    moduleSelectionBounds: state.mode === 'module' || state.mode === 'activation',
    editingBlockId: state.blockId, targetId: workbenchSelectionTarget(state, content) }), [actions, state, content]);
}
