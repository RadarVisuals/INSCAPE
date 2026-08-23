import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSignalStore } from '../../signals/state/useSignalStore.js';

const activityType = (value) => String(value || '').includes('LYX') ? 'LYX'
  : String(value || '').includes('ASSET') ? 'ASSETS' : 'SOCIAL';
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
const normalizeSignal = (entry, index) => ({
  ...entry,
  id: entry.id || `activity-${index + 1}`,
  date: entry.timestamp ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(entry.timestamp * 1000)) : 'RECENT',
  time: entry.timestamp ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(entry.timestamp * 1000)) : '',
  label: entry.title || String(entry.type || 'ACTIVITY').replaceAll('_', ' '),
  detail: entry.assetReference?.name || entry.counterparty || '',
  type: activityType(entry.type),
  unread: entry.read !== true,
});

export default function useOwnerSystemWorkflowActivity({ active, fixture, profileAddress }) {
  const storeProfile = useSignalStore((state) => state.profileAddress);
  const history = useSignalStore((state) => state.history);
  const status = useSignalStore((state) => state.status);
  const error = useSignalStore((state) => state.error);
  const partialError = useSignalStore((state) => state.partialError);
  const setProfileAddress = useSignalStore((state) => state.setProfileAddress);
  const synchronize = useSignalStore((state) => state.synchronize);
  const markSeen = useSignalStore((state) => state.markSeen);
  const [fixtureReadIds, setFixtureReadIds] = useState(() => new Set());
  const [fixtureStatus, setFixtureStatus] = useState('ready');
  useEffect(() => {
    if (fixture || !active) return;
    setProfileAddress(profileAddress);
  }, [active, fixture, profileAddress, setProfileAddress]);
  useEffect(() => {
    if (fixture || !active || storeProfile !== profileAddress || status !== 'idle') return;
    synchronize({ mode: 'LIVE' });
  }, [active, fixture, profileAddress, status, storeProfile, synchronize]);
  const entries = useMemo(() => fixture
    ? fixture.map(normalizeFixture).map((entry) => ({ ...entry, unread: entry.unread && !fixtureReadIds.has(entry.id) }))
    : history.map(normalizeSignal), [fixture, fixtureReadIds, history]);
  const markRead = useCallback((id = null) => {
    if (!fixture) { markSeen(id); return; }
    setFixtureReadIds((current) => new Set(id ? [...current, id] : entries.filter(({ unread }) => unread).map(({ id: entryId }) => entryId)));
  }, [entries, fixture, markSeen]);
  const refresh = useCallback(async () => {
    if (!fixture) return synchronize({ mode: 'LIVE' });
    setFixtureStatus('loading');
    await Promise.resolve();
    setFixtureStatus('ready');
    return undefined;
  }, [fixture, synchronize]);
  return {
    entries,
    error: fixture ? null : error,
    markRead,
    partialError: fixture ? null : partialError,
    refresh,
    retry: refresh,
    status: fixture ? fixtureStatus : status,
    unreadCount: entries.filter(({ unread }) => unread).length,
  };
}
