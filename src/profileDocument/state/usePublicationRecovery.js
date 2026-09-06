import { useCallback, useEffect, useMemo, useState } from 'react';
import { publicationJournal } from '../storage/publicationJournal.js';
import { createPublicationRecovery } from '../storage/publicationRecovery.js';

const recover = createPublicationRecovery();

export function usePublicationRecovery(profileAddress, publicationStatus, busy) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const snapshot = useMemo(() => {
    try { return { record: publicationJournal.read(profileAddress), error: null }; }
    catch { return { record: null, error: 'Local publication recovery could not be read. Publishing is paused to preserve the existing record.' }; }
  }, [profileAddress, publicationStatus, busy, attempt]);

  useEffect(() => {
    let current = true;
    if (!busy && snapshot.record && !snapshot.error) {
      recover(snapshot.record).then((value) => { if (current) setResult({ snapshot, value }); });
    }
    return () => { current = false; };
  }, [snapshot, busy]);

  const check = useCallback(() => setAttempt((value) => value + 1), []);
  const value = result?.snapshot === snapshot ? result.value : null;
  const acknowledge = useCallback(() => {
    if (!snapshot.record || !['PUBLISHED', 'FAILED'].includes(value?.status)) return null;
    try {
      publicationJournal.remove(snapshot.record);
      check();
      return { result: value.result || null };
    } catch {
      check();
      return null;
    }
  }, [snapshot, value, check]);

  useEffect(() => {
    const changed = () => check();
    globalThis.addEventListener('storage', changed);
    return () => globalThis.removeEventListener('storage', changed);
  }, [check]);

  return { record: snapshot.record, blocked: Boolean(snapshot.record || snapshot.error),
    status: snapshot.error ? 'UNAVAILABLE' : value?.status || 'CHECKING',
    message: snapshot.error || value?.message || 'Checking the previous publication. No wallet request will be sent.',
    check, acknowledge };
}
