import { LUKSO_INDEXER_URL, normalizeProfileAddress } from '../../library/config.js';
import { normalizeFollowSignal, normalizeLyxSignal, normalizeTransferSignal, sortSignalsNewestFirst } from '../domain/keeperSignal.js';

const ACTIVITY_QUERY = `
query KeeperActivity($profile: String!, $limit: Int!, $offset: Int!) {
  Transfer(where: { _or: [{ from_id: { _eq: $profile } }, { to_id: { _eq: $profile } }] }, limit: $limit, offset: $offset, order_by: [{ timestamp: desc }, { id: desc }]) {
    id from_id to_id value timestamp transaction_id asset_id token_id
    asset {
      id name lsp4TokenName standard isLSP7 isCollection description error
      images(where: { error: { _is_null: true } }, order_by: { width: asc }) { src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
      attributes { key value attributeType }
    }
    token {
      id tokenId formattedTokenId name lsp4TokenName description error
      images(where: { error: { _is_null: true } }, order_by: { width: asc }) { src url width height fileType error }
      lsp4Creators { profile_id profile { name } }
      attributes { key value attributeType }
      asset {
        id name lsp4TokenName standard isLSP7 isCollection description error
        images(where: { error: { _is_null: true } }, order_by: { width: asc }) { src url width height fileType error }
        lsp4Creators { profile_id profile { name } }
      }
    }
  }
  Transfer_aggregate(where: { _or: [{ from_id: { _eq: $profile } }, { to_id: { _eq: $profile } }] }) { aggregate { count } }
  Transaction(where: { _or: [{ from: { _eq: $profile } }, { to: { _eq: $profile } }], value: { _gt: "0" } }, limit: $limit, offset: $offset, order_by: [{ timestamp: desc }, { id: desc }]) {
    id from to value timestamp
  }
  Transaction_aggregate(where: { _or: [{ from: { _eq: $profile } }, { to: { _eq: $profile } }], value: { _gt: "0" } }) { aggregate { count } }
  Follow(where: { _or: [{ follower_id: { _eq: $profile } }, { followee_id: { _eq: $profile } }] }, limit: $limit, offset: $offset, order_by: [{ createdTimestamp: desc }, { id: desc }]) {
    id follower_id followee_id createdTimestamp
  }
  Follow_aggregate(where: { _or: [{ follower_id: { _eq: $profile } }, { followee_id: { _eq: $profile } }] }) { aggregate { count } }
}`;

async function requestActivity({ endpoint, fetchImpl, profile, limit, offset, signal }) {
  const response = await fetchImpl(endpoint, { method: 'POST', signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: ACTIVITY_QUERY, variables: { profile, limit, offset } }) });
  if (!response.ok) throw new Error(`LUKSO indexer responded ${response.status}`);
  const payload = await response.json();
  if (!payload.data && payload.errors?.length) throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  return { data: payload.data || {}, partialError: payload.errors?.map((entry) => entry.message).join('; ') || null };
}

export function createLuksoActivityRepository({ endpoint = LUKSO_INDEXER_URL, fetchImpl = globalThis.fetch, pageSize = 24 } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'LIVE', endpoint,
    async loadRecentActivity(profileAddress, { offset = 0, limit = pageSize, signal } = {}) {
      const profile = normalizeProfileAddress(profileAddress);
      if (!profile) throw new TypeError('A valid Universal Profile address is required');
      const { data, partialError } = await requestActivity({ endpoint, fetchImpl, profile, limit, offset, signal });
      const normalized = [
        ...(Array.isArray(data.Transfer) ? data.Transfer.map((entry) => normalizeTransferSignal(entry, profile)) : []),
        ...(Array.isArray(data.Transaction) ? data.Transaction.map((entry) => normalizeLyxSignal(entry, profile)) : []),
        ...(Array.isArray(data.Follow) ? data.Follow.map((entry) => normalizeFollowSignal(entry, profile)) : [])
      ].filter(Boolean);
      const signals = sortSignalsNewestFirst([...new Map(normalized.map((entry) => [entry.id, entry])).values()]);
      const transferTotal = Number(data.Transfer_aggregate?.aggregate?.count) || 0;
      const transactionTotal = Number(data.Transaction_aggregate?.aggregate?.count) || 0;
      const followTotal = Number(data.Follow_aggregate?.aggregate?.count) || 0;
      return { signals, offset, nextOffset: offset + limit, complete: offset + limit >= Math.max(transferTotal, transactionTotal, followTotal),
        totals: { transfers: transferTotal, lyxTransfers: transactionTotal, follows: followTotal }, partialError };
    }
  };
}

export const luksoActivityRepository = createLuksoActivityRepository();
