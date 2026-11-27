import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecord, hasExactKeys, hasAllowedKeys } from './recordValidation.js';

test('strict record validation accepts object records and rejects arrays and primitive values', () => {
  for (const value of [null, undefined, false, 0, '', 'value', [], Object.assign([], { id: 1 }), () => {}])
    assert.equal(isRecord(value), false);
  assert.equal(isRecord(Object.freeze({ id: 'record' })), true);
  assert.equal(hasExactKeys({ id: 'record', width: 24 }, ['width', 'id']), true);
  assert.equal(hasExactKeys({}, []), true);
});

test('strict records require own fields and reject extra serialized fields', () => {
  const inherited = Object.assign(Object.create({ id: 'inherited' }), { other: true });
  assert.equal(hasExactKeys(inherited, ['id']), false);
  assert.equal(hasExactKeys({}, ['id']), false);
  assert.equal(hasExactKeys({ id: 1, extra: 2 }, ['id']), false);
  assert.equal(hasExactKeys(null, []), false);
  assert.equal(hasExactKeys([], []), false);
});

test('strict records retain JSON-visible key semantics for frozen and null-prototype records', () => {
  const record = Object.assign(Object.create(null), { id: 'own' });
  assert.equal(hasExactKeys(Object.freeze(record), ['id']), true);
  const withPrototype = Object.assign(Object.create({ ignored: true }), { id: 'own' });
  assert.equal(hasExactKeys(withPrototype, ['id']), true);
  Object.defineProperty(withPrototype, 'hidden', { value: true });
  withPrototype[Symbol('ignored')] = true;
  assert.equal(hasExactKeys(withPrototype, ['id']), true);
});

test('allowed keys retain optional-field validation and own required keys', () => {
  assert.equal(hasAllowedKeys({ required: 1 }, ['required'], ['optional']), true);
  assert.equal(hasAllowedKeys({ required: 1, optional: 2 }, ['required'], ['optional']), true);
  assert.equal(hasAllowedKeys({ required: 1, extra: 2 }, ['required'], ['optional']), false);
  assert.equal(hasAllowedKeys(Object.create({ required: 1 }), ['required'], ['optional']), false);
  for (const value of [null, false, '', [], 42]) assert.equal(hasAllowedKeys(value, [], []), false);
  const hidden = { required: 1 }; Object.defineProperty(hidden, 'hidden', { value: 2 });
  assert.equal(hasAllowedKeys(hidden, ['required']), true);
});
