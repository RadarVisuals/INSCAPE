import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES,
  createOwnerSystemWorkflowProjectedField,
  measureOwnerSystemWorkflowArtboard,
  measureOwnerSystemWorkflowHeroArtboard,
  ownerSystemWorkflowArtboardContainsPoint,
  ownerSystemWorkflowProjectedFieldContainsPoint,
  projectOwnerSystemWorkflowPlacement,
} from './systemWorkflowArtboardProjection.js';
import { SYSTEM_WORKFLOW_DEFAULT_VIEW, projectSystemWorkflowViewport } from '../../systemWorkflow/systemWorkflowViewportProjection.js';

test('world projection keeps square cells while the usable Grid fills wide and narrow viewports', () => {
  assert.deepEqual(SYSTEM_WORKFLOW_DEFAULT_VIEW, { horizontalAnchor: 0.5, verticalAnchor: 0.5, zoomMode: 'CONTAIN_REFERENCE' });
  const wide = measureOwnerSystemWorkflowArtboard(1440, 848);
  assert.deepEqual(wide, {
    cellSize: 45, left: 0, top: 19, width: 1440, height: 848,
    referenceWidth: 1440, referenceHeight: 810,
  });
  assert.deepEqual(projectOwnerSystemWorkflowPlacement({ column: 15, row: 4, columnSpan: 4, rowSpan: 4 }, wide), { left: 675, top: 199, width: 180, height: 180 });
  const narrow = measureOwnerSystemWorkflowArtboard(390, 668);
  assert.equal(narrow.width, 390);
  assert.equal(narrow.height, 668);
  assert.equal(narrow.cellSize, 12.1875);
  assert.equal(narrow.top, 224.3125);
  assert.equal(narrow.referenceWidth, 390);
  assert.equal(narrow.referenceHeight, 219.375);
  assert.deepEqual(projectOwnerSystemWorkflowPlacement({ column: 20, row: 9, columnSpan: 5, rowSpan: 3 }, narrow), { left: 244, top: 334, width: 61, height: 37 });
  assert.equal(ownerSystemWorkflowArtboardContainsPoint(narrow, { x: 0, y: 0 }), true);
  assert.equal(ownerSystemWorkflowArtboardContainsPoint(narrow, { x: 390, y: 668 }), true);
  assert.equal(ownerSystemWorkflowArtboardContainsPoint(narrow, { x: 200, y: -1 }), false);
  assert.deepEqual(projectOwnerSystemWorkflowPlacement({ column: -2, row: -3, columnSpan: 2, rowSpan: 3 }, narrow), {
    left: -24, top: 188, width: 24, height: 36,
  });
});

test('owner and v9 Visitor share one explicit centered start view', () => {
  assert.deepEqual(projectSystemWorkflowViewport({ columns: 32, rows: 18 }, { width: 1440, height: 848 }),
    measureOwnerSystemWorkflowArtboard(1440, 848));
  assert.throws(() => projectSystemWorkflowViewport({ columns: 32, rows: 18 }, { width: 1440, height: 848 },
    { horizontalAnchor: 2, verticalAnchor: 0.5, zoomMode: 'CONTAIN_REFERENCE' }), /canonical view/);
});

test('Hero artboard stays compact on desktop and preserves a centered 16:9 aperture on narrow screens', () => {
  const desktop = measureOwnerSystemWorkflowHeroArtboard(1920, 1000);
  assert.equal(desktop.referenceWidth, 768);
  assert.equal(desktop.referenceHeight, 432);
  assert.equal(desktop.left, 576);
  assert.equal(desktop.top, 284);

  const narrow = measureOwnerSystemWorkflowHeroArtboard(465, 582);
  assert.ok(Math.abs(narrow.referenceWidth - 390.6) < 1e-9);
  assert.ok(Math.abs(narrow.referenceHeight - 219.7125) < 1e-9);
  assert.ok(Math.abs(narrow.left - 37.2) < 1e-9);
  assert.ok(Math.abs(narrow.top - 181.14375) < 1e-9);
  assert.ok(Math.abs(narrow.referenceWidth / narrow.referenceHeight - 16 / 9) < 1e-12);

  const field = createOwnerSystemWorkflowProjectedField({ getBoundingClientRect: () => ({ left: 10, top: 20, width: 465, height: 582 }) }, 1, 1,
    OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES.HERO);
  assert.equal(ownerSystemWorkflowProjectedFieldContainsPoint(field, { x: field.left, y: field.top }), true);
  assert.equal(ownerSystemWorkflowProjectedFieldContainsPoint(field, { x: field.left - 1, y: field.top }), false);
  assert.equal(ownerSystemWorkflowProjectedFieldContainsPoint(field, {
    x: field.left + 32 * field.cellSize,
    y: field.top + 18 * field.cellSize,
  }), true);
});
