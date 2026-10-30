import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCanvasRegion } from './fitCanvasRegion.js';
import { canvasArtworkSources, canvasDestinations } from './canvasPresentationModel.js';

test('a 5K canvas fits narrow and wide viewports without an editor zoom floor or geometry changes', () => {
  const area = { left: -1000, top: 500, width: 5000, height: 5000 };
  for (const size of [{ width: 300, height: 500 }, { width: 1400, height: 800 }]) {
    const fit = fitCanvasRegion(area, area, size, 0);
    assert.ok(fit.scale < .25);
    assert.ok(fit.left >= 0 && fit.top >= 0);
    assert.ok(fit.left + area.width * fit.scale <= size.width);
    assert.ok(fit.top + area.height * fit.scale <= size.height);
  }
  const region = { left: -500, top: 1000, width: 1200, height: 600 }, size = { width: 300, height: 500 };
  const fit = fitCanvasRegion(area, region, size, 0);
  assert.equal(fit.scale, .25);
  assert.equal(fit.left + (region.left - area.left + region.width / 2) * fit.scale, size.width / 2);
  assert.equal(fit.top + (region.top - area.top + region.height / 2) * fit.scale, size.height / 2);
});

test('presentation uses saved Index order and anchor resolution without writing a view', () => {
  const draft = { workbench: { shapes: [{ id: 'shape:a', window: { left: 50, top: 80 } }] },
    workbenchGroups: [{ id: 'workbench-group:a', memberIds: ['shape:a'] }],
    workbenchIndex: { destinations: [{ id: 'workbench-view:a', name: 'Vision', visibility: 'PRIVATE',
      view: { left: 10, top: 20, width: 100, height: 200 }, follow: { groupId: 'workbench-group:a', anchorId: 'shape:a', origin: { left: 20, top: 20 } } }] } };
  const before = structuredClone(draft);
  assert.deepEqual(canvasDestinations(draft), [{ id: 'workbench-view:a', name: 'Vision', view: { left: 40, top: 80, width: 100, height: 200 } }]);
  assert.deepEqual(draft, before);
  assert.deepEqual(canvasDestinations({}), []);
});

test('source metadata stays distinct and repeated placements share one dossier', () => {
  const asset = { stableAssetId: 'source:a', name: 'First work', description: 'First description', creators: [], attributes: [{ key: 'Mood', value: 'Quiet' }], tokenStandard: 'UNKNOWN', network: 'lukso-mainnet' };
  const other = { ...asset, stableAssetId: 'source:b', name: 'Other work', description: 'Other description', attributes: [{ key: 'Material', value: 'Paper' }] };
  const items = [asset, asset, other].map((asset, i) => ({ id: `image:${i}`, source: { kind: 'image', side: { asset } }, frame: { left: i * 100, top: 0, width: 50, height: 50 } }));
  const before = structuredClone(items), result = canvasArtworkSources({ items });
  assert.equal(result.length, 2); assert.equal(result[0].frames.length, 2);
  assert.deepEqual(result[0].dossier.traits, [{ label: 'Mood', value: 'Quiet' }]);
  assert.deepEqual(result[1].dossier.traits, [{ label: 'Material', value: 'Paper' }]);
  assert.deepEqual(items, before);
});
