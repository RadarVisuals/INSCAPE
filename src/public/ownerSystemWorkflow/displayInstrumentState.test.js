import assert from 'node:assert/strict';
import test from 'node:test';
import { initialDisplayInstruments, normalizeDisplayInstruments, transitionDisplayInstruments, validInstrumentWindows } from './displayInstrumentState.js';
test('tools open independently and old sidecars become windows without opening unused metadata', () => {
  const old = { active: 'layers', layers: 'attached', metadata: 'attached' };
  let state = normalizeDisplayInstruments(old);
  assert.deepEqual(state, { active: null, layers: 'detached', metadata: 'closed' });
  state = transitionDisplayInstruments(state, { type: 'open', instrument: 'metadata' });
  assert.equal(state.layers, 'detached'); assert.equal(state.metadata, 'detached');
  state = transitionDisplayInstruments(state, { type: 'close', instrument: 'layers' });
  assert.equal(state.metadata, 'detached'); assert.equal(state.layers, 'closed');
  assert.deepEqual(normalizeDisplayInstruments(undefined), initialDisplayInstruments);
});
test('only finite bounded instrument window geometry is restored', () => {
  assert.ok(validInstrumentWindows({ layers: { left: 20, top: 50, width: 320, height: 480 } }));
  assert.ok(!validInstrumentWindows({ layers: { left: 20, top: 50, width: Infinity, height: 480 } }));
  assert.ok(!validInstrumentWindows({ unknown: { left: 20, top: 50, width: 320, height: 480 } }));
});
