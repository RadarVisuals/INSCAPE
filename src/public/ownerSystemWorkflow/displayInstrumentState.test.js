import assert from 'node:assert/strict';
import test from 'node:test';
import { validInstrumentWindows } from './displayInstrumentState.js';

test('only finite bounded instrument window geometry is restored', () => {
  assert.ok(validInstrumentWindows({ layers: { left: 20, top: 50, width: 320, height: 480 } }));
  assert.ok(!validInstrumentWindows({ layers: { left: 20, top: 50, width: Infinity, height: 480 } }));
  assert.ok(!validInstrumentWindows({ unknown: { left: 20, top: 50, width: 320, height: 480 } }));
});

test('shared tool geometry admits all current tools and rejects malformed or out-of-bounds windows', () => {
  const tools = ['layers', 'metadata', 'appearance'];
  const rect = { left: -10000, top: 10000, width: 240, height: 180 };
  assert.ok(validInstrumentWindows(Object.fromEntries(tools.map(id => [id, rect])), tools));
  assert.ok(validInstrumentWindows({ appearance: { ...rect, width: 10000, height: 10000 } }, tools));
  for (const windows of [[], null, { unknown: rect }, { layers: null },
    { layers: { ...rect, extra: 1 } }, { layers: { ...rect, left: NaN } },
    { layers: { ...rect, top: 10001 } }, { layers: { ...rect, left: -10001 } },
    { layers: { ...rect, width: 239 } }, { layers: { ...rect, height: 179 } },
    { layers: { ...rect, width: 10001 } }, { layers: { ...rect, height: 10001 } }]) {
    assert.ok(!validInstrumentWindows(windows, tools));
  }
});
