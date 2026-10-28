import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';

// A read-only subscription to canonical storage. Never reload an editor store:
// readers own disposable validation instances and expose no mutation commands.
export function createProfileDraftReader({ profileAddress, storage, events = globalThis, visibility = globalThis.document }) {
  const key = systemWorkflowDraftKey(profileAddress), listeners = new Set();
  const readerId = globalThis.crypto.randomUUID();
  let revision = 0, raw, snapshot = { status: 'absent', draft: null, collection: null, stale: false };
  const refresh = () => {
    let nextRaw;
    try { nextRaw = storage.getItem(key); }
    catch { nextRaw = undefined; }
    if (nextRaw !== undefined && nextRaw === raw) return;
    const store = createSystemWorkflowDraftStore({ profileAddress, storage, requireEditor: true });
    const { status } = store.getRecordState();
    const failed = status === 'corrupt' || status === 'unavailable';
    raw = nextRaw;
    const collection = status === 'valid' ? Object.freeze({ kind: 'local', profileAddress: store.getProfileAddress(),
      revision: `local:${readerId}:${++revision}`, stale: false, activeId: store.getWorkbenchId(), entries: Object.freeze(store.listWorkbenches().map(item => store.readWorkbench(item.id))) }) : null;
    snapshot = Object.freeze({ status, draft: failed ? snapshot.draft : status === 'valid' ? store.getSnapshot() : null,
      collection: failed && snapshot.collection ? Object.freeze({ ...snapshot.collection, stale: true }) : collection,
      stale: failed && Boolean(snapshot.draft) });
    listeners.forEach(listener => listener());
  };
  const storageChanged = event => { if ((!event.storageArea || event.storageArea === storage) && (event.key === null || event.key === key)) refresh(); };
  const visible = () => { if (visibility?.visibilityState !== 'hidden') refresh(); };
  refresh();
  return {
    getSnapshot: () => snapshot, refresh,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        events.addEventListener?.('storage', storageChanged); events.addEventListener?.('focus', visible);
        visibility?.addEventListener?.('visibilitychange', visible); refresh();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          events.removeEventListener?.('storage', storageChanged); events.removeEventListener?.('focus', visible);
          visibility?.removeEventListener?.('visibilitychange', visible);
        }
      };
    },
  };
}
