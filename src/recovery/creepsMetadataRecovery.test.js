import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeDataSourceWithHash } from '@erc725/erc725.js';
import {
  CREEPS_METADATA_CID,
  CREEPS_METADATA_KEYS,
  CREEPS_METADATA_VALUES,
  sameCreepsMetadataValues,
} from './creepsMetadataRecovery.js';

test('CREEPS recovery payload points to the verified metadata upload', () => {
  assert.equal(CREEPS_METADATA_KEYS.length, 1);
  assert.equal(CREEPS_METADATA_VALUES.length, 1);
  const collectionMetadata = decodeDataSourceWithHash(CREEPS_METADATA_VALUES[0]);
  assert.equal(collectionMetadata.url, `ipfs://${CREEPS_METADATA_CID}`);
  assert.equal(collectionMetadata.verification.method, 'keccak256(utf8)');
  assert.equal(collectionMetadata.verification.data, '0x4ee9c6e084366d78baeb7e786f6cf2c03fc8bf89b2c86dfa0316062c376fbc82');
});

test('CREEPS recovery comparison requires both exact values', () => {
  assert.equal(sameCreepsMetadataValues(CREEPS_METADATA_VALUES), true);
  assert.equal(sameCreepsMetadataValues(['0x']), false);
});
