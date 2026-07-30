import assert from 'node:assert/strict';
import test from 'node:test';
import { identityDossierViewerLayout } from './identityDossierViewerLayout.js';

const origin = { left: 24, top: 51, width: 244, height: 72 };

test('centers one compact desktop identity rack independently from the rail', () => {
  const layout = identityDossierViewerLayout(origin, { width: 1280, height: 720 });
  assert.equal(layout.mode, 'desktop');
  assert.ok(layout.rack.width >= 380 && layout.rack.width <= 430);
  assert.equal(layout.rack.height, 620);
  assert.equal(layout.rack.left, (1280 - layout.rack.width) / 2);
  assert.equal(layout.rack.top, 50);
  assert.deepEqual(layout.origin, origin);
});

test('uses one full-width readable rack on mobile', () => {
  const layout = identityDossierViewerLayout(origin, { width: 390, height: 844 });
  assert.equal(layout.mode, 'compact');
  assert.equal(layout.rack.left, 12);
  assert.equal(layout.rack.width, 366);
  assert.equal(layout.rack.top, 52);
  assert.equal(layout.rack.height, 780);
});
