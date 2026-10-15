import test from 'node:test';
import assert from 'node:assert/strict';
import { stageCardInsets } from './bentoStageGeometry.js';

test('card expansion coordinates belong to the stage, independent of page offset', () => {
  const stage = { left: 100, top: 300, width: 1000, height: 800 };
  const card = { left: 350, right: 600, top: 900, bottom: 1100 };
  assert.equal(stageCardInsets(stage, card), '75% 50% 0% 25%');
  assert.equal(stageCardInsets({ ...stage, left: 700, top: -200 },
    { left: 950, right: 1200, top: 400, bottom: 600 }), '75% 50% 0% 25%');
});

test('missing and out-of-bounds origins cannot make a layer escape the stage', () => {
  const stage = { left: 100, top: 100, width: 800, height: 400 };
  assert.equal(stageCardInsets(stage), '0% 0% 0% 0%');
  assert.equal(stageCardInsets(stage, { left: 0, top: 0, right: 1000, bottom: 800 }), '0% 0% 0% 0%');
  for (const card of [
    { left: -100, right: 200, top: 50, bottom: 300 },
    { left: 950, right: 1100, top: 550, bottom: 700 },
  ]) {
    const [top, right, bottom, left] = stageCardInsets(stage, card).split(' ').map(parseFloat);
    assert.ok(top >= 0 && right >= 0 && bottom >= 0 && left >= 0);
    assert.ok(top + bottom <= 100 && left + right <= 100);
  }
});
