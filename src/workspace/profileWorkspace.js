import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../library/config.js';
import { commitWorkspaceRows, openWorkspaceDatabase, readCommittedRows } from './database.js';

const sessions = new Map();
const listeners = new Set();
let broadcasts, refreshCommitted;
function watchCommits() {
  if (refreshCommitted || typeof window === 'undefined') return;
  try { broadcasts = new BroadcastChannel('inscape-workspace-commits'); }
  catch { /* Transactional conflict checks still apply. */ }
  refreshCommitted = async (session, force = false) => {
    if (!session?.db || pending.has(session)) return;
    try {
      const result = await readCommittedRows(session.db, session.scope, force ? 0 : session.revision);
      if (!result || result.revision < session.revision || pending.has(session)) return;
      const { revision, rows } = result;
      const changed = Object.keys(rows).filter(kind => rows[kind] !== session.rows[kind]);
      Object.assign(session, { rows, committed: { ...rows }, revision });
      setStatus(session, 'ready');
      for (const kind of changed) window.dispatchEvent(new CustomEvent('inscape-workspace-change', {
        detail: { profile: session.scope[1], kind },
      }));
    } catch { /* Keep the verified view. Writes still compare the committed bytes. */ }
  };
  if (broadcasts) broadcasts.onmessage = event => void refreshCommitted(workspaceSession(event.data));
  window.addEventListener?.('focus', () => { for (const session of sessions.values()) void refreshCommitted(session); });
}
const pending = new Set();
const notify = () => listeners.forEach(listener => listener());
export const subscribeWorkspace = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const key = profile => JSON.stringify([LUKSO_CHAIN_ID, normalizeProfileAddress(profile)]);
export const workspaceSession = profile => sessions.get(key(profile));
const prefixes = {
  library: 'inscape.library-workspace.v9:', workbenches: 'inscape.system-workflow-draft.v1:',
  receptionRecovery: 'inscape.reception-recovery.v1:', textRecovery: 'inscape.text-recovery.v1:',
};
export const recoveryStorageKey = profile => prefixes.textRecovery + profile;
const protect = event => { event.preventDefault(); event.returnValue = ''; };
function dirty(session, value) {
  if (value) pending.add(session); else pending.delete(session);
  if (pending.size) globalThis.addEventListener?.('beforeunload', protect);
  else globalThis.removeEventListener?.('beforeunload', protect);
}

export function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

function setStatus(session, status, message = '') {
  session.state = { status, message, revision: session.revision };
  notify();
}
function flush(session) {
  if (session.writing) return session.writing;
  if (!session.db) return Promise.resolve(false);
  session.writing = Promise.resolve().then(async () => {
    try {
      let missedRevision = false;
      while (true) {
        const changes = Object.entries(session.rows).filter(([kind, value]) => value !== session.committed[kind])
          .map(([kind, after]) => [kind, { before: session.committed[kind], after }]);
        if (!changes.length) break;
        const nextRevision = await commitWorkspaceRows(session.db, session.scope, changes);
        missedRevision ||= nextRevision !== session.revision + 1;
        session.revision = nextRevision;
        for (const [kind, { after }] of changes) session.committed[kind] = after;
        for (const [kind] of changes) globalThis.dispatchEvent?.(new CustomEvent('inscape-workspace-commit', {
          detail: { profile: session.scope[1], kind },
        }));
        broadcasts?.postMessage(session.scope[1]);
      }
      dirty(session, false);
      setStatus(session, 'ready');
      if (missedRevision) void refreshCommitted?.(session, true);
      return true;
    } catch (error) {
      const message = error.name === 'QuotaExceededError' ? 'Browser storage is full.' : error.message;
      setStatus(session, 'unsaved', message + ' Edits are in this tab. Keep it open and retry saving.');
      return false;
    } finally { session.writing = null; }
  });
  return session.writing;
}

export async function confirmWorkspaceSaved(profile) {
  const session = workspaceSession(profile);
  if (!session) return false;
  if (session.state.status === 'ready') return true;
  return Boolean(session.db) && (await flush(session));
}

export function hydrateWorkspace(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw Error('A valid workspace profile is required.');
  const existing = workspaceSession(profile);
  if (existing) return existing.hydration;
  const scope = [LUKSO_CHAIN_ID, profile];
  const session = { scope, revision: 0, state: { status: 'loading', revision: 0 }, db: null, rows: null };
  sessions.set(key(profile), session);
  session.hydration = (async () => {
    let pendingText;
    const readLegacy = () => {
      const storage = browserStorage();
      if (!storage) throw Error('Legacy storage is unavailable for verification.');
      const rows = {};
      for (const [kind, prefix] of Object.entries(prefixes)) {
        // Pending text was session-only before IndexedDB.
        rows[kind] = storage.getItem(prefix + profile);
        if (kind === 'textRecovery') {
          const pending = pendingText(profile);
          if (pending && rows[kind] && pending !== rows[kind]) throw Error('Two different pending text copies need recovery.');
          rows[kind] ??= pending;
        }
      }
      return rows;
    };
    try {
      const { validateWorkspaceRows, pendingProfileText } = await import('./validateWorkspaceRows.js');
      pendingText = pendingProfileText;
      const validate = (rows, verified = false) => validateWorkspaceRows(rows, profile, verified);
      let factory;
      try {
        factory = globalThis.indexedDB;
        const { rows, revision, db } = await openWorkspaceDatabase(factory, scope, readLegacy, validate);
        Object.assign(session, { rows, committed: { ...rows }, revision, db });
        watchCommits();
        setStatus(session, 'ready');
      } catch (error) {
        // An unavailable database might already contain newer work. Never seed
        // it from this fallback or automatically promote edits from this tab.
        if (!['SecurityError', 'InvalidStateError', 'UnknownError', 'QuotaExceededError'].includes(error.name) && factory) throw error;
        const rows = readLegacy();
        validate(rows);
        Object.assign(session, { rows, committed: { ...rows } });
        setStatus(session, 'memory', 'IndexedDB is unavailable. Showing the legacy copy. New edits stay in this tab; keep it open for recovery.');
      }
    } catch (error) {
      setStatus(session, 'blocked', 'Workspace could not be verified. Existing data is preserved. ' + error.message);
    }
    return session;
  })();
  return session.hydration;
}

function locationFor(storageKey) {
  for (const [kind, prefix] of Object.entries(prefixes)) if (storageKey.startsWith(prefix)) {
    const session = workspaceSession(storageKey.slice(prefix.length));
    if (!session?.rows) throw Error('Workspace has not finished hydration.');
    return { session, kind };
  }
  return null;
}

const adapter = {
  whenCommitted: confirmWorkspaceSaved,
  getItem(storageKey) {
    const target = locationFor(storageKey);
    return target ? target.session.rows[target.kind] : browserStorage().getItem(storageKey);
  },
  setItem(storageKey, raw) {
    const target = locationFor(storageKey);
    if (!target) { browserStorage().setItem(storageKey, raw); return; }
    const { session, kind } = target;
    if (session.rows[kind] === raw) return;
    session.rows[kind] = raw;
    dirty(session, true);
    if (session.db) {
      setStatus(session, 'saving');
      // Group synchronous editor operations (including text recovery removal)
      // into one transaction. A command accepts an edit; flush confirms durability.
      queueMicrotask(() => { void flush(session); });
    }
  },
  removeItem(storageKey) {
    if (locationFor(storageKey)) adapter.setItem(storageKey, null);
    else browserStorage().removeItem(storageKey);
  },
};

export function authoredStorage(storage) {
  return typeof window !== 'undefined' && (storage ?? null) === (browserStorage() ?? null) ? adapter : storage;
}
export function recoveryStorage(profile) {
  return workspaceSession(profile)?.rows ? adapter : null;
}
