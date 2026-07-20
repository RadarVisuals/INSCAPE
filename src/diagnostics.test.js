import assert from 'node:assert/strict';
import test from 'node:test';
import { DEVELOPMENT_DIAGNOSTICS, installDevelopmentGlobal, removeDevelopmentGlobal, reportControlledError } from './diagnostics.js';

test('Node execution safely disables Vite development diagnostics', () => {
  const target = {};
  assert.equal(DEVELOPMENT_DIAGNOSTICS, false);
  assert.equal(installDevelopmentGlobal('mutableStore', {}, target), false);
  assert.deepEqual(target, {});
});

test('development global installation and identity-safe cleanup remain available', () => {
  const target = {}; const diagnostic = {};
  assert.equal(installDevelopmentGlobal('engine', diagnostic, target, true), true);
  assert.equal(target.engine, diagnostic);
  assert.equal(removeDevelopmentGlobal('engine', {}, target, true), false);
  assert.equal(removeDevelopmentGlobal('engine', diagnostic, target, true), true);
  assert.deepEqual(target, {});
});

test('controlled errors log bounded text without serializing nested provider state', () => {
  const prior = console.error; const calls = [];
  console.error = (...values) => calls.push(values);
  try { reportControlledError('resolver-failed', { message: `failure 0x${'ab'.repeat(64)}`, provider: { private: true } }); }
  finally { console.error = prior; }
  assert.deepEqual(calls, [['[resolver-failed] failure [hex omitted]']]);
});
