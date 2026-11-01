import { readTextRecovery, retainTextRecovery, clearTextRecovery } from './textEditRecovery.js';

// One editor's working buffer. The draft store owns accepted content; only failed
// edits survive this session through the profile/placement-scoped recovery store.
export function createTextEditSession({ store, scope, record, valueOf, saveRecord }) {
  const recovered = readTextRecovery(store, scope);
  let active = true;
  let snapshot = { record: recovered?.expected || record, value: recovered?.value || valueOf(record),
    failed: Boolean(recovered), error: recovered?.failure.message || '', reason: recovered?.failure.reason || null };
  const listeners = new Set();
  const publish = change => { snapshot = { ...snapshot, ...change }; listeners.forEach(listener => listener()); };
  const current = () => active && store?.getProfileAddress() === scope.profile;
  const accept = record => {
    clearTextRecovery(store, scope);
    publish({ record, value: valueOf(record), failed: false, error: '', reason: null });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    activate() { active = true; },
    dispose() { active = false; },
    isCurrent: current,
    receive(record) {
      if (active && !snapshot.failed && snapshot.record !== record) publish({ record, value: valueOf(record) });
    },
    accept(record) { if (current()) accept(record); },
    setError(error, reason = null) { if (active) publish({ error, reason }); },
    save(value, options) {
      if (!current()) return false;
      let result;
      try { result = saveRecord(store, scope, snapshot.record, value, options); }
      catch (error) { result = { saved: false, reason: 'invalid', message: error.message || 'The Text could not be saved.' }; }
      if (result.saved) { accept(result.record); return true; }
      // Retain before notifying the host so preview/navigation sees the failure.
      retainTextRecovery(store, scope, snapshot.record, value, result);
      publish({ value, failed: true, error: result.message, reason: result.reason });
      return false;
    },
  };
}
