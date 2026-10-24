import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSignalStore } from '../../signals/state/useSignalStore.js';
import { getProfileIdentityCache } from '../../profileIdentity/state/profileIdentityService.js';

const activityType = value =>
  String(value || '').includes('LYX') ? 'LYX' : String(value || '').includes('ASSET') ? 'ASSETS' : 'SOCIAL';
const compactAddress = value =>
  typeof value === 'string' && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value || '';
export const ownerSystemWorkflowActivityDetail = (entry, displayIdentity = null) =>
  displayIdentity?.name || entry?.assetReference?.name || compactAddress(entry?.counterparty) || '';
const normalizeFixture = (entry, index) => ({
  ...entry,
  id: entry.id || `review-activity-${index + 1}`,
  date: entry.date || 'TODAY',
  time: entry.time || entry.timestamp || 'NOW',
  label: entry.label || entry.title || entry.type || 'ACTIVITY',
  detail: entry.detail || entry.counterparty || '',
  type: activityType(entry.type),
  unread: entry.unread ?? entry.read !== true,
});
export function ownerSystemWorkflowActivityTimestamp(timestamp, { locales, timeZone } = {}) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return { date: 'UNKNOWN', time: '' };
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return { date: 'UNKNOWN', time: '' };
  return {
    date: new Intl.DateTimeFormat(locales, { dateStyle: 'medium', timeZone }).format(instant),
    time: new Intl.DateTimeFormat(locales, { timeStyle: 'short', timeZone }).format(instant),
  };
}
const normalizeSignal = (entry, index, displayIdentity = null) => ({
  ...entry,
  id: entry.id || `activity-${index + 1}`,
  ...ownerSystemWorkflowActivityTimestamp(entry.timestamp),
  label: entry.title || String(entry.type || 'ACTIVITY').replaceAll('_', ' '),
  detail: ownerSystemWorkflowActivityDetail(entry, displayIdentity),
  type: activityType(entry.type),
  unread: entry.read !== true,
});

function useActivitySignals({ active, profileAddress, suspended = false }) {
  const storeProfile = useSignalStore(state => state.profileAddress);
  const history = useSignalStore(state => state.history);
  const status = useSignalStore(state => state.status);
  const error = useSignalStore(state => state.error);
  const partialError = useSignalStore(state => state.partialError);
  const persistenceError = useSignalStore(state => state.persistenceError);
  const sourceMode = useSignalStore(state => state.sourceMode);
  const setProfileAddress = useSignalStore(state => state.setProfileAddress);
  const synchronize = useSignalStore(state => state.synchronize);
  const markSeen = useSignalStore(state => state.markSeen);
  const [identityRevision, setIdentityRevision] = useState(0);
  useEffect(() => {
    setProfileAddress(profileAddress);
  }, [profileAddress, setProfileAddress]);
  useEffect(() => {
    if (suspended || !active || storeProfile !== profileAddress || status !== 'idle') return;
    synchronize({ mode: 'LIVE' });
  }, [active, suspended, profileAddress, status, storeProfile, synchronize]);
  useEffect(() => {
    if (suspended || !active || storeProfile !== profileAddress) return undefined;
    const subscriptions = history
      .filter(({ counterparty }) => counterparty)
      .map(entry => {
        const cache = getProfileIdentityCache(entry.sourceMode || sourceMode || 'LIVE');
        cache.resolve(entry.counterparty).catch(() => {});
        return cache.subscribe(entry.counterparty, () => setIdentityRevision(value => value + 1));
      });
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [active, suspended, history, sourceMode, storeProfile, profileAddress]);
  const entries = useMemo(
    () =>
      (suspended || storeProfile !== profileAddress ? [] : history).map((entry, index) =>
        normalizeSignal(
          entry,
          index,
          getProfileIdentityCache(entry.sourceMode || sourceMode || 'LIVE').peek(entry.counterparty)
        )
      ),
    [suspended, history, identityRevision, sourceMode, storeProfile, profileAddress]
  );
  const markRead = useCallback(
    (id = null) => {
      markSeen(id, profileAddress);
    },
    [markSeen, profileAddress]
  );
  const refresh = useCallback(
    async () => synchronize({ mode: 'LIVE', expectedProfile: profileAddress }),
    [synchronize, profileAddress]
  );
  return {
    entries,
    error: storeProfile !== profileAddress ? null : error,
    markRead,
    partialError: storeProfile !== profileAddress ? null : partialError,
    persistenceError: storeProfile !== profileAddress ? null : persistenceError,
    refresh,
    retry: refresh,
    status: storeProfile === profileAddress ? status : 'idle',
    unreadCount: entries.filter(({ unread }) => unread).length,
  };
}

function useReviewActivity({ active, fixture, profileAddress }) {
  const live = useActivitySignals({ active, profileAddress, suspended: Boolean(fixture) });
  const [readIds, setReadIds] = useState(() => new Set());
  const [status, setStatus] = useState('ready');
  const entries = useMemo(
    () =>
      (fixture || [])
        .map(normalizeFixture)
        .map(entry => ({ ...entry, unread: entry.unread && !readIds.has(entry.id) })),
    [fixture, readIds]
  );
  const markRead = useCallback(
    (id = null) =>
      setReadIds(
        current =>
          new Set(
            id ? [...current, id] : entries.filter(({ unread }) => unread).map(({ id: entryId }) => entryId)
          )
      ),
    [entries]
  );
  const refresh = useCallback(async () => {
    setStatus('loading');
    await Promise.resolve();
    setStatus('ready');
  }, []);
  return fixture
    ? {
        entries,
        error: null,
        markRead,
        partialError: null,
        persistenceError: null,
        refresh,
        retry: refresh,
        status,
        unreadCount: entries.filter(({ unread }) => unread).length,
      }
    : live;
}

// Node imports the pure formatting helpers in unit tests; Vite replaces DEV at build time.
export default import.meta.env?.DEV ? useReviewActivity : useActivitySignals;
