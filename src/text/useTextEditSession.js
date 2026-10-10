import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { createTextEditSession } from './textEditSession.js';

export default function useTextEditSession({ store, scope, record, valueOf, saveRecord }) {
  const session = useMemo(() => createTextEditSession({ store, scope, record, valueOf, saveRecord }),
    [store, scope.profile, scope.id, scope.moduleId, scope.gridId, valueOf, saveRecord]);
  useLayoutEffect(() => { session.activate(); return () => session.dispose(); }, [session]);
  useLayoutEffect(() => { session.receive(record); }, [session, record]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return { ...state, session };
}
