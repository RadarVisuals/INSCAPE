import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('Alpha support is local-only and exposes no network or persistence path', () => {
  const support = source('./alphaSupport.js');
  const panel = source('./AlphaSupportPanel.jsx');
  for (const forbidden of ['fetch(', 'sendBeacon', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket']) {
    assert.doesNotMatch(`${support}\n${panel}`, new RegExp(forbidden.replace('(', '\\('), 'u'));
  }
  assert.match(panel, /navigator\.clipboard\.writeText\(report\)/u);
  assert.match(panel, /private channel where you received your Alpha invitation/u);
  assert.match(panel, /IPFS publication is public and permanent/u);
});

test('bounded support surfaces cover authority, runtime, publication and visitor resolution', () => {
  const app = source('../App.jsx');
  const owner = source('../public/OwnerRuntimeBoundary.jsx');
  const panel = source('../profileDocument/components/ProfileDocumentPanel.jsx');
  const visitor = source('../profileDocument/components/PublishedProfileBoundary.jsx');
  assert.match(app, /AUTHORITY_INITIALIZATION_FAILED/u);
  assert.match(owner, /UNEXPECTED_APPLICATION_ERROR/u);
  assert.match(panel, /IPFS_UPLOAD_FAILED/u);
  assert.match(panel, /CID_VERIFICATION_FAILED/u);
  assert.match(visitor, /PUBLISHED_DOCUMENT_FAILED/u);
  assert.match(visitor, /PUBLICATION_RESOLUTION_FAILED/u);
});

test('release identity is injected from bounded deployment commit sources', () => {
  const vite = source('../../vite.config.js');
  assert.match(vite, /COMMIT_REF/u);
  assert.match(vite, /GITHUB_SHA/u);
  assert.match(vite, /__INSCAPE_RELEASE_COMMIT__/u);
  assert.doesNotMatch(vite, /exec(?:File|Sync)?\(/u);
});
