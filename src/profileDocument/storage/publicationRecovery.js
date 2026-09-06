import { createPublicClient, http } from 'viem';
import { lukso } from 'viem/chains';
import { LUKSO_RPC_URL } from '../../library/config.js';
import { canonicalPublicationHash } from '../domain/profileDocumentPublication.js';
import { createLuksoPublishedProfileRepository, PUBLISHED_PROFILE_STATUS } from './luksoPublishedProfileRepository.js';

// Read-only client; recovery never obtains a wallet/provider or creates a write call.
export function createPublicationRecovery({
  publicClient = createPublicClient({ chain: lukso, transport: http(LUKSO_RPC_URL, { timeout: 12_000, retryCount: 0 }) }),
  resolvePublished = createLuksoPublishedProfileRepository().resolve,
} = {}) {
  return async function recover(record) {
    if (!record.transactionHash) return { status: 'UNKNOWN', message: 'The wallet request was interrupted before a transaction hash was saved. Check your wallet activity before taking any further action.' };
    if (record.status === 'FAILED') return { status: 'FAILED', message: 'The wallet reported that this publication was cancelled or replaced by a different transaction.' };
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: record.transactionHash });
      if (receipt?.transactionHash?.toLowerCase() !== record.transactionHash.toLowerCase()) throw new Error('Receipt mismatch');
      if (receipt.status === 'reverted') return { status: 'FAILED', message: 'The publication transaction failed on-chain. Your presentation was not published by this transaction.' };
      if (receipt.status !== 'success') throw new Error('Receipt unavailable');
      const result = await resolvePublished(record.profileAddress);
      if (result.status === PUBLISHED_PROFILE_STATUS.RESOLVED
        && result.document?.profile?.address === record.profileAddress
        && canonicalPublicationHash(result.document).toLowerCase() === record.artifactHash.toLowerCase()) {
        return { status: 'PUBLISHED', message: 'The transaction is confirmed and your published presentation matches the saved snapshot.', result };
      }
      return { status: 'UNKNOWN', message: 'The transaction is confirmed, but the current published presentation could not be matched. It may have changed or be temporarily unavailable. Check again before publishing.' };
    } catch {
      return { status: 'UNKNOWN', message: 'Confirmation is not available yet. The transaction may still be pending, replaced, or the network may be unavailable. Checking again will not send another transaction.' };
    }
  };
}
