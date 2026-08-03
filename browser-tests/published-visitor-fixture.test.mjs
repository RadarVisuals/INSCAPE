import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('./fixture.html', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./published-visitor-fixture.jsx', import.meta.url), 'utf8');
const harness = readFileSync(new URL('./published-visitor.browser.mjs', import.meta.url), 'utf8');

test('published visitor fixture enters the production runtime selector with canonical and compatibility documents', () => {
  assert.match(html, /published-visitor-fixture\.jsx/);
  assert.match(fixture, /PublishedProfileDocumentPreview/);
  assert.match(fixture, /buildProfileDocumentV8/);
  assert.match(fixture, /createEmptyLatticeProductionDraft/);
  assert.match(fixture, /buildProfileDocumentV3/);
  assert.match(fixture, /runtime === 'legacy'/);
  assert.doesNotMatch(fixture, /<PublishedHomeWorld/);
});

test('published visitor bootstrap waits on semantic fixture and Version-8 projection signals', () => {
  assert.match(fixture, /ready: true/);
  assert.match(fixture, /data-runtime=\{runtime\}/);
  assert.match(harness, /window\.__fixture\?\.ready === true/);
  assert.match(harness, /canonical nine-table visitor projection/);
  assert.doesNotMatch(harness, /published-home-world__header/);
});
