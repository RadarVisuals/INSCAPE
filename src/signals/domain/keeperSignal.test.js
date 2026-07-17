import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDirection, createSignalId, normalizeLyxSignal, normalizeTransferSignal, SIGNAL_DIRECTIONS, SIGNAL_TYPES, sortSignalsNewestFirst } from './keeperSignal.js';

const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const OTHER = '0x1234567890abcdef1234567890abcdef12345678';
const ASSET = '0x1111111111111111111111111111111111111111';

test('stable signal identity ignores response ordering and casing', () => {
  const a = createSignalId({ transactionHash: '0xABC', type: SIGNAL_TYPES.ASSET_RECEIVED, direction: 'INCOMING', assetContract: ASSET, tokenId: '0x01' });
  const b = createSignalId({ transactionHash: '0xabc', type: SIGNAL_TYPES.ASSET_RECEIVED, direction: 'INCOMING', assetContract: ASSET.toUpperCase().replace('0X', '0x'), tokenId: '0X01' });
  assert.equal(a, b);
});

test('incoming and outgoing activity is classified relative to the profile', () => {
  assert.equal(classifyDirection(PROFILE, OTHER, PROFILE), SIGNAL_DIRECTIONS.INCOMING);
  assert.equal(classifyDirection(PROFILE, PROFILE, OTHER), SIGNAL_DIRECTIONS.OUTGOING);
  assert.equal(classifyDirection(PROFILE, OTHER, OTHER), SIGNAL_DIRECTIONS.UNKNOWN);
});

test('LSP8 transfer normalization reuses the Phase 1 asset model', () => {
  const signal = normalizeTransferSignal({ id: 'transfer-1', transaction_id: '0xabc', from_id: OTHER, to_id: PROFILE, timestamp: 100,
    asset_id: ASSET, token_id: `${ASSET}-0x01`, value: '1', asset: { id: ASSET, name: 'Collection', isCollection: true },
    token: { tokenId: '0x01', name: 'ABYSSAL STUDY', description: 'Study', images: [{ url: 'ipfs://asset' }], asset: { id: ASSET, name: 'Collection', isCollection: true } } }, PROFILE);
  assert.equal(signal.type, SIGNAL_TYPES.ASSET_RECEIVED); assert.equal(signal.assetReference.name, 'ABYSSAL STUDY');
  assert.equal(signal.assetReference.standard, 'LSP8'); assert.equal(signal.counterparty, OTHER);
});

test('only positive direct incoming LYX transactions normalize live', () => {
  assert.equal(normalizeLyxSignal({ id: '0x123', from: OTHER, to: PROFILE, value: '10', timestamp: 2 }, PROFILE).type, SIGNAL_TYPES.LYX_RECEIVED);
  assert.equal(normalizeLyxSignal({ id: '0x124', from: PROFILE, to: OTHER, value: '10', timestamp: 2 }, PROFILE), null);
});

test('signal history ordering is deterministic and newest-first', () => {
  assert.deepEqual(sortSignalsNewestFirst([{ id: 'a', timestamp: 1 }, { id: 'b', timestamp: 3 }, { id: 'c', timestamp: 2 }]).map((s) => s.id), ['b', 'c', 'a']);
});
