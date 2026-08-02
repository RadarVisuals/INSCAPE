import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  captureLatticeFloatingWindowPointer,
  markLatticeFloatingWindowResizing,
  releaseLatticeFloatingWindowPointer,
} from './useLatticeFloatingWindow.js';

function pointerTarget() {
  const captures = new Set();
  return {
    captures,
    hasPointerCapture(pointerId) { return captures.has(pointerId); },
    releasePointerCapture(pointerId) { captures.delete(pointerId); },
    setPointerCapture(pointerId) { captures.add(pointerId); },
  };
}

test('pointer capture helpers retain and release the exact active pointer', () => {
  const currentTarget = pointerTarget();
  const event = { currentTarget, pointerId: 7 };
  captureLatticeFloatingWindowPointer(event);
  assert.deepEqual([...currentTarget.captures], [7]);
  releaseLatticeFloatingWindowPointer({ currentTarget, pointerId: 8 });
  assert.deepEqual([...currentTarget.captures], [7]);
  releaseLatticeFloatingWindowPointer(event);
  assert.deepEqual([...currentTarget.captures], []);
});

test('resize-state marking is symmetric and safe without a window element', () => {
  const attributes = new Set();
  const element = {
    dataset: {},
    removeAttribute(name) { attributes.delete(name); delete this.dataset.resizing; },
  };
  markLatticeFloatingWindowResizing(element, true);
  attributes.add('data-resizing');
  assert.equal(element.dataset.resizing, '');
  markLatticeFloatingWindowResizing(element, false);
  assert.equal(attributes.has('data-resizing'), false);
  assert.equal('resizing' in element.dataset, false);
  assert.doesNotThrow(() => markLatticeFloatingWindowResizing(null, false));
});

test('headless hook owns viewport clamping, cancellation paths and the stable public interface', async () => {
  const source = await readFile(new URL('./useLatticeFloatingWindow.js', import.meta.url), 'utf8');
  assert.match(source, /addEventListener\?\.\('resize', handleResize\)/);
  assert.match(source, /clampLatticeFloatingWindowSize\(current, nextViewport\)/);
  assert.match(source, /clampLatticeFloatingWindowPosition\(position, nextSize, nextViewport\)/);
  assert.match(source, /pointerId !== event\.pointerId/);
  assert.match(source, /releaseLatticeFloatingWindowPointer\(event\)/);
  assert.match(source, /markLatticeFloatingWindowResizing\(resizeGestureRef\.current\?\.rack, false\)/);
  assert.match(source, /move: \{ begin: beginMove, finish: finishMove, update: updateMove \}/);
  assert.match(source, /rackWidthResize:/);
  assert.match(source, /resize: \{ begin: beginResize, finish: finishResize, keyDown: resizeByKey, update: updateResize \}/);
  assert.match(source, /windowPosition,/);
  assert.match(source, /windowSize,/);
});

test('Browser workspace delegates only floating-window behavior to the extracted hook', async () => {
  const source = await readFile(new URL('../browser/useBrowserWorkspace.js', import.meta.url), 'utf8');
  assert.match(source, /useLatticeFloatingWindow\(\)/);
  assert.match(source, /move: floatingWindow\.move/);
  assert.match(source, /rackWidthResize: floatingWindow\.rackWidthResize/);
  assert.match(source, /resize: floatingWindow\.resize/);
  assert.match(source, /windowPosition: floatingWindow\.windowPosition/);
  assert.match(source, /windowSize: floatingWindow\.windowSize/);
  assert.doesNotMatch(source, /resizeGestureRef|moveGestureRef|data\.resizing|addEventListener\?\.\('resize'/);
});
