import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('selection commands are isolated from the owner-shell parent', async () => {
  const [controller, parent] = await Promise.all([
    read('./useOwnerShellSystemSelectionCommands.js'),
    read('./OwnerShellSystemPrototype.jsx'),
  ]);
  assert.match(parent, /useOwnerShellSystemSelectionCommands/);
  assert.doesNotMatch(parent, /setRemoveCandidateId|const moveSelectedLayer|const duplicateSelected|const removePlacement/);
  assert.match(controller, /reorderSelectedPlacements/);
  assert.match(controller, /duplicateSelectedPlacements/);
  assert.match(controller, /selectionAfterPlacementRemoval/);
  assert.match(controller, /projectSelectionLayers/);
  assert.match(controller, /togglePlacementLock/);
  assert.match(controller, /const toggleLock/);
  assert.match(controller, /if \(activePlacements\.find\(\(\{ id \}\) => id === placementId\)\?\.locked\) return/);
  assert.match(controller, /ROTATE CONTROL PLACED HERE \/ NOT CONNECTED/);
  assert.match(controller, /MIRROR H CONTROL PLACED HERE \/ NOT CONNECTED/);
  assert.match(controller, /MIRROR V CONTROL PLACED HERE \/ NOT CONNECTED/);
  assert.match(controller, /event\.key === 'Escape'/);
});
