import { getStore } from '@netlify/blobs';
import { UploadServiceError } from './publicationUploadAuth.mjs';
import { normalizeProfileAddress } from '../../src/library/config.js';
import { isValidCid } from '../../src/profileDocument/domain/cidValidation.js';
import { PROFILE_DOCUMENT_LIMITS } from '../../src/profileDocument/domain/constants.js';

export function publicationQuotaStore(signal) {
  return getStore({ name: 'inscape-publication-uploads', consistency: 'strong',
    fetch: async (url, init = {}) => {
      // The SDK's automatic backoff ignores AbortSignal and may outlive a
      // Function. Accounting failures stop here; only CAS conflicts retry above.
      try {
        const deadline = AbortSignal.any([signal, AbortSignal.timeout(5000)].filter(Boolean));
        deadline.throwIfAborted();
        const response = await fetch(url, { ...init, signal: deadline });
        if (response.status !== 429 && response.status < 500) return response;
        await response.body?.cancel();
      } catch { /* An uncertain conditional write is never treated as absent. */ }
      return new Response(null, { status: 408 });
    } });
}

function assertLedger(ledger, month) {
  if (!ledger || ledger.version !== 1 || ledger.month !== month || !Array.isArray(ledger.entries) || ledger.entries.length > 10_000) throw Error('Invalid quota ledger');
  const ids = new Set();
  for (const entry of ledger.entries) {
    if (!/^[a-f0-9]{32}$/u.test(entry.id) || ids.has(entry.id) || !/^0x[a-f0-9]{64}$/u.test(entry.hash)
      || !entry.profile || normalizeProfileAddress(entry.profile) !== entry.profile || !Number.isSafeInteger(entry.at)
      || new Date(entry.at).toISOString().slice(0, 7) !== month || !Number.isSafeInteger(entry.bytes)
      || entry.bytes < 1 || entry.bytes > PROFILE_DOCUMENT_LIMITS.maxJsonBytes
      || !['RESERVED', 'COMPLETE', 'REJECTED'].includes(entry.status)
      || (entry.status === 'COMPLETE' && !isValidCid(entry.cid))) throw Error('Invalid quota entry');
    ids.add(entry.id);
  }
  return ledger;
}

// One conditional write reserves global count, global bytes and profile usage
// together. A process-local counter or independent read/write pairs cannot do so.
export function createUploadQuota({ store, now = Date.now } = {}) {
  const change = async (month, mutate) => {
    try {
      const key = `month-${month}`;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
        if (current && !current.etag) throw Error('Missing quota version');
        const ledger = current ? assertLedger(current.data, month) : { version: 1, month, entries: [] };
        const result = mutate(ledger);
        if (!result.changed) return result.value;
        const written = await store.setJSON(key, ledger, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
        if (written.modified) return result.value;
      }
    } catch (error) {
      if (error instanceof UploadServiceError) throw error;
    }
    throw new UploadServiceError('UPLOAD_QUOTA_UNAVAILABLE', 'Upload accounting is unavailable. No new upload was started.');
  };
  return {
    reserve(permit, policy) {
      const month = new Date(permit.issuedAt).toISOString().slice(0, 7);
      return change(month, ledger => {
        const time = now();
        if (time >= permit.expiresAt) throw new UploadServiceError('UPLOAD_AUTH_INVALID', 'Upload authorization expired. Authorize the upload again.', 401);
        const sameDocument = ledger.entries.filter(entry => entry.profile === permit.profile && entry.hash === permit.hash);
        const complete = sameDocument.find(entry => entry.status === 'COMPLETE');
        if (complete) return { value: { cid: complete.cid } };
        if (sameDocument.some(entry => entry.status === 'RESERVED')) throw new UploadServiceError('UPLOAD_OUTCOME_UNKNOWN', 'An upload of this presentation is pending or its outcome is unknown. Contact the INSCAPE operator to check its result.', 409);
        if (ledger.entries.some(entry => entry.id === permit.nonce)) throw new UploadServiceError('UPLOAD_AUTH_USED', 'This upload authorization has already been used. Authorize a new attempt.', 409);
        const hour = Math.floor(time / 3_600_000);
        if (ledger.entries.filter(entry => entry.profile === permit.profile && Math.floor(entry.at / 3_600_000) === hour).length >= policy.hourlyPerProfile) {
          throw new UploadServiceError('UPLOAD_PROFILE_QUOTA', 'Your profile has reached its hourly upload limit. Try again next hour.', 429, Math.ceil(((hour + 1) * 3_600_000 - time) / 1000));
        }
        if (ledger.entries.length >= policy.monthlyUploads || ledger.entries.reduce((sum, entry) => sum + entry.bytes, 0) + permit.bytes > policy.monthlyBytes) {
          const date = new Date(time);
          throw new UploadServiceError('UPLOAD_SERVICE_QUOTA', 'The shared monthly upload allowance has been reached. Contact the INSCAPE operator.', 429,
            Math.ceil((Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - time) / 1000));
        }
        ledger.entries.push({ id: permit.nonce, profile: permit.profile, hash: permit.hash, bytes: permit.bytes, at: time, status: 'RESERVED' });
        return { changed: true, value: { month, id: permit.nonce } };
      });
    },
    finish(reservation, outcome) {
      return change(reservation.month, ledger => {
        const entry = ledger.entries.find(value => value.id === reservation.id);
        if (!entry || entry.status !== 'RESERVED') throw Error('Missing upload reservation');
        if (outcome.cid && !isValidCid(outcome.cid)) throw Error('Invalid CID');
        Object.assign(entry, outcome.cid ? { status: 'COMPLETE', cid: outcome.cid } : { status: 'REJECTED' });
        return { changed: true, value: true };
      });
    },
  };
}
