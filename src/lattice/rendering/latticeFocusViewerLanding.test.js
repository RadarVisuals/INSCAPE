import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { LATTICE_PRODUCTION_FOCUS_LANDING_MS } from './latticeProductionFocusArtworkMotion.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const viewer = read('./LatticeFocusViewer.jsx');
const viewerStyles = read('./latticeFocusViewer.css');
const ownerViewer = read('../../public/ownerSystemWorkflow/OwnerSystemWorkflowFocusViewer.jsx');
const ownerRuntime = read('../../public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx');
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

test('owner reuses one contained artwork-only focus viewer owned by the Presentation Board', () => {
  assert.match(ownerRuntime, /renderInspection=\{viewer\.placementId \? \(container, controlsContainer\) => <OwnerSystemWorkflowFocusViewer[\s\S]*container=\{container\} controlsContainer=\{controlsContainer\}/);
  assert.equal((ownerRuntime.match(/<OwnerSystemWorkflowFocusViewer/g) || []).length, 1);
  assert.match(ownerViewer, /contained portalTarget=\{container\}/);
  assert.match(ownerViewer, /controlsTarget=\{controlsContainer\}/);
  assert.match(ownerViewer, /inspectionVariant="none"/);
  assert.match(viewer, /data-contained=\{contained \|\| undefined\}/);
  assert.match(viewer, /controlsTarget && createPortal\(<div className="lattice-focus-viewer__board-controls"/);
  assert.match(viewer, /if \(isolatedInspection\) \{\s*requestNavigation\(1\);/);
  assert.doesNotMatch(viewerStyles, /lattice-focus-viewer-browse-(?:in|out)[\s\S]{0,160}transform:/);
  assert.match(ownerViewer, /onClosing=\{\(\) => \{ clearOwnerSystemWorkflowDocumentSelection\(\); viewer\.beginReturn\(\); \}\}/);
  assert.match(ownerViewerState, /beginReturn: \(\) => setAtmosphereActive\(false\)/);
  assert.match(ownerRuntime, /inspectionAtmosphere=\{viewer\.atmosphereActive\}/);
  assert.match(viewer, /portalTarget,/);
  assert.match(viewerStyles, /\.lattice-focus-viewer\[data-contained\][\s\S]*position: absolute;/);
  assert.match(viewerStyles, /\.lattice-focus-viewer\[data-contained\] :is\([\s\S]*\.lattice-focus-viewer__rack,[\s\S]*\.lattice-focus-viewer__close-control[\s\S]*position: absolute;/);
});

test('owner metadata remains independent from artwork focus motion', () => {
  assert.match(ownerRuntime, /<OwnerSystemWorkflowMetadataModule/);
  assert.match(ownerMetadata, /aria-label="Metadata module"/);
  assert.match(ownerMetadata, /dossier\?\.description/);
  assert.doesNotMatch(ownerMetadata, /LatticeFocusViewer|originRectangle|returnLanding|createPortal/);
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
