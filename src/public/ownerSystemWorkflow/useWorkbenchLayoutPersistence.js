import { useCallback, useEffect, useRef, useState } from 'react';
import { saveWorkbenchLayout } from './workbenchLayoutStorage.js';

export default function useWorkbenchLayoutPersistence({ profile, draft, layout, views, storage, initial }) {
  const latest = useRef(null), blocked = useRef(Boolean(initial.blocked));
  const [error, setError] = useState(initial.error || null);
  const serialized = layout ? JSON.stringify({ baseline: draft.workbench || null, layout, views }) : null;
  const written = useRef(null);
  latest.current = { draft, layout, views, serialized };
  const flush = useCallback((report = true) => {
    const next = latest.current;
    if (blocked.current || !next.layout || next.serialized === written.current) return;
    const saved = saveWorkbenchLayout(profile, next.draft, next.layout, next.views, storage);
    if (saved) written.current = next.serialized;
    if (report) setError(saved ? null : 'Your workspace layout could not be saved. Keep this window open and retry.');
  }, [profile, storage]);
  useEffect(() => {
    const timer = setTimeout(flush, 120);
    return () => clearTimeout(timer);
  }, [serialized, flush]);
  useEffect(() => {
    const leave = () => flush(false);
    window.addEventListener('pagehide', leave); window.addEventListener('beforeunload', leave);
    return () => { leave(); window.removeEventListener('pagehide', leave); window.removeEventListener('beforeunload', leave); };
  }, [flush]);
  return { error, retry: () => { blocked.current = false; flush(); } };
}
