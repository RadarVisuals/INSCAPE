import { useCallback, useEffect, useLayoutEffect, useRef, useReducer, useState } from 'react';
import { workspaceSession } from '../../workspace/profileWorkspace.js';
import { beforeProfileEditorRelease } from '../../systemWorkflow/profileEditorLease.js';
import { saveWorkbenchLayout } from './workbenchLayoutStorage.js';

export default function useWorkbenchLayoutPersistence({ profile, workbenchId, draft, cells, layout, views, storage, initial, canSave }) {
  const mountedRevision = useRef(workspaceSession(profile)?.restoreRevision);
  const latest = useRef(null), blocked = useRef(Boolean(initial.blocked));
  const [error, setError] = useState(initial.error || null);
  const serialized = layout ? JSON.stringify({ baseline: draft.workbench || null, layout, views }) : null;
  const written = useRef(null);
  const [, reportSaved] = useReducer(revision => revision + 1, 0);
  // Only a committed view may be persisted when its editor leaves.
  useLayoutEffect(() => { latest.current = { draft, cells, layout, views, serialized }; });
  const flush = useCallback((report = true) => {
    const next = latest.current;
    // A restore remounts the editor. Its departing layout must not repopulate the old cache.
    const restoreRevision = workspaceSession(profile)?.restoreRevision;
    // A session first hydrated after mount starts at zero, before any restore.
    if (mountedRevision.current === undefined && restoreRevision === 0) mountedRevision.current = 0;
    if (mountedRevision.current !== restoreRevision) return false;
    if (blocked.current || (canSave && !canSave()) || !next?.layout) return false;
    if (next.serialized === written.current) return true;
    const saved = saveWorkbenchLayout(profile, next.draft, next.layout, next.views, storage, workbenchId, next.cells);
    if (saved) {
      written.current = next.serialized;
      if (report) reportSaved();
    }
    if (report) setError(saved ? null : 'Your workspace layout could not be saved. Keep this window open and retry.');
    return saved;
  }, [profile, workbenchId, storage, canSave]);
  useEffect(() => {
    const timer = setTimeout(flush, 120);
    return () => clearTimeout(timer);
  }, [serialized, flush]);
  useEffect(() => {
    const leave = () => flush(false);
    // Parent passive cleanup releases the lease before this hook's cleanup.
    const stop = beforeProfileEditorRelease(profile, leave);
    window.addEventListener('pagehide', leave); window.addEventListener('beforeunload', leave);
    return () => { stop(); leave(); window.removeEventListener('pagehide', leave); window.removeEventListener('beforeunload', leave); };
  }, [profile, flush]);
  return { error, pending: !serialized || written.current !== serialized, flush, discard: () => { blocked.current = true; }, retry: () => { blocked.current = false; return flush(); } };
}
