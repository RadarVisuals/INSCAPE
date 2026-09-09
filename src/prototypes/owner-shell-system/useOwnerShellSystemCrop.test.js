import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('prototype crop lifecycle is isolated behind one canonical crop controller', async () => {
  const [controller, parent] = await Promise.all([
    read('./useOwnerShellSystemCrop.js'),
    read('./OwnerShellSystemPrototype.jsx'),
  ]);

  assert.match(parent, /useOwnerShellSystemCrop/);
  assert.match(parent, /beginCrop\(selectedPlacement\)/);
  assert.match(parent, /onCancelCrop=\{cancelCrop\}/);
  assert.doesNotMatch(parent, /setCropSession|cropDragRef/);
  assert.doesNotMatch(parent, /createLatticeProductionCropSession|createLatticeProductionCropPanGesture|updateLatticeProductionCropPanGesture|setLatticeProductionCropZoom/);

  for (const canonicalOperation of [
    'createLatticeProductionCropSession',
    'createLatticeProductionCropPanGesture',
    'updateLatticeProductionCropPanGesture',
    'setLatticeProductionCropZoom',
  ]) assert.match(controller, new RegExp(canonicalOperation));

  assert.match(controller, /const closeCropSession = \(\) => setCropSession\(null\)/);
  assert.match(controller, /startPlacement: \{ \.\.\.placement \}/);
  assert.match(controller, /height: startPlacement\.height/);
  assert.match(controller, /const updateCropPlacementGeometry/);
  assert.match(controller, /previewCrop: setLatticeProductionCropZoom\(current\.previewCrop, current\.media, mask, current\.previewCrop\.zoom\)/);
  assert.match(controller, /interacted: false/);
  assert.match(controller, /interacted: true/);
  assert.match(controller, /if \(cropSession\.interacted\) applyCrop\(\)/);
  assert.match(controller, /CROP APPLIED IN SESSION STUDY/);
  assert.match(controller, /NATIVE FIT RESTORED IN SESSION STUDY/);
  assert.match(controller, /globalThis\.removeEventListener\('pointermove'/);
  assert.match(controller, /globalThis\.removeEventListener\('pointercancel'/);
  assert.match(controller, /event\.key === 'Escape'/);
  assert.match(controller, /event\.key === 'Enter'/);
  assert.match(parent, /const closeTransientPanels = \(\) => \{\s*finishCrop\(\)/s);
});
