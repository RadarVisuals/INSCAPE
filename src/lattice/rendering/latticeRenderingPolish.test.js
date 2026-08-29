import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const identity = readFileSync(new URL('./latticeProductionIdentityDossier.css', import.meta.url), 'utf8');
const focus = readFileSync(new URL('./latticeFocusViewer.css', import.meta.url), 'utf8');
const ownerCanvas = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowCanvas.jsx', import.meta.url), 'utf8');
const progressiveArtwork = readFileSync(new URL('../../public/ownerSystemWorkflow/progressiveArtworkSources.js', import.meta.url), 'utf8');
const publicAsset = readFileSync(new URL('../../profileDocument/domain/profileDocumentV9Asset.js', import.meta.url), 'utf8');

test('expanded profile rack has one true border and its active selector occupies that border', () => {
  assert.match(identity, /:is\(\[data-phase="opening"\], \[data-phase="open"\]\).*\{ border: 0; \}/);
  assert.match(identity, /button::before \{ position: absolute; inset: 0 auto 0 -1px; width: 4px/);
  assert.match(identity, /button\[aria-expanded="true"\]\) \{ min-height: 0; overflow: visible;/);
});

test('profile and artwork metadata racks cannot create horizontal scrollbars from long values', () => {
  assert.match(identity, /overflow-x: hidden; overflow-y: auto/);
  assert.match(identity, /description p \{[^}]*overflow-wrap: anywhere/);
  assert.match(focus, /rack-panel \{[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto/);
  assert.match(focus, /rack-panel p \{[^}]*overflow-wrap: anywhere/);
});

test('artwork trait grid keeps a stable gutter and follows the metadata type hierarchy', () => {
  assert.match(focus, /rack-panel \{[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/);
  assert.match(focus, /rack-attributes span \{[\s\S]*?font: 500 11px\/1\.1 "Inscape Sora"/);
  assert.doesNotMatch(focus, /rack-attributes span \{[^}]*text-transform:/);
  assert.match(focus, /rack-attributes strong \{[\s\S]*?font: 400 10px\/1\.55 "Inscape Sora"/);
});

test('artwork metadata rack masks fractional animation seams with its active surface', () => {
  assert.match(focus, /lattice-focus-viewer__rack \{[\s\S]*?background: var\(--lattice-menu-panel\);/);
});

test('owner canvas and published preview both prefer the highest-fidelity authored media source', () => {
  assert.match(ownerCanvas, /ProgressiveArtworkImage/);
  assert.match(progressiveArtwork, /\[asset\?\.src, asset\?\.originalImageUrl, asset\?\.imageUrl, \.\.\.low\]/);
  assert.match(publicAsset, /\[asset\.originalImageUrl, asset\.imageUrl, asset\.thumbnailUrl\]/);
});
