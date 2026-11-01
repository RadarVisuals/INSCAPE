import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('App uses the shared public portal rather than the legacy people directory', () => {
  const app = read('../App.jsx');
  assert.match(app, /<PublicEntryPortal/);
  assert.doesNotMatch(app, /PublicDiscoverExperience|retainedPublicProfileAddress|discoverRequested/);
});
test('public publication rendering delegates navigation without owning another directory', () => {
  const boundary = read('../profileDocument/components/PublishedProfileBoundary.jsx');
  assert.match(boundary, /onOpenDirectory=\{onOpenDiscover\}/);
  assert.doesNotMatch(boundary, /directoryOpen|PublicEntryPortal|ProfileDiscoveryBoundary/);
});
