import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { beforeProfileEditorRelease } from '../../systemWorkflow/profileEditorLease.js';
import { saveWorkbenchLayout } from './workbenchLayoutStorage.js';

export default function useWorkbenchLayoutPersistence({ profile, workbenchId, draft, layout, views, storage, initial, canSave }) {
  const latest = useRef(null), blocked = useRef(Boolean(initial.blocked));
  const [error, setError] = useState(initial.error || null);
  const serialized = layout ? JSON.stringify({ baseline: draft.workbench || null, layout, views }) : null;
  const written = useRef(null);
  // Only a committed view may be persisted when its editor leaves.
  useLayoutEffect(() => { latest.current = { draft, layout, views, serialized }; });
  const flush = useCallback((report = true) => {
    const next = latest.current;
    if (blocked.current || (canSave && !canSave()) || !next?.layout) return false;
    if (next.serialized === written.current) return true;
    const saved = saveWorkbenchLayout(profile, next.draft, next.layout, next.views, storage, workbenchId);
    if (saved) written.current = next.serialized;
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
  return { error, flush, discard: () => { blocked.current = true; }, retry: () => { blocked.current = false; return flush(); } };
}
