import assert from 'node:assert/strict';
import test from 'node:test';
import { displayInstrumentLayout, initialDisplayInstruments, transitionDisplayInstruments } from './displayInstrumentState.js';

test('instrument transitions keep one attached active instrument and no duplicated detached instance', () => {
  const events = ['open', 'toggle', 'detach', 'attach', 'close'];
  let states = [initialDisplayInstruments];
  for (let depth = 0; depth < 4; depth += 1) {
    const next = new Map();
    for (const state of states) for (const instrument of ['layers', 'metadata']) for (const type of events) {
      const before = structuredClone(state);
      const result = transitionDisplayInstruments(state, { type, instrument });
      assert.deepEqual(state, before);
      if (result.active) assert.equal(result[result.active], 'attached');
      next.set(JSON.stringify(result), result);
    }
    states = [...next.values()];
  }
  const detached = transitionDisplayInstruments(initialDisplayInstruments, { type: 'detach', instrument: 'layers' });
  assert.equal(detached.active, 'metadata');
  assert.equal(detached.layers, 'detached');
  const attached = transitionDisplayInstruments(detached, { type: 'attach', instrument: 'layers' });
  assert.deepEqual(attached, initialDisplayInstruments);
});

test('a utility bay is only attached where a useful Stage and bounded reading height fit', () => {
  assert.equal(displayInstrumentLayout(959, 800).attached, false);
  assert.equal(displayInstrumentLayout(960, 459).attached, false);
  assert.equal(displayInstrumentLayout(960, 460).attached, true);
  assert.equal(displayInstrumentLayout(390, 802).attached, false);
});
