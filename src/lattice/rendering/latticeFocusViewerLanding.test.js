import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { LATTICE_PRODUCTION_FOCUS_LANDING_MS } from './latticeProductionFocusArtworkMotion.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const viewer = read('./LatticeFocusViewer.jsx');
const viewerStyles = read('./latticeFocusViewer.css');
const ownerViewer = read('../../public/ownerSystemWorkflow/DisplayFocusViewer.jsx');
const ownerDisplay = read('../../public/ownerSystemWorkflow/DisplayModule.jsx');
const ownerViewerState = read('../../public/ownerSystemWorkflow/useOwnerSystemWorkflowFocusViewer.js');
const ownerMetadata = read('../../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx');
const visitor = read('../../profileDocument/components/ProfileDocumentV9Visitor.jsx');

test('focus return lands at its exact endpoint before the overlay copy fades', () => {
  assert.equal(LATTICE_PRODUCTION_FOCUS_LANDING_MS, 150);
  assert.match(viewer, /setMotionProgress\(opening \? 1 : 0\);[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*returnLandingRef\.current\?\.\(\);[\s\S]*setReturnLanding\(true\)/);
  assert.match(viewer, /data-return-landing=\{returnLanding \|\| undefined\}/);
  assert.match(viewer, /--lattice-viewer-landing-duration': `\$\{LATTICE_PRODUCTION_FOCUS_LANDING_MS\}ms`/);
  assert.match(viewer, /event\.propertyName === 'opacity'\) finishClose\(\)/);
  assert.match(viewerStyles, /\[data-return-landing\] > \.lattice-focus-viewer__artwork \{[\s\S]*opacity: 0;[\s\S]*transition: opacity var\(--lattice-viewer-landing-duration\) linear;/);
});

// Shared Display inspection and focus restoration are exercised in
// browser-tests/display-hardening.browser.mjs.

test('owner metadata remains independent from artwork focus motion', () => {
  assert.match(ownerDisplay, /renderMetadata=\{\(\) => <OwnerSystemWorkflowMetadataContent/);
  assert.match(ownerMetadata, /export function OwnerSystemWorkflowMetadataContent/);
  assert.match(ownerMetadata, /dossier\?\.description/);
  assert.doesNotMatch(ownerMetadata, /LatticeFocusViewer|originRectangle|returnLanding|createPortal/);
});

test('Visitor uses the same landing handoff while retaining its stored layer order', () => {
  assert.match(visitor, /viewerPlacementId=\{viewer\.sourcePlacementId\}/);
  assert.doesNotMatch(visitor, /placement\.layer\s*=/);
});

test('reduced motion closes atomically without scheduling a landing fade', () => {
  assert.match(viewer, /if \(reducedMotion\) \{\s*finishClose\(\);\s*return;\s*\}/);
});
