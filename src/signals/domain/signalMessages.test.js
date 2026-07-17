import assert from 'node:assert/strict'; import test from 'node:test';
import { buildKeeperMessage } from './signalMessages.js';

test('message construction includes known metadata and abbreviated counterparty', () => {
  const message = buildKeeperMessage({ type: 'ASSET_RECEIVED', direction: 'INCOMING', counterparty: '0x1234567890abcdef1234567890abcdef123489ef', assetReference: { name: 'ABYSSAL STUDY', metadataStatus: 'ready' } });
  assert.match(message.text, /ABYSSAL STUDY/); assert.match(message.text, /0x1234…89EF/);
});
test('message construction uses atmospheric fallback when metadata is unavailable', () => {
  assert.equal(buildKeeperMessage({ type: 'ASSET_RECEIVED', direction: 'INCOMING', assetReference: { name: 'Unknown asset', metadataStatus: 'unavailable' } }).text, 'Something new arrived.');
});
test('message construction uses separately resolved identity without mutating the signal', () => {
  const signal = { type: 'LYX_RECEIVED', direction: 'INCOMING', counterparty: '0x1234567890abcdef1234567890abcdef123489ef', value: '12000000000000000000' };
  const before = structuredClone(signal);
  assert.match(buildKeeperMessage(signal, { name: 'RADAR' }).text, /12 LYX arrived from RADAR/);
  assert.deepEqual(signal, before);
});
