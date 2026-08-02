import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('standalone Activity delegates only request state and retains its window behavior', async () => {
  const source = await read('./ActivityBrowser.jsx');
  assert.match(source, /useActivityController/);
  assert.match(source, /active: open/);
  assert.match(source, /createPortal/);
  assert.match(source, /closeOnEscape/);
  assert.match(source, /resizeCategoryBrowserRect/);
  assert.match(source, /FloatingWindowCloseButton/);
  assert.match(source, /activityTriggerRef|onOpenChange/);
  assert.doesNotMatch(source, /new AbortController|generationRef|setTimeout\([^)]*15000/);
});

test('Activity controller files remain headless and deterministic', async () => {
  const [controller, hook] = await Promise.all([
    read('../signals/state/activityController.js'), read('../signals/state/useActivityController.js'),
  ]);
  for (const source of [controller, hook]) {
    assert.doesNotMatch(source, /createPortal|document\.|querySelector|requestAnimationFrame|\.focus\(|className=|<section|<div/);
  }
  assert.match(controller, /timeoutMs = ACTIVITY_REQUEST_TIMEOUT_MS/);
  assert.match(controller, /repository\.loadRecentActivity/);
  assert.match(controller, /signals,/);
});
