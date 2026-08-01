import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./CreationsBrowser.jsx', import.meta.url), 'utf8');

test('creator-attributed works open through the production rack viewer authority', () => {
  assert.match(source, /import LatticeFocusViewer from '\.\.\/lattice\/rendering\/LatticeFocusViewer\.jsx'/);
  assert.match(source, /inspectionVariant="rack"/);
  assert.match(source, /menuSurfaceId=\{menuSurfaceId\}/);
  assert.match(source, /getReturnRectangle=\{\(\) => findCreationElement\(viewerSession\.assetId\)/);
  assert.doesNotMatch(source, /NftFlipViewer|nft-table-viewer/);
});

test('creation technical facts keep indexed metadata and derived links explicit', () => {
  assert.match(source, /CREATORS \/ INDEXED ATTRIBUTION/);
  assert.match(source, /COLLECTION \/ METADATA/);
  assert.match(source, /EXPLORER \/ DERIVED/);
  assert.doesNotMatch(source, /MARKETPLACE|MINT DATE|EDITION|TOTAL SUPPLY/);
});
