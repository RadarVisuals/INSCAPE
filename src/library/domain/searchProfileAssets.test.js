import assert from 'node:assert/strict';
import test from 'node:test';
import { searchProfileAssets } from './searchProfileAssets.js';

const assets = [
  { name: 'Keeper at Dusk', collectionName: 'Human Underneath', contractAddress: '0xaaa', tokenId: '0x01', creators: [{ name: 'Hidden Swarm', address: '0xccc' }] },
  { name: 'Orange Signal', collectionName: 'Signals', contractAddress: '0xbbb', tokenId: '0x02', creators: [] }
];

test('search is case-insensitive, trimmed, tokenized, and covers provenance fields', () => {
  assert.deepEqual(searchProfileAssets(assets, '  KEEPER dusk '), [assets[0]]);
  assert.deepEqual(searchProfileAssets(assets, 'hidden swarm'), [assets[0]]);
  assert.deepEqual(searchProfileAssets(assets, '0x02'), [assets[1]]);
  assert.equal(searchProfileAssets(assets, 'missing').length, 0);
});
