import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerProfileStorageKey, readOwnerProfileValue, removeOwnerProfileValue, writeOwnerProfileValue } from './ownerProfileStorage.js';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';

function memoryStorage(entries = []) {
  const records = new Map(entries);
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, String(value)),
    removeItem: (key) => records.delete(key),
    records
  };
}

test('owner presentation values are isolated by normalized profile address', () => {
  const storage = memoryStorage();
  assert.equal(writeOwnerProfileValue(storage, 'layout', A, 'profile-a'), true);
  assert.equal(writeOwnerProfileValue(storage, 'layout', B, 'profile-b'), true);
  assert.equal(readOwnerProfileValue(storage, 'layout', A), 'profile-a');
  assert.equal(readOwnerProfileValue(storage, 'layout', B), 'profile-b');
  assert.notEqual(ownerProfileStorageKey('layout', A), ownerProfileStorageKey('layout', B));
  assert.equal(removeOwnerProfileValue(storage, 'layout', A), true);
  assert.equal(readOwnerProfileValue(storage, 'layout', A), null);
  assert.equal(readOwnerProfileValue(storage, 'layout', B), 'profile-b');
});

test('unscoped legacy state is claimed once and never leaks to another profile', () => {
  const storage = memoryStorage([['layout', 'legacy-layout']]);
  assert.equal(readOwnerProfileValue(storage, 'layout', A), 'legacy-layout');
  assert.equal(storage.records.get('layout:legacy-owner'), A);
  assert.equal(storage.records.has('layout'), false);
  assert.equal(readOwnerProfileValue(storage, 'layout', B), null);
  assert.equal(storage.records.get(ownerProfileStorageKey('layout', B)), undefined);
  assert.equal(readOwnerProfileValue(storage, 'layout', A), 'legacy-layout');
});
