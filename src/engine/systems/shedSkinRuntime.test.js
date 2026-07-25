import assert from 'node:assert/strict';
import test from 'node:test';
import { getShedSkinSnapshotScale } from './shedSkinRuntime.js';

test('shed-skin snapshots inherit the active resident handoff scale', () => {
  assert.equal(getShedSkinSnapshotScale(0.8), 0.8);
  assert.equal(getShedSkinSnapshotScale(0.8, 0.5), 0.4);
});
