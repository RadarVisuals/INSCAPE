import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('./fixture.html', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./published-visitor-fixture.jsx', import.meta.url), 'utf8');
const harness = readFileSync(new URL('./published-visitor.browser.mjs', import.meta.url), 'utf8');

test('published visitor fixture enters the production Visitor with one exact v9 document', () => {
  assert.match(html, /published-visitor-fixture\.jsx/);
  assert.match(fixture, /ProfileDocumentV9Preview/);
  assert.match(fixture, /buildProfileDocumentV9/);
  assert.match(fixture, /createEmptySystemWorkflowDraft/);
  assert.match(fixture, /systemWorkflowDraft\.grids/);
  assert.doesNotMatch(fixture, /buildProfileDocumentV[1-8]|createEmptyLatticeProductionDraft|runtime === 'legacy'/);
  assert.doesNotMatch(fixture, /<PublishedHomeWorld/);
});

test('published visitor bootstrap waits on semantic fixture and ordered v9 projection signals', () => {
  assert.match(fixture, /ready: true/);
  assert.match(fixture, /data-runtime=\{runtime\}/);
  assert.match(harness, /window\.__fixture\?\.ready === true/);
  assert.doesNotMatch(harness, /published-home-world__header/);
});
