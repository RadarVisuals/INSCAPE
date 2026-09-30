import test from 'node:test';
import assert from 'node:assert/strict';
import { clampWorkbenchPosition, projectWorkbenchBounds, unprojectWorkbenchPosition, WORKBENCH_BOUNDS, WORKBENCH_SIZE } from './workbenchSpace.js';
import { clampWorkbenchMove } from './workbenchViewScale.js';
import { createDefaultWorkbenchPresentation, isValidWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from './workbenchLayoutStorage.js';

test('window movement uses the 8000-pixel work area, independent of screen size', () => {
  assert.equal(WORKBENCH_SIZE, 8000);
  assert.deepEqual(clampWorkbenchPosition({ left: 2200, top: 1600 }, { width: 600, height: 400 }), { left: 2200, top: 1600 });
  assert.deepEqual(clampWorkbenchPosition({ left: 20000, top: -100 }, { width: 600, height: 400 }), { left: 7392, top: 8 });
  const rectangle = { left: 100, top: 200, width: 700, height: 400 };
  assert.deepEqual(clampWorkbenchMove(rectangle, { x: 4000, y: 3000 }, WORKBENCH_BOUNDS), { x: 4000, y: 3000 });
  const projected = projectWorkbenchBounds(.5, { x: -1000, y: -300 });
  assert.deepEqual(projected, { left: -996, top: -296, right: 2996, bottom: 3696 });
  assert.deepEqual(clampWorkbenchMove({ left: 2700, top: 3500, width: 200, height: 100 }, { x: 400, y: 400 }, projected), { x: 96, y: 96 });
});

test('outlying windows round-trip through existing layout storage without a v9 schema change', () => {
  const profile = `0x${'1'.repeat(40)}`, draft = { grids: [], workbench: createDefaultWorkbenchPresentation() };
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  for (const position of [32, 2200, 7392, 12000]) {
    const layout = createDefaultWorkbenchPresentation();
    layout.display.window.left = position; layout.display.window.top = position;
    layout.display.shortcut.position = { left: position, top: position };
    layout.identity.window.left = position;
    assert.equal(isValidWorkbenchPresentation(layout), true);
    assert.equal(saveWorkbenchLayout(profile, draft, layout, {}, storage), true);
    const raw = [...values.values()];
    assert.deepEqual(loadWorkbenchLayout(profile, draft, storage).layout, layout);
    assert.deepEqual([...values.values()], raw, 'reading older layouts never clamps or rewrites them');
  }
});

test('screen placement removes camera pan and zoom before applying authored bounds', () => {
  const original = { left: 1092.25, top: 160.5 };
  for (const scale of [.25, .5, 1, 1.37, 2]) {
    const offset = { x: -250.25, y: -100.5 };
    const screen = { left: original.left * scale + offset.x, top: original.top * scale + offset.y };
    assert.deepEqual(unprojectWorkbenchPosition(screen, scale, offset), original);
    const nearBoundary = unprojectWorkbenchPosition({ left: 3950, top: -105 }, .5, offset);
    assert.deepEqual(clampWorkbenchPosition(nearBoundary, { width: 240, height: 180 }), { left: 7752, top: 8 });
  }
});
