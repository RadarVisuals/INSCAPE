import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ownerSystemWorkflowActivityDetail } from './useOwnerSystemWorkflowActivity.js';

test('activity prefers resolved profile names and keeps a bounded address fallback', () => {
  const entry = { counterparty: '0x1234567890abcdef1234567890abcdef12345678' };
  assert.equal(ownerSystemWorkflowActivityDetail(entry, { name: 'RADAR VISUALS' }), 'RADAR VISUALS');
  assert.equal(ownerSystemWorkflowActivityDetail(entry), '0x123456…45678');
});

test('Display inspection does not depend on a second legacy artwork renderer', () => {
  const source = readFileSync(new URL('./DisplayFocusViewer.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /LatticeFocusViewer|LatticeProductionFocusArtwork|LatticePixelGrid/);
});

// Lifecycle, navigation, tools, publication and discovery are executable browser
// contracts; their mapping lives in the step-26 review.
