import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionTextDefaults } from './receptionTextDefaults.js';

test('new transparent Reception Text chooses readable ink on the effective cell surface', () => {
  const reception = (color, opacity) => ({ shapes: [{ id: 'cell', color, opacity }] });
  for (const mode of ['dark', 'light']) {
    assert.equal(receptionTextDefaults(reception('#000000', 1), 'cell', mode).appearance.color, '#ffffff');
    assert.equal(receptionTextDefaults(reception('#ffffff', 1), 'cell', mode).appearance.color, '#000000');
  }
  assert.deepEqual(receptionTextDefaults(reception('#808080', .25), 'cell', 'light'),
    { visibility: 'PUBLIC', alignment: 'center', appearance: { background: null, compact: true, verticalAlign: 'center', color: '#000000' } });
  assert.equal(receptionTextDefaults(reception('#808080', .25), 'cell', 'dark').appearance.color, '#ffffff');
  assert.equal(receptionTextDefaults(reception('#000000', 0), 'cell', 'light').appearance.color, '#000000');
  assert.equal(receptionTextDefaults({ shapes: [] }, null, 'light').appearance.color, '#000000');
});
