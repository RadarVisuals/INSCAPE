import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeKeyName } from '@erc725/erc725.js';
import {
  INSCAPE_PROFILE_DOCUMENT_KEY,
  INSCAPE_PROFILE_DOCUMENT_KEY_NAME,
  INSCAPE_PROFILE_DOCUMENT_KEY_SCHEMA,
} from './inscapeProfileDocumentKey.js';

test('the central INSCAPE singleton key matches the installed LSP2 encoder', () => {
  assert.equal(INSCAPE_PROFILE_DOCUMENT_KEY_NAME, 'INSCAPEProfileDocument');
  assert.equal(
    INSCAPE_PROFILE_DOCUMENT_KEY,
    '0x804dd24d51189d1d9e972f155541cead2653af105983d5acac1ec2b3478d9362',
  );
  assert.equal(encodeKeyName(INSCAPE_PROFILE_DOCUMENT_KEY_NAME), INSCAPE_PROFILE_DOCUMENT_KEY);
  assert.deepEqual(INSCAPE_PROFILE_DOCUMENT_KEY_SCHEMA, {
    name: INSCAPE_PROFILE_DOCUMENT_KEY_NAME,
    key: INSCAPE_PROFILE_DOCUMENT_KEY,
    keyType: 'Singleton',
    valueType: 'bytes',
    valueContent: 'VerifiableURI',
  });
});
