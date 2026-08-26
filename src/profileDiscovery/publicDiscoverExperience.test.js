import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const experience = readFileSync(new URL('./PublicDiscoverExperience.jsx', import.meta.url), 'utf8');
const discover = readFileSync(new URL('../public/ownerSystemWorkflow/OwnerSystemWorkflowDiscoverWorkspace.jsx', import.meta.url), 'utf8');
const publishedBoundary = readFileSync(new URL('../profileDocument/components/PublishedProfileBoundary.jsx', import.meta.url), 'utf8');

test('anonymous root enters the shared Discover workspace without an owner profile', () => {
  assert.match(app, /profileTarget\.source === PROFILE_TARGET_SOURCE\.NONE/);
  assert.match(app, /<PublicDiscoverExperience/);
  assert.match(experience, /<OwnerSystemWorkflowDiscoverWorkspace anonymous/);
  assert.match(discover, /label: 'Published worlds'/);
});

test('anonymous Discover omits relationship-only navigation and has no dead close action', () => {
  assert.match(discover, /const sections = anonymous \?/);
  assert.match(discover, /\{onClose && <button aria-label="Close Discover"/);
});

test('anonymous Discover offers an explicit owner connection without gating visitor entry', () => {
  assert.match(app, /<PublicDiscoverExperience onRequestOwner=\{requestStandaloneSignIn\}/);
  assert.match(experience, /onRequestOwner=\{onRequestOwner\}/);
  assert.match(discover, /onRequestOwner && <button className="system-workflow__workspace-owner-entry"/);
  assert.match(discover, />Connect profile</);
});

test('published visitors open the same Discover workspace instead of the legacy directory modal', () => {
  assert.match(publishedBoundary, /lazy\(\(\) => import\('\.\.\/\.\.\/profileDiscovery\/PublicDiscoverExperience\.jsx'\)\)/);
  assert.match(publishedBoundary, /<PublicDiscoverExperience/);
  assert.doesNotMatch(publishedBoundary, /ProfileDiscoveryBoundary/);
});

test('disconnect retains the resolved public profile before owner authority is released', () => {
  assert.match(app, /retainedPublicProfileAddress/);
  assert.match(app, /workspaceFallbackAddress: routeWorkspaceProfileAddress \|\| retainedPublicProfileAddress/);
  assert.match(app, /createSelectedProfileUrl\(window\.location, retainedPublicProfileAddress\)/);
});
