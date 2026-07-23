import { normalizeProfileAsset } from '../../library/domain/normalizeProfileAsset.js';
import { normalizeProfileAddress } from '../../library/config.js';

export const SIGNAL_TYPES = Object.freeze({ ASSET_RECEIVED: 'ASSET_RECEIVED', ASSET_SENT: 'ASSET_SENT', LYX_RECEIVED: 'LYX_RECEIVED', LYX_SENT: 'LYX_SENT', FOLLOWER_GAINED: 'FOLLOWER_GAINED', PROFILE_FOLLOWED: 'PROFILE_FOLLOWED', UNKNOWN_ACTIVITY: 'UNKNOWN_ACTIVITY' });
export const SIGNAL_DIRECTIONS = Object.freeze({ INCOMING: 'INCOMING', OUTGOING: 'OUTGOING', UNKNOWN: 'UNKNOWN' });
export const SIGNAL_SOURCE_MODES = Object.freeze({ LIVE: 'LIVE', FIXTURE: 'FIXTURE' });
const normalizeHex = (value) => /^0x[\da-f]+$/i.test(String(value || '')) ? String(value).toLowerCase() : null;
const timestampMs = (value) => { const number = Number(value); return Number.isFinite(number) ? (number < 10_000_000_000 ? number * 1000 : number) : 0; };

export function createSignalId({ transactionHash, sourceReference, type, assetContract, tokenId, direction }) {
  const source = normalizeHex(transactionHash) || String(sourceReference || '').trim().toLowerCase();
  if (!source) throw new TypeError('A transaction hash or source reference is required');
  return [source, type, direction, normalizeHex(assetContract) || '-', normalizeHex(tokenId) || String(tokenId || '-').toLowerCase()].join(':');
}

export function classifyDirection(profileAddress, from, to) {
  const profile = normalizeProfileAddress(profileAddress); const sender = normalizeProfileAddress(from); const recipient = normalizeProfileAddress(to);
  if (!profile) return SIGNAL_DIRECTIONS.UNKNOWN;
  if (recipient === profile && sender !== profile) return SIGNAL_DIRECTIONS.INCOMING;
  if (sender === profile && recipient !== profile) return SIGNAL_DIRECTIONS.OUTGOING;
  return SIGNAL_DIRECTIONS.UNKNOWN;
}

function signalTitle(type, asset) {
  if (type === SIGNAL_TYPES.LYX_RECEIVED || type === SIGNAL_TYPES.LYX_SENT) return 'LYX transfer';
  if (asset?.name) return asset.name;
  return type === SIGNAL_TYPES.ASSET_RECEIVED || type === SIGNAL_TYPES.ASSET_SENT ? 'Unknown asset' : 'Profile activity';
}

export function normalizeTransferSignal(transfer, profileAddress, { sourceMode = SIGNAL_SOURCE_MODES.LIVE } = {}) {
  const profile = normalizeProfileAddress(profileAddress); const direction = classifyDirection(profile, transfer?.from_id, transfer?.to_id);
  if (!profile || direction === SIGNAL_DIRECTIONS.UNKNOWN) return null;
  const tokenId = transfer?.token?.tokenId || transfer?.token_id || null;
  const assetContract = normalizeProfileAddress(transfer?.asset?.id || transfer?.asset_id || String(transfer?.token_id || '').slice(0, 42));
  if (!assetContract) return null;
  const asset = normalizeProfileAsset({ id: transfer?.id, balance: transfer?.value, asset_id: assetContract,
    token_id: tokenId ? `${assetContract}-${tokenId}` : null, asset: transfer?.asset, token: transfer?.token }, profile);
  const type = direction === SIGNAL_DIRECTIONS.INCOMING ? SIGNAL_TYPES.ASSET_RECEIVED : SIGNAL_TYPES.ASSET_SENT;
  const transactionHash = normalizeHex(transfer?.transaction_id || transfer?.transaction?.id); const sourceReference = transfer?.id;
  return { id: createSignalId({ transactionHash, sourceReference, type, assetContract, tokenId, direction }), type, direction,
    timestamp: timestampMs(transfer?.timestamp), transactionHash, sourceReference: sourceReference || transactionHash, profileAddress: profile,
    counterparty: direction === SIGNAL_DIRECTIONS.INCOMING ? normalizeProfileAddress(transfer?.from_id) : normalizeProfileAddress(transfer?.to_id),
    assetContract, tokenId: tokenId ? String(tokenId).toLowerCase() : null,
    assetReference: asset ? { id: asset.id, name: asset.name, standard: asset.standard, imageUrl: asset.imageUrl, metadataStatus: asset.metadataStatus } : null,
    amount: transfer?.value == null ? null : String(transfer.value), value: null, title: signalTitle(type, asset), messageData: {}, sourceMode, seen: false, read: false };
}

export function normalizeLyxSignal(transaction, profileAddress, { sourceMode = SIGNAL_SOURCE_MODES.LIVE } = {}) {
  const profile = normalizeProfileAddress(profileAddress); const direction = classifyDirection(profile, transaction?.from, transaction?.to);
  let positive = false; try { positive = BigInt(String(transaction?.value || '0')) > 0n; } catch { /* invalid value */ }
  if (!profile || direction === SIGNAL_DIRECTIONS.UNKNOWN || !positive) return null;
  const type = direction === SIGNAL_DIRECTIONS.INCOMING ? SIGNAL_TYPES.LYX_RECEIVED : SIGNAL_TYPES.LYX_SENT; const transactionHash = normalizeHex(transaction?.id);
  return { id: createSignalId({ transactionHash, sourceReference: transaction?.id, type, direction }), type, direction,
    timestamp: timestampMs(transaction?.timestamp), transactionHash, sourceReference: transaction?.id, profileAddress: profile,
    counterparty: normalizeProfileAddress(direction === SIGNAL_DIRECTIONS.INCOMING ? transaction?.from : transaction?.to), assetContract: null, tokenId: null, assetReference: null, amount: null,
    value: String(transaction.value), title: signalTitle(type), messageData: {}, sourceMode, seen: false, read: false };
}

export function normalizeFollowSignal(follow, profileAddress, { sourceMode = SIGNAL_SOURCE_MODES.LIVE } = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  const follower = normalizeProfileAddress(follow?.follower_id);
  const followee = normalizeProfileAddress(follow?.followee_id);
  if (!profile || !follower || !followee || follower === followee) return null;
  const incoming = followee === profile;
  const outgoing = follower === profile;
  if (!incoming && !outgoing) return null;
  const type = incoming ? SIGNAL_TYPES.FOLLOWER_GAINED : SIGNAL_TYPES.PROFILE_FOLLOWED;
  const direction = incoming ? SIGNAL_DIRECTIONS.INCOMING : SIGNAL_DIRECTIONS.OUTGOING;
  const sourceReference = String(follow?.id || `${follower}:${followee}`);
  return {
    id: createSignalId({ sourceReference, type, direction }), type, direction,
    timestamp: timestampMs(follow?.createdTimestamp), transactionHash: null, sourceReference,
    profileAddress: profile, counterparty: incoming ? follower : followee,
    assetContract: null, tokenId: null, assetReference: null, amount: null, value: null,
    title: incoming ? 'New follower' : 'Profile followed', messageData: {}, sourceMode, seen: false, read: false
  };
}

export function createFixtureSignal(candidate, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || !Object.values(SIGNAL_TYPES).includes(candidate?.type)) throw new TypeError('Invalid fixture signal');
  const direction = candidate.direction || (candidate.type.endsWith('RECEIVED') ? SIGNAL_DIRECTIONS.INCOMING : SIGNAL_DIRECTIONS.OUTGOING);
  const transactionHash = normalizeHex(candidate.transactionHash);
  return { id: createSignalId({ transactionHash, sourceReference: candidate.sourceReference, type: candidate.type, direction,
    assetContract: candidate.assetContract, tokenId: candidate.tokenId }), type: candidate.type, direction,
    timestamp: timestampMs(candidate.timestamp), transactionHash, sourceReference: candidate.sourceReference || transactionHash,
    profileAddress: profile, counterparty: normalizeProfileAddress(candidate.counterparty), assetContract: normalizeProfileAddress(candidate.assetContract),
    tokenId: candidate.tokenId ? String(candidate.tokenId).toLowerCase() : null, assetReference: candidate.assetReference || null,
    amount: candidate.amount == null ? null : String(candidate.amount), value: candidate.value == null ? null : String(candidate.value),
    title: candidate.title || signalTitle(candidate.type, candidate.assetReference), messageData: candidate.messageData || {},
    sourceMode: SIGNAL_SOURCE_MODES.FIXTURE, seen: false, read: false };
}

export function sortSignalsNewestFirst(signals) { return [...signals].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id)); }
