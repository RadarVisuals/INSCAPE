import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSignalStore } from '../../signals/state/useSignalStore.js';
import { getProfileIdentityCache } from '../../profileIdentity/state/profileIdentityService.js';

const activityType = (value) => String(value || '').includes('LYX') ? 'LYX'
  : String(value || '').includes('ASSET') ? 'ASSETS' : 'SOCIAL';
const compactAddress = (value) => typeof value === 'string' && value.length > 14
  ? `${value.slice(0, 8)}…${value.slice(-5)}` : value || '';
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

export default function useOwnerSystemWorkflowActivity({ active, fixture, profileAddress }) {
  const storeProfile = useSignalStore((state) => state.profileAddress);
  const history = useSignalStore((state) => state.history);
  const status = useSignalStore((state) => state.status);
  const error = useSignalStore((state) => state.error);
  const partialError = useSignalStore((state) => state.partialError);
  const sourceMode = useSignalStore((state) => state.sourceMode);
  const setProfileAddress = useSignalStore((state) => state.setProfileAddress);
  const synchronize = useSignalStore((state) => state.synchronize);
  const markSeen = useSignalStore((state) => state.markSeen);
  const [fixtureReadIds, setFixtureReadIds] = useState(() => new Set());
  const [fixtureStatus, setFixtureStatus] = useState('ready');
  const [identityRevision, setIdentityRevision] = useState(0);
  useEffect(() => {
    if (fixture || !active) return;
    setProfileAddress(profileAddress);
  }, [active, fixture, profileAddress, setProfileAddress]);
  useEffect(() => {
    if (fixture || !active || storeProfile !== profileAddress || status !== 'idle') return;
    synchronize({ mode: 'LIVE' });
  }, [active, fixture, profileAddress, status, storeProfile, synchronize]);
  useEffect(() => {
    if (fixture || !active) return undefined;
    const subscriptions = history.filter(({ counterparty }) => counterparty).map((entry) => {
      const cache = getProfileIdentityCache(entry.sourceMode || sourceMode || 'LIVE');
      cache.resolve(entry.counterparty).catch(() => {});
      return cache.subscribe(entry.counterparty, () => setIdentityRevision((value) => value + 1));
    });
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [active, fixture, history, sourceMode]);
  const entries = useMemo(() => fixture
    ? fixture.map(normalizeFixture).map((entry) => ({ ...entry, unread: entry.unread && !fixtureReadIds.has(entry.id) }))
    : history.map((entry, index) => normalizeSignal(entry, index,
      getProfileIdentityCache(entry.sourceMode || sourceMode || 'LIVE').peek(entry.counterparty))),
  [fixture, fixtureReadIds, history, identityRevision, sourceMode]);
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
