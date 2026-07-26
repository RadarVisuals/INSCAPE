import assert from 'node:assert/strict';
import test from 'node:test';
import {
  artworkChoiceOperation,
  contextTargetExists,
  isArtworkAuthoringCommand
} from './useArtworkCommandController.js';

test('artwork choice preserves replacement identity and distinguishes new placement', () => {
  const asset = { id: 'asset:one', imageWidth: 1600, imageHeight: 800 };
  assert.deepEqual(artworkChoiceOperation({ mode: 'replace', targetId: 'canvas:one' }, asset), {
    type: 'replace', targetId: 'canvas:one', assetId: 'asset:one'
  });
  const create = artworkChoiceOperation({ mode: 'create', placement: { column: 2, row: 3 } }, asset);
  assert.equal(create.type, 'create');
  assert.equal(create.gallery, false);
  assert.deepEqual(create.input.placement, { column: 2, row: 3 });
  assert.equal(create.input.span, undefined);
});

test('Gallery artwork creation derives its span from asset aspect ratio', () => {
  const wide = artworkChoiceOperation(
    { mode: 'gallery-create', placement: { column: 4, row: 5 } },
    { id: 'asset:wide', imageWidth: 1200, imageHeight: 600 }
  );
  const tall = artworkChoiceOperation(
    { mode: 'gallery-create', placement: { column: 4, row: 5 } },
    { id: 'asset:tall', imageWidth: 600, imageHeight: 1200 }
  );
  const unknown = artworkChoiceOperation(
    { mode: 'gallery-create', placement: { column: 4, row: 5 } },
    { id: 'asset:unknown' }
  );
  assert.deepEqual(wide.input.span, { columns: 6, rows: 3 });
  assert.deepEqual(tall.input.span, { columns: 3, rows: 6 });
  assert.deepEqual(unknown.input.span, { columns: 4, rows: 4 });
});

test('owner-only artwork commands stay separated from delegated shell commands', () => {
  for (const command of [
    'replace-artwork', 'remove-artwork', 'toggle-artwork-lock',
    'toggle-object-visibility', 'object-front', 'menu-appearance', 'frame-heavy'
  ]) assert.equal(isArtworkAuthoringCommand(command), true, command);
  for (const command of [
    'preview-as-visitor', 'toggle-grid', 'reset-home-camera',
    'reset-windows', 'open', 'toggle-start-open'
  ]) assert.equal(isArtworkAuthoringCommand(command), false, command);
});

test('context targets close when their backing object or runtime window disappears', () => {
  const state = {
    canvasObjectById: { 'canvas:one': { id: 'canvas:one' } },
    sceneById: { identity: { id: 'identity' } },
    openRuntimeIds: ['signals']
  };
  assert.equal(contextTargetExists({ type: 'gallery-object', id: 'canvas:one' }, state), true);
  assert.equal(contextTargetExists({ type: 'window', id: 'signals-panel' }, state), true);
  assert.equal(contextTargetExists({ type: 'folder', id: 'folder-panel:owned' }, state), true);
  assert.equal(contextTargetExists({ type: 'canvas', id: 'canvas' }, state), true);
  assert.equal(contextTargetExists({ type: 'gallery-object', id: 'canvas:gone' }, state), false);
  assert.equal(contextTargetExists({ type: 'window', id: 'collection-panel' }, state), false);
});
