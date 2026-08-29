import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { LATTICE_PRODUCTION_FOCUS_LANDING_MS } from './latticeProductionFocusArtworkMotion.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const viewer = read('./LatticeFocusViewer.jsx');
const viewerStyles = read('./latticeFocusViewer.css');
const ownerViewer = read('../../public/ownerSystemWorkflow/OwnerSystemWorkflowFocusViewer.jsx');
const ownerRuntime = read('../../public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx');
const ownerState = read('../../public/ownerSystemWorkflow/useOwnerSystemWorkflowFocusViewer.js');
const visitor = read('../../profileDocument/components/ProfileDocumentV9Visitor.jsx');

test('focus return lands at its exact endpoint before the overlay copy fades', () => {
  assert.equal(LATTICE_PRODUCTION_FOCUS_LANDING_MS, 150);
  assert.match(viewer, /setMotionProgress\(opening \? 1 : 0\);[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*returnLandingRef\.current\?\.\(\);[\s\S]*setReturnLanding\(true\)/);
  assert.match(viewer, /data-return-landing=\{returnLanding \|\| undefined\}/);
  assert.match(viewer, /--lattice-viewer-landing-duration': `\$\{LATTICE_PRODUCTION_FOCUS_LANDING_MS\}ms`/);
  assert.match(viewer, /event\.propertyName === 'opacity'\) finishClose\(\)/);
  assert.match(viewerStyles, /\[data-return-landing\] > \.lattice-focus-viewer__artwork \{[\s\S]*opacity: 0;[\s\S]*transition: opacity var\(--lattice-viewer-landing-duration\) linear;/);
});

test('owner reveals the canonical source only for the landing handoff', () => {
  assert.match(ownerState, /const \[sourceHidden, setSourceHidden\] = useState\(false\)/);
  assert.match(ownerState, /revealSource: \(\) => setSourceHidden\(false\)/);
  assert.match(ownerState, /sourcePlacementId: sourceHidden \? placementId : null/);
  assert.match(ownerViewer, /onReturnLanding=\{viewer\.revealSource\}/);
  assert.match(ownerRuntime, /viewerPlacementId=\{viewer\.sourcePlacementId\}/);
});

test('Visitor uses the same landing handoff while retaining its stored layer order', () => {
  assert.match(visitor, /sourceHidden: true/);
  assert.match(visitor, /viewerSession\.sourceHidden \? viewerSession\.placementId : null/);
  assert.match(visitor, /onReturnLanding=\{\(\) => setViewerSession\(\(current\) => current && \(\{ \.\.\.current, sourceHidden: false \}\)\)\}/);
  assert.doesNotMatch(visitor, /placement\.layer\s*=/);
});

test('reduced motion closes atomically without scheduling a landing fade', () => {
  assert.match(viewer, /if \(reducedMotion\) \{\s*finishClose\(\);\s*return;\s*\}/);
});
