import assert from 'node:assert/strict'; import test from 'node:test';
import { buildKeeperMessage } from './signalMessages.js';

test('message construction includes known metadata and abbreviated counterparty', () => {
  const message = buildKeeperMessage({ type: 'ASSET_RECEIVED', direction: 'INCOMING', counterparty: '0x1234567890abcdef1234567890abcdef123489ef', assetReference: { name: 'ABYSSAL STUDY', metadataStatus: 'ready' } });
  assert.match(message.text, /ABYSSAL STUDY/); assert.match(message.text, /0x1234…89EF/);
});
test('message construction uses atmospheric fallback when metadata is unavailable', () => {
  assert.equal(buildKeeperMessage({ type: 'ASSET_RECEIVED', direction: 'INCOMING', assetReference: { name: 'Unknown asset', metadataStatus: 'unavailable' } }).text, 'Something new arrived.');
});
