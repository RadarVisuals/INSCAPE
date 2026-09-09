import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Library-to-grid pointer lifecycle is isolated behind one placement controller', async () => {
  const [controller, parent] = await Promise.all([
    read('./useOwnerShellSystemAssetPlacement.js'),
    read('./OwnerShellSystemPrototype.jsx'),
  ]);
  assert.match(parent, /useOwnerShellSystemAssetPlacement/);
  assert.doesNotMatch(parent, /\b(?:dragRef|setDrag|finishAssetDrag|moveAssetDrag|cancelAssetDrag)(?![A-Z])/);
  assert.match(controller, /DRAG_THRESHOLD = 6/);
  assert.match(controller, /placementRectangleFromPointer/);
  assert.match(controller, /createPlacementFromAssetDrop/);
  assert.match(controller, /globalThis\.removeEventListener\('pointercancel'/);
  assert.match(controller, /useEffect\(\(\) => \(\) => gestureRef\.current\?\.cleanup\(\), \[\]\)/);
});
