import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ownerCanvas = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowCanvas.jsx', import.meta.url), 'utf8');
const ownerContent = readFileSync(new URL('../../public/ownerSystemWorkflow/DisplayPlacementContent.jsx', import.meta.url), 'utf8');
const progressiveArtwork = readFileSync(new URL('../../public/ownerSystemWorkflow/progressiveArtworkSources.js', import.meta.url), 'utf8');
const publicAsset = readFileSync(new URL('../../profileDocument/domain/profileDocumentV9Asset.js', import.meta.url), 'utf8');

test('owner canvas and published preview both prefer the highest-fidelity authored media source', () => {
  assert.match(ownerCanvas, /DisplayPlacementContent/);
  assert.match(ownerContent, /ProgressiveArtworkImage/);
  assert.match(progressiveArtwork, /\[asset\?\.src, asset\?\.originalImageUrl, asset\?\.imageUrl, \.\.\.low\]/);
  assert.match(publicAsset, /\[asset\.originalImageUrl, asset\.imageUrl, asset\.thumbnailUrl\]/);
});
