import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionTextDefaults } from './compositionTextDefaults.js';

test('new transparent Composition Text chooses readable ink on the effective cell surface', () => {
  const composition = (color, opacity) => ({ shapes: [{ id: 'cell', color, opacity }] });
  for (const mode of ['dark', 'light']) {
    assert.equal(compositionTextDefaults(composition('#000000', 1), 'cell', mode).appearance.color, '#ffffff');
    assert.equal(compositionTextDefaults(composition('#ffffff', 1), 'cell', mode).appearance.color, '#000000');
  }
  assert.deepEqual(compositionTextDefaults(composition('#808080', .25), 'cell', 'light'),
    { visibility: 'PUBLIC', appearance: { background: null, compact: true, fontSize: 28, color: '#000000' } });
  assert.equal(compositionTextDefaults(composition('#808080', .25), 'cell', 'dark').appearance.color, '#ffffff');
  assert.equal(compositionTextDefaults(composition('#000000', 0), 'cell', 'light').appearance.color, '#000000');
  assert.equal(compositionTextDefaults({ shapes: [] }, null, 'light').appearance.color, '#000000');
});


test('new Text composites transparent cells over the authored frame fill independently of theme', () => {
  for (const mode of ['dark', 'light']) for (const [surface, ink] of [['#ffffff', '#000000'], ['#000000', '#ffffff']]) {
    const value = { surface, shapes: [{ id: 'cell', color: '#808080', opacity: 0 }] };
    assert.equal(compositionTextDefaults(value, 'cell', mode).appearance.color, ink);
  }
});


test('transparent frame fill chooses new text ink from the page background', () => {
  for (const mode of ['dark', 'light']) {
    const base = { surface: '#ffffff', surfaceOpacity: 0, backgroundColor: '#001120', shapes: [] };
    assert.equal(compositionTextDefaults(base, null, mode).appearance.color, '#ffffff');
    assert.equal(compositionTextDefaults({ ...base, surfaceOpacity: 1 }, null, mode).appearance.color, '#000000');
    assert.equal(compositionTextDefaults({ ...base, backgroundColor: '#ffffff' }, null, mode).appearance.color, '#000000');
  }
});

test('free text starts with independently adjustable insets', () => {
  assert.deepEqual(compositionTextDefaults({ shapes: [] }, null, 'dark').appearance.padding,
    { top: 24, right: 24, bottom: 24, left: 24 });
});
